import { getRedisClient } from "../config/redis.js";
import { logger } from "../config/logger.js";
import {
  acquire as redisAcquire,
  release as redisRelease,
  renew as redisRenew,
  LEASE_MS,
} from "./redisExecutionQueue.js";
import { enqueueExecution as directExecution } from "./directExecutionQueue.js";

export class ExecutionQueueError extends Error {
  constructor(message, code = "EXECUTION_COORDINATION_UNAVAILABLE") {
    super(message);
    this.name = "ExecutionQueueError";
    this.code = code;
    this.statusCode = 503;
  }
}

function localQueueExplicitlyEnabled() {
  return process.env.JUDGE0_QUEUE_MODE === "local";
}

async function executeWithLease(redis, token, job) {
  const controller = new AbortController();
  const renewEveryMs = Math.max(500, Math.floor(LEASE_MS / 3));
  let renewalInFlight = false;
  let leaseError = null;

  const heartbeat = setInterval(async () => {
    if (renewalInFlight || leaseError) return;
    renewalInFlight = true;
    try {
      const renewed = await redisRenew(redis, token);
      if (!renewed) {
        leaseError = new ExecutionQueueError(
          "Code execution lost its distributed capacity lease. Please retry.",
        );
        controller.abort(leaseError);
        logger.error({ code: leaseError.code }, "[Judge0Queue] Lease renewal rejected; aborting execution");
      }
    } catch (err) {
      leaseError = new ExecutionQueueError(
        "Code execution coordination is temporarily unavailable. Please retry.",
      );
      controller.abort(leaseError);
      logger.error({ err }, "[Judge0Queue] Lease renewal failed; aborting execution");
    } finally {
      renewalInFlight = false;
    }
  }, renewEveryMs);

  try {
    const result = await job({ signal: controller.signal });
    if (leaseError) throw leaseError;
    return result;
  } catch (err) {
    if (leaseError) throw leaseError;
    throw err;
  } finally {
    clearInterval(heartbeat);
    // Do not release while an in-flight renewal is still able to touch the
    // token. A failed renewal is already treated as a lost lease above.
    while (renewalInFlight) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

export async function enqueueExecution(job) {
  let redis;
  try {
    redis = await getRedisClient();
  } catch (err) {
    logger.error({ err }, "[Judge0Queue] Could not obtain Redis client");
    throw new ExecutionQueueError(
      "Code execution coordination is temporarily unavailable. Please retry.",
    );
  }

  // The local semaphore is safe only for a deliberately single-instance
  // deployment. Never select it automatically when Redis is missing.
  if (!redis) {
    if (localQueueExplicitlyEnabled()) return directExecution(job);
    throw new ExecutionQueueError(
      "Code execution is temporarily unavailable because shared capacity coordination is not configured.",
    );
  }

  if (redis.status && redis.status !== "ready") {
    throw new ExecutionQueueError(
      "Code execution coordination is temporarily unavailable. Please retry.",
    );
  }

  let token;
  try {
    token = await redisAcquire(redis);
  } catch (err) {
    logger.error({ err }, "[Judge0Queue] Redis acquire failed; refusing uncoordinated execution");
    throw new ExecutionQueueError(
      "Code execution coordination is temporarily unavailable. Please retry.",
    );
  }

  if (!token) {
    throw new ExecutionQueueError(
      "Code execution is at capacity right now. Please try again shortly.",
      "EXECUTION_CAPACITY_EXCEEDED",
    );
  }

  try {
    return await executeWithLease(redis, token, job);
  } finally {
    await redisRelease(redis, token);
  }
}

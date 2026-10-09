/**
 * Redis-backed distributed semaphore for Judge0 execution concurrency.
 *
 * Each slot is a random token in a sorted set scored by lease expiry. Acquire
 * and renew are Lua-atomic so independent backend replicas share one cap.
 * Execution workers renew their lease while running; if renewal fails, the
 * caller aborts the Judge0 request instead of allowing a live job to outlast
 * its distributed slot.
 */
import { logger } from "../config/logger.js";

function positiveInt(value, fallback, name) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  if (value !== undefined && value !== "") {
    logger.warn({ name, value, fallback }, "[Judge0Queue] Invalid positive integer setting; using default");
  }
  return fallback;
}

export const MAX_CONCURRENT = positiveInt(process.env.JUDGE0_MAX_CONCURRENCY, 8, "JUDGE0_MAX_CONCURRENCY");
const configuredLeaseMs = positiveInt(process.env.JUDGE0_LEASE_MS, 30000, "JUDGE0_LEASE_MS");
export const LEASE_MS = Math.max(3000, configuredLeaseMs);
if (configuredLeaseMs < 3000) {
  logger.warn({ configuredLeaseMs, minimumLeaseMs: 3000 }, "[Judge0Queue] Lease below safe minimum; clamping to 3000ms");
}
export const ACQUIRE_TIMEOUT_MS = positiveInt(process.env.JUDGE0_ACQUIRE_TIMEOUT_MS, 20000, "JUDGE0_ACQUIRE_TIMEOUT_MS");

const POLL_INTERVAL_MS = 150;
const SEMAPHORE_KEY = process.env.JUDGE0_SEMAPHORE_KEY || "judge0:semaphore";

const ACQUIRE_SCRIPT = `
  local time = redis.call("TIME")
  local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
  redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now)
  local count = redis.call("ZCARD", KEYS[1])
  if count < tonumber(ARGV[2]) then
    redis.call("ZADD", KEYS[1], now + tonumber(ARGV[1]), ARGV[3])
    return 1
  end
  return 0
`;

// A token can only be renewed while it still exists and its current lease
// has not expired. This prevents a delayed heartbeat from resurrecting a slot
// after another worker has already reclaimed it.
const RENEW_SCRIPT = `
  local time = redis.call("TIME")
  local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
  local expiry = redis.call("ZSCORE", KEYS[1], ARGV[1])
  if not expiry or tonumber(expiry) <= now then
    return 0
  end
  redis.call("ZADD", KEYS[1], "XX", now + tonumber(ARGV[2]), ARGV[1])
  return 1
`;

function makeToken() {
  return `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function acquire(redis) {
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;
  const token = makeToken();

  while (true) {
    const acquired = await redis.eval(
      ACQUIRE_SCRIPT,
      1,
      SEMAPHORE_KEY,
      LEASE_MS,
      MAX_CONCURRENT,
      token,
    );
    if (Number(acquired) === 1) return token;

    if (Date.now() + POLL_INTERVAL_MS > deadline) return null;
    await sleep(POLL_INTERVAL_MS);
  }
}

export async function renew(redis, token) {
  if (!token) return false;
  const renewed = await redis.eval(
    RENEW_SCRIPT,
    1,
    SEMAPHORE_KEY,
    token,
    LEASE_MS,
  );
  return Number(renewed) === 1;
}

export async function release(redis, token) {
  if (!token) return;
  try {
    await redis.zrem(SEMAPHORE_KEY, token);
  } catch (err) {
    // A failed release is bounded by the last successful lease renewal.
    // The caller stops renewing as soon as the job finishes, so this slot
    // self-expires without being granted to a second live job.
    logger.warn({ err }, "[Judge0Queue] Redis release failed; slot will expire via lease");
  }
}

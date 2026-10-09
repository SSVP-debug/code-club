/**
 * Shared Redis client.
 *
 * Redis-backed caching may degrade to local cache, but execution admission
 * must fail closed if shared Redis coordination is unavailable. The execution
 * queue checks the returned client's readiness before acquiring a slot.
 * Initial connection failures are retried on later requests, and ioredis
 * reconnects with capped backoff after transient outages.
 */
import { logger } from "./logger.js";

let client = null;
let connectionPromise = null;

export async function getRedisClient() {
  if (client?.status === "ready") return client;
  if (connectionPromise) return connectionPromise;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn(
      "[Redis] REDIS_URL is not configured; caching may use local memory, " +
      "but distributed execution is unavailable unless JUDGE0_QUEUE_MODE=local is explicitly selected.",
    );
    return null;
  }

  connectionPromise = (async () => {
    let redis;
    try {
      const { default: Redis } = await import("ioredis");
      redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        // Keep retrying with capped backoff. Stopping after a few attempts
        // made a transient outage permanent until the process restarted.
        retryStrategy: (times) => Math.min(times * 200, 5000),
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      redis.on("error", (err) => {
        logger.warn({ err }, "[Redis] Connection error");
      });
      redis.on("ready", () => {
        logger.info("[Redis] Connection ready");
      });
      redis.on("end", () => {
        if (client === redis) client = null;
      });

      await redis.connect();
      client = redis;
      return redis;
    } catch (err) {
      if (redis) {
        try { redis.disconnect(); } catch { /* best-effort cleanup */ }
      }
      client = null;
      logger.warn({ err }, "[Redis] Initial connection failed; a later request may retry");
      return null;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

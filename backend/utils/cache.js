/**
 * Shared cache helper used by problemController, leaderboard, and
 * publicProfileController.
 */

import { getRedisClient } from "../config/redis.js";
import { logger } from "../config/logger.js";

const memoryStore = new Map();

function memoryGet(key) {
  const entry = memoryStore.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return undefined;
  }
  return entry.value;
}

function memorySet(key, value, ttlSeconds) {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memoryDelete(key) {
  memoryStore.delete(key);
}

function memoryDeletePrefix(prefix) {
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
}

export async function getOrSetCache(key, ttlSeconds, fetchFn) {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) return { value: JSON.parse(cached), cacheStatus: "HIT" };
    } catch (err) {
      logger.warn({ err, key }, "[Cache] Redis GET failed, falling through to fetch");
    }

    try {
      const value = await fetchFn();
      redis.set(key, JSON.stringify(value), "EX", ttlSeconds).catch((err) => {
        logger.warn({ err, key }, "[Cache] Redis SET failed");
      });
      return { value, cacheStatus: "MISS" };
    } catch (fetchErr) {
      try {
        const stale = await redis.get(key);
        if (stale !== null) return { value: JSON.parse(stale), cacheStatus: "STALE" };
      } catch {
        // Re-throw the original fetch error below.
      }
      throw fetchErr;
    }
  }

  const memCached = memoryGet(key);
  if (memCached !== undefined) return { value: memCached, cacheStatus: "HIT" };

  try {
    const value = await fetchFn();
    memorySet(key, value, ttlSeconds);
    return { value, cacheStatus: "MISS" };
  } catch (fetchErr) {
    const stale = memoryStore.get(key);
    if (stale) return { value: stale.value, cacheStatus: "STALE" };
    throw fetchErr;
  }
}

export async function invalidateCache(key) {
  memoryDelete(key);
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn({ err, key }, "[Cache] Redis DEL failed");
    }
  }
}

export async function invalidateCachePrefix(prefix) {
  memoryDeletePrefix(prefix);
  const redis = await getRedisClient();
  if (redis) {
    try {
      await scanAndDelete(redis, `${prefix}*`);
    } catch (err) {
      logger.warn({ err, prefix }, "[Cache] Redis prefix DEL failed");
    }
  }
}

async function scanAndDelete(redis, pattern) {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== "0");
}

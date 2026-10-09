import { afterAll, beforeAll, describe, expect, it } from "vitest";

const integrationEnabled =
  process.env.RUN_REDIS_INTEGRATION_TESTS === "true" &&
  Boolean(process.env.REDIS_URL);

describe.skipIf(!integrationEnabled)("Redis execution semaphore integration", () => {
  let redisA;
  let redisB;
  let semaphoreKey;
  let acquire;
  let release;
  let renew;

  beforeAll(async () => {
    semaphoreKey = `judge0:integration:${process.pid}:${Date.now()}`;
    process.env.JUDGE0_SEMAPHORE_KEY = semaphoreKey;
    process.env.JUDGE0_MAX_CONCURRENCY = "2";
    process.env.JUDGE0_LEASE_MS = "3000";
    process.env.JUDGE0_ACQUIRE_TIMEOUT_MS = "500";

    const { default: Redis } = await import("ioredis");
    redisA = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    redisB = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    await Promise.all([redisA.connect(), redisB.connect()]);

    ({ acquire, release, renew } = await import("./redisExecutionQueue.js"));
  }, 15000);

  afterAll(async () => {
    if (redisA && semaphoreKey) await redisA.del(semaphoreKey).catch(() => {});
    await Promise.all([
      redisA?.quit().catch(() => {}),
      redisB?.quit().catch(() => {}),
    ]);
  });

  it("enforces one global cap across two independent Redis clients and renews a live lease", async () => {
    const tokenA = await acquire(redisA);
    const tokenB = await acquire(redisB);
    expect(tokenA).toEqual(expect.any(String));
    expect(tokenB).toEqual(expect.any(String));
    expect(tokenA).not.toBe(tokenB);

    try {
      await expect(acquire(redisB)).resolves.toBeNull();
      await expect(renew(redisB, tokenA)).resolves.toBe(true);
      await expect(renew(redisB, "not-a-real-token")).resolves.toBe(false);
    } finally {
      await Promise.all([release(redisA, tokenA), release(redisB, tokenB)]);
    }
  }, 10000);
});

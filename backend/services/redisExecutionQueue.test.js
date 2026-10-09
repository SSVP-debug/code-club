import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../config/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { acquire, release, renew, MAX_CONCURRENT, LEASE_MS } from "./redisExecutionQueue.js";

function fakeRedis() {
  return {
    eval: vi.fn(),
    zrem: vi.fn().mockResolvedValue(1),
  };
}

describe("acquire", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a token immediately when a slot is free", async () => {
    const redis = fakeRedis();
    redis.eval.mockResolvedValue(1);

    const token = await acquire(redis);

    expect(token).toEqual(expect.any(String));
    expect(redis.eval).toHaveBeenCalledOnce();
  });

  it("passes the sorted-set key, current time, lease expiry, max slots, and a token to the script", async () => {
    const redis = fakeRedis();
    redis.eval.mockResolvedValue(1);

    await acquire(redis);

    const [script, numKeys, key, now, leaseExpiry, max, token] = redis.eval.mock.calls[0];
    expect(script).toEqual(expect.stringContaining("ZREMRANGEBYSCORE"));
    expect(numKeys).toBe(1);
    expect(key).toBe("judge0:semaphore");
    expect(typeof now).toBe("number");
    expect(leaseExpiry).toBeGreaterThan(now);
    expect(max).toBe(MAX_CONCURRENT);
    expect(typeof token).toBe("string");
  });

  it("polls until a slot frees up rather than failing immediately", async () => {
    const redis = fakeRedis();
    redis.eval
      .mockResolvedValueOnce(0) // full
      .mockResolvedValueOnce(0) // still full
      .mockResolvedValueOnce(1); // freed up

    const acquirePromise = acquire(redis);

    // Let the internal poll-interval timers fire without needing a real
    // 300ms of wall-clock time in the test.
    await vi.advanceTimersByTimeAsync(150);
    await vi.advanceTimersByTimeAsync(150);

    const token = await acquirePromise;
    expect(token).toEqual(expect.any(String));
    expect(redis.eval).toHaveBeenCalledTimes(3);
  });

  it("gives up and returns null once ACQUIRE_TIMEOUT_MS elapses with no free slot", async () => {
    const redis = fakeRedis();
    redis.eval.mockResolvedValue(0); // always full

    const acquirePromise = acquire(redis);

    // Default ACQUIRE_TIMEOUT_MS is 20s; fast-forward well past it.
    await vi.advanceTimersByTimeAsync(25000);

    const token = await acquirePromise;
    expect(token).toBeNull();
  });

  it("issues a different token on every call, so two concurrent acquirers never collide", async () => {
    const redis = fakeRedis();
    redis.eval.mockResolvedValue(1);

    const [tokenA, tokenB] = await Promise.all([acquire(redis), acquire(redis)]);
    expect(tokenA).not.toBe(tokenB);
  });
});

describe("renew", () => {
  it("renews only the existing token with an atomic script", async () => {
    const redis = fakeRedis();
    redis.eval.mockResolvedValue(1);

    await expect(renew(redis, "live-token")).resolves.toBe(true);

    const [script, numKeys, key, token, now, expiry] = redis.eval.mock.calls[0];
    expect(script).toContain("ZSCORE");
    expect(script).toContain('"XX"');
    expect(numKeys).toBe(1);
    expect(key).toBe("judge0:semaphore");
    expect(token).toBe("live-token");
    expect(typeof now).toBe("number");
    expect(expiry).toBeGreaterThan(now);
    expect(expiry - now).toBe(LEASE_MS);
  });

  it("returns false when Redis reports that the lease no longer exists", async () => {
    const redis = fakeRedis();
    redis.eval.mockResolvedValue(0);

    await expect(renew(redis, "expired-token")).resolves.toBe(false);
  });

  it("does not attempt renewal without a token", async () => {
    const redis = fakeRedis();
    await expect(renew(redis, null)).resolves.toBe(false);
    expect(redis.eval).not.toHaveBeenCalled();
  });
});

describe("release", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes the token from the sorted set", async () => {
    const redis = fakeRedis();
    await release(redis, "some-token");
    expect(redis.zrem).toHaveBeenCalledWith("judge0:semaphore", "some-token");
  });

  it("is a no-op when there's no token to release", async () => {
    const redis = fakeRedis();
    await release(redis, null);
    expect(redis.zrem).not.toHaveBeenCalled();
  });

  it("swallows a Redis error rather than throwing — the lease TTL is the backstop", async () => {
    const redis = fakeRedis();
    redis.zrem.mockRejectedValue(new Error("connection reset"));

    await expect(release(redis, "some-token")).resolves.not.toThrow();
  });
});

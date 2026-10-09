import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../config/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../config/redis.js", () => ({
  getRedisClient: vi.fn(),
}));
vi.mock("./redisExecutionQueue.js", () => ({
  acquire: vi.fn(),
  release: vi.fn().mockResolvedValue(undefined),
  renew: vi.fn().mockResolvedValue(true),
}));
vi.mock("./directExecutionQueue.js", () => ({
  enqueueExecution: vi.fn((job) => job()),
}));

import { getRedisClient } from "../config/redis.js";
import { acquire, release, renew } from "./redisExecutionQueue.js";
import { enqueueExecution as directExecution } from "./directExecutionQueue.js";
import { enqueueExecution } from "./executionQueue.js";

describe("enqueueExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.JUDGE0_QUEUE_MODE;
  });

  it("fails closed when Redis isn't configured", async () => {
    getRedisClient.mockResolvedValue(null);
    const job = vi.fn().mockResolvedValue("result");

    await expect(enqueueExecution(job)).rejects.toMatchObject({
      code: "EXECUTION_COORDINATION_UNAVAILABLE",
      statusCode: 503,
    });
    expect(job).not.toHaveBeenCalled();
    expect(directExecution).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
  });

  it("uses the local semaphore only when explicitly selected", async () => {
    process.env.JUDGE0_QUEUE_MODE = "local";
    getRedisClient.mockResolvedValue(null);
    const job = vi.fn().mockResolvedValue("result");

    const result = await enqueueExecution(job);

    expect(result).toBe("result");
    expect(directExecution).toHaveBeenCalledWith(job);
    expect(acquire).not.toHaveBeenCalled();
  });

  it("runs the job through the Redis semaphore and releases the slot afterward", async () => {
    const redis = {};
    getRedisClient.mockResolvedValue(redis);
    acquire.mockResolvedValue("token-123");
    const job = vi.fn().mockResolvedValue("result");

    const result = await enqueueExecution(job);

    expect(result).toBe("result");
    expect(acquire).toHaveBeenCalledWith(redis);
    expect(job).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledWith(redis, "token-123");
  });

  it("still releases the slot if the job itself throws", async () => {
    const redis = {};
    getRedisClient.mockResolvedValue(redis);
    acquire.mockResolvedValue("token-123");
    const job = vi.fn().mockRejectedValue(new Error("Judge0 blew up"));

    await expect(enqueueExecution(job)).rejects.toThrow("Judge0 blew up");
    expect(release).toHaveBeenCalledWith(redis, "token-123");
  });

  it("throws a clear capacity error when the Redis semaphore times out full", async () => {
    getRedisClient.mockResolvedValue({});
    acquire.mockResolvedValue(null);
    const job = vi.fn();

    await expect(enqueueExecution(job)).rejects.toThrow(/at capacity/i);
    expect(job).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("fails closed if the Redis acquire call itself errors", async () => {
    getRedisClient.mockResolvedValue({ status: "ready" });
    acquire.mockRejectedValue(new Error("ECONNRESET"));
    const job = vi.fn().mockResolvedValue("result");

    await expect(enqueueExecution(job)).rejects.toMatchObject({
      code: "EXECUTION_COORDINATION_UNAVAILABLE",
      statusCode: 503,
    });
    expect(job).not.toHaveBeenCalled();
    expect(directExecution).not.toHaveBeenCalled();
  });

  it("reports capacity exhaustion with a stable error code", async () => {
    getRedisClient.mockResolvedValue({ status: "ready" });
    acquire.mockResolvedValue(null);
    const job = vi.fn();

    await expect(enqueueExecution(job)).rejects.toMatchObject({
      code: "EXECUTION_CAPACITY_EXCEEDED",
      statusCode: 503,
    });
    expect(job).not.toHaveBeenCalled();
  });
});

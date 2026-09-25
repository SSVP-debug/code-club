import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("mongoose", () => ({
  default: {
    connection: {
      readyState: 1,
      db: { stats: vi.fn() },
    },
  },
}));
vi.mock("../services/judge0Health.js", () => ({
  getJudge0Health: vi.fn(),
}));
vi.mock("../config/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import mongoose from "mongoose";
import { getJudge0Health } from "../services/judge0Health.js";
import { getSystemHealth } from "./adminHealthController.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function baseJudge0Health(overrides = {}) {
  return {
    requests: 0,
    successes: 0,
    failures: 0,
    consecutiveFailures: 0,
    circuitOpen: false,
    circuitOpenedAt: null,
    uptime: 123,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("getSystemHealth", () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
    mongoose.connection.readyState = 1;
    mongoose.connection.db.stats.mockResolvedValue({
      dataSize: 1000,
      storageSize: 2000,
      indexSize: 300,
    });
    getJudge0Health.mockReturnValue(baseJudge0Health());
  });

  it("reports API as up (self-referential — the handler ran)", async () => {
    await getSystemHealth({}, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.api.status).toBe("up");
  });

  describe("DB status", () => {
    it("reports up + connected when readyState is 1", async () => {
      mongoose.connection.readyState = 1;
      await getSystemHealth({}, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.db).toMatchObject({ status: "up", state: "connected" });
    });

    it("reports down + disconnected when readyState is 0", async () => {
      mongoose.connection.readyState = 0;
      await getSystemHealth({}, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.db).toMatchObject({ status: "down", state: "disconnected" });
    });

    it("reports degraded (not down) for the transient connecting state", async () => {
      mongoose.connection.readyState = 2;
      await getSystemHealth({}, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.db).toMatchObject({ status: "degraded", state: "connecting" });
    });
  });

  describe("Judge0 status composition", () => {
    it("reports unknown when there's no traffic yet (requests === 0)", async () => {
      getJudge0Health.mockReturnValue(baseJudge0Health({ requests: 0 }));
      await getSystemHealth({}, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.judge0.status).toBe("unknown");
    });

    it("reports up when requests exist and nothing is failing", async () => {
      getJudge0Health.mockReturnValue(
        baseJudge0Health({ requests: 40, successes: 40, consecutiveFailures: 0 })
      );
      await getSystemHealth({}, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.judge0.status).toBe("up");
    });

    it("reports degraded on recent-but-not-yet-circuit-tripping failures", async () => {
      getJudge0Health.mockReturnValue(
        baseJudge0Health({ requests: 10, failures: 2, consecutiveFailures: 2, circuitOpen: false })
      );
      await getSystemHealth({}, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.judge0.status).toBe("degraded");
    });

    it("reports down when the circuit signal is open", async () => {
      getJudge0Health.mockReturnValue(
        baseJudge0Health({
          requests: 10,
          failures: 5,
          consecutiveFailures: 5,
          circuitOpen: true,
          circuitOpenedAt: "2026-08-08T00:00:00.000Z",
        })
      );
      await getSystemHealth({}, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.judge0.status).toBe("down");
      expect(payload.judge0.circuitOpenedAt).toBe("2026-08-08T00:00:00.000Z");
    });
  });

  describe("storage", () => {
    it("reports db.stats() figures when connected", async () => {
      await getSystemHealth({}, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.storage).toMatchObject({
        status: "up",
        dataSizeBytes: 1000,
        storageSizeBytes: 2000,
        indexSizeBytes: 300,
      });
    });

    it("reports unavailable, not an error, when the DB isn't connected", async () => {
      mongoose.connection.readyState = 0;
      await getSystemHealth({}, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.storage.status).toBe("unavailable");
      expect(mongoose.connection.db.stats).not.toHaveBeenCalled();
    });

    it("reports unavailable (not a 500) if db.stats() itself throws", async () => {
      mongoose.connection.db.stats.mockRejectedValueOnce(new Error("boom"));
      await getSystemHealth({}, res);
      expect(res.status).not.toHaveBeenCalledWith(500);
      const payload = res.json.mock.calls[0][0];
      expect(payload.storage.status).toBe("unavailable");
    });
  });

  it("reports background jobs honestly — one in-process, two external, no fabricated dashboard", async () => {
    await getSystemHealth({}, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.backgroundJobs.inProcess).toHaveLength(1);
    expect(payload.backgroundJobs.inProcess[0].name).toBe("Interview session sweep");
    expect(payload.backgroundJobs.external).toHaveLength(2);
    expect(payload.backgroundJobs.external[0].name).toBe("Weekly review emails");
    expect(payload.backgroundJobs.external[1].name).toBe("Assignment auto-reminders");
  });
});
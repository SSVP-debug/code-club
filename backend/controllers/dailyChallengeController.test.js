import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../services/dailyChallengeService.js", () => ({
  hasCompletedDailyChallenge: vi.fn().mockResolvedValue(false),
  recordDailyChallengeCompletion: vi.fn().mockResolvedValue({}),
}));

import {
  hasCompletedDailyChallenge,
  recordDailyChallengeCompletion,
} from "../services/dailyChallengeService.js";
import { completeDailyChallenge } from "./dailyChallengeController.js";
import { getStudentDayKey } from "../utils/studentDay.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return {
    body: {},
    log: { error: vi.fn(), warn: vi.fn() },
    userDoc: { _id: "u1" },
    ...overrides,
  };
}

describe("completeDailyChallenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasCompletedDailyChallenge.mockResolvedValue(false);
    recordDailyChallengeCompletion.mockResolvedValue({});
  });

  it("400s if slug is missing", async () => {
    const res = mockRes();
    await completeDailyChallenge(mockReq({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(recordDailyChallengeCompletion).not.toHaveBeenCalled();
  });

  it("records today's completion in the dedicated collection", async () => {
    const res = mockRes();
    await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res);

    expect(recordDailyChallengeCompletion).toHaveBeenCalledWith(
      "u1",
      getStudentDayKey(),
      "two-sum",
      expect.any(Date)
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, alreadyCompleted: false });
  });

  it("is a no-op if today's challenge was already completed", async () => {
    hasCompletedDailyChallenge.mockResolvedValueOnce(true);
    const res = mockRes();

    await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res);

    expect(recordDailyChallengeCompletion).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, alreadyCompleted: true });
  });

  it("returns 500 if the completion write fails", async () => {
    recordDailyChallengeCompletion.mockRejectedValueOnce(new Error("db down"));
    const res = mockRes();

    await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  describe("IST day-boundary behavior", () => {
    afterEach(() => vi.useRealTimers());

    it("uses the IST calendar day", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-20T23:58:00.000Z"));

      const res = mockRes();
      await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res);

      expect(recordDailyChallengeCompletion).toHaveBeenCalledWith(
        "u1",
        "2026-08-21",
        "two-sum",
        expect.any(Date)
      );
    });

    it("does not collide across an IST day rollover", async () => {
      vi.useFakeTimers();

      vi.setSystemTime(new Date("2026-08-20T18:00:00.000Z"));
      const res1 = mockRes();
      await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res1);

      vi.setSystemTime(new Date("2026-08-20T19:00:00.000Z"));
      const res2 = mockRes();
      await completeDailyChallenge(mockReq({ body: { slug: "three-sum" } }), res2);

      expect(recordDailyChallengeCompletion).toHaveBeenNthCalledWith(
        1, "u1", "2026-08-20", "two-sum", expect.any(Date)
      );
      expect(recordDailyChallengeCompletion).toHaveBeenNthCalledWith(
        2, "u1", "2026-08-21", "three-sum", expect.any(Date)
      );
    });

    it("relies on the unique completion key for repeated requests", async () => {
      hasCompletedDailyChallenge
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const req = mockReq({ body: { slug: "two-sum" } });
      await completeDailyChallenge(req, mockRes());
      await completeDailyChallenge(req, mockRes());

      expect(recordDailyChallengeCompletion).toHaveBeenCalledTimes(1);
    });
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../models/DailyChallengeCompletion.js", () => ({
  default: { findOneAndUpdate: vi.fn() },
}));

import DailyChallengeCompletion from "../models/DailyChallengeCompletion.js";
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
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
    DailyChallengeCompletion.findOneAndUpdate.mockResolvedValue(null);
  });

  it("400s if slug is missing", async () => {
    await completeDailyChallenge(mockReq({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(DailyChallengeCompletion.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("creates today's completion and reports not previously completed", async () => {
    await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res);

    expect(DailyChallengeCompletion.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", date: getStudentDayKey() }),
      {
        $setOnInsert: expect.objectContaining({
          userId: "u1",
          date: getStudentDayKey(),
          slug: "two-sum",
          completedAt: expect.any(Date),
        }),
      },
      { upsert: true, new: false }
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, alreadyCompleted: false });
  });

  it("is idempotent when today's completion already exists", async () => {
    DailyChallengeCompletion.findOneAndUpdate.mockResolvedValueOnce({ _id: "existing" });

    await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res);

    expect(res.json).toHaveBeenCalledWith({ success: true, alreadyCompleted: true });
  });

  it("returns 500 if the completion write fails", async () => {
    DailyChallengeCompletion.findOneAndUpdate.mockRejectedValueOnce(new Error("db down"));

    await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  describe("IST day-boundary behavior (backend/utils/studentDay.js policy)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("uses the IST calendar day, not the raw UTC day", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-20T23:58:00.000Z"));

      await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res);

      expect(DailyChallengeCompletion.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ date: "2026-08-21" }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it("does not collide across the IST day rollover", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-20T18:00:00.000Z"));

      await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res);
      const firstDate = DailyChallengeCompletion.findOneAndUpdate.mock.calls[0][0].date;

      vi.setSystemTime(new Date("2026-08-20T19:00:00.000Z"));
      await completeDailyChallenge(mockReq({ body: { slug: "three-sum" } }), mockRes());
      const secondDate = DailyChallengeCompletion.findOneAndUpdate.mock.calls[1][0].date;

      expect(firstDate).toBe("2026-08-20");
      expect(secondDate).toBe("2026-08-21");
    });

    it("relies on the database uniqueness boundary for repeated same-day requests", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-21T05:00:00.000Z"));
      DailyChallengeCompletion.findOneAndUpdate
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: "existing" });

      await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), mockRes());
      const res2 = mockRes();
      await completeDailyChallenge(mockReq({ body: { slug: "two-sum" } }), res2);

      expect(DailyChallengeCompletion.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(res2.json).toHaveBeenCalledWith({ success: true, alreadyCompleted: true });
    });
  });
});

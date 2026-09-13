import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../services/userProgressService.js", () => ({
  saveProgress: vi.fn().mockResolvedValue({ acknowledged: true }),
}));

import { saveProgress } from "../services/userProgressService.js";
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
    userDoc: { _id: "u1", dailyChallengeHistory: [] },
    ...overrides,
  };
}

describe("completeDailyChallenge", () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("400s if slug is missing", async () => {
    await completeDailyChallenge(mockReq({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(saveProgress).not.toHaveBeenCalled();
  });

  it("appends today's entry and dual-writes via saveProgress", async () => {
    const req = mockReq({ body: { slug: "two-sum" } });

    await completeDailyChallenge(req, res);

    expect(req.userDoc.dailyChallengeHistory).toHaveLength(1);
    expect(req.userDoc.dailyChallengeHistory[0]).toMatchObject({
      slug: "two-sum",
      completed: true,
    });
    expect(saveProgress).toHaveBeenCalledWith(
      "u1",
      { dailyChallengeHistory: req.userDoc.dailyChallengeHistory }
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, alreadyCompleted: false });
  });

  it("is a no-op (and doesn't write) if today's challenge was already completed", async () => {
    // Uses the same shared day-key the controller itself now uses
    // (backend/utils/studentDay.js) instead of a hand-rolled UTC date —
    // computing this independently used to work by coincidence outside
    // the 00:00-05:29 IST window and would otherwise have been flaky.
    const today = getStudentDayKey();
    const req = mockReq({
      body: { slug: "two-sum" },
      userDoc: {
        _id: "u1",
        dailyChallengeHistory: [{ date: today, slug: "two-sum", completed: true }],
      },
    });

    await completeDailyChallenge(req, res);

    expect(saveProgress).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, alreadyCompleted: true });
  });


  it("returns 500 if the dual-write fails", async () => {
    saveProgress.mockRejectedValueOnce(new Error("db down"));
    const req = mockReq({ body: { slug: "two-sum" } });

    await completeDailyChallenge(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  describe("IST day-boundary behavior (backend/utils/studentDay.js policy)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("records the IST calendar day, not the raw UTC day, when they disagree", async () => {
      // 2026-08-20T23:58:00.000Z UTC == 2026-08-21T05:28 IST — the entry
      // must be dated "2026-08-21", not "2026-08-20".
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-20T23:58:00.000Z"));

      const req = mockReq({ body: { slug: "two-sum" } });
      await completeDailyChallenge(req, res);

      expect(req.userDoc.dailyChallengeHistory[0].date).toBe("2026-08-21");
    });

    it("a completion just before the IST rollover and a status check just after it do not collide", async () => {
      vi.useFakeTimers();

      // Completed at 2026-08-20T18:00:00.000Z UTC == 2026-08-20T23:30 IST
      // — still "Aug 20" in IST terms.
      vi.setSystemTime(new Date("2026-08-20T18:00:00.000Z"));
      const req1 = mockReq({ body: { slug: "two-sum" } });
      await completeDailyChallenge(req1, res);
      expect(req1.userDoc.dailyChallengeHistory[0].date).toBe("2026-08-20");

      // A few hours later, 2026-08-20T19:00:00.000Z UTC == 2026-08-21T00:30
      // IST — now genuinely "Aug 21," a new challenge is required.
      vi.setSystemTime(new Date("2026-08-20T19:00:00.000Z"));
      const res2 = mockRes();
      const req2 = mockReq({
        body: { slug: "three-sum" },
        userDoc: { _id: "u1", dailyChallengeHistory: req1.userDoc.dailyChallengeHistory },
      });
      await completeDailyChallenge(req2, res2);

      expect(req2.userDoc.dailyChallengeHistory).toHaveLength(2);
      expect(req2.userDoc.dailyChallengeHistory[1].date).toBe("2026-08-21");
      expect(res2.json).toHaveBeenCalledWith({ success: true, alreadyCompleted: false });
    });

    it("multiple requests (simulating multiple tabs) in the same IST day agree and dual-write only once", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-21T05:00:00.000Z"));

      const userDoc = { _id: "u1", dailyChallengeHistory: [] };

      const req1 = mockReq({ body: { slug: "two-sum" }, userDoc });
      await completeDailyChallenge(req1, mockRes());

      const req2 = mockReq({ body: { slug: "two-sum" }, userDoc });
      const res2 = mockRes();
      await completeDailyChallenge(req2, res2);

      expect(saveProgress).toHaveBeenCalledTimes(1);
      expect(res2.json).toHaveBeenCalledWith({ success: true, alreadyCompleted: true });
    });
  });
});

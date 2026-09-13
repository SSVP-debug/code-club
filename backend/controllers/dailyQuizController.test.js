import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  getDailyQuizStatus,
  completeDailyQuiz,
} from "./dailyQuizController.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return {
    log: { error: vi.fn(), warn: vi.fn() },
    userDoc: {
      _id: "u1",
      dailyQuizCompletedDate: null,
      save: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

describe("dailyQuizController", () => {
  let res;

  beforeEach(() => {
    res = mockRes();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getDailyQuizStatus", () => {
    it("required=true, completed=false when never completed", () => {
      const req = mockReq();

      getDailyQuizStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({ required: true, completed: false });
    });

    it("required=false, completed=true when completed today", () => {
      const req = mockReq({
        userDoc: { _id: "u1", dailyQuizCompletedDate: "2026-08-21" },
      });

      getDailyQuizStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({ required: false, completed: true });
    });

    it("required=true when completion is from a previous day", () => {
      const req = mockReq({
        userDoc: { _id: "u1", dailyQuizCompletedDate: "2026-08-20" },
      });

      getDailyQuizStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({ required: true, completed: false });
    });

    it("does not leak anything beyond required/completed", () => {
      const req = mockReq();

      getDailyQuizStatus(req, res);

      const body = res.json.mock.calls[0][0];
      expect(Object.keys(body).sort()).toEqual(["completed", "required"]);
    });
  });

  describe("completeDailyQuiz", () => {
    it("records today's date and saves", async () => {
      const req = mockReq();

      await completeDailyQuiz(req, res);

      expect(req.userDoc.dailyQuizCompletedDate).toBe("2026-08-21");
      expect(req.userDoc.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ required: false, completed: true });
    });

    it("is idempotent — does not re-save if already completed today", async () => {
      const req = mockReq({
        userDoc: {
          _id: "u1",
          dailyQuizCompletedDate: "2026-08-21",
          save: vi.fn().mockResolvedValue(undefined),
        },
      });

      await completeDailyQuiz(req, res);

      expect(req.userDoc.save).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ required: false, completed: true });
    });

    it("overwrites a stale previous-day completion", async () => {
      const req = mockReq({
        userDoc: {
          _id: "u1",
          dailyQuizCompletedDate: "2026-08-20",
          save: vi.fn().mockResolvedValue(undefined),
        },
      });

      await completeDailyQuiz(req, res);

      expect(req.userDoc.dailyQuizCompletedDate).toBe("2026-08-21");
      expect(req.userDoc.save).toHaveBeenCalled();
    });

    it("returns 500 and does not unlock if save fails", async () => {
      const req = mockReq({
        userDoc: {
          _id: "u1",
          dailyQuizCompletedDate: null,
          save: vi.fn().mockRejectedValue(new Error("db down")),
        },
      });

      await completeDailyQuiz(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).not.toHaveBeenCalledWith({ required: false, completed: true });
    });
  });

  describe("IST day-boundary behavior (backend/utils/studentDay.js policy)", () => {
    it("5:29 AM IST is already the NEW IST day, not the previous UTC day (regression guard)", async () => {
      // 2026-08-20T23:58:00.000Z UTC == 2026-08-21T05:28 IST — already
      // "Aug 21" in IST terms, even though the raw UTC calendar date is
      // still "Aug 20". The old `toISOString().split("T")[0]` implementation
      // would have recorded this completion as "2026-08-20" instead.
      vi.setSystemTime(new Date("2026-08-20T23:58:00.000Z"));
      const completeReq = mockReq();
      await completeDailyQuiz(completeReq, mockRes());
      expect(completeReq.userDoc.dailyQuizCompletedDate).toBe("2026-08-21");

      // A minute later (2026-08-20T23:59:00.000Z UTC == 2026-08-21T05:29
      // IST — still the same IST day), the status check must agree it's
      // already done rather than showing the gate again.
      vi.setSystemTime(new Date("2026-08-20T23:59:00.000Z"));
      const req = mockReq({
        userDoc: { _id: "u1", dailyQuizCompletedDate: "2026-08-21" },
      });
      const res2 = mockRes();
      getDailyQuizStatus(req, res2);

      expect(res2.json).toHaveBeenCalledWith({ required: false, completed: true });
    });

    it("5:30 AM IST rolls over to the new day", () => {
      // 2026-08-21T05:30 IST == 2026-08-21T00:00:00.000Z
      vi.setSystemTime(new Date("2026-08-21T00:00:00.000Z"));
      const req = mockReq({
        userDoc: { _id: "u1", dailyQuizCompletedDate: "2026-08-20" },
      });
      getDailyQuizStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({ required: true, completed: false });
    });

    it("multiple requests in the same IST day (simulating multiple tabs) all agree and only save once", async () => {
      const userDoc = {
        _id: "u1",
        dailyQuizCompletedDate: null,
        save: vi.fn().mockResolvedValue(undefined),
      };

      const req1 = mockReq({ userDoc });
      const res1 = mockRes();
      await completeDailyQuiz(req1, res1);

      // A second "tab" firing the same request against the now-updated
      // userDoc should see it as already-completed and not save again.
      const req2 = mockReq({ userDoc });
      const res2 = mockRes();
      await completeDailyQuiz(req2, res2);

      expect(userDoc.save).toHaveBeenCalledTimes(1);
      expect(res1.json).toHaveBeenCalledWith({ required: false, completed: true });
      expect(res2.json).toHaveBeenCalledWith({ required: false, completed: true });
    });

    it("a page refresh after completion reflects completed=true, not the gate reappearing", () => {
      const req = mockReq({
        userDoc: { _id: "u1", dailyQuizCompletedDate: "2026-08-21" },
      });
      getDailyQuizStatus(req, res);
      expect(res.json).toHaveBeenCalledWith({ required: false, completed: true });

      // Simulate the refresh: a brand new request object, same server day.
      const reqAfterRefresh = mockReq({
        userDoc: { _id: "u1", dailyQuizCompletedDate: "2026-08-21" },
      });
      const resAfterRefresh = mockRes();
      getDailyQuizStatus(reqAfterRefresh, resAfterRefresh);
      expect(resAfterRefresh.json).toHaveBeenCalledWith({ required: false, completed: true });
    });
  });
});

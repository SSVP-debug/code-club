import { describe, expect, it, beforeAll, afterEach, afterAll, vi } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";
import User from "./User.js";
import { getDailyQuizStatus, completeDailyQuiz } from "../controllers/dailyQuizController.js";

// Regression coverage for the Daily Quiz Gate redirect bug: dailyQuizController.js
// has always read/written `req.userDoc.dailyQuizCompletedDate`, but the field was
// never declared on the User schema. Under Mongoose's default `strict: true`, that
// write is silently dropped from `$set` on `.save()` — same class of bug as the
// `education`/`emailDomain` schema-drift fixes elsewhere in this model. Unit tests
// (dailyQuizController.test.js) use a plain mock object for `req.userDoc`, which
// can't catch this: a mock object has no schema to drop the field from, so it looks
// like the write "worked" even when it silently wouldn't against real Mongoose.
// This suite exercises the controller against a REAL Mongoose document, reloaded
// fresh from the database between requests, the way a page refresh (past the ~5s
// req.userDoc auth cache TTL — backend/utils/userAuthCache.js) actually behaves.
function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(userDoc) {
  return { log: { error: vi.fn(), warn: vi.fn() }, userDoc };
}

describe("User model — dailyQuizCompletedDate field", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
    vi.useRealTimers();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("persists dailyQuizCompletedDate to MongoDB after completeDailyQuiz saves", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    const created = await User.create({ firebaseUid: "fb-quiz-a", email: "a@example.edu" });
    expect(created.dailyQuizCompletedDate).toBeNull();

    await completeDailyQuiz(mockReq(created), mockRes());

    // The real regression: reload as a BRAND NEW document instance, the way a
    // fresh request (past the auth-cache TTL) would after a page refresh.
    const reloaded = await User.findById(created._id);
    expect(reloaded.dailyQuizCompletedDate).toBe("2026-08-21");
  });

  it(
    "reports completed=true from a freshly-reloaded document (simulates refresh past the auth cache TTL)",
    async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

      const created = await User.create({ firebaseUid: "fb-quiz-b", email: "b@example.edu" });
      await completeDailyQuiz(mockReq(created), mockRes());

      // Simulate the auth cache expiring and a subsequent request reloading
      // the user doc fresh from the database — this is exactly what a
      // browser refresh does once the ~5s cache window has passed.
      const reloaded = await User.findById(created._id);
      const res = mockRes();

      getDailyQuizStatus(mockReq(reloaded), res);

      expect(res.json).toHaveBeenCalledWith({ required: false, completed: true });
    }
  );

  it("required=true for a fresh reload on a new calendar day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));

    const created = await User.create({ firebaseUid: "fb-quiz-c", email: "c@example.edu" });
    await completeDailyQuiz(mockReq(created), mockRes());

    vi.setSystemTime(new Date("2026-08-22T00:05:00.000Z"));

    const reloaded = await User.findById(created._id);
    const res = mockRes();

    getDailyQuizStatus(mockReq(reloaded), res);

    expect(res.json).toHaveBeenCalledWith({ required: true, completed: false });
  });

  it("defaults dailyQuizCompletedDate to null for a newly created user", async () => {
    const created = await User.create({ firebaseUid: "fb-quiz-d", email: "d@example.edu" });

    const reloaded = await User.findById(created._id).lean();
    expect(reloaded.dailyQuizCompletedDate).toBeNull();
  });
});
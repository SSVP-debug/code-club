import { describe, expect, it, vi, afterEach } from "vitest";
import { progressToClient, progressToClientForRole, emptyProgress } from "./progressController.js";

// Root-cause regression coverage: before progressToClientForRole existed,
// routes/init.js called progressToClient(req.userDoc) unconditionally, so
// a TPO/recruiter session rendered whatever student-track fields
// (totalXP, currentStreak, solvedSlugs, etc.) happened to still be on the
// User document from a prior Student registration. See models/User.js's
// role/roles comment for the full writeup.

function makeStudentLikeUser(role) {
  return {
    role,
    totalXP: 4200,
    currentStreak: 7,
    longestStreak: 30,
    solvedSlugs: ["two-sum", "valid-parentheses"],
    achievements: [{ key: "first-blood", unlockedAt: new Date("2026-01-01") }],
    activityDates: [
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ],
    recentActivity: [{ title: "Two Sum", slug: "two-sum", difficulty: "Easy", time: "2026-01-01" }],
    solvedDifficulty: { easy: 2, medium: 0, hard: 0 },
    dailyChallengeHistory: [],
    lastActivityDate: "2026-01-02",
    joinedDate: new Date("2025-06-01"),
    leetcodeUsername: "leetcoder123",
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("progressToClient — role-agnostic, always the real data", () => {
  it("serializes real progress regardless of the account's active role", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00.000Z"));

    // Used by XP awarding, achievement evaluation, the leaderboard, and
    // the public profile — none of which should be gated by active role,
    // since a person's real solve history doesn't change just because
    // they're currently looking at their TPO dashboard.
    const tpoWithLeftoverStudentData = makeStudentLikeUser("tpo");
    const result = progressToClient(tpoWithLeftoverStudentData);
    expect(result.totalXP).toBe(4200);
    expect(result.currentStreak).toBe(7);
    expect(result.solvedSlugs).toEqual(["two-sum", "valid-parentheses"]);
  });
});

describe("progressToClientForRole — the read-boundary fix", () => {
  it("returns real progress data for an active student role", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00.000Z"));
    const student = makeStudentLikeUser("student");
    const result = progressToClientForRole(student);
    expect(result.totalXP).toBe(4200);
    expect(result.currentStreak).toBe(7);
    expect(result.solvedSlugs).toEqual(["two-sum", "valid-parentheses"]);
  });

  it("REGRESSION: never exposes leftover student data for an active tpo role", () => {
    const tpoWithLeftoverStudentData = makeStudentLikeUser("tpo");
    const result = progressToClientForRole(tpoWithLeftoverStudentData);
    expect(result).toEqual(emptyProgress());
    expect(result.totalXP).toBe(0);
    expect(result.currentStreak).toBe(0);
    expect(result.solvedSlugs).toEqual([]);
    expect(result.achievements).toEqual([]);
  });

  it("REGRESSION: never exposes leftover student data for an active recruiter role", () => {
    const recruiterWithLeftoverStudentData = makeStudentLikeUser("recruiter");
    const result = progressToClientForRole(recruiterWithLeftoverStudentData);
    expect(result).toEqual(emptyProgress());
  });

  it("returns the empty scaffold for an admin session too", () => {
    const admin = makeStudentLikeUser("admin");
    const result = progressToClientForRole(admin);
    expect(result).toEqual(emptyProgress());
  });

  it("handles a null/undefined user defensively (matches _dbDown callers)", () => {
    expect(progressToClientForRole(null)).toEqual(emptyProgress());
    expect(progressToClientForRole(undefined)).toEqual(emptyProgress());
  });
});

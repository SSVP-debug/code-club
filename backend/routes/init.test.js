import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/User.js", () => ({
  default: {},
}));
vi.mock("../models/Submission.js", () => ({
  default: { find: vi.fn() },
}));
vi.mock("../services/problemProgressService.js", () => ({
  getSolvedSlugs: vi.fn().mockResolvedValue(["two-sum"]),
  getActivityDays: vi.fn().mockResolvedValue([
    "2026-09-06",
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
    "2026-09-11",
    "2026-09-12",
  ]),
}));
vi.mock("../services/userSavedProblemService.js", () => ({
  listSavedProblems: vi.fn().mockResolvedValue([]),
}));

import Submission from "../models/Submission.js";
import initRouter from "./init.js";

function extractHandler() {
  const layer = initRouter.stack.find((l) => l.route && l.route.path === "/");
  return layer.route.stack[0].handle;
}
const handler = extractHandler();

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeUserDoc(overrides = {}) {
  return {
    _id: "user1",
    role: "student",
    roles: ["student"],
    email: "person@example.com",
    displayName: "Person",
    username: "person1",
    totalXP: 4200,
    currentStreak: 7,
    longestStreak: 30,
    solvedSlugs: ["two-sum"],
    achievements: [],
    activityDates: [
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ],
    recentActivity: [],
    solvedDifficulty: { easy: 1, medium: 0, hard: 0 },
    dailyChallengeHistory: [],
    lastActivityDate: null,
    joinedDate: new Date("2025-06-01"),
    leetcodeUsername: "",
    ...overrides,
  };
}

describe("GET /api/init — role-gated progress/submissions (role/profile isolation fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Submission.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it("returns real progress + fetches submissions for a student session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00.000Z"));
    const req = { userDoc: makeUserDoc({ role: "student" }), log: mockLog() };
    const res = mockRes();

    await handler(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.progress.totalXP).toBe(4200);
    expect(payload.progress.currentStreak).toBe(7);
    expect(Submission.find).toHaveBeenCalledWith({ userId: "user1" });
    vi.useRealTimers();
  });

  it(
    "REGRESSION: a TPO session with leftover Student data on the same document " +
      "gets zeroed progress and never queries submissions",
    async () => {
      const req = {
        userDoc: makeUserDoc({ role: "tpo", roles: ["student", "tpo"] }),
        log: mockLog(),
      };
      const res = mockRes();

      await handler(req, res);

      const [payload] = res.json.mock.calls[0];
      expect(payload.progress.totalXP).toBe(0);
      expect(payload.progress.currentStreak).toBe(0);
      expect(payload.progress.solvedSlugs).toEqual([]);
      expect(payload.submissions).toEqual([]);
      expect(Submission.find).not.toHaveBeenCalled();
    }
  );

  it("REGRESSION: a recruiter session with leftover Student data also gets zeroed progress", async () => {
    const req = {
      userDoc: makeUserDoc({ role: "recruiter", roles: ["student", "recruiter"] }),
      log: mockLog(),
    };
    const res = mockRes();

    await handler(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.progress.totalXP).toBe(0);
    expect(payload.submissions).toEqual([]);
  });

  it("passes the authorized roles[] array through alongside the active role", async () => {
    const req = {
      userDoc: makeUserDoc({ role: "tpo", roles: ["student", "tpo"] }),
      log: mockLog(),
    };
    const res = mockRes();

    await handler(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.user.role).toBe("tpo");
    expect(payload.user.roles).toEqual(["student", "tpo"]);
  });

  it("falls back to roles: [\"student\"] when roles is unset (pre-migration document)", async () => {
    const req = { userDoc: makeUserDoc({ role: "student", roles: undefined }), log: mockLog() };
    const res = mockRes();

    await handler(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.user.roles).toEqual(["student"]);
  });

  it("returns the empty scaffold with _dbDown when Mongo is unavailable", async () => {
    const req = { userDoc: null, log: mockLog() };
    const res = mockRes();

    await handler(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload._dbDown).toBe(true);
    expect(payload.progress.totalXP).toBe(0);
  });
});

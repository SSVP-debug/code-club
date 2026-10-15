import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/User.js", () => ({
  default: { findOne: vi.fn() },
}));
vi.mock("../models/Submission.js", () => ({
  default: { find: vi.fn() },
}));
vi.mock("../services/problemProgressService.js", () => ({
  getSolvedSlugs: vi.fn().mockResolvedValue(["two-sum"]),
  getActivityDays: vi.fn().mockResolvedValue([]),
}));
vi.mock("../utils/cache.js", () => ({
  // Bypass real caching entirely — just run the factory function and wrap
  // it the way getOrSetCache would on a cache MISS. This suite is about
  // what fetchProfile() computes, not the caching layer.
  getOrSetCache: vi.fn(async (key, ttl, fetchFn) => ({
    value: await fetchFn(),
    cacheStatus: "MISS",
  })),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

import User from "../models/User.js";
import Submission from "../models/Submission.js";
import { getPublicProfile } from "./publicProfileController.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  return res;
}

function mockLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeUser(overrides = {}) {
  return {
    username: "student1",
    displayName: "Student One",
    isProfilePublic: true,
    totalXP: 100,
    solvedSlugs: ["two-sum"],
    currentStreak: 1,
    longestStreak: 1,
    solvedDifficulty: { easy: 1, medium: 0, hard: 0 },
    topicStats: {},
    achievements: [],
    activityDates: [],
    recentActivity: [],
    pinnedProblems: [],
    ...overrides,
  };
}

describe("getPublicProfile — recentSolves reflects whatever recentActivity actually holds", () => {
  let res;
  let req;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
    req = { params: { username: "student1" }, log: mockLog() };
    Submission.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it(
    "passes slug and difficulty through when the underlying recentActivity entry has them " +
      "(regression test for plans/02 — these were previously always undefined)",
    async () => {
      User.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(
          makeUser({
            recentActivity: [
              { title: "Two Sum", slug: "two-sum", difficulty: "Easy", time: "2026-01-01" },
            ],
          })
        ),
      });

      await getPublicProfile(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          recentSolves: [
            { slug: "two-sum", title: "Two Sum", difficulty: "Easy", time: "2026-01-01" },
          ],
        })
      );
    }
  );

  it(
    "passes slug/difficulty through as undefined (not defaulted or masked) for a pre-fix entry " +
      "missing them — confirms the controller reflects the schema rather than papering over gaps",
    async () => {
      User.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(
          makeUser({
            recentActivity: [{ title: "Old Entry", time: "2025-06-01" }],
          })
        ),
      });

      await getPublicProfile(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          recentSolves: [
            { slug: undefined, title: "Old Entry", difficulty: undefined, time: "2025-06-01" },
          ],
        })
      );
    }
  );

  it("returns at most 5 recent solves even when recentActivity holds more", async () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({
      title: `Problem ${i}`,
      slug: `problem-${i}`,
      difficulty: "Easy",
      time: "2026-01-01",
    }));
    User.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(makeUser({ recentActivity: entries })),
    });

    await getPublicProfile(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.recentSolves).toHaveLength(5);
  });
});
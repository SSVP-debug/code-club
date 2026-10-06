import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/User.js", () => ({
  default: { aggregate: vi.fn(), countDocuments: vi.fn() },
}));
vi.mock("../utils/cache.js", () => ({
  // Bypass real caching — just run the factory function, as if every call
  // were a cache MISS. This suite is about the aggregation pipeline and the
  // response mapping, not the caching layer (covered separately in cache.test.js).
  getOrSetCache: vi.fn(async (key, ttl, fetchFn) => ({ value: await fetchFn() })),
  invalidateCachePrefix: vi.fn().mockResolvedValue(undefined),
}));

import User from "../models/User.js";
import leaderboardRouter from "./leaderboard.js";

function getHandler(path) {
  const layer = leaderboardRouter.stack.find((l) => l.route && l.route.path === path);
  if (!layer) throw new Error(`No route registered for path ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("leaderboard.js — global ranking", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    User.countDocuments.mockResolvedValue(0);
    res = mockRes();
    req = { query: {}, log: mockLog() };
  });

  it("limits the aggregation before computing solvedCount", async () => {
    User.countDocuments.mockResolvedValue(600);
    User.aggregate.mockResolvedValue([]);

    await getHandler("/global")(req, res);

    const pipeline = User.aggregate.mock.calls[0][0];
    const limitStage = pipeline.find((stage) => stage.$limit === 20);
    const addFieldsStage = pipeline.find((stage) => stage.$addFields);
    const firstSortStage = pipeline.find((stage) => stage.$sort);

    expect(limitStage).toBeDefined();
    expect(pipeline.indexOf(limitStage)).toBeLessThan(pipeline.indexOf(addFieldsStage));
    expect(firstSortStage.$sort).toEqual({ totalXP: -1, _id: 1 });
  });

  it("ranks three users tied on totalXP in descending solvedCount order", async () => {
    User.countDocuments.mockResolvedValue(3);
    User.aggregate.mockResolvedValue([
      { username: "five-solves", totalXP: 100, solvedCount: 5 },
      { username: "two-solves", totalXP: 100, solvedCount: 2 },
      { username: "one-solve", totalXP: 100, solvedCount: 1 },
    ]);

    await getHandler("/global")(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.users.map((u) => u.username)).toEqual([
      "five-solves",
      "two-solves",
      "one-solve",
    ]);
    expect(payload.users.map((u) => u.solvedCount)).toEqual([5, 2, 1]);
  });

  it("reports the real public-user count separately from the bounded ranking window", async () => {
    User.countDocuments.mockResolvedValue(700);
    User.aggregate.mockResolvedValue([
      { username: "top", totalXP: 100, solvedCount: 5 },
    ]);

    await getHandler("/global")(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.total).toBe(700);
    expect(payload.capped).toBe(true);
  });
});

describe("leaderboard.js — college ranking", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    User.countDocuments.mockResolvedValue(0);
    res = mockRes();
    req = {
      query: {},
      log: mockLog(),
      userDoc: {
        education: { emailVerified: true, collegeStatus: "verified", collegeEmail: "student@example.edu" },
      },
    };
  });

  it("uses the persisted domain instead of a regex against the full email", async () => {
    User.countDocuments.mockResolvedValue(2);
    User.aggregate.mockResolvedValue([]);

    await getHandler("/college")(req, res);

    const pipeline = User.aggregate.mock.calls[0][0];
    const matchStage = pipeline.find((stage) => stage.$match);
    expect(matchStage.$match).toEqual({ emailDomain: "example.edu", isProfilePublic: true });
  });

  it("ranks users tied on totalXP within one college domain by descending solvedCount", async () => {
    User.countDocuments.mockResolvedValue(2);
    User.aggregate.mockResolvedValue([
      { username: "top", totalXP: 50, solvedCount: 3 },
      { username: "bottom", totalXP: 50, solvedCount: 1 },
    ]);

    await getHandler("/college")(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.users.map((u) => u.username)).toEqual(["top", "bottom"]);
  });

  it("403s with COLLEGE_NOT_VERIFIED when the email itself was never verified", async () => {
    req.userDoc.education = { emailVerified: false, collegeStatus: "unset" };

    await getHandler("/college")(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "COLLEGE_NOT_VERIFIED" }));
    expect(User.aggregate).not.toHaveBeenCalled();
    expect(User.countDocuments).not.toHaveBeenCalled();
  });

  it("403s with COLLEGE_PENDING_REVIEW when the institution is still pending", async () => {
    req.userDoc.education = { emailVerified: true, collegeStatus: "pending", collegeEmail: "s@unknown-college.ac.in" };

    await getHandler("/college")(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "COLLEGE_PENDING_REVIEW" }));
    expect(User.aggregate).not.toHaveBeenCalled();
  });

  it("403s when the institution was rejected", async () => {
    req.userDoc.education = { emailVerified: true, collegeStatus: "rejected" };

    await getHandler("/college")(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(User.aggregate).not.toHaveBeenCalled();
  });

  it("allows access when both emailVerified and collegeStatus are verified", async () => {
    User.countDocuments.mockResolvedValue(0);
    User.aggregate.mockResolvedValue([]);

    await getHandler("/college")(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(User.aggregate).toHaveBeenCalled();
    expect(User.countDocuments).toHaveBeenCalled();
  });
});

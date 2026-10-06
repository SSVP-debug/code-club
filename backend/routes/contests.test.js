import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/Contest.js", () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock("../models/ContestParticipant.js", () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
  },
}));
vi.mock("../models/Problem.js", () => ({
  default: { countDocuments: vi.fn() },
}));
vi.mock("../models/Submission.js", () => ({
  default: { exists: vi.fn() },
}));
vi.mock("../utils/cache.js", () => ({
  getOrSetCache: vi.fn(async (key, ttl, fetchFn) => ({
    value: await fetchFn(),
    cacheStatus: "MISS",
  })),
}));
vi.mock("../services/contestScoring.js", () => ({
  awardContestSolve: vi.fn(),
}));

import Contest from "../models/Contest.js";
import ContestParticipant from "../models/ContestParticipant.js";
import Problem from "../models/Problem.js";
import Submission from "../models/Submission.js";
import { awardContestSolve } from "../services/contestScoring.js";
import contestsRouter from "./contests.js";

function getHandler(method, path) {
  const layer = contestsRouter.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`No ${method.toUpperCase()} route registered for ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  return res;
}

function userDoc(overrides = {}) {
  return {
    _id: "user1",
    username: "alice",
    displayName: "Alice",
    role: "student",
    education: { emailVerified: true },
    tpoProfile: {},
    ...overrides,
  };
}

function queryResult(value) {
  return {
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: vi.fn().mockResolvedValue(value),
    then(resolve) { return Promise.resolve(value).then(resolve); },
  };
}

function makeContestDoc(overrides = {}) {
  const now = Date.now();
  const doc = {
    _id: "contest1",
    title: "Test Contest",
    type: "private",
    inviteCode: "ABC123",
    createdBy: "organizer1",
    startsAt: new Date(now - 60_000),
    endsAt: new Date(now + 60_000),
    problemSlugs: ["two-sum"],
    maxParticipants: null,
    allowLateJoin: true,
    ...overrides,
  };
  doc.toObject = vi.fn().mockReturnValue({ ...doc });
  return doc;
}

function participantQuery(value) {
  return {
    sort(spec) {
      value.sort((a, b) => {
        for (const [field, direction] of Object.entries(spec)) {
          let left = a[field];
          let right = b[field];
          if (left instanceof Date) left = left.getTime();
          if (right instanceof Date) right = right.getTime();
          const leftValue = left?.toString?.() ?? left;
          const rightValue = right?.toString?.() ?? right;
          if (leftValue === rightValue) continue;
          return (leftValue < rightValue ? -1 : 1) * direction;
        }
        return 0;
      });
      return this;
    },
    limit() { return this; },
    lean: vi.fn().mockResolvedValue(value),
  };
}

describe("POST /api/contests/private", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a private contest for a verified student within guardrails", async () => {
    Problem.countDocuments.mockResolvedValue(1);
    Contest.findOne.mockReturnValue(queryResult(null));
    Contest.create.mockResolvedValue(makeContestDoc());

    const req = {
      body: {
        title: "My Contest",
        problemSlugs: ["two-sum"],
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        endsAt: new Date(Date.now() + 7_200_000).toISOString(),
      },
      userDoc: userDoc(),
    };
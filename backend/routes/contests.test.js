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
    const res = mockRes();

    await getHandler("post", "/private")(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Contest.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "private", problemSlugs: ["two-sum"] })
    );
  });

  it("rejects an unverified student's attempt to host", async () => {
    const req = {
      body: {
        title: "My Contest",
        problemSlugs: ["two-sum"],
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        endsAt: new Date(Date.now() + 7_200_000).toISOString(),
      },
      userDoc: userDoc({ education: { emailVerified: false } }),
    };
    const res = mockRes();

    await getHandler("post", "/private")(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Contest.create).not.toHaveBeenCalled();
  });

  it("rejects more than 8 problems for a student-hosted contest", async () => {
    const req = {
      body: {
        title: "My Contest",
        problemSlugs: Array.from({ length: 9 }, (_, i) => `p${i}`),
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        endsAt: new Date(Date.now() + 7_200_000).toISOString(),
      },
      userDoc: userDoc(),
    };
    const res = mockRes();

    await getHandler("post", "/private")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Contest.create).not.toHaveBeenCalled();
  });

  it("prevents a student from hosting two active/upcoming contests", async () => {
    Contest.findOne.mockReturnValue(queryResult(makeContestDoc()));

    const req = {
      body: {
        title: "Second Contest",
        problemSlugs: ["two-sum"],
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        endsAt: new Date(Date.now() + 7_200_000).toISOString(),
      },
      userDoc: userDoc(),
    };
    const res = mockRes();

    await getHandler("post", "/private")(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Contest.create).not.toHaveBeenCalled();
  });

  it("retries once on an invite-code duplicate key", async () => {
    Problem.countDocuments.mockResolvedValue(1);
    Contest.findOne.mockReturnValue(queryResult(null));
    Contest.create
      .mockRejectedValueOnce(Object.assign(new Error("duplicate"), {
        code: 11000,
        keyPattern: { inviteCode: 1 },
      }))
      .mockResolvedValueOnce(makeContestDoc());

    const req = {
      body: {
        title: "My Contest",
        problemSlugs: ["two-sum"],
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        endsAt: new Date(Date.now() + 7_200_000).toISOString(),
      },
      userDoc: userDoc(),
    };
    const res = mockRes();

    await getHandler("post", "/private")(req, res);

    expect(Contest.create).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("POST /api/contests/join-private", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ContestParticipant.findOne.mockReturnValue(participantQuery(null));
    ContestParticipant.countDocuments.mockResolvedValue(0);
  });

  it("joins a participant through the scalable collection", async () => {
    const contest = makeContestDoc();
    Contest.findOne.mockResolvedValue(contest);
    ContestParticipant.create.mockResolvedValue({ _id: "participation1" });
    const res = mockRes();

    await getHandler("post", "/join-private")(
      { body: { inviteCode: "abc123" }, userDoc: userDoc() },
      res
    );

    expect(Contest.findOne).toHaveBeenCalledWith({
      inviteCode: "ABC123",
      type: "private",
    });
    expect(ContestParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contestId: "contest1",
        userId: "user1",
        username: "alice",
        displayName: "Alice",
        solvedSlugs: [],
        score: 0,
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, contestId: "contest1" })
    );
  });

  it("returns alreadyJoined without creating a duplicate row", async () => {
    Contest.findOne.mockResolvedValue(makeContestDoc());
    ContestParticipant.findOne.mockReturnValue(
      participantQuery({ _id: "existing", contestId: "contest1", userId: "user1" })
    );
    const res = mockRes();

    await getHandler("post", "/join-private")(
      { body: { inviteCode: "ABC123" }, userDoc: userDoc() },
      res
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ alreadyJoined: true, contestId: "contest1" })
    );
    expect(ContestParticipant.create).not.toHaveBeenCalled();
  });

  it("rejects a contest at its participant cap", async () => {
    Contest.findOne.mockResolvedValue(makeContestDoc({ maxParticipants: 2 }));
    ContestParticipant.countDocuments.mockResolvedValue(2);
    const res = mockRes();

    await getHandler("post", "/join-private")(
      { body: { inviteCode: "ABC123" }, userDoc: userDoc() },
      res
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(ContestParticipant.create).not.toHaveBeenCalled();
  });

  it("rejects a late join when late joins are disabled", async () => {
    Contest.findOne.mockResolvedValue(makeContestDoc({ allowLateJoin: false }));
    const res = mockRes();

    await getHandler("post", "/join-private")(
      { body: { inviteCode: "ABC123" }, userDoc: userDoc() },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(ContestParticipant.create).not.toHaveBeenCalled();
  });

  it("rejects an ended contest", async () => {
    const now = Date.now();
    Contest.findOne.mockResolvedValue(makeContestDoc({
      startsAt: new Date(now - 120_000),
      endsAt: new Date(now - 60_000),
    }));
    const res = mockRes();

    await getHandler("post", "/join-private")(
      { body: { inviteCode: "ABC123" }, userDoc: userDoc() },
      res
    );

    expect(res.status).toHaveBeenCalledWith(410);
  });
});

describe("GET /api/contests/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ContestParticipant.find.mockReturnValue(participantQuery([]));
    ContestParticipant.countDocuments.mockResolvedValue(0);
    ContestParticipant.findOne.mockReturnValue(participantQuery(null));
  });

  function mockDetail(contest) {
    Contest.findById.mockReturnValue(queryResult(contest));
  }

  it("hides upcoming problem slugs from non-organizers but keeps problemCount", async () => {
    const now = Date.now();
    mockDetail(makeContestDoc({
      startsAt: new Date(now + 60_000),
      endsAt: new Date(now + 120_000),
    }));
    const res = mockRes();

    await getHandler("get", "/:id")(
      { params: { id: "contest1" }, userDoc: userDoc() },
      res
    );

    const payload = res.json.mock.calls[0][0];
    expect(payload.problemSlugs).toBeUndefined();
    expect(payload.problemCount).toBe(1);
  });

  it("reveals upcoming problem slugs to the organizer", async () => {
    const now = Date.now();
    mockDetail(makeContestDoc({
      startsAt: new Date(now + 60_000),
      endsAt: new Date(now + 120_000),
    }));
    const res = mockRes();

    await getHandler("get", "/:id")(
      { params: { id: "contest1" }, userDoc: userDoc({ _id: "organizer1" }) },
      res
    );

    expect(res.json.mock.calls[0][0].problemSlugs).toEqual(["two-sum"]);
  });

  it("reveals problem slugs once the contest is active", async () => {
    mockDetail(makeContestDoc());
    const res = mockRes();

    await getHandler("get", "/:id")(
      { params: { id: "contest1" }, userDoc: userDoc({ _id: "random" }) },
      res
    );

    expect(res.json.mock.calls[0][0].problemSlugs).toEqual(["two-sum"]);
  });

  it("ranks the top leaderboard deterministically", async () => {
    const t0 = new Date("2026-01-01T10:00:00Z");
    const t1 = new Date("2026-01-01T10:05:00Z");
    const participants = [
      { _id: "p-low", userId: { toString: () => "low" }, score: 50, joinedAt: t0, solvedSlugs: [] },
      { _id: "p-high", userId: { toString: () => "high" }, score: 200, joinedAt: t1, solvedSlugs: [] },
      { _id: "p-early", userId: { toString: () => "tied-early" }, score: 100, joinedAt: t0, solvedSlugs: [] },
      { _id: "p-late", userId: { toString: () => "tied-late" }, score: 100, joinedAt: t1, solvedSlugs: [] },
    ];
    mockDetail(makeContestDoc());
    ContestParticipant.find.mockReturnValue(participantQuery(participants));
    ContestParticipant.countDocuments.mockResolvedValue(4);
    const res = mockRes();

    await getHandler("get", "/:id")(
      { params: { id: "contest1" }, userDoc: userDoc({ _id: "nobody" }) },
      res
    );

    const order = res.json.mock.calls[0][0].leaderboard.map((p) => p.userId.toString());
    expect(order).toEqual(["high", "tied-early", "tied-late", "low"]);
  });

  it("returns 404 when the contest does not exist", async () => {
    mockDetail(null);
    const res = mockRes();

    await getHandler("get", "/:id")(
      { params: { id: "nope" }, userDoc: userDoc() },
      res
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("POST /api/contests/:id/solve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a bare client claim without an Accepted submission", async () => {
    Submission.exists.mockResolvedValue(null);
    const res = mockRes();

    await getHandler("post", "/:id/solve")(
      { params: { id: "contest1" }, body: { slug: "two-sum" }, userDoc: userDoc() },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(awardContestSolve).not.toHaveBeenCalled();
  });

  it("awards credit only when the exact user/problem/contest proof exists", async () => {
    Submission.exists.mockResolvedValue({ _id: "sub1" });
    awardContestSolve.mockResolvedValue({ ok: true, alreadySolved: false, score: 100 });
    const res = mockRes();

    await getHandler("post", "/:id/solve")(
      { params: { id: "contest1" }, body: { slug: "two-sum" }, userDoc: userDoc() },
      res
    );

    expect(Submission.exists).toHaveBeenCalledWith({
      userId: "user1",
      problemSlug: "two-sum",
      contestId: "contest1",
      status: "Accepted",
    });
    expect(awardContestSolve).toHaveBeenCalledWith({
      contestId: "contest1",
      userId: "user1",
      slug: "two-sum",
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, score: 100 })
    );
  });
});

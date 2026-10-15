import { describe, expect, it, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";

// ── P0 workflow: Accepted Submission → Contest ────────────────────────────
//
// Two tiers here, both against real Mongo:
//   1. The actual wiring, through submitHandler itself (mocked Judge0) —
//      proves a real Accepted verdict is what triggers contest credit, not
//      a bare contestId + client claim.
//   2. awardContestSolve's own rule matrix (not participant / not active /
//      wrong problem / duplicate-solve atomicity), exercised directly
//      against real Contest documents — these are genuine MongoDB query/
//      update semantics against the ContestParticipant source of truth.

const callJudge0 = vi.fn();

vi.mock("../controllers/compilerController.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, callJudge0 };
});

const { submitHandler } = await import("../controllers/judgeController.js");
const { awardContestSolve, CONTEST_SOLVE_REJECTION } = await import("./contestScoring.js");
const { default: Contest } = await import("../models/Contest.js");
const { default: ContestParticipant } = await import("../models/ContestParticipant.js");
const { default: User } = await import("../models/User.js");
const { seedProblem } = await import("../test/fixtures/problem.js");

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

async function seedUser(overrides = {}) {
  return User.create({
    firebaseUid: `fb-${Math.random().toString(36).slice(2)}`,
    email: "contestant@test.com",
    ...overrides,
  });
}

async function seedContest({ status = "active", participants = [], problemSlugs = ["two-sum"], creator }) {
  const now = Date.now();
  const timing =
    status === "active"
      ? { startsAt: new Date(now - 60_000), endsAt: new Date(now + 60_000) }
      : status === "ended"
        ? { startsAt: new Date(now - 120_000), endsAt: new Date(now - 60_000) }
        : { startsAt: new Date(now + 60_000), endsAt: new Date(now + 120_000) };

  const contest = await Contest.create({
    title: "Test Contest",
    createdBy: creator._id,
    problemSlugs,
    ...timing,
  });

  if (participants.length) {
    await ContestParticipant.insertMany(
      participants.map((participant) => ({
        contestId: contest._id,
        ...participant,
      }))
    );
  }

  return contest;
}

async function findParticipant(contestId, userId) {
  return ContestParticipant.findOne({ contestId, userId }).lean();
}

describe("Accepted Submission → Contest: submitHandler wiring (real Mongo, mocked Judge0)", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("awards real contest score only when Judge0 actually returns Accepted for a joined participant", async () => {
    const organizer = await seedUser({ email: "organizer@test.com" });
    const user = await seedUser();
    await seedProblem();
    const contest = await seedContest({
      creator: organizer,
      participants: [{ userId: user._id, username: "solver", solvedSlugs: [], score: 0 }],
    });

    callJudge0.mockResolvedValue({ stdout: JSON.stringify([]), stderr: "", compile_output: "" });

    const req = {
      userDoc: user,
      log: mockLog(),
      body: {
        problemSlug: "two-sum",
        code: "def twoSum(): return []",
        language: "python",
        visibletestcases: [],
        contestId: contest._id.toString(),
      },
    };
    const res = mockRes();

    await submitHandler(req, res);

    const participant = await findParticipant(contest._id, user._id);
    expect(participant.score).toBe(100);
    expect(participant.solvedSlugs).toContain("two-sum");
  });

  it("does not award contest score when Judge0 returns a wrong answer, even with a valid contestId", async () => {
    const organizer = await seedUser({ email: "organizer2@test.com" });
    const user = await seedUser({ email: "loser@test.com" });
    await seedProblem();
    const contest = await seedContest({
      creator: organizer,
      participants: [{ userId: user._id, username: "solver", solvedSlugs: [], score: 0 }],
    });

    callJudge0.mockResolvedValue({ stdout: JSON.stringify(["nope"]), stderr: "", compile_output: "" });

    const req = {
      userDoc: user,
      log: mockLog(),
      body: {
        problemSlug: "two-sum",
        code: "def twoSum(): return ['nope']",
        language: "python",
        visibletestcases: [],
        contestId: contest._id.toString(),
      },
    };
    const res = mockRes();

    await submitHandler(req, res);

    const participant = await findParticipant(contest._id, user._id);
    expect(participant.score).toBe(0);
    expect(participant.solvedSlugs).toEqual([]);
  });
});

describe("awardContestSolve — rule matrix (real Mongo ContestParticipant documents)", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("awards score exactly once for a real Accepted solve by a joined participant", async () => {
    const organizer = await seedUser({ email: "o1@test.com" });
    const user = await seedUser({ email: "p1@test.com" });
    const contest = await seedContest({
      creator: organizer,
      participants: [{ userId: user._id, solvedSlugs: [], score: 0 }],
    });

    const result = await awardContestSolve({ contestId: contest._id, userId: user._id, slug: "two-sum" });

    expect(result.ok).toBe(true);
    expect(result.alreadySolved).toBe(false);
    expect(result.score).toBe(100);
  });

  it("is idempotent: a duplicate solve of the same slug does not double-award score", async () => {
    const organizer = await seedUser({ email: "o2@test.com" });
    const user = await seedUser({ email: "p2@test.com" });
    const contest = await seedContest({
      creator: organizer,
      participants: [{ userId: user._id, solvedSlugs: [], score: 0 }],
    });

    const first = await awardContestSolve({ contestId: contest._id, userId: user._id, slug: "two-sum" });
    const second = await awardContestSolve({ contestId: contest._id, userId: user._id, slug: "two-sum" });

    expect(first.score).toBe(100);
    expect(second.ok).toBe(true);
    expect(second.alreadySolved).toBe(true);
    expect(second.score).toBe(100);

    const participant = await findParticipant(contest._id, user._id);
    expect(participant.score).toBe(100);
    expect(participant.solvedSlugs).toEqual(["two-sum"]);
  });

  it("rejects a solve from a user who never joined the contest", async () => {
    const organizer = await seedUser({ email: "o3@test.com" });
    const nonParticipant = await seedUser({ email: "outsider@test.com" });
    const contest = await seedContest({ creator: organizer, participants: [] });

    const result = await awardContestSolve({ contestId: contest._id, userId: nonParticipant._id, slug: "two-sum" });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CONTEST_SOLVE_REJECTION.NOT_JOINED);

    const participant = await findParticipant(contest._id, nonParticipant._id);
    expect(participant).toBeNull();
  });

  it("rejects a solve against a contest that has already ended", async () => {
    const organizer = await seedUser({ email: "o4@test.com" });
    const user = await seedUser({ email: "p4@test.com" });
    const contest = await seedContest({
      creator: organizer,
      status: "ended",
      participants: [{ userId: user._id, solvedSlugs: [], score: 0 }],
    });

    const result = await awardContestSolve({ contestId: contest._id, userId: user._id, slug: "two-sum" });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CONTEST_SOLVE_REJECTION.NOT_ACTIVE);
  });

  it("rejects a solve for a problem slug that isn't part of the contest", async () => {
    const organizer = await seedUser({ email: "o5@test.com" });
    const user = await seedUser({ email: "p5@test.com" });
    const contest = await seedContest({
      creator: organizer,
      problemSlugs: ["some-other-problem"],
      participants: [{ userId: user._id, solvedSlugs: [], score: 0 }],
    });

    const result = await awardContestSolve({ contestId: contest._id, userId: user._id, slug: "two-sum" });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CONTEST_SOLVE_REJECTION.NOT_IN_CONTEST);
  });

  it("two concurrent award attempts for the same slug result in exactly one credit, not two", async () => {
    const organizer = await seedUser({ email: "o6@test.com" });
    const user = await seedUser({ email: "p6@test.com" });
    const contest = await seedContest({
      creator: organizer,
      participants: [{ userId: user._id, solvedSlugs: [], score: 0 }],
    });

    const [a, b] = await Promise.all([
      awardContestSolve({ contestId: contest._id, userId: user._id, slug: "two-sum" }),
      awardContestSolve({ contestId: contest._id, userId: user._id, slug: "two-sum" }),
    ]);

    // Exactly one of the two calls performed the real award; the other
    // observes it as already-solved. Both are "ok", but only one score
    // increment must have actually landed.
    expect([a.alreadySolved, b.alreadySolved].filter((v) => v === false).length).toBe(1);

    const participant = await findParticipant(contest._id, user._id);
    expect(participant.score).toBe(100);
    expect(participant.solvedSlugs).toEqual(["two-sum"]);
  });
});

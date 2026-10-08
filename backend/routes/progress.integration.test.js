import { describe, expect, it, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";

// ── P0 workflow: Accepted Submission → Progress ───────────────────────────
//
// Runs the REAL PUT /api/progress middleware chain — validateSlugs,
// verifyAgainstSubmissions, putProgress — against real Mongo Problem/
// Submission/User documents, chained by hand exactly the way
// routes/progress.js wires them (see its router.put(...) call). This is
// the piece a mocked unit test structurally cannot prove: that
// verifyAgainstSubmissions' `Submission.find(...).distinct(...)` query
// actually only matches THIS user's own Accepted submissions, and that a
// bare client claim with no matching Submission is silently dropped
// rather than saved.

vi.mock("./leaderboard.js", () => ({ invalidateLeaderboardCaches: vi.fn().mockResolvedValue() }));
vi.mock("../controllers/publicProfileController.js", () => ({ invalidateProfileCache: vi.fn().mockResolvedValue() }));
vi.mock("../controllers/tpoController.js", () => ({ invalidateTpoCache: vi.fn().mockResolvedValue() }));

const { validateSlugs, verifyAgainstSubmissions } = await import("./progress.js");
const { putProgress } = await import("../controllers/progressController.js");
const { default: Submission } = await import("../models/Submission.js");
const { default: User } = await import("../models/User.js");
const { default: UserProblemProgress } = await import("../models/UserProblemProgress.js");
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

// Runs the real chain the router wires: validateSlugs → verifyAgainstSubmissions
// → putProgress. Zod's validateBody itself is intentionally skipped here
// (it's pure request-shape coercion, already covered by mocked unit tests)
// so this file stays focused on the Mongo-backed authorization logic.
async function runProgressChain(req, res) {
  let shortCircuited = false;
  const next = () => {};
  const resWithGuard = new Proxy(res, {
    get(target, prop) {
      if (prop === "status" || prop === "json") shortCircuited = true;
      return target[prop];
    },
  });

  await validateSlugs(req, resWithGuard, next);
  if (shortCircuited) return;
  shortCircuited = false;

  await verifyAgainstSubmissions(req, resWithGuard, next);
  if (shortCircuited) return;

  await putProgress(req, res);
}

async function seedUser(overrides = {}) {
  return User.create({
    firebaseUid: `fb-${Math.random().toString(36).slice(2)}`,
    email: "solver@test.com",
    ...overrides,
  });
}

function req(userDoc, body) {
  return { userDoc, body, log: mockLog() };
}

describe("Accepted Submission → Progress workflow (real Mongo)", () => {
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

  it("credits solvedSlugs + XP for a slug that has a real Accepted Submission for this user", async () => {
    const problem = await seedProblem();
    const user = await seedUser();
    await Submission.create({ userId: user._id, problemSlug: "two-sum", language: "python", status: "Accepted" });

    const res = mockRes();
    await runProgressChain(req(user, { solvedSlugs: ["two-sum"] }), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ solvedCount: 1, totalXP: 10 })
    );

    const reloaded = await User.findById(user._id).lean();
    expect(reloaded.solvedCount).toBe(1);
    expect(reloaded.totalXP).toBe(10);
  });

  it("does NOT credit a slug whose only Submission is Wrong Answer", async () => {
    await seedProblem();
    const user = await seedUser();
    await Submission.create({ userId: user._id, problemSlug: "two-sum", language: "python", status: "Wrong Answer" });

    const res = mockRes();
    await runProgressChain(req(user, { solvedSlugs: ["two-sum"] }), res);

    const reloaded = await User.findById(user._id).lean();
    expect(reloaded.solvedCount).toBe(0);
    expect(reloaded.totalXP).toBe(0);
  });

  it("is idempotent: re-submitting an already-solved slug does not double-credit XP", async () => {
    const problem = await seedProblem();
    const user = await seedUser({ solvedSlugs: ["two-sum"], totalXP: 10 });
    await UserProblemProgress.create({
      userId: user._id,
      problemSlug: "two-sum",
      status: "solved",
      solvedAt: new Date(),
      solvedDay: "2026-10-07",
    });
    await Submission.create({ userId: user._id, problemSlug: "two-sum", language: "python", status: "Accepted" });

    const res = mockRes();
    await runProgressChain(req(user, { solvedSlugs: ["two-sum"] }), res);

    const reloaded = await User.findById(user._id).lean();
    expect(reloaded.solvedSlugs).toEqual(["two-sum"]);
    expect(reloaded.totalXP).toBe(10);
  });

  it("does NOT credit a slug that only has an Accepted Submission belonging to a DIFFERENT user", async () => {
    await seedProblem();
    const attacker = await seedUser({ email: "attacker@test.com" });
    const victim = await seedUser({ email: "victim@test.com" });
    // The Accepted submission is the VICTIM's, not the attacker's.
    await Submission.create({ userId: victim._id, problemSlug: "two-sum", language: "python", status: "Accepted" });

    const res = mockRes();
    await runProgressChain(req(attacker, { solvedSlugs: ["two-sum"] }), res);

    const reloadedAttacker = await User.findById(attacker._id).lean();
    expect(reloadedAttacker.solvedCount).toBe(0);
    expect(reloadedAttacker.totalXP).toBe(0);
  });

  it("rejects a forged progress claim with no matching Submission at all for a real problem slug", async () => {
    await seedProblem();
    const user = await seedUser();
    // No Submission created — pure client claim, exactly the incident this
    // middleware exists to prevent.

    const res = mockRes();
    await runProgressChain(req(user, { solvedSlugs: ["two-sum"] }), res);

    const reloaded = await User.findById(user._id).lean();
    expect(reloaded.solvedSlugs).toEqual([]);
    expect(reloaded.totalXP).toBe(0);
  });
});
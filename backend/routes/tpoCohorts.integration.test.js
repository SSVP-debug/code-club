import { describe, expect, it, vi, beforeAll, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";

// Same B2B_ENABLED module-load-time requirement as tpoFlow.integration.test.js.
process.env.B2B_ENABLED = "true";

const { default: tpoRouter } = await import("./tpo.js");
const { default: User } = await import("../models/User.js");
const { default: College } = await import("../models/College.js");
const { default: Cohort } = await import("../models/Cohort.js");
const { claimPrimaryIfNone } = await import("../services/tpoTeamService.js");

function mockRes() {
  const res = {};
  res._status = 200;
  res._json = null;
  res.status = vi.fn((c) => { res._status = c; return res; });
  res.json = vi.fn((b) => { res._json = b; return res; });
  return res;
}
function mockLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** Walks the REAL middleware chain (requireRole → requireVerified →
 * resolveTpoInstitution → handler) for a given method+path, same
 * dispatch approach as routes/tpoTeam.test.js's runRoute but exercising
 * genuine middleware against a real Mongo-backed req.userDoc, not
 * mocks. */
async function runRoute(method, path, req) {
  const res = mockRes();
  const layer = tpoRouter.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`No ${method.toUpperCase()} ${path} route found on tpoRouter`);
  for (const routeLayer of layer.route.stack) {
    let calledNext = false;
    let nextErr;
    await routeLayer.handle(req, res, (err) => { calledNext = true; nextErr = err; });
    if (nextErr) throw nextErr;
    if (!calledNext) break;
  }
  return res;
}

// ── TPO-2 Step 4: cohort routes cross-college isolation (real Mongo) ───────
describe("Cohort routes — cross-college isolation (real Mongo)", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  async function seedVerifiedTpo(email, college) {
    const tpo = await User.create({
      firebaseUid: `fb-${Math.random().toString(36).slice(2)}`,
      email,
      role: "tpo",
      roles: ["student", "tpo"],
      tpoProfile: {
        collegeDomain: college.domains[0],
        collegeName: college.name,
        verified: true,
        requestedAt: new Date(),
        verifiedAt: new Date(),
      },
    });
    await claimPrimaryIfNone(college._id, tpo._id);
    return tpo;
  }

  async function seedTwoInstitutions() {
    const collegeA = await College.create({ domains: ["a.edu"], name: "College A", status: "verified" });
    const collegeB = await College.create({ domains: ["b.edu"], name: "College B", status: "verified" });
    const tpoA = await seedVerifiedTpo("tpo@a.edu", collegeA);
    const tpoB = await seedVerifiedTpo("tpo@b.edu", collegeB);
    const cohortB = await Cohort.create({
      collegeId: collegeB._id, name: "College B Cohort", academicYear: "2024-2025",
      graduatingYear: 2027, branch: "CSE", createdBy: tpoB._id,
    });
    return { collegeA, collegeB, tpoA, tpoB, cohortB };
  }

  it("read isolation: TPO A cannot retrieve College B's cohort", async () => {
    const { tpoA, cohortB } = await seedTwoInstitutions();

    const res = await runRoute("get", "/cohorts/:cohortId", {
      userDoc: tpoA, params: { cohortId: cohortB._id.toString() }, query: {}, log: mockLog(),
    });

    expect(res._status).toBe(404);
  });

  it("update isolation: TPO A cannot modify College B's cohort", async () => {
    const { tpoA, cohortB } = await seedTwoInstitutions();

    const res = await runRoute("patch", "/cohorts/:cohortId", {
      userDoc: tpoA, params: { cohortId: cohortB._id.toString() }, body: { name: "Hijacked" }, query: {}, log: mockLog(),
    });

    expect(res._status).toBe(404);
    const reloaded = await Cohort.findById(cohortB._id);
    expect(reloaded.name).toBe("College B Cohort"); // untouched
  });

  it("archive isolation: TPO A cannot archive College B's cohort", async () => {
    const { tpoA, cohortB } = await seedTwoInstitutions();

    const res = await runRoute("post", "/cohorts/:cohortId/archive", {
      userDoc: tpoA, params: { cohortId: cohortB._id.toString() }, body: {}, query: {}, log: mockLog(),
    });

    expect(res._status).toBe(404);
    const reloaded = await Cohort.findById(cohortB._id);
    expect(reloaded.status).toBe("active"); // untouched
  });

  it("create isolation: TPO A cannot create a cohort under College B by supplying collegeId in the body", async () => {
    const { collegeA, tpoA, collegeB } = await seedTwoInstitutions();

    const res = await runRoute("post", "/cohorts", {
      userDoc: tpoA,
      body: {
        name: "Smuggled Cohort", academicYear: "2024-2025", graduatingYear: 2027, branch: "CSE",
        collegeId: collegeB._id.toString(), // attempted bypass
      },
      query: {}, log: mockLog(),
    });

    expect(res._status).toBe(201);
    const created = await Cohort.findOne({ name: "Smuggled Cohort" });
    expect(created.collegeId.toString()).toBe(collegeA._id.toString()); // NOT collegeB
    expect(created.collegeId.toString()).not.toBe(collegeB._id.toString());
  });

  it("list isolation: TPO A's cohort list contains no College B cohorts", async () => {
    const { collegeA, tpoA, tpoB } = await seedTwoInstitutions();
    await Cohort.create({
      collegeId: collegeA._id, name: "College A Cohort", academicYear: "2024-2025",
      graduatingYear: 2027, branch: "CSE", createdBy: tpoA._id,
    });

    const res = await runRoute("get", "/cohorts", { userDoc: tpoA, query: {}, log: mockLog() });

    expect(res._status).toBe(200);
    const names = res._json.items.map((c) => c.name);
    expect(names).toContain("College A Cohort");
    expect(names).not.toContain("College B Cohort");
    // Sanity: tpoB is a real, distinct account in this dataset — not
    // just an unused fixture, so the isolation is meaningfully proven
    // against a genuine second institution's data.
    expect(tpoB.tpoProfile.collegeDomain).toBe("b.edu");
  });

  it("admin override: an admin CAN read College B's cohort via an explicit collegeId, without weakening normal TPO isolation", async () => {
    const { collegeB, cohortB } = await seedTwoInstitutions();
    const admin = await User.create({ firebaseUid: "fb-admin-cohorts", email: "admin@codeclub.test", role: "admin" });

    const res = await runRoute("get", "/cohorts/:cohortId", {
      userDoc: admin, params: { cohortId: cohortB._id.toString() }, query: { collegeId: collegeB._id.toString() }, log: mockLog(),
    });

    expect(res._status).toBe(200);
    expect(res._json.id).toBe(cohortB._id.toString());
  });

  it("admin without a collegeId is rejected, not silently granted broad access", async () => {
    const { cohortB } = await seedTwoInstitutions();
    const admin = await User.create({ firebaseUid: "fb-admin-cohorts-2", email: "admin2@codeclub.test", role: "admin" });

    const res = await runRoute("get", "/cohorts/:cohortId", {
      userDoc: admin, params: { cohortId: cohortB._id.toString() }, query: {}, log: mockLog(),
    });

    expect(res._status).toBe(400);
  });
});
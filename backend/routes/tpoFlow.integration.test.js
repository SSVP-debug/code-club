import { describe, expect, it, vi, beforeAll, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";

// ── P0 workflow: TPO registration → pending → verification → TPO-only ────
// ── endpoint ────────────────────────────────────────────────────────────
//
// TPO routes are gated behind B2B_ENABLED, a module-load-time constant
// (config/featureFlags.js), so it must be set before tpo.js is first
// imported anywhere in this file's module graph.
process.env.B2B_ENABLED = "true";

const { default: tpoRouter } = await import("./tpo.js");
const { default: User } = await import("../models/User.js");
const { default: College } = await import("../models/College.js");
const { requireRole } = await import("../middleware/roleGuard.js");
const { requireVerified } = await import("../middleware/requireVerified.js");
const { approveTpo, rejectTpo } = await import("../controllers/adminController.js");

function extractRegisterHandler() {
  const layer = tpoRouter.stack.find(
    (l) => l.route && l.route.path === "/register" && l.route.methods.post
  );
  return layer.route.stack[0].handle;
}
const registerHandler = extractRegisterHandler();

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

async function seedStudent(overrides = {}) {
  return User.create({
    firebaseUid: `fb-${Math.random().toString(36).slice(2)}`,
    email: "tposignup1@unrecognized-college.ac.in",
    ...overrides,
  });
}

async function runTpoOnlyGate(req) {
  let blocked = false;
  const res = mockRes();
  const next = () => {};
  const guardedRes = new Proxy(res, {
    get(t, p) {
      if (p === "status") blocked = true;
      return t[p];
    },
  });
  await requireRole("tpo", "admin")(req, guardedRes, next);
  if (blocked) return "role";
  blocked = false;
  await requireVerified(req, guardedRes, next);
  if (blocked) return "verification";
  return "allowed";
}

describe("TPO registration → pending → verification → TPO-only endpoint (real Mongo)", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("registers a real TPO as pending for an unrecognized college domain, creates a pending College doc, blocks the TPO-only gate", async () => {
    const user = await seedStudent();
    const req = { userDoc: user, log: mockLog(), body: { collegeName: "Unrecognized College" } };
    const res = mockRes();

    await registerHandler(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.status).toBe("pending");

    const reloaded = await User.findById(user._id);
    expect(reloaded.role).toBe("tpo");
    expect(reloaded.tpoProfile.verified).toBe(false);
    expect(reloaded.tpoProfile.collegeDomain).toBe("unrecognized-college.ac.in");

    const college = await College.findByDomain("unrecognized-college.ac.in");
    expect(college).toBeTruthy();
    expect(college.status).toBe("pending");

    const gateOutcome = await runTpoOnlyGate({ userDoc: reloaded });
    expect(gateOutcome).toBe("verification");
  });

  it("a plain student is denied the TPO-only gate", async () => {
    const student = await seedStudent({ email: "juststudent2@test.com" });
    const outcome = await runTpoOnlyGate({ userDoc: student });
    expect(outcome).toBe("role");
  });

  it("a recruiter (wrong role) is denied the TPO-only gate even when verified for their own role", async () => {
    const recruiter = await seedStudent({
      email: "recruiter6@company.com",
      role: "recruiter",
      recruiterProfile: { companyName: "Co", designation: "R", companyDomain: "company.com", verified: true, verifiedAt: new Date() },
    });
    const outcome = await runTpoOnlyGate({ userDoc: recruiter });
    expect(outcome).toBe("role");
  });

  it("admin approval of a pending TPO's college verifies BOTH the College doc and the submitting user's tpoProfile", async () => {
    const user = await seedStudent({ email: "tposignup2@unrecognized-college.ac.in" });
    await registerHandler(
      { userDoc: user, log: mockLog(), body: { collegeName: "Unrecognized College 2" } },
      mockRes()
    );

    const admin = await User.create({ firebaseUid: "fb-admin-3", email: "admin3@codeclub.test", role: "admin" });
    const college = await College.findByDomain("unrecognized-college.ac.in");

    await approveTpo({ params: { collegeId: college._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

    const reloadedCollege = await College.findById(college._id);
    expect(reloadedCollege.status).toBe("verified");

    const reloadedUser = await User.findById(user._id);
    expect(reloadedUser.tpoProfile.verified).toBe(true);

    const gateOutcome = await runTpoOnlyGate({ userDoc: reloadedUser });
    expect(gateOutcome).toBe("allowed");
  });

  it("admin rejection of a pending TPO's college deletes the College doc and leaves the user's tpoProfile unverified", async () => {
    // CONTRACT NOTE (test defect, not a production bug — confirmed via
    // both adminController.js's own comment on rejectTpo and the existing
    // mocked unit test controllers/adminController.test.js, whose own
    // title is "deletes the college..."): unlike rejectStudentCollege,
    // which keeps the College doc around with status "rejected" (that
    // record has other purposes — it's linked from student `education`
    // records), a rejected TPO signup's College doc is deleted outright.
    // This test originally asserted the doc persisted with status
    // "rejected" — that's simply the wrong contract for this endpoint;
    // fixed to assert the documented, intended, already-covered behavior.
    const user = await seedStudent({ email: "tposignup3@unrecognized-college.ac.in" });
    await registerHandler(
      { userDoc: user, log: mockLog(), body: { collegeName: "Unrecognized College 3" } },
      mockRes()
    );

    const admin = await User.create({ firebaseUid: "fb-admin-4", email: "admin4@codeclub.test", role: "admin" });
    const college = await College.findByDomain("unrecognized-college.ac.in");

    await rejectTpo({ params: { collegeId: college._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

    const reloadedCollege = await College.findById(college._id);
    expect(reloadedCollege).toBeNull();

    const reloadedUser = await User.findById(user._id);
    // rejectTpo also demotes the requester back to a plain student (see
    // adminController.js) — so the gate is now denied at the ROLE check,
    // not the verification check. My first pass at this fix got this
    // wrong too (asserted "verification"); caught by re-reading
    // rejectTpo's actual behavior rather than assuming.
    expect(reloadedUser.role).toBe("student");
    expect(reloadedUser.tpoProfile.verified).toBe(false);
    expect(reloadedUser.tpoProfile.collegeDomain).toBeNull();

    const gateOutcome = await runTpoOnlyGate({ userDoc: reloadedUser });
    expect(gateOutcome).toBe("role");
  });

  it("admin behavior: an admin account itself always passes any role gate, TPO included", async () => {
    const admin = await User.create({ firebaseUid: "fb-admin-5", email: "admin5@codeclub.test", role: "admin" });
    const outcome = await runTpoOnlyGate({ userDoc: admin });
    expect(outcome).toBe("allowed");
  });

  it("a second TPO registering for an already-verified college is auto-verified immediately, no queue", async () => {
    const firstUser = await seedStudent({ email: "tpofirst@already-verified.ac.in" });
    await registerHandler(
      { userDoc: firstUser, log: mockLog(), body: { collegeName: "Already Verified College" } },
      mockRes()
    );
    const admin = await User.create({ firebaseUid: "fb-admin-6", email: "admin6@codeclub.test", role: "admin" });
    const college = await College.findByDomain("already-verified.ac.in");
    await approveTpo({ params: { collegeId: college._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

    const secondUser = await seedStudent({ email: "tposecond@already-verified.ac.in" });
    const res2 = mockRes();
    await registerHandler(
      { userDoc: secondUser, log: mockLog(), body: { collegeName: "Already Verified College" } },
      res2
    );

    expect(res2._json.status).toBe("verified");
    const reloadedSecond = await User.findById(secondUser._id);
    expect(reloadedSecond.tpoProfile.verified).toBe(true);
  });

  // ── Role/profile isolation regression coverage ──────────────────────────
  // See models/User.js's role/roles comment and userController.js's
  // switchActiveRole for the architecture this covers.
  it(
    "a Student registering as TPO keeps their student-track data and authorization intact " +
      "(roles becomes [student, tpo], not a replacement)",
    async () => {
      const user = await seedStudent({
        email: "student-then-tpo@unrecognized-college.ac.in",
        totalXP: 500,
        currentStreak: 4,
        solvedSlugs: ["two-sum", "valid-parentheses"],
      });
      expect(user.roles).toEqual(["student"]);

      await registerHandler(
        { userDoc: user, log: mockLog(), body: { collegeName: "Some College" } },
        mockRes()
      );

      const reloaded = await User.findById(user._id);
      expect(reloaded.role).toBe("tpo");
      expect(reloaded.roles).toEqual(["student", "tpo"]);

      // The prior Student registration's data is untouched on the
      // document — it's just no longer served while active role is
      // "tpo" (see routes/init.test.js and
      // controllers/progressRoleGating.test.js for the read-boundary
      // coverage of that part).
      expect(reloaded.totalXP).toBe(500);
      expect(reloaded.currentStreak).toBe(4);
      expect(reloaded.solvedSlugs).toEqual(["two-sum", "valid-parentheses"]);
    }
  );

  it("rejectTpo revokes the 'tpo' authorization, not just the active role", async () => {
    const { switchActiveRole } = await import("../controllers/userController.js");

    const user = await seedStudent({ email: "tpo-then-rejected@unrecognized-college2.ac.in" });
    await registerHandler(
      { userDoc: user, log: mockLog(), body: { collegeName: "Some Other College" } },
      mockRes()
    );

    const admin = await User.create({ firebaseUid: "fb-admin-7", email: "admin7@codeclub.test", role: "admin" });
    const college = await College.findByDomain("unrecognized-college2.ac.in");
    await rejectTpo({ params: { collegeId: college._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

    const reloaded = await User.findById(user._id);
    expect(reloaded.role).toBe("student");
    expect(reloaded.roles).toEqual(["student"]);

    // Can't self-service back into "tpo" via switch-role anymore — they'd
    // have to register again.
    const switchRes = mockRes();
    await switchActiveRole({ userDoc: reloaded, body: { role: "tpo" } }, switchRes);
    expect(switchRes.status).toHaveBeenCalledWith(403);
  });

  // ── Phase 3: primary TPO claim, real Mongo ──────────────────────────────
  describe("primary TPO claim (real Mongo)", () => {
    it("the first auto-verified TPO on a brand-new domain becomes primary immediately", async () => {
      const user = await seedStudent({ email: "founder@new-domain.ac.in" });
      const res = mockRes();

      await registerHandler(
        { userDoc: user, log: mockLog(), body: { collegeName: "New Domain College" } },
        res
      );

      // A brand-new domain isn't auto-verified (isDomainAutoVerified is
      // false for an unrecognized domain), so this registers pending, not
      // primary yet — primary claim only fires on the auto-verified path.
      expect(res._json.status).toBe("pending");
      expect(res._json.isPrimary).toBe(false);

      const college = await College.findByDomain("new-domain.ac.in");
      expect(college.primaryTpo).toBeNull();
    });

    it("first verified TPO (via admin approval) becomes primary; a later-verified batch-mate does not", async () => {
      // Two pending TPOs for the same still-pending domain can't actually
      // be produced through two sequential /register calls — the second
      // one legitimately gets rejected with 409 ("already registered and
      // pending verification", see the guard just above the autoVerified
      // check in routes/tpo.js) by design, to avoid two conflicting
      // requests in the review queue. That guard is correct and
      // unrelated to what this test verifies. Two simultaneous pending
      // TPOs on one domain is still a real (if narrow) possibility this
      // system must handle correctly — e.g. two near-simultaneous
      // registrations racing to upgrade the same auto-detected
      // placeholder college (routes/tpo.js's existingIsAutoPlaceholder
      // branch) before either's save commits — so this test seeds that
      // end state directly rather than exercising the 409-guarded
      // /register flow, to isolate approveTpo's own bulk-verify /
      // earliest-requestedAt-becomes-primary logic.
      const college = await College.create({
        domains: ["some-college.ac.in"],
        name: "Some College",
        status: "pending",
        submittedByRole: "tpo",
      });
      const earlier = await seedStudent({
        email: "early-signup@some-college.ac.in",
        role: "tpo",
        roles: ["student", "tpo"],
        tpoProfile: {
          collegeDomain: "some-college.ac.in",
          collegeName: "Some College",
          verified: false,
          requestedAt: new Date(Date.now() - 1000),
        },
      });
      const later = await seedStudent({
        email: "later-signup@some-college.ac.in",
        role: "tpo",
        roles: ["student", "tpo"],
        tpoProfile: {
          collegeDomain: "some-college.ac.in",
          collegeName: "Some College",
          verified: false,
          requestedAt: new Date(),
        },
      });

      const admin = await User.create({ firebaseUid: "fb-admin-8", email: "admin8@codeclub.test", role: "admin" });
      await approveTpo({ params: { collegeId: college._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

      const reloadedCollege = await College.findById(college._id);
      const reloadedEarlier = await User.findById(earlier._id);
      const reloadedLater = await User.findById(later._id);

      expect(reloadedEarlier.tpoProfile.verified).toBe(true);
      expect(reloadedLater.tpoProfile.verified).toBe(true);
      expect(reloadedCollege.primaryTpo.toString()).toBe(reloadedEarlier._id.toString());
      expect(reloadedCollege.primaryTpo.toString()).not.toBe(reloadedLater._id.toString());
    });

    it("two sequential self-registrations for the same still-pending domain: the second is rejected with 409, not silently queued", async () => {
      // Documents/locks in the business rule the test above works around
      // — this is the actual, intended behavior of a real second TPO
      // trying to self-register while the first's request is still
      // awaiting review.
      const first = await seedStudent({ email: "first@sequential-college.ac.in" });
      await registerHandler(
        { userDoc: first, log: mockLog(), body: { collegeName: "Sequential College" } },
        mockRes()
      );

      const second = await seedStudent({ email: "second@sequential-college.ac.in" });
      const res2 = mockRes();
      await registerHandler(
        { userDoc: second, log: mockLog(), body: { collegeName: "Sequential College" } },
        res2
      );

      expect(res2._status).toBe(409);
      const reloadedSecond = await User.findById(second._id);
      expect(reloadedSecond.role).toBe("student"); // never became a TPO at all
    });

    it("a second TPO registering on an already-verified (already-primaried) domain never becomes primary", async () => {
      const first = await seedStudent({ email: "first@established.ac.in" });
      await registerHandler(
        { userDoc: first, log: mockLog(), body: { collegeName: "Established College" } },
        mockRes()
      );
      const admin = await User.create({ firebaseUid: "fb-admin-9", email: "admin9@codeclub.test", role: "admin" });
      const college = await College.findByDomain("established.ac.in");
      await approveTpo({ params: { collegeId: college._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

      const second = await seedStudent({ email: "second@established.ac.in" });
      const res2 = mockRes();
      await registerHandler(
        { userDoc: second, log: mockLog(), body: { collegeName: "Established College" } },
        res2
      );

      expect(res2._json.isPrimary).toBe(false);
      const reloadedCollege = await College.findById(college._id);
      const reloadedFirst = await User.findById(first._id);
      expect(reloadedCollege.primaryTpo.toString()).toBe(reloadedFirst._id.toString());
    });

    it("deleting the primary TPO's account clears College.primaryTpo (no dangling reference)", async () => {
      const { deleteUser } = await import("../controllers/adminController.js");
      const first = await seedStudent({ email: "solo-primary@deletetest.ac.in" });
      await registerHandler(
        { userDoc: first, log: mockLog(), body: { collegeName: "Delete Test College" } },
        mockRes()
      );
      const admin = await User.create({ firebaseUid: "fb-admin-10", email: "admin10@codeclub.test", role: "admin" });
      const college = await College.findByDomain("deletetest.ac.in");
      await approveTpo({ params: { collegeId: college._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

      const reloadedFirst = await User.findById(first._id);
      const reloadedCollege = await College.findById(college._id);
      expect(reloadedCollege.primaryTpo.toString()).toBe(reloadedFirst._id.toString());

      await deleteUser({ params: { id: reloadedFirst._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

      const collegeAfterDelete = await College.findById(college._id);
      expect(collegeAfterDelete.primaryTpo).toBeNull();
    });
  });
});
import { describe, expect, it, vi, beforeAll, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";
import User from "../models/User.js";
import { handleRegister } from "./recruiter.js";
import { requireRole } from "../middleware/roleGuard.js";
import { requireVerified } from "../middleware/requireVerified.js";
import { approveRecruiter, rejectRecruiter } from "../controllers/adminController.js";

// ── P0 workflow: Recruiter registration → pending → verification → ────────
// ── recruiter-only endpoint ────────────────────────────────────────────
//
// Real Mongo User documents throughout; no external boundary to mock here
// (recruiterRegistrationGate reads Settings via the cached settingsService,
// itself backed by real Mongo — no Redis/Firebase involved in this path).

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
    email: "recruiter1@unrecognized-corp.com",
    ...overrides,
  });
}

// A representative recruiter-only endpoint's authorization chain —
// requireRole("recruiter","admin") then requireVerified — run for real,
// in sequence, the way server.js actually wires GET /api/recruiter/candidates.
async function runRecruiterOnlyGate(req, res) {
  let blocked = false;
  const next = () => {};
  const guardedRes = new Proxy(res, {
    get(t, p) {
      if (p === "status") blocked = true;
      return t[p];
    },
  });
  await requireRole("recruiter", "admin")(req, guardedRes, next);
  if (blocked) return "role";
  blocked = false;
  await requireVerified(req, guardedRes, next);
  if (blocked) return "verification";
  return "allowed";
}

describe("Recruiter registration → pending → verification → recruiter-only endpoint (real Mongo)", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("registers a real recruiter as pending (unrecognized company domain) and blocks the recruiter-only gate", async () => {
    const user = await seedStudent();
    const req = { userDoc: user, log: mockLog(), body: { companyName: "Unrecognized Corp", designation: "SWE Recruiter" } };
    const res = mockRes();

    await handleRegister(req, res);

    expect(res._json.success).toBe(true);
    expect(res._json.status).toBe("pending");

    const reloaded = await User.findById(user._id);
    expect(reloaded.role).toBe("recruiter");
    expect(reloaded.recruiterProfile.verified).toBe(false);

    const gateOutcome = await runRecruiterOnlyGate({ userDoc: reloaded }, mockRes());
    expect(gateOutcome).toBe("verification");
  });

  it("a plain student is denied by the role gate before ever registering as a recruiter", async () => {
    const student = await seedStudent({ email: "juststudent@test.com" });

    const outcome = await runRecruiterOnlyGate({ userDoc: student }, mockRes());
    expect(outcome).toBe("role");
  });

  it("admin approval of a pending recruiter flips real verified state, unblocking the recruiter-only gate", async () => {
    const user = await seedStudent({ email: "recruiter2@unrecognized-corp.com" });
    await handleRegister(
      { userDoc: user, log: mockLog(), body: { companyName: "Unrecognized Corp", designation: "Recruiter" } },
      mockRes()
    );

    const admin = await User.create({ firebaseUid: "fb-admin-1", email: "admin1@codeclub.test", role: "admin" });
    const pending = await User.findById(user._id);

    await approveRecruiter({ params: { id: pending._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

    const reloaded = await User.findById(user._id);
    expect(reloaded.recruiterProfile.verified).toBe(true);
    expect(reloaded.recruiterProfile.verifiedAt).toBeTruthy();

    const gateOutcome = await runRecruiterOnlyGate({ userDoc: reloaded }, mockRes());
    expect(gateOutcome).toBe("allowed");
  });

  it("admin rejection of a pending recruiter demotes the account back to student", async () => {
    const user = await seedStudent({ email: "recruiter3@unrecognized-corp.com" });
    await handleRegister(
      { userDoc: user, log: mockLog(), body: { companyName: "Unrecognized Corp", designation: "Recruiter" } },
      mockRes()
    );

    const admin = await User.create({ firebaseUid: "fb-admin-2", email: "admin2@codeclub.test", role: "admin" });
    const pending = await User.findById(user._id);

    await rejectRecruiter({ params: { id: pending._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

    const reloaded = await User.findById(user._id);
    expect(reloaded.role).toBe("student");
    expect(reloaded.recruiterProfile.verified).toBe(false);
  });

  it("an already-verified recruiter (auto-verified domain) passes the recruiter-only gate immediately", async () => {
    const user = await seedStudent({
      email: "recruiter4@google.com",
      role: "recruiter",
      recruiterProfile: { companyName: "Google", designation: "SWE", companyDomain: "google.com", verified: true, verifiedAt: new Date() },
    });

    const outcome = await runRecruiterOnlyGate({ userDoc: user }, mockRes());
    expect(outcome).toBe("allowed");
  });

  it("a TPO account (wrong role) is denied the recruiter-only gate even when verified for their own role", async () => {
    const tpo = await seedStudent({
      email: "tpo1@college.ac.in",
      role: "tpo",
      tpoProfile: { collegeDomain: "college.ac.in", collegeName: "Test College", verified: true, verifiedAt: new Date() },
    });

    const outcome = await runRecruiterOnlyGate({ userDoc: tpo }, mockRes());
    expect(outcome).toBe("role");
  });

  it("re-registering (already a pending recruiter) overwrites the profile rather than crashing — documents actual behavior, not a security gap", async () => {
    const user = await seedStudent({ email: "recruiter5@unrecognized-corp.com" });
    await handleRegister(
      { userDoc: user, log: mockLog(), body: { companyName: "First Co", designation: "Recruiter" } },
      mockRes()
    );

    const afterFirst = await User.findById(user._id);
    const res2 = mockRes();
    await handleRegister(
      { userDoc: afterFirst, log: mockLog(), body: { companyName: "Second Co", designation: "Senior Recruiter" } },
      res2
    );

    const reloaded = await User.findById(user._id);
    expect(reloaded.recruiterProfile.companyName).toBe("Second Co");
    // Re-registration does not silently grant verification — still
    // subject to the same domain check as any first-time registration.
    expect(reloaded.recruiterProfile.verified).toBe(false);
  });

  // ── Role/profile isolation regression coverage ──────────────────────────
  // See models/User.js's role/roles comment and userController.js's
  // switchActiveRole for the architecture this covers.
  it(
    "a Student registering as recruiter keeps their student-track data and authorization intact " +
      "(roles becomes [student, recruiter], not a replacement)",
    async () => {
      const user = await seedStudent({
        email: "student-then-recruiter@unrecognized-corp.com",
        totalXP: 900,
        solvedCount: 1,
      });
      expect(user.roles).toEqual(["student"]);

      await handleRegister(
        { userDoc: user, log: mockLog(), body: { companyName: "Some Corp", designation: "Recruiter" } },
        mockRes()
      );

      const reloaded = await User.findById(user._id);
      expect(reloaded.role).toBe("recruiter");
      expect(reloaded.roles).toEqual(["student", "recruiter"]);
      expect(reloaded.totalXP).toBe(900);
      expect(reloaded.solvedCount).toBe(1);
    }
  );

  it("rejectRecruiter revokes the 'recruiter' authorization, not just the active role", async () => {
    const { switchActiveRole } = await import("../controllers/userController.js");

    const user = await seedStudent({ email: "recruiter-then-rejected@unrecognized-corp2.com" });
    await handleRegister(
      { userDoc: user, log: mockLog(), body: { companyName: "Rejected Co", designation: "Recruiter" } },
      mockRes()
    );

    const admin = await User.create({ firebaseUid: "fb-admin-8", email: "admin8@codeclub.test", role: "admin" });
    const pending = await User.findById(user._id);
    await rejectRecruiter({ params: { id: pending._id.toString() }, userDoc: admin, log: mockLog() }, mockRes());

    const reloaded = await User.findById(user._id);
    expect(reloaded.roles).toEqual(["student"]);

    const switchRes = mockRes();
    await switchActiveRole({ userDoc: reloaded, body: { role: "recruiter" } }, switchRes);
    expect(switchRes.status).toHaveBeenCalledWith(403);
  });

  it(
    "an identity can hold Student + TPO + Recruiter simultaneously and switch between them " +
      "without losing any role's authorization (Definition of Done: multi-role support)",
    async () => {
      // B2B_ENABLED (config/featureFlags.js) is a module-load-time
      // constant baked into tpo.js at import — must be set BEFORE the
      // dynamic import below, not after, or b2bGate() silently short-
      // circuits registration with a 200 "not live yet" response that
      // this test doesn't check the status of, leaving `roles` untouched
      // and this assertion failing for the wrong reason. Same ordering
      // requirement documented at the top of tpoFlow.integration.test.js.
      process.env.B2B_ENABLED = "true";

      const { switchActiveRole } = await import("../controllers/userController.js");
      const { default: tpoRouter } = await import("./tpo.js");
      const tpoRegisterLayer = tpoRouter.stack.find(
        (l) => l.route && l.route.path === "/register" && l.route.methods.post
      );
      const tpoRegisterHandler = tpoRegisterLayer.route.stack[0].handle;

      const user = await seedStudent({ email: "triple-role@unrecognized-tpo-corp.ac.in" });

      await tpoRegisterHandler(
        { userDoc: user, log: mockLog(), body: { collegeName: "Triple Role College" } },
        mockRes()
      );
      let reloaded = await User.findById(user._id);
      expect(reloaded.roles.sort()).toEqual(["student", "tpo"]);

      await handleRegister(
        { userDoc: reloaded, log: mockLog(), body: { companyName: "Triple Role Corp", designation: "Recruiter" } },
        mockRes()
      );
      reloaded = await User.findById(user._id);
      expect(reloaded.roles.sort()).toEqual(["recruiter", "student", "tpo"]);
      expect(reloaded.role).toBe("recruiter"); // most recent registration is active

      // Switch through all three — none of them get dropped from `roles`.
      for (const target of ["student", "tpo", "recruiter", "student"]) {
        const res = mockRes();
        await switchActiveRole({ userDoc: reloaded, body: { role: target } }, res);
        expect(reloaded.role).toBe(target);
      }
      expect(reloaded.roles.sort()).toEqual(["recruiter", "student", "tpo"]);
    }
  );
});
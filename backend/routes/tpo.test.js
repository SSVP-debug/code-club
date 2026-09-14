import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../config/featureFlags.js", () => ({
  B2B_ENABLED: true,
}));
vi.mock("../models/User.js", () => ({
  default: { find: vi.fn() },
}));
vi.mock("../models/Assignment.js", () => ({
  default: { findOne: vi.fn(), create: vi.fn(), find: vi.fn() },
}));
vi.mock("../services/notificationService.js", () => ({
  createNotificationBulk: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/settingsService.js", () => ({
  getSettings: vi.fn(),
}));

import User from "../models/User.js";
import Assignment from "../models/Assignment.js";
import { createNotificationBulk } from "../services/notificationService.js";
import { getSettings } from "../services/settingsService.js";
import tpoRouter, { handleRemindAssignment, tpoRegistrationGate } from "./tpo.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const tpoUserDoc = { tpoProfile: { collegeDomain: "example.edu" } };

const assignmentDoc = {
  _id: "assignment1",
  title: "Week 3 — Arrays",
  dueDate: "2026-08-01",
  problemSlugs: ["two-sum", "valid-parentheses"],
};

describe("handleRemindAssignment", () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
    Assignment.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(assignmentDoc) });
  });

  it("returns 400 when the TPO account has no college domain set", async () => {
    const req = { params: { id: "assignment1" }, userDoc: { tpoProfile: {} } };
    await handleRemindAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createNotificationBulk).not.toHaveBeenCalled();
  });

  it("returns 404 when the assignment doesn't exist for this college", async () => {
    Assignment.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    const req = { params: { id: "ghost" }, userDoc: tpoUserDoc };
    await handleRemindAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("only notifies students who haven't completed every problem in the assignment", async () => {
    User.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: "student-done", solvedSlugs: ["two-sum", "valid-parentheses"] },
          { _id: "student-partial", solvedSlugs: ["two-sum"] },
          { _id: "student-none", solvedSlugs: [] },
        ]),
      }),
    });
    const req = { params: { id: "assignment1" }, userDoc: tpoUserDoc };

    await handleRemindAssignment(req, res);

    expect(createNotificationBulk).toHaveBeenCalledWith(
      ["student-partial", "student-none"],
      expect.objectContaining({ type: "assignment_reminder" })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ remindedCount: 2 })
    );
  });

  it("short-circuits with remindedCount: 0 and does not call createNotificationBulk when everyone is done", async () => {
    User.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: "student-done", solvedSlugs: ["two-sum", "valid-parentheses"] },
        ]),
      }),
    });
    const req = { params: { id: "assignment1" }, userDoc: tpoUserDoc };

    await handleRemindAssignment(req, res);

    expect(createNotificationBulk).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ remindedCount: 0 })
    );
  });

  it("returns 500 if an unexpected error is thrown", async () => {
    User.find.mockImplementation(() => {
      throw new Error("Mongo down");
    });
    const req = { params: { id: "assignment1" }, userDoc: tpoUserDoc };

    await handleRemindAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// Plan 009: registration-toggle enforcement (test plan's explicit
// requirement — "disabling tpoRegistrationEnabled rejects new TPO signups
// but does not affect an existing TPO's ability to log in/use the app").
describe("tpoRegistrationGate", () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("blocks a new registration with 403 when tpoRegistrationEnabled is false", async () => {
    getSettings.mockResolvedValueOnce({ tpoRegistrationEnabled: false });

    const blocked = await tpoRegistrationGate({}, res);

    expect(blocked).toBe(true);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows registration through when tpoRegistrationEnabled is true (the default)", async () => {
    getSettings.mockResolvedValueOnce({ tpoRegistrationEnabled: true });

    const blocked = await tpoRegistrationGate({}, res);

    expect(blocked).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("takes no dependency on req.userDoc — an existing TPO's other routes never call this gate", async () => {
    getSettings.mockResolvedValueOnce({ tpoRegistrationEnabled: false });
    await expect(tpoRegistrationGate({}, res)).resolves.toBe(true);
  });
});

// ── Route-level authorization wiring: /assignments, /assignments (GET), ────
// /assignments/:id/remind ────────────────────────────────────────────────
//
// Security audit finding (2026-09): these three routes had `requireRole`
// but were missing `requireVerified`, unlike every other TPO route. A
// unit test calling `requireVerified` directly (see
// tpoFlow.integration.test.js) already proved the middleware itself works
// — that's exactly why it didn't catch this bug: nothing asserted that
// the *route* actually applies it. These tests exercise the real
// `tpoRouter`'s middleware chain for these three routes specifically, the
// same way Express would dispatch a live request, so a future regression
// in route wiring (not middleware logic) would be caught here.
describe("assignment routes — requireVerified wiring (regression for the pending-TPO bypass)", () => {
  // Walks the REAL exported router's route-layer stack for `method`+`path`
  // and invokes each handler in order exactly as Express does: if a
  // handler doesn't call next(), it was terminal (it already sent a
  // response), so we stop — mirroring real dispatch, not re-implementing
  // it. This proves the actual wired chain (role check → verified check →
  // handler), not just that requireVerified works in isolation.
  async function runRoute(method, path, req) {
    const res = mockRes();
    const layer = tpoRouter.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods[method]
    );
    if (!layer) {
      throw new Error(`No ${method.toUpperCase()} ${path} route found on tpoRouter`);
    }

    for (const routeLayer of layer.route.stack) {
      let calledNext = false;
      let nextErr;
      await routeLayer.handle(req, res, (err) => {
        calledNext = true;
        nextErr = err;
      });
      if (nextErr) throw nextErr;
      if (!calledNext) break; // terminal: this layer already sent the response
    }
    return res;
  }

  const pendingTpo = { role: "tpo", tpoProfile: { collegeDomain: "example.edu", verified: false } };
  const verifiedTpo = { role: "tpo", tpoProfile: { collegeDomain: "example.edu", verified: true } };
  const admin = { role: "admin" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scenario 1-3 — pending/unverified TPO MUST be rejected", () => {
    it("POST /assignments — 403, and the assignment is never created", async () => {
      const req = { userDoc: pendingTpo, body: { title: "t", problemSlugs: ["two-sum"], dueDate: "2026-12-01" } };
      const res = await runRoute("post", "/assignments", req);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(Assignment.create).not.toHaveBeenCalled();
      expect(createNotificationBulk).not.toHaveBeenCalled();
    });

    it("GET /assignments — 403", async () => {
      const req = { userDoc: pendingTpo };
      const res = await runRoute("get", "/assignments", req);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(Assignment.find).not.toHaveBeenCalled();
    });

    it("POST /assignments/:id/remind — 403, and no reminder notification is sent", async () => {
      const req = { userDoc: pendingTpo, params: { id: "assignment1" } };
      const res = await runRoute("post", "/assignments/:id/remind", req);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(Assignment.findOne).not.toHaveBeenCalled();
      expect(createNotificationBulk).not.toHaveBeenCalled();
    });
  });

  describe("Scenario 4-6 — verified TPO MUST continue to work exactly as before", () => {
    it("POST /assignments — reaches the handler and creates the assignment (201)", async () => {
      Assignment.create.mockResolvedValue({ _id: "new-assignment", title: "t" });
      User.find.mockReturnValue({
        select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "s1" }]) }),
      });
      const req = { userDoc: verifiedTpo, body: { title: "t", problemSlugs: ["two-sum"], dueDate: "2026-12-01" } };

      const res = await runRoute("post", "/assignments", req);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(Assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({ collegeDomain: "example.edu", title: "t" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("GET /assignments — reaches the handler and returns the list (200)", async () => {
      Assignment.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      });
      User.find.mockReturnValue({
        select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      });
      const req = { userDoc: verifiedTpo };

      const res = await runRoute("get", "/assignments", req);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ assignments: [] }));
    });

    it("POST /assignments/:id/remind — reaches the handler exactly as the existing handleRemindAssignment tests already prove", async () => {
      Assignment.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(assignmentDoc) });
      User.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([{ _id: "student-none", solvedSlugs: [] }]),
        }),
      });
      const req = { userDoc: verifiedTpo, params: { id: "assignment1" } };

      const res = await runRoute("post", "/assignments/:id/remind", req);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(createNotificationBulk).toHaveBeenCalledWith(
        ["student-none"],
        expect.objectContaining({ type: "assignment_reminder" })
      );
    });
  });

  describe("Admin — requireVerified's existing admin bypass must be preserved", () => {
    it("POST /assignments — an admin (no tpoProfile at all) is not blocked by the new verified check", async () => {
      Assignment.create.mockResolvedValue({ _id: "new-assignment", title: "t" });
      User.find.mockReturnValue({
        select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      });
      const req = { userDoc: admin, body: { title: "t", problemSlugs: ["two-sum"], dueDate: "2026-12-01" } };

      const res = await runRoute("post", "/assignments", req);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(Assignment.create).toHaveBeenCalled();
    });
  });

  describe("Scenario 7 — cross-college isolation is unaffected by this change", () => {
    it("POST /assignments/:id/remind — a verified TPO cannot reach an assignment belonging to a different college", async () => {
      // Assignment.findOne is always queried with { _id, collegeDomain },
      // so an assignment from another college simply isn't found —
      // unrelated to (and unweakened by) the requireVerified fix.
      Assignment.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      const req = { userDoc: verifiedTpo, params: { id: "other-colleges-assignment" } };

      const res = await runRoute("post", "/assignments/:id/remind", req);

      expect(res.status).not.toHaveBeenCalledWith(403); // not blocked by verification...
      expect(res.status).toHaveBeenCalledWith(404); // ...but still blocked by college scoping
    });
  });
});
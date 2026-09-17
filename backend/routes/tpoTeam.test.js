import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../config/featureFlags.js", () => ({
  B2B_ENABLED: true,
}));
vi.mock("../models/User.js", () => ({
  default: { find: vi.fn(), findOne: vi.fn(), aggregate: vi.fn() },
}));
vi.mock("../models/Assignment.js", () => ({
  default: { findOne: vi.fn(), create: vi.fn(), find: vi.fn() },
}));
vi.mock("../utils/cache.js", () => ({
  getOrSetCache: vi.fn(async (key, ttl, fetchFn) => ({ value: await fetchFn(), cacheStatus: "MISS" })),
  invalidateCachePrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/notificationService.js", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  createNotificationBulk: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/settingsService.js", () => ({
  getSettings: vi.fn(),
}));
vi.mock("../utils/userAuthCache.js", () => ({
  invalidateCachedUserByFirebaseUid: vi.fn(),
}));
vi.mock("../services/tpoTeamService.js", () => ({
  getCollegeForTpo: vi.fn(),
  isPrimaryTpo: vi.fn(),
  listTeam: vi.fn(),
  claimPrimaryIfNone: vi.fn(),
  transferPrimary: vi.fn(),
}));

import User from "../models/User.js";
import { createNotification, createNotificationBulk } from "../services/notificationService.js";
import { invalidateCachedUserByFirebaseUid } from "../utils/userAuthCache.js";
import {
  getCollegeForTpo,
  isPrimaryTpo,
  listTeam,
  transferPrimary,
} from "../services/tpoTeamService.js";
import tpoRouter from "./tpo.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  return res;
}

// Same route-dispatch harness as routes/tpo.test.js — walks the real
// router's middleware stack for method+path so route-level wiring
// (role → verified → primary-gate → handler) is actually exercised, not
// just an individual handler called directly.
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
    if (!calledNext) break;
  }
  return res;
}

const college = {
  _id: "college1",
  name: "MIT",
  domains: ["mit.edu"],
  primaryTpo: "primary-id",
};

const primaryTpo = {
  role: "tpo",
  _id: { toString: () => "primary-id" },
  tpoProfile: { collegeDomain: "mit.edu", collegeName: "MIT", verified: true },
};

const secondaryTpo = {
  role: "tpo",
  _id: { toString: () => "secondary-id" },
  tpoProfile: { collegeDomain: "mit.edu", collegeName: "MIT", verified: true },
};

function makeSavableUser(overrides = {}) {
  return {
    _id: { toString: () => "target-id" },
    firebaseUid: "fb-target",
    email: "target@mit.edu",
    displayName: "Target Person",
    role: "student",
    roles: ["student"],
    tpoProfile: {},
    grantRole: vi.fn(function (roleName) {
      if (!this.roles.includes(roleName)) this.roles.push(roleName);
    }),
    revokeRole: vi.fn(function (roleName) {
      this.roles = this.roles.filter((r) => r !== roleName);
      if (this.roles.length === 0) this.roles = ["student"];
    }),
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("TPO team management routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /team", () => {
    it("returns the team roster with primary flags derived from college.primaryTpo", async () => {
      getCollegeForTpo.mockResolvedValueOnce(college);
      listTeam.mockResolvedValueOnce([
        { _id: { toString: () => "primary-id" }, displayName: "Prim", email: "p@mit.edu", tpoProfile: { verified: true } },
        { _id: { toString: () => "secondary-id" }, displayName: "Sec", email: "s@mit.edu", tpoProfile: { verified: true } },
      ]);
      isPrimaryTpo.mockImplementation((c, id) => id.toString() === "primary-id");

      const res = await runRoute("get", "/team", { userDoc: primaryTpo });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          collegeName: "MIT",
          primaryTpoId: "primary-id",
          team: [
            expect.objectContaining({ id: "primary-id", isPrimary: true }),
            expect.objectContaining({ id: "secondary-id", isPrimary: false }),
          ],
        })
      );
    });

    it("a secondary TPO can view the team (view-only, no primary gate)", async () => {
      getCollegeForTpo.mockResolvedValueOnce(college);
      listTeam.mockResolvedValueOnce([]);
      isPrimaryTpo.mockReturnValue(false);

      const res = await runRoute("get", "/team", { userDoc: secondaryTpo });
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it("returns 400 when the TPO has no resolvable college", async () => {
      getCollegeForTpo.mockResolvedValueOnce(null);
      const res = await runRoute("get", "/team", { userDoc: primaryTpo });
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("primary-only gating (requirePrimaryTeamAction)", () => {
    it("blocks a secondary TPO from inviting with 403", async () => {
      getCollegeForTpo.mockResolvedValueOnce(college);
      isPrimaryTpo.mockReturnValueOnce(false);

      const res = await runRoute("post", "/team/invite", {
        userDoc: secondaryTpo,
        body: { email: "someone@mit.edu" },
      });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it("blocks a secondary TPO from removing a teammate with 403", async () => {
      getCollegeForTpo.mockResolvedValueOnce(college);
      isPrimaryTpo.mockReturnValueOnce(false);

      const res = await runRoute("delete", "/team/:tpoId", {
        userDoc: secondaryTpo,
        params: { tpoId: "someone" },
      });

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("blocks a secondary TPO from transferring primary with 403", async () => {
      getCollegeForTpo.mockResolvedValueOnce(college);
      isPrimaryTpo.mockReturnValueOnce(false);

      const res = await runRoute("post", "/team/:tpoId/make-primary", {
        userDoc: secondaryTpo,
        params: { tpoId: "someone" },
      });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(transferPrimary).not.toHaveBeenCalled();
    });

    it("400s when the caller has no resolvable college at all", async () => {
      getCollegeForTpo.mockResolvedValueOnce(null);
      const res = await runRoute("post", "/team/invite", {
        userDoc: primaryTpo,
        body: { email: "x@mit.edu" },
      });
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("POST /team/invite", () => {
    beforeEach(() => {
      getCollegeForTpo.mockResolvedValue(college);
      isPrimaryTpo.mockReturnValue(true); // caller is primary
    });

    it("grants TPO to an existing account on the same domain and verifies them instantly", async () => {
      const target = makeSavableUser();
      User.findOne.mockResolvedValueOnce(target);

      const res = await runRoute("post", "/team/invite", {
        userDoc: primaryTpo,
        body: { email: "Target@MIT.edu" },
      });

      expect(User.findOne).toHaveBeenCalledWith({ email: "target@mit.edu" });
      expect(target.role).toBe("tpo");
      expect(target.roles).toContain("tpo");
      expect(target.tpoProfile).toEqual(
        expect.objectContaining({ collegeDomain: "mit.edu", verified: true })
      );
      expect(target.save).toHaveBeenCalledOnce();
      expect(invalidateCachedUserByFirebaseUid).toHaveBeenCalledWith("fb-target");
      expect(createNotificationBulk).toHaveBeenCalledWith(
        [target._id],
        expect.objectContaining({ type: "tpo_team_added" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("rejects an email whose domain isn't one of the college's own domains (cross-college protection)", async () => {
      const res = await runRoute("post", "/team/invite", {
        userDoc: primaryTpo,
        body: { email: "someone@rival-college.edu" },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it("404s when no account exists yet for that email", async () => {
      User.findOne.mockResolvedValueOnce(null);
      const res = await runRoute("post", "/team/invite", {
        userDoc: primaryTpo,
        body: { email: "nobody@mit.edu" },
      });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("409s when the target is already on this TPO team", async () => {
      User.findOne.mockResolvedValueOnce(
        makeSavableUser({ role: "tpo", tpoProfile: { collegeDomain: "mit.edu", verified: true } })
      );
      const res = await runRoute("post", "/team/invite", {
        userDoc: primaryTpo,
        body: { email: "target@mit.edu" },
      });
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("409s when the target is already a verified TPO at a different institution", async () => {
      User.findOne.mockResolvedValueOnce(
        makeSavableUser({ role: "tpo", tpoProfile: { collegeDomain: "other.edu", verified: true } })
      );
      const res = await runRoute("post", "/team/invite", {
        userDoc: primaryTpo,
        body: { email: "target@mit.edu" },
      });
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("400s when email is missing", async () => {
      const res = await runRoute("post", "/team/invite", { userDoc: primaryTpo, body: {} });
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("DELETE /team/:tpoId", () => {
    beforeEach(() => {
      getCollegeForTpo.mockResolvedValue(college);
      isPrimaryTpo.mockReturnValue(true);
    });

    it("removes a secondary TPO's authority without touching student data, preserving it", async () => {
      const target = makeSavableUser({
        role: "tpo",
        roles: ["student", "tpo"],
        totalXP: 500,
        solvedSlugs: ["two-sum"],
      });
      User.findOne.mockResolvedValueOnce(target);

      const res = await runRoute("delete", "/team/:tpoId", {
        userDoc: primaryTpo,
        params: { tpoId: "target-id" },
      });

      expect(target.role).toBe("student");
      expect(target.roles).toEqual(["student"]);
      expect(target.tpoProfile).toEqual(
        expect.objectContaining({ collegeDomain: null, verified: false })
      );
      // Student-track fields were never touched.
      expect(target.totalXP).toBe(500);
      expect(target.solvedSlugs).toEqual(["two-sum"]);
      expect(target.save).toHaveBeenCalledOnce();
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: "tpo_team_removed" })
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("refuses to let the primary remove themself — must transfer first", async () => {
      const res = await runRoute("delete", "/team/:tpoId", {
        userDoc: primaryTpo,
        params: { tpoId: "primary-id" },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it("refuses to remove whoever college.primaryTpo currently points to, even by a different id path", async () => {
      const res = await runRoute("delete", "/team/:tpoId", {
        userDoc: primaryTpo,
        params: { tpoId: "primary-id" }, // matches college.primaryTpo
      });
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("404s when the target isn't a TPO on this college", async () => {
      User.findOne.mockResolvedValueOnce(null);
      const res = await runRoute("delete", "/team/:tpoId", {
        userDoc: primaryTpo,
        params: { tpoId: "not-a-member" },
      });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("scopes the removal query to this college's own domains (cross-college protection)", async () => {
      User.findOne.mockResolvedValueOnce(null);
      await runRoute("delete", "/team/:tpoId", {
        userDoc: primaryTpo,
        params: { tpoId: "target-id" },
      });
      expect(User.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ "tpoProfile.collegeDomain": { $in: ["mit.edu"] } })
      );
    });
  });

  describe("POST /team/:tpoId/make-primary", () => {
    beforeEach(() => {
      getCollegeForTpo.mockResolvedValue(college);
      isPrimaryTpo.mockReturnValue(true);
    });

    it("transfers primary status atomically via tpoTeamService and notifies the new primary", async () => {
      const target = makeSavableUser({ role: "tpo", tpoProfile: { collegeDomain: "mit.edu", verified: true } });
      User.findOne.mockResolvedValueOnce(target);
      transferPrimary.mockResolvedValueOnce(true);

      const res = await runRoute("post", "/team/:tpoId/make-primary", {
        userDoc: primaryTpo,
        params: { tpoId: "target-id" },
      });

      expect(transferPrimary).toHaveBeenCalledWith("college1", primaryTpo._id, target._id);
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: "tpo_team_primary_transfer" })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, primaryTpoId: "target-id" })
      );
    });

    it("409s when the CAS transfer fails (primary changed since page load)", async () => {
      const target = makeSavableUser({ role: "tpo", tpoProfile: { collegeDomain: "mit.edu", verified: true } });
      User.findOne.mockResolvedValueOnce(target);
      transferPrimary.mockResolvedValueOnce(false);

      const res = await runRoute("post", "/team/:tpoId/make-primary", {
        userDoc: primaryTpo,
        params: { tpoId: "target-id" },
      });

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("404s when the target isn't a verified TPO on this college", async () => {
      User.findOne.mockResolvedValueOnce(null);
      const res = await runRoute("post", "/team/:tpoId/make-primary", {
        userDoc: primaryTpo,
        params: { tpoId: "pending-tpo-id" },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(transferPrimary).not.toHaveBeenCalled();
    });

    it("refuses a self-transfer with 400", async () => {
      const res = await runRoute("post", "/team/:tpoId/make-primary", {
        userDoc: primaryTpo,
        params: { tpoId: "primary-id" },
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(User.findOne).not.toHaveBeenCalled();
    });

    it("only queries for verified TPOs — a pending TPO can never become primary", async () => {
      User.findOne.mockResolvedValueOnce(null);
      await runRoute("post", "/team/:tpoId/make-primary", {
        userDoc: primaryTpo,
        params: { tpoId: "target-id" },
      });
      expect(User.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ "tpoProfile.verified": true })
      );
    });
  });

  describe("GET /me includes isPrimary", () => {
    it("reports isPrimary true for the college's current primary", async () => {
      getCollegeForTpo.mockResolvedValueOnce(college);
      isPrimaryTpo.mockReturnValueOnce(true);

      const res = await runRoute("get", "/me", { userDoc: primaryTpo });

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ isPrimary: true, hasPrimary: true }));
    });

    it("reports isPrimary false for a secondary TPO", async () => {
      getCollegeForTpo.mockResolvedValueOnce(college);
      isPrimaryTpo.mockReturnValueOnce(false);

      const res = await runRoute("get", "/me", { userDoc: secondaryTpo });

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ isPrimary: false }));
    });

    it("handles no resolvable college gracefully (isPrimary false, hasPrimary false)", async () => {
      getCollegeForTpo.mockResolvedValueOnce(null);

      const res = await runRoute("get", "/me", { userDoc: primaryTpo });

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ isPrimary: false, hasPrimary: false }));
    });
  });
});
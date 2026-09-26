import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../config/featureFlags.js", () => ({
  B2B_ENABLED: true,
}));
vi.mock("../models/College.js", () => ({
  default: { findByDomain: vi.fn(), create: vi.fn(), deleteOne: vi.fn(), updateOne: vi.fn() },
}));
vi.mock("../models/User.js", () => ({
  default: { find: vi.fn(), aggregate: vi.fn() },
}));
vi.mock("../models/Assignment.js", () => ({
  default: { findOne: vi.fn(), create: vi.fn(), find: vi.fn() },
}));
vi.mock("../utils/domainVerification.js", () => ({
  isDomainAutoVerified: vi.fn().mockResolvedValue(false),
  isConsumerEmailDomain: vi.fn().mockReturnValue(false),
}));
vi.mock("../services/settingsService.js", () => ({
  getSettings: vi.fn().mockResolvedValue({ tpoRegistrationEnabled: true }),
}));
vi.mock("../services/notificationService.js", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  createNotificationBulk: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../utils/cache.js", () => ({
  getOrSetCache: vi.fn(async (key, ttl, fetchFn) => ({ value: await fetchFn(), cacheStatus: "MISS" })),
  invalidateCachePrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/tpoTeamService.js", () => ({
  getCollegeForTpo: vi.fn(),
  isPrimaryTpo: vi.fn(),
  listTeam: vi.fn(),
  claimPrimaryIfNone: vi.fn(),
  transferPrimary: vi.fn(),
  resolveTpoTeamContext: vi.fn(),
  resolveCollegeDomains: vi.fn(),
}));

import College from "../models/College.js";
import { claimPrimaryIfNone } from "../services/tpoTeamService.js";
import tpoRouter from "./tpo.js";

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

function makeUserDoc(overrides = {}) {
  return {
    email: "founder@newcollege.ac.in",
    grantRole: vi.fn(),
    role: "student",
    tpoProfile: {},
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("POST /register — TPO-1 hardening: partial-failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("College rollback when User.save() fails", () => {
    it("deletes a newly-created College when the User-side save fails right after", async () => {
      College.findByDomain.mockResolvedValueOnce(null); // brand-new domain
      College.create.mockResolvedValueOnce({ _id: "new-college-id" });

      const userDoc = makeUserDoc({ save: vi.fn().mockRejectedValueOnce(new Error("save boom")) });
      const res = mockRes();

      await registerHandler(
        { userDoc, log: mockLog(), body: { collegeName: "New College" } },
        res
      );

      expect(College.create).toHaveBeenCalledOnce();
      expect(College.deleteOne).toHaveBeenCalledWith({ _id: "new-college-id" });
      expect(College.updateOne).not.toHaveBeenCalled();
      // The failure still surfaces as an error response — rollback doesn't
      // silently swallow the original problem.
      expect(res._status).toBe(500);
    });

    it("reverts an upgraded auto-placeholder College back to its prior fields when User.save() fails", async () => {
      const existingCollege = {
        _id: "placeholder-id",
        name: "Guessed College Name",
        status: "pending",
        verifiedAt: null,
        submittedBy: null,
        submittedByRole: "auto",
        save: vi.fn().mockResolvedValue(true),
      };
      College.findByDomain.mockResolvedValueOnce(existingCollege);

      const userDoc = makeUserDoc({ save: vi.fn().mockRejectedValueOnce(new Error("save boom")) });
      const res = mockRes();

      await registerHandler(
        { userDoc, log: mockLog(), body: { collegeName: "Real College Name" } },
        res
      );

      // The placeholder was upgraded in memory and saved once (the college
      // save succeeds; only the USER save fails)...
      expect(existingCollege.save).toHaveBeenCalledOnce();
      expect(College.create).not.toHaveBeenCalled();
      // ...then rolled back to exactly its pre-upgrade values.
      expect(College.updateOne).toHaveBeenCalledWith(
        { _id: "placeholder-id" },
        {
          $set: {
            name: "Guessed College Name",
            status: "pending",
            verifiedAt: null,
            submittedBy: null,
            submittedByRole: "auto",
          },
        }
      );
      expect(res._status).toBe(500);
    });

    it("does not attempt any rollback when the college was neither newly created nor an upgraded placeholder", async () => {
      // Second TPO registering on an already-verified, real (non-auto)
      // college — no College-side write happens at all in this branch, so
      // a User.save() failure has nothing to roll back.
      College.findByDomain.mockResolvedValueOnce({
        _id: "existing-id",
        status: "verified",
        submittedByRole: "tpo",
        domains: ["newcollege.ac.in"],
      });

      const userDoc = makeUserDoc({ save: vi.fn().mockRejectedValueOnce(new Error("save boom")) });
      await registerHandler(
        { userDoc, log: mockLog(), body: { collegeName: "New College" } },
        mockRes()
      );

      expect(College.create).not.toHaveBeenCalled();
      expect(College.deleteOne).not.toHaveBeenCalled();
      expect(College.updateOne).not.toHaveBeenCalled();
    });
  });

  describe("individual verification boundary", () => {
    it("never claims primary during registration, even when the college is already verified", async () => {
      College.findByDomain.mockResolvedValueOnce({
        _id: "college-id",
        status: "verified",
        submittedByRole: "tpo",
        domains: ["newcollege.ac.in"],
      });

      const userDoc = makeUserDoc();
      const res = mockRes();

      await registerHandler(
        { userDoc, log: mockLog(), body: { collegeName: "New College" } },
        res
      );

      expect(userDoc.save).toHaveBeenCalledOnce();
      expect(claimPrimaryIfNone).not.toHaveBeenCalled();
      expect(userDoc.tpoProfile.verified).toBe(false);
      expect(userDoc.tpoVerification.status).toBe("pending");
      expect(res._status).toBe(201);
      expect(res._json).toEqual(expect.objectContaining({
        success: true,
        verified: false,
        isPrimary: false,
        status: "pending",
      }));
    });

    it("keeps an unrecognized college and TPO request pending", async () => {
      College.findByDomain.mockResolvedValueOnce(null);
      College.create.mockResolvedValueOnce({ _id: "new-college-id" });

      const userDoc = makeUserDoc();
      const res = mockRes();

      await registerHandler(
        { userDoc, log: mockLog(), body: { collegeName: "New College" } },
        res
      );

      expect(claimPrimaryIfNone).not.toHaveBeenCalled();
      expect(res._json).toEqual(expect.objectContaining({
        success: true,
        verified: false,
        isPrimary: false,
        status: "pending",
      }));
    });
  });;
});

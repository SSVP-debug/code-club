import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/College.js", () => ({
  default: { findByDomain: vi.fn(), findOneAndUpdate: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/User.js", () => ({
  default: { find: vi.fn() },
}));

import College from "../models/College.js";
import User from "../models/User.js";
import {
  getCollegeForTpo,
  isPrimaryTpo,
  listTeam,
  claimPrimaryIfNone,
  transferPrimary,
  clearPrimaryIfCurrent,
  resolveTpoTeamContext,
  resolveCollegeDomains,
} from "./tpoTeamService.js";

describe("tpoTeamService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCollegeForTpo", () => {
    it("looks up the college by the TPO's own collegeDomain", async () => {
      College.findByDomain.mockResolvedValueOnce({ _id: "c1" });
      const result = await getCollegeForTpo({ tpoProfile: { collegeDomain: "mit.edu" } });

      expect(College.findByDomain).toHaveBeenCalledWith("mit.edu");
      expect(result).toEqual({ _id: "c1" });
    });

    it("returns null without querying when the TPO has no college domain set", async () => {
      const result = await getCollegeForTpo({ tpoProfile: {} });
      expect(result).toBeNull();
      expect(College.findByDomain).not.toHaveBeenCalled();
    });

    it("returns null for a userDoc with no tpoProfile at all", async () => {
      const result = await getCollegeForTpo({});
      expect(result).toBeNull();
      expect(College.findByDomain).not.toHaveBeenCalled();
    });
  });

  describe("isPrimaryTpo", () => {
    it("is true when the college's primaryTpo matches the given user id", () => {
      const college = { primaryTpo: { toString: () => "u1" } };
      expect(isPrimaryTpo(college, "u1")).toBe(true);
    });

    it("is false when primaryTpo belongs to someone else", () => {
      const college = { primaryTpo: { toString: () => "u1" } };
      expect(isPrimaryTpo(college, "u2")).toBe(false);
    });

    it("is false when the college has no primary yet", () => {
      expect(isPrimaryTpo({ primaryTpo: null }, "u1")).toBe(false);
    });

    it("is false when no college is given", () => {
      expect(isPrimaryTpo(null, "u1")).toBe(false);
    });

    it("is false when no userId is given", () => {
      const college = { primaryTpo: { toString: () => "u1" } };
      expect(isPrimaryTpo(college, undefined)).toBe(false);
    });
  });

  describe("listTeam", () => {
    it("queries every TPO whose collegeDomain falls under the college's domains", async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([{ _id: "t1" }]),
      };
      User.find.mockReturnValueOnce(chain);

      const result = await listTeam({ domains: ["mit.edu", "old-mit.edu"] });

      expect(User.find).toHaveBeenCalledWith({
        role: "tpo",
        "tpoProfile.collegeDomain": { $in: ["mit.edu", "old-mit.edu"] },
      });
      expect(result).toEqual([{ _id: "t1" }]);
    });
  });

  describe("claimPrimaryIfNone", () => {
    it("claims primary via a CAS on primaryTpo: null and returns true on success", async () => {
      College.findOneAndUpdate.mockResolvedValueOnce({ _id: "c1", primaryTpo: "u1" });

      const claimed = await claimPrimaryIfNone("c1", "u1");

      expect(College.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "c1", primaryTpo: null },
        { $set: { primaryTpo: "u1" } }
      );
      expect(claimed).toBe(true);
    });

    it("returns false when someone already holds primary (CAS filter matches nothing)", async () => {
      College.findOneAndUpdate.mockResolvedValueOnce(null);
      const claimed = await claimPrimaryIfNone("c1", "u2");
      expect(claimed).toBe(false);
    });

    it("returns false without querying when collegeId or userId is missing", async () => {
      expect(await claimPrimaryIfNone(null, "u1")).toBe(false);
      expect(await claimPrimaryIfNone("c1", null)).toBe(false);
      expect(College.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("transferPrimary", () => {
    it("transfers via a CAS on the current primary and returns true on success", async () => {
      College.findOneAndUpdate.mockResolvedValueOnce({ _id: "c1", primaryTpo: "u2" });

      const transferred = await transferPrimary("c1", "u1", "u2");

      expect(College.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "c1", primaryTpo: "u1" },
        { $set: { primaryTpo: "u2" } }
      );
      expect(transferred).toBe(true);
    });

    it("returns false (conflict) when fromUserId is no longer the current primary", async () => {
      College.findOneAndUpdate.mockResolvedValueOnce(null);
      const transferred = await transferPrimary("c1", "stale-primary", "u2");
      expect(transferred).toBe(false);
    });
  });

  describe("clearPrimaryIfCurrent", () => {
    it("clears primaryTpo via a CAS on the current holder and returns true on success", async () => {
      College.findOneAndUpdate.mockResolvedValueOnce({ _id: "c1", primaryTpo: null });

      const cleared = await clearPrimaryIfCurrent("c1", "u1");

      expect(College.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "c1", primaryTpo: "u1" },
        { $set: { primaryTpo: null } }
      );
      expect(cleared).toBe(true);
    });

    it("returns false when the given user isn't the current primary", async () => {
      College.findOneAndUpdate.mockResolvedValueOnce(null);
      const cleared = await clearPrimaryIfCurrent("c1", "not-primary");
      expect(cleared).toBe(false);
    });
  });

  // ── TPO-1 closure: admin-override resolution ────────────────────────────
  describe("resolveTpoTeamContext", () => {
    it("for a non-admin, resolves the caller's OWN college and ignores explicitCollegeId entirely", async () => {
      College.findByDomain.mockResolvedValueOnce({ _id: "own-college" });

      const result = await resolveTpoTeamContext(
        { role: "tpo", tpoProfile: { collegeDomain: "mit.edu" } },
        "some-other-college-id" // must never be consulted — this is the isolation guarantee
      );

      expect(College.findByDomain).toHaveBeenCalledWith("mit.edu");
      expect(College.findById).not.toHaveBeenCalled();
      expect(result).toEqual({ college: { _id: "own-college" }, isAdmin: false, missingCollegeId: false });
    });

    it("for an admin, resolves the college from the explicit collegeId", async () => {
      College.findById.mockResolvedValueOnce({ _id: "target-college" });

      const result = await resolveTpoTeamContext({ role: "admin" }, "target-college");

      expect(College.findById).toHaveBeenCalledWith("target-college");
      expect(College.findByDomain).not.toHaveBeenCalled();
      expect(result).toEqual({ college: { _id: "target-college" }, isAdmin: true, missingCollegeId: false });
    });

    it("for an admin with no collegeId, returns missingCollegeId without querying", async () => {
      const result = await resolveTpoTeamContext({ role: "admin" }, undefined);

      expect(result).toEqual({ college: null, isAdmin: true, missingCollegeId: true });
      expect(College.findById).not.toHaveBeenCalled();
    });

    it("for an admin with a collegeId that doesn't resolve to a real college, returns college: null (not missingCollegeId)", async () => {
      College.findById.mockResolvedValueOnce(null);

      const result = await resolveTpoTeamContext({ role: "admin" }, "bogus-id");

      expect(result).toEqual({ college: null, isAdmin: true, missingCollegeId: false });
    });

    it("for an admin, a malformed collegeId (invalid ObjectId) resolves to college: null rather than throwing", async () => {
      College.findById.mockRejectedValueOnce(new Error("Cast to ObjectId failed"));

      const result = await resolveTpoTeamContext({ role: "admin" }, "not-an-object-id");

      expect(result).toEqual({ college: null, isAdmin: true, missingCollegeId: false });
    });
  });

  describe("resolveCollegeDomains", () => {
    it("returns every domain the TPO's college owns, lowercased", async () => {
      College.findByDomain.mockResolvedValueOnce({ domains: ["MIT.edu", "old-mit.EDU"] });

      const domains = await resolveCollegeDomains({ tpoProfile: { collegeDomain: "mit.edu" } });

      expect(domains).toEqual(["mit.edu", "old-mit.edu"]);
    });

    it("falls back to just the TPO's own single domain when no College record resolves", async () => {
      College.findByDomain.mockResolvedValueOnce(null);

      const domains = await resolveCollegeDomains({ tpoProfile: { collegeDomain: "Mit.edu" } });

      expect(domains).toEqual(["mit.edu"]);
    });

    it("returns an empty array when the TPO has no college domain at all", async () => {
      const domains = await resolveCollegeDomains({ tpoProfile: {} });
      expect(domains).toEqual([]);
    });
  });
});

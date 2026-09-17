import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/College.js", () => ({
  default: { findByDomain: vi.fn(), findOneAndUpdate: vi.fn() },
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
});
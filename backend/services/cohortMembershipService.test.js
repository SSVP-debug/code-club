import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/Cohort.js", () => ({
  default: { findOne: vi.fn() },
}));
vi.mock("../models/CohortMembership.js", () => ({
  default: { findOne: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
}));
vi.mock("../models/User.js", () => ({
  default: { findOne: vi.fn() },
}));

import mongoose from "mongoose";
import Cohort from "../models/Cohort.js";
import CohortMembership from "../models/CohortMembership.js";
import User from "../models/User.js";
import { getCohortRoster, addStudentToCohort, removeCohortMembership } from "./cohortMembershipService.js";

const collegeId = new mongoose.Types.ObjectId();
const otherCollegeId = new mongoose.Types.ObjectId();
const cohortId = new mongoose.Types.ObjectId();
const addedBy = new mongoose.Types.ObjectId();

function leanResult(value) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function rawMembership(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    cohortId,
    collegeId,
    studentId: null,
    status: "invited",
    email: "student@example.edu",
    invitedAt: null,
    joinedAt: null,
    removedAt: null,
    addedBy,
    importBatchId: null,
    ...overrides,
  };
}

/** Mirrors the same "awaitable + .lean()" findOne mock shape used in
 * cohortService.test.js. */
function findOneResult(data) {
  if (!data) {
    const promise = Promise.resolve(null);
    promise.lean = () => Promise.resolve(null);
    return promise;
  }
  const doc = {
    ...data,
    save: vi.fn(async function () { return doc; }),
    toObject() {
      const { save: _save, toObject: _toObject, ...plain } = doc;
      return plain;
    },
  };
  const promise = Promise.resolve(doc);
  promise.lean = () => Promise.resolve({ ...data });
  return promise;
}

describe("cohortMembershipService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCohortRoster", () => {
    it("returns { invalidId: true } for a malformed cohortId, without querying", async () => {
      const result = await getCohortRoster("not-an-id", collegeId);
      expect(result).toEqual({ invalidId: true });
      expect(Cohort.findOne).not.toHaveBeenCalled();
    });

    it("returns null when the cohort isn't found in this institution", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult(null));

      const result = await getCohortRoster(cohortId.toString(), collegeId);

      expect(result).toBeNull();
      expect(CohortMembership.aggregate).not.toHaveBeenCalled();
    });

    it("scopes the cohort lookup to (cohortId, collegeId) together", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      CohortMembership.aggregate.mockResolvedValueOnce([{ data: [], totalCount: [] }]);
      CohortMembership.aggregate.mockResolvedValueOnce([]);

      await getCohortRoster(cohortId.toString(), collegeId);

      expect(Cohort.findOne).toHaveBeenCalledWith({ _id: cohortId.toString(), collegeId });
    });

    it("defaults to status=active when no status is given", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      CohortMembership.aggregate.mockResolvedValueOnce([{ data: [], totalCount: [] }]);
      CohortMembership.aggregate.mockResolvedValueOnce([]);

      await getCohortRoster(cohortId.toString(), collegeId, {});

      const listPipeline = CohortMembership.aggregate.mock.calls[0][0];
      expect(listPipeline[0].$match.status).toBe("active");
    });

    it("filters by an explicit status (invited)", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      CohortMembership.aggregate.mockResolvedValueOnce([{ data: [], totalCount: [] }]);
      CohortMembership.aggregate.mockResolvedValueOnce([]);

      await getCohortRoster(cohortId.toString(), collegeId, { status: "invited" });

      const listPipeline = CohortMembership.aggregate.mock.calls[0][0];
      expect(listPipeline[0].$match.status).toBe("invited");
    });

    it("filters by an explicit status (removed)", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      CohortMembership.aggregate.mockResolvedValueOnce([{ data: [], totalCount: [] }]);
      CohortMembership.aggregate.mockResolvedValueOnce([]);

      await getCohortRoster(cohortId.toString(), collegeId, { status: "removed" });

      const listPipeline = CohortMembership.aggregate.mock.calls[0][0];
      expect(listPipeline[0].$match.status).toBe("removed");
    });

    it("builds a case-insensitive, regex-escaped search across email/student name/student email", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      CohortMembership.aggregate.mockResolvedValueOnce([{ data: [], totalCount: [] }]);
      CohortMembership.aggregate.mockResolvedValueOnce([]);

      await getCohortRoster(cohortId.toString(), collegeId, { search: "jane (smith)" });

      const listPipeline = CohortMembership.aggregate.mock.calls[0][0];
      const searchMatchStage = listPipeline.find((s) => s.$match?.$or);
      expect(searchMatchStage.$match.$or).toEqual([
        { email: { $regex: "jane \\(smith\\)", $options: "i" } },
        { "student.displayName": { $regex: "jane \\(smith\\)", $options: "i" } },
        { "student.email": { $regex: "jane \\(smith\\)", $options: "i" } },
      ]);
    });

    it("rejects an unsafe sort key, falling back to the default", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      CohortMembership.aggregate.mockResolvedValueOnce([{ data: [], totalCount: [] }]);
      CohortMembership.aggregate.mockResolvedValueOnce([]);

      await getCohortRoster(cohortId.toString(), collegeId, { sort: "$where: 'malicious'" });

      const listPipeline = CohortMembership.aggregate.mock.calls[0][0];
      const sortStage = listPipeline.find((s) => s.$sort);
      expect(sortStage.$sort).toEqual({ createdAt: -1, _id: 1 }); // default
    });

    it("accepts each allowed sort key", async () => {
      for (const sort of ["name", "email", "joinedAt", "createdAt", "status"]) {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        CohortMembership.aggregate.mockResolvedValueOnce([{ data: [], totalCount: [] }]);
        CohortMembership.aggregate.mockResolvedValueOnce([]);

        await getCohortRoster(cohortId.toString(), collegeId, { sort });

        const listPipeline = CohortMembership.aggregate.mock.calls.at(-2)[0];
        const sortStage = listPipeline.find((s) => s.$sort);
        expect(sortStage.$sort).toBeDefined();
      }
    });

    it("paginates and returns total/page/limit", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      CohortMembership.aggregate.mockResolvedValueOnce([{ data: [], totalCount: [{ count: 7 }] }]);
      CohortMembership.aggregate.mockResolvedValueOnce([]);

      const result = await getCohortRoster(cohortId.toString(), collegeId, { page: 2, limit: 10 });

      expect(result).toEqual(expect.objectContaining({ total: 7, page: 2, limit: 10 }));
    });

    it("returns the specified shape for an active matched student row", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      const studentId = new mongoose.Types.ObjectId();
      CohortMembership.aggregate.mockResolvedValueOnce([{
        data: [{
          membershipId: new mongoose.Types.ObjectId(), studentId,
          name: "Jane Doe", email: "jane@example.edu", membershipStatus: "active",
          invitedAt: null, joinedAt: new Date("2024-02-01"), removedAt: null,
        }],
        totalCount: [{ count: 1 }],
      }]);
      CohortMembership.aggregate.mockResolvedValueOnce([]);

      const result = await getCohortRoster(cohortId.toString(), collegeId, { status: "active" });

      expect(result.students[0]).toEqual(
        expect.objectContaining({
          studentId: studentId.toString(), name: "Jane Doe", email: "jane@example.edu",
          membershipStatus: "active", joinedAt: new Date("2024-02-01"),
        })
      );
      expect(typeof result.students[0].membershipId).toBe("string");
    });

    it("returns the specified shape for an invited/unmatched row", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      CohortMembership.aggregate.mockResolvedValueOnce([{
        data: [{
          membershipId: new mongoose.Types.ObjectId(), studentId: null,
          name: null, email: "invited@example.edu", membershipStatus: "invited",
          invitedAt: new Date("2024-01-01"), joinedAt: null, removedAt: null,
        }],
        totalCount: [{ count: 1 }],
      }]);
      CohortMembership.aggregate.mockResolvedValueOnce([]);

      const result = await getCohortRoster(cohortId.toString(), collegeId, { status: "invited" });

      expect(result.students[0]).toEqual(
        expect.objectContaining({ studentId: null, email: "invited@example.edu", membershipStatus: "invited" })
      );
    });

    it("computes activeCount/invitedCount/removedCount from the whole cohort, independent of the current status filter", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      CohortMembership.aggregate.mockResolvedValueOnce([{ data: [], totalCount: [{ count: 3 }] }]); // list (status=active)
      CohortMembership.aggregate.mockResolvedValueOnce([
        { _id: "active", count: 3 }, { _id: "invited", count: 5 }, { _id: "removed", count: 2 },
      ]);

      const result = await getCohortRoster(cohortId.toString(), collegeId, { status: "active" });

      expect(result.counts).toEqual({ activeCount: 3, invitedCount: 5, removedCount: 2 });
    });

    it("the counts aggregation is never status-filtered", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      CohortMembership.aggregate.mockResolvedValueOnce([{ data: [], totalCount: [] }]);
      CohortMembership.aggregate.mockResolvedValueOnce([]);

      await getCohortRoster(cohortId.toString(), collegeId, { status: "removed" });

      const countsPipeline = CohortMembership.aggregate.mock.calls[1][0];
      expect(countsPipeline[0].$match).not.toHaveProperty("status");
    });
  });

  describe("addStudentToCohort", () => {
    it("returns { invalidId: true } for a malformed cohortId", async () => {
      const result = await addStudentToCohort("not-an-id", collegeId, addedBy, "x@example.edu");
      expect(result).toEqual({ invalidId: true });
      expect(Cohort.findOne).not.toHaveBeenCalled();
    });

    it("returns null when the cohort isn't found in this institution", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult(null));
      const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "x@example.edu");
      expect(result).toBeNull();
    });

    it("returns a validationError when email is missing/empty", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
      const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "   ");
      expect(result.validationError).toBeDefined();
    });

    describe("existing student, no prior membership", () => {
      it("creates an active membership with the matched user's id", async () => {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        const studentId = new mongoose.Types.ObjectId();
        User.findOne.mockResolvedValueOnce({ _id: studentId, email: "student@example.edu", education: { collegeId } });
        CohortMembership.findOne.mockReturnValueOnce(findOneResult(null));
        CohortMembership.create.mockResolvedValueOnce({
          toObject: () => rawMembership({ status: "active", studentId, joinedAt: new Date() }),
        });

        const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "Student@Example.edu");

        expect(User.findOne).toHaveBeenCalledWith({ email: "student@example.edu" }); // normalized
        expect(CohortMembership.create).toHaveBeenCalledWith(
          expect.objectContaining({ status: "active", studentId, email: "student@example.edu", addedBy })
        );
        expect(result.created).toBe(true);
        expect(result.membership.membershipStatus).toBe("active");
      });
    });

    describe("unknown email, no prior membership", () => {
      it("creates an invited membership with studentId null", async () => {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        User.findOne.mockResolvedValueOnce(null);
        CohortMembership.findOne.mockReturnValueOnce(findOneResult(null));
        CohortMembership.create.mockResolvedValueOnce({
          toObject: () => rawMembership({ status: "invited", invitedAt: new Date() }),
        });

        const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "unknown@example.edu");

        expect(CohortMembership.create).toHaveBeenCalledWith(
          expect.objectContaining({ status: "invited", studentId: null })
        );
        expect(result.created).toBe(true);
        expect(result.membership.studentId).toBeNull();
      });
    });

    describe("critical institution matching", () => {
      it("rejects a matched user whose education.collegeId belongs to a DIFFERENT institution", async () => {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        User.findOne.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), education: { collegeId: otherCollegeId } });

        const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "foreign@other.edu");

        expect(result.validationError).toMatch(/different institution/i);
        expect(CohortMembership.create).not.toHaveBeenCalled();
        expect(CohortMembership.findOne).not.toHaveBeenCalled();
      });

      it("rejects a matched user with no education.collegeId at all (unlinked legacy account) — never invents a match", async () => {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        User.findOne.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), education: {} });

        const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "legacy@example.edu");

        expect(result.validationError).toMatch(/hasn't been linked/i);
        expect(CohortMembership.create).not.toHaveBeenCalled();
      });

      it("never even reads a client-supplied collegeId/studentId to bypass matching (function signature only accepts email)", async () => {
        // Structural proof: addStudentToCohort's signature is
        // (cohortId, collegeId, addedBy, rawEmail) — there is no
        // parameter through which a caller could pass a client-supplied
        // collegeId/studentId into the matching logic at all.
        expect(addStudentToCohort.length).toBe(4);
      });
    });

    describe("existing membership handling", () => {
      it("rejects with conflict when a membership is already active", async () => {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        User.findOne.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), education: { collegeId } });
        CohortMembership.findOne.mockReturnValueOnce(findOneResult(rawMembership({ status: "active" })));

        const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "student@example.edu");

        expect(result.conflict).toBe(true);
        expect(CohortMembership.create).not.toHaveBeenCalled();
      });

      it("promotes an invited membership to active once a matching user is found", async () => {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        const studentId = new mongoose.Types.ObjectId();
        User.findOne.mockResolvedValueOnce({ _id: studentId, education: { collegeId } });
        const doc = findOneResult(rawMembership({ status: "invited" }));
        CohortMembership.findOne.mockReturnValueOnce(doc);
        const resolved = await doc;

        const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "student@example.edu");

        expect(resolved.status).toBe("active");
        expect(resolved.studentId).toBe(studentId);
        expect(resolved.joinedAt).toBeInstanceOf(Date);
        expect(resolved.save).toHaveBeenCalledOnce();
        expect(result.previousStatus).toBe("invited");
        expect(result.noop).toBe(false);
      });

      it("re-adding an still-unmatched invited membership is a no-op (idempotent), no save", async () => {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        User.findOne.mockResolvedValueOnce(null);
        const doc = findOneResult(rawMembership({ status: "invited" }));
        CohortMembership.findOne.mockReturnValueOnce(doc);
        const resolved = await doc;

        const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "student@example.edu");

        expect(resolved.save).not.toHaveBeenCalled();
        expect(result.noop).toBe(true);
        expect(result.created).toBe(false);
      });

      it("reactivates a removed membership to active when a matching user is found — recommended re-add behavior", async () => {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        const studentId = new mongoose.Types.ObjectId();
        User.findOne.mockResolvedValueOnce({ _id: studentId, education: { collegeId } });
        const doc = findOneResult(rawMembership({ status: "removed", removedAt: new Date("2024-01-01") }));
        CohortMembership.findOne.mockReturnValueOnce(doc);
        const resolved = await doc;

        const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "student@example.edu");

        expect(resolved.status).toBe("active");
        expect(resolved.studentId).toBe(studentId);
        expect(resolved.removedAt).toBeNull();
        expect(result.previousStatus).toBe("removed");
      });

      it("reactivates a removed, still-unmatched membership back to invited (not falsely active)", async () => {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        User.findOne.mockResolvedValueOnce(null);
        const doc = findOneResult(rawMembership({ status: "removed", removedAt: new Date("2024-01-01") }));
        CohortMembership.findOne.mockReturnValueOnce(doc);
        const resolved = await doc;

        const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "student@example.edu");

        expect(resolved.status).toBe("invited");
        expect(resolved.studentId).toBeNull();
        expect(resolved.removedAt).toBeNull();
        expect(result.previousStatus).toBe("removed");
      });

      it("never creates a second row when an existing membership is found — always updates in place", async () => {
        Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId }));
        User.findOne.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), education: { collegeId } });
        CohortMembership.findOne.mockReturnValueOnce(findOneResult(rawMembership({ status: "removed" })));

        await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "student@example.edu");

        expect(CohortMembership.create).not.toHaveBeenCalled();
      });
    });
  });

  describe("removeCohortMembership", () => {
    const membershipId = new mongoose.Types.ObjectId();

    it("returns { invalidId: true } for a malformed cohortId or membershipId", async () => {
      expect(await removeCohortMembership("not-an-id", membershipId.toString(), collegeId)).toEqual({ invalidId: true });
      expect(await removeCohortMembership(cohortId.toString(), "not-an-id", collegeId)).toEqual({ invalidId: true });
      expect(CohortMembership.findOne).not.toHaveBeenCalled();
    });

    it("returns null when the cohort itself doesn't exist in this institution", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult(null));

      const result = await removeCohortMembership(cohortId.toString(), membershipId.toString(), collegeId);

      expect(result).toBeNull();
      expect(CohortMembership.findOne).not.toHaveBeenCalled();
    });

    it("returns { archived: true } for an archived cohort, without ever touching CohortMembership", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId, status: "archived" }));

      const result = await removeCohortMembership(cohortId.toString(), membershipId.toString(), collegeId);

      expect(result).toEqual({ archived: true });
      expect(CohortMembership.findOne).not.toHaveBeenCalled();
    });

    it("returns null when no membership matches (cohortId, membershipId, collegeId) together", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId, status: "active" }));
      CohortMembership.findOne.mockReturnValueOnce(findOneResult(null));

      const result = await removeCohortMembership(cohortId.toString(), membershipId.toString(), collegeId);

      expect(result).toBeNull();
    });

    it("scopes the lookup to _id + cohortId + collegeId together — cannot remove another institution's membership", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId, status: "active" }));
      CohortMembership.findOne.mockReturnValueOnce(findOneResult(null));

      await removeCohortMembership(cohortId.toString(), membershipId.toString(), collegeId);

      expect(CohortMembership.findOne).toHaveBeenCalledWith({ _id: membershipId.toString(), cohortId: cohortId.toString(), collegeId });
    });

    it("removes an active membership: sets status=removed and removedAt", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId, status: "active" }));
      const doc = findOneResult(rawMembership({ status: "active" }));
      CohortMembership.findOne.mockReturnValueOnce(doc);
      const resolved = await doc;

      const result = await removeCohortMembership(cohortId.toString(), membershipId.toString(), collegeId);

      expect(resolved.status).toBe("removed");
      expect(resolved.removedAt).toBeInstanceOf(Date);
      expect(resolved.save).toHaveBeenCalledOnce();
      expect(result.alreadyRemoved).toBe(false);
    });

    it("removes an invited membership the same way, studentId stays null", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId, status: "active" }));
      const doc = findOneResult(rawMembership({ status: "invited", studentId: null }));
      CohortMembership.findOne.mockReturnValueOnce(doc);
      const resolved = await doc;

      const result = await removeCohortMembership(cohortId.toString(), membershipId.toString(), collegeId);

      expect(resolved.status).toBe("removed");
      expect(resolved.studentId).toBeNull();
      expect(result.membership.studentId).toBeNull();
    });

    it("repeat removal is idempotent: no-op, no save, alreadyRemoved: true", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId, status: "active" }));
      const originalRemovedAt = new Date("2024-01-01");
      const doc = findOneResult(rawMembership({ status: "removed", removedAt: originalRemovedAt }));
      CohortMembership.findOne.mockReturnValueOnce(doc);
      const resolved = await doc;

      const result = await removeCohortMembership(cohortId.toString(), membershipId.toString(), collegeId);

      expect(resolved.save).not.toHaveBeenCalled();
      expect(resolved.removedAt).toBe(originalRemovedAt); // untouched, not re-stamped
      expect(result.alreadyRemoved).toBe(true);
    });
  });

  describe("archived-cohort roster guard (TPO-2 closure audit)", () => {
    it("addStudentToCohort returns { archived: true } for an archived cohort, without ever calling CohortMembership/User", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId, status: "archived" }));

      const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "student@example.edu");

      expect(result).toEqual({ archived: true });
      expect(User.findOne).not.toHaveBeenCalled();
      expect(CohortMembership.findOne).not.toHaveBeenCalled();
      expect(CohortMembership.create).not.toHaveBeenCalled();
    });

    it("addStudentToCohort proceeds normally for a non-archived (active) cohort", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult({ _id: cohortId, collegeId, status: "active" }));
      User.findOne.mockResolvedValueOnce(null);
      CohortMembership.findOne.mockReturnValueOnce(findOneResult(null));
      CohortMembership.create.mockResolvedValueOnce({
        toObject: () => rawMembership({ status: "invited", invitedAt: new Date() }),
      });

      const result = await addStudentToCohort(cohortId.toString(), collegeId, addedBy, "student@example.edu");

      expect(result.created).toBe(true);
    });
  });
});

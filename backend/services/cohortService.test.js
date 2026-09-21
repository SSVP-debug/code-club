import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/Cohort.js", () => ({
  default: { find: vi.fn(), findOne: vi.fn(), create: vi.fn(), countDocuments: vi.fn() },
}));

import mongoose from "mongoose";
import Cohort from "../models/Cohort.js";
import {
  listCohorts,
  createCohort,
  getCohortForCollege,
  updateCohort,
  archiveCohort,
  isCohortValidationError,
  formatCohortValidationError,
} from "./cohortService.js";

const collegeId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const cohortId = new mongoose.Types.ObjectId();

function rawCohort(overrides = {}) {
  return {
    _id: cohortId,
    collegeId,
    name: "CSE 2027",
    academicYear: "2024-2025",
    graduatingYear: 2027,
    branch: "Computer Science",
    section: null,
    expectedHeadcount: null,
    status: "active",
    createdBy: userId,
    archivedAt: null,
    archivedBy: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

/** A findOne() result that's awaitable directly (mimics `await
 * Cohort.findOne(...)` returning a mutable Document with .save()) AND
 * has a .lean() method attached (mimics `Cohort.findOne(...).lean()`
 * resolving a plain object) — real Mongoose Query objects support both
 * usages; this mock mirrors that instead of forcing every call site to
 * use the same shape. */
function findOneResult(data) {
  if (!data) {
    const promise = Promise.resolve(null);
    promise.lean = () => Promise.resolve(null);
    return promise;
  }
  const doc = {
    ...data,
    save: vi.fn(async function () {
      return doc;
    }),
    toObject() {
      const { save: _save, toObject: _toObject, ...plain } = doc;
      return plain;
    },
  };
  const promise = Promise.resolve(doc);
  promise.lean = () => Promise.resolve({ ...data });
  return promise;
}

function findChain(items) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(items),
  };
}

describe("cohortService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listCohorts", () => {
    it("scopes the query to the given collegeId", async () => {
      Cohort.find.mockReturnValueOnce(findChain([rawCohort()]));
      Cohort.countDocuments.mockResolvedValueOnce(1);

      await listCohorts(collegeId, {});

      expect(Cohort.find).toHaveBeenCalledWith(expect.objectContaining({ collegeId }));
      expect(Cohort.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ collegeId }));
    });

    it("returns the exact list-view field set — no collegeId/createdBy/archivedAt/archivedBy", async () => {
      Cohort.find.mockReturnValueOnce(findChain([rawCohort()]));
      Cohort.countDocuments.mockResolvedValueOnce(1);

      const { items } = await listCohorts(collegeId, {});

      expect(Object.keys(items[0]).sort()).toEqual(
        ["id", "name", "academicYear", "graduatingYear", "branch", "section", "expectedHeadcount", "status", "createdAt", "updatedAt"].sort()
      );
    });

    it("applies status/graduatingYear/branch filters when given", async () => {
      Cohort.find.mockReturnValueOnce(findChain([]));
      Cohort.countDocuments.mockResolvedValueOnce(0);

      await listCohorts(collegeId, { status: "archived", graduatingYear: 2027, branch: "CSE" });

      expect(Cohort.find).toHaveBeenCalledWith(
        expect.objectContaining({ collegeId, status: "archived", graduatingYear: 2027, branch: "CSE" })
      );
    });

    it("omits status/graduatingYear/branch from the query entirely when not given (no default filter)", async () => {
      Cohort.find.mockReturnValueOnce(findChain([]));
      Cohort.countDocuments.mockResolvedValueOnce(0);

      await listCohorts(collegeId, {});

      const queryArg = Cohort.find.mock.calls[0][0];
      expect(queryArg).not.toHaveProperty("status");
      expect(queryArg).not.toHaveProperty("graduatingYear");
      expect(queryArg).not.toHaveProperty("branch");
    });

    it("builds a case-insensitive, regex-escaped search on name", async () => {
      Cohort.find.mockReturnValueOnce(findChain([]));
      Cohort.countDocuments.mockResolvedValueOnce(0);

      await listCohorts(collegeId, { search: "cse (2027)" });

      const queryArg = Cohort.find.mock.calls[0][0];
      expect(queryArg.name.$options).toBe("i");
      expect(queryArg.name.$regex).toBe("cse \\(2027\\)");
    });

    it("paginates with the given page/limit and returns total/page/limit", async () => {
      const chain = findChain([rawCohort()]);
      Cohort.find.mockReturnValueOnce(chain);
      Cohort.countDocuments.mockResolvedValueOnce(1);

      const result = await listCohorts(collegeId, { page: 2, limit: 10 });

      expect(chain.skip).toHaveBeenCalledWith(10); // (page-1)*limit
      expect(chain.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual(expect.objectContaining({ total: 1, page: 2, limit: 10 }));
    });
  });

  describe("createCohort", () => {
    it("stores collegeId and createdBy from the given (authenticated) context, not from the body", async () => {
      const created = { ...rawCohort(), toObject() { return rawCohort(); } };
      Cohort.create.mockResolvedValueOnce(created);

      await createCohort(collegeId, userId, {
        name: "CSE 2027", academicYear: "2024-2025", graduatingYear: 2027, branch: "CSE",
        collegeId: "attacker-supplied-college-id", // must never be used
        createdBy: "attacker-supplied-user-id",     // must never be used
      });

      expect(Cohort.create).toHaveBeenCalledWith(
        expect.objectContaining({ collegeId, createdBy: userId })
      );
    });

    it("always creates as active with null archivedAt/archivedBy, regardless of body content", async () => {
      const created = { ...rawCohort(), toObject() { return rawCohort(); } };
      Cohort.create.mockResolvedValueOnce(created);

      await createCohort(collegeId, userId, {
        name: "CSE 2027", academicYear: "2024-2025", graduatingYear: 2027, branch: "CSE",
        status: "archived", archivedAt: new Date(), archivedBy: "someone",
      });

      expect(Cohort.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active", archivedAt: null, archivedBy: null })
      );
    });

    it("passes through only the editable fields from the body", async () => {
      const created = { ...rawCohort(), toObject() { return rawCohort(); } };
      Cohort.create.mockResolvedValueOnce(created);

      await createCohort(collegeId, userId, {
        name: "CSE 2027", academicYear: "2024-2025", graduatingYear: 2027, branch: "CSE",
        section: "A", expectedHeadcount: 60,
        someUnknownField: "should be dropped",
      });

      const createArg = Cohort.create.mock.calls[0][0];
      expect(createArg).not.toHaveProperty("someUnknownField");
      expect(createArg.section).toBe("A");
      expect(createArg.expectedHeadcount).toBe(60);
    });

    it("propagates a Mongoose ValidationError to the caller", async () => {
      const err = Object.assign(new Error("validation failed"), { name: "ValidationError" });
      Cohort.create.mockRejectedValueOnce(err);

      await expect(createCohort(collegeId, userId, {})).rejects.toBe(err);
    });
  });

  describe("getCohortForCollege", () => {
    it("returns { invalidId: true } for a malformed id, without querying", async () => {
      const result = await getCohortForCollege("not-an-object-id", collegeId);
      expect(result).toEqual({ invalidId: true });
      expect(Cohort.findOne).not.toHaveBeenCalled();
    });

    it("scopes the lookup to (cohortId, collegeId) together", async () => {
      Cohort.findOne.mockReturnValueOnce(findOneResult(rawCohort()));

      await getCohortForCollege(cohortId.toString(), collegeId);

      expect(Cohort.findOne).toHaveBeenCalledWith({ _id: cohortId.toString(), collegeId });
    });

    it("returns null (not a 403-shaped error) when no cohort matches — same shape whether it doesn't exist or belongs to another college", async () => {
      Cohort.findOne.mockReturnValueOnce(findOneResult(null));

      const result = await getCohortForCollege(cohortId.toString(), collegeId);

      expect(result).toBeNull();
    });

    it("returns the serialized cohort (with archivedAt/archivedBy) when found", async () => {
      Cohort.findOne.mockReturnValueOnce(findOneResult(rawCohort()));

      const result = await getCohortForCollege(cohortId.toString(), collegeId);

      expect(result).toEqual(expect.objectContaining({ id: cohortId.toString(), archivedAt: null, archivedBy: null }));
    });
  });

  describe("updateCohort", () => {
    it("returns { invalidId: true } for a malformed id, without querying", async () => {
      const result = await updateCohort("not-an-object-id", collegeId, { name: "New name" });
      expect(result).toEqual({ invalidId: true });
      expect(Cohort.findOne).not.toHaveBeenCalled();
    });

    it("returns null when the cohort doesn't exist in this institution", async () => {
      Cohort.findOne.mockReturnValueOnce(findOneResult(null));
      const result = await updateCohort(cohortId.toString(), collegeId, { name: "New name" });
      expect(result).toBeNull();
    });

    it("applies only editable fields and saves", async () => {
      const doc = findOneResult(rawCohort());
      Cohort.findOne.mockReturnValueOnce(doc);
      const resolved = await doc;

      await updateCohort(cohortId.toString(), collegeId, { name: "New Name", section: "B" });

      expect(resolved.name).toBe("New Name");
      expect(resolved.section).toBe("B");
      expect(resolved.save).toHaveBeenCalledOnce();
    });

    it("ignores collegeId/createdBy/status/archivedAt/archivedBy even if present in the body", async () => {
      const doc = findOneResult(rawCohort());
      Cohort.findOne.mockReturnValueOnce(doc);
      const resolved = await doc;
      const originalCollegeId = resolved.collegeId;
      const originalCreatedBy = resolved.createdBy;
      const originalStatus = resolved.status;

      await updateCohort(cohortId.toString(), collegeId, {
        name: "New Name",
        collegeId: "attacker-college-id",
        createdBy: "attacker-user-id",
        status: "archived",
        archivedAt: new Date(),
        archivedBy: "attacker-user-id",
      });

      expect(resolved.collegeId).toBe(originalCollegeId);
      expect(resolved.createdBy).toBe(originalCreatedBy);
      expect(resolved.status).toBe(originalStatus);
    });

    it("propagates a Mongoose ValidationError from save()", async () => {
      const doc = findOneResult(rawCohort());
      Cohort.findOne.mockReturnValueOnce(doc);
      const resolved = await doc;
      const err = Object.assign(new Error("bad"), { name: "ValidationError" });
      resolved.save = vi.fn().mockRejectedValueOnce(err);

      await expect(updateCohort(cohortId.toString(), collegeId, { name: "" })).rejects.toBe(err);
    });
  });

  describe("archiveCohort", () => {
    it("returns { invalidId: true } for a malformed id, without querying", async () => {
      const result = await archiveCohort("not-an-object-id", collegeId, userId);
      expect(result).toEqual({ invalidId: true });
      expect(Cohort.findOne).not.toHaveBeenCalled();
    });

    it("returns null when the cohort doesn't exist in this institution", async () => {
      Cohort.findOne.mockReturnValueOnce(findOneResult(null));
      const result = await archiveCohort(cohortId.toString(), collegeId, userId);
      expect(result).toBeNull();
    });

    it("archives an active cohort: sets status/archivedAt/archivedBy and saves", async () => {
      const doc = findOneResult(rawCohort({ status: "active" }));
      Cohort.findOne.mockReturnValueOnce(doc);
      const resolved = await doc;

      const result = await archiveCohort(cohortId.toString(), collegeId, userId);

      expect(resolved.status).toBe("archived");
      expect(resolved.archivedAt).toBeInstanceOf(Date);
      expect(resolved.archivedBy).toBe(userId);
      expect(resolved.save).toHaveBeenCalledOnce();
      expect(result.alreadyArchived).toBe(false);
    });

    it("archiving an already-archived cohort is idempotent: no-op, no save, reports alreadyArchived", async () => {
      const originalArchivedAt = new Date("2024-01-01");
      const originalArchivedBy = new mongoose.Types.ObjectId();
      const doc = findOneResult(rawCohort({ status: "archived", archivedAt: originalArchivedAt, archivedBy: originalArchivedBy }));
      Cohort.findOne.mockReturnValueOnce(doc);
      const resolved = await doc;

      const differentActor = new mongoose.Types.ObjectId();
      const result = await archiveCohort(cohortId.toString(), collegeId, differentActor);

      // Original archive metadata is untouched — a second archive call
      // never re-stamps it with the new call's actor/timestamp.
      expect(resolved.archivedAt).toBe(originalArchivedAt);
      expect(resolved.archivedBy).toBe(originalArchivedBy);
      expect(resolved.save).not.toHaveBeenCalled();
      expect(result.alreadyArchived).toBe(true);
      expect(result.cohort.archivedBy).toBe(originalArchivedBy.toString());
    });

    it("scopes the lookup to (cohortId, collegeId) together — cannot archive another institution's cohort", async () => {
      Cohort.findOne.mockReturnValueOnce(findOneResult(null));

      await archiveCohort(cohortId.toString(), collegeId, userId);

      expect(Cohort.findOne).toHaveBeenCalledWith({ _id: cohortId.toString(), collegeId });
    });
  });

  describe("validation error helpers", () => {
    it("isCohortValidationError recognizes ValidationError and CastError", () => {
      expect(isCohortValidationError({ name: "ValidationError" })).toBe(true);
      expect(isCohortValidationError({ name: "CastError" })).toBe(true);
      expect(isCohortValidationError({ name: "MongoServerError" })).toBe(false);
    });

    it("formatCohortValidationError joins ValidationError field messages", () => {
      const err = {
        name: "ValidationError",
        errors: {
          name: { message: "name is required." },
          graduatingYear: { message: "graduatingYear must be a four-digit year." },
        },
      };
      const message = formatCohortValidationError(err);
      expect(message).toContain("name is required.");
      expect(message).toContain("graduatingYear must be a four-digit year.");
    });

    it("formatCohortValidationError reports the field for a CastError without leaking internals", () => {
      const err = { name: "CastError", path: "graduatingYear", message: "Cast to Number failed for value \"abc\"" };
      const message = formatCohortValidationError(err);
      expect(message).toBe('Invalid value for field "graduatingYear".');
      expect(message).not.toContain("Cast to Number failed");
    });
  });
});
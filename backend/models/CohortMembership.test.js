import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import CohortMembership from "./CohortMembership.js";

function baseDoc(overrides = {}) {
  return new CohortMembership({
    cohortId: new mongoose.Types.ObjectId(),
    collegeId: new mongoose.Types.ObjectId(),
    email: "student@example.edu",
    addedBy: new mongoose.Types.ObjectId(),
    ...overrides,
  });
}

describe("CohortMembership model", () => {
  it("validates successfully with all required fields present", () => {
    const err = baseDoc().validateSync();
    expect(err).toBeUndefined();
  });

  describe("required fields", () => {
    it("rejects a missing cohortId", () => {
      const err = baseDoc({ cohortId: undefined }).validateSync();
      expect(err.errors.cohortId).toBeDefined();
    });

    it("rejects a missing collegeId", () => {
      const err = baseDoc({ collegeId: undefined }).validateSync();
      expect(err.errors.collegeId).toBeDefined();
    });

    it("rejects a missing email", () => {
      const err = baseDoc({ email: undefined }).validateSync();
      expect(err.errors.email).toBeDefined();
    });

    it("rejects a missing addedBy", () => {
      const err = baseDoc({ addedBy: undefined }).validateSync();
      expect(err.errors.addedBy).toBeDefined();
    });

    it("does NOT require studentId", () => {
      const err = baseDoc({ studentId: undefined }).validateSync();
      expect(err).toBeUndefined();
    });
  });

  describe("status", () => {
    it("defaults to invited", () => {
      const doc = baseDoc();
      expect(doc.status).toBe("invited");
    });

    it("accepts invited", () => {
      const err = baseDoc({ status: "invited" }).validateSync();
      expect(err).toBeUndefined();
    });

    it("accepts active", () => {
      const err = baseDoc({ status: "active" }).validateSync();
      expect(err).toBeUndefined();
    });

    it("accepts removed", () => {
      const err = baseDoc({ status: "removed" }).validateSync();
      expect(err).toBeUndefined();
    });

    it("rejects an invalid status", () => {
      const err = baseDoc({ status: "pending" }).validateSync();
      expect(err.errors.status).toBeDefined();
    });

    it("rejects any status outside invited/active/removed, even a plausible-sounding one", () => {
      const err = baseDoc({ status: "accepted" }).validateSync();
      expect(err.errors.status).toBeDefined();
    });
  });

  describe("email normalization", () => {
    it("trims surrounding whitespace", () => {
      const doc = baseDoc({ email: "  student@example.edu  " });
      expect(doc.email).toBe("student@example.edu");
    });

    it("lowercases the value", () => {
      const doc = baseDoc({ email: "Student@Example.EDU" });
      expect(doc.email).toBe("student@example.edu");
    });

    it("normalizes mixed-case and surrounding whitespace together", () => {
      const doc = baseDoc({ email: "  STUDENT@Example.Edu  " });
      expect(doc.email).toBe("student@example.edu");
    });

    it("rejects a whitespace-only email", () => {
      const err = baseDoc({ email: "   " }).validateSync();
      expect(err.errors.email).toBeDefined();
    });

    it("accepts a normal valid email", () => {
      const err = baseDoc({ email: "jane.doe@college.ac.in" }).validateSync();
      expect(err).toBeUndefined();
    });

    it("does not reject a malformed (but non-empty) email — format validation is a service/import-layer concern", () => {
      const err = baseDoc({ email: "not-a-real-email" }).validateSync();
      expect(err).toBeUndefined();
    });
  });

  describe("optional fields can be null/omitted", () => {
    it("studentId", () => {
      const doc = baseDoc();
      expect(doc.studentId).toBeNull();
    });

    it("invitedAt", () => {
      const doc = baseDoc();
      expect(doc.invitedAt).toBeNull();
    });

    it("joinedAt", () => {
      const doc = baseDoc();
      expect(doc.joinedAt).toBeNull();
    });

    it("removedAt", () => {
      const doc = baseDoc();
      expect(doc.removedAt).toBeNull();
    });

    it("importBatchId", () => {
      const doc = baseDoc();
      expect(doc.importBatchId).toBeNull();
    });

    it("explicitly supplying null for each optional field still validates", () => {
      const err = baseDoc({
        studentId: null,
        invitedAt: null,
        joinedAt: null,
        removedAt: null,
        importBatchId: null,
      }).validateSync();
      expect(err).toBeUndefined();
    });
  });

  describe("references", () => {
    it("cohortId refs Cohort", () => {
      expect(CohortMembership.schema.path("cohortId").instance).toBe("ObjectId");
      expect(CohortMembership.schema.path("cohortId").options.ref).toBe("Cohort");
    });

    it("studentId refs User", () => {
      expect(CohortMembership.schema.path("studentId").instance).toBe("ObjectId");
      expect(CohortMembership.schema.path("studentId").options.ref).toBe("User");
    });

    it("collegeId refs College", () => {
      expect(CohortMembership.schema.path("collegeId").instance).toBe("ObjectId");
      expect(CohortMembership.schema.path("collegeId").options.ref).toBe("College");
    });

    it("addedBy refs User", () => {
      expect(CohortMembership.schema.path("addedBy").instance).toBe("ObjectId");
      expect(CohortMembership.schema.path("addedBy").options.ref).toBe("User");
    });

    it("importBatchId is a bare ObjectId with no ref (no ImportBatch model exists)", () => {
      const path = CohortMembership.schema.path("importBatchId");
      expect(path.instance).toBe("ObjectId");
      expect(path.options.ref).toBeUndefined();
    });
  });

  describe("valid documents", () => {
    it("an invited membership without studentId is valid", () => {
      const err = baseDoc({ status: "invited", studentId: null }).validateSync();
      expect(err).toBeUndefined();
    });

    it("an active membership with studentId is valid", () => {
      const err = baseDoc({ status: "active", studentId: new mongoose.Types.ObjectId() }).validateSync();
      expect(err).toBeUndefined();
    });

    it("a removed membership with studentId is valid", () => {
      const err = baseDoc({ status: "removed", studentId: new mongoose.Types.ObjectId() }).validateSync();
      expect(err).toBeUndefined();
    });
  });

  describe("no lifecycle enforcement in the schema", () => {
    it("does not reject active status with joinedAt left null", () => {
      const err = baseDoc({ status: "active", joinedAt: null }).validateSync();
      expect(err).toBeUndefined();
    });

    it("does not reject removed status with removedAt left null", () => {
      const err = baseDoc({ status: "removed", removedAt: null }).validateSync();
      expect(err).toBeUndefined();
    });

    it("does not reject invited status with invitedAt left null", () => {
      const err = baseDoc({ status: "invited", invitedAt: null }).validateSync();
      expect(err).toBeUndefined();
    });

    it("does not require studentId to be set just because status is active", () => {
      const err = baseDoc({ status: "active", studentId: null }).validateSync();
      expect(err).toBeUndefined();
    });
  });
});
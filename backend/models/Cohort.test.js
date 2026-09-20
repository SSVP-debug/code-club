import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import Cohort from "./Cohort.js";

function baseDoc(overrides = {}) {
  return new Cohort({
    collegeId: new mongoose.Types.ObjectId(),
    name: "CSE 2027",
    academicYear: "2024-2025",
    graduatingYear: 2027,
    branch: "Computer Science",
    createdBy: new mongoose.Types.ObjectId(),
    ...overrides,
  });
}

describe("Cohort model", () => {
  it("validates successfully with all required fields present", () => {
    const doc = baseDoc();
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  describe("required fields", () => {
    it("rejects a missing collegeId", () => {
      const err = baseDoc({ collegeId: undefined }).validateSync();
      expect(err.errors.collegeId).toBeDefined();
    });

    it("rejects a missing name", () => {
      const err = baseDoc({ name: undefined }).validateSync();
      expect(err.errors.name).toBeDefined();
    });

    it("rejects a missing academicYear", () => {
      const err = baseDoc({ academicYear: undefined }).validateSync();
      expect(err.errors.academicYear).toBeDefined();
    });

    it("rejects a missing graduatingYear", () => {
      const err = baseDoc({ graduatingYear: undefined }).validateSync();
      expect(err.errors.graduatingYear).toBeDefined();
    });

    it("rejects a missing branch", () => {
      const err = baseDoc({ branch: undefined }).validateSync();
      expect(err.errors.branch).toBeDefined();
    });

    it("rejects a missing createdBy", () => {
      const err = baseDoc({ createdBy: undefined }).validateSync();
      expect(err.errors.createdBy).toBeDefined();
    });
  });

  describe("validation", () => {
    it("rejects an empty name", () => {
      const err = baseDoc({ name: "" }).validateSync();
      expect(err.errors.name).toBeDefined();
    });

    it("rejects a whitespace-only name", () => {
      const err = baseDoc({ name: "   " }).validateSync();
      expect(err.errors.name).toBeDefined();
    });

    it("trims a name with surrounding whitespace", () => {
      const doc = baseDoc({ name: "  CSE 2027  " });
      expect(doc.name).toBe("CSE 2027");
    });

    it("rejects a name over the maximum length", () => {
      const err = baseDoc({ name: "x".repeat(121) }).validateSync();
      expect(err.errors.name).toBeDefined();
    });

    it("rejects an empty academicYear", () => {
      const err = baseDoc({ academicYear: "" }).validateSync();
      expect(err.errors.academicYear).toBeDefined();
    });

    it("rejects a whitespace-only academicYear", () => {
      const err = baseDoc({ academicYear: "   " }).validateSync();
      expect(err.errors.academicYear).toBeDefined();
    });

    it("rejects a non-integer graduatingYear", () => {
      const err = baseDoc({ graduatingYear: 2027.5 }).validateSync();
      expect(err.errors.graduatingYear).toBeDefined();
    });

    it("rejects a graduatingYear that isn't a sensible four-digit year (too low)", () => {
      const err = baseDoc({ graduatingYear: 42 }).validateSync();
      expect(err.errors.graduatingYear).toBeDefined();
    });

    it("rejects a graduatingYear that isn't a sensible four-digit year (too high)", () => {
      const err = baseDoc({ graduatingYear: 99999 }).validateSync();
      expect(err.errors.graduatingYear).toBeDefined();
    });

    it("accepts graduatingYear values well outside any narrow 'current year' window (no artificial narrow range)", () => {
      expect(baseDoc({ graduatingYear: 1995 }).validateSync()).toBeUndefined();
      expect(baseDoc({ graduatingYear: 2099 }).validateSync()).toBeUndefined();
    });

    it("rejects an empty branch", () => {
      const err = baseDoc({ branch: "" }).validateSync();
      expect(err.errors.branch).toBeDefined();
    });

    it("rejects a whitespace-only branch", () => {
      const err = baseDoc({ branch: "   " }).validateSync();
      expect(err.errors.branch).toBeDefined();
    });

    it("rejects a non-integer expectedHeadcount", () => {
      const err = baseDoc({ expectedHeadcount: 60.5 }).validateSync();
      expect(err.errors.expectedHeadcount).toBeDefined();
    });

    it("rejects a negative expectedHeadcount", () => {
      const err = baseDoc({ expectedHeadcount: -1 }).validateSync();
      expect(err.errors.expectedHeadcount).toBeDefined();
    });

    it("accepts a zero expectedHeadcount", () => {
      const err = baseDoc({ expectedHeadcount: 0 }).validateSync();
      expect(err).toBeUndefined();
    });

    it("accepts a valid positive integer expectedHeadcount", () => {
      const err = baseDoc({ expectedHeadcount: 60 }).validateSync();
      expect(err).toBeUndefined();
    });

    it("rejects an invalid status value", () => {
      const err = baseDoc({ status: "not-a-real-status" }).validateSync();
      expect(err.errors.status).toBeDefined();
    });

    it("accepts the archived status", () => {
      const err = baseDoc({ status: "archived" }).validateSync();
      expect(err).toBeUndefined();
    });
  });

  describe("section", () => {
    it("is null when not supplied", () => {
      const doc = baseDoc();
      expect(doc.section).toBeNull();
    });

    it("trims a supplied section", () => {
      const doc = baseDoc({ section: "  A  " });
      expect(doc.section).toBe("A");
    });

    it("normalizes a whitespace-only section to null rather than storing a meaningless empty string", () => {
      const doc = baseDoc({ section: "   " });
      expect(doc.section).toBeNull();
    });

    it("normalizes an empty-string section to null", () => {
      const doc = baseDoc({ section: "" });
      expect(doc.section).toBeNull();
    });
  });

  describe("defaults", () => {
    it("status defaults to active", () => {
      const doc = baseDoc();
      expect(doc.status).toBe("active");
    });

    it("archivedAt defaults to null", () => {
      const doc = baseDoc();
      expect(doc.archivedAt).toBeNull();
    });

    it("archivedBy defaults to null", () => {
      const doc = baseDoc();
      expect(doc.archivedBy).toBeNull();
    });

    it("expectedHeadcount defaults to null", () => {
      const doc = baseDoc();
      expect(doc.expectedHeadcount).toBeNull();
    });
  });

  describe("no authorization logic in the schema", () => {
    it("allows constructing an archived cohort directly, with no schema-level gate on who set that status", () => {
      const doc = baseDoc({
        status: "archived",
        archivedAt: new Date(),
        archivedBy: new mongoose.Types.ObjectId(),
      });
      const err = doc.validateSync();
      expect(err).toBeUndefined();
    });

    it("does not enforce archivedAt/archivedBy being set whenever status is archived — that consistency rule is a later service-layer concern, not a schema constraint", () => {
      const doc = baseDoc({ status: "archived" }); // archivedAt/archivedBy left at their null defaults
      const err = doc.validateSync();
      expect(err).toBeUndefined();
    });

    it("does not reject an active cohort that still has archivedAt/archivedBy set — the schema doesn't police that cross-field invariant either", () => {
      const doc = baseDoc({
        status: "active",
        archivedAt: new Date(),
        archivedBy: new mongoose.Types.ObjectId(),
      });
      const err = doc.validateSync();
      expect(err).toBeUndefined();
    });
  });
});
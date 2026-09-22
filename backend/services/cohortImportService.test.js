import { describe, expect, it, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Cohort.js", () => ({
  default: { findOne: vi.fn() },
}));
vi.mock("./cohortMembershipService.js", () => ({
  upsertCohortMembership: vi.fn(),
}));

import Cohort from "../models/Cohort.js";
import { upsertCohortMembership } from "./cohortMembershipService.js";
import {
  importCohortRoster,
  detectDisallowedBinarySignature,
  IMPORT_MAX_FILE_SIZE_BYTES,
  IMPORT_MAX_ROWS,
} from "./cohortImportService.js";

function leanResult(value) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function csv(rows) {
  return Buffer.from(rows.map((r) => r.join(",")).join("\n"), "utf8");
}

const cohortId = new mongoose.Types.ObjectId();
const collegeId = new mongoose.Types.ObjectId();
const addedBy = new mongoose.Types.ObjectId();
const cohort = { _id: cohortId, collegeId };

beforeEach(() => {
  vi.clearAllMocks();
  Cohort.findOne.mockReturnValue(leanResult(cohort));
});

describe("importCohortRoster", () => {
  describe("cohort resolution", () => {
    it("returns { invalidId: true } for a malformed cohortId, without touching Cohort", async () => {
      const result = await importCohortRoster("not-an-id", collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result).toEqual({ invalidId: true });
      expect(Cohort.findOne).not.toHaveBeenCalled();
    });

    it("returns null when the cohort isn't found in this institution", async () => {
      Cohort.findOne.mockReturnValueOnce(leanResult(null));
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result).toBeNull();
    });

    it("scopes the cohort lookup to (cohortId, collegeId) together", async () => {
      await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(Cohort.findOne).toHaveBeenCalledWith({ _id: cohortId.toString(), collegeId });
    });
  });

  describe("file validation", () => {
    it("rejects an empty file", async () => {
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, Buffer.alloc(0));
      expect(result).toEqual({ fileError: expect.any(String), reasonCode: "empty_file" });
      expect(upsertCohortMembership).not.toHaveBeenCalled();
    });

    it("rejects a null/undefined buffer as empty", async () => {
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, undefined);
      expect(result).toEqual({ fileError: expect.any(String), reasonCode: "empty_file" });
    });

    it("rejects a file over the size limit", async () => {
      const big = Buffer.alloc(IMPORT_MAX_FILE_SIZE_BYTES + 1, "a");
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, big);
      expect(result).toEqual({ fileError: expect.any(String), reasonCode: "file_too_large" });
      expect(upsertCohortMembership).not.toHaveBeenCalled();
    });

    it("rejects a CSV exceeding the row limit, before writing anything", async () => {
      const rows = [["email"]];
      for (let i = 0; i < IMPORT_MAX_ROWS + 1; i += 1) rows.push([`student${i}@example.edu`]);
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv(rows));
      expect(result).toEqual({ fileError: expect.any(String), reasonCode: "too_many_rows" });
      expect(upsertCohortMembership).not.toHaveBeenCalled();
    });

    it("rejects malformed CSV syntax (unterminated quote)", async () => {
      const malformed = Buffer.from('email\n"student@example.edu\n', "utf8");
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, malformed);
      expect(result).toEqual({ fileError: expect.any(String), reasonCode: "malformed_csv" });
      expect(upsertCohortMembership).not.toHaveBeenCalled();
    });

    it("rejects a CSV with no email column, before processing any row", async () => {
      const result = await importCohortRoster(
        cohortId.toString(), collegeId, addedBy, csv([["name", "branch"], ["Jane", "CS"]])
      );
      expect(result).toEqual({ fileError: expect.any(String), reasonCode: "missing_email_column" });
      expect(upsertCohortMembership).not.toHaveBeenCalled();
    });

    it("rejects a header-only CSV (no data rows) as empty", async () => {
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"]]));
      expect(result).toEqual({ fileError: expect.any(String), reasonCode: "empty_file" });
    });

    it("rejects content that looks like an XLSX file even with correct extension-level intent (zip signature)", () => {
      const xlsxLike = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      expect(detectDisallowedBinarySignature(xlsxLike)).toMatch(/zip/i);
    });

    it("rejects PDF content via magic-byte sniffing", async () => {
      const pdfLike = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(20)]);
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, pdfLike);
      expect(result).toEqual({ fileError: expect.any(String), reasonCode: "invalid_file_type" });
      expect(upsertCohortMembership).not.toHaveBeenCalled();
    });

    it("detectDisallowedBinarySignature returns null for plain CSV text", () => {
      expect(detectDisallowedBinarySignature(csv([["email"], ["a@b.com"]]))).toBeNull();
    });
  });

  describe("header matching", () => {
    it.each(["email", "Email", "EMAIL", " email ", " Email  "])(
      "matches a case-insensitive, whitespace-trimmed email header: %j",
      async (header) => {
        upsertCohortMembership.mockResolvedValue({ created: true, membership: { membershipStatus: "invited" } });
        const result = await importCohortRoster(
          cohortId.toString(), collegeId, addedBy, csv([[header], ["student@example.edu"]])
        );
        expect(result.fileError).toBeUndefined();
        expect(upsertCohortMembership).toHaveBeenCalledTimes(1);
      }
    );
  });

  describe("row normalization", () => {
    it("normalizes a normal email as-is", async () => {
      upsertCohortMembership.mockResolvedValue({ created: true, membership: { membershipStatus: "invited" } });
      const result = await importCohortRoster(
        cohortId.toString(), collegeId, addedBy, csv([["email"], ["student@example.edu"]])
      );
      expect(upsertCohortMembership).toHaveBeenCalledWith(cohort, collegeId, addedBy, "student@example.edu", expect.anything());
      expect(result.rows[0]).toEqual(expect.objectContaining({ row: 2, email: "student@example.edu" }));
    });

    it("lowercases an uppercase email", async () => {
      upsertCohortMembership.mockResolvedValue({ created: true, membership: { membershipStatus: "invited" } });
      await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["Student@College.EDU"]]));
      expect(upsertCohortMembership).toHaveBeenCalledWith(cohort, collegeId, addedBy, "student@college.edu", expect.anything());
    });

    it("trims a whitespace-padded email", async () => {
      upsertCohortMembership.mockResolvedValue({ created: true, membership: { membershipStatus: "invited" } });
      await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], [" student@example.edu "]]));
      expect(upsertCohortMembership).toHaveBeenCalledWith(cohort, collegeId, addedBy, "student@example.edu", expect.anything());
    });

    it("marks a blank email as an invalid_email error row without calling the membership service", async () => {
      // A row that's blank ONLY in the email column, not an empty CSV
      // line (which skip_empty_lines would drop before it ever reaches
      // row normalization).
      const result = await importCohortRoster(
        cohortId.toString(), collegeId, addedBy, csv([["email", "name"], ["", "Jane"]])
      );
      expect(result.rows[0]).toEqual({ row: 2, email: "", status: "error", reason: "invalid_email" });
      expect(upsertCohortMembership).not.toHaveBeenCalled();
    });

    it("marks a malformed email as an invalid_email error row without calling the membership service", async () => {
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["not-an-email"]]));
      expect(result.rows[0]).toEqual({ row: 2, email: "not-an-email", status: "error", reason: "invalid_email" });
      expect(upsertCohortMembership).not.toHaveBeenCalled();
    });
  });

  describe("duplicate rows within the same CSV", () => {
    it("processes the first occurrence and marks later occurrences duplicate, without a second write", async () => {
      upsertCohortMembership.mockResolvedValue({ created: true, membership: { membershipStatus: "invited" } });
      const result = await importCohortRoster(
        cohortId.toString(), collegeId, addedBy,
        csv([["email"], ["student@example.edu"], ["STUDENT@example.edu"], ["student@example.edu"]])
      );

      expect(upsertCohortMembership).toHaveBeenCalledTimes(1);
      expect(result.rows[0]).toEqual(expect.objectContaining({ row: 2, status: "invited" }));
      expect(result.rows[1]).toEqual({ row: 3, email: "student@example.edu", status: "duplicate", firstRow: 2 });
      expect(result.rows[2]).toEqual({ row: 4, email: "student@example.edu", status: "duplicate", firstRow: 2 });
      expect(result.summary.duplicates).toBe(2);
      expect(result.summary.totalRows).toBe(3);
    });

    it("does not treat an intra-file duplicate as an error", async () => {
      upsertCohortMembership.mockResolvedValue({ created: true, membership: { membershipStatus: "invited" } });
      const result = await importCohortRoster(
        cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"], ["a@b.com"]])
      );
      expect(result.summary.errors).toBe(0);
    });
  });

  describe("mapping upsertCohortMembership outcomes to row results", () => {
    it("maps a newly-created active membership to status active", async () => {
      upsertCohortMembership.mockResolvedValueOnce({ created: true, membership: { membershipStatus: "active" } });
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result.rows[0].status).toBe("active");
      expect(result.summary.active).toBe(1);
    });

    it("maps a newly-created unmatched membership to status invited", async () => {
      upsertCohortMembership.mockResolvedValueOnce({ created: true, membership: { membershipStatus: "invited" } });
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result.rows[0].status).toBe("invited");
      expect(result.summary.invited).toBe(1);
    });

    it("maps an invited→active transition to status active", async () => {
      upsertCohortMembership.mockResolvedValueOnce({
        created: false, noop: false, previousStatus: "invited", membership: { membershipStatus: "active" },
      });
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result.rows[0].status).toBe("active");
    });

    it("maps a removed→active transition to status active", async () => {
      upsertCohortMembership.mockResolvedValueOnce({
        created: false, noop: false, previousStatus: "removed", membership: { membershipStatus: "active" },
      });
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result.rows[0].status).toBe("active");
    });

    it("maps a removed→invited transition to status invited", async () => {
      upsertCohortMembership.mockResolvedValueOnce({
        created: false, noop: false, previousStatus: "removed", membership: { membershipStatus: "invited" },
      });
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result.rows[0].status).toBe("invited");
    });

    it("maps an already-active conflict to status already_member, not an error", async () => {
      upsertCohortMembership.mockResolvedValueOnce({ conflict: true, reasonCode: "already_member", membership: {} });
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result.rows[0].status).toBe("already_member");
      expect(result.summary.alreadyMember).toBe(1);
      expect(result.summary.errors).toBe(0);
    });

    it("maps a foreign-college rejection to a non-sensitive error row", async () => {
      upsertCohortMembership.mockResolvedValueOnce({
        validationError: "This account belongs to a different institution.", reasonCode: "foreign_college",
      });
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result.rows[0]).toEqual({ row: 2, email: "a@b.com", status: "error", reason: "foreign_college" });
      expect(result.summary.errors).toBe(1);
    });

    it("maps an unlinked-account (legacy, no collegeId) rejection the same way Step 5 does", async () => {
      upsertCohortMembership.mockResolvedValueOnce({
        validationError: "This account hasn't been linked to an institution yet.", reasonCode: "unlinked_account",
      });
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result.rows[0]).toEqual({ row: 2, email: "a@b.com", status: "error", reason: "unlinked_account" });
    });
  });

  describe("partial success", () => {
    it("returns row-level results for a mixed CSV: valid, invited, duplicate, invalid, foreign-college", async () => {
      upsertCohortMembership.mockImplementation((c, collId, addedByArg, email) => {
        if (email === "active@example.edu") return Promise.resolve({ created: true, membership: { membershipStatus: "active" } });
        if (email === "invited@example.edu") return Promise.resolve({ created: true, membership: { membershipStatus: "invited" } });
        if (email === "foreign@example.edu") {
          return Promise.resolve({ validationError: "different institution", reasonCode: "foreign_college" });
        }
        return Promise.reject(new Error(`unexpected email in test: ${email}`));
      });

      const result = await importCohortRoster(
        cohortId.toString(), collegeId, addedBy,
        csv([
          ["email"],
          ["active@example.edu"],
          ["invited@example.edu"],
          ["invited@example.edu"], // duplicate of the row above
          ["bad-email"], // invalid
          ["foreign@example.edu"],
        ])
      );

      expect(result.rows).toHaveLength(5);
      expect(result.rows.map((r) => r.status)).toEqual(["active", "invited", "duplicate", "error", "error"]);
      expect(result.summary).toEqual({
        totalRows: 5, processed: 2, active: 1, invited: 1, alreadyMember: 0, duplicates: 1, errors: 2,
      });
    });
  });

  describe("concurrency / duplicate-key races", () => {
    it("retries once on a duplicate-key error and succeeds if the retry resolves cleanly", async () => {
      const dupErr = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
      upsertCohortMembership
        .mockRejectedValueOnce(dupErr)
        .mockResolvedValueOnce({ conflict: true, reasonCode: "already_member", membership: {} });

      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));

      expect(upsertCohortMembership).toHaveBeenCalledTimes(2);
      expect(result.rows[0].status).toBe("already_member");
      expect(result.summary.errors).toBe(0);
    });

    it("returns a row-level internal_error (never a thrown exception) if the retry also fails", async () => {
      const dupErr = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
      upsertCohortMembership.mockRejectedValue(dupErr);

      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));

      expect(result.rows[0]).toEqual({ row: 2, email: "a@b.com", status: "error", reason: "internal_error" });
    });

    it("returns a row-level internal_error for a non-duplicate-key failure, without exposing the raw error", async () => {
      upsertCohortMembership.mockRejectedValueOnce(new Error("connection reset by peer, stack trace here"));
      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"]]));
      expect(result.rows[0]).toEqual({ row: 2, email: "a@b.com", status: "error", reason: "internal_error" });
    });
  });

  describe("idempotency", () => {
    it("running the same CSV a second time reports already_member instead of creating anything new", async () => {
      upsertCohortMembership.mockResolvedValue({ created: true, membership: { membershipStatus: "active" } });
      const file = csv([["email"], ["a@b.com"], ["b@b.com"]]);

      const first = await importCohortRoster(cohortId.toString(), collegeId, addedBy, file);
      expect(first.summary.active).toBe(2);

      upsertCohortMembership.mockClear();
      upsertCohortMembership.mockResolvedValue({ conflict: true, reasonCode: "already_member", membership: {} });

      const second = await importCohortRoster(cohortId.toString(), collegeId, addedBy, file);
      expect(second.summary.alreadyMember).toBe(2);
      expect(second.summary.active).toBe(0);
    });
  });

  describe("importBatchId", () => {
    it("returns a batch ID and stamps every call to upsertCohortMembership with the same one", async () => {
      upsertCohortMembership.mockResolvedValue({ created: true, membership: { membershipStatus: "invited" } });
      const result = await importCohortRoster(
        cohortId.toString(), collegeId, addedBy, csv([["email"], ["a@b.com"], ["b@b.com"]])
      );

      expect(typeof result.importBatchId).toBe("string");
      const batchIdsUsed = upsertCohortMembership.mock.calls.map((call) => call[4]);
      expect(batchIdsUsed[0].toString()).toBe(result.importBatchId);
      expect(batchIdsUsed[1].toString()).toBe(result.importBatchId);
    });
  });

  describe("batched concurrency", () => {
    it("processes a large CSV without an unbounded single Promise.all (bounded concurrency observed)", async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      upsertCohortMembership.mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return { created: true, membership: { membershipStatus: "invited" } };
      });

      const rows = [["email"]];
      for (let i = 0; i < 47; i += 1) rows.push([`student${i}@example.edu`]);

      const result = await importCohortRoster(cohortId.toString(), collegeId, addedBy, csv(rows));

      expect(result.summary.processed).toBe(47);
      expect(maxInFlight).toBeLessThanOrEqual(10);
      expect(maxInFlight).toBeGreaterThan(1); // actually batched, not fully serial either
    });
  });
});

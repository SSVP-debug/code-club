import mongoose from "mongoose";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import Cohort from "../models/Cohort.js";
import { upsertCohortMembership } from "./cohortMembershipService.js";

/**
 * cohortImportService.js — CSV roster import (TPO-2 Step 6).
 *
 * Institution-boundary contract identical to cohortMembershipService.js's
 * own header: every function here takes an already-resolved `collegeId`
 * and trusts it completely. Authorization/institution-resolution is
 * entirely routes/tpo.js's `resolveTpoInstitution` middleware's job,
 * exactly as for add/remove — this file doesn't implement a second
 * mechanism.
 *
 * Membership-writing is NOT duplicated here. Every row that reaches the
 * database goes through cohortMembershipService.js's
 * `upsertCohortMembership()` — the exact same matching/transition
 * decision tree `addStudentToCohort()` (the single-add endpoint) uses —
 * so the two entry points can never silently diverge in behavior. This
 * file's own job is strictly: parse the file, validate it, normalize
 * and de-duplicate rows, then call that shared function per logical row
 * with a bounded concurrency and a shared importBatchId.
 *
 * CSV parsing: `csv-parse` (the `sync` entry point), not a hand-rolled
 * `split(",")`. It's the de facto standard Node CSV library — small,
 * dependency-light, actively maintained — and, critically, handles real
 * CSV quoting/escaping correctly (a quoted field containing a comma or a
 * literal quote) where a naive split would silently corrupt data. The
 * sync API is intentionally used, not the streaming one: the file-size
 * cap below already bounds this to a small, fully-buffered upload, so
 * streaming would add complexity (see this step's own "don't
 * over-engineer this" instruction) without a real memory-safety benefit
 * at this size.
 */

// ── File-level limits (Section 3 / 18) ──────────────────────────────────
// 2 MB comfortably covers a realistic college roster: even a CSV with
// several extra columns per row (name, branch, phone, ...) runs well
// under 200 bytes/row, so 2 MB holds 10,000+ rows — matching the row cap
// below — while still bounding a single request's memory footprint to
// something trivial for a Node process.
export const IMPORT_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

// Independent of the byte cap — a pathological single-column CSV could
// otherwise fit far more than a realistic roster within 2 MB. 10,000 data
// rows is comfortably above any single college's active student count
// while keeping one import's total DB round-trips bounded.
export const IMPORT_MAX_ROWS = 10000;

// Batched/bounded concurrency for the per-row membership writes (Section
// 14) — never an unbounded Promise.all across the whole file. 10 was
// picked as a small, conservative concurrency: cohort imports are an
// infrequent, TPO-initiated bulk operation, not a hot path, so there's no
// reason to push it higher and risk connection-pool pressure alongside
// the rest of the app's normal traffic.
export const IMPORT_CONCURRENCY = 10;

const emailFormatSchema = z.string().email();

// ── Content-based file-type check (Section 3) ───────────────────────────
// Deliberately in addition to, not instead of, the extension check in
// csvUpload's fileFilter below — "do not trust only the filename
// extension." A handful of magic-byte signatures catch the realistic
// mis-upload cases (XLSX/DOCX and other ZIP-based Office formats, legacy
// XLS/OLE files, PDFs, common image formats) even if the file was renamed
// to end in .csv.
const BINARY_SIGNATURES = [
  { bytes: [0x50, 0x4b, 0x03, 0x04], label: "a ZIP-based file (e.g. .xlsx/.docx)" },
  { bytes: [0x50, 0x4b, 0x05, 0x06], label: "a ZIP-based file (e.g. .xlsx/.docx)" },
  { bytes: [0xd0, 0xcf, 0x11, 0xe0], label: "a legacy Office file (e.g. .xls)" },
  { bytes: [0x25, 0x50, 0x44, 0x46], label: "a PDF file" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], label: "a PNG image" },
  { bytes: [0xff, 0xd8, 0xff], label: "a JPEG image" },
  { bytes: [0x47, 0x49, 0x46, 0x38], label: "a GIF image" },
];

export function detectDisallowedBinarySignature(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  for (const { bytes, label } of BINARY_SIGNATURES) {
    if (buffer.length >= bytes.length && bytes.every((b, i) => buffer[i] === b)) {
      return label;
    }
  }
  return null;
}

/** Case-insensitive, whitespace-trimmed "email" header match (Section 4). */
function findEmailColumnIndex(header) {
  if (!Array.isArray(header)) return -1;
  return header.findIndex((cell) => typeof cell === "string" && cell.trim().toLowerCase() === "email");
}

function parseCsvRaw(buffer) {
  try {
    // bom: true strips a leading UTF-8 BOM (common from Excel "Save As
    // CSV UTF-8") before the header match, so a BOM-prefixed "email"
    // header isn't silently missed. relax_column_count: true keeps one
    // ragged row (too few/many columns vs. the header) from rejecting
    // the entire file — malformed-CSV-syntax cases (bad quoting) still
    // throw regardless of this option, which is what "malformed CSV"
    // means for the file-level rejection below.
    const records = parse(buffer, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: false,
    });
    return { records };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Normalizes and de-duplicates every data row up front (Sections 5/6),
 * before any database call. Returns one entry per data row, in order:
 *   { row, email, status: "pending" }                       — ready to process
 *   { row, email, status: "error", reason: "invalid_email" } — empty/malformed
 *   { row, email, status: "duplicate", firstRow }            — repeat of an earlier row's email
 * `row` is the 1-indexed CSV line number (header is row 1, so the first
 * data row is row 2) — matches what a TPO would see opening the file in
 * a spreadsheet app.
 */
function normalizeRows(dataRows, emailColIndex) {
  const seen = new Map();
  return dataRows.map((record, i) => {
    const rowNumber = i + 2;
    const rawValue = record?.[emailColIndex];
    const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
    const email = trimmed.toLowerCase();

    if (!email || !emailFormatSchema.safeParse(email).success) {
      return { row: rowNumber, email: trimmed, status: "error", reason: "invalid_email" };
    }
    if (seen.has(email)) {
      return { row: rowNumber, email, status: "duplicate", firstRow: seen.get(email) };
    }
    seen.set(email, rowNumber);
    return { row: rowNumber, email, status: "pending" };
  });
}

function isDuplicateKeyError(err) {
  return Boolean(err) && (err.code === 11000 || err.code === "11000");
}

function mapOutcomeToRowResult(row, outcome) {
  if (outcome?.validationError) {
    return { row: row.row, email: row.email, status: "error", reason: outcome.reasonCode || "invalid" };
  }
  if (outcome?.conflict) {
    return { row: row.row, email: row.email, status: "already_member" };
  }
  const membershipStatus = outcome?.membership?.membershipStatus;
  return { row: row.row, email: row.email, status: membershipStatus === "active" ? "active" : "invited" };
}

/**
 * Runs one normalized "pending" row through the shared membership
 * decision tree. Section 13's concurrency requirement: two overlapping
 * imports (or an import racing a manual add) can both reach
 * upsertCohortMembership for the same (cohortId, email) between its own
 * findOne and create/save — the unique index is the actual safety net,
 * and a resulting duplicate-key error is caught here and resolved by
 * re-running the same decision tree once more (which will now find the
 * row the other request just wrote, and take the update/no-op path
 * instead of attempting a second create). Never surfaces a raw DB error
 * to the caller — an unresolvable failure becomes a row-level
 * "internal_error", not a thrown exception that would fail the whole
 * import.
 */
async function processRow(cohort, collegeId, addedBy, row, importBatchId) {
  try {
    const outcome = await upsertCohortMembership(cohort, collegeId, addedBy, row.email, importBatchId);
    return mapOutcomeToRowResult(row, outcome);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      try {
        const retryOutcome = await upsertCohortMembership(cohort, collegeId, addedBy, row.email, importBatchId);
        return mapOutcomeToRowResult(row, retryOutcome);
      } catch {
        return { row: row.row, email: row.email, status: "error", reason: "internal_error" };
      }
    }
    return { row: row.row, email: row.email, status: "error", reason: "internal_error" };
  }
}

function buildSummary(results) {
  const summary = {
    totalRows: results.length,
    processed: 0,
    active: 0,
    invited: 0,
    alreadyMember: 0,
    duplicates: 0,
    errors: 0,
  };
  for (const r of results) {
    if (r.status === "active") {
      summary.active += 1;
      summary.processed += 1;
    } else if (r.status === "invited") {
      summary.invited += 1;
      summary.processed += 1;
    } else if (r.status === "already_member") {
      summary.alreadyMember += 1;
      summary.processed += 1;
    } else if (r.status === "duplicate") {
      summary.duplicates += 1;
    } else if (r.status === "error") {
      summary.errors += 1;
    }
  }
  return summary;
}

/**
 * Imports a CSV roster into an existing cohort. See this file's header
 * for the reuse/authorization/concurrency contracts.
 *
 * Returns one of:
 *   { invalidId: true }                — malformed cohortId
 *   null                                — cohort not found in this institution
 *   { fileError: string, reasonCode }   — file rejected before any row was processed
 *   { importBatchId, summary, rows }    — partial-success import result (Section 11)
 *
 * fileError reasonCode values: "empty_file", "file_too_large",
 * "invalid_file_type", "malformed_csv", "missing_email_column",
 * "too_many_rows". These are FILE-level rejections — nothing is written
 * to the database for any of them, per Section 4's "do not partially
 * write an import whose schema is fundamentally invalid."
 */
export async function importCohortRoster(cohortId, collegeId, addedBy, fileBuffer) {
  if (!mongoose.isValidObjectId(cohortId)) {
    return { invalidId: true };
  }

  const cohort = await Cohort.findOne({ _id: cohortId, collegeId }).lean();
  if (!cohort) return null;

  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    return { fileError: "The uploaded CSV file is empty.", reasonCode: "empty_file" };
  }
  if (fileBuffer.length > IMPORT_MAX_FILE_SIZE_BYTES) {
    return {
      fileError: `The CSV file exceeds the ${Math.floor(IMPORT_MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB size limit.`,
      reasonCode: "file_too_large",
    };
  }

  const disallowedType = detectDisallowedBinarySignature(fileBuffer);
  if (disallowedType) {
    return {
      fileError: `The uploaded file does not look like a CSV (detected ${disallowedType}).`,
      reasonCode: "invalid_file_type",
    };
  }

  const parsed = parseCsvRaw(fileBuffer);
  if (parsed.error) {
    return {
      fileError: "The CSV file could not be parsed. Check for malformed rows or unescaped quotes.",
      reasonCode: "malformed_csv",
    };
  }

  const records = parsed.records || [];
  if (records.length === 0) {
    return { fileError: "The uploaded CSV file is empty.", reasonCode: "empty_file" };
  }

  const header = records[0];
  const emailColIndex = findEmailColumnIndex(header);
  if (emailColIndex === -1) {
    return { fileError: "The CSV must include an 'email' column.", reasonCode: "missing_email_column" };
  }

  const dataRows = records.slice(1);
  if (dataRows.length === 0) {
    return { fileError: "The uploaded CSV file has no data rows.", reasonCode: "empty_file" };
  }
  if (dataRows.length > IMPORT_MAX_ROWS) {
    return {
      fileError: `The CSV exceeds the ${IMPORT_MAX_ROWS}-row limit.`,
      reasonCode: "too_many_rows",
    };
  }

  const normalized = normalizeRows(dataRows, emailColIndex);
  const importBatchId = new mongoose.Types.ObjectId();

  const results = new Array(normalized.length);
  const pendingIndexes = [];
  normalized.forEach((row, idx) => {
    if (row.status === "pending") {
      pendingIndexes.push(idx);
    } else {
      results[idx] = row;
    }
  });

  // Controlled batches, not one giant Promise.all (Section 14) — and no
  // MongoDB transaction wrapping any of this (Section 14's own "this is
  // a partial-success import workflow" instruction).
  for (let i = 0; i < pendingIndexes.length; i += IMPORT_CONCURRENCY) {
    const batch = pendingIndexes.slice(i, i + IMPORT_CONCURRENCY);
    await Promise.all(
      batch.map(async (idx) => {
        results[idx] = await processRow(cohort, collegeId, addedBy, normalized[idx], importBatchId);
      })
    );
  }

  return {
    importBatchId: importBatchId.toString(),
    summary: buildSummary(results),
    rows: results,
  };
}

import mongoose from "mongoose";
import Cohort from "../models/Cohort.js";

/**
 * cohortService.js — Cohort CRUD business logic (TPO-2 Step 4).
 *
 * Every function here takes an already-resolved `collegeId` as a plain
 * parameter — never re-derives or trusts one from a request. Institution
 * resolution (including the admin-override / "never trust a client
 * collegeId for a normal TPO" rule) is entirely routes/tpo.js's
 * `resolveTpoInstitution` middleware's job, reusing the hardened TPO-1
 * `resolveTpoTeamContext` — this file is the layer below that boundary,
 * the same separation tpoTeamService.js's `listTeam(college)` already
 * established (it takes a resolved College doc, not a request).
 *
 * No caching here — see routes/tpo.js's cohort route comments for why
 * this step deliberately leaves cohort reads uncached.
 */

const EDITABLE_FIELDS = ["name", "academicYear", "graduatingYear", "branch", "section", "expectedHeadcount"];

/** Picks only the client-editable fields out of a request body, ignoring
 * everything else (collegeId/createdBy/status/archivedAt/archivedBy
 * included) — the allowlist itself is what makes those fields non-
 * client-controllable, not a rejection check. */
function pickEditableFields(body) {
  const picked = {};
  for (const key of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      picked[key] = body[key];
    }
  }
  return picked;
}

/** Formats a Mongoose ValidationError/CastError into a single clean,
 * client-safe message — reuses the model's own validator messages
 * (Cohort.js) as the single source of truth for what "invalid" means,
 * rather than duplicating field-by-field checks here. Never leaks raw
 * Mongoose/DB internals beyond a field name. */
export function formatCohortValidationError(err) {
  if (err.name === "ValidationError") {
    return Object.values(err.errors)
      .map((e) => e.message)
      .join(" ");
  }
  if (err.name === "CastError") {
    return `Invalid value for field "${err.path}".`;
  }
  return "Invalid input.";
}

export function isCohortValidationError(err) {
  return err.name === "ValidationError" || err.name === "CastError";
}

/**
 * Lists cohorts for a resolved institution, with optional filters.
 * Server-side paginated, same normalized page/limit shape GET /students
 * already uses (routes/tpo.js).
 */
export async function listCohorts(collegeId, { status, graduatingYear, branch, search, page = 1, limit = 25 } = {}) {
  const query = { collegeId };
  if (status) query.status = status;
  if (graduatingYear !== undefined && graduatingYear !== null) query.graduatingYear = graduatingYear;
  if (branch) query.branch = branch;
  if (search) {
    // Same regex-escaping approach as GET /students' `q` filter
    // (routes/tpo.js) — a search term containing regex metacharacters is
    // treated literally, not as a pattern.
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.name = { $regex: escaped, $options: "i" };
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Cohort.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Cohort.countDocuments(query),
  ]);

  return { items: items.map(serializeCohortSummary), total, page, limit };
}

/** Creates a cohort for a resolved institution. Throws a Mongoose
 * ValidationError/CastError on invalid input — callers should check
 * isCohortValidationError()/formatCohortValidationError(). */
export async function createCohort(collegeId, createdBy, body) {
  const doc = await Cohort.create({
    ...pickEditableFields(body),
    collegeId,
    createdBy,
    // Explicit even though these match the schema defaults — this is
    // the one place in the codebase that's authoritative about "a newly
    // created cohort is always active, never pre-archived," so it's
    // stated here rather than left to the schema's default alone.
    status: "active",
    archivedAt: null,
    archivedBy: null,
  });
  return serializeCohort(doc.toObject());
}

/**
 * Fetches a single cohort by id, scoped to a resolved institution.
 * Returns null for BOTH "no such cohort" and "cohort belongs to another
 * institution" — the same shape, so callers can 404 without ever
 * revealing which case it was (per TPO-2 Step 4's explicit "must not
 * leak information" instruction). Returns `{ invalidId: true }` for a
 * syntactically malformed id, distinguishable from `null` so callers can
 * 400 instead of 404 for that specific, unambiguous-to-report case.
 */
export async function getCohortForCollege(cohortId, collegeId) {
  if (!mongoose.isValidObjectId(cohortId)) {
    return { invalidId: true };
  }
  const cohort = await Cohort.findOne({ _id: cohortId, collegeId }).lean();
  return cohort ? serializeCohort(cohort) : null;
}

/**
 * Updates only the editable fields of a cohort, scoped to a resolved
 * institution. Re-fetches as a live Document (not .lean()) and saves —
 * not findOneAndUpdate — so Mongoose re-validates the WHOLE document on
 * write, the model staying the single source of truth for validity, not
 * just the fields being changed this call.
 *
 * Returns `{ invalidId: true }` for a malformed id, `null` if no such
 * cohort exists in this institution (same non-leaking shape as
 * getCohortForCollege), or the updated, serialized cohort.
 */
export async function updateCohort(cohortId, collegeId, body) {
  if (!mongoose.isValidObjectId(cohortId)) {
    return { invalidId: true };
  }
  const cohort = await Cohort.findOne({ _id: cohortId, collegeId });
  if (!cohort) return null;

  const editable = pickEditableFields(body);
  for (const [key, value] of Object.entries(editable)) {
    cohort[key] = value;
  }
  await cohort.save();
  return serializeCohort(cohort.toObject());
}

/**
 * Archives a cohort, scoped to a resolved institution. Idempotent by
 * design (TPO-2 Step 4's explicit requirement): archiving an
 * already-archived cohort is a no-op that returns the cohort's current,
 * ORIGINAL archive state unchanged — it does not overwrite archivedAt/
 * archivedBy with the new call's timestamp/actor, and does not error.
 * A second archive attempt reports `alreadyArchived: true` alongside the
 * (unchanged) cohort so callers can tell idempotent-no-op apart from
 * first-time-archived, without that distinction needing to be an error.
 */
export async function archiveCohort(cohortId, collegeId, archivedBy) {
  if (!mongoose.isValidObjectId(cohortId)) {
    return { invalidId: true };
  }
  const cohort = await Cohort.findOne({ _id: cohortId, collegeId });
  if (!cohort) return null;

  if (cohort.status === "archived") {
    return { cohort: serializeCohort(cohort.toObject()), alreadyArchived: true };
  }

  cohort.status = "archived";
  cohort.archivedAt = new Date();
  cohort.archivedBy = archivedBy;
  await cohort.save();
  return { cohort: serializeCohort(cohort.toObject()), alreadyArchived: false };
}

/** The list-view field set TPO-2 Step 4 specifies exactly — no
 * collegeId/createdBy/archivedAt/archivedBy (they're real, stored, and
 * verified directly against the database in tests — see the Data
 * Integrity tests — just not part of the list response contract for
 * this step). No actual student headcount either — that's
 * CohortMembership's job, a later TPO-2 step. */
function serializeCohortSummary(cohort) {
  return {
    id: cohort._id.toString(),
    name: cohort.name,
    academicYear: cohort.academicYear,
    graduatingYear: cohort.graduatingYear,
    branch: cohort.branch,
    section: cohort.section,
    expectedHeadcount: cohort.expectedHeadcount,
    status: cohort.status,
    createdAt: cohort.createdAt,
    updatedAt: cohort.updatedAt,
  };
}

/** The single-cohort response shape (get/create/update/archive) — the
 * summary fields plus archivedAt/archivedBy, since those two are the
 * entire point of the archive endpoint's response (confirming the
 * archive actually happened, and when/by whom) even though the list
 * view doesn't carry them. */
function serializeCohort(cohort) {
  return {
    ...serializeCohortSummary(cohort),
    archivedAt: cohort.archivedAt,
    archivedBy: cohort.archivedBy ? cohort.archivedBy.toString() : null,
  };
}
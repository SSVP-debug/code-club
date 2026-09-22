import mongoose from "mongoose";
import Cohort from "../models/Cohort.js";
import CohortMembership from "../models/CohortMembership.js";
import User from "../models/User.js";
import { isCohortValidationError, formatCohortValidationError } from "./cohortService.js";

/**
 * cohortMembershipService.js — Cohort roster/membership business logic
 * (TPO-2 Step 5).
 *
 * Same institution-boundary contract as cohortService.js: every function
 * takes an already-resolved `collegeId` and trusts it completely — it
 * never re-derives or re-validates institution membership from a
 * request. That resolution (including the admin-override rule) is
 * entirely routes/tpo.js's `resolveTpoInstitution` middleware's job,
 * reused as-is from TPO-2 Step 4/the hardened TPO-1 work — this file
 * does not implement a second authorization mechanism.
 *
 * No caching here — same deliberate decision as cohortService.js's
 * cohort reads, extended to roster reads: membership state changes via
 * add/remove (and, later, CSV import) are exactly the kind of frequently
 * -mutated, correctness-sensitive data this codebase's own TPO-1
 * hardening pass had to go back and fix real staleness/invalidation bugs
 * for. Not caching avoids reintroducing that class of bug for a
 * genuinely low-volume per-institution query.
 */

export { isCohortValidationError, formatCohortValidationError };

const ROSTER_STATUSES = ["invited", "active", "removed"];

const ROSTER_SORT_FIELDS = {
  // Client sort key → Mongo $sort spec, explicit allowlist (same
  // reasoning as routes/tpo.js's STUDENT_SORT_FIELDS: req.query.sort is
  // never passed into $sort directly). _id is always the tiebreaker so
  // paging stays stable across requests. "name" sorts on the joined
  // student's displayName — rows with no matched student (invited, never
  // matched) sort consistently to one end via Mongo's normal
  // missing-field-sorts-as-null behavior, not an error.
  name: { "student.displayName": 1, _id: 1 },
  email: { email: 1, _id: 1 },
  joinedAt: { joinedAt: -1, _id: 1 },
  createdAt: { createdAt: -1, _id: 1 },
  status: { status: 1, _id: 1 },
};

/**
 * Institution-scoped roster for a cohort — pagination/search/sort
 * shaped to match GET /api/tpo/students exactly (same defaults, same
 * response envelope), per this step's explicit "do not create an
 * unnecessarily different pagination contract."
 *
 * Default status filter: "active" — chosen to match the existing
 * /students directory's implicit convention of showing "the students
 * who are actually here" by default, rather than surfacing invited/
 * removed rows unasked. Pass an explicit `status` to see the others.
 */
export async function getCohortRoster(cohortId, collegeId, {
  status = "active",
  search,
  sort = "createdAt",
  page = 1,
  limit = 25,
} = {}) {
  if (!mongoose.isValidObjectId(cohortId)) {
    return { invalidId: true };
  }

  // Never trust the cohort id alone — it must resolve within THIS
  // institution before any membership row is even considered.
  const cohort = await Cohort.findOne({ _id: cohortId, collegeId }).lean();
  if (!cohort) return null;

  const cohortObjectId = new mongoose.Types.ObjectId(cohortId);
  const baseMatch = { cohortId: cohortObjectId, collegeId };
  const listMatch = { ...baseMatch };
  if (ROSTER_STATUSES.includes(status)) {
    listMatch.status = status;
  }

  const searchStage = [];
  if (typeof search === "string" && search.trim()) {
    // Same regex-escaping approach as GET /students' `q` filter — a
    // search term containing regex metacharacters is treated literally.
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    searchStage.push({
      $match: {
        $or: [
          { email: { $regex: escaped, $options: "i" } },
          { "student.displayName": { $regex: escaped, $options: "i" } },
          { "student.email": { $regex: escaped, $options: "i" } },
        ],
      },
    });
  }

  const sortSpec = ROSTER_SORT_FIELDS[sort] || ROSTER_SORT_FIELDS.createdAt;
  const skip = (page - 1) * limit;

  // Two separate aggregations, deliberately — the paginated/filtered/
  // searched list, and the cohort-wide status counts. Combining them
  // into one $facet would have the counts see only whatever `status`
  // the list itself is already filtered to (since $facet's sub-
  // pipelines run on whatever reached it, after the outer $match) —
  // the counts need to reflect the WHOLE cohort's composition
  // regardless of the current list filter/search, so they're computed
  // from `baseMatch` alone, independently.
  const [listResult, statusCounts] = await Promise.all([
    CohortMembership.aggregate([
      { $match: listMatch },
      // Joined only to search/sort/display the matched student's own
      // name — the $project below is the only place fields actually
      // leave this pipeline, and it whitelists exactly two fields off
      // `student` (displayName, email for search), never the raw
      // document (no password/token/internal auth fields ever reach
      // the response).
      { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "student" } },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      ...searchStage,
      { $sort: sortSpec },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                membershipId: "$_id",
                studentId: 1,
                name: { $ifNull: ["$student.displayName", null] },
                email: 1,
                membershipStatus: "$status",
                invitedAt: 1,
                joinedAt: 1,
                removedAt: 1,
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ]),
    CohortMembership.aggregate([
      { $match: baseMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const result = listResult?.[0];
  const counts = { activeCount: 0, invitedCount: 0, removedCount: 0 };
  for (const { _id: statusKey, count } of statusCounts) {
    if (statusKey === "active") counts.activeCount = count;
    else if (statusKey === "invited") counts.invitedCount = count;
    else if (statusKey === "removed") counts.removedCount = count;
  }

  return {
    students: (result?.data ?? []).map((row) => ({
      ...row,
      membershipId: row.membershipId.toString(),
      studentId: row.studentId ? row.studentId.toString() : null,
    })),
    total: result?.totalCount?.[0]?.count ?? 0,
    page,
    limit,
    counts,
  };
}

/**
 * Adds (or reactivates/promotes) a student in a cohort by email —
 * institution-scoped end to end. See this file's header for the
 * critical-institution-matching and existing-membership-handling
 * decisions; both are implemented here, not left to the route layer.
 *
 * Returns one of:
 *   { invalidId: true }                          — malformed cohortId
 *   null                                          — cohort not found in this institution
 *   { validationError: string }                   — bad email, foreign-institution match, or unlinked legacy account
 *   { conflict: true, membership }                — already an active member
 *   { membership, previousStatus, created, noop } — success (see below)
 *
 * `created: true` — a brand-new membership row.
 * `created: false, noop: true` — an already-"invited" row for an email
 *   that's still unmatched: nothing changed (idempotent re-add).
 * `created: false, noop: false` — an existing invited/removed row was
 *   (re)activated or reactivated back to invited (see the "removed, no
 *   match found" case below).
 *
 * Deliberately kept at 4 parameters — see this file's own
 * "signature only accepts email" test. The CSV import (TPO-2 Step 6)
 * needs to run this same decision tree hundreds/thousands of times per
 * request without re-resolving the Cohort document on every row, and
 * needs to stamp an importBatchId the single-add UI flow never has — so
 * the matching/transition logic below is factored into
 * upsertCohortMembership(), which takes an already-resolved cohort and
 * an optional importBatchId. This function is now a thin wrapper: it
 * still resolves and validates the cohort itself (so its own contract
 * to existing callers — including the { invalidId: true } / null
 * behavior — is completely unchanged), then delegates.
 */
export async function addStudentToCohort(cohortId, collegeId, addedBy, rawEmail) {
  if (!mongoose.isValidObjectId(cohortId)) {
    return { invalidId: true };
  }

  const cohort = await Cohort.findOne({ _id: cohortId, collegeId }).lean();
  if (!cohort) return null;

  return upsertCohortMembership(cohort, collegeId, addedBy, rawEmail);
}

/**
 * Shared membership decision tree (TPO-2 Step 5's matching + existing-
 * membership rules), factored out of addStudentToCohort so the CSV
 * import service (TPO-2 Step 6) can run it per-row without duplicating
 * it — see addStudentToCohort's own comment for why this split exists.
 *
 * Takes an already-resolved `cohort` (a plain object with at least
 * `_id`) rather than a cohortId, and an optional `importBatchId` to
 * stamp on any row this call creates or mutates. Every other behavior —
 * email normalization, institution matching, the invited/active/removed
 * transition table, the never-create-a-second-row guarantee — is
 * identical to what addStudentToCohort has always done; nothing here is
 * import-specific except the importBatchId stamp itself.
 *
 * Returns the exact same result shapes addStudentToCohort's own doc
 * comment describes, plus a `reasonCode` alongside `validationError` /
 * `conflict` so callers that need a machine-readable status (the import
 * service's per-row report) don't have to pattern-match error strings.
 * reasonCode values: "invalid_email", "unlinked_account",
 * "foreign_college", "already_member".
 */
export async function upsertCohortMembership(cohort, collegeId, addedBy, rawEmail, importBatchId = null) {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email) {
    return { validationError: "email is required.", reasonCode: "invalid_email" };
  }

  // ── Critical institution matching (TPO-2 Step 5, section 4) ──────────
  // An email existing in the database is not sufficient — the matched
  // account must belong to THIS institution via the canonical
  // education.collegeId relationship (TPO-2 Step 1), not re-derived from
  // emailDomain here (that would be a second, competing institution-
  // matching mechanism living alongside Step 1's canonical one).
  const user = await User.findOne({ email });
  if (user) {
    const userCollegeId = user.education?.collegeId;
    if (!userCollegeId) {
      // Legacy account with no collegeId yet, even after the Step 1
      // backfill (or created since, some other way, without one). Never
      // invent a match from emailDomain or any other heuristic here —
      // reject rather than risk an unsafe cross-institution
      // relationship. The canonical fix is running/re-running the Step
      // 1 backfill (backend/scripts/backfillStudentCollegeIds.js) or
      // having the student go through college verification, not a
      // live, ad hoc fallback in this request path.
      return {
        validationError: "This account hasn't been linked to an institution yet and can't be added to a cohort.",
        reasonCode: "unlinked_account",
      };
    }
    if (userCollegeId.toString() !== collegeId.toString()) {
      return { validationError: "This account belongs to a different institution.", reasonCode: "foreign_college" };
    }
  }

  const now = new Date();

  // ── Existing membership handling (TPO-2 Step 5, section 5) ───────────
  const existing = await CohortMembership.findOne({ cohortId: cohort._id, email });
  if (existing) {
    const previousStatus = existing.status;

    if (previousStatus === "active") {
      return { conflict: true, reasonCode: "already_member", membership: serializeMembership(existing.toObject()) };
    }

    const targetStatus = user ? "active" : "invited";

    if (previousStatus === "invited" && targetStatus === "invited") {
      // Still unmatched — nothing to change, idempotent re-add.
      return { membership: serializeMembership(existing.toObject()), previousStatus, created: false, noop: true };
    }

    // invited→active (newly matched), removed→active (matched), or
    // removed→invited (re-added but still unmatched) — all a deliberate
    // (re)activation, never a second row (the unique (cohortId, email)
    // index also guarantees this at the database level).
    existing.status = targetStatus;
    existing.studentId = user ? user._id : null;
    existing.removedAt = null;
    if (targetStatus === "active") {
      existing.joinedAt = now;
    } else if (!existing.invitedAt) {
      existing.invitedAt = now;
    }
    if (importBatchId) {
      existing.importBatchId = importBatchId;
    }

    await existing.save();
    return { membership: serializeMembership(existing.toObject()), previousStatus, created: false, noop: false };
  }

  // Brand-new membership row.
  const created = await CohortMembership.create({
    cohortId: cohort._id,
    collegeId,
    email,
    addedBy,
    studentId: user ? user._id : null,
    status: user ? "active" : "invited",
    joinedAt: user ? now : null,
    invitedAt: user ? null : now,
    importBatchId: importBatchId || null,
  });
  return { membership: serializeMembership(created.toObject()), created: true, noop: false };
}

/**
 * Soft-removes a membership — institution- and cohort-scoped together,
 * never just one or the other (a membershipId alone is not sufficient,
 * mirroring the same "never trust an id alone" rule as everything else
 * in this file). Idempotent, same pattern as cohortService.js's
 * archiveCohort: removing an already-removed membership is a no-op
 * success, not an error, and never re-stamps removedAt.
 *
 * Returns { invalidId: true }, null (not found in this cohort/
 * institution), or { membership, alreadyRemoved }.
 */
export async function removeCohortMembership(cohortId, membershipId, collegeId) {
  if (!mongoose.isValidObjectId(cohortId) || !mongoose.isValidObjectId(membershipId)) {
    return { invalidId: true };
  }

  const membership = await CohortMembership.findOne({ _id: membershipId, cohortId, collegeId });
  if (!membership) return null;

  if (membership.status === "removed") {
    return { membership: serializeMembership(membership.toObject()), alreadyRemoved: true };
  }

  membership.status = "removed";
  membership.removedAt = new Date();
  await membership.save();
  return { membership: serializeMembership(membership.toObject()), alreadyRemoved: false };
}

/** Detail-shaped serializer for add/remove responses (not the roster
 * list's per-row projection above, which is built directly in the
 * aggregation pipeline). No student name lookup here — add/remove
 * responses don't need it; the roster list is where a name is useful. */
function serializeMembership(membership) {
  return {
    membershipId: membership._id.toString(),
    studentId: membership.studentId ? membership.studentId.toString() : null,
    email: membership.email,
    membershipStatus: membership.status,
    invitedAt: membership.invitedAt,
    joinedAt: membership.joinedAt,
    removedAt: membership.removedAt,
  };
}
/**
 * backfillStudentCollegeIds.js
 *
 * One-time migration (TPO-2 Step 1 prerequisite): populates
 * `education.collegeId` on existing student accounts from their
 * `emailDomain`, for accounts that predate collegeAutoProvision.js.
 *
 * Why this is needed: services/collegeAutoProvision.js links every NEW
 * institutional-domain signup to a College record at account creation
 * (via middleware/auth.js), setting `education.collegeId`
 * automatically. That only runs once, at signup — it does nothing for
 * accounts created before auto-provisioning shipped. Those older
 * accounts can have a perfectly usable, already-institutional
 * `emailDomain` (models/User.js's emailDomain field — auto-derived from
 * `email` on every save, always populated) but
 * `education.collegeId: null`, exactly the gap TPO-2's Cohort/
 * CohortMembership model needs closed before it can rely on
 * `education.collegeId` as its canonical Student → College link (see
 * the TPO-2 architecture audit's "Migration Strategy" section).
 *
 * Domain resolution deliberately reuses the SAME logic the rest of the
 * app already uses, rather than a second implementation:
 *   - College.domains is the canonical, unique-indexed set of
 *     recognized domains per institution (models/College.js) — matched
 *     here via the same normalized (lowercased/trimmed) equality check
 *     College.js's own schema `set` transform and `findByDomain` static
 *     already apply (normalizeDomain below is that exact one-liner,
 *     kept local since College.js has no standalone export for just
 *     the normalization). College.findByDomain itself (a findOne) isn't
 *     reused directly — it can only ever report "one match or none,"
 *     and this script also needs to detect "matched more than one" as
 *     its own distinct, never-guess outcome (see "ambiguous" below),
 *     which findByDomain's shape can't express. The match criteria
 *     itself is identical either way.
 *   - isConsumerEmailDomain (utils/domainVerification.js) is reused
 *     as-is, unchanged — the same check collegeAutoProvision.js uses to
 *     decide a domain is never worth a College link in the first
 *     place, so a mis-created College record for a consumer domain
 *     can't silently link students to it here either.
 *
 * What this does NOT do, on purpose (mirrors backfillAuthorizedRoles.js's
 * and backfillEmailDomain.js's own "what this does not touch" sections):
 *   - Does not touch role, roles, email, emailDomain, XP, solvedSlugs,
 *     streaks, submissions, assignments, TPO data, or any other
 *     `education.*` field (collegeName/degree/branch/graduationYear/
 *     collegeEmail/emailVerified/emailVerifiedAt/collegeStatus/
 *     verifyToken/verifyTokenExpiresAt all stay exactly as they are).
 *     The write is a single targeted `$set` on `education.collegeId`
 *     only, via bulkWrite — not a full-document `.save()` — precisely
 *     so it is structurally incapable of carrying along any other
 *     field.
 *   - Does not create or modify any College document, and does not
 *     touch education.collegeStatus/emailVerified (the separate,
 *     opt-in student-verification flow in routes/collegeVerification.js
 *     — a different concept from "which College does this email domain
 *     belong to").
 *   - Never guesses. A domain matching zero or more than one College
 *     record is skipped and reported, not resolved by any heuristic.
 *
 * Idempotent / safe to re-run: only ever writes documents where
 * `education.collegeId` is still unset (the bulkWrite filter re-checks
 * this at write time, not just at read time, closing the gap where a
 * concurrent write between the read and the write could otherwise
 * clobber a value set in between — never write should still hold even
 * under a concurrent run). A second run finds nothing left to do for
 * previously-updated documents (they report as "Already linked") and
 * makes zero additional changes.
 *
 * Batched: writes go out in fixed-size bulkWrite chunks, not one giant
 * operation for the whole collection.
 *
 * Usage:
 *   cd backend
 *   node scripts/backfillStudentCollegeIds.js
 *
 * Add --dry-run to preview the report without writing to MongoDB:
 *   node scripts/backfillStudentCollegeIds.js --dry-run
 */

import "../config/env.js";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import College from "../models/College.js";
import { isConsumerEmailDomain } from "../utils/domainVerification.js";

const BATCH_SIZE = 500;

// Same normalization College.js's schema `set` transform and
// `findByDomain` static already apply.
export function normalizeDomain(domain) {
  return typeof domain === "string" && domain.trim() ? domain.toLowerCase().trim() : null;
}

/**
 * Core backfill logic, decoupled from Mongoose/a live database — same
 * "export testable core logic, keep the CLI thin" pattern as
 * scripts/migrateHiddenTestcaseSet.js's migrateHiddenTestcaseSetCollection.
 *
 * @param {Object} deps
 * @param {() => Promise<Array<{_id, emailDomain, education?: {collegeId?}}>>} deps.findCandidateStudents
 *   Returns every student-authorized user with a non-null emailDomain,
 *   projected to just `_id`, `emailDomain`, `education.collegeId`.
 * @param {(domains: string[]) => Promise<Array<{_id, domains: string[]}>>} deps.findCollegesByDomains
 *   Returns every College document whose `domains` array intersects the
 *   given (already-normalized) domain list, projected to `_id`/`domains`.
 * @param {(ops: Array<{studentId, collegeId}>) => Promise<number>} deps.bulkSetCollegeIds
 *   Applies a batch of `education.collegeId` sets (only for documents
 *   where it's still unset) and returns how many were actually modified.
 *   Not called at all when `dryRun` is true.
 * @param {(domain: string) => boolean} [deps.isConsumerDomain]
 * @param {boolean} [deps.dryRun]
 * @param {(msg: string) => void} [deps.log]
 * @param {number} [deps.batchSize]
 */
export async function backfillStudentCollegeIdsCore({
  findCandidateStudents,
  findCollegesByDomains,
  bulkSetCollegeIds,
  isConsumerDomain = isConsumerEmailDomain,
  dryRun = false,
  log = () => {},
  batchSize = BATCH_SIZE,
}) {
  const counts = {
    scanned: 0,
    eligible: 0,
    updated: 0,
    skippedNoMatch: 0,
    skippedAmbiguous: 0,
    alreadyLinked: 0,
    errors: 0,
  };

  const students = await findCandidateStudents();
  counts.scanned = students.length;

  // Classify every candidate first (cheap, in-memory) before doing any
  // College lookups or writes — separates "what should happen" from
  // "doing it," which is what makes the write phase safely batchable.
  const toResolve = [];
  for (const student of students) {
    if (student.education?.collegeId) {
      counts.alreadyLinked += 1;
      continue;
    }

    const domain = normalizeDomain(student.emailDomain);
    if (!domain || isConsumerDomain(domain)) {
      counts.skippedNoMatch += 1;
      continue;
    }

    toResolve.push({ studentId: student._id, domain });
  }

  if (toResolve.length > 0) {
    const distinctDomains = [...new Set(toResolve.map((r) => r.domain))];
    const colleges = await findCollegesByDomains(distinctDomains);

    // domain -> [collegeId, ...] — 0 matches = no College, 1 = eligible,
    // >1 = ambiguous. Built from actual query results, not assumed from
    // College's unique index alone: the index prevents new ambiguity
    // going forward, but this script must not assume every pre-existing
    // document already satisfies it.
    const domainToCollegeIds = new Map();
    for (const college of colleges) {
      for (const d of college.domains) {
        if (!distinctDomains.includes(d)) continue;
        const existing = domainToCollegeIds.get(d) || [];
        existing.push(college._id);
        domainToCollegeIds.set(d, existing);
      }
    }

    const eligibleOps = [];
    for (const { studentId, domain } of toResolve) {
      const matches = domainToCollegeIds.get(domain) || [];
      if (matches.length === 0) {
        counts.skippedNoMatch += 1;
      } else if (matches.length > 1) {
        counts.skippedAmbiguous += 1;
        log(
          `  ⚠ Ambiguous domain "${domain}" for student ${studentId} — matches ${matches.length} College records. Skipped.`
        );
      } else {
        counts.eligible += 1;
        eligibleOps.push({ studentId, collegeId: matches[0] });
      }
    }

    if (eligibleOps.length > 0) {
      if (dryRun) {
        counts.updated += eligibleOps.length; // "would update"
      } else {
        for (let i = 0; i < eligibleOps.length; i += batchSize) {
          const chunk = eligibleOps.slice(i, i + batchSize);
          try {
            const modifiedCount = await bulkSetCollegeIds(chunk);
            counts.updated += modifiedCount;
          } catch (err) {
            counts.errors += chunk.length;
            log(`  ✗ Batch write failed (${chunk.length} students affected): ${err.message}`);
          }
        }
      }
    }
  }

  return counts;
}

function printReport(counts, dryRun) {
  console.log(`\n${dryRun ? "Would report" : "Report"}:`);
  console.log(`Scanned: ${counts.scanned}`);
  console.log(`Eligible: ${counts.eligible}`);
  console.log(`Updated: ${counts.updated}`);
  console.log(`Skipped - no matching college: ${counts.skippedNoMatch}`);
  console.log(`Skipped - ambiguous college: ${counts.skippedAmbiguous}`);
  console.log(`Already linked: ${counts.alreadyLinked}`);
  console.log(`Errors: ${counts.errors}`);
}

/**
 * Wires backfillStudentCollegeIdsCore's three injected operations to real
 * Mongoose model calls. Deliberately has no connection-lifecycle side
 * effects of its own (no connectDB/disconnect) so it's reusable as-is
 * from both the CLI wrapper below (which owns the connection lifecycle
 * for a standalone `node scripts/...` run) and a real-Mongo integration
 * test (which owns its own connection via test/mongoMemoryServer.js,
 * the same way routes/tpoFlow.integration.test.js does) — sharing one
 * wiring implementation instead of the CLI and the integration test
 * each hand-rolling their own copy of these three queries.
 */
export function buildMongooseDeps({ dryRun = false, log = () => {} } = {}) {
  return {
    findCandidateStudents: () =>
      User.find(
        { $or: [{ role: "student" }, { roles: "student" }], emailDomain: { $exists: true, $ne: null } },
        "_id emailDomain education.collegeId"
      ).lean(),

    findCollegesByDomains: (domains) =>
      College.find({ domains: { $in: domains } }).select("_id domains").lean(),

    // Filter re-checks `education.collegeId` is still unset at write
    // time (not just at the earlier read) — belt-and-suspenders against
    // a concurrent process linking the same student in between this
    // script's read and write phases. ordered: false so one bad op in a
    // batch doesn't block the rest of that batch.
    bulkSetCollegeIds: async (ops) => {
      const result = await User.bulkWrite(
        ops.map(({ studentId, collegeId }) => ({
          updateOne: {
            filter: { _id: studentId, "education.collegeId": { $in: [null, undefined] } },
            update: { $set: { "education.collegeId": collegeId } },
          },
        })),
        { ordered: false }
      );
      return result.modifiedCount || 0;
    },

    dryRun,
    log,
  };
}

// ── CLI wrapper — thin: owns the connection lifecycle, delegates
// everything else to buildMongooseDeps() + backfillStudentCollegeIdsCore.
async function runBackfillStudentCollegeIds() {
  const dryRun = process.argv.includes("--dry-run");
  await connectDB();

  if (dryRun) {
    console.log("🔍 DRY RUN — no writes will occur\n");
  }

  const counts = await backfillStudentCollegeIdsCore(buildMongooseDeps({ dryRun, log: console.log }));

  printReport(counts, dryRun);
  if (dryRun) {
    console.log("\n🔍 DRY RUN complete — no changes were made.");
  }

  await mongoose.disconnect();
  return counts;
}

// Only auto-run when executed directly, not when imported by a test —
// same guard style migrateHiddenTestcaseSet.js uses.
if (import.meta.url === `file://${process.argv[1]}`) {
  runBackfillStudentCollegeIds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}

export { runBackfillStudentCollegeIds };
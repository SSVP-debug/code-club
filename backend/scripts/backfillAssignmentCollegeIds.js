/**
 * backfillAssignmentCollegeIds.js
 *
 * TPO-4 migration: populates the canonical collegeId on existing
 * Assignment documents from their legacy collegeDomain.
 *
 * Safety:
 * - Idempotent: assignments that already have collegeId are skipped.
 * - Dry-run supported.
 * - Never guesses: zero or multiple College matches are reported/skipped.
 * - Does not modify collegeDomain or any other Assignment field.
 * - Batched bulk writes.
 *
 * Usage:
 *   cd backend
 *   node scripts/backfillAssignmentCollegeIds.js --dry-run
 *   node scripts/backfillAssignmentCollegeIds.js
 */

import "../config/env.js";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import College from "../models/College.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BATCH_SIZE = 500;

export function normalizeDomain(domain) {
  return typeof domain === "string" && domain.trim()
    ? domain.toLowerCase().trim()
    : null;
}

export async function backfillAssignmentCollegeIdsCore({
  findAssignments,
  findCollegesByDomains,
  bulkSetCollegeIds,
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

  const assignments = await findAssignments();
  counts.scanned = assignments.length;

  const toResolve = [];
  for (const assignment of assignments) {
    if (assignment.collegeId) {
      counts.alreadyLinked += 1;
      continue;
    }

    const domain = normalizeDomain(assignment.collegeDomain);
    if (!domain) {
      counts.skippedNoMatch += 1;
      log(
        `  ⚠ Assignment ${assignment._id} has no collegeDomain — skipped.`
      );
      continue;
    }

    toResolve.push({ assignmentId: assignment._id, domain });
  }

  if (!toResolve.length) return counts;

  const distinctDomains = [...new Set(toResolve.map((item) => item.domain))];
  const colleges = await findCollegesByDomains(distinctDomains);

  const domainToCollegeIds = new Map();
  for (const college of colleges) {
    for (const rawDomain of college.domains || []) {
      const domain = normalizeDomain(rawDomain);
      if (!domain || !distinctDomains.includes(domain)) continue;

      const existing = domainToCollegeIds.get(domain) || [];
      existing.push(college._id);
      domainToCollegeIds.set(domain, existing);
    }
  }

  const eligibleOps = [];
  for (const { assignmentId, domain } of toResolve) {
    const matches = domainToCollegeIds.get(domain) || [];

    if (matches.length === 0) {
      counts.skippedNoMatch += 1;
      log(
        `  ⚠ Assignment ${assignmentId}: no College matches domain "${domain}" — skipped.`
      );
    } else if (matches.length > 1) {
      counts.skippedAmbiguous += 1;
      log(
        `  ⚠ Assignment ${assignmentId}: domain "${domain}" matches ${matches.length} Colleges — skipped.`
      );
    } else {
      counts.eligible += 1;
      eligibleOps.push({ assignmentId, collegeId: matches[0] });
    }
  }

  if (!eligibleOps.length) return counts;

  if (dryRun) {
    counts.updated = eligibleOps.length;
    return counts;
  }

  for (let i = 0; i < eligibleOps.length; i += batchSize) {
    const chunk = eligibleOps.slice(i, i + batchSize);

    try {
      counts.updated += await bulkSetCollegeIds(chunk);
    } catch (err) {
      counts.errors += chunk.length;
      log(
        `  ✗ Batch write failed (${chunk.length} assignments): ${err.message}`
      );
    }
  }

  return counts;
}

export function buildMongooseDeps() {
  return {
    findAssignments: () =>
      Assignment.find(
        {
          collegeId: { $exists: false },
          collegeDomain: { $exists: true, $nin: [null, ""] },
        },
        "_id collegeDomain collegeId"
      ).lean(),

    findCollegesByDomains: (domains) =>
      College.find({ domains: { $in: domains } })
        .select("_id domains")
        .lean(),

    bulkSetCollegeIds: async (ops) => {
      const result = await Assignment.bulkWrite(
        ops.map(({ assignmentId, collegeId }) => ({
          updateOne: {
            filter: {
              _id: assignmentId,
              collegeId: { $exists: false },
            },
            update: {
              $set: { collegeId },
            },
          },
        })),
        { ordered: false }
      );

      return result.modifiedCount || 0;
    },
  };
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

async function runBackfillAssignmentCollegeIds() {
  const dryRun = process.argv.includes("--dry-run");

  await connectDB();

  if (dryRun) {
    console.log("🔍 DRY RUN — no writes will occur\n");
  }

  const counts = await backfillAssignmentCollegeIdsCore({
    ...buildMongooseDeps(),
    dryRun,
    log: console.log,
  });

  printReport(counts, dryRun);

  if (dryRun) {
    console.log("\n🔍 DRY RUN complete — no changes were made.");
  }

  await mongoose.disconnect();
  return counts;
}

const isMainModule =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMainModule) {
  runBackfillAssignmentCollegeIds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}

export { runBackfillAssignmentCollegeIds };

/**
 * Backfill the scalable problem-progress stores from existing data.
 *
 * Re-runnable and safe for production-sized collections:
 *   1. UserProblemProgress gets one row per user/problem from Submission.
 *   2. ProblemStats gets one row per problem from Submission.
 *
 * Use --dry-run to report counts without writing.
 */

import "../config/env.js";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import Submission from "../models/Submission.js";
import UserProblemProgress from "../models/UserProblemProgress.js";
import ProblemStats from "../models/ProblemStats.js";
import { getStudentDayKey } from "../utils/studentDay.js";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

async function flush(model, operations) {
  if (!operations.length || DRY_RUN) return;
  await model.bulkWrite(operations, { ordered: false });
}

async function backfillUserProblemProgress() {
  let count = 0;
  let operations = [];

  const cursor = Submission.aggregate([
    {
      $group: {
        _id: { userId: "$userId", problemSlug: "$problemSlug" },
        attemptCount: { $sum: 1 },
        acceptedCount: {
          $sum: { $cond: [{ $eq: ["$status", "Accepted"] }, 1, 0] },
        },
        firstAttemptAt: { $min: "$createdAt" },
        lastAttemptAt: { $max: "$createdAt" },
        solvedAt: {
          $min: {
            $cond: [{ $eq: ["$status", "Accepted"] }, "$createdAt", null],
          },
        },
      },
    },
    { $sort: { "_id.userId": 1, "_id.problemSlug": 1 } },
  ]).allowDiskUse(true).cursor({ batchSize: BATCH_SIZE });

  for await (const row of cursor) {
    const solved = row.acceptedCount > 0;
    operations.push({
      updateOne: {
        filter: {
          userId: row._id.userId,
          problemSlug: row._id.problemSlug,
        },
        update: {
          $set: {
            status: solved ? "solved" : "attempted",
            firstAttemptAt: row.firstAttemptAt,
            solvedAt: solved ? row.solvedAt : null,
            solvedDay: solved && row.solvedAt ? getStudentDayKey(row.solvedAt) : null,
            attemptCount: row.attemptCount,
            acceptedCount: row.acceptedCount,
            lastAttemptAt: row.lastAttemptAt,
          },
          $setOnInsert: {
            userId: row._id.userId,
            problemSlug: row._id.problemSlug,
          },
        },
        upsert: true,
      },
    });

    count++;
    if (operations.length >= BATCH_SIZE) {
      await flush(UserProblemProgress, operations);
      operations = [];
    }
  }

  await flush(UserProblemProgress, operations);
  return count;
}

async function backfillProblemStats() {
  let count = 0;
  let operations = [];

  const cursor = Submission.aggregate([
    {
      $group: {
        _id: "$problemSlug",
        attempts: { $sum: 1 },
        accepted: {
          $sum: { $cond: [{ $eq: ["$status", "Accepted"] }, 1, 0] },
        },
        lastSubmissionAt: { $max: "$createdAt" },
      },
    },
    { $sort: { _id: 1 } },
  ]).allowDiskUse(true).cursor({ batchSize: BATCH_SIZE });

  for await (const row of cursor) {
    if (!row._id) continue;
    operations.push({
      updateOne: {
        filter: { problemSlug: row._id },
        update: {
          $set: {
            attempts: row.attempts,
            accepted: row.accepted,
            lastSubmissionAt: row.lastSubmissionAt,
          },
          $setOnInsert: { problemSlug: row._id },
        },
        upsert: true,
      },
    });

    count++;
    if (operations.length >= BATCH_SIZE) {
      await flush(ProblemStats, operations);
      operations = [];
    }
  }

  await flush(ProblemStats, operations);
  return count;
}

async function main() {
  await connectDB();
  console.log(DRY_RUN ? "DRY RUN — no writes will occur\n" : "Backfilling scalable problem stores...\n");

  const [progressRows, statsRows] = await Promise.all([
    backfillUserProblemProgress(),
    backfillProblemStats(),
  ]);

  console.log(`UserProblemProgress rows processed: ${progressRows}`);
  console.log(`ProblemStats rows processed: ${statsRows}`);
  console.log("Backfill complete.");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

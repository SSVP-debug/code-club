/**
 * backfillXP.js
 *
 * Recomputes User.totalXP from the normalized UserProblemProgress source.
 * Safe to re-run — the aggregate is deterministic. Use --dry-run to preview.
 */
import "../config/env.js";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import UserProblemProgress from "../models/UserProblemProgress.js";
import { XP_BY_DIFFICULTY } from "../utils/computeXP.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function backfillXP() {
  await connectDB();

  const cursor = UserProblemProgress.aggregate([
    { $match: { status: "solved" } },
    {
      $lookup: {
        from: "problems",
        localField: "problemSlug",
        foreignField: "slug",
        as: "problem",
      },
    },
    { $unwind: "$problem" },
    {
      $project: {
        userId: 1,
        difficulty: "$problem.difficulty",
      },
    },
    {
      $group: {
        _id: { userId: "$userId", difficulty: "$difficulty" },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.userId",
        easy: { $sum: { $cond: [{ $eq: ["$_id.difficulty", "Easy"] }, "$count", 0] } },
        medium: { $sum: { $cond: [{ $eq: ["$_id.difficulty", "Medium"] }, "$count", 0] } },
        hard: { $sum: { $cond: [{ $eq: ["$_id.difficulty", "Hard"] }, "$count", 0] } },
      },
    },
  ]).cursor({ batchSize: 500 });

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for await (const row of cursor) {
    const correctXP =
      (row.easy || 0) * (XP_BY_DIFFICULTY.Easy || 0)
      + (row.medium || 0) * (XP_BY_DIFFICULTY.Medium || 0)
      + (row.hard || 0) * (XP_BY_DIFFICULTY.Hard || 0);

    const user = await User.findById(row._id).select("totalXP").lean();
    if (!user || user.totalXP === correctXP) {
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      try {
        await User.updateOne({ _id: row._id }, { $set: { totalXP: correctXP } });
        updated++;
      } catch (err) {
        console.error("FAILED", String(row._id), err.message);
        errors++;
      }
    } else {
      updated++;
    }
  }

  if (!DRY_RUN) {
    await User.updateMany(
      { solvedCount: { $in: [0, null] } },
      { $set: { totalXP: 0 } }
    );
  }

  console.log(JSON.stringify({ dryRun: DRY_RUN, updated, skipped, errors }, null, 2));
  await mongoose.disconnect();
}

backfillXP().catch(async (err) => {
  console.error("Fatal:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

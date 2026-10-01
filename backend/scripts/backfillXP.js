/**
 * backfillXP.js
 *
 * One-time migration: recalculates totalXP for every user from solvedSlugs
 * using difficulty values from the canonical backend problem folders.
 *
 * Safe to re-run — result is deterministic from solvedSlugs and the folder
 * catalog. Use --dry-run to preview without writes.
 */

import "../config/env.js";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import loadProblemsFromFolders from "./lib/loadProblemsFromFolders.js";
import { buildDifficultyMap, computeXPFromSlugs } from "../utils/computeXP.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function backfillXP() {
  await connectDB();

  const problems = await loadProblemsFromFolders();
  const difficultyMap = buildDifficultyMap(problems);

  if (DRY_RUN) {
    console.log("DRY RUN — no writes will occur\n");
  }

  const users = await User.find({}, "email displayName solvedSlugs totalXP").lean();

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    const solvedSlugs = user.solvedSlugs || [];
    const currentXP = user.totalXP ?? 0;
    const correctXP = computeXPFromSlugs(solvedSlugs, difficultyMap, { warnUnknown: true });
    const label = user.email || user.displayName || String(user._id);

    if (correctXP === currentXP) {
      console.log(`  OK ${label}  ${solvedSlugs.length} solves -> ${correctXP} XP  (already correct)`);
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      try {
        await User.updateOne({ _id: user._id }, { $set: { totalXP: correctXP } });
        updated++;
      } catch (err) {
        console.error(`  FAILED ${label}:`, err.message);
        errors++;
      }
    } else {
      updated++;
    }
  }

  console.log(`\nBackfill complete: ${updated} updated, ${skipped} already correct, ${errors} errors.`);
  await mongoose.disconnect();
}

backfillXP().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

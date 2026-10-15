/**
 * Migrate embedded Contest.participants[] into ContestParticipant.
 *
 * Safe to rerun. Each participant is an upsert keyed by (contestId, userId),
 * and the legacy parent array is removed only after its rows have been
 * written. Existing routes can therefore be deployed before this script is
 * run and remain backward-compatible during the transition.
 *
 * Use --dry-run to report how many participant rows/contests would be
 * migrated without writing.
 */

import "../config/env.js";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import Contest from "../models/Contest.js";
import ContestParticipant from "../models/ContestParticipant.js";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

async function flushParticipantRows(operations) {
  if (!operations.length || DRY_RUN) return;
  await ContestParticipant.bulkWrite(operations, { ordered: false });
}

async function migrate() {
  let contests = 0;
  let participants = 0;
  let operations = [];
  let contestsToClear = [];

  const cursor = Contest.find({ "participants.0": { $exists: true } })
    .select("_id participants")
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  for await (const contest of cursor) {
    contests++;
    const rows = contest.participants || [];

    for (const participant of rows) {
      if (!participant.userId) continue;
      participants++;
      operations.push({
        updateOne: {
          filter: { contestId: contest._id, userId: participant.userId },
          update: {
            $set: {
              username: participant.username || "",
              displayName: participant.displayName || "",
              solvedSlugs: participant.solvedSlugs || [],
              score: participant.score ?? 0,
              rank: participant.rank ?? null,
              joinedAt: participant.joinedAt || new Date(),
            },
            $setOnInsert: {
              contestId: contest._id,
              userId: participant.userId,
            },
          },
          upsert: true,
        },
      });
    }

    contestsToClear.push(contest._id);

    if (operations.length >= BATCH_SIZE) {
      await flushParticipantRows(operations);
      operations = [];
    }

    if (contestsToClear.length >= BATCH_SIZE && !DRY_RUN) {
      await Contest.updateMany(
        { _id: { $in: contestsToClear } },
        { $unset: { participants: "" } }
      );
      contestsToClear = [];
    }
  }

  await flushParticipantRows(operations);

  if (!DRY_RUN && contestsToClear.length) {
    await Contest.updateMany(
      { _id: { $in: contestsToClear } },
      { $unset: { participants: "" } }
    );
  }

  console.log(DRY_RUN ? "DRY RUN — no writes occurred." : "Contest participation migration complete.");
  console.log(`Contests processed: ${contests}`);
  console.log(`Participant rows processed: ${participants}`);
}

connectDB()
  .then(migrate)
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error("Fatal:", err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });

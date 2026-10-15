import "../config/env.js";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import UserProblemProgress from "../models/UserProblemProgress.js";
import DailyChallengeCompletion from "../models/DailyChallengeCompletion.js";

const BATCH_SIZE = 500;

function parseArgs() {
  return {
    dryRun: process.argv.includes("--dry-run"),
  };
}

async function run() {
  const { dryRun } = parseArgs();
  await connectDB();

  const users = mongoose.connection.collection("users");
  const cursor = users.find(
    {
      $or: [
        { solvedSlugs: { $exists: true } },
        { activityDates: { $exists: true } },
        { dailyChallengeHistory: { $exists: true } },
      ],
    },
    {
      projection: {
        _id: 1,
        solvedSlugs: 1,
        activityDates: 1,
        dailyChallengeHistory: 1,
      },
    }
  );

  let scanned = 0;
  let usersWithSolved = 0;
  let solvedRows = 0;
  let dailyRows = 0;

  let progressOps = [];
  let dailyOps = [];
  let unsetIds = [];

  async function flush() {
    if (dryRun) {
      progressOps = [];
      dailyOps = [];
      unsetIds = [];
      return;
    }

    if (progressOps.length) {
      await UserProblemProgress.bulkWrite(progressOps, { ordered: false });
      progressOps = [];
    }
    if (dailyOps.length) {
      await DailyChallengeCompletion.bulkWrite(dailyOps, { ordered: false });
      dailyOps = [];
    }
    if (unsetIds.length) {
      await users.updateMany(
        { _id: { $in: unsetIds } },
        { $unset: { solvedSlugs: "", activityDates: "", dailyChallengeHistory: "" } }
      );
      unsetIds = [];
    }
  }

  for await (const user of cursor) {
    scanned++;

    const solvedSlugs = Array.isArray(user.solvedSlugs)
      ? [...new Set(user.solvedSlugs.filter(Boolean))]
      : [];

    if (solvedSlugs.length) {
      usersWithSolved++;
      for (const problemSlug of solvedSlugs) {
        solvedRows++;
        progressOps.push({
          updateOne: {
            filter: { userId: user._id, problemSlug },
            update: {
              $setOnInsert: {
                userId: user._id,
                problemSlug,
                status: "solved",
                solvedAt: null,
                solvedDay: null,
                firstAttemptAt: null,
                attemptCount: 1,
                acceptedCount: 1,
                lastAttemptAt: null,
              },
            },
            upsert: true,
          },
        });
      }
    }

    const history = Array.isArray(user.dailyChallengeHistory)
      ? user.dailyChallengeHistory
      : [];

    for (const entry of history) {
      if (!entry?.date || !entry?.slug) continue;
      dailyRows++;
      dailyOps.push({
        updateOne: {
          filter: { userId: user._id, date: entry.date, slug: entry.slug },
          update: {
            $setOnInsert: {
              userId: user._id,
              date: entry.date,
              slug: entry.slug,
              completedAt: entry.completedAt || new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (!dryRun) {
      await users.updateOne(
        { _id: user._id },
        { $set: { solvedCount: solvedSlugs.length } }
      );
      unsetIds.push(user._id);
    }

    if (progressOps.length >= BATCH_SIZE || dailyOps.length >= BATCH_SIZE || unsetIds.length >= BATCH_SIZE) {
      await flush();
    }
  }

  await flush();

  console.log(JSON.stringify({
    dryRun,
    scanned,
    usersWithSolved,
    solvedRows,
    dailyRows,
  }, null, 2));
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

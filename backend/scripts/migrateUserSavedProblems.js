import "../config/env.js";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import UserSavedProblem from "../models/UserSavedProblem.js";

const BATCH_SIZE = 500;

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  await connectDB();

  let scanned = 0;
  let migrated = 0;
  let cleared = 0;
  const operations = [];

  // Use the raw collection so this migration remains able to see the legacy
  // field even after the User schema removes savedProblems.
  const cursor = User.collection.find(
    { "savedProblems.0": { $exists: true } },
    { projection: { _id: 1, savedProblems: 1 } }
  );

  for await (const user of cursor) {
    scanned += 1;

    for (const saved of user.savedProblems || []) {
      if (!saved?.slug) continue;
      operations.push({
        updateOne: {
          filter: { userId: user._id, problemSlug: saved.slug },
          update: {
            $setOnInsert: {
              userId: user._id,
              problemSlug: saved.slug,
              savedAt: saved.savedAt || new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (operations.length >= BATCH_SIZE) {
      if (!dryRun) await UserSavedProblem.bulkWrite(operations, { ordered: false });
      migrated += operations.length;
      operations.length = 0;
    }

    if (!dryRun) {
      await User.collection.updateOne({ _id: user._id }, { $unset: { savedProblems: 1 } });
      cleared += 1;
    }
  }

  if (operations.length) {
    if (!dryRun) await UserSavedProblem.bulkWrite(operations, { ordered: false });
    migrated += operations.length;
  }

  console.log(JSON.stringify({ dryRun, scanned, migrated, cleared }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

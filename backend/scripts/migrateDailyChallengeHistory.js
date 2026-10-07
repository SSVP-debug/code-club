import "../config/env.js";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  await connectDB();

  const users = mongoose.connection.collection("users");
  const completions = mongoose.connection.collection("dailychallengecompletions");
  const cursor = users.find(
    { dailyChallengeHistory: { $exists: true, $ne: [] } },
    { projection: { _id: 1, dailyChallengeHistory: 1 } }
  );

  let scanned = 0;
  let migrated = 0;
  let invalid = 0;
  const ops = [];

  for await (const user of cursor) {
    scanned += 1;

    for (const entry of user.dailyChallengeHistory || []) {
      if (!entry?.date || !entry?.slug) {
        invalid += 1;
        continue;
      }

      ops.push({
        updateOne: {
          filter: { userId: user._id, date: entry.date },
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

    if (ops.length >= 500) {
      if (!DRY_RUN) await completions.bulkWrite(ops, { ordered: false });
      migrated += ops.length;
      ops.length = 0;
    }
  }

  if (ops.length) {
    if (!DRY_RUN) await completions.bulkWrite(ops, { ordered: false });
    migrated += ops.length;
  }

  if (!DRY_RUN) {
    await users.updateMany(
      { dailyChallengeHistory: { $exists: true } },
      { $unset: { dailyChallengeHistory: "" } }
    );
  }

  console.log(JSON.stringify({ dryRun: DRY_RUN, scanned, migrated, invalid }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

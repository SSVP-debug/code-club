import "../config/env.js";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  await connectDB();

  const users = mongoose.connection.collection("users");
  const cursor = users.find(
    { solvedSlugs: { $exists: true } },
    { projection: { _id: 1, solvedSlugs: 1, solvedCount: 1 } }
  );

  let scanned = 0;
  let updated = 0;

  const ops = [];

  for await (const user of cursor) {
    scanned += 1;
    const solvedCount = Array.isArray(user.solvedSlugs)
      ? new Set(user.solvedSlugs).size
      : Number(user.solvedCount || 0);

    ops.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: { solvedCount },
          $unset: { solvedSlugs: "" },
        },
      },
    });

    if (ops.length >= 500) {
      if (!DRY_RUN) await users.bulkWrite(ops, { ordered: false });
      updated += ops.length;
      ops.length = 0;
    }
  }

  if (ops.length) {
    if (!DRY_RUN) await users.bulkWrite(ops, { ordered: false });
    updated += ops.length;
  }

  console.log(JSON.stringify({ dryRun: DRY_RUN, scanned, updated }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

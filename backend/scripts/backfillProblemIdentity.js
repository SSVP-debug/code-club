/**
 * Backfill P1 problem identity for the canonical folder bank and Mongo.
 *
 * Safe to re-run:
 * - an existing problemKey is never replaced;
 * - familyKey defaults to the problemKey only when absent;
 * - variantOf remains null unless explicitly authored;
 * - identityFingerprint is recomputed from canonical identity material.
 *
 * Usage:
 *   npm run problems:identity:backfill:dry-run
 *   npm run problems:identity:backfill
 */
import "../config/env.js";
import fs from "fs/promises";
import path from "path";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import Problem from "../models/Problem.js";
import {
  computeProblemIdentityFingerprint,
  defaultFamilyKey,
  generateProblemKey,
  validateProblemIdentity,
} from "../utils/problemIdentity.js";

const DRY_RUN = process.argv.includes("--dry-run");
const PROBLEMS_DIR = path.join(process.cwd(), "problems");

async function backfillProblemIdentity() {
  await connectDB();
  const entries = await fs.readdir(PROBLEMS_DIR, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory() && entry.name !== ".gitkeep")
    .map((entry) => entry.name)
    .sort();

  console.log(`${DRY_RUN ? "DRY RUN — " : ""}checking ${folders.length} canonical problem folder(s)`);

  let changed = 0;

  for (const folder of folders) {
    const metaPath = path.join(PROBLEMS_DIR, folder, "meta.json");
    const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
    const existing = await Problem.findOne({ slug: meta.slug }).lean();

    const problemKey = meta.problemKey || existing?.problemKey || generateProblemKey();
    const familyKey = meta.familyKey || existing?.familyKey || defaultFamilyKey(problemKey);
    const variantOf = meta.variantOf ?? existing?.variantOf ?? null;
    const identityFingerprint = computeProblemIdentityFingerprint({
      ...existing,
      ...meta,
      problemKey,
      familyKey,
      variantOf,
    });

    validateProblemIdentity({ problemKey, familyKey, variantOf, identityFingerprint });

    const nextMeta = {
      ...meta,
      problemKey,
      familyKey,
      variantOf,
      identityFingerprint,
    };

    const changedMeta = JSON.stringify(meta, null, 2) !== JSON.stringify(nextMeta, null, 2);
    if (changedMeta) changed++;

    if (!DRY_RUN && changedMeta) {
      await fs.writeFile(metaPath, `${JSON.stringify(nextMeta, null, 2)}\n`, "utf8");
    }

    if (!DRY_RUN) {
      await Problem.updateOne(
        { slug: meta.slug },
        {
          $set: {
            problemKey,
            familyKey,
            variantOf,
            identityFingerprint,
          },
        },
        { upsert: false }
      );
    }
  }

  console.log(`${DRY_RUN ? "Would update" : "Updated"} ${changed} folder(s).`);
  await mongoose.disconnect();
}

backfillProblemIdentity().catch((err) => {
  console.error("Problem identity backfill failed:", err);
  process.exit(1);
});

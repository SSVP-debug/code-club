#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import mongoose from "mongoose";
import { loadProblemsFromFolders } from "./lib/loadProblemsFromFolders.js";
import { planCanonicalMigration } from "../utils/problemMigration.js";
import { validateProblemIdentity } from "../utils/problemIdentity.js";
import connectDB from "../config/db.js";
import Problem from "../models/Problem.js";
import Submission from "../models/Submission.js";
import Reflection from "../models/Reflection.js";
import ContestParticipant from "../models/ContestParticipant.js";
import BattleRoom from "../models/BattleRoom.js";
import SkillsTest from "../models/SkillsTest.js";
import UserProblemProgress from "../models/UserProblemProgress.js";

const APPLY = process.argv.includes("--apply");
const MONGO = process.argv.includes("--mongo");
const JSON_MODE = process.argv.includes("--json");
const PROBLEMS_DIR = path.join(process.cwd(), "problems");
const RETIRED_SLUG = "minimum-stack";
const CANONICAL_SLUG = "min-stack";

function print(value) {
  if (JSON_MODE) process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  else console.log(value);
}

async function writeCanonical(plan) {
  const writes = [];
  for (const item of plan) {
    if (!item.changed) continue;
    const metaPath = path.join(PROBLEMS_DIR, item.slug, "meta.json");
    const { next } = item;
    const { description, examples, constraints, testcases, hiddentestcases, starterCode, hints, editorial, ...meta } = next;

    if (APPLY) {
      await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
      if (item.slug === RETIRED_SLUG) {
        await fs.writeFile(path.join(PROBLEMS_DIR, item.slug, "testcases.json"), `${JSON.stringify(testcases, null, 2)}\n`, "utf8");
        await fs.writeFile(path.join(PROBLEMS_DIR, item.slug, "hidden-testcases.json"), `${JSON.stringify(hiddentestcases, null, 2)}\n`, "utf8");
      }
    }
    writes.push(item.slug);
  }
  return writes;
}

async function migrateMongoReferences() {
  if (!MONGO) return { skipped: true, reason: "--mongo not supplied" };
  if (!APPLY) return { skipped: true, reason: "dry-run; add --apply" };

  await connectDB();
  const results = [];

  for (const Model of [Submission, Reflection]) {
    const result = await Model.updateMany({ problemSlug: RETIRED_SLUG }, { $set: { problemSlug: CANONICAL_SLUG } });
    results.push({ collection: Model.collection.name, matched: result.matchedCount, modified: result.modifiedCount });
  }

  const progressAdd = await UserProblemProgress.updateMany(
    { problemSlug: RETIRED_SLUG },
    { $set: { problemSlug: CANONICAL_SLUG } }
  );
  results.push({
    collection: UserProblemProgress.collection.name,
    matched: progressAdd.matchedCount,
    modified: progressAdd.modifiedCount,
  });

  const skillsAdd = await SkillsTest.updateMany(
    { solvedSlugs: RETIRED_SLUG },
    { $addToSet: { solvedSlugs: CANONICAL_SLUG } }
  );
  const skillsRemove = await SkillsTest.updateMany(
    { solvedSlugs: RETIRED_SLUG },
    { $pull: { solvedSlugs: RETIRED_SLUG } }
  );
  results.push({
    collection: SkillsTest.collection.name,
    matched: skillsAdd.matchedCount,
    modified: skillsAdd.modifiedCount + skillsRemove.modifiedCount,
  });

  // Contest participation is now a separate collection; do not write the
  // retired slug back into the removed Contest.participants[] array.
  const contestAdd = await ContestParticipant.updateMany(
    { solvedSlugs: RETIRED_SLUG },
    { $addToSet: { solvedSlugs: CANONICAL_SLUG } }
  );
  const contestRemove = await ContestParticipant.updateMany(
    { solvedSlugs: RETIRED_SLUG },
    { $pull: { solvedSlugs: RETIRED_SLUG } }
  );
  results.push({ collection: ContestParticipant.collection.name, matched: contestAdd.matchedCount, modified: contestAdd.modifiedCount + contestRemove.modifiedCount });

  const battleAdd = await BattleRoom.updateMany(
    { "teams.solvedSlugs": RETIRED_SLUG },
    { $addToSet: { "teams.$[team].solvedSlugs": CANONICAL_SLUG } },
    { arrayFilters: [{ "team.solvedSlugs": RETIRED_SLUG }] }
  );
  const battleRemove = await BattleRoom.updateMany(
    { "teams.solvedSlugs": RETIRED_SLUG },
    { $pull: { "teams.$[team].solvedSlugs": RETIRED_SLUG } },
    { arrayFilters: [{ "team.solvedSlugs": RETIRED_SLUG }] }
  );
  results.push({ collection: BattleRoom.collection.name, matched: battleAdd.matchedCount, modified: battleAdd.modifiedCount + battleRemove.modifiedCount });

  const retired = await Problem.updateOne({ slug: RETIRED_SLUG }, { $set: { enabled: false } });
  results.push({ collection: Problem.collection.name, matched: retired.matchedCount, modified: retired.modifiedCount });

  return { skipped: false, results };
}

const problems = await loadProblemsFromFolders();
const plan = planCanonicalMigration(problems);

for (const item of plan) {
  validateProblemIdentity({
    problemKey: item.problemKey,
    familyKey: item.familyKey,
    variantOf: item.variantOf,
    identityFingerprint: item.identityFingerprint,
  });
}

const writes = await writeCanonical(plan);
const mongo = await migrateMongoReferences();

const report = {
  version: 1,
  mode: APPLY ? "apply" : "dry-run",
  mongo: MONGO,
  scanned: plan.length,
  plannedCanonicalWrites: plan.filter((item) => item.changed).length,
  canonicalWrites: writes,
  retiredDuplicate: { from: RETIRED_SLUG, to: CANONICAL_SLUG },
  identityBackfills: plan.filter((item) => !problems.find((p) => p.slug === item.slug)?.problemKey).length,
  mongoMigration: mongo,
};

print(report);

if (MONGO) await mongoose.disconnect();

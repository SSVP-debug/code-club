#!/usr/bin/env node

import "../config/env.js";
import mongoose from "mongoose";
import { loadProblemsFromFolders } from "./lib/loadProblemsFromFolders.js";
import connectDB from "../config/db.js";
import Problem from "../models/Problem.js";
import Submission from "../models/Submission.js";
import Reflection from "../models/Reflection.js";
import User from "../models/User.js";
import Contest from "../models/Contest.js";
import BattleRoom from "../models/BattleRoom.js";
import SkillsTest from "../models/SkillsTest.js";

const JSON_MODE = process.argv.includes("--json");
const RETIRED_SLUG = "minimum-stack";
const CANONICAL_SLUG = "min-stack";

const problems = await loadProblemsFromFolders();
await connectDB();

const failures = [];
const addFailure = (check, message) => failures.push({ check, message });

const dbProblems = await Problem.find({}).select("slug problemKey familyKey variantOf identityFingerprint enabled operationSequence").lean();
const dbBySlug = new Map(dbProblems.map((problem) => [problem.slug, problem]));

for (const problem of problems) {
  const stored = dbBySlug.get(problem.slug);
  if (!stored) {
    addFailure("missing-problem", `MongoDB has no Problem document for ${problem.slug}`);
    continue;
  }
  for (const field of ["problemKey", "familyKey", "variantOf", "identityFingerprint"]) {
    const expected = problem[field] ?? null;
    const actual = stored[field] ?? null;
    if (expected !== actual) addFailure("identity-consistency", `${problem.slug}: ${field} differs between canonical folder and MongoDB`);
  }
}

const retired = dbBySlug.get(RETIRED_SLUG);
if (retired?.enabled !== false) addFailure("retired-problem", `${RETIRED_SLUG} must remain disabled after P6 migration`);
if (!dbBySlug.has(CANONICAL_SLUG)) addFailure("canonical-problem", `${CANONICAL_SLUG} is missing from MongoDB`);

const checks = [
  [Submission, "problemSlug"],
  [Reflection, "problemSlug"],
  [User, "solvedSlugs"],
  [SkillsTest, "solvedSlugs"],
];
for (const [Model, field] of checks) {
  const count = await Model.countDocuments({ [field]: RETIRED_SLUG });
  if (count > 0) addFailure("reference-consistency", `${Model.collection.name}: ${count} document(s) still reference ${RETIRED_SLUG}`);
}

for (const [Model, field] of [[Contest, "participants.solvedSlugs"], [BattleRoom, "teams.solvedSlugs"]]) {
  const count = await Model.countDocuments({ [field]: RETIRED_SLUG });
  if (count > 0) addFailure("nested-reference-consistency", `${Model.collection.name}: ${count} document(s) still reference ${RETIRED_SLUG}`);
}

const report = {
  version: 1,
  scannedCanonicalProblems: problems.length,
  mongoProblems: dbProblems.length,
  failures,
  ok: failures.length === 0,
};

if (JSON_MODE) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`P6 Mongo consistency: ${report.ok ? "PASS" : "FAIL"}`);
  console.log(`Canonical problems: ${report.scannedCanonicalProblems}; Mongo problems: ${report.mongoProblems}`);
  for (const failure of failures) console.error(`- [FAIL][${failure.check}] ${failure.message}`);
}

await mongoose.disconnect();
process.exitCode = report.ok ? 0 : 1;

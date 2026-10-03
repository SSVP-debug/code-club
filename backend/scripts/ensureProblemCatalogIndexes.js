#!/usr/bin/env node

import "../config/env.js";
import connectDB from "../config/db.js";
import Problem from "../models/Problem.js";

const APPLY = process.argv.includes("--apply");
const JSON_MODE = process.argv.includes("--json");

const indexes = [
  {
    key: { enabled: 1, visibility: 1, id: 1 },
    name: "catalog_availability_order",
  },
  {
    key: { topic: 1, difficulty: 1, enabled: 1, visibility: 1, id: 1 },
    name: "catalog_topic_difficulty_order",
  },
  {
    key: { familyKey: 1 },
    name: "problem_family_lookup",
    sparse: true,
  },
  {
    key: { problemKey: 1 },
    name: "problem_identity_lookup",
    sparse: true,
  },
];

async function main() {
  await connectDB();
  const collection = Problem.collection;
  const existing = await collection.indexes();
  const existingNames = new Set(existing.map((index) => index.name));

  const missing = indexes.filter((index) => !existingNames.has(index.name));
  const report = {
    version: 1,
    apply: APPLY,
    existing: existing.map((index) => index.name),
    missing: missing.map((index) => index.name),
    created: [],
  };

  if (APPLY) {
    for (const index of missing) {
      await collection.createIndex(index.key, {
        name: index.name,
        ...(index.sparse ? { sparse: true } : {}),
      });
      report.created.push(index.name);
    }
  }

  if (JSON_MODE) {
    console.log(JSON.stringify(report, null, 2));
  } else if (APPLY) {
    console.log(`Catalog indexes ensured: ${report.created.length} created.`);
  } else {
    console.log(`Catalog index dry-run: ${missing.length} index(es) missing. Re-run with --apply to create them.`);
    for (const name of report.missing) console.log(`- ${name}`);
  }
}

main().catch((error) => {
  if (JSON_MODE) console.log(JSON.stringify({ version: 1, apply: APPLY, error: error.message }, null, 2));
  else console.error(error);
  process.exitCode = 1;
});

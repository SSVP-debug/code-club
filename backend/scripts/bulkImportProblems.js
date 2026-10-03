#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "../config/env.js";
import connectDB from "../config/db.js";
import Problem from "../models/Problem.js";
import { ProblemFolderSchema } from "../schemas/problemSchema.js";
import { LANGUAGES, REQUIRED_STARTER_LANGUAGE_KEYS } from "../config/languages.js";

const execFileAsync = promisify(execFile);
const PROBLEMS_DIR = path.join(process.cwd(), "problems");
const APPLY = process.argv.includes("--apply");
const JSON_MODE = process.argv.includes("--json");
const all = process.argv.includes("--all");
const slugsArg = process.argv.find((arg) => arg.startsWith("--slugs="));
const requestedSlugs = slugsArg
  ? [...new Set(slugsArg.slice("--slugs=".length).split(",").map((slug) => slug.trim()).filter(Boolean))]
  : [];

function fail(message) {
  if (JSON_MODE) {
    console.log(JSON.stringify({ version: 1, ok: false, apply: APPLY, error: message }, null, 2));
  } else {
    console.error(`[BULK IMPORT FAILED] ${message}`);
  }
  process.exitCode = 1;
}

async function readProblemFolder(slug) {
  const folder = path.join(PROBLEMS_DIR, slug);
  const readJson = async (name) => JSON.parse(await fs.readFile(path.join(folder, name), "utf8"));
  const readText = async (name) => fs.readFile(path.join(folder, name), "utf8");

  const meta = await readJson("meta.json");
  const description = await readText("description.md");
  const examples = await readJson("examples.json");
  const constraints = await readJson("constraints.json");
  const visibleTestcases = await readJson("testcases.json");
  const hiddenTestcases = await readJson("hidden-testcases.json");
  const hints = await readJson("hints.json");
  const editorial = await readText("editorial.md");

  const starterCode = Object.fromEntries(
    await Promise.all(
      Object.entries(LANGUAGES).map(async ([key, language]) => {
        const filePath = path.join(folder, "starter", `${key}.${language.extension}`);
        const required = REQUIRED_STARTER_LANGUAGE_KEYS.includes(key);
        return [key, required ? await fs.readFile(filePath, "utf8") : await fs.readFile(filePath, "utf8").catch(() => "")];
      })
    )
  );

  const parsed = ProblemFolderSchema.safeParse({
    meta,
    description,
    examples,
    constraints,
    visibleTestcases,
    hiddenTestcases,
    starterCode,
    editorial,
    hints,
  });

  if (!parsed.success) {
    const error = new Error(`ProblemFolderSchema rejected ${slug}`);
    error.details = parsed.error.flatten();
    throw error;
  }

  return {
    slug,
    meta,
    description,
    examples,
    constraints,
    visibleTestcases,
    hiddenTestcases,
    starterCode,
    editorial,
    hints,
  };
}

async function validateAuthoring(slug) {
  await execFileAsync("node", [
    "--import",
    "./utils/problemIdentityBootstrap.js",
    "scripts/validateProblemAuthoring.js",
    `--problem=${slug}`,
  ], { cwd: path.join(process.cwd()) });
}

async function main() {
  if (!all && requestedSlugs.length === 0) {
    fail("Specify --all or --slugs=slug-one,slug-two. Writes require --apply.");
    return;
  }

  const folders = (await fs.readdir(PROBLEMS_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name !== ".gitkeep")
    .map((entry) => entry.name)
    .sort();

  const slugs = all ? folders : requestedSlugs;
  const missing = slugs.filter((slug) => !folders.includes(slug));
  if (missing.length > 0) {
    fail(`Unknown problem folder(s): ${missing.join(", ")}`);
    return;
  }

  const problems = [];
  for (const slug of slugs) {
    const problem = await readProblemFolder(slug);
    await validateAuthoring(slug);
    problems.push(problem);
  }

  const duplicateIds = new Set();
  const duplicateSlugs = new Set();
  for (const problem of problems) {
    if (duplicateIds.has(problem.meta.id)) throw new Error(`duplicate id inside batch: ${problem.meta.id}`);
    if (duplicateSlugs.has(problem.meta.slug)) throw new Error(`duplicate slug inside batch: ${problem.meta.slug}`);
    duplicateIds.add(problem.meta.id);
    duplicateSlugs.add(problem.meta.slug);
  }

  if (!APPLY) {
    const report = {
      version: 1,
      mode: "dry-run",
      apply: false,
      problems: slugs,
      validated: problems.length,
      message: "All selected folders passed authoring and folder-schema validation. Re-run with --apply to write MongoDB.",
    };
    if (JSON_MODE) console.log(JSON.stringify(report, null, 2));
    else console.log(`Bulk import dry-run: ${problems.length} problem(s) validated; no MongoDB writes.`);
    return;
  }

  await connectDB();
  const existing = await Problem.find({ slug: { $in: slugs } }).select("slug hiddenTestcaseSet.enabled").lean();
  const hiddenEnabledBySlug = new Map(existing.map((problem) => [problem.slug, problem.hiddenTestcaseSet?.enabled ?? true]));

  const operations = problems.map((problem) => {
    const problemDoc = {
      ...problem.meta,
      description: problem.description,
      examples: problem.examples,
      constraints: problem.constraints,
      visibleTestCases: problem.visibleTestcases,
      testcases: problem.visibleTestcases,
      hiddenTestcaseSet: {
        enabled: hiddenEnabledBySlug.get(problem.slug) ?? true,
        testcases: problem.hiddenTestcases,
      },
      starterCode: problem.starterCode,
      editorial: { content: problem.editorial, author: "Code Club", updatedAt: null },
      hints: problem.hints,
    };

    return {
      updateOne: {
        filter: { slug: problem.slug },
        update: { $set: problemDoc },
        upsert: true,
      },
    };
  });

  const result = await Problem.bulkWrite(operations, { ordered: true });
  const report = {
    version: 1,
    mode: "apply",
    apply: true,
    problems: slugs,
    matched: result.matchedCount ?? 0,
    modified: result.modifiedCount ?? 0,
    upserted: result.upsertedCount ?? 0,
    message: "Bulk import completed after full pre-write validation.",
  };

  if (JSON_MODE) console.log(JSON.stringify(report, null, 2));
  else console.log(`Bulk import complete: ${report.modified} updated, ${report.upserted} inserted.`);
}

main().catch((error) => {
  if (JSON_MODE) {
    console.log(JSON.stringify({ version: 1, ok: false, apply: APPLY, error: error.message, details: error.details ?? null }, null, 2));
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

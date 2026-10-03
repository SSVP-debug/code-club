#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROBLEMS_DIR = path.join(process.cwd(), "problems");
const JSON_MODE = process.argv.includes("--json");
const FAIL_FAST = process.argv.includes("--fail-fast");
const all = process.argv.includes("--all");
const slugsArg = process.argv.find((arg) => arg.startsWith("--slugs="));
const requestedSlugs = slugsArg
  ? [...new Set(slugsArg.slice("--slugs=".length).split(",").map((slug) => slug.trim()).filter(Boolean))]
  : [];

const findings = [];
const add = (slug, level, check, message) => findings.push({ slug, level, check, message });

async function readMeta(slug) {
  const file = path.join(PROBLEMS_DIR, slug, "meta.json");
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function validateAuthoring(slug) {
  try {
    await execFileAsync(
      "node",
      [
        "--import",
        "./utils/problemIdentityBootstrap.js",
        "scripts/validateProblemAuthoring.js",
        `--problem=${slug}`,
      ],
      { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
    );
    add(slug, "PASS", "authoring", "strict authoring validation passed");
    return true;
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim();
    add(slug, "FAIL", "authoring", detail || "strict authoring validation failed");
    return false;
  }
}

async function main() {
  if (!all && requestedSlugs.length === 0) {
    throw new Error("Specify --all or --slugs=slug-one,slug-two");
  }

  const folders = (await fs.readdir(PROBLEMS_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name !== ".gitkeep")
    .map((entry) => entry.name)
    .sort();
  const slugs = all ? folders : requestedSlugs;
  const missing = slugs.filter((slug) => !folders.includes(slug));
  if (missing.length > 0) throw new Error(`Unknown problem folder(s): ${missing.join(", ")}`);

  const seenIds = new Map();
  const seenSlugs = new Set();
  let passed = 0;

  for (const slug of slugs) {
    const meta = await readMeta(slug);
    if (seenSlugs.has(meta.slug)) add(slug, "FAIL", "duplicate-slug", `duplicate slug ${meta.slug} in batch`);
    seenSlugs.add(meta.slug);
    if (seenIds.has(String(meta.id))) {
      add(slug, "FAIL", "duplicate-id", `id ${meta.id} is also used by ${seenIds.get(String(meta.id))}`);
    } else {
      seenIds.set(String(meta.id), slug);
    }

    const ok = await validateAuthoring(slug);
    if (ok) passed += 1;
    if (!ok && FAIL_FAST) break;
  }

  const failures = findings.filter((item) => item.level === "FAIL");
  const report = {
    version: 1,
    mode: all ? "all" : "selected",
    problems: slugs,
    validated: passed,
    failures: failures.length,
    findings,
  };

  if (JSON_MODE) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`Problem batch validation: ${slugs.length} selected, ${passed} passed, ${failures.length} failed.`);
    for (const finding of findings.filter((item) => item.level === "FAIL")) {
      console.error(`- [FAIL][${finding.slug}][${finding.check}] ${finding.message}`);
    }
  }

  process.exitCode = failures.length > 0 ? 1 : 0;
}

main().catch((error) => {
  if (JSON_MODE) {
    process.stdout.write(`${JSON.stringify({ version: 1, failures: 1, error: error.message }, null, 2)}\n`);
  } else {
    console.error(`[BATCH VALIDATION FAILED] ${error.message}`);
  }
  process.exitCode = 1;
});

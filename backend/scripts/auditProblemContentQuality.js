#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { LANGUAGES, REQUIRED_STARTER_LANGUAGE_KEYS } from "../config/languages.js";

const PROBLEMS_DIR = path.join(process.cwd(), "problems");
const JSON_MODE = process.argv.includes("--json");
const STRICT = process.argv.includes("--strict");
const slugArg = process.argv.find((arg) => arg.startsWith("--problem="));
const targetSlug = slugArg?.slice("--problem=".length);

const CONTENT_FILES = [
  "description.md",
  "examples.json",
  "constraints.json",
  "editorial.md",
];

const parseJson = (content) => {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const inspect = (name, content) => {
  const trimmed = content.trim();
  const todoCount = (content.match(/\b(?:TODO|TBD)\b/gi) || []).length;
  const parsed = name.endsWith(".json") ? parseJson(content) : null;
  const empty = trimmed.length === 0 || (Array.isArray(parsed) && parsed.length === 0);
  return { name, exists: true, empty, todoCount, bytes: Buffer.byteLength(content, "utf8") };
};

const listSlugs = async () => {
  const entries = await fs.readdir(PROBLEMS_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
};

const auditProblem = async (slug) => {
  const folder = path.join(PROBLEMS_DIR, slug);
  const checks = [];
  for (const name of CONTENT_FILES) {
    try {
      checks.push(inspect(name, await fs.readFile(path.join(folder, name), "utf8")));
    } catch {
      checks.push({ name, exists: false, empty: false, todoCount: 0, bytes: 0 });
    }
  }

  for (const key of REQUIRED_STARTER_LANGUAGE_KEYS) {
    const language = LANGUAGES[key];
    const name = `starter/${key}.${language.extension}`;
    try {
      checks.push(inspect(name, await fs.readFile(path.join(folder, "starter", `${key}.${language.extension}`), "utf8")));
    } catch {
      checks.push({ name, exists: false, empty: false, todoCount: 0, bytes: 0 });
    }
  }

  const description = checks.find((item) => item.name === "description.md");
  const examples = checks.find((item) => item.name === "examples.json");
  const constraints = checks.find((item) => item.name === "constraints.json");
  const editorial = checks.find((item) => item.name === "editorial.md");
  const starterChecks = checks.filter((item) => item.name.startsWith("starter/"));

  const critical = [];
  const warnings = [];
  if (!description?.exists || description.empty) critical.push("description.md is missing or empty");
  if (!examples?.exists || examples.empty) critical.push("examples.json is missing or empty");
  if (!constraints?.exists || constraints.empty) critical.push("constraints.json is missing or empty");
  if (!editorial?.exists || editorial.empty) critical.push("editorial.md is missing or empty");
  if (starterChecks.some((item) => !item.exists || item.empty)) critical.push("required starter code is missing or empty");

  const todoFiles = checks.filter((item) => item.todoCount > 0).map((item) => ({ name: item.name, count: item.todoCount }));
  if (todoFiles.length) warnings.push("TODO/TBD markers remain");
  if (examples?.exists && !examples.empty) {
    const parsed = parseJson(await fs.readFile(path.join(folder, "examples.json"), "utf8"));
    if (Array.isArray(parsed) && parsed.some((example) => !example?.input || !example?.output)) {
      warnings.push("one or more examples lack input/output");
    }
  }

  const learnerReady = critical.length === 0 && todoFiles.length === 0 && warnings.length === 0;
  return { slug, learnerReady, critical, warnings, todoFiles, checks };
};

const slugs = targetSlug ? [targetSlug] : await listSlugs();
const reports = [];
for (const slug of slugs) {
  try {
    reports.push(await auditProblem(slug));
  } catch (error) {
    reports.push({ slug, learnerReady: false, critical: [`audit failed: ${error.message}`], warnings: [], todoFiles: [], checks: [] });
  }
}

const summary = {
  version: 1,
  mode: STRICT ? "strict" : targetSlug ? "target" : "legacy-audit",
  total: reports.length,
  learnerReady: reports.filter((report) => report.learnerReady).length,
  withCriticalGaps: reports.filter((report) => report.critical.length).length,
  withTodoOrTbd: reports.filter((report) => report.todoFiles.length).length,
  reports,
};

if (JSON_MODE) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  console.log(`Problem content quality audit (${summary.mode})`);
  console.log(`Problems scanned: ${summary.total}`);
  console.log(`Learner-ready: ${summary.learnerReady}`);
  console.log(`Critical gaps: ${summary.withCriticalGaps}`);
  console.log(`TODO/TBD gaps: ${summary.withTodoOrTbd}`);
  for (const report of reports.filter((item) => item.critical.length || item.todoFiles.length)) {
    console.log(`- ${report.slug}: ${[...report.critical, ...report.warnings].join("; ")}`);
  }
}

if (STRICT && reports.some((report) => !report.learnerReady)) process.exitCode = 1;

#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { LANGUAGES, REQUIRED_STARTER_LANGUAGE_KEYS } from "../config/languages.js";

const PROBLEMS_DIR = path.join(process.cwd(), "problems");
const JSON_MODE = process.argv.includes("--json");
const slugArg = process.argv.find((arg) => arg.startsWith("--problem="));
const slug = slugArg?.slice("--problem=".length);

if (!slug) {
  console.error("Usage: npm run problems:check -- --problem=slug");
  process.exitCode = 1;
} else {
  const folder = path.join(PROBLEMS_DIR, slug);
  const files = [
    "meta.json",
    "description.md",
    "examples.json",
    "constraints.json",
    "testcases.json",
    "hidden-testcases.json",
    "hints.json",
    "editorial.md",
  ];
  const checks = [];

  const read = async (name) => fs.readFile(path.join(folder, name), "utf8");
  for (const name of files) {
    try {
      const content = await read(name);
      const todoCount = (content.match(/\b(?:TODO|TBD)\b/gi) || []).length;
      checks.push({ name, exists: true, todoCount });
    } catch {
      checks.push({ name, exists: false, todoCount: 0 });
    }
  }

  for (const key of REQUIRED_STARTER_LANGUAGE_KEYS) {
    const language = LANGUAGES[key];
    const name = `starter/${key}.${language.extension}`;
    try {
      const content = await fs.readFile(path.join(folder, "starter", `${key}.${language.extension}`), "utf8");
      checks.push({ name, exists: true, todoCount: (content.match(/\b(?:TODO|TBD)\b/gi) || []).length });
    } catch {
      checks.push({ name, exists: false, todoCount: 0 });
    }
  }

  const missing = checks.filter((item) => !item.exists).map((item) => item.name);
  const todoFiles = checks.filter((item) => item.todoCount > 0).map((item) => ({ name: item.name, count: item.todoCount }));
  const report = {
    version: 1,
    slug,
    readyForStrictValidation: missing.length === 0 && todoFiles.length === 0,
    missing,
    todoFiles,
    checks,
    nextCommand: `npm run validate:problem-authoring -- --problem=${slug}`,
  };

  if (JSON_MODE) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`Authoring checklist: ${slug}`);
    console.log(`Missing files: ${missing.length}`);
    console.log(`Files containing TODO/TBD: ${todoFiles.length}`);
    console.log(report.readyForStrictValidation ? "Ready for strict validation." : `Next: ${report.nextCommand}`);
  }
}

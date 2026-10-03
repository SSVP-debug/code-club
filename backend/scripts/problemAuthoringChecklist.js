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

  const inspectContent = (name, content) => {
    const trimmed = content.trim();
    const todoCount = (content.match(/\b(?:TODO|TBD)\b/gi) || []).length;
    let empty = trimmed.length === 0;

    // JSON arrays are authoring inputs; an empty array is still incomplete.
    if (!empty && name.endsWith(".json")) {
      try {
        const parsed = JSON.parse(content);
        empty = Array.isArray(parsed) && parsed.length === 0;
      } catch {
        // Parsing/contract validation is handled by the dedicated validators.
      }
    }

    return { name, exists: true, empty, todoCount };
  };

  for (const name of files) {
    try {
      const content = await fs.readFile(path.join(folder, name), "utf8");
      checks.push(inspectContent(name, content));
    } catch {
      checks.push({ name, exists: false, empty: false, todoCount: 0 });
    }
  }

  for (const key of REQUIRED_STARTER_LANGUAGE_KEYS) {
    const language = LANGUAGES[key];
    const name = `starter/${key}.${language.extension}`;
    try {
      const content = await fs.readFile(path.join(folder, "starter", `${key}.${language.extension}`), "utf8");
      checks.push(inspectContent(name, content));
    } catch {
      checks.push({ name, exists: false, empty: false, todoCount: 0 });
    }
  }

  const missing = checks.filter((item) => !item.exists).map((item) => item.name);
  const emptyFiles = checks.filter((item) => item.exists && item.empty).map((item) => item.name);
  const todoFiles = checks.filter((item) => item.todoCount > 0).map((item) => ({ name: item.name, count: item.todoCount }));
  const report = {
    version: 2,
    slug,
    readyForStrictValidation: missing.length === 0 && emptyFiles.length === 0 && todoFiles.length === 0,
    missing,
    emptyFiles,
    todoFiles,
    checks,
    nextCommand: `npm run validate:problem-authoring -- --problem=${slug}`,
  };

  if (JSON_MODE) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`Authoring checklist: ${slug}`);
    console.log(`Missing files: ${missing.length}`);
    console.log(`Empty files: ${emptyFiles.length}`);
    console.log(`Files containing TODO/TBD: ${todoFiles.length}`);
    console.log(report.readyForStrictValidation ? "Ready for strict validation." : `Next: ${report.nextCommand}`);
  }
}

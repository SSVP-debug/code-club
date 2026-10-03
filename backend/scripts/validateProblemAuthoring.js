import fs from "node:fs/promises";
import path from "node:path";
import { loadProblemsFromFolders } from "./lib/loadProblemsFromFolders.js";
import { computeProblemIdentityFingerprint, validateProblemIdentity } from "../utils/problemIdentity.js";
import { LANGUAGES, REQUIRED_STARTER_LANGUAGE_KEYS } from "../config/languages.js";

const PROBLEMS_DIR = path.join(process.cwd(), "problems");
const target = process.argv.slice(2).find((arg) => arg.startsWith("--problem="))?.split("=")[1] ?? null;
const STRICT_AUTHORING = Boolean(target);

function add(errors, slug, message) {
  errors.push(`${slug}: ${message}`);
}

async function validateFolder(problem, allSlugs) {
  const slug = problem.slug;
  const folder = path.join(PROBLEMS_DIR, slug);
  const errors = [];

  if (problem.id === undefined || problem.id === null) add(errors, slug, "meta.id is required");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) add(errors, slug, "slug must be lowercase kebab-case");
  if (!problem.description?.trim() || problem.description.trim().length < 40) {
    add(errors, slug, "description is too short; write the complete problem statement");
  }
  if (!Array.isArray(problem.examples) || problem.examples.length === 0) add(errors, slug, "at least one example is required");
  if (!Array.isArray(problem.constraints) || problem.constraints.length === 0) add(errors, slug, "at least one constraint is required");
  if (!Array.isArray(problem.testcases) || problem.testcases.length === 0) add(errors, slug, "at least one visible testcase is required");
  if (!Array.isArray(problem.hiddentestcases) || problem.hiddentestcases.length === 0) add(errors, slug, "at least one hidden testcase is required");

  const editorialPath = path.join(folder, "editorial.md");
  const editorial = await fs.readFile(editorialPath, "utf8").catch(() => "");
  if (!editorial.trim()) {
    add(errors, slug, "editorial.md is required");
  } else if (STRICT_AUTHORING && (/\bTODO\b|\bTBD\b/i.test(editorial))) {
    add(errors, slug, "editorial must be complete and contain no TODO/TBD");
  }

  for (const related of problem.relatedProblems ?? []) {
    if (!allSlugs.has(related)) add(errors, slug, `relatedProblems references missing slug "${related}"`);
  }

  for (const key of REQUIRED_STARTER_LANGUAGE_KEYS) {
    const language = LANGUAGES[key];
    const file = path.join(folder, "starter", `${key}.${language.extension}`);
    const code = await fs.readFile(file, "utf8").catch(() => "");
    if (!code.trim()) add(errors, slug, `missing required starter/${key}.${language.extension}`);
    if (STRICT_AUTHORING && /\bTODO\b|\bTBD\b/i.test(code)) {
      add(errors, slug, `starter/${key}.${language.extension} contains TODO/TBD`);
    }
  }

  if (problem.problemKey || problem.familyKey || problem.identityFingerprint || problem.variantOf) {
    try {
      validateProblemIdentity(problem);
      const expected = computeProblemIdentityFingerprint(problem);
      if (problem.identityFingerprint !== expected) {
        add(errors, slug, "identityFingerprint is stale; run the problem identity backfill after authoring changes");
      }
    } catch (error) {
      add(errors, slug, `invalid problem identity: ${error.message}`);
    }
  } else if (STRICT_AUTHORING) {
    add(errors, slug, "new problem authoring requires problemKey, familyKey, variantOf, and identityFingerprint");
  }

  return errors;
}

async function main() {
  if (target) {
    const targetFolder = path.join(PROBLEMS_DIR, target);
    const stat = await fs.stat(targetFolder).catch(() => null);
    if (!stat?.isDirectory()) throw new Error(`Problem folder not found: ${target}`);
  }

  const problems = await loadProblemsFromFolders({ targetProblem: target });
  const allProblems = target ? await loadProblemsFromFolders() : problems;
  const allSlugs = new Set(allProblems.map((problem) => problem.slug));
  const errors = [];

  for (const problem of problems) errors.push(...await validateFolder(problem, allSlugs));

  if (errors.length) {
    console.error(`Problem authoring validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Problem authoring validation passed: ${problems.length} problem(s)${STRICT_AUTHORING ? " in strict authoring mode" : " in bank audit mode"}.`);
}

main().catch((error) => {
  console.error(`[AUTHORING VALIDATION FAILED] ${error.message}`);
  process.exitCode = 1;
});

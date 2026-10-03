#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { loadProblemsFromFolders } from "./lib/loadProblemsFromFolders.js";
import {
  computeProblemIdentityFingerprint,
  validateProblemIdentity,
} from "../utils/problemIdentity.js";
import {
  ENABLED_LANGUAGE_KEYS,
  LANGUAGES,
  REQUIRED_STARTER_LANGUAGE_KEYS,
} from "../config/languages.js";
import { identifyOperationSequence } from "../utils/operationSequenceShape.js";

const PROBLEMS_DIR = path.join(process.cwd(), "problems");
const JSON_MODE = process.argv.includes("--json");

const problems = await loadProblemsFromFolders();
const slugs = new Set(problems.map((problem) => problem.slug));
const problemKeys = new Map();
const ids = new Map();
const findings = [];

const add = (slug, level, check, message) => {
  findings.push({ slug, level, check, message });
};

function duplicate(map, key, slug, label) {
  if (key === undefined || key === null || key === "") return;
  const previous = map.get(String(key));
  if (previous) {
    add(slug, "FAIL", `duplicate-${label}`, `${label} ${key} is also declared by ${previous}`);
  } else {
    map.set(String(key), slug);
  }
}

for (const problem of problems) {
  const { slug, id, problemKey, familyKey, variantOf, identityFingerprint } = problem;
  const folder = path.join(PROBLEMS_DIR, slug);

  if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
    add(slug, "FAIL", "id", `id must be a positive integer; received ${JSON.stringify(id)}`);
  }
  duplicate(ids, id, slug, "id");

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    add(slug, "FAIL", "slug", "slug must be lowercase kebab-case");
  }

  duplicate(problemKeys, problemKey, slug, "problemKey");

  // Multiple problems sharing a familyKey is intentional: familyKey groups
  // variants. Integrity is checked by validating the UUID and variantOf link,
  // not by treating family membership as duplication.
  if (familyKey === undefined || familyKey === null || familyKey === "") {
    add(slug, "WARN", "familyKey", "legacy problem is missing familyKey; P6 migration must backfill it");
  }

  if (!problemKey || !familyKey || !identityFingerprint) {
    add(slug, "WARN", "identity", "legacy problem is missing problemKey/familyKey/identityFingerprint; P6 migration must backfill these fields");
  } else {
    try {
      validateProblemIdentity({ problemKey, familyKey, variantOf, identityFingerprint });
      const expected = computeProblemIdentityFingerprint(problem);
      if (expected !== identityFingerprint) {
        add(slug, "FAIL", "identity-fingerprint", "identityFingerprint does not match the current semantic problem contract");
      }
    } catch (error) {
      add(slug, "FAIL", "identity", error.message);
    }
  }

  if (variantOf !== null && variantOf !== undefined) {
    if (!problemKey) {
      add(slug, "WARN", "variantOf", "variantOf cannot be resolved until legacy identity is backfilled");
    } else if (variantOf === problemKey) {
      add(slug, "FAIL", "variantOf", "variantOf cannot reference itself");
    }
  }

  for (const related of problem.relatedProblems ?? []) {
    if (!slugs.has(related)) {
      add(slug, "FAIL", "relatedProblems", `references missing problem slug ${JSON.stringify(related)}`);
    }
  }

  for (const [key, language] of Object.entries(LANGUAGES)) {
    const starterPath = path.join(folder, "starter", `${key}.${language.extension}`);
    const exists = await fs.access(starterPath).then(() => true).catch(() => false);
    if (!exists && REQUIRED_STARTER_LANGUAGE_KEYS.includes(key)) {
      add(slug, "FAIL", "starter-language", `missing required starter/${key}.${language.extension}`);
    } else if (!exists && ENABLED_LANGUAGE_KEYS.includes(key)) {
      add(slug, "WARN", "starter-language", `enabled language ${key} has no starter/${key}.${language.extension}`);
    }
  }

  const visible = Array.isArray(problem.testcases) ? problem.testcases : [];
  const hidden = Array.isArray(problem.hiddentestcases) ? problem.hiddentestcases : [];
  if (visible.length === 0) add(slug, "FAIL", "testcases", "visible testcase set is empty");
  if (hidden.length === 0) add(slug, "FAIL", "hidden-testcases", "hidden testcase set is empty");
  if (hidden.length > 0 && hidden.length < 3) {
    add(slug, "WARN", "hidden-testcases", `only ${hidden.length} hidden testcase(s); coverage may be weak`);
  }

  const visibleSet = new Set(visible.map((testcase) => JSON.stringify(testcase)));
  const overlap = hidden.filter((testcase) => visibleSet.has(JSON.stringify(testcase))).length;
  if (overlap > 0) {
    add(slug, "WARN", "testcase-overlap", `${overlap} hidden testcase(s) are identical to visible testcase(s)`);
  }

  for (const [name, testcase] of [...visible, ...hidden].entries()) {
    if (!testcase || typeof testcase !== "object") {
      add(slug, "FAIL", "testcase-shape", `testcase ${name} is not an object`);
    } else {
      if (!("input" in testcase)) add(slug, "FAIL", "testcase-shape", `testcase ${name} is missing input`);
      if (!("expectedOutput" in testcase)) add(slug, "FAIL", "testcase-shape", `testcase ${name} is missing expectedOutput`);
    }
  }

  const operationSequence = problem.operationSequence ?? {};
  if (operationSequence.enabled) {
    if (!["all", "returningOnly"].includes(operationSequence.resultMode)) {
      add(slug, "FAIL", "operation-sequence", `unsupported resultMode ${JSON.stringify(operationSequence.resultMode)}`);
    }

    for (const [index, testcase] of [...visible, ...hidden].entries()) {
      const shape = identifyOperationSequence(testcase?.input ?? {});
      if (!shape) {
        add(slug, "FAIL", "operation-sequence", `testcase ${index} does not match a supported operation-sequence shape`);
      } else if (shape.opNames.length !== shape.opArgsList.length) {
        add(slug, "FAIL", "operation-sequence", `testcase ${index} has mismatched operation and argument counts`);
      }

      if (operationSequence.resultMode === "returningOnly" && Array.isArray(testcase?.expectedOutput)) {
        if (testcase.expectedOutput.some((value) => value === null)) {
          add(slug, "FAIL", "operation-sequence-results", `testcase ${index} contains null output under returningOnly mode`);
        }
      }
    }
  }
}

for (const problem of problems) {
  if (problem.variantOf && problemKeyFor(problem.variantOf) === null) {
    add(problem.slug, "WARN", "variantOf", `variantOf ${problem.variantOf} is not present in this bank; legacy identity may need migration`);
  }
}

function problemKeyFor(key) {
  return problemKeys.has(String(key)) ? key : null;
}

const counts = {
  problems: problems.length,
  fail: findings.filter((item) => item.level === "FAIL").length,
  warn: findings.filter((item) => item.level === "WARN").length,
};

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  canonicalSource: "backend/problems",
  ...counts,
  enabledLanguages: ENABLED_LANGUAGE_KEYS,
  requiredStarterLanguages: REQUIRED_STARTER_LANGUAGE_KEYS,
  findings,
};

if (JSON_MODE) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.error(`P5 problem-bank audit: ${counts.problems} problems scanned.`);
  console.error(`FAIL: ${counts.fail}; WARN: ${counts.warn}`);
  if (counts.fail > 0) {
    for (const finding of findings.filter((item) => item.level === "FAIL")) {
      console.error(`- [FAIL][${finding.slug}][${finding.check}] ${finding.message}`);
    }
  }
  if (counts.warn > 0) {
    console.error(`Warnings are non-blocking and represent known legacy/migration gaps.`);
  }
}

process.exitCode = counts.fail > 0 ? 1 : 0;

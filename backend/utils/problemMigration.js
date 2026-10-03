import { randomUUID } from "node:crypto";

import {
  computeProblemIdentityFingerprint,
  defaultFamilyKey,
} from "./problemIdentity.js";

export const RETIRED_PROBLEM_MIGRATIONS = Object.freeze({
  "minimum-stack": "min-stack",
});

export function normalizeOperationSequenceTestcase(testcase) {
  const input = testcase?.input;
  if (!input || Array.isArray(input) || typeof input !== "object") return testcase;
  if (!Array.isArray(input.ops) || !Array.isArray(input.vals)) return testcase;
  if (input.ops.length !== input.vals.length) {
    throw new Error("Cannot normalize operation sequence: ops and vals lengths differ");
  }

  const operations = input.ops.map((name, index) => {
    const args = input.vals[index];
    if (!Array.isArray(args)) {
      throw new Error(`Cannot normalize operation sequence: vals[${index}] is not an array`);
    }
    return [name, ...args];
  });

  const expectedOutput = Array.isArray(testcase.expectedOutput)
    ? testcase.expectedOutput.filter((value, index) => input.vals[index]?.length >= 0 && value !== null)
    : testcase.expectedOutput;

  return {
    ...testcase,
    input: { operations },
    expectedOutput,
  };
}

export function ensureProblemIdentity(problem) {
  const problemKey = problem.problemKey || randomUUID();
  const familyKey = problem.familyKey || defaultFamilyKey(problemKey);
  const next = { ...problem, problemKey, familyKey };

  if (problem.slug === "minimum-stack") {
    const canonicalKey = problem._canonicalProblemKey || null;
    if (canonicalKey) {
      next.familyKey = canonicalKey;
      next.variantOf = canonicalKey;
    }
    next.enabled = false;
    next.operationSequence = {
      enabled: true,
      resultMode: "returningOnly",
    };
  }

  next.identityFingerprint = computeProblemIdentityFingerprint(next);
  return next;
}

export function planCanonicalMigration(problems) {
  const bySlug = new Map(problems.map((problem) => [problem.slug, problem]));
  const canonical = bySlug.get("min-stack");
  if (!canonical) throw new Error("P6 requires canonical min-stack to exist");

  const canonicalKey = canonical.problemKey || randomUUID();
  const plan = [];

  for (const original of problems) {
    const problem = { ...original };
    if (problem.slug === "min-stack") problem.problemKey = canonicalKey;
    if (problem.slug === "minimum-stack") problem._canonicalProblemKey = canonicalKey;

    const next = ensureProblemIdentity(problem);
    if (next.slug === "minimum-stack") {
      next.testcases = (next.testcases || []).map(normalizeOperationSequenceTestcase);
      next.hiddentestcases = (next.hiddentestcases || []).map(normalizeOperationSequenceTestcase);
    }

    const changed = JSON.stringify(original) !== JSON.stringify(next);
    plan.push({
      slug: original.slug,
      changed,
      problemKey: next.problemKey,
      familyKey: next.familyKey,
      variantOf: next.variantOf ?? null,
      enabled: next.enabled !== false,
      identityFingerprint: next.identityFingerprint,
      next,
    });
  }

  return plan;
}

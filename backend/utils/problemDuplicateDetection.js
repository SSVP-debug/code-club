import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeProblemIdentityFingerprint } from "./problemIdentity.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DISPOSITIONS_PATH = path.resolve(__dirname, "../config/problemDuplicateDispositions.json");
const TOKEN_RE = /[a-z0-9]+/gi;

// Keep this deliberately small and conservative. These are common interchangeable
// terms in problem statements, not a general-purpose synonym engine.
const SEMANTIC_EQUIVALENTS = new Map([
  ["element", "value"],
  ["elements", "value"],
]);

function textTokens(value) {
  const tokens = String(value ?? "").toLowerCase().match(TOKEN_RE) || [];
  return new Set(tokens.map((token) => SEMANTIC_EQUIVALENTS.get(token) || token));
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function normalizedContract(problem) {
  const op = problem.operationSequence || {};
  return JSON.stringify({
    returnType: problem.returnType || {},
    paramTypes: problem.paramTypes || {},
    comparisonMode: problem.comparisonMode || "exact",
    operationSequence: {
      enabled: Boolean(op.enabled),
      resultMode: op.resultMode || "all",
    },
  });
}

function titleSimilarity(a, b) {
  return jaccard(textTokens(a.title), textTokens(b.title));
}

function descriptionSimilarity(a, b) {
  return jaccard(textTokens(a.description), textTokens(b.description));
}

function functionSimilarity(a, b) {
  const left = String(a.functionName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const right = String(b.functionName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return left && right && left === right ? 1 : 0;
}

function contractSimilarity(a, b) {
  return normalizedContract(a) === normalizedContract(b) ? 1 : 0;
}

export function compareProblems(a, b) {
  const title = titleSimilarity(a, b);
  const description = descriptionSimilarity(a, b);
  const fn = functionSimilarity(a, b);
  const contract = contractSimilarity(a, b);

  // Description is the strongest semantic signal; title/function/contract
  // strengthen the review signal without pretending this is an NLP classifier.
  const score = description * 0.62 + title * 0.18 + fn * 0.10 + contract * 0.10;
  return { score, title, description, functionName: fn, contract };
}

export function loadDuplicateDispositions() {
  const parsed = JSON.parse(fs.readFileSync(DISPOSITIONS_PATH, "utf8"));
  return {
    pairs: new Set(parsed.pairs || []),
    fingerprints: new Set(parsed.fingerprints || []),
  };
}

export function pairKey(problemA, problemB) {
  return [problemA.problemKey, problemB.problemKey].sort().join("::");
}

export function scanProblemDuplicates(problems, { probableThreshold = 0.68, dispositions = loadDuplicateDispositions() } = {}) {
  const exactByFingerprint = new Map();
  const exactDuplicates = [];
  const probableDuplicates = [];

  for (const problem of problems) {
    const fingerprint = problem.identityFingerprint || computeProblemIdentityFingerprint(problem);
    const existing = exactByFingerprint.get(fingerprint) || [];
    for (const other of existing) {
      const key = pairKey(problem, other);
      if (!dispositions.pairs.has(key) && !dispositions.fingerprints.has(fingerprint)) {
        exactDuplicates.push({ type: "exact", fingerprint, a: other, b: problem, dispositionKey: key });
      }
    }
    existing.push(problem);
    exactByFingerprint.set(fingerprint, existing);
  }

  for (let i = 0; i < problems.length; i += 1) {
    for (let j = i + 1; j < problems.length; j += 1) {
      const a = problems[i];
      const b = problems[j];
      const fingerprintA = a.identityFingerprint || computeProblemIdentityFingerprint(a);
      const fingerprintB = b.identityFingerprint || computeProblemIdentityFingerprint(b);
      if (fingerprintA === fingerprintB) continue;

      const key = pairKey(a, b);
      if (dispositions.pairs.has(key)) continue;

      const comparison = compareProblems(a, b);
      if (comparison.score >= probableThreshold) {
        probableDuplicates.push({ type: "probable", a, b, ...comparison, dispositionKey: key });
      }
    }
  }

  probableDuplicates.sort((a, b) => b.score - a.score);
  return { exactDuplicates, probableDuplicates };
}

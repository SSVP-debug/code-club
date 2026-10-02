import { loadProblemsFromFolders } from "./lib/loadProblemsFromFolders.js";
import { computeProblemIdentityFingerprint, validateProblemIdentity } from "../utils/problemIdentity.js";

const ALLOW_LEGACY = process.argv.includes("--allow-legacy");

const problems = await loadProblemsFromFolders();
let failures = 0;

for (const problem of problems) {
  const { problemKey, familyKey, variantOf, identityFingerprint } = problem;

  if (!problemKey || !familyKey || !identityFingerprint) {
    if (ALLOW_LEGACY) {
      console.warn(`WARN ${problem.slug}: identity fields missing (legacy mode)`);
      continue;
    }
    console.error(`FAIL ${problem.slug}: missing problem identity fields`);
    failures++;
    continue;
  }

  try {
    validateProblemIdentity({ problemKey, familyKey, variantOf, identityFingerprint });
  } catch (err) {
    console.error(`FAIL ${problem.slug}: ${err.message}`);
    failures++;
    continue;
  }

  const expected = computeProblemIdentityFingerprint(problem);
  if (expected !== identityFingerprint) {
    console.error(`FAIL ${problem.slug}: identityFingerprint is stale`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\nProblem identity validation failed: ${failures} problem(s).`);
  process.exit(1);
}

console.log(`Problem identity validation passed for ${problems.length} problem(s).`);

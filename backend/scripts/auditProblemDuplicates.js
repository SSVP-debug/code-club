import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import loadProblemsFromFolders from "./lib/loadProblemsFromFolders.js";
import { loadDuplicateDispositions, scanProblemDuplicates } from "../utils/problemDuplicateDetection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DISPOSITIONS_PATH = path.resolve(__dirname, "../config/problemDuplicateDispositions.json");

function loadDispositionRegistry() {
  const parsed = JSON.parse(fs.readFileSync(DISPOSITIONS_PATH, "utf8"));
  return {
    version: parsed.version || 1,
    pairs: parsed.pairs || [],
    fingerprints: parsed.fingerprints || [],
  };
}

function problemLabel(problem) {
  return `${problem.id}:${problem.slug}`;
}

function emitJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  const problems = await loadProblemsFromFolders();
  const registry = loadDispositionRegistry();
  const dispositions = loadDuplicateDispositions();
  const { exactDuplicates, probableDuplicates } = scanProblemDuplicates(problems, { dispositions });
  const args = new Set(process.argv.slice(2));

  const payload = {
    version: registry.version,
    problemCount: problems.length,
    exactDuplicateCount: exactDuplicates.length,
    probableDuplicateCount: probableDuplicates.length,
    dispositionPairCount: registry.pairs.length,
    dispositionFingerprintCount: registry.fingerprints.length,
    exactDuplicates: exactDuplicates.map((duplicate) => ({
      dispositionKey: duplicate.dispositionKey,
      fingerprint: duplicate.fingerprint,
      a: problemLabel(duplicate.a),
      b: problemLabel(duplicate.b),
    })),
    probableDuplicates: probableDuplicates.map((duplicate) => ({
      dispositionKey: duplicate.dispositionKey,
      score: Number(duplicate.score.toFixed(3)),
      description: Number(duplicate.description.toFixed(3)),
      title: Number(duplicate.title.toFixed(3)),
      functionName: Number(duplicate.functionName.toFixed(3)),
      contract: Number(duplicate.contract.toFixed(3)),
      a: problemLabel(duplicate.a),
      b: problemLabel(duplicate.b),
    })),
  };

  if (args.has("--json")) {
    emitJson(payload);
  } else {
    console.log(`Problem bank scanned: ${payload.problemCount}`);
    console.log(`Configured pair dispositions: ${payload.dispositionPairCount}`);
    console.log(`Configured fingerprint dispositions: ${payload.dispositionFingerprintCount}`);
    console.log(`Exact duplicate pairs: ${payload.exactDuplicateCount}`);
    console.log(`Probable duplicate pairs requiring review: ${payload.probableDuplicateCount}`);

    if (exactDuplicates.length) {
      console.error("\n=== EXACT DUPLICATES — CI FAILURE ===");
      for (const duplicate of exactDuplicates) {
        console.error(
          `${problemLabel(duplicate.a)} <-> ${problemLabel(duplicate.b)}`,
          `fingerprint=${duplicate.fingerprint}`,
          `disposition=${duplicate.dispositionKey}`
        );
      }
    }

    if (probableDuplicates.length) {
      console.warn("\n=== PROBABLE DUPLICATES — REVIEW REQUIRED ===");
      for (const duplicate of probableDuplicates) {
        console.warn(
          `${problemLabel(duplicate.a)} <-> ${problemLabel(duplicate.b)}`,
          `score=${duplicate.score.toFixed(3)}`,
          `description=${duplicate.description.toFixed(3)}`,
          `title=${duplicate.title.toFixed(3)}`,
          `function=${duplicate.functionName.toFixed(3)}`,
          `contract=${duplicate.contract.toFixed(3)}`,
          `disposition=${duplicate.dispositionKey}`
        );
      }
    }
  }

  // Probable duplicates are intentionally review-only. Only unresolved exact
  // fingerprint collisions make the audit fail CI.
  if (exactDuplicates.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Problem duplicate audit failed:", error);
  process.exitCode = 1;
});

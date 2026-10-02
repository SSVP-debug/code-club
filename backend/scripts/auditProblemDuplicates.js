import loadProblemsFromFolders from "./lib/loadProblemsFromFolders.js";
import { scanProblemDuplicates } from "../utils/problemDuplicateDetection.js";

async function main() {
  const problems = await loadProblemsFromFolders();
  const { exactDuplicates, probableDuplicates } = scanProblemDuplicates(problems);

  console.log(`Problem bank scanned: ${problems.length}`);
  console.log(`Exact duplicate pairs: ${exactDuplicates.length}`);
  console.log(`Probable duplicate pairs: ${probableDuplicates.length}`);

  if (exactDuplicates.length) {
    console.error("\n=== EXACT DUPLICATES — CI FAILURE ===");
    for (const duplicate of exactDuplicates) {
      console.error(
        `${duplicate.a.id}:${duplicate.a.slug} <-> ${duplicate.b.id}:${duplicate.b.slug}`,
        `fingerprint=${duplicate.fingerprint}`
      );
    }
  }

  if (probableDuplicates.length) {
    console.warn("\n=== PROBABLE DUPLICATES — REVIEW REQUIRED ===");
    for (const duplicate of probableDuplicates) {
      console.warn(
        `${duplicate.a.id}:${duplicate.a.slug} <-> ${duplicate.b.id}:${duplicate.b.slug}`,
        `score=${duplicate.score.toFixed(3)}`,
        `description=${duplicate.description.toFixed(3)}`,
        `title=${duplicate.title.toFixed(3)}`,
        `function=${duplicate.functionName.toFixed(3)}`,
        `contract=${duplicate.contract.toFixed(3)}`
      );
    }
  }

  if (exactDuplicates.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Problem duplicate audit failed:", error);
  process.exitCode = 1;
});

/**
 * Fails if the retired frontend problem catalog or folder exporter reappears,
 * or if application/runtime code imports the retired catalog.
 *
 * Tests and the legacy contract-test helper are allowed to mention the old
 * path temporarily because Vitest resolves that path through the canonical
 * folder loader. They are not authoring sources or runtime dependencies.
 */
import fs from "fs/promises";
import path from "path";

const ROOT = path.resolve(process.cwd(), "..");
const FORBIDDEN_FILES = [
  path.join(ROOT, "src", "data", "problems.js"),
  path.join(ROOT, "src", "data", "problemMetadata.js"),
  path.join(process.cwd(), "scripts", "exportProblemsToFolders.js"),
  path.join(process.cwd(), "scripts", "checkProblemsFolderDrift.js"),
  path.join(process.cwd(), "scripts", "backfillTypescriptStarter.js"),
  path.join(process.cwd(), "scripts", "regenerateTypescriptStarters.js"),
];

const SCAN_ROOTS = [
  path.join(ROOT, "src"),
  path.join(process.cwd(), "controllers"),
  path.join(process.cwd(), "routes"),
  path.join(process.cwd(), "services"),
  path.join(process.cwd(), "utils"),
  path.join(process.cwd(), "scripts"),
];

const FORBIDDEN_IMPORT_PATTERNS = [
  /(?:from\s+["'][^"']*data\/problems(?:\.js)?["'])/,
  /(?:import\s*\(\s*["'][^"']*data\/problems(?:\.js)?["']\s*\))/,
  /(?:from\s+["'][^"']*data\/problemMetadata(?:\.js)?["'])/,
  /(?:import\s*\(\s*["'][^"']*data\/problemMetadata(?:\.js)?["']\s*\))/,
];

const TEXT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...await walk(fullPath));
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) results.push(fullPath);
  }
  return results;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "\n")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function isTestFile(filePath) {
  return /(?:\.test|\.spec)\.(?:js|jsx|ts|tsx|mjs|cjs)$/.test(filePath);
}

function isLegacyContractHelper(filePath) {
  return path.basename(filePath) === "validateProblemContracts.js";
}

async function main() {
  const failures = [];

  for (const filePath of FORBIDDEN_FILES) {
    if (await exists(filePath)) failures.push(`retired file exists: ${path.relative(ROOT, filePath)}`);
  }

  for (const root of SCAN_ROOTS) {
    for (const filePath of await walk(root)) {
      if (isTestFile(filePath) || isLegacyContractHelper(filePath)) continue;

      const source = stripComments(await fs.readFile(filePath, "utf8"));
      if (FORBIDDEN_IMPORT_PATTERNS.some((pattern) => pattern.test(source))) {
        failures.push(`legacy problem import found: ${path.relative(ROOT, filePath)}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error("Canonical problem source validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("Canonical problem source validation passed: backend/problems is the sole standard authoring source.");
}

main().catch((error) => {
  console.error("[validateCanonicalProblemSource] Failed:", error);
  process.exitCode = 1;
});

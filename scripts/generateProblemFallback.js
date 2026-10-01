/**
 * Generates the frontend emergency catalog from backend/problems/<slug>/.
 * Hidden tests and editorial content are intentionally excluded.
 */
import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const PROBLEMS_DIR = path.join(ROOT, "backend", "problems");
const OUTPUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "problemFallback.js");

const XP_BY_DIFFICULTY = { Easy: 10, Medium: 25, Hard: 50 };

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readStarterCode(folderPath) {
  const starterPath = path.join(folderPath, "starter");
  const entries = await fs.readdir(starterPath, { withFileTypes: true });
  const starterCode = {};
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name);
    const key = path.basename(entry.name, extension);
    starterCode[key] = await fs.readFile(path.join(starterPath, entry.name), "utf8");
  }
  return starterCode;
}

async function loadPublicProblem(slug) {
  const folderPath = path.join(PROBLEMS_DIR, slug);
  const meta = await readJson(path.join(folderPath, "meta.json"));
  const description = await fs.readFile(path.join(folderPath, "description.md"), "utf8");
  const examples = await readJson(path.join(folderPath, "examples.json"));
  const constraints = await readJson(path.join(folderPath, "constraints.json"));
  const visibleTestCases = await readJson(path.join(folderPath, "testcases.json"));
  const hints = await readJson(path.join(folderPath, "hints.json"));
  const starterCode = await readStarterCode(folderPath);

  return {
    ...meta,
    description,
    examples,
    constraints,
    visibleTestCases,
    testcases: visibleTestCases,
    starterCode,
    hints,
    xp: XP_BY_DIFFICULTY[meta.difficulty] ?? null,
  };
}

async function main() {
  const entries = await fs.readdir(PROBLEMS_DIR, { withFileTypes: true });
  const slugs = entries
    .filter((entry) => entry.isDirectory() && entry.name !== ".gitkeep")
    .map((entry) => entry.name)
    .sort();

  const problems = await Promise.all(slugs.map(loadPublicProblem));
  problems.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const output = [
    "// AUTO-GENERATED FILE — DO NOT EDIT.",
    "// Source: backend/problems/<slug>/ (canonical problem authoring source).",
    "// Hidden tests and editorial content are intentionally excluded.",
    `export default ${JSON.stringify(problems, null, 2)};`,
    "",
  ].join("\n");

  await fs.writeFile(OUTPUT_FILE, output, "utf8");
  console.log(`Generated public problem fallback: ${problems.length} problem(s).`);
}

main().catch((error) => {
  console.error("[generateProblemFallback] Failed:", error);
  process.exitCode = 1;
});

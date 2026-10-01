/**
 * Canonical problem-bank reader.
 *
 * `backend/problems/<slug>/` is the authoring source of truth. This loader
 * reconstructs the in-memory problem shape needed by maintenance, audit,
 * and migration scripts without importing `src/data/problems.js`.
 */
import fs from "fs/promises";
import path from "path";
import { ProblemFolderSchema } from "../../schemas/problemSchema.js";
import { LANGUAGES, REQUIRED_STARTER_LANGUAGE_KEYS } from "../../config/languages.js";

const PROBLEMS_DIR = path.join(process.cwd(), "problems");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readStarterCode(folderPath) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(LANGUAGES).map(async ([key, lang]) => {
        const filePath = path.join(folderPath, "starter", `${key}.${lang.extension}`);
        const content = REQUIRED_STARTER_LANGUAGE_KEYS.includes(key)
          ? await fs.readFile(filePath, "utf8")
          : await fs.readFile(filePath, "utf8").catch(() => "");
        return [key, content];
      })
    )
  );
}

export async function loadProblemsFromFolders({ targetProblem = null } = {}) {
  const entries = await fs.readdir(PROBLEMS_DIR, { withFileTypes: true });
  let folders = entries
    .filter((entry) => entry.isDirectory() && entry.name !== ".gitkeep")
    .map((entry) => entry.name)
    .sort();

  if (targetProblem) folders = folders.filter((folder) => folder === targetProblem);

  const problems = [];

  for (const folder of folders) {
    const folderPath = path.join(PROBLEMS_DIR, folder);
    const meta = await readJson(path.join(folderPath, "meta.json"));
    const description = await fs.readFile(path.join(folderPath, "description.md"), "utf8");
    const examples = await readJson(path.join(folderPath, "examples.json"));
    const constraints = await readJson(path.join(folderPath, "constraints.json"));
    const testcases = await readJson(path.join(folderPath, "testcases.json"));
    const hiddentestcases = await readJson(path.join(folderPath, "hidden-testcases.json"));
    const hints = await readJson(path.join(folderPath, "hints.json"));
    const editorial = await fs.readFile(path.join(folderPath, "editorial.md"), "utf8");
    const starterCode = await readStarterCode(folderPath);

    const parsed = ProblemFolderSchema.safeParse({
      meta,
      description,
      examples,
      constraints,
      visibleTestcases: testcases,
      hiddenTestcases: hiddentestcases,
      starterCode,
      editorial,
      hints,
    });

    if (!parsed.success) {
      const error = new Error(`Invalid problem folder: ${folder}`);
      error.cause = parsed.error;
      throw error;
    }

    problems.push({
      ...meta,
      description,
      examples,
      constraints,
      testcases,
      hiddentestcases,
      starterCode,
      hints,
      editorial: editorial ? { content: editorial } : { content: "" },
    });
  }

  return problems;
}

export default loadProblemsFromFolders;

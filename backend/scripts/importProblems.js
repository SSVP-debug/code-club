import fs from "fs/promises";
import path from "path";
import { ProblemFolderSchema } from "../schemas/problemSchema.js";
import { LANGUAGES, REQUIRED_STARTER_LANGUAGE_KEYS } from "../config/languages.js";
import "./../config/env.js";
import connectDB from "../config/db.js";
import Problem from "../models/Problem.js";

const PROBLEMS_DIR = path.join(process.cwd(), "problems");
const DRY_RUN = process.argv.includes("--dry-run");
const targetProblem = process.argv.slice(2).find((arg) => arg !== "--dry-run");

async function readProblemFolder(folder) {
  const folderPath = path.join(PROBLEMS_DIR, folder);
  const meta = JSON.parse(await fs.readFile(path.join(folderPath, "meta.json"), "utf8"));
  const description = await fs.readFile(path.join(folderPath, "description.md"), "utf8");
  const examples = JSON.parse(await fs.readFile(path.join(folderPath, "examples.json"), "utf8"));
  const constraints = JSON.parse(await fs.readFile(path.join(folderPath, "constraints.json"), "utf8"));
  const visibleTestcases = JSON.parse(await fs.readFile(path.join(folderPath, "testcases.json"), "utf8"));
  const hiddenTestcases = JSON.parse(await fs.readFile(path.join(folderPath, "hidden-testcases.json"), "utf8"));
  const hints = JSON.parse(await fs.readFile(path.join(folderPath, "hints.json"), "utf8"));
  const editorial = await fs.readFile(path.join(folderPath, "editorial.md"), "utf8");

  const starterCode = Object.fromEntries(
    await Promise.all(Object.entries(LANGUAGES).map(async ([key, lang]) => {
      const filePath = path.join(folderPath, "starter", `${key}.${lang.extension}`);
      const content = REQUIRED_STARTER_LANGUAGE_KEYS.includes(key)
        ? await fs.readFile(filePath, "utf8")
        : await fs.readFile(filePath, "utf8").catch(() => "");
      return [key, content];
    }))
  );

  const parsed = ProblemFolderSchema.safeParse({
    meta, description, examples, constraints, visibleTestcases,
    hiddenTestcases, starterCode, editorial, hints,
  });

  if (!parsed.success) {
    const error = new Error(`Validation failed for ${folder}`);
    error.details = parsed.error.flatten();
    throw error;
  }

  return { folder, meta, description, examples, constraints, visibleTestcases, hiddenTestcases, starterCode, editorial, hints };
}

async function main() {
  if (!DRY_RUN) await connectDB();

  const folders = await fs.readdir(PROBLEMS_DIR);
  let problemFolders = folders.filter((f) => f !== ".gitkeep");
  if (targetProblem) problemFolders = problemFolders.filter((f) => f === targetProblem);

  // Validate/read first, then write in one bulk operation. This keeps large
  // imports bounded by validation + one Mongo bulkWrite instead of one
  // round-trip per problem.
  const problems = [];
  for (const folder of problemFolders) {
    const problem = await readProblemFolder(folder);
    problems.push(problem);
    if (DRY_RUN) console.log(`[VALID] ${problem.meta.slug}`);
  }

  if (!DRY_RUN) {
    const slugs = problems.map((p) => p.meta.slug);
    const existing = await Problem.find({ slug: { $in: slugs } })
      .select("slug hiddenTestcaseSet.enabled")
      .lean();
    const existingBySlug = new Map(existing.map((p) => [p.slug, p]));

    const operations = problems.map((p) => {
      const existingProblem = existingBySlug.get(p.meta.slug);
      const problemDoc = {
        ...p.meta,
        description: p.description,
        examples: p.examples,
        constraints: p.constraints,
        visibleTestCases: p.visibleTestcases,
        testcases: p.visibleTestcases,
        hiddenTestcaseSet: {
          enabled: existingProblem?.hiddenTestcaseSet?.enabled ?? true,
          testcases: p.hiddenTestcases,
        },
        starterCode: p.starterCode,
        editorial: { content: p.editorial, author: "Code Club", updatedAt: null },
        hints: p.hints,
      };

      return {
        updateOne: {
          filter: { slug: problemDoc.slug },
          update: { $set: problemDoc },
          upsert: true,
        },
      };
    });

    if (operations.length > 0) {
      await Problem.bulkWrite(operations, { ordered: false });
    }
  }

  console.log(`\n${DRY_RUN ? "Validated" : "Imported"} ${problems.length} problem(s).`);
}

main().catch((error) => {
  console.error(error);
  if (error.details) console.dir(error.details, { depth: null });
  process.exitCode = 1;
});

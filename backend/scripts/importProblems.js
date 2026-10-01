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
let importedCount = 0;

async function main() {
  // Dry-run is also the canonical folder-contract validation path, so it must
  // work in CI and on developer machines without a live MongoDB connection.
  if (!DRY_RUN) {
    await connectDB();
  }

  const folders = await fs.readdir(PROBLEMS_DIR);
  let problemFolders = folders.filter((f) => f !== ".gitkeep");

  if (targetProblem) {
    problemFolders = problemFolders.filter((f) => f === targetProblem);
  }

  console.log({ targetProblem });
  console.log({ problemFolders });

  for (const folder of problemFolders) {
    const folderPath = path.join(PROBLEMS_DIR, folder);

    const meta = JSON.parse(await fs.readFile(path.join(folderPath, "meta.json"), "utf8"));
    const description = await fs.readFile(path.join(folderPath, "description.md"), "utf8");

    // Visible and hidden testcases are intentionally separate on disk. Hidden
    // tests remain backend-only and are never imported by frontend code.
    const visibleTestcases = JSON.parse(
      await fs.readFile(path.join(folderPath, "testcases.json"), "utf8")
    );
    const hiddenTestcases = JSON.parse(
      await fs.readFile(path.join(folderPath, "hidden-testcases.json"), "utf8")
    );
    const hints = JSON.parse(await fs.readFile(path.join(folderPath, "hints.json"), "utf8"));
    const editorial = await fs.readFile(path.join(folderPath, "editorial.md"), "utf8");

    const starterCode = Object.fromEntries(
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

    const parsed = ProblemFolderSchema.safeParse({
      meta,
      description,
      visibleTestcases,
      hiddenTestcases,
      starterCode,
      editorial,
      hints,
    });

    if (!parsed.success) {
      console.error(`Validation failed for ${folder}`);
      console.dir(parsed.error.flatten(), { depth: null });
      process.exitCode = 1;
      return;
    }

    if (DRY_RUN) {
      console.log(`[VALID] ${meta.slug}`);
      importedCount++;
      continue;
    }

    const existingForHiddenSet = await Problem.findOne({ slug: meta.slug }).lean();
    const problemDoc = {
      ...meta,
      description,
      visibleTestCases: visibleTestcases,
      testcases: visibleTestcases,
      hiddenTestcaseSet: {
        enabled: existingForHiddenSet?.hiddenTestcaseSet?.enabled ?? true,
        testcases: hiddenTestcases,
      },
      starterCode,
      editorial: {
        content: editorial,
        author: "Code Club",
        updatedAt: null,
      },
      hints,
    };

    await Problem.findOneAndUpdate(
      { slug: problemDoc.slug },
      { $set: problemDoc },
      { upsert: true }
    );

    console.log(`✓ Imported ${problemDoc.slug}`);
    importedCount++;
  }

  console.log(
    `\n${DRY_RUN ? "Validated" : "Imported"} ${importedCount} problem(s).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

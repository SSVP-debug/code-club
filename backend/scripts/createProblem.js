import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { computeProblemIdentityFingerprint } from "../utils/problemIdentity.js";
import { LANGUAGES, REQUIRED_STARTER_LANGUAGE_KEYS } from "../config/languages.js";

const PROBLEMS_DIR = path.join(process.cwd(), "problems");

function readArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function usage() {
  console.error(
    "Usage: npm run problems:create -- --slug=two-sum-new --title=\"Two Sum Variant\" --difficulty=Easy --topic=Arrays --functionName=twoSumVariant [--id=1001] [--familyKey=<uuid>] [--variantOf=<uuid>]"
  );
}

function starterTemplate(language, functionName) {
  switch (language) {
    case "python":
      return `def ${functionName}():\n    pass\n`;
    case "javascript":
      return `function ${functionName}() {\n  // TODO: implement\n}\n`;
    case "typescript":
      return `function ${functionName}(): void {\n  // TODO: implement\n}\n`;
    case "java":
      return `class Solution {\n    public void ${functionName}() {\n        // TODO: implement\n    }\n}\n`;
    case "cpp":
      return `class Solution {\npublic:\n    void ${functionName}() {\n        // TODO: implement\n    }\n};\n`;
    case "c":
      return `void ${functionName}(void) {\n    // TODO: implement\n}\n`;
    default:
      return "";
  }
}

async function ensureDoesNotExist(target) {
  try {
    await fs.access(target);
    throw new Error(`Problem folder already exists: ${target}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const slug = readArg("slug");
  const title = readArg("title");
  const difficulty = readArg("difficulty", "Easy");
  const topic = readArg("topic", "");
  const functionName = readArg("functionName", "solve");
  const idArg = readArg("id");
  const id = idArg ? Number(idArg) : null;

  if (!slug || !title || !topic || !functionName) {
    usage();
    process.exitCode = 1;
    return;
  }
  if (!/^[-a-z0-9]+$/.test(slug)) throw new Error("slug must contain only lowercase letters, numbers, and hyphens");
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("--id=<positive integer> is required; choose an unused catalog id");
  }
  if (!["Easy", "Medium", "Hard"].includes(difficulty)) throw new Error("difficulty must be Easy, Medium, or Hard");

  const problemKey = randomUUID();
  const familyKey = readArg("familyKey", problemKey);
  const variantOf = readArg("variantOf", null);

  if (!/^[0-9a-f-]{36}$/i.test(familyKey)) throw new Error("familyKey must be a UUID");
  if (variantOf && !/^[0-9a-f-]{36}$/i.test(variantOf)) throw new Error("variantOf must be a UUID");
  if (variantOf === problemKey) throw new Error("variantOf cannot equal the generated problemKey");

  const meta = {
    id,
    slug,
    title,
    difficulty,
    topic,
    pattern: "",
    sourceType: variantOf ? "variant" : "core",
    functionName,
    estimatedTime: "",
    companies: [],
    relatedProblems: [],
    returnType: {},
    paramTypes: {},
    comparisonMode: "exact",
    operationSequence: { enabled: false, resultMode: "all" },
    problemKey,
    familyKey,
    variantOf,
  };

  const fingerprint = computeProblemIdentityFingerprint({ ...meta, description: "TODO: write the complete problem statement.", returnType: {}, paramTypes: {} });
  meta.identityFingerprint = fingerprint;

  const folder = path.join(PROBLEMS_DIR, slug);
  await ensureDoesNotExist(folder);
  await fs.mkdir(path.join(folder, "starter"), { recursive: true });

  await Promise.all([
    writeJson(path.join(folder, "meta.json"), meta),
    fs.writeFile(path.join(folder, "description.md"), "# Problem\n\nTODO: write the complete problem statement.\n", "utf8"),
    writeJson(path.join(folder, "examples.json"), []),
    writeJson(path.join(folder, "constraints.json"), []),
    writeJson(path.join(folder, "testcases.json"), []),
    writeJson(path.join(folder, "hidden-testcases.json"), []),
    writeJson(path.join(folder, "hints.json"), []),
    fs.writeFile(path.join(folder, "editorial.md"), "# Editorial\n\nTODO: explain the intended solution and complexity.\n", "utf8"),
  ]);

  await Promise.all(
    Object.entries(LANGUAGES).map(async ([key, language]) => {
      const required = REQUIRED_STARTER_LANGUAGE_KEYS.includes(key);
      if (!required) return;
      await fs.writeFile(
        path.join(folder, "starter", `${key}.${language.extension}`),
        starterTemplate(key, functionName),
        "utf8"
      );
    })
  );

  console.log(`Created canonical problem scaffold: problems/${slug}`);
  console.log(`problemKey: ${problemKey}`);
  console.log("Next: complete every TODO, add testcases, then run npm run validate:problem-authoring -- --problem=" + slug);
}

main().catch((error) => {
  console.error(`[CREATE FAILED] ${error.message}`);
  process.exitCode = 1;
});

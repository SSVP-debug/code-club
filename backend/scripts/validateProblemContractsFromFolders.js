/**
 * Canonical execution-contract validation for backend/problems/<slug>/.
 *
 * This intentionally validates the same high-risk contract boundaries as the
 * historical validator, but reads only from the canonical problem folders.
 */
import loadProblemsFromFolders from "./lib/loadProblemsFromFolders.js";
import { generateDriverCode } from "../utils/generateDriverCode.js";
import { SUPPORTED_LANGUAGE_KEYS } from "../config/languages.js";

const JAVA_RETURN_RE = /public\s+([\w<>[\],]+(?:\s*<[\w<>[\],\s]*>)?)\s+\w+\s*\(/;
const C_RETURN_RE = (fn) => new RegExp(`^\\s*([\\w*]+(?:\\s+[\\w*]+)*)\\s+${fn}\\s*\\(`);
const CPP_RETURN_RE = (fn) => new RegExp(`^\\s*([\\w:<>,]+(?:\\s+[\\w:<>,]+)*)\\s+${fn}\\s*\\(`);

function signatureReturnType(code, language, functionName) {
  if (!code || !functionName) return null;
  if (language === "java") return code.match(JAVA_RETURN_RE)?.[1]?.trim() ?? null;
  const re = language === "c" ? C_RETURN_RE(functionName) : CPP_RETURN_RE(functionName);
  const line = code.split("\n").find((value) => re.test(value));
  return line?.match(re)?.[1]?.trim() ?? null;
}

function validateProblem(problem) {
  const errors = [];
  if (!problem.functionName?.trim()) {
    errors.push(`${problem.slug}: missing functionName`);
  }

  for (const language of SUPPORTED_LANGUAGE_KEYS) {
    const code = problem.starterCode?.[language];
    if (!code?.trim()) {
      errors.push(`${problem.slug}: starterCode.${language} missing/empty`);
      continue;
    }

    const declared = problem.returnType?.[language];
    if (declared && ["java", "cpp", "c"].includes(language)) {
      const actual = signatureReturnType(code, language, problem.functionName);
      if (!actual) {
        errors.push(`${problem.slug}: could not read ${language} return type for ${problem.functionName}`);
      } else if (actual !== declared) {
        errors.push(`${problem.slug}: ${language} starter declares ${actual}, returnType says ${declared}`);
      }
    }
  }

  if (!problem.testcases?.length) errors.push(`${problem.slug}: no visible testcases`);
  if (!problem.hiddentestcases?.length) errors.push(`${problem.slug}: no hidden testcases`);

  const testcase = problem.testcases?.[0];
  if (testcase && !problem.operationSequence?.enabled) {
    for (const language of ["java", "cpp", "c"]) {
      if (!problem.starterCode?.[language]) continue;
      try {
        const generated = generateDriverCode(
          language,
          problem.starterCode[language],
          testcase.input,
          problem.functionName,
          problem.returnType?.[language],
          problem.paramTypes?.[language]
        );
        if (/\bObject\s+\w+\s*=/.test(generated)) {
          errors.push(`${problem.slug}: generated ${language} driver contains Object argument declaration`);
        }
      } catch (error) {
        errors.push(`${problem.slug}: driver generation failed for ${language}: ${error.message}`);
      }
    }
  }

  return errors;
}

async function main() {
  const problems = await loadProblemsFromFolders();
  const errors = problems.flatMap(validateProblem);

  console.log(`Validated ${problems.length} canonical problem folder(s).`);
  if (errors.length) {
    console.error(`Found ${errors.length} execution-contract error(s):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("All canonical problem execution contracts passed.");
}

main().catch((error) => {
  console.error("Problem contract validation failed:", error);
  process.exitCode = 1;
});

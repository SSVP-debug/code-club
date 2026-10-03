/**
 * Read-only execution-contract validation for Code Club problems.
 *
 * This validator is source-agnostic: callers provide the problem list.
 * The CLI loads the canonical folder bank plus Code Club Edition missions.
 */
import { loadProblemsFromFolders } from "./lib/loadProblemsFromFolders.js";
import { generateDriverCode } from "../utils/generateDriverCode.js";
import { generateOperationSequenceDriver } from "../utils/operationSequenceDriver.js";
import { identifyOperationSequence } from "../utils/operationSequenceShape.js";
import { SUPPORTED_LANGUAGE_KEYS } from "../config/languages.js";
import { inferReturnType as inferCReturnType } from "../utils/languageDrivers/c.js";
import { inferCType } from "../utils/languageTypes/c.js";

const JAVA_RETURN_RE = /public\s+([\w<>[\],]+(?:\s*<[\w<>[\],\s]*>)?)\s+\w+\s*\(/;

function checkFunctionName(problem) {
  const fn = problem.functionName;
  if (typeof fn !== "string" || fn.trim() === "") {
    return `${problem.slug}: missing functionName (required for Run/Submit to resolve an execution contract)`;
  }
  return null;
}

function checkJava(problem) {
  const code = problem.starterCode?.java;
  const declared = problem.returnType?.java;
  if (!code || !declared) return null;

  const match = code.match(JAVA_RETURN_RE);
  const actual = match?.[1]?.trim();
  if (actual && actual !== declared) {
    return `${problem.slug}: Java starter code declares return type "${actual}" but returnType.java says "${declared}"`;
  }
  if (!actual) {
    return `${problem.slug}: returnType.java is "${declared}" but no method signature could be matched in the Java starter code`;
  }
  return null;
}

function checkCpp(problem) {
  const code = problem.starterCode?.cpp;
  const declared = problem.returnType?.cpp;
  if (!code || !declared) return null;

  const fnName = problem.functionName;
  const lineRe = fnName
    ? new RegExp(`^\\s*([\\w:<>,]+(?:\\s+[\\w:<>,]+)*)\\s+${fnName}\\s*\\(`)
    : /^\s*([\w:<>,]+(?:\s+[\w:<>,]+)*)\s+\w+\s*\(/;
  const line = code.split("\n").find((l) => lineRe.test(l));
  const actual = line?.match(lineRe)?.[1]?.trim();

  if (actual && actual !== declared) {
    return `${problem.slug}: C++ starter code declares return type "${actual}" but returnType.cpp says "${declared}"`;
  }
  if (!actual) {
    return `${problem.slug}: returnType.cpp is "${declared}" but no method signature could be matched in the C++ starter code`;
  }
  return null;
}

function cReturnTypeLineRegex(fnName) {
  return new RegExp(`^\\s*([\\w*]+(?:\\s+[\\w*]+)*)\\s+${fnName}\\s*\\(`);
}

function checkC(problem) {
  const code = problem.starterCode?.c;
  const declared = problem.returnType?.c;
  if (!code || !declared) return null;

  const lineRe = cReturnTypeLineRegex(problem.functionName);
  const line = code.split("\n").find((l) => lineRe.test(l));
  const actual = line?.match(lineRe)?.[1]?.trim();

  if (actual && actual !== declared) {
    return `${problem.slug}: C starter code declares return type "${actual}" but returnType.c says "${declared}"`;
  }
  if (!actual) {
    return `${problem.slug}: returnType.c is "${declared}" but no function signature could be matched in the C starter code`;
  }
  return null;
}

const SUPPORTED_C_RETURN_TYPES = new Set([
  "int", "long long", "double", "bool", "int*", "char*", "int**", "char**", "void",
]);

function checkCReturnTypeSupported(problem) {
  const code = problem.starterCode?.c;
  if (!code) return null;

  const fnName = problem.functionName;
  const lineRe = fnName ? cReturnTypeLineRegex(fnName) : null;
  const line = lineRe ? code.split("\n").find((l) => lineRe.test(l)) : null;
  const actualToken = line?.match(lineRe)?.[1]?.trim();
  const effective = problem.returnType?.c || actualToken || inferCReturnType(code);

  if (!SUPPORTED_C_RETURN_TYPES.has(effective)) {
    return (
      `${problem.slug}: C return type "${effective}" is not one of languageDrivers/c.js's ` +
      `supported return shapes (${[...SUPPORTED_C_RETURN_TYPES].join(", ")}) — generate() would ` +
      `silently fall through to its scalar-else branch and print the wrong result. Either declare ` +
      `a returnType.c the driver DOES support, extend the driver first, or remove starterCode.c ` +
      `for this problem until it can be supported correctly.`
    );
  }
  return null;
}

function checkCArrayParamTypeSafety(problem) {
  const code = problem.starterCode?.c;
  if (!code) return [];

  const declaredParamTypes = problem.paramTypes?.c || {};
  const testcases = [...(problem.testcases || []), ...(problem.hiddentestcases || [])];
  const errors = [];
  const flaggedKeys = new Set();

  for (const testcase of testcases) {
    for (const [key, value] of Object.entries(testcase.input || {})) {
      if (flaggedKeys.has(key)) continue;
      const isNumericArray =
        Array.isArray(value) &&
        value.length > 0 &&
        !Array.isArray(value[0]) &&
        value.every((entry) => typeof entry === "number");
      if (!isNumericArray) continue;

      const hasNonInteger = value.some((entry) => !Number.isInteger(entry));
      if (!hasNonInteger) continue;

      const effectiveType = inferCType(value, declaredParamTypes[key]);
      if (effectiveType !== "double[]") {
        flaggedKeys.add(key);
        errors.push(
          `${problem.slug}: parameter "${key}" contains non-integer values in at least one testcase ` +
            `but its C contract resolves to "${effectiveType}" — real-valued inputs require ` +
            `paramTypes.c.${key} = "double[]" or equivalent safe inference.`
        );
      }
    }
  }
  return errors;
}

const DEFERRED_DESIGN_PROBLEM_SLUGS = new Set([
  "binary-search-tree-iterator",
  "random-pick-with-weight",
]);

const JAVA_RED_FLAGS = [
  { pattern: /\bObject\s+\w+\s*=/, reason: "declares an argument as Object (won't compile against a primitive/String parameter)" },
  { pattern: /\[\]\s*\w+\s*=\s*\[/, reason: "declares an array using an invalid `[` bracket literal instead of `{`" },
];

function checkArgumentGeneration(problem) {
  if (problem.operationSequence?.enabled) return [];
  if (DEFERRED_DESIGN_PROBLEM_SLUGS.has(problem.slug)) return [];

  const testcase = problem.testcases?.[0] || problem.hiddentestcases?.[0];
  if (!testcase) return [];
  const errors = [];

  if (problem.starterCode?.java) {
    try {
      const javaCode = generateDriverCode("java", problem.starterCode.java, testcase.input, problem.functionName, problem.returnType?.java, problem.paramTypes?.java);
      for (const { pattern, reason } of JAVA_RED_FLAGS) {
        if (pattern.test(javaCode)) errors.push(`${problem.slug}: generated Java driver ${reason}`);
      }
    } catch (err) {
      errors.push(`${problem.slug}: generateDriverCode threw for Java — ${err.message}`);
    }
  }

  if (problem.starterCode?.cpp) {
    try {
      generateDriverCode("cpp", problem.starterCode.cpp, testcase.input, problem.functionName, problem.returnType?.cpp, problem.paramTypes?.cpp);
    } catch (err) {
      errors.push(`${problem.slug}: generateDriverCode threw for C++ — ${err.message}`);
    }
  }

  if (problem.starterCode?.c) {
    try {
      generateDriverCode("c", problem.starterCode.c, testcase.input, problem.functionName, problem.returnType?.c, problem.paramTypes?.c);
    } catch (err) {
      errors.push(`${problem.slug}: generateDriverCode threw for C — ${err.message}`);
    }
  }

  return errors;
}

function checkOperationSequenceGeneration(problem) {
  if (!problem.operationSequence?.enabled) return [];

  const errors = [];
  const testcases = [...(problem.testcases || []), ...(problem.hiddentestcases || [])];
  for (const [i, testcase] of testcases.entries()) {
    const shape = identifyOperationSequence(testcase.input);
    if (!shape) {
      errors.push(`${problem.slug}: testcase #${i} doesn't match either known operation-sequence shape (see operationSequenceShape.js)`);
      continue;
    }

    for (const lang of SUPPORTED_LANGUAGE_KEYS) {
      if (!problem.starterCode?.[lang]) continue;
      try {
        generateOperationSequenceDriver(lang, problem.starterCode[lang], shape, problem.functionName, problem.operationSequence.resultMode);
      } catch (err) {
        errors.push(`${problem.slug}: generateOperationSequenceDriver threw for ${lang} on testcase #${i} — ${err.message}`);
      }
    }
  }
  return errors;
}

function checkOperationSequenceCSupported(problem) {
  if (!problem.operationSequence?.enabled) return null;
  const cCode = problem.starterCode?.c;
  const cppCode = problem.starterCode?.cpp;
  if (!cCode || !cppCode) return null;

  const SUPPORTED = new Set(["void", "bool", "int", "long", "long long", "double", "char*", "string"]);
  const methodRe = /(\w[\w<>,\s&*]*)\s+(\w+)\s*\([^)]*\)\s*\{/g;
  let m;
  const badMethods = [];
  while ((m = methodRe.exec(cppCode))) {
    const [, ret, name] = m;
    if (name === problem.functionName) continue;
    const returnType = ret.trim();
    if (!SUPPORTED.has(returnType)) badMethods.push(`${name}() returns "${returnType}", which generateOperationSequence() cannot represent`);
  }

  return badMethods.length
    ? `${problem.slug}: has starterCode.c for an operation-sequence problem with unsupported method return type(s): ${badMethods.join("; ")}`
    : null;
}

export function validateProblems(problemList) {
  return problemList.flatMap((p) => [
    checkFunctionName(p),
    checkJava(p),
    checkCpp(p),
    checkC(p),
    checkCReturnTypeSupported(p),
    checkOperationSequenceCSupported(p),
    ...checkCArrayParamTypeSafety(p),
    ...checkArgumentGeneration(p),
    ...checkOperationSequenceGeneration(p),
  ].filter(Boolean));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = await loadProblemsFromFolders();
  const { default: missions } = await import("../../src/data/code-club-edition/index.js");
  const errors = [...validateProblems(problems), ...validateProblems(missions)];

  if (errors.length) {
    console.error(`Found ${errors.length} problem contract mismatch(es):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`Validated ${problems.length} problems and ${missions.length} Code Club Edition missions — no contract mismatches.`);
  process.exit(0);
}

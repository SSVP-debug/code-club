/**
 * validateProblemContracts.js
 *
 * Read-only sanity checks for every problem in src/data/problems.js:
 *
 *  1. checkJava/checkCpp — if a problem declares an explicit
 *     returnType.java / returnType.cpp contract (see
 *     backend/models/Problem.js), verify the starter code for that
 *     language actually declares the same return type. Catches the class
 *     of bug where starter code says `int` but the contract (and therefore
 *     the generated runner) says `long`, or vice versa.
 *
 *  2. checkArgumentGeneration — actually runs generateDriverCode() for
 *     java/cpp against the problem's own testcase data and scans the
 *     output for the structural red flags that mean the generated code
 *     will not compile: a declaration typed `Object` (the old
 *     string/boolean/2D-array catch-all — see audit finding P0-1) or an
 *     array declared with an invalid `[...]` bracket literal instead of a
 *     `{...}` brace literal. Added during the execution-pipeline audit —
 *     previously nothing checked that a problem's *arguments* (as opposed
 *     to its return type) would actually generate compilable code; this is
 *     exactly why the P0-1 bug went unnoticed for as long as it did.
 *
 * This is deliberately a lightweight/regex-based check, not a real
 * Java/C++ compiler invocation — it only needs to catch the specific
 * generation-level defects this audit found, not validate general syntax
 * or actually compile anything (that would need a sandboxed toolchain,
 * out of scope for a fast pre-merge/pre-seed check).
 *
 * Usage:
 *   node backend/scripts/validateProblemContracts.js
 *
 * Exit code 0 = all declared contracts are consistent and every problem's
 *               arguments generate structurally-valid Java/C++.
 * Exit code 1 = at least one mismatch found (details printed to stderr).
 */
import problems from "../../src/data/problems.js";
import { generateDriverCode } from "../utils/generateDriverCode.js";
import { generateOperationSequenceDriver } from "../utils/operationSequenceDriver.js";
import { identifyOperationSequence } from "../utils/operationSequenceShape.js";
import { SUPPORTED_LANGUAGE_KEYS } from "../config/languages.js";
import { inferReturnType as inferCReturnType } from "../utils/languageDrivers/c.js";

const JAVA_RETURN_RE = /public\s+([\w<>[\],]+(?:\s*<[\w<>[\],\s]*>)?)\s+\w+\s*\(/;

// Execution-contract audit (Fri Aug 13 "single-number" postmortem, item
// #9): every problem that reaches Run/Submit needs a non-empty
// functionName — runHandler/submitHandler both resolve it exclusively
// from Problem.functionName (see judgeController.js) and neither has any
// fallback if it's missing. A problem with no functionName isn't a
// contract *mismatch* like the checks below catch — it's a contract
// that was never written at all, so it gets its own check rather than
// silently producing an "undefined" driver invocation the first time a
// student clicks Run.
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

// C++ access specifiers ("public:") live on their own line above the method,
// so — unlike Java — the return type must be extracted from a *single line*
// rather than by scanning backward across newlines, or a multi-line capture
// sweeps the access-specifier line in with the real type.
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

// C free functions have no access specifier (unlike Java's `public`) and
// no class scope to disambiguate a line (unlike C++'s `public:` block) —
// closer to Java's shape than C++'s, but Java's regex hardcodes the
// `public` keyword, which doesn't exist in C. Built per-functionName the
// same way checkCpp's line regex is, since that's the only reliable
// anchor for where the return type ends and the function name begins
// (a bare structural regex over `\w+\s*\(` alone can't tell "int*
// twoSum(" apart from a call expression inside the function body).
function cReturnTypeLineRegex(fnName) {
  return new RegExp(`^\\s*([\\w*]+(?:\\s+[\\w*]+)*)\\s+${fnName}\\s*\\(`);
}

function checkC(problem) {
  const code = problem.starterCode?.c;
  const declared = problem.returnType?.c;
  if (!code || !declared) return null;

  const fnName = problem.functionName;
  const lineRe = cReturnTypeLineRegex(fnName);
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

// The specific bug class Plan 012 (C language onboarding) exists to catch:
// languageDrivers/c.js's generate() has exactly one branch per return type
// in SUPPORTED_C_RETURN_TYPES below (int*, bool, char*, and a final
// scalar-else branch for int/long long/double). Anything NOT in that list
// — a 2D array, a string-array, any other pointer/struct shape — falls
// through to the final scalar-else branch silently: it still generates
// code that COMPILES (`${returnType} result = fn(...)`, printed with
// `%d`/`%lld`/`%f`), it just prints the wrong thing. Unlike Java/C++,
// where an unrecognized type still round-trips through `auto`/`Object`
// generically, C's driver has no generic fallback — so this check has no
// java/cpp equivalent and needs its own list here, kept in sync with
// generate()'s own branches by hand (there's no single shared export of
// "which return types this driver's generate() branches on" to derive it
// from — see languageDrivers/c.js if that stops being true).
const SUPPORTED_C_RETURN_TYPES = new Set(["int", "long long", "double", "bool", "int*", "char*"]);

function checkCReturnTypeSupported(problem) {
  const code = problem.starterCode?.c;
  if (!code) return null;

  // Resolution order: declared contract first; otherwise try to read the
  // REAL return-type token straight off the function signature (anchored
  // on functionName, same as checkC's mismatch check) rather than going
  // straight to the driver's own inferReturnType(). That distinction
  // matters here specifically: inferReturnType's regex is a short
  // whitelist that silently defaults to "int" for anything it doesn't
  // recognize (e.g. "int**") — trusting that default would make this
  // check pass for exactly the unsupported-shape case it exists to
  // catch. Reading the actual token first, and only falling back to
  // inferReturnType() if the signature itself can't be found, closes
  // that gap.
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

// languageTypes/c.js's inferCType() only detects array element type from
// the FIRST element's structural shape (string → char*[], boolean →
// bool[], anything else → int[]) — it has no branch for a non-integer
// number, so an array of doubles is silently typed `int[]`, truncating
// every value in the generated C literal. This has no Java/C++ analog
// (both languages' own inference already special-cases non-integer
// numeric arrays) — Plan 012 flagged this exact class of "compiles but
// wrong" risk, so it gets checked explicitly here rather than relying on
// paramTypes.c being remembered by hand for every problem that needs it.
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
        Array.isArray(value) && value.length > 0 && !Array.isArray(value[0]) && typeof value[0] === "number";
      if (!isNumericArray) continue;

      const hasNonInteger = value.some((v) => !Number.isInteger(v));
      if (hasNonInteger && !declaredParamTypes[key]) {
        flaggedKeys.add(key);
        errors.push(
          `${problem.slug}: parameter "${key}" contains non-integer values in at least one testcase ` +
            `but paramTypes.c has no explicit entry for it — inferCType() will type it "int[]" and ` +
            `truncate every value. Declare paramTypes.c.${key} = "double[]" explicitly.`
        );
      }
    }
  }
  return errors;
}

// "Design" problems (constructor + operation-sequence contract, e.g.
// LRUCache, MinStack) don't fit the single-call argument-generation check
// below — they're validated separately by checkOperationSequenceGeneration.
// Two problems remain explicitly excluded from BOTH checks, tracked as
// known follow-up work rather than silently ignored:
//   - binary-search-tree-iterator: constructor takes a tree (`root`), and
//     no driver (Java/C++/JS) has tree-construction support yet — only
//     Python's build_tree heuristic exists, and only for the single-call
//     contract (audit finding P2-1). Needs that generalized first.
//   - random-pick-with-weight: its own stored testcases have
//     non-deterministic placeholder expectedOutput ("varies", "0-3") —
//     this problem needs a custom range/distribution checker, which this
//     judge doesn't have, not just an operation-sequence driver. Enabling
//     it here would just always fail against a placeholder string.
const DEFERRED_DESIGN_PROBLEM_SLUGS = new Set([
  "binary-search-tree-iterator",
  "random-pick-with-weight",
]);

// A declaration typed `Object` is the old String/boolean/2D-array
// catch-all that does not compile against a method expecting a primitive
// or String parameter (audit P0-1). An array declared with a `[` bracket
// literal instead of a `{` brace literal (e.g. `int[] x = [1,2];`) is not
// valid Java or C++ syntax at all.
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
      const javaCode = generateDriverCode(
        "java",
        problem.starterCode.java,
        testcase.input,
        problem.functionName,
        problem.returnType?.java,
        problem.paramTypes?.java
      );

      for (const { pattern, reason } of JAVA_RED_FLAGS) {
        if (pattern.test(javaCode)) {
          errors.push(`${problem.slug}: generated Java driver ${reason}`);
        }
      }
    } catch (err) {
      errors.push(`${problem.slug}: generateDriverCode threw for Java — ${err.message}`);
    }
  }

  if (problem.starterCode?.cpp) {
    try {
      generateDriverCode(
        "cpp",
        problem.starterCode.cpp,
        testcase.input,
        problem.functionName,
        problem.returnType?.cpp,
        problem.paramTypes?.cpp
      );
    } catch (err) {
      errors.push(`${problem.slug}: generateDriverCode threw for C++ — ${err.message}`);
    }
  }

  // C's generate() has no try/catch-based exception path of its own (see
  // languageDrivers/c.js's header comment — a bad generation here means a
  // real compile failure or crash at Judge0 time, not a caught runtime
  // error), so actually invoking it against the problem's own testcase
  // is the only way this script catches a cDeclaration()/generate()
  // throw before a student does. The return-type-whitelist check
  // (checkCReturnTypeSupported) and the array-param-safety check
  // (checkCArrayParamTypeSafety) above catch the "compiles but wrong"
  // class; this generation call just catches outright throws.
  if (problem.starterCode?.c) {
    try {
      generateDriverCode(
        "c",
        problem.starterCode.c,
        testcase.input,
        problem.functionName,
        problem.returnType?.c,
        problem.paramTypes?.c
      );
    } catch (err) {
      errors.push(`${problem.slug}: generateDriverCode threw for C — ${err.message}`);
    }
  }

  return errors;
}

// Validates every operation-sequence problem (Problem.operationSequence.enabled)
// by actually running identifyOperationSequence + generateOperationSequenceDriver
// against every one of the problem's own testcases, for every language that
// has starter code. Catches shape-detection failures (a testcase that
// doesn't match either known storage shape) and generator exceptions
// before they reach a real submission. Java is included even though this
// script can't compile it (no JDK dependency for a fast pre-merge check) —
// generation-time exceptions (e.g. a malformed shape) still surface here.
function checkOperationSequenceGeneration(problem) {
  if (!problem.operationSequence?.enabled) return [];

  const errors = [];
  const testcases = [...(problem.testcases || []), ...(problem.hiddentestcases || [])];

  for (const [i, testcase] of testcases.entries()) {
    const shape = identifyOperationSequence(testcase.input);
    if (!shape) {
      errors.push(
        `${problem.slug}: testcase #${i} doesn't match either known operation-sequence shape (see operationSequenceShape.js)`
      );
      continue;
    }

    for (const lang of SUPPORTED_LANGUAGE_KEYS) {
      // Phase 6 (Language Expansion, plan 010) follow-up: this used to
      // hardcode ["python", "javascript", "java", "cpp"] — meaning this
      // exact script would NOT have caught operationSequenceDriver.js
      // missing a `typescript` branch entirely (a real bug found and
      // fixed this session; see that file's own comment). Derived from
      // the registry now specifically so this class of gap gets caught
      // automatically for the next language too, rather than relying on
      // someone remembering to update this literal array.
      if (!problem.starterCode?.[lang]) continue;
      try {
        generateOperationSequenceDriver(
          lang, problem.starterCode[lang], shape, problem.functionName, problem.operationSequence.resultMode
        );
      } catch (err) {
        errors.push(`${problem.slug}: generateOperationSequenceDriver threw for ${lang} on testcase #${i} — ${err.message}`);
      }
    }
  }

  return errors;
}

// languageDrivers/c.js's generateOperationSequence() (Plan 012 Batch 5)
// now correctly supports void, bool, int, long/long long, double, and
// char* method results — it derives each method's real return type from
// the starter code at generation time and throws there for anything
// else, rather than silently mishandling it (see that function's own
// comment for the full history: void used to be a hard compile error,
// bool used to print 1/0 and fail exact-match grading against JSON
// true/false — both fixed). This check now only needs to catch what the
// driver genuinely still can't represent: an array, string-array, or
// struct-pointer (ListNode*/TreeNode*) method result. Kept as a static
// pre-check (rather than relying solely on checkOperationSequenceGeneration's
// runtime throw) so a bad problem is caught by a fast source-text scan,
// not only by actually invoking code generation.
function checkOperationSequenceCSupported(problem) {
  if (!problem.operationSequence?.enabled) return null;
  const cCode = problem.starterCode?.c;
  if (!cCode) return null;

  const cppCode = problem.starterCode?.cpp;
  if (!cppCode) return null;

  const SUPPORTED = new Set(["void", "bool", "int", "long", "long long", "double", "char*", "string"]);
  const methodRe = /(\w[\w<>,\s&*]*)\s+(\w+)\s*\([^)]*\)\s*\{/g;
  let m;
  const badMethods = [];
  while ((m = methodRe.exec(cppCode))) {
    const [, ret, name] = m;
    if (name === problem.functionName) continue; // constructor
    const returnType = ret.trim();
    if (!SUPPORTED.has(returnType)) {
      badMethods.push(`${name}() returns "${returnType}", which generateOperationSequence() cannot represent`);
    }
  }

  if (badMethods.length > 0) {
    return `${problem.slug}: has starterCode.c for an operation-sequence problem with unsupported method return type(s): ${badMethods.join("; ")}`;
  }
  return null;
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

// Only run as a CLI script, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: missions } = await import(
    "../../src/data/code-club-edition/index.js"
  );

  const errors = [
    ...validateProblems(problems),
    ...validateProblems(missions),
  ];

  if (errors.length) {
    console.error(`Found ${errors.length} problem contract mismatch(es):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(
    `Validated ${problems.length} problems and ${missions.length} Code Club Edition missions — no contract mismatches.`
  );
  process.exit(0);
}
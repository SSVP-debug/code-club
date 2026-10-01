/**
 * generateDriverCode.js
 *
 * Single source of truth for turning (userCode, testcaseInput, functionName,
 * returnType, paramTypes) into a self-contained, compilable program per
 * language. There is only one copy of this file in the repo (backend/) —
 * the frontend never duplicates it, it only references the return-type
 * contract by name in comments (see src/data/problems.js). The previous
 * "frontend and backend copies must remain identical" header comment here
 * was stale and has been removed as part of the execution-pipeline audit.
 *
 * Plan 011 (Batch 3): the per-language template bodies that used to live
 * directly in this file's `if (language === "...")` chain now live in
 * backend/utils/languageDrivers/<key>.js — see that directory's index.js
 * for why. This file keeps everything that was already language-agnostic
 * (arg normalization, debug logging, the public call shape) and dispatches
 * the language-specific part through the registry.
 *
 * Plan 014: explicit ListNode contracts are dispatched to structuredDrivers
 * before the ordinary scalar/array language drivers. This keeps recursive
 * pointer-structure handling out of the existing scalar type modules.
 */
import { getDriver } from "./languageDrivers/index.js";
import * as structuredDrivers from "./structuredDrivers.js";

// Re-exported for backward compatibility: both were previously defined
// directly in this file and imported from here by
// generateDriverCode.test.js and (formerly) operationSequenceDriver.js.
// Now they live with their language's own module (see
// languageDrivers/javascript.js / languageDrivers/python.js) since that's
// where they're actually used — this file just re-exports the same
// public names from their new home so no external import needs to change.
export { formatJsArg } from "./languageDrivers/javascript.js";
export { formatPythonArg } from "./languageDrivers/python.js";

function normalizeTestcaseInput(testcaseInput) {
  if (
    typeof testcaseInput === "object" &&
    testcaseInput !== null &&
    !Array.isArray(testcaseInput)
  ) {
    return testcaseInput;
  }
  console.warn("[generateDriverCode] Expected object testcase input, got:", testcaseInput);
  return {};
}

function buildCallArgs(testcaseInput) {
  const normalized = normalizeTestcaseInput(testcaseInput);
  return Object.entries(normalized).map(([key, value]) => ({ key, value }));
}

// Regex-based inference is a FALLBACK ONLY, for problems that don't declare
// an explicit `returnType` contract (see backend/models/Problem.js). It is
// intentionally a short whitelist and will always miss some valid type —
// any problem whose natural return type isn't on this list, or isn't on the
// list of common types below, MUST declare `returnType` explicitly rather
// than relying on this regex. Do not treat extending this list as a
// substitute for declaring the contract on the problem itself.
//
// Plan 011 (Batch 3): the actual per-language regex now lives as an
// optional `inferReturnType(userCode)` export on that language's own
// driver module (today: languageDrivers/java.js, languageDrivers/cpp.js —
// the only two in STATICALLY_TYPED_LANGUAGE_KEYS). This dispatcher just
// calls it via the same registry generate()/generateOperationSequence()
// use, so a future statically-typed language's fallback-inference regex
// lives in exactly one place, not a third hardcoded branch here.
function inferReturnType(userCode, language, declaredReturnType) {
  if (declaredReturnType) return declaredReturnType;

  const driver = getDriver(language);
  return driver?.inferReturnType?.(userCode) ?? null;
}

export function generateDriverCode(language, userCode, testcaseInput, functionName, declaredReturnType, declaredParamTypes) {
  const fn = functionName || "solve";
  const returnType = inferReturnType(userCode, language, declaredReturnType);
  const args = buildCallArgs(testcaseInput);
  // Per-language declared argument types (Problem.paramTypes[language]),
  // e.g. { s: "String", strs: "String[]" }. Optional — languageTypes'
  // inferJavaType/inferCppType fall back to structural inference from the
  // testcase value for any key not present here. See audit finding P0-1.
  const paramTypes = declaredParamTypes || {};
  // Gated behind an explicit opt-in flag rather than "NODE_ENV !==
  // production" (audit finding P2-3: the old check fired in every
  // non-production environment — staging, test, CI — not just local dev,
  // which is noisier than intended and not what "isDev" was meant to
  // mean). Set DRIVER_DEBUG=1 to see per-generation input/args/invocation
  // logging when actually debugging a driver-generation issue.
  const debugEnabled =
    typeof process !== "undefined" && process.env.DRIVER_DEBUG === "1";

  if (debugEnabled) console.log("[generateDriverCode] TESTCASE INPUT:", testcaseInput);
  if (debugEnabled) console.log("[generateDriverCode] ARGS:", args);

  const driver = getDriver(language);
  if (!driver) {
    throw new Error(
      `Unsupported language: ${language}`
    );
  }

  const structured = structuredDrivers.generate({
    language,
    userCode,
    fn,
    returnType,
    args,
    paramTypes,
  });
  if (structured) return structured;

  return driver.generate({ userCode, fn, returnType, args, paramTypes, debugEnabled });
}
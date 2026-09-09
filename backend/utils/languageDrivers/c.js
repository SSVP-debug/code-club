/**
 * languageDrivers/c.js
 *
 * Plan 011 follow-up: adding C. Structurally wired in (registered in
 * backend/config/languages.js with `enabled: false`, both required
 * functions present so languageDrivers/index.js's contract check passes),
 * but NOT a drop-in the way TypeScript was — read this header fully
 * before writing the first real C starter code, and see
 * backend/utils/languageTypes/c.js's header for the type-system side of
 * the same story.
 *
 * Real, documented gaps vs. the other four languages:
 *
 *   1. Array-return support covers exactly one shape: a function
 *      returning `int*` with a trailing `int* returnSize` out-parameter
 *      (the standard LeetCode-C convention). Any other returned shape
 *      (char**, a struct, 2D array) is unsupported — see generate().
 *   2. No exception handling. Every other language's driver wraps the
 *      call in try/catch and prints "RUNTIME_ERROR:<message>" on the
 *      stdout stream that submissionController/judgeController compares
 *      against expected output. C has no such mechanism — a bug in user
 *      code that would be a caught exception in Java/Python/JS instead
 *      becomes a real crash (segfault, abort) that Judge0 reports via its
 *      own status field (SIGSEGV, etc.), not via this stdout convention.
 *      Anything consuming Judge0's response for C must handle that status
 *      separately rather than assuming errors always show up as a
 *      RUNTIME_ERROR-prefixed stdout line.
 *   3. generateOperationSequence() supports scalar (long-representable:
 *      int/long/bool/double) and `char*` (string) return values — see
 *      that function's own comment for how it derives each method's
 *      real return type from the starter code at generation time
 *      (Plan 012 Batch 5). An array, string-array, or struct-pointer
 *      method result is still unsupported and throws at generation time
 *      rather than being silently mishandled.
 */
import { cDeclaration } from "../languageTypes/c.js";

/**
 * inferReturnType — regex-based FALLBACK ONLY, for problems that don't
 * declare an explicit `returnType` contract (see backend/models/
 * Problem.js). Same posture as java.js/cpp.js's own inferReturnType: a
 * short, intentionally incomplete whitelist. Any C solution returning
 * something outside this list MUST declare `returnType.c` explicitly.
 */
export function inferReturnType(userCode) {
  const match = userCode.match(
    /(int\*|char\*|long long|double|bool|int)\s+\w+\s*\(/
  );
  return match?.[1] || "int";
}

/**
 * generate — single-call driver template.
 */
export function generate({ userCode, fn, returnType, args, paramTypes }) {
  const declarations = args
    .map(({ key, value }) => cDeclaration(key, value, paramTypes[key]))
    .join("\n  ");

  // C's array parameters don't carry their own length — the standard
  // LeetCode-C convention passes an explicit `<key>Size` right after each
  // array argument (`int* nums, int numsSize, ...`). cDeclaration()
  // always declares that companion variable for an array arg (see
  // languageTypes/c.js); this is where it gets threaded into the call.
  const callArgs = args
    .map(({ key, value }) => (Array.isArray(value) ? `${key}, ${key}Size` : key))
    .join(", ");

  const commonIncludes = `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>`;

  // The one supported array-return shape: `int*` with a trailing
  // `int* returnSize` out-parameter. See this file's header comment for
  // why nothing else is supported.
  if (returnType === "int*") {
    return `
${commonIncludes}

${userCode}

int main() {
  ${declarations}
  int returnSize;
  int* result = ${fn}(${callArgs}${callArgs ? ", " : ""}&returnSize);
  printf("[");
  for (int i = 0; i < returnSize; i++) {
    if (i) printf(",");
    printf("%d", result[i]);
  }
  printf("]\\n");
  return 0;
}
`;
  }

  if (returnType === "bool") {
    return `
${commonIncludes}

${userCode}

int main() {
  ${declarations}
  bool result = ${fn}(${callArgs});
  printf(result ? "true" : "false");
  printf("\\n");
  return 0;
}
`;
  }

  if (returnType === "char*") {
    return `
${commonIncludes}

${userCode}

int main() {
  ${declarations}
  char* result = ${fn}(${callArgs});
  printf("\\"%s\\"\\n", result);
  return 0;
}
`;
  }

  // Remaining scalar cases: int, long long, double.
  const printFormat = returnType === "long long" ? "%lld" : returnType === "double" ? "%f" : "%d";

  return `
${commonIncludes}

${userCode}

int main() {
  ${declarations}
  ${returnType} result = ${fn}(${callArgs});
  printf("${printFormat}\\n", result);
  return 0;
}
`;
}

/**
 * generateOperationSequence — constructor + method-sequence replay
 * driver, using a struct + prefixed-function convention in place of a
 * class (C has neither): `typedef struct {...} ClassName;` plus
 * `ClassName* ClassName_create(...)` and `<ReturnType>
 * ClassName_<method>(ClassName* self, ...)` functions.
 *
 * Plan 012 Batch 5: previously SCALAR-CAST-TO-`long` ONLY, which had two
 * real bugs discovered while backfilling Batch 4's design problems (see
 * PROGRESS.md's Batch 4 entry for how each was confirmed against real
 * compiled/run C, not just read from source):
 *   1. `(long) voidMethod(...)` is a hard C compile error — blocked 14
 *      of 17 design problems outright.
 *   2. `bool` results were cast to `long` and printed with `%ld`,
 *      producing `1`/`0` where `expectedOutput` (and every other
 *      language's driver) uses JSON `true`/`false` — a real grading
 *      failure for `bool`-returning methods, not cosmetic.
 *
 * C has neither Java's reflection nor C++'s SFINAE/decltype to detect a
 * method's return type generically at compile time — but unlike a truly
 * dynamic-dispatch problem, EVERY op call's target method is already
 * known BY NAME at driver-GENERATION time (this function runs in
 * Node, with the full `userCode` string available), so the fix doesn't
 * need a runtime mechanism at all: read the method's real return type
 * straight off its own signature line in `userCode` (same anchored
 * per-function-name regex approach `checkC`/`checkCReturnTypeSupported`
 * already use in validateProblemContracts.js), and generate different
 * code per call depending on what that type actually is.
 *
 * Supports: `void`, `bool`, `int`, `long`/`long long`, `double`, `char*`
 * — the same whitelist `generate()`'s single-call driver supports,
 * applied per-method instead of once. Anything else THROWS at
 * generation time rather than silently falling back to the old
 * cast-to-long behavior — the exact "compiles but wrong" failure mode
 * this batch exists to close, not reopen with a different default.
 *
 * `resultMode` ("all" vs "returningOnly") now actually does something
 * for C: a `void` call contributes a `null` entry only when `"all"`,
 * matching every other language's driver.
 */
function operationMethodReturnType(userCode, className, methodName) {
  const fnName = `${className}_${methodName}`;
  const lineRe = new RegExp(`^\\s*([\\w*]+(?:\\s+[\\w*]+)*)\\s+${fnName}\\s*\\(`);
  const line = userCode.split("\n").find((l) => lineRe.test(l));
  const token = line?.match(lineRe)?.[1]?.trim();
  if (!token) {
    throw new Error(
      `generateOperationSequence: could not find a "${fnName}(" function signature in the C starter code to determine ${methodName}()'s return type`
    );
  }
  return token;
}

export function generateOperationSequence({ userCode, className, constructorArgs, opNames, opArgsList, resultMode }) {
  const ctorDecls = constructorArgs.map(([k, v]) => cDeclaration(k, v)).join("\n  ");
  const ctorCallArgs = constructorArgs
    .map(([k, v]) => (Array.isArray(v) ? `${k}, ${k}Size` : k))
    .join(", ");

  const includeVoid = resultMode === "all";

  const opBlocks = opNames
    .map((name, i) => {
      const opArgs = opArgsList[i];
      const argDecls = opArgs
        .map((v, j) => cDeclaration(`_op${i}_arg${j}`, v))
        .join("\n    ");
      const callArgs = opArgs
        .map((v, j) => (Array.isArray(v) ? `_op${i}_arg${j}, _op${i}_arg${j}Size` : `_op${i}_arg${j}`))
        .join(", ");
      const fullCallArgs = `_instance${callArgs ? ", " + callArgs : ""}`;
      const call = `${className}_${name}(${fullCallArgs})`;

      const returnType = operationMethodReturnType(userCode, className, name);
      const emitSeparator = `if (!_first) printf(","); _first = 0;`;

      if (returnType === "void") {
        if (!includeVoid) {
          return `  {\n    ${argDecls}\n    ${call};\n  }`;
        }
        return `  {\n    ${argDecls}\n    ${call};\n    ${emitSeparator} printf("null");\n  }`;
      }
      if (returnType === "bool") {
        return `  {\n    ${argDecls}\n    bool _r = ${call};\n    ${emitSeparator} printf(_r ? "true" : "false");\n  }`;
      }
      if (returnType === "char*") {
        return `  {\n    ${argDecls}\n    char* _r = ${call};\n    ${emitSeparator} printf("\\"%s\\"", _r);\n  }`;
      }
      if (returnType === "int" || returnType === "long" || returnType === "long long" || returnType === "double") {
        // Matches generate()'s own print-format mapping exactly, applied
        // per-call instead of once — same whitelist, same formatting
        // convention, just now scoped to a single method's real type
        // rather than the whole driver's one return value.
        const printFormat = returnType === "double" ? "%g" : returnType.includes("long") ? "%lld" : "%d";
        const castType = returnType === "double" ? "double" : returnType.includes("long") ? "long long" : "int";
        return `  {\n    ${argDecls}\n    ${castType} _r = (${castType}) ${call};\n    ${emitSeparator} printf("${printFormat}", _r);\n  }`;
      }

      // Anything else (an array, a string-array, a struct pointer) is
      // simply not representable in this JSON-array-of-scalars output
      // format — throw now, at generation time, rather than let it
      // silently fall through the way the pre-Batch-5 driver did for
      // bool/void.
      throw new Error(
        `generateOperationSequence: ${className}.${name}() returns "${returnType}", which is not a supported operation-sequence result type (void, bool, int, long long, double, char*)`
      );
    })
    .join("\n");

  return `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

${userCode}

int main() {
  ${ctorDecls}
  ${className}* _instance = ${className}_create(${ctorCallArgs});
  printf("[");
  int _first = 1;
${opBlocks}
  printf("]\\n");
  return 0;
}
`;
}
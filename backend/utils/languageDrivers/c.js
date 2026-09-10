/**
 * languageDrivers/c.js
 *
 * Plan 011 follow-up: adding C. Structurally wired in (registered in
 * backend/config/languages.js with `enabled: true` as of Plan 012 Batch
 * 6), with real, documented gaps vs. the other four languages:
 *
 *   1. Array-return support covers `int*` (1D), `int**` (2D, standard
 *      `returnSize`/`returnColumnSizes` convention), and `char**`
 *      (array of strings, `returnSize` convention). A returned struct
 *      or array of a type other than int/string is still unsupported.
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
 *   4. `ListNode*`/`TreeNode*` params and returns are NOT supported —
 *      this is a pre-existing, cross-language gap (confirmed neither
 *      java.js nor cpp.js has any struct-construction/serialization
 *      logic either — every ListNode/TreeNode problem in the catalog is
 *      currently unimplementable for actual submission in ANY language,
 *      not a C-specific shortfall). Real, cross-cutting driver work,
 *      deliberately out of Plan 012's scope — see
 *      plans/013-linked-list-tree-support-scoping.md.
 */
import { cDeclaration, resolveCDimensionality } from "../languageTypes/c.js";

/**
 * inferReturnType — regex-based FALLBACK ONLY, for problems that don't
 * declare an explicit `returnType` contract (see backend/models/
 * Problem.js). Same posture as java.js/cpp.js's own inferReturnType: a
 * short, intentionally incomplete whitelist. Any C solution returning
 * something outside this list MUST declare `returnType.c` explicitly.
 */
export function inferReturnType(userCode) {
  const match = userCode.match(
    /(int\*\*|char\*\*|int\*|char\*|long long|double|bool|void|int)\s+\w+\s*\(/
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
  // 1D array argument, or `<key>Rows, <key>ColSize` for a 2D array.
  // cDeclaration() always declares the matching companion variable(s)
  // (see languageTypes/c.js); this is where they get threaded into the
  // call.
  //
  // Plan 012 Batch 6: dimensionality is resolved via the SAME
  // `resolveCDimensionality` helper cDeclaration itself uses (declared
  // type first, raw value shape only as a fallback) — not by
  // independently re-inspecting the raw value here. Two real bugs, both
  // found by actually testing this catalog's own edge cases rather than
  // just the happy path: (1) previously this always appended `${key}Size`
  // regardless of dimension, which for any 2D array argument referenced
  // an undeclared variable (a real, gcc-confirmed compile error); (2) an
  // EMPTY array argument (`prerequisites: []` for a genuinely 2D
  // parameter — course-schedule, graph-valid-tree, etc. all have this)
  // is structurally indistinguishable from an empty 1D array by
  // `Array.isArray(value[0])` alone, so re-deriving dimensionality from
  // the raw value here — even after cDeclaration had already been fixed
  // to consult paramTypes.c — would still generate a call site that
  // disagreed with the declaration for that one testcase. Both call site
  // and declaration now consult the same declared-type-aware resolution.
  const callArgs = args
    .map(({ key, value }) => {
      const dim = resolveCDimensionality(value, paramTypes[key]);
      if (dim === "2d") return `${key}, ${key}Rows, ${key}ColSize`;
      if (dim === "1d") return `${key}, ${key}Size`;
      return key;
    })
    .join(", ");

  const commonIncludes = `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>`;

  // Element-level print expression for one entry of a declared array
  // variable, used by both the void-mutation branch below and reused in
  // spirit (though not code, since return values use dynamically-sized
  // pointers rather than a compile-time-known declared array) by the
  // int**/char** return branches. `int`/`bool`/`char*` are the only
  // element types cDeclaration ever produces (see languageTypes/c.js).
  function elementPrintStatement(elementType, expr) {
    if (elementType === "bool") return `printf(${expr} ? "true" : "false")`;
    if (elementType === "char*") return `printf("\\"%s\\"", ${expr})`;
    return `printf("%d", ${expr})`; // int
  }

  // Plan 012 Batch 6: void-return, in-place-mutation problems (rotate-
  // array, sort-colors, sudoku-solver, etc.) — pre-existing across every
  // language's generate(), not C-specific. Java's `${returnType} result
  // = solution.${fn}(...)` and C++'s `auto result = solution.${fn}(...)`
  // are BOTH invalid when the call is genuinely void (can't declare a
  // variable of type void, can't deduce auto from a void expression);
  // C's old default branch had the identical problem. The actual
  // expected output for these problems was never the return value at
  // all — it's the post-call state of whichever argument the function
  // mutates in place, so the fix is to print THAT instead of attempting
  // to capture a (nonexistent) return value.
  //
  // Convention: exactly one array-typed argument is required for this
  // to be unambiguous — every void-mutation problem in this catalog
  // mutates a single array/matrix parameter. Zero or more than one
  // array argument throws at generation time rather than guessing which
  // one to print.
  if (returnType === "void") {
    const arrayArgs = args.filter(({ value }) => Array.isArray(value));
    if (arrayArgs.length !== 1) {
      throw new Error(
        `generate(): "${fn}" returns void (an in-place-mutation problem) but has ${arrayArgs.length} array arguments — expected exactly 1 to know which one to print as the result`
      );
    }
    const { key, value } = arrayArgs[0];
    const declaredType = paramTypes[key];
    const dim = resolveCDimensionality(value, declaredType);
    const type =
      declaredType ||
      (dim === "2d"
        ? typeof value[0][0] === "string"
          ? "char*[][]"
          : "int[][]"
        : typeof value[0] === "string"
        ? "char*[]"
        : typeof value[0] === "boolean"
        ? "bool[]"
        : "int[]");

    const is2d = dim === "2d";
    const elementType = type.replace(/\[\]\[\]$|\[\]$/, "");

    const printLoop = is2d
      ? `printf("[");
  for (int _i = 0; _i < ${key}Rows; _i++) {
    if (_i) printf(",");
    printf("[");
    for (int _j = 0; _j < ${key}ColSize[_i]; _j++) {
      if (_j) printf(",");
      ${elementPrintStatement(elementType, `${key}[_i][_j]`)};
    }
    printf("]");
  }
  printf("]\\n");`
      : `printf("[");
  for (int _i = 0; _i < ${key}Size; _i++) {
    if (_i) printf(",");
    ${elementPrintStatement(elementType, `${key}[_i]`)};
  }
  printf("]\\n");`;

    return `
${commonIncludes}

${userCode}

int main() {
  ${declarations}
  ${fn}(${callArgs});
  ${printLoop}
  return 0;
}
`;
  }

  // 2D array return — the standard LeetCode-C convention:
  // `int** fn(..., int* returnSize, int** returnColumnSizes)`. Rows may
  // be ragged in general (hence a per-row returnColumnSizes array rather
  // than one shared column count), even though every current 2D-return
  // testcase in this catalog happens to be rectangular.
  if (returnType === "int**") {
    return `
${commonIncludes}

${userCode}

int main() {
  ${declarations}
  int returnSize;
  int* returnColumnSizes;
  int** result = ${fn}(${callArgs}${callArgs ? ", " : ""}&returnSize, &returnColumnSizes);
  printf("[");
  for (int i = 0; i < returnSize; i++) {
    if (i) printf(",");
    printf("[");
    for (int j = 0; j < returnColumnSizes[i]; j++) {
      if (j) printf(",");
      printf("%d", result[i][j]);
    }
    printf("]");
  }
  printf("]\\n");
  return 0;
}
`;
  }

  // Array-of-strings return: `char** fn(..., int* returnSize)`.
  if (returnType === "char**") {
    return `
${commonIncludes}

${userCode}

int main() {
  ${declarations}
  int returnSize;
  char** result = ${fn}(${callArgs}${callArgs ? ", " : ""}&returnSize);
  printf("[");
  for (int i = 0; i < returnSize; i++) {
    if (i) printf(",");
    printf("\\"%s\\"", result[i]);
  }
  printf("]\\n");
  return 0;
}
`;
  }

  // The one supported 1D array-return shape: `int*` with a trailing
  // `int* returnSize` out-parameter.
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
    .map(([k, v]) => {
      if (Array.isArray(v) && Array.isArray(v[0])) return `${k}, ${k}Rows, ${k}ColSize`;
      if (Array.isArray(v)) return `${k}, ${k}Size`;
      return k;
    })
    .join(", ");

  const includeVoid = resultMode === "all";

  const opBlocks = opNames
    .map((name, i) => {
      const opArgs = opArgsList[i];
      const argDecls = opArgs
        .map((v, j) => cDeclaration(`_op${i}_arg${j}`, v))
        .join("\n    ");
      const callArgs = opArgs
        .map((v, j) => {
          if (Array.isArray(v) && Array.isArray(v[0])) return `_op${i}_arg${j}, _op${i}_arg${j}Rows, _op${i}_arg${j}ColSize`;
          if (Array.isArray(v)) return `_op${i}_arg${j}, _op${i}_arg${j}Size`;
          return `_op${i}_arg${j}`;
        })
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
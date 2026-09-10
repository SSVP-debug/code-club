/**
 * c.js — shared C type inference + literal formatting.
 *
 * Mirrors languageTypes/cpp.js's role for C++, adapted for C's much
 * thinner type vocabulary. Two things C needs that C++ doesn't, both
 * documented in backend/config/languages.js's `c` entry:
 *
 *   1. Arrays don't carry their own length. Every array argument gets a
 *      companion `<key>Size` int declared alongside it (or `<key>Rows` /
 *      `<key>Cols` for a 2D array) — the standard LeetCode-C convention
 *      is a function signature like `int* twoSum(int* nums, int
 *      numsSize, int target, int* returnSize)`, and the driver (see
 *      languageDrivers/c.js) needs these companion variables to build
 *      that call correctly.
 *   2. A 2D array uses the real, standard LeetCode-C convention:
 *      `<Type>** key, int keyRows, int* keyColSize` — an array of
 *      independently-allocated row pointers plus a PER-ROW column-count
 *      array, not a single fixed-width 2D array type. A genuinely fixed
 *      `int matrix[3][4]` parameter type only type-checks against a
 *      matching column width, and this catalog's own testcases proved
 *      that's not safe to assume (several 2D problems have DIFFERENT
 *      column counts across their own testcases) — see cDeclaration()'s
 *      comment for the full story (Plan 012 Batch 6).
 *
 * Known, intentional limitation: only scalars, 1D arrays, and rectangular
 * 2D arrays of int/string/bool are covered. Extend this file (and its
 * test) the day a problem actually needs more — same posture
 * inferCppType/inferJavaType already take with their own short
 * whitelists, not an attempt at universal inference.
 */

export function escapeCString(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Infer the C type for a single value, preferring an explicitly declared
 * type (from Problem.paramTypes.c) over structural guessing.
 */
export function inferCType(value, declaredType) {
  if (declaredType) return declaredType;

  if (Array.isArray(value)) {
    if (value.length === 0) return "int[]";
    if (Array.isArray(value[0])) {
      if (typeof value[0][0] === "string") return "char*[][]";
      return "int[][]";
    }
    if (typeof value[0] === "string") return "char*[]";
    if (typeof value[0] === "boolean") return "bool[]";
    return "int[]";
  }

  if (typeof value === "boolean") return "bool";
  if (typeof value === "string") return "char*";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "int" : "double";
  }

  return "int";
}

function formatCScalar(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `"${escapeCString(value)}"`;
  return JSON.stringify(value);
}

/**
 * Format a value as a C literal — same brace-init syntax as C++ for
 * arrays (`{1, 2, 3}`, `{{1,2},{3,4}}`). Booleans need `<stdbool.h>`
 * (included by every languageDrivers/c.js template) for `true`/`false`
 * to be valid tokens.
 */
export function formatCValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "{}";
    if (Array.isArray(value[0])) {
      return `{${value.map((v) => formatCValue(v)).join(", ")}}`;
    }
    return `{${value.map((v) => formatCScalar(v)).join(", ")}}`;
  }
  return formatCScalar(value);
}

/**
 * Build the declaration line(s) for one argument in a C driver. Returns a
 * single string — the array cases embed their own companion-variable
 * line(s) with `\n  ` so the caller can just join every argument's
 * declaration with `\n  ` the same way cppDeclaration's caller does,
 * without needing to know which arguments are scalars vs. arrays.
 */
/**
 * Resolve whether an argument is scalar / 1D array / 2D array — needed
 * by both cDeclaration (below) and languageDrivers/c.js's call-arg
 * builders, and must be a SINGLE source of truth for both. Plan 012
 * Batch 6 found the real reason this can't just be
 * `Array.isArray(value[0])` on the raw testcase value: an EMPTY array
 * (`[]`) is structurally ambiguous — course-schedule's `prerequisites`,
 * graph-valid-tree's `edges`, etc. all have a legitimate "no
 * edges/pairs" empty-array testcase for a genuinely 2D parameter, and
 * `[][0]` is `undefined` regardless of which dimensionality was
 * intended. An explicit `declaredType` (paramTypes.c) is the only way to
 * disambiguate that case — and it only helps if BOTH cDeclaration and
 * the call-arg builder consult it the same way, rather than each
 * re-inspecting the raw value independently (which is exactly what let
 * this slip through initially: cDeclaration alone doesn't determine
 * how a value gets passed to the function, the call site does too).
 */
export function resolveCDimensionality(value, declaredType) {
  if (declaredType) {
    if (declaredType.endsWith("[][]")) return "2d";
    if (declaredType.endsWith("[]")) return "1d";
    return "scalar";
  }
  if (Array.isArray(value)) return Array.isArray(value[0]) ? "2d" : "1d";
  return "scalar";
}

export function cDeclaration(key, value, declaredType) {
  const type = inferCType(value, declaredType);
  const literal = formatCValue(value);
  const dimensionality = resolveCDimensionality(value, declaredType);

  if (dimensionality === "2d") {
    // 2D — Plan 012 Batch 6 correction: a genuinely fixed-size C array
    // (`int matrix[3][4] = {...}`) only type-checks against a function
    // parameter declaring the SAME trailing column count (a 2D array
    // parameter's declared column width is part of its type in C, unlike
    // its row count, which always decays to a pointer regardless of what
    // you write there) — and this catalog's own testcases confirmed the
    // real failure mode directly: `rotate-image`/`set-matrix-zeroes`/
    // `game-of-life`/`walls-and-gates` all have DIFFERENT column counts
    // across their own testcases (e.g. rotate-image: 3x3, 4x4, 1x1, 2x2).
    // The SAME starter-code signature has to work for every one of them,
    // so a fixed-column-width parameter type is simply wrong — it would
    // compile (possibly with only a warning) and then silently index
    // memory using the WRONG stride for any testcase whose column count
    // doesn't match the one baked into the signature.
    //
    // Fixed by using the real, standard LeetCode-C 2D convention instead:
    // `int** matrix` (an array of independently-allocated row pointers)
    // with `int matrixRows` and a PER-ROW `int matrixColSize[]` (not a
    // single shared column count) — this is also what handles a
    // genuinely ragged 2D array correctly, not just a rectangular one,
    // even though every current 2D testcase in this catalog happens to
    // be rectangular.
    const elementType = type.replace(/\[\]\[\]$/, "");
    const rows = value.length;
    const rowVars = value.map((row, i) => {
      const rowLiteral = formatCValue(row);
      return `${elementType} _${key}Row${i}[] = ${rowLiteral};`;
    });
    const rowPointers = value.map((_, i) => `_${key}Row${i}`).join(", ");
    const colSizes = value.map((row) => row.length).join(", ");
    return (
      rowVars.join("\n  ") +
      `\n  ${elementType}* ${key}[] = {${rowPointers}};` +
      `\n  int ${key}Rows = ${rows};` +
      `\n  int ${key}ColSize[] = {${colSizes}};`
    );
  }

  if (dimensionality === "1d") {
    const elementType = type.replace(/\[\]$/, "");
    return `${elementType} ${key}[] = ${literal};\n  int ${key}Size = ${value.length};`;
  }

  return `${type} ${key} = ${literal};`;
}
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
 * Numeric arrays are inferred from their element values. Integer arrays
 * become `int[]`; arrays containing any non-integer numeric value become
 * `double[]`. This keeps the inference safe for real-valued testcases
 * without requiring every such problem to carry redundant `paramTypes.c`
 * metadata, while an explicit declared type still always wins.
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
    if (typeof value[0] === "number") {
      return value.some((entry) => typeof entry !== "number" || !Number.isInteger(entry))
        ? "double[]"
        : "int[]";
    }
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

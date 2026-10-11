/**
 * Canonical comparison helpers for JSON-encoded problem testcases.
 * Object key order is not semantically meaningful; array order is.
 */
export function stableJsonStringify(value) {
  const normalize = (item) => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.keys(item).sort().map((key) => [key, normalize(item[key])])
      );
    }
    return item;
  };

  return JSON.stringify(normalize(value));
}

/**
 * Return duplicate testcase index pairs, retaining the first occurrence.
 * Indexes are zero-based so audit reports can map them to source files.
 */
export function findDuplicateTestcases(testcases) {
  if (!Array.isArray(testcases)) return [];

  const firstIndexByValue = new Map();
  const duplicates = [];

  testcases.forEach((testcase, index) => {
    const key = stableJsonStringify(testcase);
    if (firstIndexByValue.has(key)) {
      duplicates.push({ firstIndex: firstIndexByValue.get(key), duplicateIndex: index });
    } else {
      firstIndexByValue.set(key, index);
    }
  });

  return duplicates;
}

/** Count hidden cases that duplicate a visible case, independent of object key order. */
export function countTestcaseOverlaps(visible, hidden) {
  if (!Array.isArray(visible) || !Array.isArray(hidden)) return 0;
  const visibleValues = new Set(visible.map(stableJsonStringify));
  return hidden.filter((testcase) => visibleValues.has(stableJsonStringify(testcase))).length;
}

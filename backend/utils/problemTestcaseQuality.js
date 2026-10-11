/** Canonical comparison helpers for JSON-encoded problem testcases. */
export function stableJsonStringify(value) {
  const normalize = (item) => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, normalize(item[key])]));
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

export function findDuplicateTestcases(testcases) {
  if (!Array.isArray(testcases)) return [];
  const firstIndexByValue = new Map();
  const duplicates = [];
  testcases.forEach((testcase, index) => {
    const key = stableJsonStringify(testcase);
    if (firstIndexByValue.has(key)) duplicates.push({ firstIndex: firstIndexByValue.get(key), duplicateIndex: index });
    else firstIndexByValue.set(key, index);
  });
  return duplicates;
}

/** Flag inputs that have more than one distinct expected output. */
export function findConflictingTestcaseOutputs(testcases) {
  if (!Array.isArray(testcases)) return [];
  const byInput = new Map();
  testcases.forEach((testcase, index) => {
    if (!testcase || typeof testcase !== "object" || Array.isArray(testcase) ||
        !Object.prototype.hasOwnProperty.call(testcase, "input") ||
        !Object.prototype.hasOwnProperty.call(testcase, "expectedOutput")) return;
    const inputKey = stableJsonStringify(testcase.input);
    const outputKey = stableJsonStringify(testcase.expectedOutput);
    const group = byInput.get(inputKey) || { indexes: [], outputs: new Set() };
    group.indexes.push(index);
    group.outputs.add(outputKey);
    byInput.set(inputKey, group);
  });
  return [...byInput.entries()]
    .filter(([, group]) => group.outputs.size > 1)
    .map(([, group]) => ({ indexes: group.indexes, distinctOutputCount: group.outputs.size }));
}

export function countTestcaseOverlaps(visible, hidden) {
  if (!Array.isArray(visible) || !Array.isArray(hidden)) return 0;
  const visibleValues = new Set(visible.map(stableJsonStringify));
  return hidden.filter((testcase) => visibleValues.has(stableJsonStringify(testcase))).length;
}

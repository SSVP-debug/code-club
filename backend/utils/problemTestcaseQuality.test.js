import { describe, expect, it } from "vitest";
import { countTestcaseOverlaps, findConflictingTestcaseOutputs, findDuplicateTestcases, stableJsonStringify } from "./problemTestcaseQuality.js";

describe("problem testcase quality helpers", () => {
  it("canonicalizes nested object keys without changing array order", () => {
    expect(stableJsonStringify({ b: 2, a: { y: 1, x: 0 } })).toBe(stableJsonStringify({ a: { x: 0, y: 1 }, b: 2 }));
    expect(stableJsonStringify({ values: [1, 2] })).not.toBe(stableJsonStringify({ values: [2, 1] }));
  });
  it("finds duplicates despite different object-key order", () => {
    expect(findDuplicateTestcases([{ input: { a: 1, b: 2 }, expectedOutput: 3 }, { expectedOutput: 3, input: { b: 2, a: 1 } }])).toEqual([{ firstIndex: 0, duplicateIndex: 1 }]);
  });
  it("flags identical inputs with conflicting outputs", () => {
    expect(findConflictingTestcaseOutputs([{ input: { a: 1, b: 2 }, expectedOutput: 3 }, { expectedOutput: 4, input: { b: 2, a: 1 } }, { input: { a: 2 }, expectedOutput: 4 }])).toEqual([{ indexes: [0, 1], distinctOutputCount: 2 }]);
  });
  it("does not flag identical inputs with identical outputs", () => {
    expect(findConflictingTestcaseOutputs([{ input: { x: 1 }, expectedOutput: null }, { input: { x: 1 }, expectedOutput: null }])).toEqual([]);
  });
  it("ignores malformed records when checking conflicts", () => {
    expect(findConflictingTestcaseOutputs([null, [], { input: { x: 1 }])).toEqual([]);
  });
  it("counts visible-hidden overlap independent of object-key order", () => {
    expect(countTestcaseOverlaps([{ input: { a: 1, b: 2 }, expectedOutput: 3 }], [{ expectedOutput: 3, input: { b: 2, a: 1 } }])).toBe(1);
  });
  it("handles invalid collections safely", () => {
    expect(findDuplicateTestcases(null)).toEqual([]);
    expect(countTestcaseOverlaps(null, [])).toBe(0);
  });
});

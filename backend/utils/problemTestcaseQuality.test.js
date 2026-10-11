import { describe, expect, it } from "vitest";
import {
  countTestcaseOverlaps,
  findDuplicateTestcases,
  stableJsonStringify,
} from "./problemTestcaseQuality.js";

describe("problem testcase quality helpers", () => {
  it("canonicalizes object keys recursively without changing array order", () => {
    expect(stableJsonStringify({ b: 2, a: { y: 1, x: 0 } }))
      .toBe(stableJsonStringify({ a: { x: 0, y: 1 }, b: 2 }));
    expect(stableJsonStringify({ values: [1, 2] }))
      .not.toBe(stableJsonStringify({ values: [2, 1] }));
  });

  it("finds duplicate testcases when object keys appear in a different order", () => {
    const testcases = [
      { input: { nums: [1, 2], target: 3 }, expectedOutput: [0, 1] },
      { expectedOutput: [0, 1], input: { target: 3, nums: [1, 2] } },
      { input: { nums: [2, 3], target: 5 }, expectedOutput: [0, 1] },
      { input: { nums: [1, 2], target: 3 }, expectedOutput: [1, 0] },
    ];

    expect(findDuplicateTestcases(testcases)).toEqual([
      { firstIndex: 0, duplicateIndex: 1 },
    ]);
  });

  it("retains the earliest occurrence when a testcase repeats multiple times", () => {
    expect(findDuplicateTestcases([{ x: 1 }, { x: 1 }, { x: 1 }])).toEqual([
      { firstIndex: 0, duplicateIndex: 1 },
      { firstIndex: 0, duplicateIndex: 2 },
    ]);
  });

  it("counts visible-hidden overlap independently of object key order", () => {
    expect(countTestcaseOverlaps(
      [{ input: { a: 1, b: 2 }, expectedOutput: [3] }],
      [
        { expectedOutput: [3], input: { b: 2, a: 1 } },
        { input: { a: 2, b: 1 }, expectedOutput: [3] },
      ],
    )).toBe(1);
  });

  it("handles missing or non-array testcase collections safely", () => {
    expect(findDuplicateTestcases(null)).toEqual([]);
    expect(countTestcaseOverlaps(null, [])).toBe(0);
    expect(countTestcaseOverlaps([], null)).toBe(0);
  });
});

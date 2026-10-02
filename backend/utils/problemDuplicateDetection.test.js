import { describe, expect, it } from "vitest";
import { compareProblems, pairKey, scanProblemDuplicates } from "./problemDuplicateDetection.js";

const base = {
  problemKey: "11111111-1111-4111-8111-111111111111",
  identityFingerprint: "a".repeat(64),
  title: "Find Minimum Value",
  description: "Given an array of integers, return the minimum value in the array.",
  functionName: "findMinimum",
  returnType: { value: "number" },
  paramTypes: { nums: "number[]" },
  comparisonMode: "exact",
  operationSequence: { enabled: false, resultMode: "all" },
};

function clone(overrides = {}) {
  return { ...base, ...overrides, problemKey: overrides.problemKey || crypto.randomUUID() };
}

describe("problem duplicate detection", () => {
  it("creates an order-independent pair key", () => {
    const a = clone();
    const b = clone();
    expect(pairKey(a, b)).toBe(pairKey(b, a));
  });

  it("detects exact duplicates by identity fingerprint", () => {
    const a = clone();
    const b = clone({ identityFingerprint: a.identityFingerprint });
    const result = scanProblemDuplicates([a, b]);
    expect(result.exactDuplicates).toHaveLength(1);
    expect(result.probableDuplicates).toHaveLength(0);
  });

  it("flags a probable duplicate without failing exact-duplicate policy", () => {
    const a = clone();
    const b = clone({
      title: "Minimum Value in Array",
      description: "Given an array of integers, return the minimum element in the array.",
      functionName: "minimumValue",
      identityFingerprint: "b".repeat(64),
    });
    const result = scanProblemDuplicates([a, b]);
    expect(result.exactDuplicates).toHaveLength(0);
    expect(result.probableDuplicates).toHaveLength(1);
    expect(result.probableDuplicates[0].score).toBeGreaterThanOrEqual(0.68);
  });

  it("does not flag unrelated problems", () => {
    const a = clone();
    const b = clone({
      title: "Binary Search",
      description: "Given a sorted array and a target, return the target index or minus one.",
      functionName: "binarySearch",
      identityFingerprint: "c".repeat(64),
    });
    expect(scanProblemDuplicates([a, b]).probableDuplicates).toHaveLength(0);
  });

  it("returns deterministic comparison scores", () => {
    const a = clone();
    const b = clone({ identityFingerprint: "d".repeat(64), title: "Find Minimum Value" });
    expect(compareProblems(a, b)).toEqual(compareProblems(a, b));
  });
});

import { describe, expect, it } from "vitest";
import {
  normalizeOperationSequenceTestcase,
  planCanonicalMigration,
} from "./problemMigration.js";

describe("P6 operation-sequence migration", () => {
  it("converts the legacy parallel ops/vals shape to embedded operations and removes void results", () => {
    const migrated = normalizeOperationSequenceTestcase({
      input: {
        ops: ["push", "push", "getMin", "pop", "getMin"],
        vals: [[2], [1], [], [], []],
      },
      expectedOutput: [null, null, 1, null, 2],
    });

    expect(migrated).toEqual({
      input: {
        operations: [["push", 2], ["push", 1], ["getMin"], ["pop"], ["getMin"]],
      },
      expectedOutput: [1, 2],
    });
  });

  it("creates a shared family and variant relationship for the retired duplicate", () => {
    const plan = planCanonicalMigration([
      {
        id: 36,
        slug: "min-stack",
        description: "canonical min stack",
        returnType: {},
        paramTypes: {},
        comparisonMode: "exact",
        operationSequence: { enabled: true, resultMode: "returningOnly" },
        testcases: [],
        hiddentestcases: [],
      },
      {
        id: 227,
        slug: "minimum-stack",
        description: "legacy min stack",
        returnType: {},
        paramTypes: {},
        comparisonMode: "exact",
        operationSequence: { enabled: true, resultMode: "all" },
        testcases: [{ input: { ops: ["push"], vals: [[1]] }, expectedOutput: [null] }],
        hiddentestcases: [],
      },
    ]);

    const canonical = plan.find((item) => item.slug === "min-stack");
    const retired = plan.find((item) => item.slug === "minimum-stack");

    expect(canonical.problemKey).toBeTruthy();
    expect(retired.familyKey).toBe(canonical.problemKey);
    expect(retired.variantOf).toBe(canonical.problemKey);
    expect(retired.enabled).toBe(false);
    expect(retired.next.operationSequence.resultMode).toBe("returningOnly");
  });
});

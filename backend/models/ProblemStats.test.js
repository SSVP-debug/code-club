import { describe, expect, it } from "vitest";
import ProblemStats from "./ProblemStats.js";

describe("ProblemStats schema indexes", () => {
  it("declares exactly one unique index for problemSlug", () => {
    const indexes = ProblemStats.schema.indexes().filter(
      ([fields, options]) => fields.problemSlug === 1 && options.unique === true,
    );

    expect(indexes).toHaveLength(1);
  });
});

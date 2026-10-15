import { describe, expect, it } from "vitest";
import {
  inspectContent,
  parseJsonContent,
  validateConstraints,
  validateExamples,
} from "./problemContentQuality.js";

describe("problem content quality helpers", () => {
  it("reports malformed JSON instead of treating non-empty text as valid content", () => {
    const inspected = inspectContent("examples.json", "{not json");
    expect(inspected.jsonValid).toBe(false);
    expect(inspected.jsonError).toBeTruthy();
    expect(inspected.empty).toBe(false);
  });

  it("does not mark a non-array JSON value as valid examples", () => {
    const { parsed, error } = parseJsonContent('{"input":"x","output":"y"}');
    expect(error).toBeNull();
    expect(validateExamples(parsed)).toContain("examples.json must contain a JSON array");
  });

  it("requires examples to have non-empty string input and output", () => {
    expect(validateExamples([{ input: "", output: "ok" }])).toContain(
      "examples.json example 1 must include a non-empty string input"
    );
    expect(validateExamples([{ input: "x" }])).toContain(
      "examples.json example 1 must include a non-empty string output"
    );
  });

  it("accepts complete examples with string values", () => {
    expect(validateExamples([
      { input: "nums = [1, 2]", output: "3", explanation: "Add the values." },
    ])).toEqual([]);
  });

  it("requires constraints to be a non-empty array of non-empty strings", () => {
    expect(validateConstraints({ limit: 5 })).toContain("constraints.json must contain a JSON array");
    expect(validateConstraints(["n >= 1", " "])).toContain(
      "constraints.json constraint 2 must be a non-empty string"
    );
  });

  it("accepts a well-formed constraints array", () => {
    expect(validateConstraints(["1 <= n <= 10^5"])).toEqual([]);
  });

  it("reports empty JSON files as empty without adding a parse error", () => {
    const inspected = inspectContent("examples.json", "  ");
    expect(inspected.empty).toBe(true);
    expect(inspected.jsonValid).toBe(true);
    expect(inspected.jsonError).toBeNull();
  });
});

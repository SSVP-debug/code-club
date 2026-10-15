import { describe, expect, it } from "vitest";
import { summarizeProblemBankWarnings } from "./problemBankAuditSummary.js";

describe("summarizeProblemBankWarnings", () => {
  it("groups warning findings by check and sorts by count then name", () => {
    expect(summarizeProblemBankWarnings([
      { level: "WARN", check: "familyKey" },
      { level: "FAIL", check: "familyKey" },
      { level: "WARN", check: "identity" },
      { level: "WARN", check: "familyKey" },
      { level: "WARN", check: "identity" },
      { level: "WARN", check: "starter-language" },
    ])).toEqual([
      { check: "familyKey", count: 2 },
      { check: "identity", count: 2 },
      { check: "starter-language", count: 1 },
    ]);
  });

  it("returns an empty list for missing or irrelevant findings", () => {
    expect(summarizeProblemBankWarnings(null)).toEqual([]);
    expect(summarizeProblemBankWarnings([
      null,
      { level: "FAIL", check: "id" },
      { level: "WARN" },
    ])).toEqual([]);
  });
});

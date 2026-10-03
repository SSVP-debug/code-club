import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (script, args) => execFileSync("node", [script, ...args], {
  cwd: process.cwd(),
  encoding: "utf8",
});

describe("problem scale tooling", () => {
  it("reports legacy authoring gaps without mutating the canonical bank", () => {
    const output = run("scripts/problemAuthoringChecklist.js", ["--problem=reverse-linked-list", "--json"]);
    const report = JSON.parse(output);

    expect(report.slug).toBe("reverse-linked-list");
    expect(report.readyForStrictValidation).toBe(false);
    expect(Array.isArray(report.todoFiles)).toBe(true);
    expect(report.nextCommand).toContain("validate:problem-authoring");
  });

  it("fails closed when a batch references an unknown problem", () => {
    expect(() => run("scripts/validateProblemBatch.js", ["--slugs=does-not-exist", "--json"]))
      .toThrow();
  });
});

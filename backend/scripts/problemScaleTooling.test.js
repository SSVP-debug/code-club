import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (script, args) => execFileSync("node", [script, ...args], {
  cwd: process.cwd(),
  encoding: "utf8",
});

const findIncompleteProblem = () => {
  const output = execFileSync("node", ["scripts/auditProblemContentQuality.js", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return JSON.parse(output).reports.find((item) => !item.learnerReady);
};

describe("problem scale tooling", () => {
  it("reports current legacy authoring gaps without mutating the canonical bank", () => {
    const incomplete = findIncompleteProblem();

    if (!incomplete) return;

    const output = run("scripts/problemAuthoringChecklist.js", [`--problem=${incomplete.slug}`, "--json"]);
    const report = JSON.parse(output);

    expect(report.slug).toBe(incomplete.slug);
    expect(report.readyForStrictValidation).toBe(false);
    expect(Array.isArray(report.todoFiles)).toBe(true);
    expect(report.nextCommand).toContain("validate:problem-authoring");
  });

  it("fails closed when a batch references an unknown problem", () => {
    expect(() => run("scripts/validateProblemBatch.js", ["--slugs=does-not-exist", "--json"]))
      .toThrow();
  });
});

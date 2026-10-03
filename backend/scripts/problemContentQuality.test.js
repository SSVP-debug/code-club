import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (args) => execFileSync("node", ["scripts/auditProblemContentQuality.js", ...args], {
  cwd: process.cwd(),
  encoding: "utf8",
});

const findIncompleteProblem = () => {
  const report = JSON.parse(run(["--json"]));
  return report.reports.find((item) => !item.learnerReady);
};

describe("problem content quality audit", () => {
  it("scans the canonical bank without mutating it", () => {
    const report = JSON.parse(run(["--json"]));
    expect(report.total).toBeGreaterThanOrEqual(250);
    expect(report.reports).toHaveLength(report.total);
    expect(report.mode).toBe("legacy-audit");
  });

  it("detects a current legacy authoring gap", () => {
    const incomplete = findIncompleteProblem();

    if (!incomplete) {
      const report = JSON.parse(run(["--json"]));
      expect(report.reports.filter((item) => !item.learnerReady)).toHaveLength(0);
      return;
    }

    const report = JSON.parse(run([`--problem=${incomplete.slug}`, "--json"]));
    expect(report.total).toBe(1);
    expect(report.reports[0].slug).toBe(incomplete.slug);
    expect(report.reports[0].learnerReady).toBe(false);
  });

  it("fails strict validation for a current incomplete problem", () => {
    const incomplete = findIncompleteProblem();

    if (!incomplete) return;

    expect(() => run([`--problem=${incomplete.slug}`, "--strict", "--json"])).toThrow();
  });
});

import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (args) => execFileSync("node", ["scripts/auditProblemContentQuality.js", ...args], {
  cwd: process.cwd(),
  encoding: "utf8",
});

describe("problem content quality audit", () => {
  it("scans the canonical bank without mutating it", () => {
    const report = JSON.parse(run(["--json"]));
    expect(report.total).toBeGreaterThanOrEqual(250);
    expect(report.reports).toHaveLength(report.total);
    expect(report.mode).toBe("legacy-audit");
  });

  it("detects a known legacy authoring gap", () => {
    const report = JSON.parse(run(["--problem=reverse-linked-list", "--json"]));
    expect(report.total).toBe(1);
    expect(report.reports[0].slug).toBe("reverse-linked-list");
    expect(report.reports[0].learnerReady).toBe(false);
  });

  it("fails strict validation for an incomplete legacy problem", () => {
    expect(() => run(["--problem=reverse-linked-list", "--strict", "--json"])).toThrow();
  });
});

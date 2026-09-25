import { describe, expect, it } from "vitest";
import { computeReadinessScore } from "./readiness.js";

describe("computeReadinessScore", () => {
  it("returns 0 for an empty population", () => {
    expect(computeReadinessScore({ totalStudents: 0, totalSolved: 0, totalHard: 0, activeStudents: 0 })).toBe(0);
  });

  it("caps each component and tops out at 100", () => {
    expect(computeReadinessScore({ totalStudents: 10, totalSolved: 5000, totalHard: 1000, activeStudents: 10 })).toBe(100);
  });

  it("matches the original college-wide formula", () => {
    // avg 50 solved -> 20, avg 10 hard -> 15, 50% active -> 15
    expect(computeReadinessScore({ totalStudents: 10, totalSolved: 500, totalHard: 100, activeStudents: 5 })).toBe(50);
  });
});

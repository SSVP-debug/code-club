import { describe, expect, it, vi } from "vitest";
import { backfillAssignmentCollegeIdsCore } from "./backfillAssignmentCollegeIds.js";

describe("backfillAssignmentCollegeIdsCore", () => {
  it("links assignments to the only college matching their legacy domain", async () => {
    const bulkSetCollegeIds = vi.fn().mockResolvedValue(1);

    const counts = await backfillAssignmentCollegeIdsCore({
      findAssignments: async () => [
        { _id: "assignment-1", collegeDomain: "A.EDU" },
      ],
      findCollegesByDomains: async () => [
        { _id: "college-1", domains: ["a.edu", "b.edu"] },
      ],
      bulkSetCollegeIds,
    });

    expect(counts).toEqual({
      scanned: 1,
      eligible: 1,
      updated: 1,
      skippedNoMatch: 0,
      skippedAmbiguous: 0,
      alreadyLinked: 0,
      errors: 0,
    });
    expect(bulkSetCollegeIds).toHaveBeenCalledWith([
      { assignmentId: "assignment-1", collegeId: "college-1" },
    ]);
  });

  it("skips assignments whose domain has no matching college", async () => {
    const bulkSetCollegeIds = vi.fn();

    const counts = await backfillAssignmentCollegeIdsCore({
      findAssignments: async () => [
        { _id: "assignment-1", collegeDomain: "missing.edu" },
      ],
      findCollegesByDomains: async () => [],
      bulkSetCollegeIds,
    });

    expect(counts.scanned).toBe(1);
    expect(counts.eligible).toBe(0);
    expect(counts.updated).toBe(0);
    expect(counts.skippedNoMatch).toBe(1);
    expect(bulkSetCollegeIds).not.toHaveBeenCalled();
  });

  it("skips assignments when a domain matches multiple colleges", async () => {
    const bulkSetCollegeIds = vi.fn();

    const counts = await backfillAssignmentCollegeIdsCore({
      findAssignments: async () => [
        { _id: "assignment-1", collegeDomain: "shared.edu" },
      ],
      findCollegesByDomains: async () => [
        { _id: "college-1", domains: ["shared.edu"] },
        { _id: "college-2", domains: ["shared.edu"] },
      ],
      bulkSetCollegeIds,
    });

    expect(counts.scanned).toBe(1);
    expect(counts.eligible).toBe(0);
    expect(counts.updated).toBe(0);
    expect(counts.skippedAmbiguous).toBe(1);
    expect(bulkSetCollegeIds).not.toHaveBeenCalled();
  });

  it("does not rewrite assignments that already have collegeId", async () => {
    const bulkSetCollegeIds = vi.fn();

    const counts = await backfillAssignmentCollegeIdsCore({
      findAssignments: async () => [
        {
          _id: "assignment-1",
          collegeId: "college-existing",
          collegeDomain: "a.edu",
        },
      ],
      findCollegesByDomains: async () => [],
      bulkSetCollegeIds,
    });

    expect(counts).toEqual({
      scanned: 1,
      eligible: 0,
      updated: 0,
      skippedNoMatch: 0,
      skippedAmbiguous: 0,
      alreadyLinked: 1,
      errors: 0,
    });
    expect(bulkSetCollegeIds).not.toHaveBeenCalled();
  });

  it("does not write during a dry run", async () => {
    const bulkSetCollegeIds = vi.fn();

    const counts = await backfillAssignmentCollegeIdsCore({
      findAssignments: async () => [
        { _id: "assignment-1", collegeDomain: "a.edu" },
      ],
      findCollegesByDomains: async () => [
        { _id: "college-1", domains: ["a.edu"] },
      ],
      bulkSetCollegeIds,
      dryRun: true,
    });

    expect(counts.eligible).toBe(1);
    expect(counts.updated).toBe(1);
    expect(bulkSetCollegeIds).not.toHaveBeenCalled();
  });
});

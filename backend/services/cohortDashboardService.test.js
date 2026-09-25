import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/User.js", () => ({ default: { aggregate: vi.fn() } }));
vi.mock("../models/Cohort.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../models/CohortMembership.js", () => ({
  default: { find: vi.fn(), collection: { name: "cohortmemberships" } },
}));

import User from "../models/User.js";
import Cohort from "../models/Cohort.js";
import CohortMembership from "../models/CohortMembership.js";
import { getCohortBreakdown, getActiveCohortStudentIds } from "./cohortDashboardService.js";

const chain = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

describe("getCohortBreakdown", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] without touching Users when the college has no cohorts", async () => {
    Cohort.find.mockReturnValue(chain([]));
    expect(await getCohortBreakdown({ collegeId: "c1", collegeDomains: ["x.edu"] })).toEqual([]);
    expect(User.aggregate).not.toHaveBeenCalled();
  });

  it("scopes to visible students, active memberships of THIS college's cohorts, and unwinds topicStats as a Map", async () => {
    Cohort.find.mockReturnValue(chain([{ _id: "a", name: "CSE-A", status: "active" }]));
    User.aggregate.mockResolvedValue([{ summary: [], topics: [] }]);
    await getCohortBreakdown({ collegeId: "c1", collegeDomains: ["x.edu"] });

    const pipeline = User.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toEqual({ emailDomain: { $in: ["x.edu"] }, role: "student", visibleToTpo: { $ne: false } });
    const lookup = pipeline.find((s) => s.$lookup).$lookup;
    expect(lookup.from).toBe("cohortmemberships");
    expect(lookup.pipeline[0].$match).toMatchObject({ status: "active", cohortId: { $in: ["a"] } });
    expect(JSON.stringify(pipeline)).toContain("$objectToArray");
  });

  it("shapes per-cohort rows, keeps empty cohorts at zero, ranks topics, and sorts by name", async () => {
    Cohort.find.mockReturnValue(chain([
      { _id: "b", name: "CSE-B", status: "active", section: "B" },
      { _id: "a", name: "CSE-A", status: "active" },
    ]));
    User.aggregate.mockResolvedValue([{
      summary: [{ _id: "a", memberCount: 4, totalSolved: 200, easy: 100, medium: 60, hard: 40, active: 3 }],
      topics: [
        { _id: { cohortId: "a", topic: "arrays" }, totalSolves: 50 },
        { _id: { cohortId: "a", topic: "graphs" }, totalSolves: 90 },
      ],
    }]);

    const rows = await getCohortBreakdown({ collegeId: "c1", collegeDomains: ["x.edu"] });
    expect(rows.map((r) => r.name)).toEqual(["CSE-A", "CSE-B"]);
    expect(rows[0]).toMatchObject({
      totalStudents: 4, avgSolved: 50, activePercent: 75,
      difficultyBreakdown: { easy: 100, medium: 60, hard: 40 },
      topicCoverage: [{ topic: "graphs", totalSolves: 90 }, { topic: "arrays", totalSolves: 50 }],
    });
    expect(rows[1]).toMatchObject({ totalStudents: 0, readinessScore: 0, topicCoverage: [], section: "B" });
  });
});

describe("getActiveCohortStudentIds", () => {
  it("returns only students of active memberships", async () => {
    CohortMembership.find.mockReturnValue(chain([{ studentId: "s1" }, { studentId: "s2" }]));
    const ids = await getActiveCohortStudentIds("64b7f0f0f0f0f0f0f0f0f0f0");
    expect(ids).toEqual(["s1", "s2"]);
    expect(CohortMembership.find.mock.calls[0][0]).toMatchObject({ status: "active", studentId: { $ne: null } });
  });
});

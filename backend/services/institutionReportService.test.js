import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";
import { getInstitutionReportOverview } from "./institutionReportService.js";
import User from "../models/User.js";
import College from "../models/College.js";
import Cohort from "../models/Cohort.js";
import CohortMembership from "../models/CohortMembership.js";
import Assignment from "../models/Assignment.js";

describe("TPO-5 Step 1 — institution report overview", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("scopes metrics to the institution and separates TPO opt-outs", async () => {
    const college = await College.create({
      domains: ["a.edu", "b.edu"],
      name: "Report University",
      status: "verified",
    });

    await User.create([
      {
        firebaseUid: "report-student-a",
        email: "a@a.edu",
        role: "student",
        roles: ["student"],
        totalXP: 100,
        solvedSlugs: ["p1", "p2"],
        solvedDifficulty: { easy: 1, medium: 1, hard: 0 },
        currentStreak: 3,
        visibleToTpo: true,
      },
      {
        firebaseUid: "report-student-b",
        email: "b@b.edu",
        role: "student",
        roles: ["student"],
        totalXP: 200,
        solvedSlugs: ["p1"],
        solvedDifficulty: { easy: 1, medium: 0, hard: 0 },
        currentStreak: 0,
        visibleToTpo: true,
      },
      {
        firebaseUid: "report-opted-out",
        email: "out@a.edu",
        role: "student",
        roles: ["student"],
        solvedSlugs: ["p1", "p2", "p3"],
        visibleToTpo: false,
      },
      {
        firebaseUid: "report-outsider",
        email: "outsider@other.edu",
        role: "student",
        roles: ["student"],
        solvedSlugs: ["p1", "p2", "p3", "p4"],
        visibleToTpo: true,
      },
    ]);

    const tpo = await User.findOne({ firebaseUid: "report-student-a" });
    const cohort = await Cohort.create({
      collegeId: college._id,
      name: "CSE 2027",
      academicYear: "2024-2025",
      graduatingYear: 2027,
      branch: "CSE",
      createdBy: tpo._id,
    });

    const studentA = await User.findOne({ email: "a@a.edu" });
    await CohortMembership.create({
      cohortId: cohort._id,
      collegeId: college._id,
      studentId: studentA._id,
      email: studentA.email,
      status: "active",
      addedBy: tpo._id,
    });

    await Assignment.create({
      tpoId: tpo._id,
      collegeId: college._id,
      collegeDomain: "a.edu",
      cohortId: cohort._id,
      title: "Cohort assignment",
      problemSlugs: ["p1", "p2"],
      dueDate: new Date("2026-10-01"),
    });

    const report = await getInstitutionReportOverview({
      college,
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-31T23:59:59.999Z",
    });

    expect(report.students).toEqual({
      total: 2,
      optedOut: 1,
      active: 1,
      activePercent: 50,
    });
    expect(report.problems).toEqual({
      totalSolved: 3,
      averageSolved: 1.5,
      difficulty: { easy: 2, medium: 1, hard: 0 },
    });
    expect(report.cohorts).toEqual({
      total: 1,
      active: 1,
      archived: 0,
      activeMemberships: 1,
    });
    expect(report.assignments.total).toBe(1);
    expect(report.assignments.active).toBe(1);
    expect(report.assignments.assignedStudents).toBe(1);
    expect(report.assignments.completedAssignments).toBe(1);
    expect(report.assignments.completionPercent).toBe(100);
  });

  it("includes legacy college-wide assignments and excludes out-of-range assignments", async () => {
    const college = await College.create({
      domains: ["legacy.edu"],
      name: "Legacy University",
      status: "verified",
    });

    const student = await User.create({
      firebaseUid: "legacy-student",
      email: "student@legacy.edu",
      role: "student",
      roles: ["student"],
      solvedSlugs: ["p1"],
      visibleToTpo: true,
    });

    await Assignment.create({
      tpoId: student._id,
      collegeDomain: "legacy.edu",
      title: "In range",
      problemSlugs: ["p1"],
      dueDate: new Date("2026-09-20"),
      createdAt: new Date("2026-09-20"),
    });

    await Assignment.create({
      tpoId: student._id,
      collegeDomain: "legacy.edu",
      title: "Out of range",
      problemSlugs: ["p1"],
      dueDate: new Date("2026-08-20"),
      createdAt: new Date("2026-08-20"),
    });

    const report = await getInstitutionReportOverview({
      college,
      from: "2026-09-01",
      to: "2026-09-30T23:59:59.999Z",
    });

    expect(report.assignments.total).toBe(1);
    expect(report.assignments.completedAssignments).toBe(1);
    expect(report.assignments.completionPercent).toBe(100);
  });

  it("rejects an invalid or reversed date range", async () => {
    const college = await College.create({
      domains: ["dates.edu"],
      name: "Dates University",
      status: "verified",
    });

    await expect(
      getInstitutionReportOverview({
        college,
        from: "not-a-date",
        to: "2026-09-30",
      })
    ).rejects.toMatchObject({ code: "INVALID_DATE_RANGE" });

    await expect(
      getInstitutionReportOverview({
        college,
        from: "2026-10-01",
        to: "2026-09-01",
      })
    ).rejects.toMatchObject({ code: "INVALID_DATE_RANGE" });
  });
});

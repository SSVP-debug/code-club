import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";
import { getCohortRoster, addStudentToCohort, removeCohortMembership } from "./cohortMembershipService.js";
import Cohort from "../models/Cohort.js";
import CohortMembership from "../models/CohortMembership.js";
import College from "../models/College.js";
import User from "../models/User.js";

// ── TPO-2 Step 5: cohort membership database-level behavior (real Mongo) ───
describe("cohortMembershipService (real Mongo)", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  async function seedCollegeAndCohort(domain = "a.edu") {
    const college = await College.create({ domains: [domain], name: `College ${domain}`, status: "verified" });
    const tpo = await User.create({ firebaseUid: `fb-tpo-${Math.random().toString(36).slice(2)}`, email: `tpo@${domain}`, role: "tpo" });
    const cohort = await Cohort.create({
      collegeId: college._id, name: "CSE 2027", academicYear: "2024-2025",
      graduatingYear: 2027, branch: "CSE", createdBy: tpo._id,
    });
    return { college, tpo, cohort };
  }

  it("1. same cohort + same normalized email cannot produce a duplicate membership", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();

    const first = await addStudentToCohort(cohort._id.toString(), college._id, tpo._id, "student@a.edu");
    expect(first.created).toBe(true);

    // Same person, different case/whitespace — must resolve to the SAME
    // logical row (normalized), and since they're now already-invited,
    // this should be an idempotent no-op, not a second row.
    const second = await addStudentToCohort(cohort._id.toString(), college._id, tpo._id, " STUDENT@A.EDU ");
    expect(second.created).toBe(false);

    const count = await CohortMembership.countDocuments({ cohortId: cohort._id, email: "student@a.edu" });
    expect(count).toBe(1);
  });

  it("2. the same student can belong to two different cohorts", async () => {
    const { college, tpo, cohort: cohortA } = await seedCollegeAndCohort();
    const cohortB = await Cohort.create({
      collegeId: college._id, name: "Placement Pool 2027", academicYear: "2024-2025",
      graduatingYear: 2027, branch: "CSE", createdBy: tpo._id,
    });
    const student = await User.create({
      firebaseUid: "fb-student-1", email: "student@a.edu", role: "student",
      education: { collegeId: college._id },
    });

    const resultA = await addStudentToCohort(cohortA._id.toString(), college._id, tpo._id, "student@a.edu");
    const resultB = await addStudentToCohort(cohortB._id.toString(), college._id, tpo._id, "student@a.edu");

    expect(resultA.membership.membershipStatus).toBe("active");
    expect(resultB.membership.membershipStatus).toBe("active");
    const memberships = await CohortMembership.find({ studentId: student._id });
    expect(memberships).toHaveLength(2);
  });

  it("3. the same email can belong to two cohorts even before any account matches (both invited)", async () => {
    const { college, tpo, cohort: cohortA } = await seedCollegeAndCohort();
    const cohortB = await Cohort.create({
      collegeId: college._id, name: "Cohort B", academicYear: "2024-2025",
      graduatingYear: 2027, branch: "ECE", createdBy: tpo._id,
    });

    const resultA = await addStudentToCohort(cohortA._id.toString(), college._id, tpo._id, "future@a.edu");
    const resultB = await addStudentToCohort(cohortB._id.toString(), college._id, tpo._id, "future@a.edu");

    expect(resultA.membership.membershipStatus).toBe("invited");
    expect(resultB.membership.membershipStatus).toBe("invited");
  });

  it("4. an invited membership can be promoted to active once a matching account exists", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();
    const invited = await addStudentToCohort(cohort._id.toString(), college._id, tpo._id, "newcomer@a.edu");
    expect(invited.membership.membershipStatus).toBe("invited");

    const student = await User.create({
      firebaseUid: "fb-student-2", email: "newcomer@a.edu", role: "student",
      education: { collegeId: college._id },
    });

    const promoted = await addStudentToCohort(cohort._id.toString(), college._id, tpo._id, "newcomer@a.edu");

    expect(promoted.membership.membershipStatus).toBe("active");
    expect(promoted.membership.studentId).toBe(student._id.toString());
    expect(promoted.previousStatus).toBe("invited");

    // Still exactly one row.
    const count = await CohortMembership.countDocuments({ cohortId: cohort._id, email: "newcomer@a.edu" });
    expect(count).toBe(1);
  });

  it("5. a removed membership can be reactivated", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();
    const student = await User.create({
      firebaseUid: "fb-student-3", email: "returning@a.edu", role: "student",
      education: { collegeId: college._id },
    });

    const added = await addStudentToCohort(cohort._id.toString(), college._id, tpo._id, "returning@a.edu");
    const removed = await removeCohortMembership(cohort._id.toString(), added.membership.membershipId, college._id);
    expect(removed.membership.membershipStatus).toBe("removed");

    const reactivated = await addStudentToCohort(cohort._id.toString(), college._id, tpo._id, "returning@a.edu");

    expect(reactivated.membership.membershipStatus).toBe("active");
    expect(reactivated.previousStatus).toBe("removed");
    expect(reactivated.membership.studentId).toBe(student._id.toString());
    const count = await CohortMembership.countDocuments({ cohortId: cohort._id, email: "returning@a.edu" });
    expect(count).toBe(1); // never deleted and recreated — same row throughout
  });

  it("6. a cross-college membership cannot be created", async () => {
    const { college: collegeA, tpo: tpoA, cohort: cohortA } = await seedCollegeAndCohort("a.edu");
    const { college: collegeB } = await seedCollegeAndCohort("b.edu");
    await User.create({
      firebaseUid: "fb-student-b", email: "student@b.edu", role: "student",
      education: { collegeId: collegeB._id },
    });

    const result = await addStudentToCohort(cohortA._id.toString(), collegeA._id, tpoA._id, "student@b.edu");

    expect(result.validationError).toMatch(/different institution/i);
    const count = await CohortMembership.countDocuments({ email: "student@b.edu" });
    expect(count).toBe(0);
  });

  it("7. removal preserves the User document entirely", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();
    const student = await User.create({
      firebaseUid: "fb-student-4", email: "preserved@a.edu", role: "student",
      totalXP: 777, solvedSlugs: ["two-sum"],
      education: { collegeId: college._id, branch: "CSE" },
    });

    const added = await addStudentToCohort(cohort._id.toString(), college._id, tpo._id, "preserved@a.edu");
    await removeCohortMembership(cohort._id.toString(), added.membership.membershipId, college._id);

    const reloadedUser = await User.findById(student._id);
    expect(reloadedUser.role).toBe("student");
    expect(reloadedUser.totalXP).toBe(777);
    expect(reloadedUser.solvedSlugs).toEqual(["two-sum"]);
    expect(reloadedUser.education.collegeId.toString()).toBe(college._id.toString());
    expect(reloadedUser.education.branch).toBe("CSE");
  });

  // ── Cross-college isolation (mandatory, TPO-2 Step 5 section 8) ────────
  it("roster read isolation: College A's roster never returns College B's memberships", async () => {
    const { college: collegeA, tpo: tpoA, cohort: cohortA } = await seedCollegeAndCohort("a.edu");
    const { college: collegeB, tpo: tpoB, cohort: cohortB } = await seedCollegeAndCohort("b.edu");
    await addStudentToCohort(cohortA._id.toString(), collegeA._id, tpoA._id, "student@a.edu");
    await addStudentToCohort(cohortB._id.toString(), collegeB._id, tpoB._id, "student@b.edu");

    const roster = await getCohortRoster(cohortA._id.toString(), collegeA._id, { status: "invited" });

    const emails = roster.students.map((s) => s.email);
    expect(emails).toContain("student@a.edu");
    expect(emails).not.toContain("student@b.edu");
  });

  it("add-through-manipulated-cohort-id isolation: College A's TPO cannot add into College B's cohort id", async () => {
    const { tpo: tpoA, college: collegeA } = await seedCollegeAndCohort("a.edu");
    const { cohort: cohortB } = await seedCollegeAndCohort("b.edu");

    // TPO A's own resolved collegeId, but College B's cohort id.
    const result = await addStudentToCohort(cohortB._id.toString(), collegeA._id, tpoA._id, "student@a.edu");

    expect(result).toBeNull(); // cohort not found within College A's scope
  });

  it("remove isolation: College A's TPO cannot remove a membership belonging to College B", async () => {
    const { college: collegeA } = await seedCollegeAndCohort("a.edu");
    const { college: collegeB, tpo: tpoB, cohort: cohortB } = await seedCollegeAndCohort("b.edu");
    const added = await addStudentToCohort(cohortB._id.toString(), collegeB._id, tpoB._id, "student@b.edu");

    const result = await removeCohortMembership(cohortB._id.toString(), added.membership.membershipId, collegeA._id);

    expect(result).toBeNull();
    const reloaded = await CohortMembership.findById(added.membership.membershipId);
    expect(reloaded.status).toBe("invited"); // untouched
  });

  it("student ownership isolation: a College B User cannot become a College A cohort member even via direct email match", async () => {
    const { college: collegeA, tpo: tpoA, cohort: cohortA } = await seedCollegeAndCohort("a.edu");
    const { college: collegeB } = await seedCollegeAndCohort("b.edu");
    await User.create({
      firebaseUid: "fb-student-b2", email: "crossover@b.edu", role: "student",
      education: { collegeId: collegeB._id },
    });

    const result = await addStudentToCohort(cohortA._id.toString(), collegeA._id, tpoA._id, "crossover@b.edu");

    expect(result.validationError).toBeDefined();
    const membership = await CohortMembership.findOne({ email: "crossover@b.edu" });
    expect(membership).toBeNull();
  });
});
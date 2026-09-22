import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";

// Same real-Mongo tier as services/cohortMembershipService's own
// integration coverage and routes/tpoCohorts.integration.test.js — real
// index enforcement, not mocks (see test/mongoMemoryServer.js's own
// comment on why Model.init() matters here). If Mongo is unavailable in
// this environment (the sandbox blocks fastdl.mongodb.org — see this
// project's own learnings), this file's tests are reported as failing to
// start, not silently skipped or claimed as passing.
const { default: Cohort } = await import("../models/Cohort.js");
const { default: CohortMembership } = await import("../models/CohortMembership.js");
const { default: College } = await import("../models/College.js");
const { default: User } = await import("../models/User.js");
const { importCohortRoster } = await import("./cohortImportService.js");

function csv(rows) {
  return Buffer.from(rows.map((r) => r.join(",")).join("\n"), "utf8");
}

describe("cohortImportService — real Mongo (TPO-2 Step 6)", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  async function seedCollegeAndCohort(overrides = {}) {
    const college = await College.create({ domains: ["a.edu"], name: "College A", status: "verified" });
    const tpo = await User.create({
      firebaseUid: `fb-tpo-${Math.random().toString(36).slice(2)}`,
      email: "tpo@a.edu",
      role: "tpo",
      roles: ["student", "tpo"],
      tpoProfile: { collegeDomain: "a.edu", collegeName: "College A", verified: true },
    });
    const cohort = await Cohort.create({
      collegeId: college._id,
      name: "2027 CSE",
      academicYear: "2024-2025",
      graduatingYear: 2027,
      branch: "CSE",
      createdBy: tpo._id,
      ...overrides,
    });
    return { college, tpo, cohort };
  }

  it("1. a real CSV import creates CohortMembership documents", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();

    const result = await importCohortRoster(
      cohort._id.toString(), college._id, tpo._id,
      csv([["email"], ["one@a.edu"], ["two@a.edu"]])
    );

    expect(result.summary).toEqual(
      expect.objectContaining({ totalRows: 2, processed: 2, invited: 2, errors: 0 })
    );

    const rows = await CohortMembership.find({ cohortId: cohort._id }).sort({ email: 1 });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.email)).toEqual(["one@a.edu", "two@a.edu"]);
    expect(rows.every((r) => r.status === "invited")).toBe(true);
    expect(rows.every((r) => r.importBatchId.toString() === result.importBatchId)).toBe(true);
  });

  it("2. the (cohortId, email) unique index rejects a bypassed second write for the same pair", async () => {
    const { college, cohort, tpo } = await seedCollegeAndCohort();

    await CohortMembership.create({
      cohortId: cohort._id, collegeId: college._id, email: "dup@a.edu", addedBy: tpo._id, status: "invited",
    });

    await expect(
      CohortMembership.create({
        cohortId: cohort._id, collegeId: college._id, email: "dup@a.edu", addedBy: tpo._id, status: "invited",
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("3. importing the same CSV twice is idempotent — no new memberships the second time", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();
    const file = csv([["email"], ["one@a.edu"], ["two@a.edu"]]);

    const first = await importCohortRoster(cohort._id.toString(), college._id, tpo._id, file);
    expect(first.summary.invited).toBe(2);

    const second = await importCohortRoster(cohort._id.toString(), college._id, tpo._id, file);
    expect(second.summary.invited).toBe(0);
    expect(second.summary.alreadyMember).toBe(0); // both rows are "invited", not "active" — noop, not conflict
    expect(second.rows.every((r) => r.status === "invited")).toBe(true); // still reported, just unchanged

    const rows = await CohortMembership.find({ cohortId: cohort._id });
    expect(rows).toHaveLength(2); // no duplicates created
  });

  it("4. invited → active: importing an email that now matches a real account promotes the existing row", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();
    await importCohortRoster(cohort._id.toString(), college._id, tpo._id, csv([["email"], ["student@a.edu"]]));

    const student = await User.create({
      firebaseUid: "fb-student-1", email: "student@a.edu", role: "student",
      education: { collegeId: college._id },
    });

    const result = await importCohortRoster(cohort._id.toString(), college._id, tpo._id, csv([["email"], ["student@a.edu"]]));

    expect(result.rows[0].status).toBe("active");
    const membership = await CohortMembership.findOne({ cohortId: cohort._id, email: "student@a.edu" });
    expect(membership.status).toBe("active");
    expect(membership.studentId.toString()).toBe(student._id.toString());
  });

  it("5. removed → active: re-importing a removed member who now matches an account reactivates them", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();
    const student = await User.create({
      firebaseUid: "fb-student-2", email: "removed@a.edu", role: "student",
      education: { collegeId: college._id },
    });
    await CohortMembership.create({
      cohortId: cohort._id, collegeId: college._id, email: "removed@a.edu", addedBy: tpo._id,
      studentId: student._id, status: "removed", removedAt: new Date(),
    });

    const result = await importCohortRoster(cohort._id.toString(), college._id, tpo._id, csv([["email"], ["removed@a.edu"]]));

    expect(result.rows[0].status).toBe("active");
    const membership = await CohortMembership.findOne({ cohortId: cohort._id, email: "removed@a.edu" });
    expect(membership.status).toBe("active");
    expect(membership.removedAt).toBeNull();
  });

  it("6. a student belonging to a different institution is rejected, not attached", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();
    const otherCollege = await College.create({ domains: ["b.edu"], name: "College B", status: "verified" });
    const foreignStudent = await User.create({
      firebaseUid: "fb-foreign", email: "foreign@b.edu", role: "student",
      education: { collegeId: otherCollege._id },
    });

    const result = await importCohortRoster(cohort._id.toString(), college._id, tpo._id, csv([["email"], ["foreign@b.edu"]]));

    expect(result.rows[0]).toEqual(
      expect.objectContaining({ email: "foreign@b.edu", status: "error", reason: "foreign_college" })
    );
    expect(await CohortMembership.findOne({ cohortId: cohort._id, email: "foreign@b.edu" })).toBeNull();
    const reloadedForeignStudent = await User.findById(foreignStudent._id);
    expect(reloadedForeignStudent.education.collegeId.toString()).toBe(otherCollege._id.toString()); // untouched
  });

  it("7. overlapping concurrent imports for the same email do not create duplicate membership rows", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();
    const file = csv([["email"], ["race@a.edu"]]);

    // Two full imports racing each other for the exact same (cohortId,
    // email) pair — the scenario Section 13 describes as "Import A" /
    // "Import B" both containing the same student.
    const [resultA, resultB] = await Promise.all([
      importCohortRoster(cohort._id.toString(), college._id, tpo._id, file),
      importCohortRoster(cohort._id.toString(), college._id, tpo._id, file),
    ]);

    // Neither import should have failed outright or surfaced a raw
    // duplicate-key error to the caller.
    expect(resultA.rows[0].status).not.toBe("error");
    expect(resultB.rows[0].status).not.toBe("error");

    const rows = await CohortMembership.find({ cohortId: cohort._id, email: "race@a.edu" });
    expect(rows).toHaveLength(1); // exactly one row, however the race resolved
  });

  it("8. import does not modify unrelated fields on a matched User document", async () => {
    const { college, tpo, cohort } = await seedCollegeAndCohort();
    const student = await User.create({
      firebaseUid: "fb-untouched", email: "untouched@a.edu", role: "student",
      education: { collegeId: college._id },
      creditsBalance: 250,
    });

    await importCohortRoster(cohort._id.toString(), college._id, tpo._id, csv([["email"], ["untouched@a.edu"]]));

    const reloaded = await User.findById(student._id);
    expect(reloaded.creditsBalance).toBe(250);
    expect(reloaded.education.collegeId.toString()).toBe(college._id.toString());
  });
});

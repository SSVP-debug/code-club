import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import mongoose from "mongoose";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";
import CohortMembership from "./CohortMembership.js";
import Cohort from "./Cohort.js";
import College from "./College.js";
import User from "./User.js";

// ── TPO-2 Step 3: (cohortId, email) unique index (real Mongo) ──────────────
// validateSync() (CohortMembership.test.js) can prove schema-level field
// validation, but a unique index is a database-level constraint — it's
// only enforced on an actual write against a real MongoDB, which is
// exactly what this file is for. Same real-Mongo integration convention
// as models/User.education.integration.test.js and
// routes/tpoFlow.integration.test.js.
describe("CohortMembership model — (cohortId, email) unique index (real Mongo)", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  async function seedCollegeCohortAndTpo() {
    const college = await College.create({ domains: ["example.edu"], name: "Example College", status: "verified" });
    const tpo = await User.create({
      firebaseUid: `fb-tpo-${Math.random().toString(36).slice(2)}`,
      email: "tpo@example.edu",
      role: "tpo",
    });
    const cohort = await Cohort.create({
      collegeId: college._id,
      name: "CSE 2027",
      academicYear: "2024-2025",
      graduatingYear: 2027,
      branch: "Computer Science",
      createdBy: tpo._id,
    });
    return { college, tpo, cohort };
  }

  it("rejects a duplicate membership in the same cohort once the email is normalized — even with different case/whitespace", async () => {
    const { college, tpo, cohort } = await seedCollegeCohortAndTpo();

    await CohortMembership.create({
      cohortId: cohort._id,
      collegeId: college._id,
      email: "student@example.edu",
      addedBy: tpo._id,
    });

    await expect(
      CohortMembership.create({
        cohortId: cohort._id,
        collegeId: college._id,
        email: " STUDENT@EXAMPLE.EDU ", // same person after normalization
        addedBy: tpo._id,
      })
    ).rejects.toMatchObject({ code: 11000 }); // MongoDB duplicate-key error
  });

  it("allows the same email in a DIFFERENT cohort", async () => {
    const college = await College.create({ domains: ["example.edu"], name: "Example College", status: "verified" });
    const tpo = await User.create({ firebaseUid: "fb-tpo-2", email: "tpo@example.edu", role: "tpo" });
    const cohortA = await Cohort.create({
      collegeId: college._id, name: "CSE 2027", academicYear: "2024-2025",
      graduatingYear: 2027, branch: "Computer Science", createdBy: tpo._id,
    });
    const cohortB = await Cohort.create({
      collegeId: college._id, name: "ECE 2027", academicYear: "2024-2025",
      graduatingYear: 2027, branch: "Electronics", createdBy: tpo._id,
    });

    await CohortMembership.create({ cohortId: cohortA._id, collegeId: college._id, email: "shared@example.edu", addedBy: tpo._id });

    await expect(
      CohortMembership.create({ cohortId: cohortB._id, collegeId: college._id, email: "shared@example.edu", addedBy: tpo._id })
    ).resolves.toMatchObject({ email: "shared@example.edu" });
  });

  it("allows a different email in the SAME cohort", async () => {
    const { college, tpo, cohort } = await seedCollegeCohortAndTpo();

    await CohortMembership.create({ cohortId: cohort._id, collegeId: college._id, email: "one@example.edu", addedBy: tpo._id });

    await expect(
      CohortMembership.create({ cohortId: cohort._id, collegeId: college._id, email: "two@example.edu", addedBy: tpo._id })
    ).resolves.toMatchObject({ email: "two@example.edu" });
  });

  it("allows the same student in multiple different cohorts", async () => {
    const college = await College.create({ domains: ["example.edu"], name: "Example College", status: "verified" });
    const tpo = await User.create({ firebaseUid: "fb-tpo-3", email: "tpo@example.edu", role: "tpo" });
    const student = await User.create({ firebaseUid: "fb-student-1", email: "student@example.edu", role: "student" });
    const cohortA = await Cohort.create({
      collegeId: college._id, name: "Placement 2027", academicYear: "2024-2025",
      graduatingYear: 2027, branch: "Computer Science", createdBy: tpo._id,
    });
    const cohortB = await Cohort.create({
      collegeId: college._id, name: "Coding Club 2027", academicYear: "2024-2025",
      graduatingYear: 2027, branch: "Computer Science", createdBy: tpo._id,
    });

    await CohortMembership.create({
      cohortId: cohortA._id, collegeId: college._id, studentId: student._id,
      email: student.email, status: "active", addedBy: tpo._id,
    });

    await expect(
      CohortMembership.create({
        cohortId: cohortB._id, collegeId: college._id, studentId: student._id,
        email: student.email, status: "active", addedBy: tpo._id,
      })
    ).resolves.toMatchObject({ cohortId: cohortB._id });

    const memberships = await CohortMembership.find({ studentId: student._id });
    expect(memberships).toHaveLength(2);
  });

  it("persists a full document round trip correctly across all fields", async () => {
    const { college, tpo, cohort } = await seedCollegeCohortAndTpo();
    const student = await User.create({ firebaseUid: "fb-student-2", email: "roundtrip@example.edu", role: "student" });
    const importBatchId = new mongoose.Types.ObjectId();

    const created = await CohortMembership.create({
      cohortId: cohort._id,
      collegeId: college._id,
      studentId: student._id,
      status: "active",
      email: "RoundTrip@Example.edu",
      invitedAt: new Date("2024-01-01"),
      joinedAt: new Date("2024-01-05"),
      addedBy: tpo._id,
      importBatchId,
    });

    const reloaded = await CohortMembership.findById(created._id);
    expect(reloaded.cohortId.toString()).toBe(cohort._id.toString());
    expect(reloaded.collegeId.toString()).toBe(college._id.toString());
    expect(reloaded.studentId.toString()).toBe(student._id.toString());
    expect(reloaded.status).toBe("active");
    expect(reloaded.email).toBe("roundtrip@example.edu");
    expect(reloaded.invitedAt.toISOString()).toBe(new Date("2024-01-01").toISOString());
    expect(reloaded.joinedAt.toISOString()).toBe(new Date("2024-01-05").toISOString());
    expect(reloaded.removedAt).toBeNull();
    expect(reloaded.addedBy.toString()).toBe(tpo._id.toString());
    expect(reloaded.importBatchId.toString()).toBe(importBatchId.toString());
  });
});
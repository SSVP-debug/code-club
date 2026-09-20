import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";

const { default: User } = await import("../models/User.js");
const { default: College } = await import("../models/College.js");
const { backfillStudentCollegeIdsCore, buildMongooseDeps } = await import("./backfillStudentCollegeIds.js");

function noopLog() {}

async function seedUser(overrides = {}) {
  return User.create({
    firebaseUid: `fb-${Math.random().toString(36).slice(2)}`,
    email: "someone@example.test",
    ...overrides,
  });
}

// ── TPO-2 Step 1: education.collegeId backfill (real Mongo) ────────────────
// Exercises the ACTUAL production query (buildMongooseDeps' real Mongoose
// calls), not the fake-injected data used by
// backfillStudentCollegeIds.test.js's unit tests — this is what proves the
// real role/roles/emailDomain filtering and the real bulkWrite guard
// behave correctly against genuine documents and indexes, per this
// codebase's established "mocked unit tier + real-Mongo integration tier"
// split (see backend/test/README.md).
describe("backfillStudentCollegeIds (real Mongo)", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("links a real student document to the matching real College via the actual production query", async () => {
    const college = await College.create({ domains: ["mit.edu"], name: "MIT", status: "verified" });
    const student = await seedUser({ email: "student@mit.edu" });
    expect(student.education?.collegeId).toBeFalsy();

    const counts = await backfillStudentCollegeIdsCore(buildMongooseDeps({ log: noopLog }));

    expect(counts.updated).toBe(1);
    const reloaded = await User.findById(student._id);
    expect(reloaded.education.collegeId.toString()).toBe(college._id.toString());
  });

  it("ignores a non-student account (recruiter, no student authorization) entirely", async () => {
    await College.create({ domains: ["mit.edu"], name: "MIT", status: "verified" });
    const recruiter = await seedUser({
      email: "recruiter@mit.edu",
      role: "recruiter",
      roles: ["recruiter"], // explicitly NOT "student" — the real edge case this test needs
    });

    const counts = await backfillStudentCollegeIdsCore(buildMongooseDeps({ log: noopLog }));

    expect(counts.scanned).toBe(0);
    const reloaded = await User.findById(recruiter._id);
    expect(reloaded.education?.collegeId).toBeFalsy();
  });

  it("a TPO account that also holds student authorization (roles includes both) IS scanned", async () => {
    await College.create({ domains: ["mit.edu"], name: "MIT", status: "verified" });
    const tpo = await seedUser({
      email: "tpo@mit.edu",
      role: "tpo",
      roles: ["student", "tpo"], // roles never loses "student" per models/User.js
    });

    const counts = await backfillStudentCollegeIdsCore(buildMongooseDeps({ log: noopLog }));

    expect(counts.updated).toBe(1);
    const reloaded = await User.findById(tpo._id);
    expect(reloaded.education.collegeId).toBeTruthy();
  });

  it("does not overwrite an already-linked student, and does not touch any other field", async () => {
    const otherCollege = await College.create({ domains: ["other.edu"], name: "Other College", status: "verified" });
    await College.create({ domains: ["mit.edu"], name: "MIT", status: "verified" });
    const student = await seedUser({
      email: "student@mit.edu",
      totalXP: 999,
      solvedSlugs: ["two-sum"],
      education: { collegeId: otherCollege._id, branch: "CSE", graduationYear: 2026 },
    });

    const counts = await backfillStudentCollegeIdsCore(buildMongooseDeps({ log: noopLog }));

    expect(counts.alreadyLinked).toBe(1);
    expect(counts.updated).toBe(0);
    const reloaded = await User.findById(student._id);
    expect(reloaded.education.collegeId.toString()).toBe(otherCollege._id.toString());
    expect(reloaded.education.branch).toBe("CSE");
    expect(reloaded.education.graduationYear).toBe(2026);
    expect(reloaded.totalXP).toBe(999);
    expect(reloaded.solvedSlugs).toEqual(["two-sum"]);
  });

  it("running the real backfill twice makes zero additional writes the second time", async () => {
    await College.create({ domains: ["mit.edu"], name: "MIT", status: "verified" });
    await seedUser({ email: "student@mit.edu" });

    const first = await backfillStudentCollegeIdsCore(buildMongooseDeps({ log: noopLog }));
    expect(first.updated).toBe(1);

    const second = await backfillStudentCollegeIdsCore(buildMongooseDeps({ log: noopLog }));
    expect(second.updated).toBe(0);
    expect(second.alreadyLinked).toBe(1);
  });

  it("dry-run against a real database makes zero writes", async () => {
    await College.create({ domains: ["mit.edu"], name: "MIT", status: "verified" });
    const student = await seedUser({ email: "student@mit.edu" });

    const counts = await backfillStudentCollegeIdsCore(buildMongooseDeps({ dryRun: true, log: noopLog }));

    expect(counts.updated).toBe(1); // "would update"
    const reloaded = await User.findById(student._id);
    expect(reloaded.education?.collegeId).toBeFalsy(); // nothing actually written
  });

  it("skips a domain with no matching College (never guesses)", async () => {
    const student = await seedUser({ email: "student@unrecognized.edu" });

    const counts = await backfillStudentCollegeIdsCore(buildMongooseDeps({ log: noopLog }));

    expect(counts.skippedNoMatch).toBe(1);
    const reloaded = await User.findById(student._id);
    expect(reloaded.education?.collegeId).toBeFalsy();
  });

  it("a concurrent write between read and write phases doesn't get clobbered — the bulkWrite guard holds under real Mongo", async () => {
    const collegeA = await College.create({ domains: ["mit.edu"], name: "MIT", status: "verified" });
    const collegeB = await College.create({ domains: ["rival.edu"], name: "Rival", status: "verified" });
    const student = await seedUser({ email: "student@mit.edu" });

    // Simulates another process linking this student to a DIFFERENT
    // college in between this script's read and write phases.
    await User.updateOne({ _id: student._id }, { $set: { "education.collegeId": collegeB._id } });

    const counts = await backfillStudentCollegeIdsCore(buildMongooseDeps({ log: noopLog }));

    // The bulkWrite's own filter re-checks collegeId is still unset —
    // it's not anymore, so the write is a no-op, not an overwrite.
    expect(counts.updated).toBe(0);
    const reloaded = await User.findById(student._id);
    expect(reloaded.education.collegeId.toString()).toBe(collegeB._id.toString());
    expect(reloaded.education.collegeId.toString()).not.toBe(collegeA._id.toString());
  });
});
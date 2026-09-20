import { describe, expect, it, vi } from "vitest";
import { backfillStudentCollegeIdsCore, normalizeDomain } from "./backfillStudentCollegeIds.js";

const noopLog = () => {};

/**
 * Builds a self-contained fake "database" for the core function's three
 * injected operations, backed by plain in-memory arrays — same "fake the
 * data source, test the real algorithm" approach as
 * scripts/migrateHiddenTestcaseSet.test.js's fake collection.
 */
function makeFakeDb({ students = [], colleges = [] } = {}) {
  // Deep-clone so mutations from bulkSetCollegeIds are visible to
  // assertions without students created outside this function leaking
  // shared references across tests.
  const studentDocs = students.map((s) => ({
    ...s,
    education: s.education ? { ...s.education } : undefined,
  }));

  const bulkSetCollegeIds = vi.fn(async (ops) => {
    let modifiedCount = 0;
    for (const { studentId, collegeId } of ops) {
      const doc = studentDocs.find((d) => String(d._id) === String(studentId));
      if (!doc) continue;
      // Mirrors the real bulkWrite filter: only writes if collegeId is
      // still unset at write time.
      if (doc.education?.collegeId) continue;
      doc.education = { ...(doc.education || {}), collegeId };
      modifiedCount += 1;
    }
    return modifiedCount;
  });

  return {
    studentDocs,
    findCandidateStudents: vi.fn(async () => studentDocs.map((d) => ({ ...d, education: d.education ? { ...d.education } : undefined }))),
    findCollegesByDomains: vi.fn(async (domains) =>
      colleges.filter((c) => c.domains.some((d) => domains.includes(d)))
    ),
    bulkSetCollegeIds,
  };
}

describe("normalizeDomain", () => {
  it("lowercases and trims", () => {
    expect(normalizeDomain("  MIT.edu  ")).toBe("mit.edu");
  });
  it("returns null for non-string or empty input", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
  });
});

describe("backfillStudentCollegeIdsCore", () => {
  it("links a student whose domain matches exactly one College", async () => {
    const db = makeFakeDb({
      students: [{ _id: "s1", emailDomain: "mit.edu" }],
      colleges: [{ _id: "c1", domains: ["mit.edu"] }],
    });

    const counts = await backfillStudentCollegeIdsCore({ ...db, log: noopLog });

    expect(counts).toEqual({
      scanned: 1, eligible: 1, updated: 1,
      skippedNoMatch: 0, skippedAmbiguous: 0, alreadyLinked: 0, errors: 0,
    });
    expect(db.studentDocs[0].education.collegeId).toBe("c1");
    expect(db.bulkSetCollegeIds).toHaveBeenCalledWith([{ studentId: "s1", collegeId: "c1" }]);
  });

  it("leaves an already-linked student's collegeId unchanged and does not write", async () => {
    const db = makeFakeDb({
      students: [{ _id: "s1", emailDomain: "mit.edu", education: { collegeId: "existing-college" } }],
      colleges: [{ _id: "c1", domains: ["mit.edu"] }],
    });

    const counts = await backfillStudentCollegeIdsCore({ ...db, log: noopLog });

    expect(counts).toEqual({
      scanned: 1, eligible: 0, updated: 0,
      skippedNoMatch: 0, skippedAmbiguous: 0, alreadyLinked: 1, errors: 0,
    });
    expect(db.studentDocs[0].education.collegeId).toBe("existing-college");
    expect(db.bulkSetCollegeIds).not.toHaveBeenCalled();
    expect(db.findCollegesByDomains).not.toHaveBeenCalled(); // nothing left to resolve
  });

  it("skips (and reports) a domain with no matching College — never guesses", async () => {
    const db = makeFakeDb({
      students: [{ _id: "s1", emailDomain: "unknown-college.edu" }],
      colleges: [{ _id: "c1", domains: ["mit.edu"] }],
    });

    const counts = await backfillStudentCollegeIdsCore({ ...db, log: noopLog });

    expect(counts.skippedNoMatch).toBe(1);
    expect(counts.updated).toBe(0);
    expect(db.studentDocs[0].education).toBeUndefined();
  });

  it("skips a consumer email domain (gmail.com) without even querying for a College match", async () => {
    const db = makeFakeDb({
      students: [{ _id: "s1", emailDomain: "gmail.com" }],
      colleges: [],
    });

    const counts = await backfillStudentCollegeIdsCore({ ...db, log: noopLog });

    expect(counts.skippedNoMatch).toBe(1);
    expect(db.findCollegesByDomains).not.toHaveBeenCalled();
  });

  it("skips (and reports) a domain matching MORE than one College — ambiguous, never guesses which one", async () => {
    const db = makeFakeDb({
      students: [{ _id: "s1", emailDomain: "shared-domain.edu" }],
      colleges: [
        { _id: "c1", domains: ["shared-domain.edu"] },
        { _id: "c2", domains: ["shared-domain.edu"] },
      ],
    });

    const counts = await backfillStudentCollegeIdsCore({ ...db, log: noopLog });

    expect(counts).toEqual({
      scanned: 1, eligible: 0, updated: 0,
      skippedNoMatch: 0, skippedAmbiguous: 1, alreadyLinked: 0, errors: 0,
    });
    expect(db.studentDocs[0].education).toBeUndefined();
    expect(db.bulkSetCollegeIds).not.toHaveBeenCalled();
  });

  it("dry-run reports what WOULD change but performs zero writes", async () => {
    const db = makeFakeDb({
      students: [{ _id: "s1", emailDomain: "mit.edu" }],
      colleges: [{ _id: "c1", domains: ["mit.edu"] }],
    });

    const counts = await backfillStudentCollegeIdsCore({ ...db, dryRun: true, log: noopLog });

    expect(counts.eligible).toBe(1);
    expect(counts.updated).toBe(1); // reported as "would update"
    expect(db.bulkSetCollegeIds).not.toHaveBeenCalled();
    expect(db.studentDocs[0].education).toBeUndefined(); // untouched
  });

  it("running the backfill twice produces no additional changes the second time", async () => {
    const db = makeFakeDb({
      students: [{ _id: "s1", emailDomain: "mit.edu" }],
      colleges: [{ _id: "c1", domains: ["mit.edu"] }],
    });

    const firstRun = await backfillStudentCollegeIdsCore({ ...db, log: noopLog });
    expect(firstRun.updated).toBe(1);

    // Second run reads the now-mutated studentDocs — findCandidateStudents
    // always returns the live array, exactly like a fresh Mongo query would
    // on a second real invocation.
    const secondRun = await backfillStudentCollegeIdsCore({ ...db, log: noopLog });

    expect(secondRun).toEqual({
      scanned: 1, eligible: 0, updated: 0,
      skippedNoMatch: 0, skippedAmbiguous: 0, alreadyLinked: 1, errors: 0,
    });
    expect(db.bulkSetCollegeIds).toHaveBeenCalledOnce(); // only from the first run
  });

  it("processes a mixed batch correctly: eligible, already-linked, no-match, and ambiguous all in one run", async () => {
    const db = makeFakeDb({
      students: [
        { _id: "s1", emailDomain: "mit.edu" },                                        // eligible
        { _id: "s2", emailDomain: "mit.edu", education: { collegeId: "c1" } },         // already linked
        { _id: "s3", emailDomain: "nowhere.edu" },                                     // no match
        { _id: "s4", emailDomain: "shared.edu" },                                      // ambiguous
      ],
      colleges: [
        { _id: "c1", domains: ["mit.edu"] },
        { _id: "c2", domains: ["shared.edu"] },
        { _id: "c3", domains: ["shared.edu"] },
      ],
    });

    const counts = await backfillStudentCollegeIdsCore({ ...db, log: noopLog });

    expect(counts).toEqual({
      scanned: 4, eligible: 1, updated: 1,
      skippedNoMatch: 1, skippedAmbiguous: 1, alreadyLinked: 1, errors: 0,
    });
  });

  it("writes go out in batches no larger than batchSize", async () => {
    const students = Array.from({ length: 5 }, (_, i) => ({ _id: `s${i}`, emailDomain: "mit.edu" }));
    const db = makeFakeDb({ students, colleges: [{ _id: "c1", domains: ["mit.edu"] }] });

    const counts = await backfillStudentCollegeIdsCore({ ...db, batchSize: 2, log: noopLog });

    expect(counts.updated).toBe(5);
    // 5 ops in batches of 2 → 3 calls (2, 2, 1)
    expect(db.bulkSetCollegeIds).toHaveBeenCalledTimes(3);
    expect(db.bulkSetCollegeIds.mock.calls[0][0]).toHaveLength(2);
    expect(db.bulkSetCollegeIds.mock.calls[1][0]).toHaveLength(2);
    expect(db.bulkSetCollegeIds.mock.calls[2][0]).toHaveLength(1);
  });

  it("a failed write batch is counted as errors, without throwing or losing other batches' progress", async () => {
    const students = Array.from({ length: 4 }, (_, i) => ({ _id: `s${i}`, emailDomain: "mit.edu" }));
    const db = makeFakeDb({ students, colleges: [{ _id: "c1", domains: ["mit.edu"] }] });
    db.bulkSetCollegeIds
      .mockRejectedValueOnce(new Error("write boom"))
      .mockResolvedValueOnce(2);

    const counts = await backfillStudentCollegeIdsCore({ ...db, batchSize: 2, log: noopLog });

    expect(counts.eligible).toBe(4);
    expect(counts.errors).toBe(2); // first batch of 2 failed
    expect(counts.updated).toBe(2); // second batch of 2 succeeded
  });

  it("never calls findCollegesByDomains when every candidate is already linked or a consumer domain", async () => {
    const db = makeFakeDb({
      students: [
        { _id: "s1", emailDomain: "gmail.com" },
        { _id: "s2", emailDomain: "mit.edu", education: { collegeId: "c1" } },
      ],
      colleges: [{ _id: "c1", domains: ["mit.edu"] }],
    });

    await backfillStudentCollegeIdsCore({ ...db, log: noopLog });

    expect(db.findCollegesByDomains).not.toHaveBeenCalled();
  });

  it("only ever changes education.collegeId — no other field on the student document is touched", async () => {
    const db = makeFakeDb({
      students: [{
        _id: "s1",
        emailDomain: "mit.edu",
        role: "student",
        totalXP: 4200,
        solvedSlugs: ["two-sum", "valid-parens"],
        education: { branch: "CSE", graduationYear: 2026 },
      }],
      colleges: [{ _id: "c1", domains: ["mit.edu"] }],
    });

    await backfillStudentCollegeIdsCore({ ...db, log: noopLog });

    const doc = db.studentDocs[0];
    expect(doc.education.collegeId).toBe("c1");
    // Every other field, including OTHER education sub-fields, untouched.
    expect(doc.education.branch).toBe("CSE");
    expect(doc.education.graduationYear).toBe(2026);
    expect(doc.role).toBe("student");
    expect(doc.totalXP).toBe(4200);
    expect(doc.solvedSlugs).toEqual(["two-sum", "valid-parens"]);
  });
});
import { describe, expect, it, vi, beforeAll, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";

process.env.B2B_ENABLED = "true";

const { default: tpoRouter, studentAssignmentsRouter, handleRemindAssignment } =
  await import("./tpo.js");
const { default: User } = await import("../models/User.js");
const { default: College } = await import("../models/College.js");
const { default: Cohort } = await import("../models/Cohort.js");
const { default: CohortMembership } = await import("../models/CohortMembership.js");
const { default: Assignment } = await import("../models/Assignment.js");
const { default: Notification } = await import("../models/Notification.js");

function mockRes() {
  const res = {};
  res._status = 200;
  res._json = null;
  res.status = vi.fn((code) => { res._status = code; return res; });
  res.json = vi.fn((body) => { res._json = body; return res; });
  return res;
}

function mockLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

async function runRoute(router, method, path, req) {
  const res = mockRes();
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`No ${method.toUpperCase()} ${path} route found`);

  for (const routeLayer of layer.route.stack) {
    let calledNext = false;
    let nextErr;
    await routeLayer.handle(req, res, (err) => {
      calledNext = true;
      nextErr = err;
    });
    if (nextErr) throw nextErr;
    if (!calledNext) break;
  }
  return res;
}

describe("TPO-4 cohort assignments — real Mongo integration", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  async function seed() {
    const college = await College.create({
      // Deliberately multi-domain: proves cohort targeting is not restricted
      // to the TPO's own email domain.
      domains: ["a.edu", "b.edu"],
      name: "Cohort Test University",
      status: "verified",
    });

    const tpo = await User.create({
      firebaseUid: "fb-tpo-4",
      email: "tpo@a.edu",
      role: "tpo",
      roles: ["student", "tpo"],
      tpoProfile: {
        collegeDomain: "a.edu",
        collegeName: college.name,
        verified: true,
        requestedAt: new Date(),
        verifiedAt: new Date(),
      },
    });

    const cohort = await Cohort.create({
      collegeId: college._id,
      name: "CSE 2027",
      academicYear: "2024-2025",
      graduatingYear: 2027,
      branch: "CSE",
      createdBy: tpo._id,
    });

    const studentA = await User.create({
      firebaseUid: "fb-student-a",
      email: "a@a.edu",
      role: "student",
      roles: ["student"],
      solvedSlugs: ["p1", "p2"],
    });
    const studentB = await User.create({
      firebaseUid: "fb-student-b",
      email: "b@b.edu",
      role: "student",
      roles: ["student"],
      solvedSlugs: ["p1"],
    });
    const outsider = await User.create({
      firebaseUid: "fb-outsider",
      email: "outsider@a.edu",
      role: "student",
      roles: ["student"],
      solvedSlugs: ["p1", "p2"],
    });

    await CohortMembership.create([
      {
        cohortId: cohort._id,
        collegeId: college._id,
        studentId: studentA._id,
        email: studentA.email,
        status: "active",
        addedBy: tpo._id,
      },
      {
        cohortId: cohort._id,
        collegeId: college._id,
        studentId: studentB._id,
        email: studentB.email,
        status: "active",
        addedBy: tpo._id,
      },
    ]);

    return { college, tpo, cohort, studentA, studentB, outsider };
  }

  it("creation targets exactly one active cohort and preserves the cohort reference", async () => {
    const { college, tpo, cohort } = await seed();

    const res = await runRoute(tpoRouter, "post", "/assignments", {
      userDoc: tpo,
      body: {
        title: "Cohort Assignment",
        problemSlugs: ["p1", "p2"],
        dueDate: "2026-10-01T00:00:00.000Z",
        cohortId: cohort._id.toString(),
      },
      query: {},
      log: mockLog(),
    });

    expect(res._status).toBe(201);
    expect(String(res._json.cohortId)).toBe(String(cohort._id));

    const saved = await Assignment.findById(res._json._id).lean();
    expect(String(saved.cohortId)).toBe(String(cohort._id));
    expect(saved.collegeDomain).toBe("a.edu");
    expect(String(saved.collegeId)).toBe(String(college._id));
  });

  it("TPO completion is calculated from the cohort roster, not the whole college", async () => {
    const { tpo, cohort, outsider, studentA } = await seed();

    const assignment = await Assignment.create({
      tpoId: tpo._id,
      collegeDomain: "a.edu",
      cohortId: cohort._id,
      title: "Cohort Progress",
      problemSlugs: ["p1", "p2"],
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
    });

    // Outsider has solved everything but is not a cohort member. If the
    // implementation accidentally used the whole college, completion would
    // be inflated. The correct audience is exactly A + B: one complete.
    expect(outsider.emailDomain).toBe("a.edu");
    expect(studentA.emailDomain).toBe("a.edu");

    const res = await runRoute(tpoRouter, "get", "/assignments", {
      userDoc: tpo,
      query: {},
      log: mockLog(),
    });

    expect(res._status).toBe(200);
    expect(res._json.assignments).toHaveLength(1);

    const result = res._json.assignments[0];
    expect(result.cohort.name).toBe("CSE 2027");
    expect(result.totalStudents).toBe(2);
    expect(result.completedCount).toBe(1);
    expect(result.completionPercent).toBe(50);
  });

  it("student receives a cohort assignment only through active membership", async () => {
    const { tpo, cohort, studentA, outsider } = await seed();

    await Assignment.create({
      tpoId: tpo._id,
      collegeDomain: "a.edu",
      cohortId: cohort._id,
      title: "Private Cohort Assignment",
      problemSlugs: ["p1", "p2"],
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
    });

    const memberRes = await runRoute(studentAssignmentsRouter, "get", "/", {
      userDoc: studentA,
      query: {},
      log: mockLog(),
    });
    const outsiderRes = await runRoute(studentAssignmentsRouter, "get", "/", {
      userDoc: outsider,
      query: {},
      log: mockLog(),
    });

    expect(memberRes._status).toBe(200);
    expect(memberRes._json.assignments).toHaveLength(1);
    expect(memberRes._json.assignments[0].cohort.name).toBe("CSE 2027");

    expect(outsiderRes._status).toBe(200);
    expect(outsiderRes._json.assignments).toHaveLength(0);
  });

  it("reminders target incomplete active cohort members only", async () => {
    const { tpo, cohort } = await seed();

    const assignment = await Assignment.create({
      tpoId: tpo._id,
      collegeDomain: "a.edu",
      cohortId: cohort._id,
      title: "Reminder Assignment",
      problemSlugs: ["p1", "p2"],
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
    });

    const res = await handleRemindAssignment({
      userDoc: tpo,
      params: { id: assignment._id.toString() },
      log: mockLog(),
    }, mockRes());

    expect(res._status).toBe(200);
    expect(res._json.remindedCount).toBe(1);
  });

  it("TPOs from every college domain can see the same college-wide assignment", async () => {
    const { college, tpo, studentA } = await seed();

    const tpoB = await User.create({
      firebaseUid: "fb-tpo-4-b",
      email: "tpo@b.edu",
      role: "tpo",
      roles: ["student", "tpo"],
      tpoProfile: {
        collegeDomain: "b.edu",
        collegeName: college.name,
        verified: true,
        requestedAt: new Date(),
        verifiedAt: new Date(),
      },
    });

    await Assignment.create({
      tpoId: tpo._id,
      collegeId: college._id,
      collegeDomain: "a.edu",
      cohortId: null,
      title: "Cross Domain College Assignment",
      problemSlugs: ["p1"],
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
    });

    const res = await runRoute(tpoRouter, "get", "/assignments", {
      userDoc: tpoB,
      query: {},
      log: mockLog(),
    });

    expect(res._status).toBe(200);
    expect(res._json.assignments).toHaveLength(1);
    expect(res._json.assignments[0].title).toBe("Cross Domain College Assignment");
    expect(res._json.assignments[0].totalStudents).toBe(3);
    expect(String(res._json.assignments[0].cohortId ?? "")).toBe("");
    expect(studentA.emailDomain).toBe("a.edu");
  });

  it("TPOs from every college domain can remind the same college-wide assignment", async () => {
    const { college, tpo } = await seed();

    const tpoB = await User.create({
      firebaseUid: "fb-tpo-4-remind-b",
      email: "tpo-remind@b.edu",
      role: "tpo",
      roles: ["student", "tpo"],
      tpoProfile: {
        collegeDomain: "b.edu",
        collegeName: college.name,
        verified: true,
        requestedAt: new Date(),
        verifiedAt: new Date(),
      },
    });

    const assignment = await Assignment.create({
      tpoId: tpo._id,
      collegeId: college._id,
      collegeDomain: "a.edu",
      cohortId: null,
      title: "Cross Domain Reminder Assignment",
      problemSlugs: ["p1", "p2"],
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
    });

    const res = await handleRemindAssignment({
      userDoc: tpoB,
      params: { id: assignment._id.toString() },
      log: mockLog(),
    }, mockRes());

    expect(res._status).toBe(200);
    expect(res._json.remindedCount).toBe(1);
  });

  it("students from every college domain receive the same college-wide assignment", async () => {
    const { college, tpo, studentB } = await seed();

    const assignment = await Assignment.create({
      tpoId: tpo._id,
      collegeId: college._id,
      collegeDomain: "a.edu",
      cohortId: null,
      title: "Canonical College Assignment",
      problemSlugs: ["p1"],
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
    });

    const res = await runRoute(studentAssignmentsRouter, "get", "/", {
      userDoc: studentB,
      query: {},
      log: mockLog(),
    });

    expect(res._status).toBe(200);
    expect(res._json.assignments).toHaveLength(1);
    expect(String(res._json.assignments[0]._id)).toBe(String(assignment._id));
  });

  it("college-wide assignment notifications reach students across every college domain", async () => {
    const { college, tpo, studentA, studentB, outsider } = await seed();

    const res = await runRoute(tpoRouter, "post", "/assignments", {
      userDoc: tpo,
      body: {
        title: "Cross Domain Notification Assignment",
        problemSlugs: ["p1"],
        dueDate: "2026-10-01T00:00:00.000Z",
      },
      query: {},
      log: mockLog(),
    });

    expect(res._status).toBe(201);
    const assignmentId = String(res._json._id);

    // Notification fan-out is intentionally non-blocking in the route, so
    // wait briefly for the background insertMany() to complete.
    let notifications = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      notifications = await Notification.find({
        type: "assignment_created",
        "meta.assignmentId": res._json._id,
      })
        .select("userId meta")
        .lean();

      if (notifications.length === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    expect(notifications).toHaveLength(3);
    expect(new Set(notifications.map((n) => String(n.userId))).size).toBe(3);

    const notifiedIds = new Set(notifications.map((n) => String(n.userId)));
    expect(notifiedIds).toEqual(
      new Set([studentA, studentB, outsider].map((student) => String(student._id)))
    );
    expect(notifications.every((n) => String(n.meta.assignmentId) === assignmentId)).toBe(true);
    expect(college.domains).toEqual(["a.edu", "b.edu"]);
  });

  it("archived assignments stay in TPO history but leave student delivery and reminders", async () => {
    const { tpo, studentA } = await seed();

    const assignment = await Assignment.create({
      tpoId: tpo._id,
      collegeId: (await College.findOne({ name: "Cohort Test University" }))._id,
      collegeDomain: "a.edu",
      cohortId: null,
      title: "Archive Me",
      problemSlugs: ["p1"],
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
    });

    const archiveRes = await runRoute(tpoRouter, "post", "/assignments/:id/archive", {
      userDoc: tpo,
      params: { id: assignment._id.toString() },
      body: {},
      query: {},
      log: mockLog(),
    });

    expect(archiveRes._status).toBe(200);
    expect(archiveRes._json.status).toBe("archived");

    const saved = await Assignment.findById(assignment._id).lean();
    expect(saved.status).toBe("archived");

    const tpoRes = await runRoute(tpoRouter, "get", "/assignments", {
      userDoc: tpo,
      query: {},
      log: mockLog(),
    });
    expect(tpoRes._json.assignments).toHaveLength(1);
    expect(tpoRes._json.assignments[0].status).toBe("archived");

    const studentRes = await runRoute(studentAssignmentsRouter, "get", "/", {
      userDoc: studentA,
      query: {},
      log: mockLog(),
    });
    expect(studentRes._json.assignments).toHaveLength(0);

    const remindRes = await handleRemindAssignment({
      userDoc: tpo,
      params: { id: assignment._id.toString() },
      log: mockLog(),
    }, mockRes());
    expect(remindRes._status).toBe(409);
    expect(remindRes._json.error).toMatch(/archived/i);
  });

  it("institution report overview route returns the canonical scoped report for a verified TPO", async () => {
    const { college, tpo, studentA, studentB } = await seed();

    await Assignment.create({
      tpoId: tpo._id,
      collegeId: college._id,
      collegeDomain: "a.edu",
      cohortId: null,
      title: "Report Assignment",
      problemSlugs: ["p1", "p2"],
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
      createdAt: new Date("2026-09-20T00:00:00.000Z"),
    });

    const res = await runRoute(tpoRouter, "get", "/report/overview", {
      userDoc: tpo,
      query: {
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-30T23:59:59.999Z",
      },
      body: {},
      log: mockLog(),
    });

    expect(res._status).toBe(200);
    expect(String(res._json.collegeId)).toBe(String(college._id));
    expect(res._json.college).toBe(college.name);
    expect(res._json.students.total).toBe(3);
    expect(res._json.assignments.total).toBe(1);
    expect(res._json.assignments.assignedStudents).toBe(3);
    expect(res._json.range.from).toBe("2026-09-01T00:00:00.000Z");
    expect(res._json.range.to).toBe("2026-09-30T23:59:59.999Z");
    expect(studentA.emailDomain).toBe("a.edu");
    expect(studentB.emailDomain).toBe("b.edu");
  });

  it("admin report requests require an explicit collegeId", async () => {
    const { tpo } = await seed();
    const admin = await User.create({
      firebaseUid: "fb-report-admin",
      email: "admin@codeclub.dev",
      role: "admin",
      roles: ["admin"],
    });

    const res = await runRoute(tpoRouter, "get", "/report/overview", {
      userDoc: admin,
      query: {},
      body: {},
      log: mockLog(),
    });

    expect(res._status).toBe(400);
    expect(res._json.error).toMatch(/collegeId is required/i);
    expect(tpo.role).toBe("tpo");
  });

  it("legacy college-wide assignments remain visible to college students", async () => {
    const { tpo, studentA, outsider } = await seed();

    await Assignment.create({
      tpoId: tpo._id,
      collegeDomain: "a.edu",
      cohortId: null,
      title: "Legacy Assignment",
      problemSlugs: ["p1"],
      dueDate: new Date("2026-10-01T00:00:00.000Z"),
    });

    const memberRes = await runRoute(studentAssignmentsRouter, "get", "/", {
      userDoc: studentA,
      query: {},
      log: mockLog(),
    });
    const outsiderRes = await runRoute(studentAssignmentsRouter, "get", "/", {
      userDoc: outsider,
      query: {},
      log: mockLog(),
    });

    expect(memberRes._json.assignments).toHaveLength(1);
    expect(outsiderRes._json.assignments).toHaveLength(1);
  });
});

import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";

process.env.B2B_ENABLED = "true";

const { default: tpoRouter } = await import("./tpo.js");
const { default: User } = await import("../models/User.js");
const { default: College } = await import("../models/College.js");
const { default: PlacementVisibilityAuditLog } = await import("../models/PlacementVisibilityAuditLog.js");
const { updateMe } = await import("../controllers/userController.js");
const { invalidateTpoCache } = await import("../controllers/tpoController.js");

function mockRes() {
  const res = {
    _status: 200,
    _json: null,
    _headers: {},
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._json = body;
      return this;
    },
    set(name, value) {
      this._headers[name] = value;
      return this;
    },
  };
  return res;
}

async function runRoute(method, path, req) {
  const res = mockRes();
  const layer = tpoRouter.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
  );
  expect(layer).toBeTruthy();

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

async function waitForAuditLog(userId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const entry = await PlacementVisibilityAuditLog.findOne({ userId }).sort({ createdAt: -1 });
    if (entry) return entry;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

describe("TPO-3 student placement visibility — end-to-end real Mongo", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("student opts out → persisted preference + audit → TPO directory excludes student → dashboard reports opt-out", async () => {
    const college = await College.create({
      domains: ["privacy-college.ac.in"],
      name: "Privacy College",
      status: "verified",
    });

    const tpo = await User.create({
      firebaseUid: "fb-tpo-privacy-e2e",
      email: "tpo@privacy-college.ac.in",
      role: "tpo",
      roles: ["student", "tpo"],
      tpoProfile: {
        collegeDomain: "privacy-college.ac.in",
        collegeName: "Privacy College",
        verified: true,
        requestedAt: new Date(),
        verifiedAt: new Date(),
      },
    });

    const student = await User.create({
      firebaseUid: "fb-student-privacy-e2e",
      email: "student@privacy-college.ac.in",
      displayName: "Privacy Student",
      role: "student",
      roles: ["student"],
      visibleToTpo: true,
      isProfilePublic: false,
      totalXP: 120,
      solvedSlugs: ["two-sum", "valid-parentheses"],
      currentStreak: 3,
    });

    expect(college.status).toBe("verified");
    expect(student.emailDomain).toBe("privacy-college.ac.in");

    const tpoReq = {
      userDoc: tpo,
      query: {},
      body: {},
      log: { error() {}, warn() {}, info() {}, debug() {} },
    };

    const beforeStudents = await runRoute("get", "/students", tpoReq);
    expect(beforeStudents._status).toBe(200);
    expect(beforeStudents._json.total).toBe(1);
    expect(beforeStudents._json.students.map((item) => item.email)).toContain(student.email);

    const updateRes = mockRes();
    await updateMe(
      {
        userDoc: student,
        body: { visibleToTpo: false },
        log: { error() {}, warn() {}, info() {}, debug() {} },
      },
      updateRes
    );

    expect(updateRes._status).toBe(200);
    expect(updateRes._json.visibleToTpo).toBe(false);

    const reloadedStudent = await User.findById(student._id);
    expect(reloadedStudent.visibleToTpo).toBe(false);
    expect(reloadedStudent.isProfilePublic).toBe(false);

    const audit = await waitForAuditLog(student._id);
    expect(audit).toBeTruthy();
    expect(audit.previousValue).toBe(true);
    expect(audit.newValue).toBe(false);
    expect(audit.source).toBe("student_settings");

    // Privacy changes must not leave the TPO's cached directory/dashboard stale.
    await invalidateTpoCache("privacy-college.ac.in");

    const afterStudents = await runRoute("get", "/students", tpoReq);
    expect(afterStudents._status).toBe(200);
    expect(afterStudents._json.total).toBe(0);
    expect(afterStudents._json.students).toHaveLength(0);

    const afterDashboard = await runRoute("get", "/dashboard", tpoReq);
    expect(afterDashboard._status).toBe(200);
    expect(afterDashboard._json.totalStudents).toBe(0);
    expect(afterDashboard._json.optedOutStudents).toBe(1);
    expect(afterDashboard._json.message).toContain("opted out");
  });

  it("changing TPO visibility does not change public-profile visibility", async () => {
    const student = await User.create({
      firebaseUid: "fb-student-privacy-independent",
      email: "independent@privacy-independent.ac.in",
      role: "student",
      roles: ["student"],
      visibleToTpo: true,
      isProfilePublic: true,
    });

    const updateRes = mockRes();
    await updateMe(
      {
        userDoc: student,
        body: { visibleToTpo: false },
        log: { error() {}, warn() {}, info() {}, debug() {} },
      },
      updateRes
    );

    const reloaded = await User.findById(student._id);
    expect(reloaded.visibleToTpo).toBe(false);
    expect(reloaded.isProfilePublic).toBe(true);
  });
});

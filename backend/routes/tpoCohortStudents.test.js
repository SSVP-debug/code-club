import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../config/featureFlags.js", () => ({
  B2B_ENABLED: true,
}));
vi.mock("../models/User.js", () => ({
  default: { find: vi.fn(), findOne: vi.fn(), aggregate: vi.fn() },
}));
vi.mock("../models/Assignment.js", () => ({
  default: { findOne: vi.fn(), create: vi.fn(), find: vi.fn() },
}));
vi.mock("../utils/cache.js", () => ({
  getOrSetCache: vi.fn(async (key, ttl, fetchFn) => ({ value: await fetchFn(), cacheStatus: "MISS" })),
  invalidateCachePrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/notificationService.js", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  createNotificationBulk: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/settingsService.js", () => ({
  getSettings: vi.fn(),
}));
vi.mock("../utils/userAuthCache.js", () => ({
  invalidateCachedUserByFirebaseUid: vi.fn(),
}));
vi.mock("../services/tpoTeamService.js", () => ({
  getCollegeForTpo: vi.fn(),
  isPrimaryTpo: vi.fn(),
  listTeam: vi.fn(),
  claimPrimaryIfNone: vi.fn(),
  transferPrimary: vi.fn(),
  resolveTpoTeamContext: vi.fn(),
  resolveCollegeDomains: vi.fn(),
}));
vi.mock("../services/cohortService.js", () => ({
  listCohorts: vi.fn(),
  createCohort: vi.fn(),
  getCohortForCollege: vi.fn(),
  updateCohort: vi.fn(),
  archiveCohort: vi.fn(),
  isCohortValidationError: vi.fn((err) => err?.name === "ValidationError" || err?.name === "CastError"),
  formatCohortValidationError: vi.fn(() => "Invalid input."),
}));
vi.mock("../services/cohortMembershipService.js", () => ({
  getCohortRoster: vi.fn(),
  addStudentToCohort: vi.fn(),
  removeCohortMembership: vi.fn(),
  isCohortValidationError: vi.fn((err) => err?.name === "ValidationError" || err?.name === "CastError"),
  formatCohortValidationError: vi.fn(() => "Invalid input."),
}));

import { resolveTpoTeamContext } from "../services/tpoTeamService.js";
import * as cohortMembershipService from "../services/cohortMembershipService.js";
import tpoRouter from "./tpo.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

async function runRoute(method, path, req) {
  const res = mockRes();
  const layer = tpoRouter.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) {
    throw new Error(`No ${method.toUpperCase()} ${path} route found on tpoRouter`);
  }
  for (const routeLayer of layer.route.stack) {
    let calledNext = false;
    let nextErr;
    await routeLayer.handle(req, res, (err) => { calledNext = true; nextErr = err; });
    if (nextErr) throw nextErr;
    if (!calledNext) break;
  }
  return res;
}

const college = { _id: "college-A", name: "College A", domains: ["a.edu"], primaryTpo: "primary-id" };

const primaryTpo = {
  role: "tpo",
  _id: { toString: () => "primary-id" },
  tpoProfile: { collegeDomain: "a.edu", collegeName: "College A", verified: true },
};
const secondaryTpo = {
  role: "tpo",
  _id: { toString: () => "secondary-id" },
  tpoProfile: { collegeDomain: "a.edu", collegeName: "College A", verified: true },
};
const unverifiedTpo = {
  role: "tpo",
  _id: { toString: () => "unverified-id" },
  tpoProfile: { collegeDomain: "a.edu", verified: false },
};
const student = { role: "student", _id: { toString: () => "s1" } };

function nonAdminContext(collegeDoc) {
  return { college: collegeDoc, isAdmin: false, missingCollegeId: false };
}

const sampleRosterResponse = {
  students: [
    { membershipId: "m1", studentId: "s1", name: "Jane Doe", email: "jane@a.edu", membershipStatus: "active", invitedAt: null, joinedAt: "2024-01-01", removedAt: null },
  ],
  total: 1, page: 1, limit: 25,
  counts: { activeCount: 1, invitedCount: 0, removedCount: 0 },
};

describe("Cohort roster/membership routes (TPO-2 Step 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /cohorts/:cohortId/students", () => {
    it("returns the roster scoped to the resolved institution", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortMembershipService.getCohortRoster.mockResolvedValueOnce(sampleRosterResponse);

      const res = await runRoute("get", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, query: {},
      });

      expect(cohortMembershipService.getCohortRoster).toHaveBeenCalledWith(
        "cohort-1", "college-A", expect.objectContaining({ page: 1, limit: 25 })
      );
      expect(res.json).toHaveBeenCalledWith(sampleRosterResponse);
    });

    it("a secondary TPO can view the roster (no primary-only gate)", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortMembershipService.getCohortRoster.mockResolvedValueOnce(sampleRosterResponse);

      const res = await runRoute("get", "/cohorts/:cohortId/students", {
        userDoc: secondaryTpo, params: { cohortId: "cohort-1" }, query: {},
      });

      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it("passes status/search/sort query params through", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortMembershipService.getCohortRoster.mockResolvedValueOnce(sampleRosterResponse);

      await runRoute("get", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" },
        query: { status: "invited", search: "jane", sort: "name" },
      });

      expect(cohortMembershipService.getCohortRoster).toHaveBeenCalledWith(
        "cohort-1", "college-A",
        expect.objectContaining({ status: "invited", search: "jane", sort: "name" })
      );
    });

    it("404s for a malformed/missing cohort", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortMembershipService.getCohortRoster.mockResolvedValueOnce(null);

      const res = await runRoute("get", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, query: {},
      });

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("400s for an invalid cohort id", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortMembershipService.getCohortRoster.mockResolvedValueOnce({ invalidId: true });

      const res = await runRoute("get", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "not-an-id" }, query: {},
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("POST /cohorts/:cohortId/students", () => {
    beforeEach(() => {
      resolveTpoTeamContext.mockResolvedValue(nonAdminContext(college));
    });

    it("adds a student and returns 201 for a brand-new membership", async () => {
      cohortMembershipService.addStudentToCohort.mockResolvedValueOnce({
        membership: { membershipId: "m1", membershipStatus: "active" }, created: true, noop: false,
      });

      const res = await runRoute("post", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: { email: "student@a.edu" },
      });

      expect(cohortMembershipService.addStudentToCohort).toHaveBeenCalledWith(
        "cohort-1", "college-A", primaryTpo._id, "student@a.edu"
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("a secondary TPO can add a student (no primary-only gate)", async () => {
      cohortMembershipService.addStudentToCohort.mockResolvedValueOnce({
        membership: { membershipId: "m1" }, created: true, noop: false,
      });

      const res = await runRoute("post", "/cohorts/:cohortId/students", {
        userDoc: secondaryTpo, params: { cohortId: "cohort-1" }, body: { email: "student@a.edu" },
      });

      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it("returns 200 (not 201) for a promotion/reactivation, not a brand-new row", async () => {
      cohortMembershipService.addStudentToCohort.mockResolvedValueOnce({
        membership: { membershipId: "m1", membershipStatus: "active" }, created: false, noop: false,
      });

      const res = await runRoute("post", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: { email: "student@a.edu" },
      });

      expect(res.status).not.toHaveBeenCalledWith(201);
    });

    it("409s with a conflict response when already an active member", async () => {
      cohortMembershipService.addStudentToCohort.mockResolvedValueOnce({
        conflict: true, membership: { membershipId: "m1", membershipStatus: "active" },
      });

      const res = await runRoute("post", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: { email: "student@a.edu" },
      });

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("400s on a validationError (e.g. foreign-institution match)", async () => {
      cohortMembershipService.addStudentToCohort.mockResolvedValueOnce({
        validationError: "This account belongs to a different institution.",
      });

      const res = await runRoute("post", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: { email: "foreign@b.edu" },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "This account belongs to a different institution." });
    });

    it("404s for a cohort not found in this institution", async () => {
      cohortMembershipService.addStudentToCohort.mockResolvedValueOnce(null);

      const res = await runRoute("post", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: { email: "student@a.edu" },
      });

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("409s for an archived cohort — a frozen roster cannot gain a new member (TPO-2 closure audit)", async () => {
      cohortMembershipService.addStudentToCohort.mockResolvedValueOnce({ archived: true });

      const res = await runRoute("post", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: { email: "student@a.edu" },
      });

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("400s for an invalid cohort id", async () => {
      cohortMembershipService.addStudentToCohort.mockResolvedValueOnce({ invalidId: true });

      const res = await runRoute("post", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "not-an-id" }, body: { email: "student@a.edu" },
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("ignores client-supplied collegeId/studentId/cohortId in the body — only email is ever forwarded", async () => {
      cohortMembershipService.addStudentToCohort.mockResolvedValueOnce({
        membership: { membershipId: "m1" }, created: true, noop: false,
      });

      await runRoute("post", "/cohorts/:cohortId/students", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" },
        body: { email: "student@a.edu", collegeId: "college-B", studentId: "attacker-id", cohortId: "college-b-cohort" },
      });

      expect(cohortMembershipService.addStudentToCohort).toHaveBeenCalledWith(
        "cohort-1", "college-A", primaryTpo._id, "student@a.edu"
      );
    });
  });

  describe("DELETE /cohorts/:cohortId/students/:membershipId", () => {
    beforeEach(() => {
      resolveTpoTeamContext.mockResolvedValue(nonAdminContext(college));
    });

    it("removes a membership and returns it with alreadyRemoved: false", async () => {
      cohortMembershipService.removeCohortMembership.mockResolvedValueOnce({
        membership: { membershipId: "m1", membershipStatus: "removed" }, alreadyRemoved: false,
      });

      const res = await runRoute("delete", "/cohorts/:cohortId/students/:membershipId", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1", membershipId: "m1" }, body: {},
      });

      expect(cohortMembershipService.removeCohortMembership).toHaveBeenCalledWith("cohort-1", "m1", "college-A");
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alreadyRemoved: false }));
    });

    it("a secondary TPO can remove a membership (no primary-only gate)", async () => {
      cohortMembershipService.removeCohortMembership.mockResolvedValueOnce({
        membership: { membershipId: "m1" }, alreadyRemoved: false,
      });

      const res = await runRoute("delete", "/cohorts/:cohortId/students/:membershipId", {
        userDoc: secondaryTpo, params: { cohortId: "cohort-1", membershipId: "m1" }, body: {},
      });

      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it("repeat removal is idempotent: 200 with alreadyRemoved: true, not an error", async () => {
      cohortMembershipService.removeCohortMembership.mockResolvedValueOnce({
        membership: { membershipId: "m1", membershipStatus: "removed" }, alreadyRemoved: true,
      });

      const res = await runRoute("delete", "/cohorts/:cohortId/students/:membershipId", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1", membershipId: "m1" }, body: {},
      });

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alreadyRemoved: true }));
    });

    it("404s for a membership not found in this cohort/institution", async () => {
      cohortMembershipService.removeCohortMembership.mockResolvedValueOnce(null);

      const res = await runRoute("delete", "/cohorts/:cohortId/students/:membershipId", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1", membershipId: "m1" }, body: {},
      });

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("409s for an archived cohort — a frozen roster cannot be mutated (TPO-2 closure audit)", async () => {
      cohortMembershipService.removeCohortMembership.mockResolvedValueOnce({ archived: true });

      const res = await runRoute("delete", "/cohorts/:cohortId/students/:membershipId", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1", membershipId: "m1" }, body: {},
      });

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("400s for a malformed cohort or membership id", async () => {
      cohortMembershipService.removeCohortMembership.mockResolvedValueOnce({ invalidId: true });

      const res = await runRoute("delete", "/cohorts/:cohortId/students/:membershipId", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1", membershipId: "not-an-id" }, body: {},
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("authorization matrix", () => {
    it("an unverified TPO is blocked", async () => {
      const res = await runRoute("get", "/cohorts/:cohortId/students", {
        userDoc: unverifiedTpo, params: { cohortId: "cohort-1" }, query: {},
      });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(cohortMembershipService.getCohortRoster).not.toHaveBeenCalled();
    });

    it("a non-TPO student is blocked", async () => {
      const res = await runRoute("get", "/cohorts/:cohortId/students", {
        userDoc: student, params: { cohortId: "cohort-1" }, query: {},
      });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(cohortMembershipService.getCohortRoster).not.toHaveBeenCalled();
    });
  });
});
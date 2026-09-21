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

import { resolveTpoTeamContext } from "../services/tpoTeamService.js";
import * as cohortService from "../services/cohortService.js";
import tpoRouter from "./tpo.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// Same route-dispatch harness as routes/tpoTeam.test.js.
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
    await routeLayer.handle(req, res, (err) => {
      calledNext = true;
      nextErr = err;
    });
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
const adminUser = { role: "admin", _id: { toString: () => "admin-id" } };

function nonAdminContext(collegeDoc) {
  return { college: collegeDoc, isAdmin: false, missingCollegeId: false };
}
function adminContext(collegeDoc) {
  return { college: collegeDoc, isAdmin: true, missingCollegeId: false };
}

const sampleCohortSummary = {
  id: "cohort-1", name: "CSE 2027", academicYear: "2024-2025", graduatingYear: 2027,
  branch: "CSE", section: null, expectedHeadcount: null, status: "active",
  createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("Cohort routes (TPO-2 Step 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /cohorts", () => {
    it("lists cohorts scoped to the resolved institution", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.listCohorts.mockResolvedValueOnce({ items: [sampleCohortSummary], total: 1, page: 1, limit: 25 });

      const res = await runRoute("get", "/cohorts", { userDoc: primaryTpo, query: {} });

      expect(cohortService.listCohorts).toHaveBeenCalledWith("college-A", expect.objectContaining({ page: 1, limit: 25 }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ items: [sampleCohortSummary], total: 1 }));
    });

    it("a secondary TPO can list cohorts (no primary-only gate)", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.listCohorts.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 25 });

      const res = await runRoute("get", "/cohorts", { userDoc: secondaryTpo, query: {} });

      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it("passes status/graduatingYear/branch/search filters through when supplied", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.listCohorts.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 25 });

      await runRoute("get", "/cohorts", {
        userDoc: primaryTpo,
        query: { status: "archived", graduatingYear: "2027", branch: "CSE", search: "sec" },
      });

      expect(cohortService.listCohorts).toHaveBeenCalledWith(
        "college-A",
        expect.objectContaining({ status: "archived", graduatingYear: 2027, branch: "CSE", search: "sec" })
      );
    });

    it("ignores an invalid status filter value rather than passing it through", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.listCohorts.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 25 });

      await runRoute("get", "/cohorts", { userDoc: primaryTpo, query: { status: "not-a-real-status" } });

      const filtersArg = cohortService.listCohorts.mock.calls[0][1];
      expect(filtersArg.status).toBeUndefined();
    });

    it("an admin can list an explicit college's cohorts via collegeId", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(adminContext(college));
      cohortService.listCohorts.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 25 });

      const res = await runRoute("get", "/cohorts", { userDoc: adminUser, query: { collegeId: "college-A" } });

      expect(resolveTpoTeamContext).toHaveBeenCalledWith(adminUser, "college-A");
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it("400s an admin request with no collegeId", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce({ college: null, isAdmin: true, missingCollegeId: true });

      const res = await runRoute("get", "/cohorts", { userDoc: adminUser, query: {} });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(cohortService.listCohorts).not.toHaveBeenCalled();
    });
  });

  describe("POST /cohorts", () => {
    it("creates a cohort using the resolved institution and authenticated user, returns 201", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.createCohort.mockResolvedValueOnce(sampleCohortSummary);

      const res = await runRoute("post", "/cohorts", {
        userDoc: primaryTpo,
        body: { name: "CSE 2027", academicYear: "2024-2025", graduatingYear: 2027, branch: "CSE" },
      });

      expect(cohortService.createCohort).toHaveBeenCalledWith(
        "college-A", primaryTpo._id,
        expect.objectContaining({ name: "CSE 2027" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("a secondary TPO can create a cohort (no primary-only gate)", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.createCohort.mockResolvedValueOnce(sampleCohortSummary);

      const res = await runRoute("post", "/cohorts", {
        userDoc: secondaryTpo,
        body: { name: "CSE 2027", academicYear: "2024-2025", graduatingYear: 2027, branch: "CSE" },
      });

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(cohortService.createCohort).toHaveBeenCalledWith("college-A", secondaryTpo._id, expect.anything());
    });

    it("ignores a client-supplied collegeId — always uses the resolved institution", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.createCohort.mockResolvedValueOnce(sampleCohortSummary);

      await runRoute("post", "/cohorts", {
        userDoc: primaryTpo,
        body: {
          name: "CSE 2027", academicYear: "2024-2025", graduatingYear: 2027, branch: "CSE",
          collegeId: "college-B", // attempted bypass
        },
      });

      expect(cohortService.createCohort).toHaveBeenCalledWith("college-A", primaryTpo._id, expect.anything());
    });

    it("maps a service-layer validation error to 400 with a clean message", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      const err = Object.assign(new Error("bad"), { name: "ValidationError" });
      cohortService.createCohort.mockRejectedValueOnce(err);

      const res = await runRoute("post", "/cohorts", { userDoc: primaryTpo, body: {} });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid input." });
    });

    it("500s (without leaking internals) on an unexpected error", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.createCohort.mockRejectedValueOnce(new Error("db exploded"));

      const res = await runRoute("post", "/cohorts", { userDoc: primaryTpo, body: {} });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.not.stringContaining("db exploded") }));
    });
  });

  describe("GET /cohorts/:cohortId", () => {
    it("returns the cohort when found in the resolved institution", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.getCohortForCollege.mockResolvedValueOnce(sampleCohortSummary);

      const res = await runRoute("get", "/cohorts/:cohortId", { userDoc: primaryTpo, params: { cohortId: "cohort-1" } });

      expect(cohortService.getCohortForCollege).toHaveBeenCalledWith("cohort-1", "college-A");
      expect(res.json).toHaveBeenCalledWith(sampleCohortSummary);
    });

    it("404s for a nonexistent cohort", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.getCohortForCollege.mockResolvedValueOnce(null);

      const res = await runRoute("get", "/cohorts/:cohortId", { userDoc: primaryTpo, params: { cohortId: "cohort-1" } });

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("404s identically for a cohort belonging to another institution (same shape as nonexistent)", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.getCohortForCollege.mockResolvedValueOnce(null); // service returns null for both cases

      const res = await runRoute("get", "/cohorts/:cohortId", { userDoc: primaryTpo, params: { cohortId: "college-b-cohort" } });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Cohort not found." });
    });

    it("400s for a malformed cohort id", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.getCohortForCollege.mockResolvedValueOnce({ invalidId: true });

      const res = await runRoute("get", "/cohorts/:cohortId", { userDoc: primaryTpo, params: { cohortId: "not-an-id" } });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("PATCH /cohorts/:cohortId", () => {
    it("updates and returns the cohort", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.updateCohort.mockResolvedValueOnce({ ...sampleCohortSummary, name: "Updated" });

      const res = await runRoute("patch", "/cohorts/:cohortId", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: { name: "Updated" },
      });

      expect(cohortService.updateCohort).toHaveBeenCalledWith("cohort-1", "college-A", { name: "Updated" });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated" }));
    });

    it("a secondary TPO can update a cohort (no primary-only gate)", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.updateCohort.mockResolvedValueOnce(sampleCohortSummary);

      const res = await runRoute("patch", "/cohorts/:cohortId", {
        userDoc: secondaryTpo, params: { cohortId: "cohort-1" }, body: { name: "Updated" },
      });

      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it("404s for a cohort not found in this institution", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.updateCohort.mockResolvedValueOnce(null);

      const res = await runRoute("patch", "/cohorts/:cohortId", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: { name: "Updated" },
      });

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("400s for a malformed cohort id", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.updateCohort.mockResolvedValueOnce({ invalidId: true });

      const res = await runRoute("patch", "/cohorts/:cohortId", {
        userDoc: primaryTpo, params: { cohortId: "not-an-id" }, body: { name: "Updated" },
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("maps a service-layer validation error to 400", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      const err = Object.assign(new Error("bad"), { name: "ValidationError" });
      cohortService.updateCohort.mockRejectedValueOnce(err);

      const res = await runRoute("patch", "/cohorts/:cohortId", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: { graduatingYear: "not-a-year" },
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("POST /cohorts/:cohortId/archive", () => {
    it("archives and returns the cohort with alreadyArchived: false on the first call", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.archiveCohort.mockResolvedValueOnce({
        cohort: { ...sampleCohortSummary, status: "archived" },
        alreadyArchived: false,
      });

      const res = await runRoute("post", "/cohorts/:cohortId/archive", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: {},
      });

      expect(cohortService.archiveCohort).toHaveBeenCalledWith("cohort-1", "college-A", primaryTpo._id);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "archived", alreadyArchived: false }));
    });

    it("a repeat archive call is idempotent: 200 with alreadyArchived: true, not an error", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.archiveCohort.mockResolvedValueOnce({
        cohort: { ...sampleCohortSummary, status: "archived" },
        alreadyArchived: true,
      });

      const res = await runRoute("post", "/cohorts/:cohortId/archive", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: {},
      });

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.status).not.toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alreadyArchived: true }));
    });

    it("a secondary TPO can archive a cohort (no primary-only gate)", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.archiveCohort.mockResolvedValueOnce({ cohort: sampleCohortSummary, alreadyArchived: false });

      const res = await runRoute("post", "/cohorts/:cohortId/archive", {
        userDoc: secondaryTpo, params: { cohortId: "cohort-1" }, body: {},
      });

      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it("404s for a cohort not found in this institution", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.archiveCohort.mockResolvedValueOnce(null);

      const res = await runRoute("post", "/cohorts/:cohortId/archive", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" }, body: {},
      });

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("400s for a malformed cohort id", async () => {
      resolveTpoTeamContext.mockResolvedValueOnce(nonAdminContext(college));
      cohortService.archiveCohort.mockResolvedValueOnce({ invalidId: true });

      const res = await runRoute("post", "/cohorts/:cohortId/archive", {
        userDoc: primaryTpo, params: { cohortId: "not-an-id" }, body: {},
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("authorization matrix", () => {
    it("an unverified TPO is blocked before institution resolution even runs", async () => {
      const unverifiedTpo = {
        role: "tpo", _id: { toString: () => "u1" },
        tpoProfile: { collegeDomain: "a.edu", verified: false },
      };

      const res = await runRoute("get", "/cohorts", { userDoc: unverifiedTpo, query: {} });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(resolveTpoTeamContext).not.toHaveBeenCalled();
      expect(cohortService.listCohorts).not.toHaveBeenCalled();
    });

    it("a non-TPO student is blocked", async () => {
      const student = { role: "student", _id: { toString: () => "s1" } };

      const res = await runRoute("get", "/cohorts", { userDoc: student, query: {} });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(cohortService.listCohorts).not.toHaveBeenCalled();
    });

    it("no DELETE route exists for /cohorts/:cohortId", () => {
      const layer = tpoRouter.stack.find(
        (l) => l.route && l.route.path === "/cohorts/:cohortId" && l.route.methods.delete
      );
      expect(layer).toBeUndefined();
    });
  });
});
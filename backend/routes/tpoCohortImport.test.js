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
vi.mock("../services/cohortImportService.js", () => ({
  importCohortRoster: vi.fn(),
  IMPORT_MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024,
  IMPORT_MAX_ROWS: 10000,
}));
// multer itself needs a real HTTP request stream to parse multipart data
// (busboy under the hood) — this codebase deliberately doesn't use
// supertest for full HTTP-layer route tests (see routes/compiler.test.js),
// so multer is mocked here as a pass-through: `.single()`'s middleware
// just calls its callback with whatever this test set up. Multer's own
// file-type/size rejection behavior is covered directly, without this
// mock, in middleware/csvUpload.test.js (csvFileFilter) and
// services/cohortImportService.test.js (IMPORT_MAX_FILE_SIZE_BYTES /
// detectDisallowedBinarySignature). What this file tests is the route's
// own glue: given req.file (or its absence, or a multer-reported error),
// does it call the service correctly and map results to the right HTTP
// response.
let singleMiddlewareImpl = (req, res, cb) => cb();
vi.mock("multer", () => {
  class MulterError extends Error {
    constructor(code, field) {
      super(code);
      this.name = "MulterError";
      this.code = code;
      this.field = field;
    }
  }
  const multerFn = vi.fn(() => ({
    single: vi.fn(() => (req, res, cb) => singleMiddlewareImpl(req, res, cb)),
  }));
  multerFn.memoryStorage = vi.fn(() => ({}));
  multerFn.MulterError = MulterError;
  return { default: multerFn };
});

import multer from "multer";
import { resolveTpoTeamContext } from "../services/tpoTeamService.js";
import * as cohortImportService from "../services/cohortImportService.js";
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

function fakeFile(overrides = {}) {
  return { originalname: "roster.csv", buffer: Buffer.from("email\na@b.com\n"), ...overrides };
}

const sampleImportResult = {
  importBatchId: "batch-1",
  summary: { totalRows: 1, processed: 1, active: 1, invited: 0, alreadyMember: 0, duplicates: 0, errors: 0 },
  rows: [{ row: 2, email: "a@b.com", status: "active" }],
};

describe("POST /cohorts/:cohortId/import (TPO-2 Step 6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleMiddlewareImpl = (req, res, cb) => cb();
    resolveTpoTeamContext.mockResolvedValue(nonAdminContext(college));
  });

  it("imports a CSV and returns the service result", async () => {
    cohortImportService.importCohortRoster.mockResolvedValueOnce(sampleImportResult);

    const res = await runRoute("post", "/cohorts/:cohortId/import", {
      userDoc: primaryTpo, params: { cohortId: "cohort-1" }, file: fakeFile(),
    });

    expect(cohortImportService.importCohortRoster).toHaveBeenCalledWith(
      "cohort-1", "college-A", primaryTpo._id, fakeFile().buffer
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(sampleImportResult);
  });

  it("never accepts a client-supplied collegeId — only the resolved institution is forwarded", async () => {
    cohortImportService.importCohortRoster.mockResolvedValueOnce(sampleImportResult);

    await runRoute("post", "/cohorts/:cohortId/import", {
      userDoc: primaryTpo, params: { cohortId: "cohort-1" }, file: fakeFile(),
      body: { collegeId: "college-B" },
    });

    expect(cohortImportService.importCohortRoster).toHaveBeenCalledWith(
      "cohort-1", "college-A", primaryTpo._id, expect.any(Buffer)
    );
  });

  it("a secondary TPO can import a roster (no primary-only gate)", async () => {
    cohortImportService.importCohortRoster.mockResolvedValueOnce(sampleImportResult);

    const res = await runRoute("post", "/cohorts/:cohortId/import", {
      userDoc: secondaryTpo, params: { cohortId: "cohort-1" }, file: fakeFile(),
    });

    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("400s when no file is present", async () => {
    const res = await runRoute("post", "/cohorts/:cohortId/import", {
      userDoc: primaryTpo, params: { cohortId: "cohort-1" }, file: undefined,
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(cohortImportService.importCohortRoster).not.toHaveBeenCalled();
  });

  it("400s for an invalid cohort id", async () => {
    cohortImportService.importCohortRoster.mockResolvedValueOnce({ invalidId: true });

    const res = await runRoute("post", "/cohorts/:cohortId/import", {
      userDoc: primaryTpo, params: { cohortId: "not-an-id" }, file: fakeFile(),
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404s for a cohort not found in this institution", async () => {
    cohortImportService.importCohortRoster.mockResolvedValueOnce(null);

    const res = await runRoute("post", "/cohorts/:cohortId/import", {
      userDoc: primaryTpo, params: { cohortId: "cohort-1" }, file: fakeFile(),
    });

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("409s for an archived cohort — a frozen roster cannot be imported into (TPO-2 closure audit)", async () => {
    cohortImportService.importCohortRoster.mockResolvedValueOnce({ archived: true });

    const res = await runRoute("post", "/cohorts/:cohortId/import", {
      userDoc: primaryTpo, params: { cohortId: "cohort-1" }, file: fakeFile(),
    });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(cohortImportService.importCohortRoster).toHaveBeenCalled(); // rejected inside the service, not by the route itself
  });

  it("400s with the reasonCode when the file itself is rejected (e.g. missing email column)", async () => {
    cohortImportService.importCohortRoster.mockResolvedValueOnce({
      fileError: "The CSV must include an 'email' column.", reasonCode: "missing_email_column",
    });

    const res = await runRoute("post", "/cohorts/:cohortId/import", {
      userDoc: primaryTpo, params: { cohortId: "cohort-1" }, file: fakeFile(),
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "The CSV must include an 'email' column.", reasonCode: "missing_email_column",
    });
  });

  it("never exposes a stack trace or raw DB error if the service throws unexpectedly", async () => {
    cohortImportService.importCohortRoster.mockRejectedValueOnce(new Error("ECONNRESET at some/internal/path.js:42"));

    const res = await runRoute("post", "/cohorts/:cohortId/import", {
      userDoc: primaryTpo, params: { cohortId: "cohort-1" }, file: fakeFile(),
    });

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toMatch(/ECONNRESET|internal\/path\.js/);
  });

  describe("multer-level rejections (handleCsvUpload)", () => {
    it("maps a LIMIT_FILE_SIZE multer error to 400 with a size-limit message", async () => {
      singleMiddlewareImpl = (req, res, cb) => cb(new multer.MulterError("LIMIT_FILE_SIZE"));

      const res = await runRoute("post", "/cohorts/:cohortId/import", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.stringMatching(/MB size limit/) });
      expect(cohortImportService.importCohortRoster).not.toHaveBeenCalled();
    });

    it("maps a LIMIT_UNEXPECTED_FILE multer error (wrong file type) to 400", async () => {
      const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file");
      err.message = "Only .csv files are accepted.";
      singleMiddlewareImpl = (req, res, cb) => cb(err);

      const res = await runRoute("post", "/cohorts/:cohortId/import", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Only .csv files are accepted." });
      expect(cohortImportService.importCohortRoster).not.toHaveBeenCalled();
    });

    it("maps a non-multer upload error to 500, never a raw stack trace", async () => {
      singleMiddlewareImpl = (req, res, cb) => cb(new Error("unexpected stream failure"));

      const res = await runRoute("post", "/cohorts/:cohortId/import", {
        userDoc: primaryTpo, params: { cohortId: "cohort-1" },
      });

      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(JSON.stringify(body)).not.toMatch(/unexpected stream failure/);
    });
  });

  describe("authorization matrix", () => {
    it("an unverified TPO is blocked", async () => {
      const res = await runRoute("post", "/cohorts/:cohortId/import", {
        userDoc: unverifiedTpo, params: { cohortId: "cohort-1" }, file: fakeFile(),
      });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(cohortImportService.importCohortRoster).not.toHaveBeenCalled();
    });

    it("a non-TPO student is blocked", async () => {
      const res = await runRoute("post", "/cohorts/:cohortId/import", {
        userDoc: student, params: { cohortId: "cohort-1" }, file: fakeFile(),
      });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(cohortImportService.importCohortRoster).not.toHaveBeenCalled();
    });

    it("a TPO from another institution can't reach a cohort outside it (institution resolved server-side, not from the client)", async () => {
      // resolveTpoTeamContext always resolves the CALLER's own institution
      // server-side — there is no client-suppliable collegeId in this
      // route at all, so cross-college access is structurally blocked,
      // not just policy-blocked. This asserts the only collegeId ever
      // forwarded to the service is the one resolveTpoTeamContext
      // returned for this caller.
      cohortImportService.importCohortRoster.mockResolvedValueOnce(sampleImportResult);

      await runRoute("post", "/cohorts/:cohortId/import", {
        userDoc: primaryTpo, params: { cohortId: "some-other-colleges-cohort" }, file: fakeFile(),
      });

      expect(cohortImportService.importCohortRoster).toHaveBeenCalledWith(
        "some-other-colleges-cohort", "college-A", primaryTpo._id, expect.any(Buffer)
      );
    });
  });
});

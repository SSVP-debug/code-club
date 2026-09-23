import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../config/featureFlags.js", () => ({
  B2B_ENABLED: true,
}));
vi.mock("../models/User.js", () => ({
  default: { find: vi.fn(), aggregate: vi.fn() },
}));
vi.mock("../models/College.js", () => ({
  default: { find: vi.fn(), findById: vi.fn(), findOne: vi.fn() },
}));
vi.mock("../utils/cache.js", () => ({
  // Bypass real caching — treat every call as a cache MISS, so each test's
  // aggregate call is actually exercised instead of hitting a previous
  // test's cached result. Same convention as routes/leaderboard.test.js.
  getOrSetCache: vi.fn(async (key, ttl, fetchFn) => ({ value: await fetchFn(), cacheStatus: "MISS" })),
  invalidateCachePrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../models/Assignment.js", () => ({
  default: { findOne: vi.fn(), create: vi.fn(), find: vi.fn() },
}));
vi.mock("../services/notificationService.js", () => ({
  createNotificationBulk: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/settingsService.js", () => ({
  getSettings: vi.fn(),
}));
vi.mock("../services/tpoTeamService.js", () => ({
  getCollegeForTpo: vi.fn(),
  isPrimaryTpo: vi.fn(),
  listTeam: vi.fn(),
  claimPrimaryIfNone: vi.fn(),
  transferPrimary: vi.fn(),
  resolveTpoTeamContext: vi.fn(),
  // Default mirrors pre-fix single-domain behavior (just the caller's own
  // literal collegeDomain) so every existing single-college assertion in
  // this file keeps working unchanged; the multi-domain case itself is
  // covered by tpoTeamService.test.js's own resolveCollegeDomains tests
  // and by the dedicated multi-domain test below.
  resolveCollegeDomains: vi.fn(async (userDoc) => {
    const domain = userDoc?.tpoProfile?.collegeDomain;
    return domain ? [domain.toLowerCase()] : [];
  }),
}));

import User from "../models/User.js";
import College from "../models/College.js";
import Assignment from "../models/Assignment.js";
import { createNotificationBulk } from "../services/notificationService.js";
import { getSettings } from "../services/settingsService.js";
import { resolveCollegeDomains } from "../services/tpoTeamService.js";
import tpoRouter, { handleRemindAssignment, tpoRegistrationGate } from "./tpo.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  return res;
}

const tpoUserDoc = { tpoProfile: { collegeDomain: "example.edu" } };

const assignmentDoc = {
  _id: "assignment1",
  title: "Week 3 — Arrays",
  dueDate: "2026-08-01",
  problemSlugs: ["two-sum", "valid-parentheses"],
};

// ── Shared route-dispatch test harness ──────────────────────────────────────
// Walks the REAL exported router's route-layer stack for `method`+`path` and
// invokes each handler in order exactly as Express does: if a handler
// doesn't call next(), it was terminal (it already sent a response), so we
// stop — mirroring real dispatch rather than re-implementing it. This tests
// actual route wiring (role check → verified check → handler), not just
// whatever an individual middleware does in isolation — see the
// "assignment routes — requireVerified wiring" describe block below for why
// that distinction is exactly what let the original P0 bug ship.
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
    if (!calledNext) break; // terminal: this layer already sent the response
  }
  return res;
}

const pendingTpo = { role: "tpo", tpoProfile: { collegeDomain: "example.edu", verified: false } };
const verifiedTpo = { role: "tpo", tpoProfile: { collegeDomain: "example.edu", verified: true } };
const admin = { role: "admin" };

describe("handleRemindAssignment", () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
    Assignment.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(assignmentDoc) });
  });

  it("returns 400 when the TPO account has no college domain set", async () => {
    const req = { params: { id: "assignment1" }, userDoc: { tpoProfile: {} } };
    await handleRemindAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createNotificationBulk).not.toHaveBeenCalled();
  });

  it("returns 404 when the assignment doesn't exist for this college", async () => {
    Assignment.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    const req = { params: { id: "ghost" }, userDoc: tpoUserDoc };
    await handleRemindAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("only notifies students who haven't completed every problem in the assignment", async () => {
    User.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: "student-done", solvedSlugs: ["two-sum", "valid-parentheses"] },
          { _id: "student-partial", solvedSlugs: ["two-sum"] },
          { _id: "student-none", solvedSlugs: [] },
        ]),
      }),
    });
    const req = { params: { id: "assignment1" }, userDoc: tpoUserDoc };

    await handleRemindAssignment(req, res);

    expect(createNotificationBulk).toHaveBeenCalledWith(
      ["student-partial", "student-none"],
      expect.objectContaining({ type: "assignment_reminder" })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ remindedCount: 2 })
    );
  });

  it("short-circuits with remindedCount: 0 and does not call createNotificationBulk when everyone is done", async () => {
    User.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: "student-done", solvedSlugs: ["two-sum", "valid-parentheses"] },
        ]),
      }),
    });
    const req = { params: { id: "assignment1" }, userDoc: tpoUserDoc };

    await handleRemindAssignment(req, res);

    expect(createNotificationBulk).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ remindedCount: 0 })
    );
  });

  it("returns 500 if an unexpected error is thrown", async () => {
    User.find.mockImplementation(() => {
      throw new Error("Mongo down");
    });
    const req = { params: { id: "assignment1" }, userDoc: tpoUserDoc };

    await handleRemindAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// Plan 009: registration-toggle enforcement (test plan's explicit
// requirement — "disabling tpoRegistrationEnabled rejects new TPO signups
// but does not affect an existing TPO's ability to log in/use the app").
describe("tpoRegistrationGate", () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("blocks a new registration with 403 when tpoRegistrationEnabled is false", async () => {
    getSettings.mockResolvedValueOnce({ tpoRegistrationEnabled: false });

    const blocked = await tpoRegistrationGate({}, res);

    expect(blocked).toBe(true);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows registration through when tpoRegistrationEnabled is true (the default)", async () => {
    getSettings.mockResolvedValueOnce({ tpoRegistrationEnabled: true });

    const blocked = await tpoRegistrationGate({}, res);

    expect(blocked).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("takes no dependency on req.userDoc — an existing TPO's other routes never call this gate", async () => {
    getSettings.mockResolvedValueOnce({ tpoRegistrationEnabled: false });
    await expect(tpoRegistrationGate({}, res)).resolves.toBe(true);
  });
});

// ── Route-level authorization wiring: /assignments, /assignments (GET), ────
// /assignments/:id/remind ────────────────────────────────────────────────
//
// Security audit finding (2026-09): these three routes had `requireRole`
// but were missing `requireVerified`, unlike every other TPO route. A
// unit test calling `requireVerified` directly (see
// tpoFlow.integration.test.js) already proved the middleware itself works
// — that's exactly why it didn't catch this bug: nothing asserted that
// the *route* actually applies it. These tests exercise the real
// `tpoRouter`'s middleware chain for these three routes specifically, the
// same way Express would dispatch a live request, so a future regression
// in route wiring (not middleware logic) would be caught here.
describe("assignment routes — requireVerified wiring (regression for the pending-TPO bypass)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scenario 1-3 — pending/unverified TPO MUST be rejected", () => {
    it("POST /assignments — 403, and the assignment is never created", async () => {
      const req = { userDoc: pendingTpo, body: { title: "t", problemSlugs: ["two-sum"], dueDate: "2026-12-01" } };
      const res = await runRoute("post", "/assignments", req);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(Assignment.create).not.toHaveBeenCalled();
      expect(createNotificationBulk).not.toHaveBeenCalled();
    });

    it("GET /assignments — 403", async () => {
      const req = { userDoc: pendingTpo };
      const res = await runRoute("get", "/assignments", req);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(Assignment.find).not.toHaveBeenCalled();
    });

    it("POST /assignments/:id/remind — 403, and no reminder notification is sent", async () => {
      const req = { userDoc: pendingTpo, params: { id: "assignment1" } };
      const res = await runRoute("post", "/assignments/:id/remind", req);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(Assignment.findOne).not.toHaveBeenCalled();
      expect(createNotificationBulk).not.toHaveBeenCalled();
    });
  });

  describe("Scenario 4-6 — verified TPO MUST continue to work exactly as before", () => {
    it("POST /assignments — reaches the handler and creates the assignment (201)", async () => {
      Assignment.create.mockResolvedValue({ _id: "new-assignment", title: "t" });
      User.find.mockReturnValue({
        select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "s1" }]) }),
      });
      const req = { userDoc: verifiedTpo, body: { title: "t", problemSlugs: ["two-sum"], dueDate: "2026-12-01" } };

      const res = await runRoute("post", "/assignments", req);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(Assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({ collegeDomain: "example.edu", title: "t" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("GET /assignments — reaches the handler and returns the list (200)", async () => {
      Assignment.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      });
      User.find.mockReturnValue({
        select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      });
      const req = { userDoc: verifiedTpo };

      const res = await runRoute("get", "/assignments", req);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ assignments: [] }));
    });

    it("POST /assignments/:id/remind — reaches the handler exactly as the existing handleRemindAssignment tests already prove", async () => {
      Assignment.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(assignmentDoc) });
      User.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([{ _id: "student-none", solvedSlugs: [] }]),
        }),
      });
      const req = { userDoc: verifiedTpo, params: { id: "assignment1" } };

      const res = await runRoute("post", "/assignments/:id/remind", req);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(createNotificationBulk).toHaveBeenCalledWith(
        ["student-none"],
        expect.objectContaining({ type: "assignment_reminder" })
      );
    });
  });

  describe("Admin — requireVerified's existing admin bypass must be preserved", () => {
    it("POST /assignments — an admin (no tpoProfile at all) is not blocked by the new verified check", async () => {
      Assignment.create.mockResolvedValue({ _id: "new-assignment", title: "t" });
      User.find.mockReturnValue({
        select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      });
      const req = { userDoc: admin, body: { title: "t", problemSlugs: ["two-sum"], dueDate: "2026-12-01" } };

      const res = await runRoute("post", "/assignments", req);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(Assignment.create).toHaveBeenCalled();
    });
  });

  describe("Scenario 7 — cross-college isolation is unaffected by this change", () => {
    it("POST /assignments/:id/remind — a verified TPO cannot reach an assignment belonging to a different college", async () => {
      // Assignment.findOne is always queried with { _id, collegeDomain },
      // so an assignment from another college simply isn't found —
      // unrelated to (and unweakened by) the requireVerified fix.
      Assignment.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
      const req = { userDoc: verifiedTpo, params: { id: "other-colleges-assignment" } };

      const res = await runRoute("post", "/assignments/:id/remind", req);

      expect(res.status).not.toHaveBeenCalledWith(403); // not blocked by verification...
      expect(res.status).toHaveBeenCalledWith(404); // ...but still blocked by college scoping
    });
  });
});

// ── GET /api/tpo/students — server-side pagination/search/sort ─────────────
//
// Scalability fix (2026-09): this endpoint used to load the entire college
// roster and let TpoDashboardPage.jsx filter/sort in the browser. Rewritten
// to a single Mongo aggregation with $facet, mirroring the pattern
// recruiter.js's /candidates endpoint already established for the same
// "search+sort+paginate a User collection" shape.
describe("GET /students — pagination, search, sort, and authorization", () => {
  function mockAggregateResult(data, totalCount) {
    User.aggregate.mockResolvedValue([{ data, totalCount: [{ count: totalCount }] }]);
  }

  function lastPipeline() {
    return User.aggregate.mock.calls.at(-1)[0];
  }

  function matchStage(pipeline) {
    return pipeline.find((stage) => stage.$match)?.$match;
  }

  function sortStage(pipeline) {
    return pipeline.find((stage) => stage.$sort)?.$sort;
  }

  function facetDataStage(pipeline) {
    const facet = pipeline.find((stage) => stage.$facet)?.$facet;
    return facet?.data ?? [];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAggregateResult([], 0);
  });

  describe("authentication / role / verification", () => {
    it("a pending TPO gets 403 and the database is never queried", async () => {
      const req = { userDoc: pendingTpo, query: {} };
      const res = await runRoute("get", "/students", req);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(User.aggregate).not.toHaveBeenCalled();
    });

    it("a student account gets 403 at the role check, before verification is even considered", async () => {
      const req = { userDoc: { role: "student" }, query: {} };
      const res = await runRoute("get", "/students", req);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(User.aggregate).not.toHaveBeenCalled();
    });

    it("a recruiter account gets 403 at the role check", async () => {
      const req = { userDoc: { role: "recruiter", recruiterProfile: { verified: true } }, query: {} };
      const res = await runRoute("get", "/students", req);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("a verified TPO is allowed through to the handler", async () => {
      const req = { userDoc: verifiedTpo, query: {} };
      const res = await runRoute("get", "/students", req);

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(User.aggregate).toHaveBeenCalled();
    });

    it("an admin is allowed through regardless of tpoProfile", async () => {
      // Admins hit /tpo/students too (requireRole allows "tpo" or "admin"),
      // but the route still needs *some* collegeDomain to scope the query —
      // this exercises the admin-bypasses-verification path specifically,
      // not the (separate, pre-existing) "admin with no domain set" 400 case.
      const req = { userDoc: { role: "admin", tpoProfile: { collegeDomain: "example.edu" } }, query: {} };
      const res = await runRoute("get", "/students", req);

      expect(res.status).not.toHaveBeenCalledWith(403);
    });
  });

  describe("college isolation — must always come from the server-known TPO profile", () => {
    it("scopes the query to the TPO's own collegeDomain", async () => {
      const req = { userDoc: verifiedTpo, query: {} };
      await runRoute("get", "/students", req);

      expect(matchStage(lastPipeline())).toEqual(
        expect.objectContaining({ emailDomain: { $in: ["example.edu"] }, role: "student" })
      );
    });

    it("ignores a client-supplied collegeDomain/domain/collegeId query param entirely", async () => {
      const req = {
        userDoc: verifiedTpo,
        query: { collegeDomain: "rival-college.edu", domain: "rival-college.edu", collegeId: "someone-elses-id" },
      };
      await runRoute("get", "/students", req);

      const match = matchStage(lastPipeline());
      expect(match.emailDomain).toEqual({ $in: ["example.edu"] }); // still the TPO's own domain
      expect(JSON.stringify(match)).not.toContain("rival-college.edu");
    });

    it("two different TPOs' requests each scope to their own domain, never each other's", async () => {
      const tpoA = { role: "tpo", tpoProfile: { collegeDomain: "college-a.edu", verified: true } };
      const tpoB = { role: "tpo", tpoProfile: { collegeDomain: "college-b.edu", verified: true } };

      await runRoute("get", "/students", { userDoc: tpoA, query: {} });
      expect(matchStage(lastPipeline()).emailDomain).toEqual({ $in: ["college-a.edu"] });

      await runRoute("get", "/students", { userDoc: tpoB, query: {} });
      expect(matchStage(lastPipeline()).emailDomain).toEqual({ $in: ["college-b.edu"] });
    });
  });

  describe("pagination", () => {
    it("defaults to page 1 with the default page size when no query params are given", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: {} });

      const data = facetDataStage(lastPipeline());
      expect(data).toContainEqual({ $skip: 0 });
      expect(data).toContainEqual({ $limit: 25 });
    });

    it("page 2 skips exactly one page's worth of records", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { page: "2", limit: "10" } });

      const data = facetDataStage(lastPipeline());
      expect(data).toContainEqual({ $skip: 10 });
      expect(data).toContainEqual({ $limit: 10 });
    });

    it("a page far beyond the total simply returns an empty page, not an error", async () => {
      mockAggregateResult([], 3); // 3 total students, but...
      const res = await runRoute("get", "/students", { userDoc: verifiedTpo, query: { page: "999" } });

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ students: [], total: 3, page: 999 }));
    });

    it("response includes page/limit/total so the frontend can compute total pages", async () => {
      mockAggregateResult([{ name: "Alice" }], 47);
      const res = await runRoute("get", "/students", { userDoc: verifiedTpo, query: { page: "2", limit: "10" } });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ students: [{ name: "Alice" }], total: 47, page: 2, limit: 10 })
      );
    });
  });

  describe("page size normalization", () => {
    it("uses the default (25) when no limit is given", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: {} });
      expect(facetDataStage(lastPipeline())).toContainEqual({ $limit: 25 });
    });

    it("respects a valid custom limit", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { limit: "5" } });
      expect(facetDataStage(lastPipeline())).toContainEqual({ $limit: 5 });
    });

    it("caps an excessively large limit at the maximum (50)", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { limit: "999999" } });
      expect(facetDataStage(lastPipeline())).toContainEqual({ $limit: 50 });
    });

    it("falls back to the default for a non-numeric limit", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { limit: "abc" } });
      expect(facetDataStage(lastPipeline())).toContainEqual({ $limit: 25 });
    });

    it("falls back to the default for a zero or negative limit", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { limit: "0" } });
      expect(facetDataStage(lastPipeline())).toContainEqual({ $limit: 25 });

      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { limit: "-5" } });
      expect(facetDataStage(lastPipeline())).toContainEqual({ $limit: 25 });
    });

    it("falls back to page 1 for an invalid page number", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { page: "not-a-number" } });
      expect(facetDataStage(lastPipeline())).toContainEqual({ $skip: 0 });

      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { page: "-3" } });
      expect(facetDataStage(lastPipeline())).toContainEqual({ $skip: 0 });
    });
  });

  describe("search", () => {
    it("with no search term, applies no $or filter", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: {} });
      expect(matchStage(lastPipeline()).$or).toBeUndefined();
    });

    it("searches by name/email via a case-insensitive $or", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { q: "krishna" } });

      const match = matchStage(lastPipeline());
      expect(match.$or).toEqual([
        { displayName: { $regex: "krishna", $options: "i" } },
        { email: { $regex: "krishna", $options: "i" } },
      ]);
    });

    it("escapes regex metacharacters in the search term instead of treating them as a pattern", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { q: "a.b(c)" } });

      const match = matchStage(lastPipeline());
      expect(match.$or[0].displayName.$regex).toBe("a\\.b\\(c\\)");
    });

    it("trims whitespace-only search to an empty (no-op) search", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { q: "   " } });
      expect(matchStage(lastPipeline()).$or).toBeUndefined();
    });

    it("still scopes to the TPO's own college even while searching", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { q: "krishna" } });
      expect(matchStage(lastPipeline()).emailDomain).toEqual({ $in: ["example.edu"] });
    });

    it("combines with pagination correctly", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { q: "krishna", page: "2", limit: "5" } });

      expect(matchStage(lastPipeline()).$or).toBeDefined();
      expect(facetDataStage(lastPipeline())).toContainEqual({ $skip: 5 });
    });
  });

  describe("sorting", () => {
    it.each([
      ["xp", { totalXP: -1, _id: 1 }],
      ["solved", { solvedCount: -1, _id: 1 }],
      ["streak", { currentStreak: -1, _id: 1 }],
      ["name", { displayName: 1, _id: 1 }],
    ])("sort=%s maps to the correct, allowlisted Mongo sort spec", async (sortKey, expectedSort) => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: { sort: sortKey } });
      expect(sortStage(lastPipeline())).toEqual(expectedSort);
    });

    it("defaults to xp when no sort is given", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: {} });
      expect(sortStage(lastPipeline())).toEqual({ totalXP: -1, _id: 1 });
    });

    it("falls back to xp for an unrecognized/malicious sort value instead of passing it through to Mongo", async () => {
      await runRoute("get", "/students", {
        userDoc: verifiedTpo,
        query: { sort: "__proto__.polluted" },
      });
      expect(sortStage(lastPipeline())).toEqual({ totalXP: -1, _id: 1 });
    });
  });

  describe("combined search + sort + pagination", () => {
    it("produces a single deterministic pipeline reflecting all three", async () => {
      await runRoute("get", "/students", {
        userDoc: verifiedTpo,
        query: { q: "krishna", sort: "name", page: "3", limit: "10" },
      });

      const pipeline = lastPipeline();
      expect(matchStage(pipeline)).toEqual(
        expect.objectContaining({
          emailDomain: { $in: ["example.edu"] },
          role: "student",
          $or: expect.any(Array),
        })
      );
      expect(sortStage(pipeline)).toEqual({ displayName: 1, _id: 1 });
      expect(facetDataStage(pipeline)).toContainEqual({ $skip: 20 });
      expect(facetDataStage(pipeline)).toContainEqual({ $limit: 10 });
    });
  });

  describe("data exposure", () => {
    it("the $project stage only exposes the intended fields — no solvedSlugs, no password/internal fields", async () => {
      await runRoute("get", "/students", { userDoc: verifiedTpo, query: {} });

      const project = facetDataStage(lastPipeline()).find((s) => s.$project)?.$project;
      expect(Object.keys(project).sort()).toEqual(
        ["_id", "currentStreak", "easy", "email", "hard", "joinedDate", "medium", "name", "solvedCount", "totalXP"].sort()
      );
      expect(project).not.toHaveProperty("solvedSlugs");
      expect(project).not.toHaveProperty("password");
      expect(project).not.toHaveProperty("topicStats");
    });
  });
});

// ── TPO-1 closure: multi-domain college scoping ───────────────────────────
// Bug found in the closure audit: /students and /dashboard matched
// students by the TPO's own single literal collegeDomain instead of every
// domain the TPO's college owns, so a TPO on a multi-domain college
// couldn't see students who joined via a sibling domain of the SAME
// institution. Fixed via resolveCollegeDomains (services/tpoTeamService.js);
// these tests pin that both routes actually consult it and use its result
// as an $in match, rather than falling back to the single-domain shape.
describe("multi-domain college scoping (GET /students, GET /dashboard)", () => {
  const multiDomainTpo = { role: "tpo", tpoProfile: { collegeDomain: "mit.edu", verified: true } };

  beforeEach(() => {
    vi.clearAllMocks();
    User.aggregate.mockResolvedValue([{ data: [], totalCount: [{ count: 0 }] }]);
  });

  it("GET /students matches every domain resolveCollegeDomains returns, not just the TPO's own literal domain", async () => {
    resolveCollegeDomains.mockResolvedValueOnce(["mit.edu", "old-mit.edu"]);

    await runRoute("get", "/students", { userDoc: multiDomainTpo, query: {} });

    const pipeline = User.aggregate.mock.calls.at(-1)[0];
    const match = pipeline.find((s) => s.$match)?.$match;
    expect(resolveCollegeDomains).toHaveBeenCalledWith(multiDomainTpo);
    expect(match.emailDomain).toEqual({ $in: ["mit.edu", "old-mit.edu"] });
  });

  it("GET /dashboard matches every domain resolveCollegeDomains returns", async () => {
    await runRoute("get", "/dashboard", { userDoc: multiDomainTpo, query: {} });

    const pipeline = User.aggregate.mock.calls.at(-1)[0];
    const match = pipeline.find((s) => s.$match)?.$match;
    expect(resolveCollegeDomains).toHaveBeenCalledWith(multiDomainTpo);
    expect(match.emailDomain).toEqual({ $in: ["mit.edu"] }); // default mock: just the TPO's own domain
  });
});

describe("GET /college-directory", () => {
  const verifiedStudent = {
    role: "student",
    emailDomain: "report.edu",
    education: { emailVerified: true, collegeId: "college-1" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    College.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "college-1",
        name: "Report University",
        status: "verified",
        domains: ["report.edu", "legacy.report.edu"],
        primaryTpo: "tpo-1",
      }),
    });
    User.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            {
              _id: "tpo-1",
              displayName: "Primary Officer",
              email: "primary@report.edu",
              tpoProfile: { collegeName: "Report University" },
            },
            {
              _id: "tpo-2",
              displayName: "Secondary Officer",
              email: "secondary@report.edu",
              tpoProfile: { collegeName: "Report University" },
            },
          ]),
        }),
      }),
    });
  });

  it("returns only verified active TPOs from the student's own institution", async () => {
    const res = await runRoute("get", "/college-directory", { userDoc: verifiedStudent });

    expect(res.json).toHaveBeenCalledWith({
      college: { id: "college-1", name: "Report University" },
      tpos: [
        expect.objectContaining({ id: "tpo-1", isPrimary: true }),
        expect.objectContaining({ id: "tpo-2", isPrimary: false }),
      ],
    });
    expect(User.find).toHaveBeenCalledWith({
      role: "tpo",
      status: "active",
      "tpoProfile.collegeDomain": { $in: ["report.edu", "legacy.report.edu"] },
      "tpoProfile.verified": true,
    });
  });

  it("blocks students who have not verified their college email", async () => {
    const res = await runRoute("get", "/college-directory", {
      userDoc: { role: "student", education: { emailVerified: false } },
    });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(User.find).not.toHaveBeenCalled();
  });
});

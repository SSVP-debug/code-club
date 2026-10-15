import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/Problem.js", () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));
vi.mock("./billing.js", () => ({
  isUserPremium: vi.fn(),
}));
vi.mock("../services/contestProblemAccess.js", () => ({
  canAccessContestProblem: vi.fn(),
}));
vi.mock("../services/problemProgressService.js", () => ({
  getSolvedSlugs: vi.fn(),
}));

import Problem from "../models/Problem.js";
import { isUserPremium } from "./billing.js";
import { canAccessContestProblem } from "../services/contestProblemAccess.js";
import { getSolvedSlugs } from "../services/problemProgressService.js";
import editorialRouter from "./editorial.js";

// editorial.js doesn't export its handlers individually — pull them off the
// real router's stack, same convention as routes/contests.test.js. This
// exercises the actual handler code and deliberately skips over any
// auth/role middleware registered where this router is mounted (that layer
// has its own dedicated tests — middleware/auth.test.js,
// middleware/roleGuard.test.js).
function getHandler(method, path) {
  const layer = editorialRouter.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`No ${method.toUpperCase()} route registered for path ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return {
    params: { slug: "two-sum" },
    body: {},
    userDoc: null,
    log: { error: vi.fn() },
    ...overrides,
  };
}

function queryResult(value) {
  return { lean: () => Promise.resolve(value) };
}

describe("GET /:slug (editorial)", () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
    isUserPremium.mockReturnValue(false);
    getSolvedSlugs.mockResolvedValue([]);
  });

  it("returns 404 when the problem doesn't exist", async () => {
    Problem.findOne.mockReturnValue({ select: () => queryResult(null) });

    await getHandler("get", "/")(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("locks the editorial for an unauthenticated caller who hasn't solved it", async () => {
    Problem.findOne.mockReturnValue({
      select: () => queryResult({ slug: "two-sum", title: "Two Sum", visibility: "public", editorial: { content: "spoilers" } }),
    });

    await getHandler("get", "/")(mockReq({ userDoc: null }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ locked: true }));
  });

  it("locks the editorial for a student who hasn't solved the problem and isn't premium", async () => {
    Problem.findOne.mockReturnValue({
      select: () => queryResult({ slug: "two-sum", title: "Two Sum", visibility: "public", editorial: { content: "spoilers" } }),
    });
    isUserPremium.mockReturnValue(false);

    const req = mockReq({ userDoc: { _id: "u1", role: "student", solvedSlugs: ["some-other-slug"] } });
    await getHandler("get", "/")(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("unlocks the editorial once the student has solved the problem", async () => {
    Problem.findOne.mockReturnValue({
      select: () => queryResult({
        slug: "two-sum", title: "Two Sum", visibility: "public",
        editorial: { content: "The trick is a hashmap.", author: "Code Club", updatedAt: new Date("2026-01-01") },
      }),
    });
    isUserPremium.mockReturnValue(false);

    getSolvedSlugs.mockResolvedValue(["two-sum"]);
    const req = mockReq({ userDoc: { _id: "u1", role: "student" } });
    await getHandler("get", "/")(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "two-sum", available: true, content: "The trick is a hashmap." })
    );
  });

  it("unlocks the editorial for a premium user who hasn't solved the problem", async () => {
    Problem.findOne.mockReturnValue({
      select: () => queryResult({
        slug: "two-sum", title: "Two Sum", visibility: "public",
        editorial: { content: "The trick is a hashmap." },
      }),
    });
    isUserPremium.mockReturnValue(true);

    const req = mockReq({ userDoc: { _id: "u1", role: "student" } });
    await getHandler("get", "/")(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ available: true }));
  });

  it("unlocks the editorial for an admin regardless of solve state", async () => {
    Problem.findOne.mockReturnValue({
      select: () => queryResult({
        slug: "two-sum", title: "Two Sum", visibility: "public",
        editorial: { content: "The trick is a hashmap." },
      }),
    });
    isUserPremium.mockReturnValue(false);

    const req = mockReq({ userDoc: { _id: "admin1", role: "admin" } });
    await getHandler("get", "/")(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("returns available:false with empty content when no editorial has been written", async () => {
    Problem.findOne.mockReturnValue({
      select: () => queryResult({ slug: "two-sum", title: "Two Sum", visibility: "public", editorial: { content: "" } }),
    });
    isUserPremium.mockReturnValue(false);

    getSolvedSlugs.mockResolvedValue(["two-sum"]);
    const req = mockReq({ userDoc: { _id: "u1", role: "student" } });
    await getHandler("get", "/")(req, res);

    expect(res.json).toHaveBeenCalledWith({ slug: "two-sum", content: "", available: false });
  });

  // ── IDOR / access-control: contest-visibility problems ──────────────────
  it("hides a contest-visibility problem's editorial (404, not 403) when the caller can't access the contest yet", async () => {
    Problem.findOne.mockReturnValue({
      select: () => queryResult({ slug: "contest-only", title: "Contest Problem", visibility: "contest", editorial: { content: "spoilers" } }),
    });
    canAccessContestProblem.mockResolvedValue(false);

    const req = mockReq({ params: { slug: "contest-only" }, userDoc: { _id: "u1", role: "student" } });
    await getHandler("get", "/")(req, res);

    expect(canAccessContestProblem).toHaveBeenCalledWith("contest-only", req.userDoc);
    expect(res.status).toHaveBeenCalledWith(404);
    // Must not leak that the problem exists via a distinguishable error shape.
    expect(res.json).toHaveBeenCalledWith({ error: "Problem not found." });
  });

  it("still applies the solve-gate for a contest-visibility problem once contest access is granted", async () => {
    Problem.findOne.mockReturnValue({
      select: () => queryResult({ slug: "contest-only", title: "Contest Problem", visibility: "contest", editorial: { content: "spoilers" } }),
    });
    canAccessContestProblem.mockResolvedValue(true);
    isUserPremium.mockReturnValue(false);

    const req = mockReq({ params: { slug: "contest-only" }, userDoc: { _id: "u1", role: "student", solvedSlugs: [] } });
    await getHandler("get", "/")(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 and logs when the database call throws", async () => {
    Problem.findOne.mockImplementation(() => { throw new Error("db down"); });

    const req = mockReq({ userDoc: { _id: "u1", role: "student" } });
    await getHandler("get", "/")(req, res);

    expect(req.log.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("POST /:slug (editorial) — admin write path", () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("saves editorial content for a valid problem", async () => {
    Problem.findOneAndUpdate.mockReturnValue({
      select: () => Promise.resolve({ slug: "two-sum", editorial: { content: "Updated." } }),
    });

    const req = mockReq({ body: { content: "Updated." } });
    await getHandler("post", "/")(req, res);

    expect(Problem.findOneAndUpdate).toHaveBeenCalledWith(
      { slug: "two-sum" },
      expect.objectContaining({ "editorial.content": "Updated." }),
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith({ slug: "two-sum", saved: true });
  });

  it("rejects a non-string content body", async () => {
    const req = mockReq({ body: { content: 12345 } });
    await getHandler("post", "/")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Problem.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 for a slug that doesn't exist", async () => {
    Problem.findOneAndUpdate.mockReturnValue({ select: () => Promise.resolve(null) });

    const req = mockReq({ params: { slug: "does-not-exist" }, body: { content: "x" } });
    await getHandler("post", "/")(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // Note: role enforcement itself (admin-only) is applied via
  // requireRole("admin") middleware on this route, covered by
  // middleware/roleGuard.test.js — this suite only covers the handler body.
});
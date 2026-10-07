import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/Submission.js", () => ({
  default: { find: vi.fn(), exists: vi.fn() },
}));
vi.mock("../models/Problem.js", () => ({
  default: { find: vi.fn() },
}));
vi.mock("../models/UserProblemProgress.js", () => ({
  default: { find: vi.fn() },
}));

import Submission from "../models/Submission.js";
import Problem from "../models/Problem.js";
import UserProblemProgress from "../models/UserProblemProgress.js";
import { verifyAgainstSubmissions, validateSlugs } from "./progress.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

// Chainable distinct() mocks for the two scalable verification sources.
function mockFindDistinct(resolvedSlugs) {
  Submission.find.mockReturnValue({
    distinct: vi.fn().mockResolvedValue(resolvedSlugs),
  });
  UserProblemProgress.find.mockReturnValue({
    distinct: vi.fn().mockResolvedValue([]),
  });
}

function mockProgressDistinct(resolvedSlugs) {
  UserProblemProgress.find.mockReturnValue({
    distinct: vi.fn().mockResolvedValue(resolvedSlugs),
  });
}

describe("verifyAgainstSubmissions — the core solve-integrity fix", () => {
  let res;
  let next;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
    next = vi.fn();
  });

  it("drops a problem claim that has no matching Accepted submission", async () => {
    mockFindDistinct([]);
    const req = {
      body: { problemSlug: "two-sum" },
      userDoc: { _id: "user1" },
      log: mockLog(),
    };

    await verifyAgainstSubmissions(req, res, next);

    expect(req.verifiedNewSlugs).toEqual([]);
    expect(next).toHaveBeenCalledOnce();
    expect(req.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ rejected: ["two-sum"] }),
      expect.any(String)
    );
  });

  it("accepts a slug that DOES have a matching Accepted submission for this user", async () => {
    mockFindDistinct(["two-sum"]);
    const req = {
      body: { problemSlug: "two-sum" },
      userDoc: { _id: "user1", solvedSlugs: [] },
      log: mockLog(),
    };

    await verifyAgainstSubmissions(req, res, next);

    expect(req.verifiedNewSlugs).toEqual(["two-sum"]);
    expect(next).toHaveBeenCalledOnce();
    expect(Submission.find).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user1",
        status: "Accepted",
        problemSlug: { $in: ["two-sum"] },
      })
    );
  });

  it("accepts real slugs and silently drops fabricated ones in the same request", async () => {
    mockFindDistinct(["two-sum"]); // only two-sum has a real Accepted submission
    const req = {
      body: { problemSlug: "forged-slug" },
      userDoc: { _id: "user1", solvedSlugs: [] },
      log: mockLog(),
    };

    await verifyAgainstSubmissions(req, res, next);

    expect(req.verifiedNewSlugs).toEqual(["two-sum"]);
    expect(req.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ rejected: ["forged-slug"] }),
      expect.any(String)
    );
  });

  it("does not re-query already-trusted (previously persisted) solvedSlugs", async () => {
    mockProgressDistinct(["already-solved"]);
    const req = {
      body: { problemSlug: "already-solved" },
      userDoc: { _id: "user1", solvedSlugs: ["already-solved"] },
      log: mockLog(),
    };

    await verifyAgainstSubmissions(req, res, next);

    expect(UserProblemProgress.find).toHaveBeenCalledWith({
      userId: "user1",
      problemSlug: { $in: ["already-solved"] },
      status: "solved",
    });
    expect(Submission.find).not.toHaveBeenCalled();
    expect(req.verifiedNewSlugs).toEqual([]);
    expect(next).toHaveBeenCalledOnce();
  });

  it("fails closed (treats everything as unverified) if the Submission query itself errors", async () => {
    UserProblemProgress.find.mockReturnValue({
      distinct: vi.fn().mockRejectedValue(new Error("Mongo down")),
    });
    const req = {
      body: { problemSlug: "two-sum" },
      userDoc: { _id: "user1", solvedSlugs: [] },
      log: mockLog(),
    };

    await verifyAgainstSubmissions(req, res, next);

    expect(req.verifiedNewSlugs).toEqual([]);
    expect(next).toHaveBeenCalledOnce();
    expect(req.log.error).toHaveBeenCalled();
  });

  it("is a no-op (nothing verified, but no crash) when req.userDoc is missing", async () => {
    const req = {
      body: { problemSlug: "two-sum" },
      userDoc: undefined,
      log: mockLog(),
    };

    await verifyAgainstSubmissions(req, res, next);

    expect(Submission.find).not.toHaveBeenCalled();
    expect(req.verifiedNewSlugs).toEqual([]);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("validateSlugs — existence check only (does not, by itself, prove ownership)", () => {
  let res;
  let next;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
    next = vi.fn();
  });

  it("rejects a slug that isn't a real problem at all", async () => {
    Problem.exists.mockResolvedValue(false);
    const req = {
      body: { problemSlug: "not-a-real-problem" },
      log: mockLog(),
    };

    await validateSlugs(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes through real slugs to the next middleware (which still must verify ownership)", async () => {
    Problem.exists.mockResolvedValue(true);
    const req = { body: { problemSlug: "two-sum" }, log: mockLog() };

    await validateSlugs(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

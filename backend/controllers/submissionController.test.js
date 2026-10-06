import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/Submission.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findOne: vi.fn() },
  SUBMISSION_STATUSES: [
    "Accepted",
    "Wrong Answer",
    "Compilation Error",
    "Runtime Error",
    "Time Limit Exceeded",
    "Judge Error",
  ],
}));

const { recordProblemProgress } = vi.hoisted(() => ({
  recordProblemProgress: vi.fn().mockResolvedValue({ status: "solved" }),
}));
const { recordProblemSubmissionStats } = vi.hoisted(() => ({
  recordProblemSubmissionStats: vi.fn().mockResolvedValue({ attempts: 1 }),
}));

vi.mock("../services/problemProgressService.js", () => ({
  recordProblemProgress,
}));
vi.mock("../services/problemStatsService.js", () => ({
  recordProblemSubmissionStats,
}));

import Submission, { SUBMISSION_STATUSES } from "../models/Submission.js";
import {
  createSubmission,
  decodeSubmissionCursor,
  encodeSubmissionCursor,
  listSubmissions,
  recordVerifiedSubmission,
} from "./submissionController.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockSubmissionQuery(rows) {
  const query = {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
  Submission.find.mockReturnValue(query);
  return query;
}

describe("createSubmission (POST /api/submissions) — locked down", () => {
  it("returns 410 Gone and does not write anything, regardless of what the client sends", async () => {
    const res = mockRes();
    const req = {
      userDoc: { _id: "user1" },
      body: {
        // The old exploit payload — must have zero effect now.
        problemSlug: "two-sum",
        status: "Accepted",
        passed: 999,
        total: 999,
      },
    };

    await createSubmission(req, res);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(Submission.create).not.toHaveBeenCalled();
  });
});

describe("recordVerifiedSubmission — internal, server-only writer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes exactly the fields it's given, with a valid status", async () => {
    Submission.create.mockResolvedValue({ _id: "sub1", createdAt: new Date() });

    await recordVerifiedSubmission({
      userId: "user1",
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      language: "python",
      code: "def twoSum(): pass",
      status: "Accepted",
      passed: 2,
      total: 2,
      visiblePassed: 1,
      hiddenPassed: 1,
      executionTime: "120",
    });

    expect(Submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user1",
        problemSlug: "two-sum",
        status: "Accepted",
        passed: 2,
        total: 2,
      })
    );
  });

  it("passes problemVersion through to Submission.create when provided", async () => {
    Submission.create.mockResolvedValue({ _id: "sub1", createdAt: new Date() });

    await recordVerifiedSubmission({
      userId: "user1",
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      language: "python",
      code: "def twoSum(): pass",
      status: "Accepted",
      passed: 2,
      total: 2,
      problemVersion: 3,
    });

    expect(Submission.create).toHaveBeenCalledWith(expect.objectContaining({ problemVersion: 3 }));
  });

  it("defaults problemVersion to null when the caller doesn't pass one", async () => {
    Submission.create.mockResolvedValue({ _id: "sub1", createdAt: new Date() });

    await recordVerifiedSubmission({
      userId: "user1",
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      language: "python",
      code: "def twoSum(): pass",
      status: "Accepted",
      passed: 2,
      total: 2,
    });

    expect(Submission.create).toHaveBeenCalledWith(expect.objectContaining({ problemVersion: null }));
  });

  it("rejects a status outside the known enum rather than writing garbage to the DB", async () => {
    await expect(
      recordVerifiedSubmission({
        userId: "user1",
        problemSlug: "two-sum",
        problemTitle: "Two Sum",
        language: "python",
        code: "x",
        status: "Definitely Accepted Trust Me",
        passed: 1,
        total: 1,
      })
    ).rejects.toThrow(/invalid status/i);
  });

  it("every status this function is asked to write is one submitHandler can actually produce", () => {
    expect(SUBMISSION_STATUSES).toEqual([
      "Accepted",
      "Wrong Answer",
      "Compilation Error",
      "Runtime Error",
      "Time Limit Exceeded",
      "Judge Error",
    ]);
  });
});

describe("submission history pagination", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the legacy array response when no pagination parameters are supplied", async () => {
    const rows = [
      {
        _id: { toString: () => "507f1f77bcf86cd799439011" },
        problemSlug: "two-sum",
        problemTitle: "Two Sum",
        language: "python",
        status: "Accepted",
        passed: 2,
        total: 2,
        createdAt: new Date("2026-10-05T12:00:00.000Z"),
      },
    ];
    const query = mockSubmissionQuery(rows);
    const res = mockRes();

    await listSubmissions(
      { userDoc: { _id: "user1" }, query: {}, log: { error: vi.fn() } },
      res
    );

    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(query.limit).toHaveBeenCalledWith(51);
    expect(res.json).toHaveBeenCalledWith(expect.any(Array));
  });

  it("returns a cursor page and a stable next cursor when more rows exist", async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      _id: { toString: () => `507f1f77bcf86cd79943901${index + 1}` },
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      language: "python",
      status: "Accepted",
      passed: 2,
      total: 2,
      createdAt: new Date(`2026-10-05T12:0${index}:00.000Z`),
    }));
    const query = mockSubmissionQuery(rows);
    const res = mockRes();

    await listSubmissions(
      {
        userDoc: { _id: "user1" },
        query: { limit: "2" },
        log: { error: vi.fn() },
      },
      res
    );

    expect(query.limit).toHaveBeenCalledWith(3);
    const payload = res.json.mock.calls[0][0];
    expect(payload.submissions).toHaveLength(2);
    expect(payload.hasMore).toBe(true);
    expect(payload.nextCursor).toBeTruthy();
    expect(decodeSubmissionCursor(payload.nextCursor)).toEqual({
      createdAt: rows[1].createdAt,
      id: "507f1f77bcf86cd799439012",
    });
  });

  it("applies the cursor as a keyset boundary instead of using skip/offset", async () => {
    const cursorDoc = {
      _id: { toString: () => "507f1f77bcf86cd799439012" },
      createdAt: new Date("2026-10-05T12:01:00.000Z"),
    };
    const cursor = encodeSubmissionCursor(cursorDoc);
    const query = mockSubmissionQuery([]);
    const res = mockRes();

    await listSubmissions(
      {
        userDoc: { _id: "user1" },
        query: { cursor, limit: "20", problemSlug: "two-sum" },
        log: { error: vi.fn() },
      },
      res
    );

    const filter = Submission.find.mock.calls[0][0];
    expect(filter).toMatchObject({ userId: "user1", problemSlug: "two-sum" });
    expect(filter.$or).toEqual([
      { createdAt: { $lt: cursorDoc.createdAt } },
      { createdAt: cursorDoc.createdAt, _id: { $lt: cursorDoc._id.toString() } },
    ]);
  });

  it("rejects malformed cursors and invalid limits", async () => {
    const res = mockRes();
    const req = { userDoc: { _id: "user1" }, query: { cursor: "not-a-cursor" }, log: { error: vi.fn() } };

    await listSubmissions(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid submission cursor." });

    const invalidLimitRes = mockRes();
    await listSubmissions(
      { userDoc: { _id: "user1" }, query: { limit: "101" }, log: { error: vi.fn() } },
      invalidLimitRes
    );
    expect(invalidLimitRes.status).toHaveBeenCalledWith(400);
  });
});

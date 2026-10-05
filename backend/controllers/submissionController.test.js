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
import { createSubmission, recordVerifiedSubmission } from "./submissionController.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
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

  // ── Minimum-viable versioning follow-up ──────────────────────────────
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

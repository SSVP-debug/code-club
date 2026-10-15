import { describe, expect, it, vi, beforeEach } from "vitest";

const { findOneAndUpdate, bulkWrite, find, aggregate } = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  bulkWrite: vi.fn(),
  find: vi.fn(),
  aggregate: vi.fn(),
}));

vi.mock("../models/UserProblemProgress.js", () => ({
  default: { findOneAndUpdate, bulkWrite, find, aggregate },
}));

import {
  recordProblemProgress,
  syncSolvedProblemProgress,
  getSolvedSlugs,
  getActivityDays,
} from "./problemProgressService.js";

describe("problemProgressService", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    bulkWrite.mockReset();
    find.mockReset();
    aggregate.mockReset();

    findOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ status: "solved" }),
    });
    bulkWrite.mockResolvedValue({ acknowledged: true });
  });

  it("upserts one user/problem row for a submission", async () => {
    await recordProblemProgress({
      userId: "user-1",
      problemSlug: "two-sum",
      accepted: true,
    });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-1", problemSlug: "two-sum" },
      expect.objectContaining({
        $inc: { attemptCount: 1, acceptedCount: 1 },
        $set: expect.objectContaining({ status: "solved" }),
      }),
      expect.objectContaining({ upsert: true, new: true })
    );
  });

  it("bulk-syncs solved slugs idempotently", async () => {
    await syncSolvedProblemProgress("user-1", ["two-sum", "two-sum", "valid-parentheses"]);

    expect(bulkWrite).toHaveBeenCalledTimes(1);
    const [operations] = bulkWrite.mock.calls[0];
    expect(operations).toHaveLength(2);
    expect(operations[0].updateOne.filter).toEqual({
      userId: "user-1",
      problemSlug: "two-sum",
    });
    expect(operations[0].updateOne.update.$set.status).toBe("solved");
  });

  it("reads solved slugs without loading full progress documents", async () => {
    const lean = vi.fn().mockResolvedValue([
      { problemSlug: "two-sum" },
      { problemSlug: "valid-parentheses" },
    ]);
    find.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean }),
    });

    await expect(getSolvedSlugs("user-1")).resolves.toEqual([
      "two-sum",
      "valid-parentheses",
    ]);
  });
});


describe("getActivityDays", () => {
  it("reads a bounded set of unique indexed solved-day keys", async () => {
    aggregate.mockResolvedValue([
      { _id: "2026-09-06" },
      { _id: "2026-09-07" },
    ]);

    await expect(getActivityDays("user-1")).resolves.toEqual([
      "2026-09-06",
      "2026-09-07",
    ]);
    expect(aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        $match: expect.objectContaining({
          userId: "user-1",
          status: "solved",
          solvedDay: expect.objectContaining({ $gte: expect.any(String) }),
        }),
      }),
      { $group: { _id: "$solvedDay" } },
      { $sort: { _id: 1 } },
      { $limit: 365 },
    ]));
  });
});

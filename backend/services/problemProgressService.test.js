import { describe, expect, it, vi, beforeEach } from "vitest";

const findOneAndUpdate = vi.fn();
const bulkWrite = vi.fn();
const find = vi.fn();

vi.mock("../models/UserProblemProgress.js", () => ({
  default: { findOneAndUpdate, bulkWrite, find },
}));

import {
  recordProblemProgress,
  syncSolvedProblemProgress,
  getSolvedSlugs,
} from "./problemProgressService.js";

describe("problemProgressService", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    bulkWrite.mockReset();
    find.mockReset();

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

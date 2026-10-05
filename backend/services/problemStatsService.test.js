import { describe, expect, it, vi, beforeEach } from "vitest";

const { findOneAndUpdate } = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
}));

vi.mock("../models/ProblemStats.js", () => ({
  default: { findOneAndUpdate },
}));

import { recordProblemSubmissionStats } from "./problemStatsService.js";

describe("problemStatsService", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    findOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        problemSlug: "two-sum",
        attempts: 3,
        accepted: 1,
      }),
    });
  });

  it("increments attempts and accepted for a solved submission", async () => {
    await recordProblemSubmissionStats({
      problemSlug: "two-sum",
      accepted: true,
    });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { problemSlug: "two-sum" },
      expect.objectContaining({
        $inc: { attempts: 1, accepted: 1 },
      }),
      expect.objectContaining({ upsert: true, new: true })
    );
  });

  it("increments only attempts for a non-accepted submission", async () => {
    await recordProblemSubmissionStats({
      problemSlug: "two-sum",
      accepted: false,
    });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { problemSlug: "two-sum" },
      expect.objectContaining({
        $inc: { attempts: 1 },
      }),
      expect.objectContaining({ upsert: true, new: true })
    );
  });
});

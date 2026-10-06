import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/User.js", () => ({ default: { aggregate: vi.fn() } }));
vi.mock("../models/Problem.js", () => ({ default: { find: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() } }));
vi.mock("../models/ProblemStats.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../models/Submission.js", () => ({ default: { aggregate: vi.fn(), distinct: vi.fn() } }));
vi.mock("../config/logger.js", () => ({ logger: { error: vi.fn() } }));

import User from "../models/User.js";
import Problem from "../models/Problem.js";
import ProblemStats from "../models/ProblemStats.js";
import Submission from "../models/Submission.js";
import {
  getRegistrationTrends,
  getSubmissionTrends,
  getActiveUserTrends,
  getRetentionMetric,
  getProblemPopularity,
  getLanguagePopularity,
} from "./adminAnalyticsController.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function statsQuery(rows) {
  const q = {
    sort: vi.fn(() => q),
    limit: vi.fn(() => q),
    select: vi.fn(() => q),
    lean: vi.fn().mockResolvedValue(rows),
  };
  return q;
}

describe("admin analytics scalability", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aggregates registration trends in Mongo instead of materializing users", async () => {
    User.aggregate.mockResolvedValue([{ _id: 0, count: 2 }]);
    const res = mockRes();

    await getRegistrationTrends({ query: {} }, res);

    expect(User.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ $match: expect.objectContaining({ createdAt: expect.any(Object) }) }),
      expect.objectContaining({ $group: expect.any(Object) }),
    ]));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ bucket: "daily", trend: expect.any(Array) }));
    expect(res.json.mock.calls[0][0].trend.reduce((sum, b) => sum + b.count, 0)).toBe(2);
  });

  it("uses the same bounded Mongo aggregation for submission trends", async () => {
    Submission.aggregate.mockResolvedValue([{ _id: 0, count: 3 }]);
    const res = mockRes();

    await getSubmissionTrends({ query: { bucket: "weekly" } }, res);

    expect(Submission.aggregate).toHaveBeenCalledTimes(1);
    expect(Submission.aggregate.mock.calls[0][0][0]).toMatchObject({ $match: { createdAt: expect.any(Object) } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ bucket: "weekly" }));
  });

  it("keeps active-user and retention semantics intact", async () => {
    Submission.distinct
      .mockResolvedValueOnce(["u1", "u2"])
      .mockResolvedValueOnce(["u1", "u2", "u3"])
      .mockResolvedValueOnce(["u1", "u2"])
      .mockResolvedValueOnce(["u2", "u3"]);

    const activeRes = mockRes();
    await getActiveUserTrends({}, activeRes);
    expect(activeRes.json).toHaveBeenCalledWith({ last7Days: 2, last30Days: 3 });

    const retentionRes = mockRes();
    await getRetentionMetric({}, retentionRes);
    expect(retentionRes.json).toHaveBeenCalledWith({
      weekN1ActiveUsers: 2,
      weekNActiveUsers: 2,
      retainedUsers: 1,
      retentionPercent: 50,
    });
  });

  it("reads problem popularity from ProblemStats instead of grouping Submission history", async () => {
    ProblemStats.find
      .mockReturnValueOnce(statsQuery([{ problemSlug: "two-sum", accepted: 50 }]))
      .mockReturnValueOnce(statsQuery([{ problemSlug: "reverse-string", accepted: 5 }]));
    Problem.countDocuments.mockResolvedValue(10);
    Problem.aggregate.mockResolvedValue([{ count: 2 }]);
    Problem.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([
      { slug: "two-sum", title: "Two Sum", difficulty: "Easy" },
      { slug: "reverse-string", title: "Reverse String", difficulty: "Easy" },
    ]) });
    const res = mockRes();

    await getProblemPopularity({ query: { limit: "10" } }, res);

    expect(Submission.aggregate).not.toHaveBeenCalled();
    expect(ProblemStats.find).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({
      mostSolved: [{ slug: "two-sum", title: "Two Sum", difficulty: "Easy", acceptedCount: 50 }],
      leastSolved: [{ slug: "reverse-string", title: "Reverse String", difficulty: "Easy", acceptedCount: 5 }],
      neverSolvedCount: 8,
    });
  });

  it("preserves language popularity behavior", async () => {
    Submission.aggregate.mockResolvedValue([
      { _id: "python", count: 120 },
      { _id: "javascript", count: 80 },
    ]);
    const res = mockRes();

    await getLanguagePopularity({}, res);

    expect(res.json).toHaveBeenCalledWith({
      languages: [
        { language: "python", count: 120 },
        { language: "javascript", count: 80 },
      ],
    });
  });
});

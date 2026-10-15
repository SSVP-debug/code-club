import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/Contest.js", () => ({
  default: { findById: vi.fn() },
}));
vi.mock("../models/ContestParticipant.js", () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

import Contest from "../models/Contest.js";
import ContestParticipant from "../models/ContestParticipant.js";
import { awardContestSolve, CONTEST_SOLVE_REJECTION, CONTEST_SOLVE_SCORE } from "./contestScoring.js";

function queryResult(value) {
  return {
    select: () => queryResult(value),
    lean: () => Promise.resolve(value),
    then: (resolve) => resolve(value),
  };
}

function makeContest(overrides = {}) {
  const now = Date.now();
  return {
    _id: "contest1",
    startsAt: new Date(now - 60_000),
    endsAt: new Date(now + 60_000),
    problemSlugs: ["two-sum"],
    ...overrides,
  };
}

function makeParticipant(overrides = {}) {
  return { userId: "user1", score: 0, solvedSlugs: [], ...overrides };
}

describe("awardContestSolve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when the contest doesn't exist", async () => {
    Contest.findById.mockReturnValue(queryResult(null));

    const result = await awardContestSolve({ contestId: "nope", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({ ok: false, reason: CONTEST_SOLVE_REJECTION.NOT_FOUND });
    expect(ContestParticipant.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects inactive contests", async () => {
    Contest.findById.mockReturnValue(queryResult(makeContest({
      startsAt: new Date(Date.now() + 60_000),
      endsAt: new Date(Date.now() + 120_000),
    })));

    const result = await awardContestSolve({ contestId: "contest1", userId: "user1", slug: "two-sum" });
    expect(result).toEqual({ ok: false, reason: CONTEST_SOLVE_REJECTION.NOT_ACTIVE });
  });

  it("rejects a problem that is not part of the contest", async () => {
    Contest.findById.mockReturnValue(queryResult(makeContest({ problemSlugs: ["other"] })));

    const result = await awardContestSolve({ contestId: "contest1", userId: "user1", slug: "two-sum" });
    expect(result).toEqual({ ok: false, reason: CONTEST_SOLVE_REJECTION.NOT_IN_CONTEST });
  });

  it("rejects a user who has not joined", async () => {
    Contest.findById.mockReturnValue(queryResult(makeContest()));
    ContestParticipant.findOne.mockReturnValue(queryResult(null));

    const result = await awardContestSolve({ contestId: "contest1", userId: "user1", slug: "two-sum" });
    expect(result).toEqual({ ok: false, reason: CONTEST_SOLVE_REJECTION.NOT_JOINED });
    expect(ContestParticipant.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("awards score atomically in ContestParticipant", async () => {
    Contest.findById.mockReturnValue(queryResult(makeContest()));
    ContestParticipant.findOne.mockReturnValue(queryResult(makeParticipant()));
    ContestParticipant.findOneAndUpdate.mockReturnValue(queryResult({ score: CONTEST_SOLVE_SCORE }));

    const result = await awardContestSolve({ contestId: "contest1", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({ ok: true, alreadySolved: false, score: CONTEST_SOLVE_SCORE });
    expect(ContestParticipant.findOneAndUpdate).toHaveBeenCalledWith(
      { contestId: "contest1", userId: "user1", solvedSlugs: { $ne: "two-sum" } },
      {
        $push: { solvedSlugs: "two-sum" },
        $inc: { score: CONTEST_SOLVE_SCORE },
      },
      { new: true, projection: { score: 1 } }
    );
  });

  it("is idempotent when the atomic update loses the race", async () => {
    Contest.findById.mockReturnValue(queryResult(makeContest()));
    ContestParticipant.findOne
      .mockReturnValueOnce(queryResult(makeParticipant({ score: CONTEST_SOLVE_SCORE, solvedSlugs: ["two-sum"] })))
      .mockReturnValueOnce(queryResult({ score: CONTEST_SOLVE_SCORE }));
    ContestParticipant.findOneAndUpdate.mockReturnValue(queryResult(null));

    const result = await awardContestSolve({ contestId: "contest1", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({ ok: true, alreadySolved: true, score: CONTEST_SOLVE_SCORE });
    expect(ContestParticipant.findOneAndUpdate).toHaveBeenCalledOnce();
  });
});

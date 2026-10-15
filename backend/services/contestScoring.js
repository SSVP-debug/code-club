import Contest from "../models/Contest.js";
import ContestParticipant from "../models/ContestParticipant.js";

export const CONTEST_SOLVE_SCORE = 100;

export const CONTEST_SOLVE_REJECTION = Object.freeze({
  NOT_FOUND: "contest_not_found",
  NOT_ACTIVE: "contest_not_active",
  NOT_IN_CONTEST: "problem_not_in_contest",
  NOT_JOINED: "not_joined",
});

function computeContestStatus(contest) {
  const now = new Date();
  if (now < new Date(contest.startsAt)) return "upcoming";
  if (now > new Date(contest.endsAt)) return "ended";
  return "active";
}

/**
 * Awards a contest solve exactly once per (contest, participant, problem).
 * Contest metadata remains in Contest; mutable participation state lives in
 * ContestParticipant, so leaderboard writes no longer contend on one parent
 * document or grow that document with every join/solve.
 */
export async function awardContestSolve({ contestId, userId, slug }) {
  const contest = await Contest.findById(contestId).select("startsAt endsAt problemSlugs").lean();
  if (!contest) {
    return { ok: false, reason: CONTEST_SOLVE_REJECTION.NOT_FOUND };
  }

  if (computeContestStatus(contest) !== "active") {
    return { ok: false, reason: CONTEST_SOLVE_REJECTION.NOT_ACTIVE };
  }

  if (!contest.problemSlugs.includes(slug)) {
    return { ok: false, reason: CONTEST_SOLVE_REJECTION.NOT_IN_CONTEST };
  }

  const participant = await ContestParticipant.findOne({ contestId, userId })
    .select("userId score solvedSlugs")
    .lean();
  if (!participant) {
    return { ok: false, reason: CONTEST_SOLVE_REJECTION.NOT_JOINED };
  }

  // The filter makes the write atomic: only the first concurrent request
  // that sees this slug as unsolved can increment score and add the slug.
  const updated = await ContestParticipant.findOneAndUpdate(
    {
      contestId,
      userId,
      solvedSlugs: { $ne: slug },
    },
    {
      $push: { solvedSlugs: slug },
      $inc: { score: CONTEST_SOLVE_SCORE },
    },
    { new: true, projection: { score: 1 } }
  ).lean();

  if (!updated) {
    const current = await ContestParticipant.findOne({ contestId, userId })
      .select("score")
      .lean();
    return {
      ok: true,
      alreadySolved: true,
      score: current?.score ?? participant.score ?? null,
    };
  }

  return { ok: true, alreadySolved: false, score: updated.score };
}

import BattleRoom from "../models/BattleRoom.js";

// ── Battle Room scoring ──────────────────────────────────────────────────
// Same class of fix as services/contestScoring.js (Fest Readiness Audit,
// P0-1), applied to Battle Rooms: scoring must be a consequence of a
// server-verified Accepted submission, never a bare client claim.
//
// This module is the SOLE place BattleRoom.roster[].solvedSlugs and
// BattleRoom.teams[].solvedSlugs/score are mutated — mirrors
// submissionController.recordVerifiedSubmission's "one authoritative
// writer" pattern for Submission documents, and contestScoring.js's own
// doc comment almost word for word. It has exactly two intended callers:
//   1. controllers/judgeController.js's submitHandler — the TRUSTED path.
//      It calls this immediately after computing a real Accepted verdict
//      itself, so by construction the solve is genuine; no further proof
//      is needed here.
//   2. routes/battleRooms.js's legacy POST /:id/solve endpoint — kept
//      only for callers that haven't migrated to sending `battleRoomId`
//      directly on POST /api/judge/submit. That route must independently
//      prove a real Accepted Submission exists (see its own comment)
//      before calling this function — this module does NOT do that
//      proof-checking itself, because it has no way to know whether its
//      caller already established it or not. Never call this from
//      anywhere else without that same guarantee.
//
// What this function DOES enforce, unconditionally, for every caller: the
// BATTLE ROOM's own rules — the room is active (by server clock, never a
// possibly-stale status field or a client-sent one), the problem actually
// belongs to the room, the user actually joined, and the user is actually
// assigned to a team. Never trusts a client-sent teamIndex/userId/status.

export const BATTLE_ROOM_SOLVE_SCORE = 100;

export const BATTLE_ROOM_SOLVE_REJECTION = Object.freeze({
  NOT_FOUND: "battle_room_not_found",
  NOT_ACTIVE: "battle_room_not_active",
  NOT_IN_ROOM: "problem_not_in_battle_room",
  NOT_PARTICIPANT: "not_joined",
  NOT_ON_TEAM: "not_on_team",
});

/**
 * Atomically marks a Battle Room problem solved for a participant and,
 * the first time any of their teammates solve it, awards their team's
 * score — exactly once per (room, member, slug) for the personal record,
 * and exactly once per (room, team, slug) for the team score. Mirrors the
 * two-step atomic update pattern from the original /:id/solve handler
 * this was extracted from (findOneAndUpdate with an $elemMatch/$ne
 * filter so a losing concurrent request can't double-push or
 * double-award).
 *
 * Returns `{ ok: true, alreadySolvedPersonally, countedForTeam, teamScore,
 * teamIndex }` on success (including the idempotent "already solved
 * personally" case — a successful no-op, not an error), or
 * `{ ok: false, reason }` (one of BATTLE_ROOM_SOLVE_REJECTION) when the
 * room's own rules aren't satisfied. Never throws for those expected
 * rejection cases — only for genuine unexpected errors (e.g. the database
 * call itself failing), which callers should catch separately.
 */
export async function awardBattleRoomSolve({ battleRoomId, userId, slug }) {
  const room = await BattleRoom.findById(battleRoomId);
  if (!room) {
    return { ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_FOUND };
  }

  // Time-based check, not just the status flag — a Battle Room can sit
  // "active" in the DB past its actual endsAt if nothing else has
  // written to it since. Never trust a client-sent status/clock.
  const now = new Date();
  if (room.status !== "active" || (room.endsAt && now >= new Date(room.endsAt))) {
    return { ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_ACTIVE };
  }

  if (!room.problemSlugs.includes(slug)) {
    return { ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_IN_ROOM };
  }

  const membership = room.roster.find((r) => r.userId.toString() === userId.toString());
  if (!membership) {
    return { ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_PARTICIPANT };
  }
  if (membership.teamIndex === null || membership.teamIndex === undefined) {
    return { ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_ON_TEAM };
  }

  // Step 1 (atomic): record this member's own solve. Filter requires
  // teamIndex to be set (must be on a team) and this slug not already
  // personally solved — protects against double-submit races.
  const afterPersonal = await BattleRoom.findOneAndUpdate(
    {
      _id: battleRoomId,
      status: "active",
      endsAt: { $gt: new Date() },
      roster: { $elemMatch: { userId, teamIndex: { $ne: null }, solvedSlugs: { $ne: slug } } },
    },
    { $push: { "roster.$.solvedSlugs": slug } },
    { new: true }
  );

  if (!afterPersonal) {
    // Lost the race, or already personally recorded this slug earlier —
    // either way that's a successful no-op, not an error.
    const current = await BattleRoom.findById(battleRoomId).lean();
    const entry = current?.roster.find((r) => r.userId.toString() === userId.toString());
    const teamIndex = entry?.teamIndex ?? null;
    return {
      ok: true,
      alreadySolvedPersonally: true,
      countedForTeam: false,
      teamScore: teamIndex != null ? current.teams[teamIndex].score : null,
      teamIndex,
    };
  }

  const myEntry = afterPersonal.roster.find((r) => r.userId.toString() === userId.toString());
  const teamIndex = myEntry.teamIndex;

  // Step 2 (atomic): only the first teammate to solve this slug bumps the
  // team's score — the filter fails for anyone who loses the race (or
  // arrives after a teammate already solved it), and that's correct.
  const teamPath = `teams.${teamIndex}.solvedSlugs`;
  const afterTeam = await BattleRoom.findOneAndUpdate(
    {
      _id: battleRoomId,
      status: "active",
      endsAt: { $gt: new Date() },
      [teamPath]: { $ne: slug },
    },
    {
      $push: { [teamPath]: slug },
      $inc: { [`teams.${teamIndex}.score`]: BATTLE_ROOM_SOLVE_SCORE },
    },
    { new: true }
  );

  const countedForTeam = Boolean(afterTeam);
  const finalRoom = afterTeam || afterPersonal;
  const teamScore = finalRoom.teams[teamIndex].score;

  return { ok: true, alreadySolvedPersonally: false, countedForTeam, teamScore, teamIndex };
}
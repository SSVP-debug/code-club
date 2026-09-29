import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/BattleRoom.js", () => ({
  default: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

import BattleRoom from "../models/BattleRoom.js";
import {
  awardBattleRoomSolve,
  BATTLE_ROOM_SOLVE_REJECTION,
  BATTLE_ROOM_SOLVE_SCORE,
} from "./battleRoomScoring.js";

function makeRoom(overrides = {}) {
  const now = Date.now();
  return {
    _id: "room1",
    status: "active",
    endsAt: new Date(now + 60_000),
    problemSlugs: ["two-sum"],
    roster: [{ userId: { toString: () => "user1" }, teamIndex: 0, solvedSlugs: [] }],
    teams: [{ name: "Team Alpha", score: 0, solvedSlugs: [] }, { name: "Team Beta", score: 0, solvedSlugs: [] }],
    ...overrides,
  };
}

// BattleRoom.findById is called two different ways in battleRoomScoring.js:
// once directly awaited, and once chained with `.lean()` (in the
// "already solved" fallback). Same helper shape as contestScoring.test.js's
// findByIdResult, for the identical reason.
function findByIdResult(value) {
  return {
    lean: () => Promise.resolve(value),
    then: (resolve) => resolve(value),
  };
}

describe("awardBattleRoomSolve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when the Battle Room doesn't exist", async () => {
    BattleRoom.findById.mockResolvedValue(null);

    const result = await awardBattleRoomSolve({ battleRoomId: "nope", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({ ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_FOUND });
    expect(BattleRoom.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the room is still in the lobby (never started)", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoom({ status: "lobby", endsAt: null }));

    const result = await awardBattleRoomSolve({ battleRoomId: "room1", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({ ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_ACTIVE });
  });

  it("rejects when the room's endsAt has already passed, even if status still reads 'active'", async () => {
    const now = Date.now();
    BattleRoom.findById.mockResolvedValue(makeRoom({ status: "active", endsAt: new Date(now - 60_000) }));

    const result = await awardBattleRoomSolve({ battleRoomId: "room1", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({ ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_ACTIVE });
  });

  it("rejects when the slug doesn't belong to this Battle Room", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoom({ problemSlugs: ["some-other-problem"] }));

    const result = await awardBattleRoomSolve({ battleRoomId: "room1", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({ ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_IN_ROOM });
    expect(BattleRoom.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the user never joined this Battle Room", async () => {
    BattleRoom.findById.mockResolvedValue(
      makeRoom({ roster: [{ userId: { toString: () => "someone-else" }, teamIndex: 0, solvedSlugs: [] }] })
    );

    const result = await awardBattleRoomSolve({ battleRoomId: "room1", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({ ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_PARTICIPANT });
    expect(BattleRoom.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the user joined but hasn't been assigned to a team yet", async () => {
    BattleRoom.findById.mockResolvedValue(
      makeRoom({ roster: [{ userId: { toString: () => "user1" }, teamIndex: null, solvedSlugs: [] }] })
    );

    const result = await awardBattleRoomSolve({ battleRoomId: "room1", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({ ok: false, reason: BATTLE_ROOM_SOLVE_REJECTION.NOT_ON_TEAM });
    expect(BattleRoom.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("awards personal + team credit atomically for the first teammate to solve a problem", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoom());
    // Step 1: personal solve recorded.
    BattleRoom.findOneAndUpdate.mockResolvedValueOnce({
      roster: [{ userId: { toString: () => "user1" }, teamIndex: 0, solvedSlugs: ["two-sum"] }],
    });
    // Step 2: first teammate — team update succeeds.
    BattleRoom.findOneAndUpdate.mockResolvedValueOnce({
      teams: [{ score: BATTLE_ROOM_SOLVE_SCORE, solvedSlugs: ["two-sum"] }, { score: 0, solvedSlugs: [] }],
    });

    const result = await awardBattleRoomSolve({ battleRoomId: "room1", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({
      ok: true,
      alreadySolvedPersonally: false,
      countedForTeam: true,
      teamScore: BATTLE_ROOM_SOLVE_SCORE,
      teamIndex: 0,
    });
    expect(BattleRoom.findOneAndUpdate).toHaveBeenCalledTimes(2);
    const [personalFilter, , teamFilter] = BattleRoom.findOneAndUpdate.mock.calls;
    expect(personalFilter[0]).toEqual(expect.objectContaining({
      _id: "room1",
      status: "active",
      endsAt: expect.objectContaining({ $gt: expect.any(Date) }),
    }));
    expect(teamFilter[0]).toEqual(expect.objectContaining({
      _id: "room1",
      status: "active",
      endsAt: expect.objectContaining({ $gt: expect.any(Date) }),
    }));
  });

  it("rechecks the active deadline at the atomic write boundary", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoom());
    BattleRoom.findOneAndUpdate.mockResolvedValue(null);

    const result = await awardBattleRoomSolve({
      battleRoomId: "room1",
      userId: "user1",
      slug: "two-sum",
    });

    expect(result.ok).toBe(true);
    expect(BattleRoom.findOneAndUpdate).toHaveBeenCalledOnce();
    expect(BattleRoom.findOneAndUpdate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        status: "active",
        endsAt: expect.objectContaining({ $gt: expect.any(Date) }),
      })
    );
  });

  it("reasserts the deadline before awarding team score", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoom());
    BattleRoom.findOneAndUpdate
      .mockResolvedValueOnce({
        roster: [{ userId: { toString: () => "user1" }, teamIndex: 0, solvedSlugs: ["two-sum"] }],
      })
      .mockResolvedValueOnce(null);

    const result = await awardBattleRoomSolve({
      battleRoomId: "room1",
      userId: "user1",
      slug: "two-sum",
    });

    expect(result.ok).toBe(true);
    expect(result.countedForTeam).toBe(false);
    expect(BattleRoom.findOneAndUpdate.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        _id: "room1",
        status: "active",
        endsAt: expect.objectContaining({ $gt: expect.any(Date) }),
      })
    );
  });

  it("does not double-award team score when a teammate already solved this slug", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoom());
    BattleRoom.findOneAndUpdate.mockResolvedValueOnce({
      roster: [{ userId: { toString: () => "user1" }, teamIndex: 0, solvedSlugs: ["two-sum"] }],
      teams: [{ score: BATTLE_ROOM_SOLVE_SCORE, solvedSlugs: ["two-sum"] }, { score: 0, solvedSlugs: [] }],
    });
    // Step 2: filter fails — a teammate already solved this slug first.
    BattleRoom.findOneAndUpdate.mockResolvedValueOnce(null);

    const result = await awardBattleRoomSolve({ battleRoomId: "room1", userId: "user1", slug: "two-sum" });

    expect(result.ok).toBe(true);
    expect(result.alreadySolvedPersonally).toBe(false);
    expect(result.countedForTeam).toBe(false);
  });

  it("is idempotent: a duplicate Accepted for an already-solved slug reports alreadySolvedPersonally, not a second award", async () => {
    BattleRoom.findById.mockReturnValueOnce(findByIdResult(makeRoom()));
    // Step 1 filter fails — already personally solved.
    BattleRoom.findOneAndUpdate.mockResolvedValue(null);
    BattleRoom.findById.mockReturnValueOnce(
      findByIdResult(
        makeRoom({
          roster: [{ userId: { toString: () => "user1" }, teamIndex: 0, solvedSlugs: ["two-sum"] }],
          teams: [{ name: "Team Alpha", score: BATTLE_ROOM_SOLVE_SCORE, solvedSlugs: ["two-sum"] }, { name: "Team Beta", score: 0, solvedSlugs: [] }],
        })
      )
    );

    const result = await awardBattleRoomSolve({ battleRoomId: "room1", userId: "user1", slug: "two-sum" });

    expect(result).toEqual({
      ok: true,
      alreadySolvedPersonally: true,
      countedForTeam: false,
      teamScore: BATTLE_ROOM_SOLVE_SCORE,
      teamIndex: 0,
    });
    // Exactly one attempted write — no silent second award behind the scenes.
    expect(BattleRoom.findOneAndUpdate).toHaveBeenCalledOnce();
  });

  it("treats a lost race on the personal-solve atomic update as a successful no-op, not an error", async () => {
    BattleRoom.findById.mockReturnValueOnce(findByIdResult(makeRoom()));
    BattleRoom.findOneAndUpdate.mockResolvedValue(null); // lost the race
    BattleRoom.findById.mockReturnValueOnce(
      findByIdResult(
        makeRoom({ roster: [{ userId: { toString: () => "user1" }, teamIndex: 0, solvedSlugs: ["two-sum"] }] })
      )
    );

    const result = await awardBattleRoomSolve({ battleRoomId: "room1", userId: "user1", slug: "two-sum" });

    expect(result.ok).toBe(true);
    expect(result.alreadySolvedPersonally).toBe(true);
  });
});
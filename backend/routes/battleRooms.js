import { Router } from "express";
import { logger } from "../config/logger.js";
import crypto from "crypto";
import BattleRoom from "../models/BattleRoom.js";
import Problem from "../models/Problem.js";
import Submission from "../models/Submission.js";
import { requireRole } from "../middleware/roleGuard.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { awardBattleRoomSolve } from "../services/battleRoomScoring.js";

const router = Router();

// ── :id validation ───────────────────────────────────────────────────────
// A malformed id (wrong length/characters) previously fell through to
// Mongoose, which throws a CastError that Express turns into an unhandled
// 500 — a client bug (typo'd/truncated id) looked identical to a real
// server failure. Same loose-shape check judge.js already uses for
// contestId/battleRoomId; not full ObjectId semantics, just "could this
// possibly be one," which is all a 400-vs-500 distinction needs.
router.param("id", (req, res, next, id) => {
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ error: "Invalid Battle Room id." });
  }
  next();
});

// Mirrors the confirmed private-contest guardrails (Phase 12B) — same
// spirit, own limits, since Battle Rooms are a separate hosting slot.
const STUDENT_ROOM_LIMITS = {
  MAX_PROBLEMS:     8,
  MIN_TEAM_SIZE:    2,
  MAX_TEAM_SIZE:    6,
  MIN_DURATION_MS:  30 * 60 * 1000,
  MAX_DURATION_MS:  4 * 60 * 60 * 1000,
};

const TEAM_NAMES = ["Team Alpha", "Team Beta"];

function genInviteCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

// ── POST /api/battle-rooms — create a room (lobby state) ───────────────────
router.post("/", requireAuth, requireRole("student", "tpo", "admin"), async (req, res) => {
  try {
    const { title, description, problemSlugs, durationMinutes, maxTeamSize } = req.body;
    const isStudent = req.userDoc.role === "student";

    if (!title?.trim() || !problemSlugs?.length || !durationMinutes) {
      return res.status(400).json({ error: "title, problemSlugs, and durationMinutes are required." });
    }

    let teamSize = Number(maxTeamSize) || 4;
    let durationMs = Number(durationMinutes) * 60 * 1000;

    if (isStudent) {
      if (problemSlugs.length > STUDENT_ROOM_LIMITS.MAX_PROBLEMS) {
        return res.status(400).json({ error: `Battle Rooms can have at most ${STUDENT_ROOM_LIMITS.MAX_PROBLEMS} problems.` });
      }
      if (durationMs < STUDENT_ROOM_LIMITS.MIN_DURATION_MS || durationMs > STUDENT_ROOM_LIMITS.MAX_DURATION_MS) {
        return res.status(400).json({ error: "Match duration must be between 30 minutes and 4 hours." });
      }
      teamSize = Math.min(
        Math.max(teamSize, STUDENT_ROOM_LIMITS.MIN_TEAM_SIZE),
        STUDENT_ROOM_LIMITS.MAX_TEAM_SIZE
      );

      // One active/lobby hosted Battle Room at a time — a separate slot
      // from private contests (confirmed), so this only checks other
      // Battle Rooms this student is hosting, not their contests.
      const now = new Date();
      const existingActive = await BattleRoom.findOne({
        createdBy: req.userDoc._id,
        $or: [
          { status: "lobby" },
          { status: "active", endsAt: { $gt: now } },
          // An active room without endsAt is malformed, but fail closed:
          // keep it blocking rather than accidentally allowing overlap.
          { status: "active", endsAt: null },
        ],
      }).lean();
      if (existingActive) {
        return res.status(409).json({
          error: "You already have an active or in-progress Battle Room. It must end before you can host another.",
        });
      }
    }

    const found = await Problem.countDocuments({ slug: { $in: problemSlugs } });
    if (found !== problemSlugs.length) {
      return res.status(400).json({ error: "One or more problem slugs are invalid." });
    }

    const room = await BattleRoom.create({
      title: title.trim(),
      description: description?.trim() || "",
      createdBy: req.userDoc._id,
      inviteCode: genInviteCode(),
      problemSlugs,
      maxTeamSize: teamSize,
      durationMs,
      roster: [],
      teams: TEAM_NAMES.map((name) => ({ name, score: 0, solvedSlugs: [] })),
    });

    return res.status(201).json(room.toObject());
  } catch (err) {
    (req.log || logger).error({ err }, "[BattleRoom] create");
    return res.status(500).json({ error: "Failed to create Battle Room." });
  }
});

// ── POST /api/battle-rooms/join — join the lobby via invite code ───────────
// Integration-audit fix, take 2: this used to be a plain read →
// roster.push() → .save(). A first pass replaced that with a bounded
// optimistic retry on Mongoose's VersionError, on the (source-code-
// verified) assumption that .save() version-checks array-push updates.
// A real local Mongo run disproved that in practice — two genuinely
// concurrent joins for the last open slot both landed ("2 joined", never
// a VersionError on either side), meaning MongoDB's $push itself has no
// precondition and happily accepts two concurrent pushes past whatever
// capacity was true at each request's own read time. Optimistic retry
// only helps if the LOSING write is actually rejected; here neither write
// was ever rejected, so there was nothing to retry.
// Real fix: a single atomic, conditional MongoDB update. The capacity
// check ($expr comparing roster size against maxTeamSize*2), the
// already-joined check ($ne on roster.userId), and the $push itself are
// all evaluated by MongoDB as ONE atomic per-document operation — not
// read-then-decide-then-write in application code. Two concurrent
// requests for the same last slot are serialized by MongoDB's own
// per-document handling: at most one filter can still match by the time
// each is evaluated, so at most one $push can land. This mirrors the
// atomic-update pattern already used in services/battleRoomScoring.js and
// services/contestScoring.js. See
// routes/battleRoomsJoin.concurrency.integration.test.js for the
// regression coverage (now asserting on the real fix, not the retry).
router.post("/join", requireAuth, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: "inviteCode required." });

    const room = await BattleRoom.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!room) return res.status(404).json({ error: "Invalid invite code." });
    if (room.status !== "lobby") {
      return res.status(400).json({ error: "This Battle Room has already started or ended." });
    }

    const alreadyJoined = room.roster.some((r) => r.userId.toString() === req.userDoc._id.toString());
    if (alreadyJoined) {
      return res.json({ alreadyJoined: true, roomId: room._id });
    }

    const updated = await BattleRoom.findOneAndUpdate(
      {
        _id: room._id,
        status: "lobby",
        "roster.userId": { $ne: req.userDoc._id },
        $expr: { $lt: [{ $size: "$roster" }, { $multiply: ["$maxTeamSize", 2] }] },
      },
      {
        $push: {
          roster: {
            userId: req.userDoc._id,
            username: req.userDoc.username,
            displayName: req.userDoc.displayName,
            teamIndex: null,
            solvedSlugs: [],
          },
        },
      },
      { new: true }
    );

    if (updated) {
      return res.json({ success: true, roomId: updated._id, title: updated.title });
    }

    // The atomic filter matched nothing — someone else's concurrent write
    // (a join that took the last slot, a status change, etc.) landed
    // first. This re-read is purely to report the correct, specific
    // reason; it has no bearing on correctness — that was already fully
    // decided by the atomic step above.
    const current = await BattleRoom.findById(room._id).lean();
    if (!current) return res.status(404).json({ error: "Invalid invite code." });
    if (current.status !== "lobby") {
      return res.status(400).json({ error: "This Battle Room has already started or ended." });
    }
    const nowJoined = current.roster.some((r) => r.userId.toString() === req.userDoc._id.toString());
    if (nowJoined) {
      return res.json({ alreadyJoined: true, roomId: current._id });
    }
    return res.status(409).json({ error: "This Battle Room is full." });
  } catch (err) {
    (req.log || logger).error({ err }, "[BattleRoom] join");
    return res.status(500).json({ error: "Failed to join Battle Room." });
  }
});

// ── POST /api/battle-rooms/:id/assign-teams — host assigns roster to teams ─
router.post("/:id/assign-teams", requireAuth, async (req, res) => {
  try {
    const room = await BattleRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Battle Room not found." });
    if (room.createdBy.toString() !== req.userDoc._id.toString()) {
      return res.status(403).json({ error: "Only the host can assign teams." });
    }
    if (room.status !== "lobby") {
      return res.status(400).json({ error: "Teams can only be assigned before the match starts." });
    }

    const { mode, assignments } = req.body;

    // Build the complete proposed roster from the snapshot we just read.
    // The final write below is a single conditional MongoDB operation.
    // updatedAt acts as the optimistic-concurrency token: if another host
    // action, join, or leave changed the room after this read, this write
    // matches nothing instead of overwriting their roster changes.
    const proposedRoster = room.roster.map((member) => ({ ...member }));
    const setOps = {};

    if (mode === "random") {
      // Fisher–Yates shuffle, then alternate 0/1/0/1... — keeps team sizes
      // within 1 of each other regardless of roster size.
      const shuffled = [...proposedRoster];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      shuffled.forEach((member, i) => {
        const rosterIndex = proposedRoster.findIndex(
          (r) => r.userId.toString() === member.userId.toString()
        );
        proposedRoster[rosterIndex].teamIndex = i % 2;
        setOps[`roster.${rosterIndex}.teamIndex`] = i % 2;
      });
    } else if (mode === "manual") {
      if (!Array.isArray(assignments)) {
        return res.status(400).json({ error: "assignments array required for manual mode." });
      }
      for (const { userId, teamIndex } of assignments) {
        if (teamIndex !== null && teamIndex !== 0 && teamIndex !== 1) {
          return res.status(400).json({ error: "teamIndex must be 0, 1, or null." });
        }
        const rosterIndex = proposedRoster.findIndex(
          (r) => r.userId.toString() === String(userId)
        );
        if (rosterIndex !== -1) {
          proposedRoster[rosterIndex].teamIndex = teamIndex;
          setOps[`roster.${rosterIndex}.teamIndex`] = teamIndex;
        }
      }
    } else {
      return res.status(400).json({ error: 'mode must be "random" or "manual".' });
    }

    // Validate the final proposed state, not each individual assignment.
    // This preserves the existing rebalancing behavior where a host can
    // move several people in one request without temporarily exceeding
    // the team cap.
    for (const idx of [0, 1]) {
      const count = proposedRoster.filter((r) => r.teamIndex === idx).length;
      if (count > room.maxTeamSize) {
        return res.status(400).json({ error: `${room.teams[idx].name} would exceed the ${room.maxTeamSize}-person cap.` });
      }
    }

    const updated = await BattleRoom.findOneAndUpdate(
      {
        _id: room._id,
        createdBy: req.userDoc._id,
        status: "lobby",
        updatedAt: room.updatedAt,
      },
      { $set: setOps },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: "Battle Room changed while assigning teams. Refresh and try again.",
      });
    }

    return res.json(updated.toObject());
  } catch (err) {
    (req.log || logger).error({ err }, "[BattleRoom] assign-teams");
    return res.status(500).json({ error: "Failed to assign teams." });
  }
});

// ── POST /api/battle-rooms/:id/start — host starts the match ───────────────
router.post("/:id/start", requireAuth, async (req, res) => {
  try {
    const room = await BattleRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Battle Room not found." });
    if (room.createdBy.toString() !== req.userDoc._id.toString()) {
      return res.status(403).json({ error: "Only the host can start the match." });
    }
    if (room.status !== "lobby") {
      return res.status(400).json({ error: "This match has already started." });
    }

    const teamCounts = [0, 1].map((idx) => room.roster.filter((r) => r.teamIndex === idx).length);
    if (teamCounts[0] === 0 || teamCounts[1] === 0) {
      return res.status(400).json({ error: "Both teams need at least one member before starting." });
    }

    const now = new Date();
    room.status = "active";
    room.startsAt = now;
    room.endsAt = new Date(now.getTime() + room.durationMs);
    await room.save();

    return res.json(room.toObject());
  } catch (err) {
    (req.log || logger).error({ err }, "[BattleRoom] start");
    return res.status(500).json({ error: "Failed to start match." });
  }
});

// ── GET /api/battle-rooms/mine — rooms the caller created or joined ────────
// Registered before /:id — same reason as Contest's /mine route.
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const rooms = await BattleRoom.find({
      $or: [{ createdBy: req.userDoc._id }, { "roster.userId": req.userDoc._id }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("title status startsAt endsAt teams roster createdBy")
      .lean();

    const mine = rooms.map((r) => {
      const myEntry = r.roster.find((m) => m.userId.toString() === req.userDoc._id.toString());
      const myTeam = myEntry?.teamIndex != null ? r.teams[myEntry.teamIndex] : null;
      return {
        _id: r._id,
        title: r.title,
        status: r.status,
        isHost: r.createdBy.toString() === req.userDoc._id.toString(),
        myTeamName: myTeam?.name ?? null,
        myTeamScore: myTeam?.score ?? null,
      };
    });

    return res.json({ rooms: mine });
  } catch (err) {
    (req.log || logger).error({ err }, "[BattleRoom] mine");
    return res.status(500).json({ error: "Failed to load your Battle Rooms." });
  }
});

// ── GET /api/battle-rooms/:id — detail + poll target ────────────────────────
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const room = await BattleRoom.findById(req.params.id).lean();
    if (!room) return res.status(404).json({ error: "Battle Room not found." });

    // Expiry is a terminal lifecycle transition. Persist active -> ended
    // when the room is first read after its deadline, while keeping the
    // status filter on the write so concurrent readers are harmless.
    const now = new Date();
    const hasExpired =
      room.status === "active" && room.endsAt && now >= new Date(room.endsAt);

    if (hasExpired) {
      // Persist the terminal lifecycle transition. The status filter makes
      // this safe when multiple readers notice expiry at the same time:
      // exactly one request performs the active -> ended write.
      await BattleRoom.findOneAndUpdate(
        { _id: room._id, status: "active", endsAt: { $lte: now } },
        { $set: { status: "ended" } },
        { returnDocument: "after" }
      );
      room.status = "ended";
    }

    const myId = req.userDoc?._id?.toString();
    const isHost = Boolean(myId && room.createdBy.toString() === myId);
    const myEntry = myId ? room.roster.find((r) => r.userId.toString() === myId) : null;

    // This endpoint is intentionally public, so never spread the raw
    // Mongo document into the response. In particular, inviteCode and
    // internal user IDs must not be exposed to arbitrary viewers.
    // The host still receives inviteCode/userId because those fields are
    // required for the host-only lobby controls.
    const roster = room.roster.map((member) => ({
      ...(isHost ? { userId: member.userId } : {}),
      displayName: member.displayName,
      teamIndex: member.teamIndex,
      solvedSlugs: member.solvedSlugs ?? [],
    }));

    return res.json({
      _id: room._id,
      title: room.title,
      description: room.description,
      status: room.status,
      problemSlugs: room.problemSlugs,
      maxTeamSize: room.maxTeamSize,
      durationMs: room.durationMs,
      startsAt: room.startsAt,
      endsAt: room.endsAt,
      teams: room.teams,
      roster,
      ...(isHost ? { inviteCode: room.inviteCode } : {}),
      isHost,
      myTeamIndex: myEntry?.teamIndex ?? null,
      mySolvedSlugs: myEntry?.solvedSlugs ?? [],
      isJoined: Boolean(myEntry),
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[BattleRoom] detail");
    return res.status(500).json({ error: "Failed to load Battle Room." });
  }
});

// ── POST /api/battle-rooms/:id/solve — legacy compat solve endpoint ────────
// This used to award team credit purely on the strength of a client-sent
// `{ slug }` — no proof the caller ever actually solved anything. That is
// no longer true.
//
// The real, trusted scoring path is now controllers/judgeController.js's
// submitHandler, which calls services/battleRoomScoring.js's
// awardBattleRoomSolve() itself, immediately after computing a real
// Accepted verdict — see that file (and src/hooks/useProblemSolver.js,
// which sends battleRoomId directly on POST /api/judge/submit as of the
// same change, so this route is no longer the primary path). This
// endpoint is kept only for any caller that hasn't migrated. It is NOT a
// second, independent way to score: before calling the same
// awardBattleRoomSolve(), it first requires proof — a real Submission
// document, written by the judge itself, showing this exact user was
// Accepted on this exact problem in this exact Battle Room. No such
// Submission exists → no credit, full stop. A forged `{ slug: "...",
// status: "Accepted" }` body with no matching Submission is rejected here
// exactly like it always was for the contest equivalent.
router.post("/:id/solve", requireAuth, async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: "slug required." });

    const proof = await Submission.exists({
      userId: req.userDoc._id,
      problemSlug: slug,
      battleRoomId: req.params.id,
      status: "Accepted",
    });

    if (!proof) {
      return res.status(403).json({
        error: "No verified Accepted submission found for this problem in this Battle Room.",
      });
    }

    const result = await awardBattleRoomSolve({
      battleRoomId: req.params.id,
      userId: req.userDoc._id,
      slug,
    });

    if (!result.ok) {
      const statusByReason = {
        battle_room_not_found: 404,
        battle_room_not_active: 400,
        problem_not_in_battle_room: 400,
        not_joined: 403,
        not_on_team: 403,
      };
      return res
        .status(statusByReason[result.reason] ?? 400)
        .json({ error: "Unable to record Battle Room solve.", reason: result.reason });
    }

    return res.json({
      success: !result.alreadySolvedPersonally,
      alreadySolvedPersonally: result.alreadySolvedPersonally,
      countedForTeam: result.countedForTeam,
      teamScore: result.teamScore,
      teamIndex: result.teamIndex,
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[BattleRoom] solve");
    return res.status(500).json({ error: "Failed to record solve." });
  }
});

// ── POST /api/battle-rooms/:id/leave — a joined participant leaves ─────────
// Only while the room is still in the lobby — once a match starts, leaving
// mid-battle would strand a team a member down with no rule for how to
// handle that (no such rule was specified, so none is invented here; see
// PHASE 8/PART A8 of the readiness review). The host can't use this route
// at all — hosting comes with the one-active-room-at-a-time limit, so a
// host who wants out cancels the room instead (see DELETE /:id below),
// which is what actually frees that slot.
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const room = await BattleRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Battle Room not found." });

    if (room.createdBy.toString() === req.userDoc._id.toString()) {
      return res.status(400).json({
        error: "You're hosting this room — cancel it instead of leaving.",
      });
    }
    if (room.status !== "lobby") {
      return res.status(400).json({ error: "You can only leave a Battle Room before the match starts." });
    }

    const before = room.roster.length;
    room.roster = room.roster.filter((r) => r.userId.toString() !== req.userDoc._id.toString());
    if (room.roster.length === before) {
      return res.status(400).json({ error: "You haven't joined this Battle Room." });
    }

    await room.save();
    return res.json({ success: true });
  } catch (err) {
    (req.log || logger).error({ err }, "[BattleRoom] leave");
    return res.status(500).json({ error: "Failed to leave Battle Room." });
  }
});

// ── DELETE /api/battle-rooms/:id — host cancels a lobby room ───────────────
// Host-only, lobby-only (an active/ended match isn't cancelled — no rule
// was specified for abandoning a live match, so none is invented here).
// This is what frees the one-active-room-at-a-time slot for a host whose
// room never filled up or never got started. Safe to hard-delete: nothing
// of value exists yet at the lobby stage — no scores, no submissions tied
// to this room could exist (Battle Room submissions are only ever scored
// while status is "active", so an Accepted Submission can never reference
// a room that's still in "lobby").
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const room = await BattleRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Battle Room not found." });
    if (room.createdBy.toString() !== req.userDoc._id.toString()) {
      return res.status(403).json({ error: "Only the host can cancel this Battle Room." });
    }
    if (room.status !== "lobby") {
      return res.status(400).json({ error: "Only a room still in its lobby can be cancelled." });
    }

    await BattleRoom.deleteOne({ _id: req.params.id });
    return res.json({ success: true });
  } catch (err) {
    (req.log || logger).error({ err }, "[BattleRoom] cancel");
    return res.status(500).json({ error: "Failed to cancel Battle Room." });
  }
});

export default router;
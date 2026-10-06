import { Router } from "express";
import crypto from "crypto";
import Contest from "../models/Contest.js";
import ContestParticipant from "../models/ContestParticipant.js";
import Problem from "../models/Problem.js";
import Submission from "../models/Submission.js";
import { requireRole } from "../middleware/roleGuard.js";
import { requireAuth } from "../middleware/auth.js";
import { getOrSetCache } from "../utils/cache.js";
import { awardContestSolve } from "../services/contestScoring.js";

const router = Router();

function contestStatus(contest) {
  const now = new Date();
  if (now < new Date(contest.startsAt)) return "upcoming";
  if (now > new Date(contest.endsAt)) return "ended";
  return "active";
}

function rankParticipants(participants) {
  return [...participants]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0)
      || new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      || a._id.toString().localeCompare(b._id.toString()))
    .map((participant, index) => ({ ...participant, rank: index + 1 }));
}

async function participantCounts(contestIds) {
  if (!contestIds.length) return new Map();
  const rows = await ContestParticipant.aggregate([
    { $match: { contestId: { $in: contestIds } } },
    { $group: { _id: "$contestId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

// ── GET /api/contests ─────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status = "active,upcoming", type = "public" } = req.query;
    const statuses = status.split(",");
    const cacheKey = `contests:list:${status}:${type}`;

    const { value: result, cacheStatus } = await getOrSetCache(cacheKey, 30, async () => {
      const contests = await Contest.find({
        type: type === "all" ? { $in: ["public", "private"] } : type,
        status: { $in: statuses },
      })
        .select("title description type status startsAt endsAt problemSlugs createdBy")
        .sort({ startsAt: 1 })
        .limit(50)
        .lean();

      const counts = await participantCounts(contests.map((contest) => contest._id));
      const now = new Date();

      return contests.map((contest) => {
        const isUpcoming = now < new Date(contest.startsAt);
        return {
          ...contest,
          participantCount: counts.get(contest._id.toString()) || 0,
          problemCount: contest.problemSlugs?.length ?? 0,
          problemSlugs: isUpcoming ? undefined : contest.problemSlugs,
          isActive: now >= new Date(contest.startsAt) && now <= new Date(contest.endsAt),
        };
      });
    });

    res.set("X-Cache", cacheStatus);
    return res.json({ contests: result });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load contests." });
  }
});

// ── POST /api/contests — create public contest (admin/tpo) ────────────────────
router.post("/", requireRole("admin", "tpo"), async (req, res) => {
  try {
    const { title, description, problemSlugs, startsAt, endsAt } = req.body;
    if (!title || !problemSlugs?.length || !startsAt || !endsAt) {
      return res.status(400).json({ error: "title, problemSlugs, startsAt, endsAt required." });
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      return res.status(400).json({ error: "endsAt must be after startsAt." });
    }

    const found = await Problem.countDocuments({ slug: { $in: problemSlugs } });
    if (found !== problemSlugs.length) {
      return res.status(400).json({ error: "One or more problem slugs are invalid." });
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const now = new Date();
    const contest = await Contest.create({
      title,
      description: description || "",
      type: "public",
      status: now < start ? "upcoming" : now > end ? "ended" : "active",
      createdBy: req.userDoc._id,
      startsAt: start,
      endsAt: end,
      durationMs: end - start,
      problemSlugs,
    });

    return res.status(201).json(contest);
  } catch (err) {
    console.error("[Contest] create:", err.message);
    return res.status(500).json({ error: "Failed to create contest." });
  }
});

const STUDENT_CONTEST_LIMITS = {
  MAX_PROBLEMS: 8,
  MAX_PARTICIPANTS: 100,
  MIN_DURATION_MS: 30 * 60 * 1000,
  MAX_DURATION_MS: 4 * 60 * 60 * 1000,
};

// ── POST /api/contests/private — create private contest ───────────────────────
router.post("/private", requireRole("student", "tpo", "admin"), async (req, res) => {
  try {
    const { title, description, problemSlugs, startsAt, endsAt } = req.body;
    const isStudent = req.userDoc.role === "student";
    if (!title || !problemSlugs?.length || !startsAt || !endsAt) {
      return res.status(400).json({ error: "title, problemSlugs, startsAt, endsAt required." });
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const now = new Date();
    if (end <= start) return res.status(400).json({ error: "endsAt must be after startsAt." });

    let maxParticipants = null;
    let allowLateJoin = true;
    if (isStudent) {
      if (!req.userDoc.education?.emailVerified) {
        return res.status(403).json({ error: "Verify your college email before hosting a contest.", code: "HOST_NOT_VERIFIED" });
      }

      const durationMs = end - start;
      if (durationMs < STUDENT_CONTEST_LIMITS.MIN_DURATION_MS || durationMs > STUDENT_CONTEST_LIMITS.MAX_DURATION_MS) {
        return res.status(400).json({ error: "Contest duration must be between 30 minutes and 4 hours." });
      }
      if (problemSlugs.length > STUDENT_CONTEST_LIMITS.MAX_PROBLEMS) {
        return res.status(400).json({ error: `Hosted contests can have at most ${STUDENT_CONTEST_LIMITS.MAX_PROBLEMS} problems.` });
      }

      const requestedCap = Number(req.body.maxParticipants) || STUDENT_CONTEST_LIMITS.MAX_PARTICIPANTS;
      maxParticipants = Math.min(Math.max(requestedCap, 2), STUDENT_CONTEST_LIMITS.MAX_PARTICIPANTS);
      allowLateJoin = Boolean(req.body.allowLateJoin);

      const existingActive = await Contest.findOne({
        createdBy: req.userDoc._id,
        type: "private",
        status: { $in: ["upcoming", "active"] },
      }).lean();
      if (existingActive) {
        return res.status(409).json({ error: "You already have an active or upcoming hosted contest. It must end before you can host another." });
      }
    }

    const found = await Problem.countDocuments({ slug: { $in: problemSlugs } });
    if (found !== problemSlugs.length) {
      return res.status(400).json({ error: "One or more problem slugs are invalid." });
    }

    let contest;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const inviteCode = crypto.randomBytes(3).toString("hex").toUpperCase();
      try {
        contest = await Contest.create({
          title,
          description: description || "",
          type: "private",
          status: now < start ? "upcoming" : "active",
          createdBy: req.userDoc._id,
          inviteCode,
          collegeDomain: req.userDoc.tpoProfile?.collegeDomain || null,
          startsAt: start,
          endsAt: end,
          durationMs: end - start,
          problemSlugs,
          maxParticipants,
          allowLateJoin,
        });
        break;
      } catch (err) {
        if (err.code === 11000 && err.keyPattern?.inviteCode && attempt < 2) continue;
        throw err;
      }
    }

    return res.status(201).json({ ...contest.toObject(), inviteCode: contest.inviteCode });
  } catch (err) {
    console.error("[Contest] create-private:", err.message);
    return res.status(500).json({ error: "Failed to create private contest." });
  }
});

async function findParticipant(contestId, userId) {
  return ContestParticipant.findOne({ contestId, userId }).lean();
}

// ── POST /api/contests/join-private — join via invite code ────────────────────
router.post("/join-private", async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: "inviteCode required." });

    const contest = await Contest.findOne({ inviteCode: inviteCode.toUpperCase(), type: "private" });
    if (!contest) return res.status(404).json({ error: "Invalid invite code." });

    const status = contestStatus(contest);
    if (status === "ended") return res.status(410).json({ error: "Contest has ended." });

    const existing = await findParticipant(contest._id, req.userDoc._id);
    if (existing) return res.json({ alreadyJoined: true, contestId: contest._id });

    if (contest.maxParticipants) {
      const count = await ContestParticipant.countDocuments({ contestId: contest._id });
      if (count >= contest.maxParticipants) return res.status(409).json({ error: "This contest is full." });
    }
    if (status === "active" && !contest.allowLateJoin) {
      return res.status(403).json({ error: "This contest has already started and isn't accepting late joins." });
    }

    try {
      await ContestParticipant.create({
        contestId: contest._id,
        userId: req.userDoc._id,
        username: req.userDoc.username,
        displayName: req.userDoc.displayName,
        solvedSlugs: [],
        score: 0,
        joinedAt: new Date(),
      });
    } catch (err) {
      if (err.code === 11000) return res.json({ alreadyJoined: true, contestId: contest._id });
      throw err;
    }

    return res.json({ success: true, contestId: contest._id, title: contest.title });
  } catch (err) {
    return res.status(500).json({ error: "Failed to join contest." });
  }
});

// ── GET /api/contests/mine — contests the caller has participated in ──────────
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const mine = await ContestParticipant.find({ userId: req.userDoc._id })
      .sort({ joinedAt: -1 })
      .limit(50)
      .lean();
    const contestIds = mine.map((participant) => participant.contestId);
    if (!contestIds.length) return res.json({ contests: [] });

    const contests = await Contest.find({ _id: { $in: contestIds } })
      .select("title type status startsAt endsAt problemSlugs")
      .lean();
    const contestById = new Map(contests.map((contest) => [contest._id.toString(), contest]));

    // Windowed ranking keeps this endpoint bounded even when a contest has a
    // very large participant set; MongoDB computes the rank before returning
    // only the 50 participant rows belonging to this user.
    const rankedMine = await ContestParticipant.aggregate([
      { $match: { contestId: { $in: contestIds } } },
      {
        $setWindowFields: {
          partitionBy: "$contestId",
          sortBy: { score: -1, joinedAt: 1, _id: 1 },
          output: { rank: { $documentNumber: {} } },
        },
      },
      { $match: { userId: req.userDoc._id } },
      { $project: { contestId: 1, score: 1, solvedSlugs: 1, rank: 1 } },
    ]);
    const rankedByContest = new Map(rankedMine.map((row) => [row.contestId.toString(), row]));

    const history = mine
      .map((participant) => {
        const contest = contestById.get(participant.contestId.toString());
        if (!contest) return null;
        const ranked = rankedByContest.get(participant.contestId.toString()) || participant;
        return {
          _id: contest._id,
          title: contest.title,
          type: contest.type,
          status: contest.status,
          endsAt: contest.endsAt,
          problemCount: contest.problemSlugs.length,
          participantCount: undefined,
          myRank: ranked.rank ?? null,
          myScore: ranked.score ?? 0,
          mySolvedCount: ranked.solvedSlugs?.length ?? 0,
        };
      })
      .filter(Boolean);

    // Fill participant counts in one aggregation rather than materializing
    // every participant document in Node.
    const counts = await participantCounts(contestIds);
    for (const row of history) row.participantCount = counts.get(row._id.toString()) || 0;

    return res.json({ contests: history });
  } catch (err) {
    console.error("[Contest] mine:", err.message);
    return res.status(500).json({ error: "Failed to load your contest history." });
  }
});

// ── GET /api/contests/:id — contest detail + ranked leaderboard ───────────────
router.get("/:id", async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id).select("title description type status createdBy startsAt endsAt problemSlugs inviteCode collegeDomain maxParticipants allowLateJoin createdAt updatedAt").lean();
    if (!contest) return res.status(404).json({ error: "Contest not found." });

    const status = contestStatus(contest);
    const isOrganizer = contest.createdBy?.toString() === req.userDoc?._id?.toString();
    const revealProblems = status !== "upcoming" || isOrganizer;

    const [leaderboardRows, participantCount, mine] = await Promise.all([
      ContestParticipant.find({ contestId: contest._id })
        .sort({ score: -1, joinedAt: 1, _id: 1 })
        .limit(100)
        .lean(),
      ContestParticipant.countDocuments({ contestId: contest._id }),
      req.userDoc?._id ? findParticipant(contest._id, req.userDoc._id) : null,
    ]);

    const leaderboard = leaderboardRows.map((participant, index) => ({ ...participant, rank: index + 1 }));
    const myRank = mine ? await ContestParticipant.countDocuments({
      contestId: contest._id,
      $or: [
        { score: { $gt: mine.score } },
        { score: mine.score, joinedAt: { $lt: mine.joinedAt } },
        { score: mine.score, joinedAt: mine.joinedAt, _id: { $lt: mine._id } },
      ],
    }) + 1 : null;

    return res.json({
      ...contest,
      status,
      problemSlugs: revealProblems ? contest.problemSlugs : undefined,
      problemCount: contest.problemSlugs?.length ?? 0,
      participantCount,
      leaderboard,
      myRank,
      myScore: mine?.score ?? 0,
      mySolvedSlugs: mine?.solvedSlugs ?? [],
      isJoined: !!mine,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load contest." });
  }
});

// ── POST /api/contests/:id/join — join a public contest ──────────────────────
router.post("/:id/join", async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id).select("title type startsAt endsAt");
    if (!contest) return res.status(404).json({ error: "Contest not found." });
    if (contest.type === "private") return res.status(403).json({ error: "Use invite code to join private contests." });

    if (contestStatus(contest) === "ended") return res.status(410).json({ error: "Contest has ended." });
    if (await findParticipant(contest._id, req.userDoc._id)) return res.json({ alreadyJoined: true });

    try {
      await ContestParticipant.create({
        contestId: contest._id,
        userId: req.userDoc._id,
        username: req.userDoc.username,
        displayName: req.userDoc.displayName,
        solvedSlugs: [],
        score: 0,
        joinedAt: new Date(),
      });
    } catch (err) {
      if (err.code === 11000) return res.json({ alreadyJoined: true });
      throw err;
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to join contest." });
  }
});

// ── POST /api/contests/:id/solve — legacy contest-solve endpoint ──────────────
router.post("/:id/solve", async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: "slug required." });

    const proof = await Submission.exists({
      userId: req.userDoc._id,
      problemSlug: slug,
      contestId: req.params.id,
      status: "Accepted",
    });
    if (!proof) {
      return res.status(403).json({ error: "No verified Accepted submission found for this problem in this contest." });
    }

    const result = await awardContestSolve({ contestId: req.params.id, userId: req.userDoc._id, slug });
    if (!result.ok) {
      const statusByReason = {
        contest_not_found: 404,
        contest_not_active: 400,
        problem_not_in_contest: 400,
        not_joined: 403,
      };
      return res.status(statusByReason[result.reason] ?? 400).json({ error: "Unable to record contest solve.", reason: result.reason });
    }

    return res.json({
      success: !result.alreadySolved,
      alreadySolved: result.alreadySolved,
      score: result.score,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to record solve." });
  }
});

export default router;

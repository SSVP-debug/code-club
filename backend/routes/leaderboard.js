import { Router } from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { getOrSetCache, invalidateCachePrefix } from "../utils/cache.js";
import { getLevel } from "../utils/xpLevel.js";

const router = Router();

const CACHE_TTL_SECONDS = 5 * 60;
const GLOBAL_CACHE_PREFIX = "leaderboard:global:";
const COLLEGE_CACHE_PREFIX = "leaderboard:college:";
const DOMAINS_CACHE_KEY = "leaderboard:domains";
const GLOBAL_MAX_RANKED = 500;
const COLLEGE_MAX_RANKED = 100;

function parsePage(query) {
  return Math.max(1, parseInt(query.page, 10) || 1);
}

function parseLimit(query, fallback = 20, max = 50) {
  return Math.min(max, Math.max(1, parseInt(query.limit, 10) || fallback));
}

function publicUserProjection() {
  return {
    username: 1,
    displayName: 1,
    totalXP: 1,
    solvedCount: 1,
    currentStreak: 1,
    solvedDifficulty: 1,
    emailDomain: 1,
    joinedDate: 1,
  };
}

function serializeUser(user, rank, includeCollege = false) {
  const result = {
    rank,
    username:
      user.username ||
      user.displayName?.toLowerCase().replace(/\s+/g, "_") ||
      "anonymous",
    displayName: user.displayName || "Anonymous",
    totalXP: user.totalXP || 0,
    level: getLevel(user.totalXP || 0),
    solvedCount: user.solvedCount || 0,
    currentStreak: user.currentStreak || 0,
    easy: user.solvedDifficulty?.easy || 0,
    medium: user.solvedDifficulty?.medium || 0,
    hard: user.solvedDifficulty?.hard || 0,
  };

  if (includeCollege) {
    result.college = user.emailDomain
      ? user.emailDomain.replace(".ac.in", "").replace(".edu", "")
      : null;
  }

  return result;
}

// ── GET /api/leaderboard/global ─────────────────────────────────────────────
// The old implementation computed solvedCount for every public user before
// sorting, then kept only the top 500. Cache misses therefore scaled with the
// entire public-user collection. This keeps the expensive work bounded.
router.get("/global", async (req, res) => {
  try {
    const page = parsePage(req.query || {});
    const limit = parseLimit(req.query || {});
    const skip = (page - 1) * limit;
    const candidateLimit = Math.min(GLOBAL_MAX_RANKED, skip + limit);
    const cacheKey = `${GLOBAL_CACHE_PREFIX}${page}:${limit}`;

    if (skip >= GLOBAL_MAX_RANKED) {
      return res.json({
        users: [],
        total: 0,
        page,
        limit,
        capped: true,
        hasNext: false,
      });
    }

    const { value: result } = await getOrSetCache(
      cacheKey,
      CACHE_TTL_SECONDS,
      async () => {
        const [total, users] = await Promise.all([
          User.countDocuments({ isProfilePublic: true }),
          User.aggregate([
            { $match: { isProfilePublic: true } },
            // Primary ordering is index-friendly. Only the candidate window
            // reaches the solvedCount calculation below.
            { $sort: { totalXP: -1, _id: 1 } },
            { $limit: candidateLimit },
            {
              $addFields: {
                solvedCount: { $ifNull: ["$solvedCount", 0] },
              },
            },
            // solvedCount remains the secondary ranking criterion.
            { $sort: { totalXP: -1, solvedCount: -1, _id: 1 } },
            { $project: publicUserProjection() },
          ]),
        ]);

        return {
          total,
          users: users.map((user, index) =>
            serializeUser(user, index + 1, true)
          ),
          capped: total > GLOBAL_MAX_RANKED,
        };
      }
    );

    const users = result.users
      .slice(skip, skip + limit)
      .map((user, index) => ({
        ...user,
        rank: skip + index + 1,
      }));

    return res.json({
      users,
      total: result.total,
      page,
      limit,
      capped: result.capped,
      hasNext:
        skip + users.length < Math.min(result.total, GLOBAL_MAX_RANKED),
    });
  } catch (err) {
    req.log.error({ err }, "[Leaderboard] global endpoint failed");
    return res.status(500).json({ error: "Failed to load leaderboard." });
  }
});

// ── GET /api/leaderboard/college — requires a verified college ──────────────
router.get("/college", requireAuth, async (req, res) => {
  try {
    const { emailVerified, collegeStatus } = req.userDoc.education || {};
    if (!emailVerified || collegeStatus !== "verified") {
      return res.status(403).json({
        error:
          collegeStatus === "pending"
            ? "Your college is still being reviewed. You'll get access once it's approved."
            : "Verify your college email to unlock your College Leaderboard.",
        code:
          collegeStatus === "pending"
            ? "COLLEGE_PENDING_REVIEW"
            : "COLLEGE_NOT_VERIFIED",
      });
    }

    const domain = req.userDoc.education.collegeEmail
      ?.split("@")[1]
      ?.toLowerCase();
    if (!domain) {
      return res.status(400).json({ error: "A valid college email is required." });
    }

    const { value: result } = await getOrSetCache(
      `${COLLEGE_CACHE_PREFIX}${domain}`,
      CACHE_TTL_SECONDS,
      async () => {
        const [total, users] = await Promise.all([
          User.countDocuments({ emailDomain: domain, isProfilePublic: true }),
          User.aggregate([
            // emailDomain is persisted and indexed; avoid regex work on email.
            { $match: { emailDomain: domain, isProfilePublic: true } },
            { $sort: { totalXP: -1, _id: 1 } },
            { $limit: COLLEGE_MAX_RANKED },
            {
              $addFields: {
                solvedCount: { $ifNull: ["$solvedCount", 0] },
              },
            },
            { $sort: { totalXP: -1, solvedCount: -1, _id: 1 } },
            { $project: publicUserProjection() },
          ]),
        ]);

        return {
          domain,
          total,
          users: users.map((user, index) => serializeUser(user, index + 1)),
          capped: total > COLLEGE_MAX_RANKED,
        };
      }
    );

    return res.json({
      ...result,
      hasNext: result.total > result.users.length,
    });
  } catch (err) {
    req.log.error({ err }, "[Leaderboard] college endpoint failed");
    return res.status(500).json({ error: "Failed to load college leaderboard." });
  }
});

// ── GET /api/leaderboard/domains ────────────────────────────────────────────
router.get("/domains", async (req, res) => {
  try {
    const { value: domains } = await getOrSetCache(
      DOMAINS_CACHE_KEY,
      CACHE_TTL_SECONDS,
      async () => {
        const rows = await User.aggregate([
          {
            $match: {
              isProfilePublic: true,
              emailDomain: { $exists: true, $ne: null },
            },
          },
          { $group: { _id: "$emailDomain", count: { $sum: 1 } } },
          { $match: { count: { $gte: 2 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 50 },
        ]);

        return rows.map((row) => ({ domain: row._id, count: row.count }));
      }
    );

    return res.json({ domains });
  } catch (err) {
    req.log.error({ err }, "[Leaderboard] domains endpoint failed");
    return res.status(500).json({ error: "Failed to load domains." });
  }
});

export async function invalidateLeaderboardCaches() {
  await invalidateCachePrefix(GLOBAL_CACHE_PREFIX);
  await invalidateCachePrefix(COLLEGE_CACHE_PREFIX);
  await invalidateCachePrefix(DOMAINS_CACHE_KEY);
}

export default router;

/**
 * Admin-wide analytics endpoints.
 *
 * Scalability rule: never materialize an unbounded timestamp collection in Node.
 * Trend endpoints aggregate only their bounded reporting window in MongoDB.
 */
import User from "../models/User.js";
import Problem from "../models/Problem.js";
import ProblemStats from "../models/ProblemStats.js";
import Submission from "../models/Submission.js";
import { bucketByPeriod, DEFAULT_PERIODS } from "../utils/timeBuckets.js";
import { logger } from "../config/logger.js";

const VALID_BUCKETS = ["daily", "weekly", "monthly"];

function resolveBucket(req) {
  const bucket = req.query.bucket || "daily";
  return VALID_BUCKETS.includes(bucket) ? bucket : "daily";
}

async function aggregateTimeTrend(Model, bucket, dateField = "createdAt", now = new Date()) {
  const templates = bucketByPeriod([], bucket, DEFAULT_PERIODS[bucket], now);
  const firstStart = new Date(templates[0].start);
  const lastEnd = new Date(templates[templates.length - 1].end);
  const unit = bucket === "monthly" ? "month" : "day";
  const divisor = bucket === "weekly" ? 7 : 1;
  const datePath = `$${dateField}`;

  const rows = await Model.aggregate([
    { $match: { [dateField]: { $gte: firstStart, $lt: lastEnd } } },
    {
      $group: {
        _id: {
          $floor: {
            $divide: [
              {
                $dateDiff: {
                  startDate: firstStart,
                  endDate: datePath,
                  unit,
                  timezone: "UTC",
                },
              },
              divisor,
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const counts = new Map(rows.map((row) => [Number(row._id), row.count]));
  return templates.map((template, index) => ({ ...template, count: counts.get(index) || 0 }));
}

export async function getRegistrationTrends(req, res) {
  try {
    const bucket = resolveBucket(req);
    // User does not use Mongoose timestamps; joinedDate is the canonical signup timestamp.
    const trend = await aggregateTimeTrend(User, bucket, "joinedDate");
    return res.json({ bucket, trend });
  } catch (err) {
    logger.error({ err }, "[Admin] registration trends error");
    return res.status(500).json({ error: "Failed to load registration trends." });
  }
}

export async function getSubmissionTrends(req, res) {
  try {
    const bucket = resolveBucket(req);
    const trend = await aggregateTimeTrend(Submission, bucket);
    return res.json({ bucket, trend });
  } catch (err) {
    logger.error({ err }, "[Admin] submission trends error");
    return res.status(500).json({ error: "Failed to load submission trends." });
  }
}

export async function getActiveUserTrends(req, res) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const [last7Days, last30Days] = await Promise.all([
      Submission.distinct("userId", { createdAt: { $gte: sevenDaysAgo } }),
      Submission.distinct("userId", { createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    return res.json({ last7Days: last7Days.length, last30Days: last30Days.length });
  } catch (err) {
    logger.error({ err }, "[Admin] active user trends error");
    return res.status(500).json({ error: "Failed to load active user trends." });
  }
}

export async function getRetentionMetric(req, res) {
  try {
    const now = new Date();
    const weekNStart = new Date(now);
    weekNStart.setUTCDate(weekNStart.getUTCDate() - 7);
    const weekN1Start = new Date(now);
    weekN1Start.setUTCDate(weekN1Start.getUTCDate() - 14);

    const [weekNUsers, weekN1Users] = await Promise.all([
      Submission.distinct("userId", { createdAt: { $gte: weekNStart, $lt: now } }),
      Submission.distinct("userId", { createdAt: { $gte: weekN1Start, $lt: weekNStart } }),
    ]);

    const weekN1Set = new Set(weekN1Users.map(String));
    const retainedCount = weekNUsers.filter((id) => weekN1Set.has(String(id))).length;
    const retentionPercent = weekN1Set.size > 0 ? Math.round((retainedCount / weekN1Set.size) * 100) : null;

    return res.json({
      weekN1ActiveUsers: weekN1Set.size,
      weekNActiveUsers: weekNUsers.length,
      retainedUsers: retainedCount,
      retentionPercent,
    });
  } catch (err) {
    logger.error({ err }, "[Admin] retention metric error");
    return res.status(500).json({ error: "Failed to load retention metric." });
  }
}

export async function getProblemPopularity(req, res) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    const [mostSolved, leastSolved, totalCatalogProblems, solvedCatalogProblems] = await Promise.all([
      ProblemStats.find({ accepted: { $gt: 0 } })
        .sort({ accepted: -1, problemSlug: 1 })
        .limit(limit)
        .select("problemSlug accepted -_id")
        .lean(),
      ProblemStats.find({ accepted: { $gt: 0 } })
        .sort({ accepted: 1, problemSlug: 1 })
        .limit(limit)
        .select("problemSlug accepted -_id")
        .lean(),
      Problem.countDocuments({ visibility: { $ne: "contest" } }),
      Problem.aggregate([
        { $match: { visibility: { $ne: "contest" } } },
        {
          $lookup: {
            from: "problemstats",
            localField: "slug",
            foreignField: "problemSlug",
            as: "stats",
          },
        },
        { $match: { "stats.accepted": { $gt: 0 } } },
        { $count: "count" },
      ]),
    ]);

    const slugsNeeded = [...new Set([
      ...mostSolved.map((row) => row.problemSlug),
      ...leastSolved.map((row) => row.problemSlug),
    ])];
    const problems = await Problem.find({ slug: { $in: slugsNeeded } })
      .select("slug title difficulty")
      .lean();
    const problemBySlug = Object.fromEntries(problems.map((p) => [p.slug, p]));

    const withTitles = (rows) => rows
      .filter((row) => problemBySlug[row.problemSlug])
      .map((row) => ({
        slug: row.problemSlug,
        title: problemBySlug[row.problemSlug].title,
        difficulty: problemBySlug[row.problemSlug].difficulty,
        acceptedCount: row.accepted,
      }));

    return res.json({
      mostSolved: withTitles(mostSolved),
      leastSolved: withTitles(leastSolved),
      neverSolvedCount: Math.max(0, totalCatalogProblems - (solvedCatalogProblems[0]?.count || 0)),
    });
  } catch (err) {
    logger.error({ err }, "[Admin] problem popularity error");
    return res.status(500).json({ error: "Failed to load problem popularity." });
  }
}

export async function getLanguagePopularity(req, res) {
  try {
    const grouped = await Submission.aggregate([
      { $group: { _id: "$language", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return res.json({ languages: grouped.map((row) => ({ language: row._id, count: row.count })) });
  } catch (err) {
    logger.error({ err }, "[Admin] language popularity error");
    return res.status(500).json({ error: "Failed to load language popularity." });
  }
}

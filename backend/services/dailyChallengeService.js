import DailyChallengeCompletion from "../models/DailyChallengeCompletion.js";

export async function getDailyChallengeHistory(userId, limit = 100) {
  const rows = await DailyChallengeCompletion.find({ userId })
    .select("date slug completedAt -_id")
    .sort({ date: -1, completedAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 365))
    .lean();

  return rows.map((row) => ({
    date: row.date,
    slug: row.slug,
    completed: true,
    completedAt: row.completedAt,
  }));
}

export async function hasCompletedDailyChallenge(userId, date, slug) {
  return Boolean(await DailyChallengeCompletion.exists({ userId, date, slug }));
}

export async function recordDailyChallengeCompletion(userId, date, slug, completedAt = new Date()) {
  return DailyChallengeCompletion.findOneAndUpdate(
    { userId, date, slug },
    { $setOnInsert: { userId, date, slug, completedAt } },
    { upsert: true, new: true }
  ).lean();
}

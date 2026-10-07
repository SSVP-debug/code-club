import User from "../models/User.js";
import { syncSolvedProblemProgress } from "./problemProgressService.js";

/**
 * Persist progress fields.
 *
 * User remains the compatibility/aggregate store for existing consumers,
 * while UserProblemProgress is the scalable per-user/problem source for
 * future reads. Keeping both writes here gives the migration one stable
 * seam and lets old clients continue working during the rollout.
 */
export async function saveProgress(userId, progress, newSolvedSlugs = []) {
  const userWrite = User.updateOne(
    { _id: userId },
    {
      $set: {
        solvedCount: progress.solvedCount ?? 0,
        topicStats: progress.topicStats,
        solvedDifficulty: progress.solvedDifficulty,
        recentActivity: progress.recentActivity,
        currentStreak: progress.currentStreak,
        longestStreak: progress.longestStreak,
        lastActivityDate: progress.lastActivityDate,
        totalXP: progress.totalXP,
        achievements: progress.achievements,
      },
    }
  );

  const problemWrite = syncSolvedProblemProgress(
    userId,
    newSolvedSlugs,
    new Date()
  );

  const [userResult] = await Promise.all([userWrite, problemWrite]);
  return userResult;
}

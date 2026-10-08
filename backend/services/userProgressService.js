import User from "../models/User.js";
import { syncSolvedProblemProgress } from "./problemProgressService.js";

/**
 * Persist progress fields.
 *
 * User stores only scalar progress aggregates; UserProblemProgress is the
 * authoritative per-user/problem source. This seam keeps aggregate writes
 * atomic while problem-level writes remain normalized.
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

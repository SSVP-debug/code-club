import { ACHIEVEMENTS } from "../config/achievements.js";
import { getLevel } from "../utils/xpLevel.js";
import { topicStatsToObject } from "../utils/topicStats.js";

export function evaluateAchievements(user) {
  const unlocked  = [];
  const existing  = new Set((user.achievements || []).map(a => a.key));
  const solved    = user.solvedCount ?? 0;
  const easy      = user.solvedDifficulty?.easy   ?? 0;
  const medium    = user.solvedDifficulty?.medium  ?? 0;
  const hard      = user.solvedDifficulty?.hard    ?? 0;
  const streak    = user.currentStreak ?? 0;
  const xp        = user.totalXP ?? 0;
  const level     = getLevel(xp);
  const topicMap  = topicStatsToObject(user.topicStats);
  const maxTopic  = Math.max(0, ...Object.values(topicMap));

  function award(key) {
    if (!existing.has(key)) unlocked.push(key);
  }

  // ── Solve milestones ──────────────────────────────────────────────────────
  if (solved >= 1)   award(ACHIEVEMENTS.FIRST_SOLVE);
  if (solved >= 10)  award(ACHIEVEMENTS.SOLVE_10);
  if (solved >= 25)  award(ACHIEVEMENTS.SOLVE_25);
  if (solved >= 50)  award(ACHIEVEMENTS.SOLVE_50);
  if (solved >= 100) award(ACHIEVEMENTS.SOLVE_100);
  if (solved >= 200) award(ACHIEVEMENTS.SOLVE_200);
  if (solved >= 250) award(ACHIEVEMENTS.SOLVE_250);

  // ── Difficulty milestones ─────────────────────────────────────────────────
  if (hard >= 1)   award(ACHIEVEMENTS.FIRST_HARD);
  if (hard >= 10)  award(ACHIEVEMENTS.HARD_10);
  if (hard >= 25)  award(ACHIEVEMENTS.HARD_25);
  if (easy >= 50)  award(ACHIEVEMENTS.EASY_SWEEP);
  if (medium >= 50) award(ACHIEVEMENTS.MEDIUM_MASTER);

  // ── Streak milestones ─────────────────────────────────────────────────────
  if (streak >= 3)   award(ACHIEVEMENTS.STREAK_3);
  if (streak >= 7)   award(ACHIEVEMENTS.STREAK_7);
  if (streak >= 14)  award(ACHIEVEMENTS.STREAK_14);
  if (streak >= 30)  award(ACHIEVEMENTS.STREAK_30);
  if (streak >= 100) award(ACHIEVEMENTS.STREAK_100);

  // ── Topic mastery ─────────────────────────────────────────────────────────
  if (maxTopic >= 10) award(ACHIEVEMENTS.TOPIC_MASTER_10);
  if (maxTopic >= 20) award(ACHIEVEMENTS.TOPIC_MASTER_20);
  if (topicMap["Dynamic Programming"] >= 15) award(ACHIEVEMENTS.DP_LOVER);
  if (topicMap["Graphs"] >= 10)              award(ACHIEVEMENTS.GRAPH_GURU);
  if (topicMap["Trees"] >= 10)               award(ACHIEVEMENTS.TREE_CLIMBER);

  // ── XP / Level milestones ─────────────────────────────────────────────────
  if (xp >= 500)   award(ACHIEVEMENTS.XP_500);
  if (xp >= 1000)  award(ACHIEVEMENTS.XP_1000);
  if (xp >= 5000)  award(ACHIEVEMENTS.XP_5000);
  if (level >= 10) award(ACHIEVEMENTS.LEVEL_10);
  if (level >= 25) award(ACHIEVEMENTS.LEVEL_25);

  // ── Profile complete ──────────────────────────────────────────────────────
  if (user.username && user.isProfilePublic) award(ACHIEVEMENTS.PROFILE_COMPLETE);

  return unlocked;
}
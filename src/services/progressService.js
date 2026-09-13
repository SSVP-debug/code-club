import { apiFetch } from "./api";
import { getSubmissions } from "./submissionService";
import { getStudentDayKey } from "../utils/studentDay";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const toISODate = (dates = []) => [...new Set(dates.filter(d => ISO_DATE.test(d)))];

const DEFAULT_PROGRESS = {
  solvedSlugs: [],
  topicStats: {},
  activityDates: [],
  solvedDifficulty: { easy: 0, medium: 0, hard: 0 },
  recentActivity: [],
  currentStreak: 0,
  longestStreak: 0,
  lastActivityDate: null,
  leetcodeUsername: "",
};

export async function getProgress() {
  try {
    const data = await apiFetch("/api/progress");
    
    return data;
  } catch (err) {
    console.error("[progressService] getProgress failed:", err.message);
    return DEFAULT_PROGRESS;
  }
}

export async function initProgress() {
  return getProgress();
}

export async function markProblemSolved(currentProgress, problemSlug) {
  const solvedSlugs = Array.from(
    new Set([...(currentProgress.solvedSlugs || []), problemSlug])
  );

  const today = getStudentDayKey();
  // ← FIX A: sanitize legacy locale-format dates before they hit Zod
  const activityDates = Array.from(
    new Set([...toISODate(currentProgress.activityDates), today])
  );

  // ← FIX B: don't re-increment — appContext already did it
  const solvedDifficulty = {
    easy: currentProgress.solvedDifficulty?.easy ?? 0,
    medium: currentProgress.solvedDifficulty?.medium ?? 0,
    hard: currentProgress.solvedDifficulty?.hard ?? 0,
  };

  // ← FIX C: pass topicStats through so it persists
  const topicStats = currentProgress.topicStats || {};

  // ← FIX D: pass recentActivity through
  const recentActivity = currentProgress.recentActivity || [];

  // NOTE: totalXP is intentionally NOT included.
  // The backend computes XP server-side from solvedSlugs × difficulty weights.
  // Sending it from the client would be ignored and is a security risk.
  const requestBody = {
    solvedSlugs,
    activityDates,
    solvedDifficulty,
    topicStats,
    recentActivity,
  };

  

  return apiFetch("/api/progress", {
    method: "PUT",
    body: JSON.stringify(requestBody),
  });
}

export async function syncProgressOnLogin() {
  const [progress, submissions] = await Promise.all([getProgress(), getSubmissions()]);
  return { progress, submissions };
}
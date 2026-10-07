import { apiFetch } from "./api";
import { getSubmissions } from "./submissionService";
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

export async function markProblemSolved(_currentProgress, problemSlug) {
  if (!problemSlug) throw new Error("problemSlug is required");

  // The server already owns the full solved set. Send only the newly
  // accepted problem so request size stays O(1) as a student's history grows.
  return apiFetch("/api/progress", {
    method: "PUT",
    body: JSON.stringify({ problemSlug }),
  });
}

export async function syncProgressOnLogin() {
  const [progress, submissions] = await Promise.all([getProgress(), getSubmissions()]);
  return { progress, submissions };
}
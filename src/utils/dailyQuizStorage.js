/**
 * dailyQuizStorage.js
 *
 * Client-only "once per day" gate for the Daily Quick Quiz (see
 * src/utils/quizEngine.js / src/data/quizQuestions.js). No quiz attempt is
 * persisted server-side (Plan 001 design decision), and the result itself
 * is only ever shown once, right when the quiz finishes (see
 * DailyQuickQuiz's per-question review) — it isn't reopenable later, so
 * this only needs to remember the date the quiz was last completed, not
 * the result itself.
 *
 * Uses the shared IST day-key policy (src/utils/studentDay.js — same
 * policy the backend uses for streak/Daily Quiz Gate/Daily Challenge) and
 * the existing getStorageData/setStorageData wrapper
 * (src/services/storageService.js) rather than raw localStorage calls.
 */

import { getStorageData, setStorageData } from "../services/storageService";
import { getStudentDayKey } from "./studentDay";

const LAST_COMPLETED_KEY = "codeclubDailyQuizLastCompleted";

/** Has the Daily Quick Quiz already been completed today? */
export function hasCompletedQuizToday() {
  return getStorageData(LAST_COMPLETED_KEY, null) === getStudentDayKey();
}

/** Marks today's Daily Quick Quiz as completed. */
export function markQuizCompletedToday() {
  setStorageData(LAST_COMPLETED_KEY, getStudentDayKey());
}

// ── Per-session onboarding flow tracking ────────────────────────────────
// The onboarding flow (Welcome -> [Quiz] -> Mission -> Focus -> Readiness)
// now runs once per session rather than once per day (Plan: refine-first-
// session-experience) — the quiz step alone stays day-gated via the
// functions above, but Welcome/Mission/Focus/Readiness should reappear
// every fresh login without re-showing on every in-app navigation back to
// /dashboard. sessionStorage (not storageService's localStorage wrapper)
// is the right tool here: it clears automatically on tab close, matching
// "every login" without needing to invent our own session-boundary logic.
const SHOWN_THIS_SESSION_KEY = "codeclubOnboardingShownThisSession";

/** Has the onboarding flow already been shown once this browser session? */
export function hasShownOnboardingThisSession() {
  return sessionStorage.getItem(SHOWN_THIS_SESSION_KEY) === "true";
}

/** Marks the onboarding flow as shown for the remainder of this session. */
export function markOnboardingShownThisSession() {
  sessionStorage.setItem(SHOWN_THIS_SESSION_KEY, "true");
}
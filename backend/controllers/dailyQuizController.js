/**
 * dailyQuizController.js
 *
 * Server-side source of truth for the mandatory Daily Quiz Gate
 * (src/routes/DailyQuizGuard.jsx). Deliberately the opposite design
 * decision from the earlier onboarding quiz step (see the now-removed
 * dailyQuizStorage.js) — that was a client-only, once-per-SESSION gate
 * scoped to /dashboard, explicitly documented as not persisting
 * server-side. This gate must not be bypassable by clearing browser
 * storage, so completion is read from and written to `User.dailyQuizCompletedDate`.
 *
 * "Today" is the shared IST calendar day used everywhere else in this
 * codebase for daily gating (streak, `dailyChallengeHistory`, the daily
 * hint quota) — see `backend/utils/studentDay.js` for the policy and the
 * one place this is computed, so status-checking, completion-recording,
 * and "is it a new day yet" all agree with every other daily feature.
 */

import { getStudentDayKey } from "../utils/studentDay.js";

/**
 * GET /api/daily-quiz/status
 *
 * Intentionally returns only `{ required, completed }` — no question
 * content, no completion history, nothing that isn't needed to decide
 * whether to render the gate (spec: "Do not expose unnecessary quiz/
 * security information through the status endpoint").
 */
export function getDailyQuizStatus(req, res) {
  const completed = req.userDoc.dailyQuizCompletedDate === getStudentDayKey();

  res.json({
    required: !completed,
    completed,
  });
}

/**
 * POST /api/daily-quiz/complete
 *
 * Idempotent: completing twice in the same day just confirms the
 * already-completed state rather than erroring, since a slow/retried
 * request racing a fast one shouldn't surface as a failure to the user.
 */
export async function completeDailyQuiz(req, res) {
  try {
    const today = getStudentDayKey();
    const alreadyCompleted = req.userDoc.dailyQuizCompletedDate === today;

    if (!alreadyCompleted) {
      req.userDoc.dailyQuizCompletedDate = today;
      await req.userDoc.save();
    }

    res.json({
      required: false,
      completed: true,
    });
  } catch (err) {
    req.log.error({ err }, "[Daily Quiz] completeDailyQuiz failed");

    res.status(500).json({
      error: "Failed to save daily quiz completion",
    });
  }
}

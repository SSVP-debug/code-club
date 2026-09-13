/**
 * studentDay.js
 *
 * THE single place "what calendar day is it for the student?" is decided.
 * Every daily feature (streak, Daily Quiz gate, Daily Challenge, the daily
 * hint quota, activity-heatmap day keys) must derive its day key from
 * `getStudentDayKey()` here — never from an ad-hoc
 * `new Date().toISOString().split("T")[0]` at the call site. That pattern
 * is exactly what silently made every "daily" feature run on a UTC
 * calendar day instead of the day the student actually experiences.
 *
 * ── Policy ───────────────────────────────────────────────────────────────
 * Code Club's primary audience is Indian engineering students. The product
 * does not yet have (and does not need, at this stage) per-user timezone
 * storage or preferences — there's no `timezone` field on `User`, no
 * onboarding step that asks for one, and no UI that would let a student
 * set or see one. Introducing full per-user timezone support would add
 * real complexity (a new profile field, backfill for existing users,
 * timezone-conversion in every daily-reset job, DST edge cases for the
 * handful of non-India users) for a problem the product doesn't have
 * evidence of yet.
 *
 * So the policy is: **fixed IST (UTC+5:30), for everyone, until a real
 * international cohort makes this worth revisiting.** A student's
 * calendar day rolls over at 12:00:00 AM IST regardless of their device's
 * OS timezone or browser locale — this also makes the boundary
 * deterministic and immune to a misconfigured client clock, which matters
 * because streak/quiz/challenge completion is itself server-verified data
 * (see docs/security-fixes/Solve-integrity.md).
 *
 * If Code Club later needs real per-user timezones, this is the one file
 * that changes — every call site already just asks "what's today's key,"
 * not "what's today in UTC."
 */

// IST = UTC+5:30, fixed. Not DST-observing, so no seasonal adjustment needed.
const IST_OFFSET_MINUTES = 5 * 60 + 30;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

/**
 * Returns the IST calendar-day key (`YYYY-MM-DD`) for the given instant.
 * Defaults to "right now" when no argument is given — this is the form
 * every "is today already done?" check should call.
 *
 * @param {Date|string|number} [when] - instant to key; defaults to now.
 * @returns {string} YYYY-MM-DD, the IST calendar day `when` falls on.
 */
export function getStudentDayKey(when = new Date()) {
  const instant = when instanceof Date ? when : new Date(when);
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);
  return shifted.toISOString().split("T")[0];
}

/**
 * True if `dayKeyA` is exactly one IST calendar day before `dayKeyB`.
 * Pulled out of calculateStreak.js so streak-consecutiveness and any
 * future "yesterday" check (e.g. a grace-period feature) share one
 * definition of "consecutive," same as the day-key itself.
 *
 * @param {string} dayKeyA - YYYY-MM-DD
 * @param {string} dayKeyB - YYYY-MM-DD
 */
export function isNextStudentDay(dayKeyA, dayKeyB) {
  const a = new Date(`${dayKeyA}T00:00:00.000Z`);
  const b = new Date(`${dayKeyB}T00:00:00.000Z`);
  const diffDays = (b - a) / (24 * 60 * 60 * 1000);
  return diffDays === 1;
}

/** Convenience: the IST day key for "yesterday relative to `when`." */
export function getPreviousStudentDayKey(when = new Date()) {
  const instant = when instanceof Date ? when : new Date(when);
  return getStudentDayKey(new Date(instant.getTime() - 24 * 60 * 60 * 1000));
}

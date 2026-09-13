/**
 * studentDay.js (frontend mirror of backend/utils/studentDay.js)
 *
 * THE single place the frontend decides "what calendar day is it for the
 * student?" Must stay behaviorally identical to the backend copy — both
 * use a fixed IST (UTC+5:30) offset rather than the browser's local
 * timezone, so a student's device clock/locale can never disagree with
 * the server about which day a streak, Daily Quiz, or Daily Challenge
 * belongs to. See the backend file for the full policy rationale.
 *
 * Anything that reads/writes an IST day key on the client (the client-only
 * Daily Quick Quiz gate, the activity heatmap, the streak calendar
 * popover, optimistic progress updates) should import from here instead
 * of calling `new Date().toISOString()` directly.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Returns the IST calendar-day key (`YYYY-MM-DD`) for the given instant.
 * Defaults to "right now."
 *
 * @param {Date|string|number} [when]
 * @returns {string} YYYY-MM-DD
 */
export function getStudentDayKey(when = new Date()) {
  const instant = when instanceof Date ? when : new Date(when);
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);
  return shifted.toISOString().split("T")[0];
}

/** The IST day key for "yesterday relative to `when`." */
export function getPreviousStudentDayKey(when = new Date()) {
  const instant = when instanceof Date ? when : new Date(when);
  return getStudentDayKey(new Date(instant.getTime() - 24 * 60 * 60 * 1000));
}

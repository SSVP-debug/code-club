import { getStudentDayKey, getPreviousStudentDayKey, isNextStudentDay } from "./studentDay.js";

/**
 * calculateStreak — derives current/longest streak from a list of IST
 * calendar-day keys (`activityDates`, each `YYYY-MM-DD` — see
 * studentDay.js for what "day" means and why). Consecutiveness is decided
 * by `isNextStudentDay()`, the same helper `studentDay.js` exports for any
 * other feature that needs a "day after" check, so streak logic can't
 * silently drift from the shared day-key definition.
 */
export function calculateStreak(activityDates = []) {
  if (!activityDates.length) {
    return {
      currentStreak: 0,
      longestStreak: 0,
    };
  }

  const sorted = [...new Set(activityDates)].sort();

  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < sorted.length; i++) {
    if (isNextStudentDay(sorted[i - 1], sorted[i])) {
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 1;
    }
  }

  const today = getStudentDayKey();
  const yesterday = getPreviousStudentDayKey();

  const lastDate = sorted[sorted.length - 1];

  let currentStreak = 0;

  if (lastDate === today || lastDate === yesterday) {
    currentStreak = 1;

    for (let i = sorted.length - 1; i > 0; i--) {
      if (isNextStudentDay(sorted[i - 1], sorted[i])) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
  };
}

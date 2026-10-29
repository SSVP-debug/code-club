import { getStudentDayKey } from "./studentDay";

const KEY_PREFIX = "codeclub.dailyCheckin.completed";

/**
 * Client-side fast path only. The server remains authoritative when this
 * user has no local completion for today's IST date.
 */
export function hasLocalDailyCheckin(uid, when = new Date()) {
  if (!uid || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${KEY_PREFIX}.${uid}`) === getStudentDayKey(when);
  } catch {
    return false;
  }
}

export function markLocalDailyCheckin(uid, when = new Date()) {
  if (!uid || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${KEY_PREFIX}.${uid}`, getStudentDayKey(when));
  } catch {
    // Private browsing / storage restrictions must not block the check-in.
  }
}

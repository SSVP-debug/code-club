import { apiFetchOptional } from "../services/api";
import { getStudentDayKey } from "./studentDay";

/**
 * Resolves the daily challenge from the canonical backend catalog.
 * The frontend no longer imports the authored problem bank directly.
 */
export async function getDailyChallenge() {
  const problems = await apiFetchOptional("/api/problems");
  if (!Array.isArray(problems) || problems.length === 0) {
    throw new Error("Problem catalog unavailable");
  }

  // Daily Challenge uses the same fixed IST student-day policy as the backend.
  const today = getStudentDayKey();
  const seed = today.replace(/-/g, "");
  const index = Number(seed) % problems.length;

  return problems[index];
}

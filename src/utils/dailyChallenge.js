import { getStudentDayKey } from "./studentDay";

// Dynamic import: this file is imported from several places that don't
// necessarily need the full ~7000-line problems catalog just sitting in
// their bundle chunk (AvatarDropdown, which renders on most authenticated
// pages via Navbar/DashboardLayout, being the main one). Deferring the
// import here means the catalog only loads when a daily challenge is
// actually requested, not wherever this module happens to be imported.
export async function getDailyChallenge() {
  const { default: problems } = await import("../data/problems");

  // Daily Challenge uses the same fixed IST student-day policy as the
  // backend. Never use browser/UTC date formatting here or the challenge
  // can roll over at a different time from the server.
  const today = getStudentDayKey();
  const seed = today.replace(/-/g, "");
  const index = Number(seed) % problems.length;

  return problems[index];
}

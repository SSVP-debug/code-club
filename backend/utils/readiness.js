/**
 * Placement Readiness Score (0-100).
 *
 * Single source of truth for the heuristic used by GET /api/tpo/dashboard,
 * both college-wide and per-cohort, so a cohort's score is directly
 * comparable to the college's. Weighted combination of average solves,
 * hard-problem coverage, and active engagement:
 *   - up to 40 pts: average solved per student (100+ avg = full marks)
 *   - up to 30 pts: average hard solved per student (20+ = full marks)
 *   - up to 30 pts: share of students with an active streak
 */
export function computeReadinessScore({ totalStudents, totalSolved, totalHard, activeStudents }) {
  if (!totalStudents) return 0;
  const avgSolved = totalSolved / totalStudents;
  const solveScore = Math.min(40, (avgSolved / 100) * 40);
  const hardScore = Math.min(30, (totalHard / totalStudents / 20) * 30);
  const engagementScore = Math.min(30, (activeStudents / totalStudents) * 30);
  return Math.round(solveScore + hardScore + engagementScore);
}

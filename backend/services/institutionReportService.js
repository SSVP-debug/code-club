import User from "../models/User.js";
import Cohort from "../models/Cohort.js";
import CohortMembership from "../models/CohortMembership.js";
import Assignment from "../models/Assignment.js";
import { topicStatsToObject } from "../utils/topicStats.js";

function parseDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getInstitutionReportOverview({
  college,
  from,
  to,
}) {
  if (!college?._id) throw new Error("College is required.");

  const end = parseDate(to, new Date());
  const start = parseDate(from, new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000));
  if (!start || !end) {
    const error = new Error("Invalid report date range.");
    error.code = "INVALID_DATE_RANGE";
    throw error;
  }
  if (start > end) {
    const error = new Error("Report start date must be before end date.");
    error.code = "INVALID_DATE_RANGE";
    throw error;
  }

  const collegeId = college._id;
  const domains = (college.domains || []).map((domain) => domain.toLowerCase());

  // TPO visibility is the canonical student population for institutional
  // reporting. Opted-out students are counted separately and never included
  // in performance metrics.
  const studentMatch = {
    role: "student",
    $or: [
      { collegeId },
      ...(domains.length ? [{ collegeId: { $exists: false }, emailDomain: { $in: domains } }] : []),
      ...(domains.length ? [{ collegeId: null, emailDomain: { $in: domains } }] : []),
    ],
  };

  const students = await User.find(studentMatch)
    .select("totalXP solvedSlugs solvedDifficulty currentStreak topicStats visibleToTpo joinedDate")
    .lean();

  const visibleStudents = students.filter((student) => student.visibleToTpo !== false);
  const optedOutStudents = students.filter((student) => student.visibleToTpo === false);

  const totalStudents = visibleStudents.length;
  const totalSolved = visibleStudents.reduce(
    (sum, student) => sum + (student.solvedSlugs?.length || 0),
    0
  );
  const totalEasy = visibleStudents.reduce(
    (sum, student) => sum + (student.solvedDifficulty?.easy || 0),
    0
  );
  const totalMedium = visibleStudents.reduce(
    (sum, student) => sum + (student.solvedDifficulty?.medium || 0),
    0
  );
  const totalHard = visibleStudents.reduce(
    (sum, student) => sum + (student.solvedDifficulty?.hard || 0),
    0
  );
  const activeStudents = visibleStudents.filter((student) => (student.currentStreak || 0) > 0).length;

  const cohorts = await Cohort.find({ collegeId })
    .select("_id name academicYear graduatingYear branch section status")
    .lean();
  const activeCohorts = cohorts.filter((cohort) => cohort.status !== "archived").length;

  const cohortIds = cohorts.map((cohort) => cohort._id);
  const memberships = cohortIds.length
    ? await CohortMembership.find({
        cohortId: { $in: cohortIds },
        status: "active",
        studentId: { $ne: null },
      }).select("cohortId studentId").lean()
    : [];

  const cohortStudentIds = new Set(memberships.map((membership) => String(membership.studentId)));
  const assignmentQuery = {
    $or: [
      { collegeId },
      ...(domains.length
        ? [{ collegeId: null, collegeDomain: { $in: domains } }]
        : []),
    ],
    createdAt: { $gte: start, $lte: end },
  };
  const assignments = await Assignment.find(assignmentQuery)
    .select("problemSlugs cohortId status createdAt")
    .lean();

  const visibleStudentIds = new Set(visibleStudents.map((student) => String(student._id)));
  const solvedByStudent = new Map(
    visibleStudents.map((student) => [String(student._id), new Set(student.solvedSlugs || [])])
  );

  // ── Per-cohort breakdown ─────────────────────────────────────────────────
  // A TPO managing several cohorts needs these same solved/streak/topic
  // numbers sliced per cohort, not just as one college-wide total. Reuses
  // the students/cohorts/memberships already loaded above — no extra
  // queries. Kept as its own top-level `cohortBreakdown` key (a sibling of
  // `cohorts`, not nested inside it) so the existing `cohorts` summary
  // object's shape — asserted elsewhere with `toEqual` — is untouched.
  const studentsById = new Map(visibleStudents.map((student) => [String(student._id), student]));
  const membershipsByCohort = new Map();
  for (const membership of memberships) {
    const key = String(membership.cohortId);
    if (!membershipsByCohort.has(key)) membershipsByCohort.set(key, []);
    membershipsByCohort.get(key).push(String(membership.studentId));
  }

  const cohortBreakdown = cohorts
    .map((cohort) => {
      const cohortKey = String(cohort._id);
      const memberIds = (membershipsByCohort.get(cohortKey) || []).filter((studentId) =>
        visibleStudentIds.has(studentId)
      );
      const members = memberIds.map((studentId) => studentsById.get(studentId)).filter(Boolean);

      const memberCount = members.length;
      const totalSolved = members.reduce((sum, student) => sum + (student.solvedSlugs?.length || 0), 0);
      const totalEasy = members.reduce((sum, student) => sum + (student.solvedDifficulty?.easy || 0), 0);
      const totalMedium = members.reduce((sum, student) => sum + (student.solvedDifficulty?.medium || 0), 0);
      const totalHard = members.reduce((sum, student) => sum + (student.solvedDifficulty?.hard || 0), 0);
      const activeMembers = members.filter((student) => (student.currentStreak || 0) > 0).length;

      // topicStats is stored as a Mongoose Map (topic -> solve count), which
      // .lean() surfaces as a plain object, not an array — see
      // utils/topicStats.js, the same helper the rest of the codebase uses
      // to read it.
      const topicTotals = new Map();
      for (const student of members) {
        const stats = topicStatsToObject(student.topicStats);
        for (const [topic, count] of Object.entries(stats)) {
          topicTotals.set(topic, (topicTotals.get(topic) || 0) + (count || 0));
        }
      }
      const topTopics = [...topicTotals.entries()]
        .map(([topic, totalSolves]) => ({ topic, totalSolves }))
        .sort((a, b) => b.totalSolves - a.totalSolves)
        .slice(0, 5);

      return {
        cohortId: cohortKey,
        name: cohort.name,
        academicYear: cohort.academicYear,
        graduatingYear: cohort.graduatingYear,
        branch: cohort.branch,
        section: cohort.section ?? null,
        status: cohort.status,
        memberCount,
        totalSolved,
        averageSolved: memberCount ? Math.round((totalSolved / memberCount) * 10) / 10 : 0,
        difficulty: { easy: totalEasy, medium: totalMedium, hard: totalHard },
        active: activeMembers,
        activePercent: memberCount ? Math.round((activeMembers / memberCount) * 100) : 0,
        topTopics,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const unassignedVisibleCount = visibleStudents.filter(
    (student) => !cohortStudentIds.has(String(student._id))
  ).length;

  let assignedStudents = 0;
  let completedAssignments = 0;
  let assignmentCompletions = 0;

  for (const assignment of assignments) {
    const audience = assignment.cohortId
      ? memberships
          .filter((membership) => String(membership.cohortId) === String(assignment.cohortId))
          .map((membership) => String(membership.studentId))
          .filter((studentId) => visibleStudentIds.has(studentId))
      : [...visibleStudentIds].filter((studentId) => {
          // Legacy college-wide assignments use the institution population.
          return solvedByStudent.has(studentId);
        });

    assignedStudents += audience.length;
    for (const studentId of audience) {
      const solved = solvedByStudent.get(studentId) || new Set();
      if (assignment.problemSlugs.every((slug) => solved.has(slug))) {
        completedAssignments += 1;
      }
    }
    assignmentCompletions += audience.length;
  }

  return {
    range: {
      from: start.toISOString(),
      to: end.toISOString(),
    },
    students: {
      total: totalStudents,
      optedOut: optedOutStudents.length,
      active: activeStudents,
      activePercent: totalStudents ? Math.round((activeStudents / totalStudents) * 100) : 0,
    },
    problems: {
      totalSolved,
      averageSolved: totalStudents ? Math.round((totalSolved / totalStudents) * 10) / 10 : 0,
      difficulty: {
        easy: totalEasy,
        medium: totalMedium,
        hard: totalHard,
      },
    },
    cohorts: {
      total: cohorts.length,
      active: activeCohorts,
      archived: cohorts.length - activeCohorts,
      activeMemberships: cohortStudentIds.size,
    },
    cohortBreakdown,
    unassignedStudents: {
      count: unassignedVisibleCount,
    },
    assignments: {
      total: assignments.length,
      active: assignments.filter((assignment) => assignment.status !== "archived").length,
      archived: assignments.filter((assignment) => assignment.status === "archived").length,
      assignedStudents,
      completedAssignments,
      completionPercent: assignmentCompletions
        ? Math.round((completedAssignments / assignmentCompletions) * 100)
        : 0,
    },
  };
}

import User from "../models/User.js";
import Cohort from "../models/Cohort.js";
import CohortMembership from "../models/CohortMembership.js";
import Assignment from "../models/Assignment.js";

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

  const cohorts = await Cohort.find({ collegeId }).select("_id status").lean();
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

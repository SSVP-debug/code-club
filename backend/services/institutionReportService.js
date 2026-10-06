import User from "../models/User.js";
import Cohort from "../models/Cohort.js";
import CohortMembership from "../models/CohortMembership.js";
import Assignment from "../models/Assignment.js";
import UserProblemProgress from "../models/UserProblemProgress.js";
import { topicStatsToObject } from "../utils/topicStats.js";

function parseDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function visibleStudentExpr() {
  return { $ne: [{ $ifNull: ["$visibleToTpo", true] }, false] };
}

export async function getInstitutionReportOverview({ college, from, to }) {
  if (!college?._id) throw new Error("College is required.");

  const end = parseDate(to, new Date());
  const start = parseDate(from, new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000));
  if (!start || !end || start > end) {
    const error = new Error("Invalid report date range.");
    error.code = "INVALID_DATE_RANGE";
    throw error;
  }

  const collegeId = college._id;
  const domains = (college.domains || []).map((domain) => domain.toLowerCase());
  const studentMatch = {
    role: "student",
    $or: [
      { collegeId },
      ...(domains.length ? [{ collegeId: { $exists: false }, emailDomain: { $in: domains } }] : []),
      ...(domains.length ? [{ collegeId: null, emailDomain: { $in: domains } }] : []),
    ],
  };

  // Keep the large per-student arrays inside MongoDB. The previous
  // implementation transferred solvedSlugs/topicStats for every student and
  // then performed the report arithmetic in Node. This aggregation returns a
  // single small document for the institution-wide totals instead.
  const [studentTotals = {}] = await User.aggregate([
    { $match: studentMatch },
    {
      $group: {
        _id: null,
        total: { $sum: { $cond: [visibleStudentExpr(), 1, 0] } },
        optedOut: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$visibleToTpo", true] }, false] }, 1, 0] } },
        totalSolved: {
          $sum: {
            $cond: [
              visibleStudentExpr(),
              { $size: { $ifNull: ["$solvedSlugs", []] } },
              0,
            ],
          },
        },
        totalEasy: { $sum: { $cond: [visibleStudentExpr(), { $ifNull: ["$solvedDifficulty.easy", 0] }, 0] } },
        totalMedium: { $sum: { $cond: [visibleStudentExpr(), { $ifNull: ["$solvedDifficulty.medium", 0] }, 0] } },
        totalHard: { $sum: { $cond: [visibleStudentExpr(), { $ifNull: ["$solvedDifficulty.hard", 0] }, 0] } },
        active: {
          $sum: {
            $cond: [
              { $and: [visibleStudentExpr(), { $gt: [{ $ifNull: ["$currentStreak", 0] }, 0] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const totalStudents = studentTotals.total || 0;
  const totalSolved = studentTotals.totalSolved || 0;
  const totalEasy = studentTotals.totalEasy || 0;
  const totalMedium = studentTotals.totalMedium || 0;
  const totalHard = studentTotals.totalHard || 0;
  const activeStudents = studentTotals.active || 0;
  const optedOutCount = studentTotals.optedOut || 0;

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
  const visibleStudentIdDocs = await User.find(studentMatch)
    .select("_id visibleToTpo")
    .lean();
  const visibleStudentIds = visibleStudentIdDocs
    .filter((student) => student.visibleToTpo !== false)
    .map((student) => student._id);
  const visibleStudentIdSet = new Set(visibleStudentIds.map((id) => String(id)));

  // Cohort aggregates still run entirely in MongoDB. Only one small result per
  // cohort/topic is returned to Node, rather than one document per student.
  const cohortScalarRows = cohorts.length
    ? await User.aggregate([
        { $match: studentMatch },
        { $match: { visibleToTpo: { $ne: false } } },
        {
          $lookup: {
            from: "cohortmemberships",
            localField: "_id",
            foreignField: "studentId",
            as: "memberships",
          },
        },
        { $unwind: "$memberships" },
        { $match: { "memberships.cohortId": { $in: cohortIds }, "memberships.status": "active" } },
        {
          $group: {
            _id: "$memberships.cohortId",
            memberCount: { $sum: 1 },
            totalSolved: { $sum: { $size: { $ifNull: ["$solvedSlugs", []] } } },
            totalEasy: { $sum: { $ifNull: ["$solvedDifficulty.easy", 0] } },
            totalMedium: { $sum: { $ifNull: ["$solvedDifficulty.medium", 0] } },
            totalHard: { $sum: { $ifNull: ["$solvedDifficulty.hard", 0] } },
            active: { $sum: { $cond: [{ $gt: [{ $ifNull: ["$currentStreak", 0] }, 0] }, 1, 0] } },
          },
        },
      ])
    : [];

  const cohortTopicRows = cohorts.length
    ? await User.aggregate([
        { $match: studentMatch },
        { $match: { visibleToTpo: { $ne: false } } },
        {
          $lookup: {
            from: "cohortmemberships",
            localField: "_id",
            foreignField: "studentId",
            as: "memberships",
          },
        },
        { $unwind: "$memberships" },
        { $match: { "memberships.cohortId": { $in: cohortIds }, "memberships.status": "active" } },
        { $project: { cohortId: "$memberships.cohortId", topicStats: { $objectToArray: { $ifNull: ["$topicStats", {}] } } } },
        { $unwind: { path: "$topicStats", preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: { cohortId: "$cohortId", topic: "$topicStats.k" },
            totalSolves: { $sum: { $ifNull: ["$topicStats.v", 0] } },
          },
        },
      ])
    : [];

  const scalarByCohort = new Map(cohortScalarRows.map((row) => [String(row._id), row]));
  const topicsByCohort = new Map();
  for (const row of cohortTopicRows) {
    const key = String(row._id.cohortId);
    if (!topicsByCohort.has(key)) topicsByCohort.set(key, []);
    topicsByCohort.get(key).push({ topic: row._id.topic, totalSolves: row.totalSolves || 0 });
  }

  const cohortBreakdown = cohorts
    .map((cohort) => {
      const key = String(cohort._id);
      const row = scalarByCohort.get(key) || {};
      const memberCount = row.memberCount || 0;
      const total = row.totalSolved || 0;
      const active = row.active || 0;
      const topTopics = (topicsByCohort.get(key) || [])
        .sort((a, b) => b.totalSolves - a.totalSolves)
        .slice(0, 5);
      return {
        cohortId: key,
        name: cohort.name,
        academicYear: cohort.academicYear,
        graduatingYear: cohort.graduatingYear,
        branch: cohort.branch,
        section: cohort.section ?? null,
        status: cohort.status,
        memberCount,
        totalSolved: total,
        averageSolved: memberCount ? Math.round((total / memberCount) * 10) / 10 : 0,
        difficulty: {
          easy: row.totalEasy || 0,
          medium: row.totalMedium || 0,
          hard: row.totalHard || 0,
        },
        active,
        activePercent: memberCount ? Math.round((active / memberCount) * 100) : 0,
        topTopics,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const assignmentQuery = {
    $or: [
      { collegeId },
      ...(domains.length ? [{ collegeId: null, collegeDomain: { $in: domains } }] : []),
    ],
    createdAt: { $gte: start, $lte: end },
  };
  const assignments = await Assignment.find(assignmentQuery)
    .select("problemSlugs cohortId status createdAt")
    .lean();

  // Assignment completion is derived from the scalable per-user/problem
  // collection. We only transfer user ids (not solvedSlugs arrays) and let
  // MongoDB count solved rows per assignment audience.
  const membershipsByCohort = new Map();
  for (const membership of memberships) {
    const key = String(membership.cohortId);
    if (!membershipsByCohort.has(key)) membershipsByCohort.set(key, []);
    if (visibleStudentIdSet.has(String(membership.studentId))) {
      membershipsByCohort.get(key).push(membership.studentId);
    }
  }

  let assignedStudents = 0;
  let completedAssignments = 0;
  let assignmentCompletions = 0;

  for (const assignment of assignments) {
    const audienceIds = assignment.cohortId
      ? (membershipsByCohort.get(String(assignment.cohortId)) || [])
      : visibleStudentIds;

    assignedStudents += audienceIds.length;
    if (!audienceIds.length || !assignment.problemSlugs.length) continue;

    const completionRows = await UserProblemProgress.aggregate([
      {
        $match: {
          userId: { $in: audienceIds },
          problemSlug: { $in: assignment.problemSlugs },
          status: "solved",
        },
      },
      { $group: { _id: "$userId", solvedCount: { $addToSet: "$problemSlug" } } },
      { $project: { solvedCount: { $size: "$solvedCount" } } },
      { $match: { solvedCount: assignment.problemSlugs.length } },
      { $count: "completed" },
    ]);

    completedAssignments += completionRows[0]?.completed || 0;
    assignmentCompletions += audienceIds.length;
  }

  const unassignedVisibleCount = visibleStudentIds.length - [...visibleStudentIdSet].filter((id) => cohortStudentIds.has(id)).length;

  return {
    range: { from: start.toISOString(), to: end.toISOString() },
    students: {
      total: totalStudents,
      optedOut: optedOutCount,
      active: activeStudents,
      activePercent: totalStudents ? Math.round((activeStudents / totalStudents) * 100) : 0,
    },
    problems: {
      totalSolved,
      averageSolved: totalStudents ? Math.round((totalSolved / totalStudents) * 10) / 10 : 0,
      difficulty: { easy: totalEasy, medium: totalMedium, hard: totalHard },
    },
    cohorts: {
      total: cohorts.length,
      active: activeCohorts,
      archived: cohorts.length - activeCohorts,
      activeMemberships: cohortStudentIds.size,
    },
    cohortBreakdown,
    unassignedStudents: { count: unassignedVisibleCount },
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

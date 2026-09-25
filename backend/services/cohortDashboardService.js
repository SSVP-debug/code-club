import mongoose from "mongoose";
import User from "../models/User.js";
import Cohort from "../models/Cohort.js";
import CohortMembership from "../models/CohortMembership.js";
import { computeReadinessScore } from "../utils/readiness.js";

/**
 * Cohort slicing for GET /api/tpo/dashboard.
 *
 * Everything here is computed inside Mongo (no student documents pulled
 * into Node) to keep the dashboard's original design intent. Opted-out
 * students (visibleToTpo === false) are excluded from every number, same
 * policy as the college-wide dashboard.
 */

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Ids of visible-to-TPO students actively enrolled in one cohort.
 * Caller must already have verified the cohort belongs to the caller's
 * college (see cohortService.getCohortForCollege).
 */
export async function getActiveCohortStudentIds(cohortId) {
  const memberships = await CohortMembership.find({
    cohortId: new mongoose.Types.ObjectId(String(cohortId)),
    status: "active",
    studentId: { $ne: null },
  })
    .select("studentId")
    .lean();
  return memberships.map((m) => m.studentId);
}

/**
 * Per-cohort solved / difficulty / streak / topic numbers + readiness for
 * every cohort of a college (active and archived; archived flagged via
 * `status` so the UI can hide them).
 *
 * `collegeDomains` scopes students the same way the rest of /dashboard
 * does; membership rows are further restricted to this college's cohorts,
 * so a student can never be counted under another institution's cohort.
 */
export async function getCohortBreakdown({ collegeId, collegeDomains }) {
  const cohorts = await Cohort.find({ collegeId })
    .select("_id name academicYear graduatingYear branch section status")
    .lean();
  if (!cohorts.length) return [];

  const cohortIds = cohorts.map((c) => c._id);

  const [agg] = await User.aggregate([
    { $match: { emailDomain: { $in: collegeDomains }, role: "student", visibleToTpo: { $ne: false } } },
    {
      $lookup: {
        from: CohortMembership.collection.name,
        let: { sid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$studentId", "$$sid"] }, status: "active", cohortId: { $in: cohortIds } } },
          { $project: { _id: 0, cohortId: 1 } },
        ],
        as: "memberships",
      },
    },
    { $unwind: "$memberships" },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: "$memberships.cohortId",
              memberCount: { $sum: 1 },
              totalSolved: { $sum: { $size: { $ifNull: ["$solvedSlugs", []] } } },
              easy: { $sum: { $ifNull: ["$solvedDifficulty.easy", 0] } },
              medium: { $sum: { $ifNull: ["$solvedDifficulty.medium", 0] } },
              hard: { $sum: { $ifNull: ["$solvedDifficulty.hard", 0] } },
              active: { $sum: { $cond: [{ $gt: [{ $ifNull: ["$currentStreak", 0] }, 0] }, 1, 0] } },
            },
          },
        ],
        // topicStats is a Mongoose Map -> stored as a sub-document
        // ({ arrays: 4, graphs: 2 }), not an array, so it must go through
        // $objectToArray before it can be unwound.
        topics: [
          { $project: { cohortId: "$memberships.cohortId", t: { $objectToArray: { $ifNull: ["$topicStats", {}] } } } },
          { $unwind: "$t" },
          { $group: { _id: { cohortId: "$cohortId", topic: "$t.k" }, totalSolves: { $sum: "$t.v" } } },
        ],
      },
    },
  ]).then((r) => (r.length ? r : [{ summary: [], topics: [] }]));

  const summaryByCohort = new Map(agg.summary.map((s) => [String(s._id), s]));
  const topicsByCohort = new Map();
  for (const row of agg.topics) {
    const key = String(row._id.cohortId);
    if (!topicsByCohort.has(key)) topicsByCohort.set(key, []);
    topicsByCohort.get(key).push({ topic: row._id.topic, totalSolves: row.totalSolves });
  }

  return cohorts
    .map((cohort) => {
      const key = String(cohort._id);
      const s = summaryByCohort.get(key);
      const memberCount = s?.memberCount ?? 0;
      const totalSolved = s?.totalSolved ?? 0;
      const hard = s?.hard ?? 0;
      const active = s?.active ?? 0;
      return {
        cohortId: key,
        name: cohort.name,
        academicYear: cohort.academicYear,
        graduatingYear: cohort.graduatingYear,
        branch: cohort.branch,
        section: cohort.section ?? null,
        status: cohort.status,
        totalStudents: memberCount,
        totalSolved,
        avgSolved: memberCount ? round1(totalSolved / memberCount) : 0,
        difficultyBreakdown: { easy: s?.easy ?? 0, medium: s?.medium ?? 0, hard },
        activeThisWeek: active,
        activePercent: memberCount ? Math.round((active / memberCount) * 100) : 0,
        readinessScore: computeReadinessScore({ totalStudents: memberCount, totalSolved, totalHard: hard, activeStudents: active }),
        topicCoverage: (topicsByCohort.get(key) || []).sort((a, b) => b.totalSolves - a.totalSolves).slice(0, 10),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

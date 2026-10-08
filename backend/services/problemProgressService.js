import UserProblemProgress from "../models/UserProblemProgress.js";
import { getStudentDayKey } from "../utils/studentDay.js";

/**
 * Record one server-verified submission in the scalable per-user/problem
 * progress store. This is deliberately idempotent at the document level:
 * one student/problem has exactly one row and repeated submissions only
 * increment counters/update the latest attempt.
 */
export async function recordProblemProgress({
  userId,
  problemSlug,
  accepted,
  executionTime = null,
  memory = null,
  attemptedAt = new Date(),
}) {
  const inc = { attemptCount: 1 };
  const set = { lastAttemptAt: attemptedAt };

  if (accepted) {
    inc.acceptedCount = 1;
    set.status = "solved";
    set.solvedAt = attemptedAt;
    set.solvedDay = getStudentDayKey(attemptedAt);
  }

  if (Number.isFinite(Number(executionTime))) {
    set.bestRuntime = Number(executionTime);
  }
  if (Number.isFinite(Number(memory))) {
    set.bestMemory = Number(memory);
  }

  return UserProblemProgress.findOneAndUpdate(
    { userId, problemSlug },
    {
      $setOnInsert: {
        userId,
        problemSlug,
        firstAttemptAt: attemptedAt,
      },
      $set: set,
      $inc: inc,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

export async function syncSolvedProblemProgress(userId, slugs, solvedAt = new Date()) {
  const uniqueSlugs = [...new Set((slugs || []).filter(Boolean))];
  if (!uniqueSlugs.length) return { matchedCount: 0, modifiedCount: 0 };

  const operations = uniqueSlugs.map((problemSlug) => ({
    updateOne: {
      filter: { userId, problemSlug },
      update: {
        $set: {
          status: "solved",
          solvedAt,
          lastAttemptAt: solvedAt,
        },
        $setOnInsert: {
          userId,
          problemSlug,
          firstAttemptAt: solvedAt,
          solvedDay: getStudentDayKey(solvedAt),
          attemptCount: 1,
          acceptedCount: 1,
        },
      },
      upsert: true,
    },
  }));

  return UserProblemProgress.bulkWrite(operations, { ordered: false });
}

export async function getSolvedSlugs(userId) {
  const rows = await UserProblemProgress.find({ userId, status: "solved" })
    .select("problemSlug -_id")
    .lean();
  return rows.map((row) => row.problemSlug);
}


export async function getActivityDays(userId) {
  const rows = await UserProblemProgress.find({
    userId,
    status: "solved",
    solvedDay: { $ne: null },
  })
    .select("solvedDay -_id")
    .sort({ solvedDay: 1 })
    .lean();

  return rows.map((row) => row.solvedDay);
}


export async function getSolvedSlugsForUsers(userIds, problemSlugs = null) {
  const ids = [...new Set((userIds || []).map(String))];
  if (!ids.length) return new Map();

  const filter = {
    userId: { $in: ids },
    status: "solved",
  };
  if (Array.isArray(problemSlugs) && problemSlugs.length) {
    filter.problemSlug = { $in: [...new Set(problemSlugs)] };
  }

  const rows = await UserProblemProgress.find(filter)
    .select("userId problemSlug -_id")
    .lean();

  const result = new Map(ids.map((id) => [id, new Set()]));
  for (const row of rows) {
    const key = String(row.userId);
    if (!result.has(key)) result.set(key, new Set());
    result.get(key).add(row.problemSlug);
  }
  return result;
}

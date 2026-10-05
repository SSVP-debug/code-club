import ProblemStats from "../models/ProblemStats.js";

export async function recordProblemSubmissionStats({ problemSlug, accepted, submittedAt = new Date() }) {
  if (!problemSlug) return null;

  return ProblemStats.findOneAndUpdate(
    { problemSlug },
    {
      $inc: {
        attempts: 1,
        ...(accepted ? { accepted: 1 } : {}),
      },
      $set: { lastSubmissionAt: submittedAt },
      $setOnInsert: { problemSlug },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

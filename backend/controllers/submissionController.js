import Submission, { SUBMISSION_STATUSES } from "../models/Submission.js";
import { logger } from "../config/logger.js";
import { hashNormalizedCode } from "../utils/codeNormalization.js";
import { pickEncouragementMessage } from "../utils/encouragementMessages.js";
import { getStudentDayKey } from "../utils/studentDay.js";
import { recordProblemProgress } from "../services/problemProgressService.js";
import { recordProblemSubmissionStats } from "../services/problemStatsService.js";

export function toClientSubmission(doc) {
  return {
    id: doc._id.toString(),
    problemSlug: doc.problemSlug,
    problemTitle: doc.problemTitle,
    language: doc.language,
    status: doc.status,
    passed: doc.passed,
    total: doc.total,
    visiblePassed: doc.visiblePassed,
    hiddenPassed: doc.hiddenPassed,
    executionTime: doc.executionTime,
    expectedOutput: doc.expectedOutput,
    actualOutput: doc.actualOutput,
    encouragementMessage: doc.encouragementMessage ?? null,
    time: new Date(doc.createdAt).toISOString(),
    date: getStudentDayKey(doc.createdAt),
    createdAt: doc.createdAt,
  };
}

export async function recordVerifiedSubmission({
  userId,
  problemSlug,
  problemTitle,
  language,
  code,
  status,
  passed,
  total,
  visiblePassed,
  hiddenPassed,
  executionTime,
  expectedOutput,
  actualOutput,
  contestId = null,
  battleRoomId = null,
  problemVersion = null,
}) {
  if (!SUBMISSION_STATUSES.includes(status)) {
    throw new Error(`recordVerifiedSubmission: invalid status "${status}"`);
  }

  let normalizedCodeHash = null;
  let encouragementMessage = null;

  if (status !== "Accepted") {
    normalizedCodeHash = hashNormalizedCode(code, language);

    const previous = await Submission.findOne({
      userId,
      problemSlug,
      status: { $ne: "Accepted" },
    })
      .sort({ createdAt: -1 })
      .select("normalizedCodeHash encouragementMessage")
      .lean();

    encouragementMessage = pickEncouragementMessage({
      hash: normalizedCodeHash,
      previousHash: previous?.normalizedCodeHash ?? null,
      previousMessage: previous?.encouragementMessage ?? null,
    });
  }

  const submission = await Submission.create({
    userId,
    problemSlug,
    problemTitle,
    language,
    code: typeof code === "string" ? code.slice(0, 50_000) : "",
    status,
    passed: passed ?? 0,
    total: total ?? 0,
    visiblePassed: visiblePassed ?? 0,
    hiddenPassed: hiddenPassed ?? 0,
    executionTime: executionTime ?? null,
    expectedOutput,
    actualOutput,
    normalizedCodeHash,
    encouragementMessage,
    contestId: contestId || null,
    battleRoomId: battleRoomId || null,
    problemVersion,
  });

  // Submission remains the immutable audit/source-of-truth record. These
  // two derived stores make high-volume reads bounded:
  //   - UserProblemProgress: one row per user/problem
  //   - ProblemStats: one row per problem
  // A failure in either derived write must never turn a successful Judge0
  // result into a failed submission response; the durable Submission row
  // already exists and the next reconciliation/backfill can repair it.
  const [progressResult, statsResult] = await Promise.allSettled([
    recordProblemProgress({
      userId,
      problemSlug,
      accepted: status === "Accepted",
      executionTime,
      attemptedAt: submission.createdAt,
    }),
    recordProblemSubmissionStats({
      problemSlug,
      accepted: status === "Accepted",
      submittedAt: submission.createdAt,
    }),
  ]);

  if (progressResult.status === "rejected") {
    logger.error(
      { err: progressResult.reason, userId: String(userId), problemSlug },
      "[Submissions] UserProblemProgress write failed"
    );
  }
  if (statsResult.status === "rejected") {
    logger.error(
      { err: statsResult.reason, problemSlug },
      "[Submissions] ProblemStats write failed"
    );
  }

  return submission;
}

export async function createSubmission(req, res) {
  logger.warn(
    { userId: req.userDoc?._id?.toString() },
    "[Submissions] Deprecated direct createSubmission call — submissions are now recorded only by POST /api/judge/submit"
  );
  return res.status(410).json({
    error:
      "This endpoint no longer accepts client-submitted results. Submissions are recorded automatically when you submit code via /api/judge/submit.",
  });
}

export async function listSubmissions(req, res) {
  if (!req.userDoc) {
    return res.status(503).json({ error: "Database unavailable. Try again shortly." });
  }

  try {
    const { problemSlug } = req.query;
    const filter = { userId: req.userDoc._id };
    if (problemSlug) filter.problemSlug = problemSlug;

    const submissions = await Submission.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json(submissions.map(toClientSubmission));
  } catch (err) {
    req.log.error({ err }, "[Submissions] listSubmissions failed");
    return res.status(500).json({ error: "Failed to fetch submissions. Try again." });
  }
}

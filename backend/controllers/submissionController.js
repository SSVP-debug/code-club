import Submission, { SUBMISSION_STATUSES } from "../models/Submission.js";
import { logger } from "../config/logger.js";
import { hashNormalizedCode } from "../utils/codeNormalization.js";
import { pickEncouragementMessage } from "../utils/encouragementMessages.js";
import { getStudentDayKey } from "../utils/studentDay.js";

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
    // IST calendar day this submission falls on — must agree with the
    // shared day-key policy (backend/utils/studentDay.js) so "did I
    // attempt something today" checks (e.g. DailyMissionCard.jsx) use the
    // same day boundary as streak/quiz/challenge, not a UTC one.
    date: getStudentDayKey(doc.createdAt),
    createdAt: doc.createdAt,
  };
}

// ── recordVerifiedSubmission ─────────────────────────────────────────────────
// The ONLY place a Submission document is written. Not an HTTP handler —
// called exclusively from backend/routes/judge.js, immediately after a real
// Judge0-graded run, using values *this server just computed* (status,
// passed/total counts, visible/hidden split, expected/actual output on a
// visible-testcase failure). Nothing here is client-supplied.
//
// Security history: this function replaces what used to be a public
// `POST /api/submissions` handler that did `Submission.create({ userId,
// ...req.body })` — i.e. it trusted a client-sent `status`/`passed`/`total`
// wholesale, with only Zod shape validation (types/lengths), not truthfulness.
// Any authenticated user could POST `{ status: "Accepted", passed: total }`
// directly and be recorded as having solved a problem without Judge0 ever
// running their code — which then fed XP, achievements, certificates, and
// the recruiter-facing public profile. See docs/security-fixes/2026-07-solve-integrity.md.
//
// `code` is capped defensively even though the caller (judge.js) already
// validates it via Zod — this function has no HTTP-layer validation of its
// own, so it re-enforces the model's own maxlength expectation rather than
// relying on the caller never changing.
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
  // Optional contest context (Fest Readiness Audit, P0-1) — null for
  // ordinary practice submissions. Recorded as-is; this function does not
  // validate contest membership/timing itself (see
  // services/contestScoring.js for that) — it only persists the link so
  // it's possible to prove, after the fact, that a given contest solve
  // corresponds to a real server-graded submission.
  contestId = null,
  // Optional Battle Room context — null for ordinary submissions. Same
  // trust model as contestId: persisted as-is, not validated here (see
  // services/battleRoomScoring.js for that) — this only records the link
  // so a Battle Room solve can be proven, after the fact, against a real
  // server-graded submission.
  battleRoomId = null,
  // Minimum-viable versioning follow-up — see Submission.js's
  // `problemVersion` field comment. Optional/nullable so any other
  // future caller of this function doesn't need to plumb it through
  // just to keep working.
  problemVersion = null,
}) {
  if (!SUBMISSION_STATUSES.includes(status)) {
    throw new Error(`recordVerifiedSubmission: invalid status "${status}"`);
  }

  // ── Wrong-answer encouragement engine ───────────────────────────────────
  // Only computed for non-Accepted submissions — an Accepted result gets
  // its own (randomized, non-persisted) celebratory copy purely on the
  // frontend, since there's no "same attempt again" case to dedupe there.
  let normalizedCodeHash = null;
  let encouragementMessage = null;

  if (status !== "Accepted") {
    normalizedCodeHash = hashNormalizedCode(code, language);

    // Most recent non-Accepted attempt by this user on this exact problem —
    // used to decide whether this is "the same wrong code again" (reuse its
    // message) or "an actual new attempt" (pick a different one).
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

  return Submission.create({
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
}

// ── POST /api/submissions ────────────────────────────────────────────────────
// REMOVED as a client-writable endpoint (see recordVerifiedSubmission's
// comment above for why). The route itself now returns 410 Gone — see
// backend/routes/submissions.js — this handler is kept only so any stray
// import doesn't break the build, and to give a clear error if something
// still references it directly instead of through the route.
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
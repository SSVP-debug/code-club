import mongoose from "mongoose";
import { callJudge0 } from "./compilerController.js";
import Problem from "../models/Problem.js";
import { recordVerifiedSubmission } from "./submissionController.js";
import { awardContestSolve } from "../services/contestScoring.js";
import { awardBattleRoomSolve } from "../services/battleRoomScoring.js";
import { qualifyReferralIfFirstSolve } from "../services/referralQualification.js";
import { canAccessContestProblem } from "../services/contestProblemAccess.js";
import { LANGUAGE_KEY_TO_ID } from "../config/languages.js";

/**
 * Sanitize stderr output from Judge0 before sending to the client.
 * Strips internal system paths, env variable names, and other runtime
 * internals that shouldn't be exposed in a browser console.
 */
const EXECUTION_QUEUE_ERROR_CODES = new Set([
  "EXECUTION_COORDINATION_UNAVAILABLE",
  "EXECUTION_CAPACITY_EXCEEDED",
]);

function respondExecutionUnavailable(res, err) {
  if (!EXECUTION_QUEUE_ERROR_CODES.has(err?.code)) return null;
  res.setHeader?.("Retry-After", "2");
  return res.status(503).json({
    error: "Code execution is temporarily unavailable. Please retry shortly.",
    code: err.code,
  });
}

function sanitizeStderr(stderr) {
  if (!stderr) return null;

  return stderr
    .replace(/\/[a-zA-Z0-9._/-]{5,}/g, "[path]")
    .replace(/[A-Z]:\\[^\s]+/g, "[path]")
    .trim();
}

// ── runHandler ───────────────────────────────────────────────────────────────
// "Run" mode: preview against visible/custom testcases the client already
// has (no credit is granted here — see submitHandler for actual grading).
//
// The execution CONTRACT (functionName/returnType/comparisonMode/
// operationSequence), however, is resolved server-side from the problem's
// own record whenever `problemSlug` is provided — mirroring submitHandler's
// trust model exactly (audit finding P1-1: previously Run trusted whatever
// the client sent for these fields; nothing enforced that a Run preview
// used the same contract Submit would actually grade against). Falls back
// to client-sent values only if `problemSlug` is omitted entirely, so a
// caller that genuinely has no saved problem (e.g. a future "scratch code"
// feature) doesn't hard-break.
export async function runHandler(req, res) {
  const { code, language, testcases, problemSlug } = req.body;
  let { functionName, returnType, comparisonMode, operationSequence } = req.body;

  // Empty testcases → nothing to run. Checked before the (otherwise
  // wasted) problem lookup below — see audit finding P2-2.
  if (!testcases || testcases.length === 0) {
    return res.json({ results: [], compileFailed: false });
  }

  if (problemSlug) {
    const problem = await Problem.findOne({ slug: problemSlug });

    if (!problem) {
      return res.status(404).json({
        error: `Problem "${problemSlug}" not found.`,
        results: [],
        compileFailed: false,
      });
    }

    // ── Availability gate (Content & Execution Architecture, Phase 1) ─────
    // A disabled problem must never reach Judge0 via Run either. Same
    // generic "not found" shape as the real not-found case just above —
    // deliberately indistinguishable, same reasoning as the contest gate
    // right below (don't confirm existence to a caller not entitled to it).
    if (problem.enabled === false) {
      return res.status(404).json({
        error: `Problem "${problemSlug}" not found.`,
        results: [],
        compileFailed: false,
      });
    }

    // ── Contest access gate (Fest Readiness Audit, P0-2) ──────────────────
    // Protecting the problem-detail endpoint alone isn't enough: without
    // this check, a private contest problem's own execution contract
    // (functionName/returnType/etc., resolved from `problem` above) could
    // still be pre-solved through a direct Run call before the contest
    // even opens. Same 404 shape as "problem not found" — deliberately
    // generic, so this doesn't confirm the problem exists to a caller who
    // isn't entitled to it. See services/contestProblemAccess.js.
    if (problem.visibility === "contest") {
      const allowed = await canAccessContestProblem(problemSlug, req.userDoc);
      if (!allowed) {
        return res.status(404).json({
          error: `Problem "${problemSlug}" not found.`,
          results: [],
          compileFailed: false,
        });
      }
    }

    functionName = problem.functionName;
    // Plan 011: Problem.returnType is a Mongoose Map (registry-validated
    // against STATICALLY_TYPED_LANGUAGE_KEYS), not a fixed-field
    // sub-document — a live Map instance doesn't expose keys via bracket
    // access the way the old sub-document shape did, so this must be
    // `.get(language)`, not `?.[language]` (which would silently and
    // permanently return undefined here, with no error, disabling the
    // declared-contract path entirely).
    returnType = problem.returnType?.get(language) || undefined;
    comparisonMode = problem.comparisonMode || "exact";
    operationSequence = problem.operationSequence?.enabled ? problem.operationSequence : undefined;
  }

  const languageId = LANGUAGE_KEY_TO_ID[language];
  const results = [];

  for (const [index, testcase] of testcases.entries()) {
    const r = await runTestcase({
      testcase, index, isVisible: true,
      code, language, languageId, functionName, returnType, comparisonMode, operationSequence,
    });

    if (r.kind === "callError" || r.kind === "noResult") {
      const unavailable = respondExecutionUnavailable(res, r.error);
      if (unavailable) return unavailable;
      return res.json({ error: r.errorMessage, results, compileFailed: false });
    }

    // Compile error on first testcase aborts all — no point running rest.
    if (r.kind === "compileError") {
      return res.json({ error: r.errorMessage, compileFailed: true, results });
    }

    // A genuine platform/runtime error (Judge0-level stderr — NOT the
    // driver's own caught "RUNTIME_ERROR:" text, which prints to stdout
    // and is compared normally, surfacing as "wrongAnswer" instead; the
    // frontend already detects that prefix client-side in `.actual` — see
    // TestcaseResultPanel.jsx). Distinguishing infra vs. plain runtime
    // error (audit P1-4) now uses the exact same classification
    // submitHandler already relies on, instead of a separate, coarser
    // `!!result.stderr` check.
    const isGenuineError = r.kind === "infraError" || r.kind === "runtimeError";

    req.log.debug(
      { testcaseIndex: index + 1, kind: r.kind },
      "[Run] Testcase result"
    );

    results.push({
      index,
      input: testcase.input,
      expected: testcase.expectedOutput,
      actual: (r.actualOutput ?? "").trim(),
      passed: r.kind === "passed",
      error: isGenuineError ? r.errorMessage : null,
      time: r.time,
      memory: r.memory,
    });

    if (isGenuineError) {
      return res.json({ results, compileFailed: false });
    }
  }

  return res.json({ results, compileFailed: false });
}

function normalizeOutput(output) {
  return String(output ?? "")
    .trim()
    .replace(/\r\n/g, "\n");
}

// Canonical, order-independent key for one array element — used only to
// pair up elements between expected/actual when comparisonMode is
// "unordered". Sorting by JSON.stringify is enough to detect "same
// multiset of elements, different order"; it doesn't need to be a
// meaningful/natural sort, just a deterministic one so equal elements land
// at the same position on both sides.
function sortForUnorderedComparison(arr) {
  return [...arr].map((el) => JSON.stringify(el)).sort();
}

// `comparisonMode` — "exact" (default) or "unordered". "unordered" only
// relaxes ordering of the TOP-LEVEL array; nested structure within each
// element is still compared in its original order. See audit finding P0-3
// and Problem.comparisonMode's doc comment in backend/models/Problem.js.
function outputsMatch(expected, actual, comparisonMode = "exact") {
  try {
    const expectedParsed = JSON.parse(expected);
    const actualParsed = JSON.parse(actual);

    if (
      comparisonMode === "unordered" &&
      Array.isArray(expectedParsed) &&
      Array.isArray(actualParsed)
    ) {
      if (expectedParsed.length !== actualParsed.length) return false;

      return (
        JSON.stringify(sortForUnorderedComparison(expectedParsed)) ===
        JSON.stringify(sortForUnorderedComparison(actualParsed))
      );
    }

    return JSON.stringify(expectedParsed) === JSON.stringify(actualParsed);
  } catch {
    return normalizeOutput(expected)
      === normalizeOutput(actual);
  }
}

// Content & Execution Architecture, Phase 2: this used to be a
// locally-declared literal (`languageIdMap = { python: 71, ... }`) — a
// prior, narrower-scoped task ("Judge0 Integration Hardening") deliberately
// left it untouched because it wasn't validating arbitrary client-provided
// IDs the way routes/compiler.js was, so it wasn't exposed to that
// specific vulnerability. This phase's actual mandate — one authoritative
// language registry, no duplicated declarations — is the concrete reason
// to finish that consolidation now: this now imports LANGUAGE_KEY_TO_ID
// from config/languages.js instead. Same 4 values, single source.

/**
 * Runs a single testcase through Judge0 and normalizes the outcome into a
 * uniform { index, isVisible, kind, ... } shape, regardless of whether
 * this call happens sequentially or concurrently with others. `kind` is
 * one of: "callError" | "noResult" | "compileError" | "infraError" |
 * "runtimeError" | "wrongAnswer" | "passed".
 */
async function runTestcase({ testcase, index, isVisible, code, language, languageId, functionName, returnType, comparisonMode, operationSequence }) {
  let result;
  try {
    result = await callJudge0({
      sourceCode: code,
      language,
      languageId,
      testcaseInput: testcase.input,
      functionName,
      returnType,
      operationSequence,
    });
  } catch (callErr) {
    return {
      index,
      isVisible,
      kind: "callError",
      error: callErr,
      // Integration-audit fix: this used to be `callErr.message` directly.
      // That's an infrastructure-level error message — e.g. fetchJudge0's
      // own `Judge0 returned HTTP ${status}: ${raw}` construction embeds
      // Judge0's raw response body verbatim, and a network-level failure
      // can carry connection details in its message — and unlike stderr
      // (sanitized via sanitizeStderr() above), it was never redacted
      // before being persisted to the Submission document AND returned
      // directly in the client-facing JSON response (see finish()'s
      // `res.json({ status, ...payload, ...responseExtras })`). The full
      // original error is still captured server-side via the req.log.error
      // call at this failure's call site — this field is only what's
      // ever shown to the client, which must never carry raw Judge0/
      // network internals. There's no user-actionable content lost here:
      // an infra failure isn't something the user can fix by reading the
      // raw error, unlike a compile error.
      errorMessage: "Failed to reach the code execution service. Please try again.",
    };
  }

  if (!result) {
    return { index, isVisible, kind: "noResult", errorMessage: "Judge0 returned no result" };
  }

  // Carried on every returned kind (not just wrongAnswer) so callers that
  // need per-testcase display data — e.g. runHandler's Run-mode response,
  // which predates submitHandler's summary-only needs — don't have to
  // duplicate this function just to get at time/memory/raw stdout.
  const time = result.time ?? null;
  const memory = result.memory ?? null;

  if (result.compile_output) {
    return { index, isVisible, kind: "compileError", errorMessage: result.compile_output, time, memory };
  }

  if (result.stderr) {
    const isInfra = /code runner unavailable|ECONNREFUSED|502|fetch failed/i.test(result.stderr);
    return {
      index,
      isVisible,
      kind: isInfra ? "infraError" : "runtimeError",
      errorMessage: sanitizeStderr(result.stderr),
      actualOutput: result.stdout || "",
      time,
      memory,
    };
  }

  const expected = normalizeOutput(JSON.stringify(testcase.expectedOutput));
  const actual = normalizeOutput(result.stdout || "");

  if (!outputsMatch(expected, actual, comparisonMode)) {
    return {
      index,
      isVisible,
      kind: "wrongAnswer",
      expectedOutput: testcase.expectedOutput,
      actualOutput: result.stdout || "",
      time,
      memory,
    };
  }

  return { index, isVisible, kind: "passed", actualOutput: result.stdout || "", time, memory };
}

// ── submitHandler ─────────────────────────────────────────────────────────────
// Exported (not just registered inline) so it can be unit-tested directly
// with constructed req/res objects, without needing a running HTTP server
// or an extra test-only dependency like supertest.
//
// This is the ONLY code path that grades a submission AND the ONLY code
// path that writes a Submission document (via recordVerifiedSubmission) —
// see controllers/submissionController.js for why that consolidation
// matters. Every `finish()` call below persists the actual, just-computed
// grading result before responding; nothing here is client-supplied.
export async function submitHandler(req, res) {
  const { problemSlug, code, language, visibletestcases, contestId, battleRoomId } = req.body;

  // ── Malformed optional scoring-reference guard (integration-audit fix) ──
  // BUG FOUND & FIXED: contestId/battleRoomId are optional, client-sent,
  // and were passed straight into recordVerifiedSubmission() below, whose
  // Submission.create() call types them as strict Mongoose ObjectIds. A
  // malformed string there (e.g. "not-a-valid-object-id") threw a
  // CastError INSIDE the same try/catch that guards Submission
  // persistence itself — silently discarding the entire Submission row
  // for an otherwise-real, server-computed Accepted verdict. The contest/
  // battle-room SCORING attempt (awardContestSolve/awardBattleRoomSolve,
  // further below) already degrades this exact same malformed-ID case
  // correctly via its own separate try/catch (Contest.findById/
  // BattleRoom.findById throw the same CastError, caught there and
  // reported as `{ scored: false, reason: "error" }`) — so only the
  // Submission-persistence path needed fixing, not scoring. Sanitized
  // once here, used only for persistence below; the raw (possibly
  // malformed) contestId/battleRoomId are left untouched for the scoring
  // blocks, which already handle them correctly.
  const persistedContestId = mongoose.isValidObjectId(contestId) ? contestId : null;
  const persistedBattleRoomId = mongoose.isValidObjectId(battleRoomId) ? battleRoomId : null;

  // ── Load hidden testcases ──────────────────────────────────────────────
  const problem = await Problem.findOne({
    slug: problemSlug,
  });

  if (!problem) {
    return res.status(404).json({
      error: `Problem "${problemSlug}" not found.`,
    });
  }

  // ── Availability gate (Content & Execution Architecture, Phase 1) ───────
  // A disabled problem must never be gradeable via Submit either — same
  // generic "not found" shape as above, and checked before the contest
  // gate below for the same "kill switch takes priority" reasoning as
  // runHandler above.
  if (problem.enabled === false) {
    return res.status(404).json({
      error: `Problem "${problemSlug}" not found.`,
    });
  }

  // ── Contest access gate (Fest Readiness Audit, P0-2) ────────────────────
  // Same reasoning as runHandler's identical check above — a private
  // contest problem must not be directly submittable before its contest
  // window either, even by someone who already knows the slug. Generic
  // 404, same shape as "problem not found," on purpose.
  if (problem.visibility === "contest") {
    const allowed = await canAccessContestProblem(problemSlug, req.userDoc);
    if (!allowed) {
      return res.status(404).json({
        error: `Problem "${problemSlug}" not found.`,
      });
    }
  }

  // ── Hidden testcase set gate (Content & Execution Architecture, Phase 3) ─
  // Two independent checks, deliberately in this order:
  //
  // 1. Fail CLOSED if the set has been explicitly disabled. This must
  //    never be confused with "no hidden testcases exist" (check #2,
  //    pre-existing) — a disabled set is an operator decision to pause
  //    grading, not an authoring gap, so it gets its own distinct error
  //    shape/status so the frontend can show something like "grading is
  //    temporarily unavailable for this problem" rather than the generic
  //    "not found" a missing problem/language/contest-access gate returns.
  //    Explicitly does NOT fall back to grading only visibletestcases, and
  //    does NOT return Accepted — either would silently change what
  //    "Accepted" means for this problem while the toggle is off.
  //    `?? true` treats a pre-Phase-3 or not-yet-migrated document (no
  //    `hiddenTestcaseSet` at all) as enabled — same "missing means
  //    enabled" reasoning as `Problem.enabled` elsewhere in this file.
  const hiddenTestcaseSetEnabled = problem.hiddenTestcaseSet?.enabled ?? true;
  if (!hiddenTestcaseSetEnabled) {
    req.log.error(
      { problemSlug },
      "[Judge] hiddenTestcaseSet is disabled — grading unavailable, failing closed"
    );
    return res.status(503).json({
      error: `Grading is temporarily unavailable for "${problemSlug}".`,
      code: "HIDDEN_TESTCASES_DISABLED",
    });
  }

  // 2. Pre-existing guard, unchanged in spirit: an *enabled* set with zero
  //    testcases in it is an authoring gap (nothing to grade against), not
  //    an operator decision — kept as its own 404, distinct from #1 above.
  const hidden = problem.hiddenTestcaseSet?.testcases ?? [];

  if (hidden.length === 0) {
    return res.status(404).json({
      error: `No hidden testcases configured for "${problemSlug}".`,
    });
  }

  const languageId = LANGUAGE_KEY_TO_ID[language];
  const alltestcases = [...visibletestcases, ...hidden];

  // functionName — resolved from the problem's own record, never trusted
  // from the client, exactly like returnType/comparisonMode/
  // operationSequence just below. Brings Submit's trust model in line
  // with Run's (see runHandler above and its `problemSlug` doc comment):
  // previously this was the one execution-contract field Submit still
  // read from req.body, which meant a stale/mismatched client value
  // could theoretically drive grading even though the client already
  // has no ability to influence returnType/comparisonMode/
  // operationSequence. functionName itself was never client-writable in
  // practice (the frontend always sends problem.functionName from the
  // same record this resolves to), so this is a defense-in-depth/
  // consistency fix, not a fix for an observed bad-data incident.
  const functionName = problem.functionName;

  // Declared return type for this language, from the problem's own contract
  // (never from the client — submit-mode grading only trusts what's stored
  // server-side). Undefined for python/javascript or for problems that
  // haven't declared a contract yet; generateDriverCode falls back to its
  // regex inference in that case.
  // Plan 011: see the identical comment on the other `problem.returnType`
  // read above (runHandler) — same Map-vs-sub-document reasoning applies
  // here in submitHandler.
  const returnType = problem.returnType?.get(language) || undefined;

  // Output comparison mode — see Problem.comparisonMode's doc comment and
  // audit finding P0-3. Server-side only, same trust model as returnType
  // above: a submission's grading must not depend on anything the client
  // sends beyond the code itself.
  const comparisonMode = problem.comparisonMode || "exact";

  // Operation-sequence contract opt-in — see Problem.operationSequence's
  // doc comment and audit finding P0-2. Server-side only, same trust
  // model as returnType/comparisonMode above.
  const operationSequence = problem.operationSequence?.enabled
    ? problem.operationSequence
    : undefined;

  // ── CRITICAL GUARD: empty testcases → would silently return Accepted ──
  if (alltestcases.length === 0) {
    req.log.error({ problemSlug }, "[Judge] No testcases found — CRITICAL: would silently return Accepted without this guard");
    return res.status(500).json({
      error: `Judge has no testcases to run for "${problemSlug}".`,
    });
  }

  req.log.debug(
    {
      problemSlug,
      language,
      visibleCount: visibletestcases.length,
      hiddenCount: hidden.length,
      totalCount: alltestcases.length,
    },
    "[Judge] Submission received"
  );

  const startTime = Date.now();
  let passedCount = 0;
  let visiblePassed = 0;
  let hiddenPassed = 0;

  // ── finish(): the single exit point for this handler ───────────────────
  // Persists the graded result (best-effort — a Mongo hiccup must not turn
  // a successful/valid grading run into a 500 for the user) and THEN
  // responds. Persistence is awaited before res.json() so that by the time
  // the client receives this response, the Submission row already exists —
  // the frontend's next call (PUT /api/progress, to update solved/XP state)
  // depends on being able to find it immediately (see routes/progress.js's
  // verifyAgainstSubmissions middleware).
  async function finish(status, payload, submissionExtra = {}) {
    // ── Submission Experience fields ──────────────────────────────────────
    // submissionId lets the frontend attach a Reflection Score to THIS
    // exact submission (see routes/reflections.js). encouragementMessage
    // is the (possibly deduped) copy computed inside recordVerifiedSubmission
    // for non-Accepted results — see utils/encouragementMessages.js.
    // Both are best-effort: a persistence hiccup below must not turn a
    // successfully-graded submission into a failed response for the user,
    // so they're simply omitted from the payload if the write failed.
    let responseExtras = {};

    if (req.userDoc) {
      try {
        const submissionDoc = await recordVerifiedSubmission({
          userId: req.userDoc._id,
          problemSlug,
          problemTitle: problem.title,
          language,
          code,
          status,
          passed: payload.passed ?? passedCount,
          total: payload.total ?? alltestcases.length,
          visiblePassed: submissionExtra.visiblePassed ?? visiblePassed,
          hiddenPassed: submissionExtra.hiddenPassed ?? hiddenPassed,
          executionTime: payload.executionTime ?? null,
          expectedOutput: submissionExtra.expectedOutput,
          actualOutput: submissionExtra.actualOutput,
          contestId: persistedContestId,
          battleRoomId: persistedBattleRoomId,
          problemVersion: problem.contentVersion,
        });

        responseExtras.submissionId = submissionDoc._id.toString();
        if (submissionDoc.encouragementMessage) {
          responseExtras.encouragementMessage = submissionDoc.encouragementMessage;
        }
      } catch (err) {
        req.log.error({ err, problemSlug, status }, "[Judge] Failed to persist submission record");
      }

      // ── Contest scoring (Fest Readiness Audit, P0-1) ─────────────────────
      // The ONLY trusted trigger for contest credit: this runs immediately
      // after THIS server just computed "Accepted" itself via Judge0 above
      // — never from a bare client claim. See services/contestScoring.js.
      // Best-effort and isolated from the Submission-persistence try/catch
      // above: a scoring hiccup must not be reported to the user as a
      // failed/incorrect grading result (the verdict itself is already
      // real and already returned), and a Submission-persistence failure
      // must not by itself prevent a scoring attempt (the Accepted verdict
      // is still just as real either way).
      if (status === "Accepted" && contestId) {
        try {
          const result = await awardContestSolve({
            contestId,
            userId: req.userDoc._id,
            slug: problemSlug,
          });

          if (result.ok) {
            responseExtras.contest = {
              scored: true,
              alreadySolved: result.alreadySolved,
              score: result.score,
            };
          } else {
            req.log.warn(
              { problemSlug, contestId, reason: result.reason },
              "[Judge] Accepted submission did not qualify for contest credit"
            );
            responseExtras.contest = { scored: false, reason: result.reason };
          }
        } catch (err) {
          req.log.error(
            { err, problemSlug, contestId },
            "[Judge] Failed to record contest score"
          );
          responseExtras.contest = { scored: false, reason: "error" };
        }
      }

      // ── Battle Room scoring ───────────────────────────────────────────────
      // Same trust model as contest scoring immediately above: the ONLY
      // trigger for Battle Room credit is THIS server having just computed
      // "Accepted" itself via Judge0 — never a bare client claim. See
      // services/battleRoomScoring.js. Best-effort and isolated for the
      // same reasons as the contest block: a scoring hiccup must not turn
      // a real, already-returned Accepted verdict into a failure for the
      // user, and a Submission-persistence failure above must not by
      // itself block a scoring attempt.
      if (status === "Accepted" && battleRoomId) {
        try {
          const result = await awardBattleRoomSolve({
            battleRoomId,
            userId: req.userDoc._id,
            slug: problemSlug,
          });

          if (result.ok) {
            responseExtras.battleRoom = {
              scored: true,
              alreadySolvedPersonally: result.alreadySolvedPersonally,
              countedForTeam: result.countedForTeam,
              teamScore: result.teamScore,
              teamIndex: result.teamIndex,
            };
          } else {
            req.log.warn(
              { problemSlug, battleRoomId, reason: result.reason },
              "[Judge] Accepted submission did not qualify for Battle Room credit"
            );
            responseExtras.battleRoom = { scored: false, reason: result.reason };
          }
        } catch (err) {
          req.log.error(
            { err, problemSlug, battleRoomId },
            "[Judge] Failed to record Battle Room score"
          );
          responseExtras.battleRoom = { scored: false, reason: "error" };
        }
      }
      // ── Referral Qualification (Plan 2) ─────────────────────────────────
      // Same trust model as contest/battle-room scoring immediately above:
      // the ONLY trigger is THIS server having just computed "Accepted"
      // itself via Judge0 — never a bare client claim. See
      // services/referralQualification.js for the full "why this event,
      // why here, why practice-only" reasoning. Awaited (not
      // fire-and-forget) for the same reason contest/battle-room scoring
      // above is awaited: it keeps this deterministic before the response
      // is sent. Best-effort and isolated, same as both blocks above: a
      // qualification-check hiccup must not turn a real, already-returned
      // Accepted verdict into a failure for the user — the
      // qualification/reward result itself is intentionally NOT included
      // in the response payload (unlike contest/battleRoom above), since
      // it's the referrer's/referred user's reward status, not something
      // this submitter needs to see synchronously.
      //
      // Practice-only scope: gated on persistedContestId/persistedBattleRoomId
      // (the validated, actually-persisted values — see this function's own
      // top-of-file variable, not the raw, client-sent contestId/battleRoomId
      // used by the scoring blocks above) both being null. A Contest or
      // Battle Room Accepted submission never reaches this check at all —
      // Contest/Battle Room scoring stays entirely separate, per Code
      // Club's stated preferred product behavior.
      if (
        status === "Accepted" &&
        responseExtras.submissionId &&
        !persistedContestId &&
        !persistedBattleRoomId
      ) {
        try {
          await qualifyReferralIfFirstSolve({
            userId: req.userDoc._id,
            submissionId: responseExtras.submissionId,
          });
        } catch (err) {
          req.log.error(
            { err, problemSlug },
            "[Judge] Referral qualification check failed"
          );
        }
      }
    }

    return res.json({ status, ...payload, ...responseExtras });
  }

  try {
    // Run the first testcase alone. This preserves the original cost
    // profile for the most common failure modes (bad syntax, or a
    // solution that's wrong on the very first case) — a single Judge0
    // call, same as the old fully-sequential loop would have made,
    // instead of firing every testcase at once and paying for N compile
    // failures when the code doesn't even build.
    const first = await runTestcase({
      testcase: alltestcases[0],
      index: 0,
      isVisible: 0 < visibletestcases.length,
      code, language, languageId, functionName, returnType, comparisonMode, operationSequence,
    });

    let allResults;

    if (first.kind !== "passed" || alltestcases.length === 1) {
      allResults = [first];
    } else {
      // First testcase compiled and passed — the code builds. Run the
      // rest concurrently (throttled system-wide by the fixed
      // services/directExecutionQueue.js semaphore) since a compile
      // failure is no longer the dominant risk; only a per-input runtime
      // error or wrong answer can still occur independently on any one
      // of them.
      const rest = alltestcases.slice(1);
      const restResults = await Promise.all(
        rest.map((testcase, i) => {
          const index = i + 1;
          return runTestcase({
            testcase,
            index,
            isVisible: index < visibletestcases.length,
            code, language, languageId, functionName, returnType, comparisonMode, operationSequence,
          });
        })
      );
      allResults = [first, ...restResults];
    }

    // Walk results in canonical index order (not completion order) to
    // find the first failure — this matches the original "stop at first
    // failure" semantics exactly, even though every testcase actually ran
    // (see runTestcase's docstring for the callError/noResult/etc. kinds).
    let failure = null;

    for (const r of allResults) {
      if (r.kind === "passed") {
        passedCount++;
        if (r.isVisible) visiblePassed++;
        else hiddenPassed++;
      } else {
        failure = r;
        break;
      }
    }

    if (failure) {
      if (failure.kind === "callError") {
        const unavailable = respondExecutionUnavailable(res, failure.error);
        if (unavailable) return unavailable;
      }

      req.log.debug(
        {
          problemSlug,
          testcaseIndex: failure.index + 1,
          totalCount: alltestcases.length,
          kind: failure.kind,
        },
        "[Judge] Testcase result"
      );

      if (failure.kind === "callError") {
        req.log.error(
          { err: failure.error, problemSlug, testcaseIndex: failure.index },
          "[Judge] callJudge0 threw"
        );
        return finish("Judge Error", {
          passed: passedCount,
          total: alltestcases.length,
          error: failure.errorMessage,
        });
      }

      if (failure.kind === "noResult") {
        return finish("Judge Error", {
          passed: passedCount,
          total: alltestcases.length,
          error: failure.errorMessage,
        });
      }

      if (failure.kind === "compileError") {
        return finish("Compilation Error", {
          passed: passedCount,
          total: alltestcases.length,
          error: failure.errorMessage,
        });
      }

      if (failure.kind === "infraError" || failure.kind === "runtimeError") {
        return finish(failure.kind === "infraError" ? "Judge Error" : "Runtime Error", {
          passed: passedCount,
          total: alltestcases.length,
          error: failure.errorMessage,
        });
      }

      // failure.kind === "wrongAnswer"
      return finish(
        "Wrong Answer",
        {
          passed: passedCount,
          total: alltestcases.length,
          visiblePassed,
          hiddenPassed,
          executionTime: String(Date.now() - startTime),
          ...(failure.isVisible ? {
            expectedOutput: failure.expectedOutput,
            actualOutput: failure.actualOutput,
          } : {}),
        },
        {
          visiblePassed,
          hiddenPassed,
          // Submission history stores expected/actual regardless of
          // visibility (it's the user's own past attempt, not a live
          // hidden-testcase leak to other users) — only the *response*
          // withholds it for hidden failures, per failure.isVisible above.
          expectedOutput: failure.expectedOutput,
          actualOutput: failure.actualOutput,
        }
      );
    }

    req.log.info(
      { problemSlug, judge0Status: "Accepted", passedCount, totalCount: alltestcases.length },
      "[Judge] Submission accepted"
    );

    return finish(
      "Accepted",
      {
        passed: passedCount,
        total: alltestcases.length,
        visiblePassed,
        hiddenPassed,
        executionTime: String(Date.now() - startTime),
      },
      { visiblePassed, hiddenPassed }
    );

  } catch (err) {
    const unavailable = respondExecutionUnavailable(res, err);
    if (unavailable) return unavailable;
    req.log.error({ err, problemSlug }, "[Judge] Unhandled error during grading");
    return finish("Judge Error", {
      passed: passedCount,
      total: alltestcases.length,
      error: "An unexpected error occurred during judging.",
    });
  }
}
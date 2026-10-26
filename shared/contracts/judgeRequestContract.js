/**
 * judgeRequestContract.js
 *
 * THE canonical request-body shape for POST /api/judge/run and
 * POST /api/judge/submit — the "Judge execution contract" (execution-
 * contract audit, item #3).
 *
 * Added after a production incident where the two sides of this
 * contract silently drifted apart:
 *
 *   - src/services/judgeService.js's runTestcases() was deliberately
 *     changed to stop sending `functionName` on Run, once
 *     backend/controllers/judgeController.js's runHandler started
 *     resolving it server-side from `problemSlug` (audit finding P1-1
 *     — never trust the client for the execution contract).
 *   - backend/routes/judge.js's Zod `runSchema`, however, still
 *     declared `functionName` as REQUIRED. validateBody() rejected
 *     every real Run request with a 400 before runHandler's resolution
 *     logic ever got a chance to run — surfaced to students as
 *     "Runner Unavailable."
 *
 * Nothing enforced that the object judgeService.js builds and the
 * object judge.js's Zod schema validates were the same shape, because
 * each side defined it independently. This module is the fix for
 * that: ONE plain-JS (no framework/runtime deps — safe to import from
 * both a Vite/browser bundle and a Node/Express backend) builder that
 * both sides use, so a future field being added/removed only has to
 * change in one place, and backend/routes/judge.contract.test.js can
 * assert this exact shape against the real Zod schema in CI.
 *
 * If you add or remove a field from what Run/Submit needs, change it
 * HERE first, then update:
 *   - backend/routes/judge.js (Zod runSchema/submitSchema)
 *   - backend/controllers/judgeController.js (runHandler/submitHandler)
 *   - backend/routes/judge.contract.test.js
 * in the same change. That's the whole point of this file existing.
 */

/**
 * Fields the backend's Zod `runSchema` (backend/routes/judge.js) always
 * requires, regardless of whether problemSlug is present. Exported so
 * both a frontend pre-flight guard (judgeService.js) and a backend
 * contract test can check the same list instead of two hand-maintained
 * copies.
 */
export const RUN_ALWAYS_REQUIRED_FIELDS = ["code", "language", "testcases"];

/**
 * Builds the POST /api/judge/run request body.
 *
 * `functionName` is intentionally NOT included when `problem.slug` is
 * present — runHandler resolves it (and returnType/comparisonMode/
 * operationSequence) server-side from the problem's own record, and a
 * client-sent value for any of those is ignored whenever problemSlug
 * is set (audit finding P1-1). `problemSlug` is therefore the one
 * field that must always be present for a real (non-scratch) problem —
 * see backend/routes/judge.js's `.refine()` on runSchema, which
 * enforces "problemSlug OR functionName" as the actual requirement.
 *
 * @param {{ problem: { slug: string, testcases?: Array }, code: string, language: string }} args
 */
export function buildRunRequestBody({ problem, code, language }) {
  return {
    problemSlug: problem.slug,
    code,
    language,
    testcases: problem.testcases || [],
  };
}

/**
 * Builds the POST /api/judge/submit request body.
 *
 * `functionName` IS still included here (unlike Run) for backward
 * compatibility with any other current/future caller of submitSchema,
 * but backend/controllers/judgeController.js's submitHandler ignores
 * it and resolves functionName from `problem.functionName` itself once
 * the problem is loaded — the same trust model as returnType/
 * comparisonMode/operationSequence, now applied consistently across
 * both Run and Submit.
 *
 * @param {{ problem: { slug: string, functionName: string, testcases?: Array }, code: string, language: string, contestId?: string }} args
 */
export function buildSubmitRequestBody({
  problem,
  code,
  language,
  battleRoomId,
}) {
  const body = {
    problemSlug: problem.slug,
    code,
    language,
    // Submit's backend schema and submitHandler use this exact field name.
    // Do not send the Run-mode "testcases" field here.
    visibletestcases: Array.isArray(problem.testcases) ? problem.testcases : [],
  };

  if (battleRoomId !== undefined) {
    body.battleRoomId = battleRoomId;
  }

  return body;
}
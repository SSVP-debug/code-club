import { describe, expect, it } from "vitest";
import { runSchema, submitSchema } from "./judge.js";
import {
  buildRunRequestBody,
  buildSubmitRequestBody,
  RUN_ALWAYS_REQUIRED_FIELDS,
} from "../../shared/contracts/judgeRequestContract.js";

/**
 * judge.contract.test.js
 *
 * Execution-contract audit, item #16 — the actual root-cause postmortem
 * for the "single-number" incident:
 *
 *   src/services/judgeService.js's runTestcases() and
 *   backend/routes/judge.js's `runSchema` each independently defined
 *   what a Run request looks like. They drifted apart — the frontend
 *   stopped sending `functionName` (correctly, once server-side
 *   resolution shipped) but the schema still required it — and nothing
 *   in the test suite would have caught that, because
 *   src/services/judgeService.test.js only ever mocks `apiFetch` (never
 *   touches the real schema) and backend/controllers/runHandler.test.js
 *   only ever calls `runHandler` directly (bypassing `validateBody`
 *   entirely).
 *
 * This file closes that gap: it builds a request body with the exact
 * same shared function judgeService.js itself calls
 * (shared/contracts/judgeRequestContract.js), then feeds it straight
 * into the real `runSchema`/`submitSchema` Zod objects imported from
 * judge.js. If a future change to either side breaks the contract —
 * the shared builder starts omitting something the schema requires, or
 * the schema starts requiring something the builder doesn't send —
 * this test fails in CI instead of surfacing as "Runner Unavailable"
 * in production.
 */

describe("Judge execution contract: frontend request shape vs backend schema", () => {
  const problem = {
    slug: "single-number",
    functionName: "singleNumber",
    testcases: [{ input: { nums: [4, 1, 2, 1, 2] }, expectedOutput: 4 }],
  };

  describe("POST /api/judge/run", () => {
    it("REGRESSION (the actual incident): a real Run request — built the same way the frontend builds it, with problemSlug but WITHOUT functionName — passes validation", () => {
      const body = buildRunRequestBody({
        problem,
        code: "class Solution:\n    def singleNumber(self, nums):\n        pass",
        language: "python",
      });

      // This is exactly the payload the browser console showed being
      // rejected with "Invalid input: expected string, received
      // undefined" before this fix.
      expect(body.functionName).toBeUndefined();
      expect(body.problemSlug).toBe("single-number");

      const result = runSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it("still rejects a request with neither problemSlug nor functionName — there'd be nothing for runHandler to resolve a contract from", () => {
      const result = runSchema.safeParse({
        code: "print(1)",
        language: "python",
        testcases: [{ input: {}, expectedOutput: 1 }],
      });

      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toEqual(["functionName"]);
    });

    it("accepts a scratch/no-problemSlug request that DOES supply functionName directly (backward-compat fallback path)", () => {
      const result = runSchema.safeParse({
        code: "print(1)",
        language: "python",
        functionName: "solve",
        testcases: [{ input: {}, expectedOutput: 1 }],
      });

      expect(result.success).toBe(true);
    });

    for (const field of RUN_ALWAYS_REQUIRED_FIELDS) {
      it(`still rejects a request missing "${field}" (validation was not weakened by this fix)`, () => {
        const body = buildRunRequestBody({ problem, code: "print(1)", language: "python" });
        delete body[field];

        const result = runSchema.safeParse(body);
        expect(result.success).toBe(false);
      });
    }

    it("produces a clear, non-generic error message when functionName/problemSlug are both missing (not the opaque zod-v4 default)", () => {
      const result = runSchema.safeParse({
        code: "print(1)",
        language: "python",
        testcases: [{ input: {}, expectedOutput: 1 }],
      });

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).not.toMatch(/received undefined/i);
      expect(result.error.issues[0].message).toMatch(/functionName/i);
    });

    it("rejects an unsupported language with a clear, non-generic message", () => {
      const body = buildRunRequestBody({ problem, code: "print(1)", language: "ruby" });
      const result = runSchema.safeParse(body);

      expect(result.success).toBe(false);
      // Was "...java, or cpp", then "...cpp, or typescript" (plan 010) —
      // updated again now that C is enabled too (plan 012, confirmed
      // against the real Judge0 instance via verifyLanguageRegistry.js).
      expect(result.error.issues[0].message).toBe(
        "language must be: python, javascript, java, cpp, c, or typescript"
      );
    });
  });

  describe("POST /api/judge/submit", () => {
    it("a real Submit request built via the shared contract passes validation", () => {
      const body = buildSubmitRequestBody({ problem, code: "...", language: "python" });
      const result = submitSchema.safeParse(body);

      expect(result.success).toBe(true);
    });

    it("still accepts a Submit request even if functionName is entirely absent — submitHandler resolves it server-side from the problem, same as Run now does", () => {
      const body = buildSubmitRequestBody({ problem, code: "...", language: "python" });
      delete body.functionName;

      const result = submitSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it("still rejects a Submit request missing problemSlug — Submit has no scratch-mode fallback", () => {
      const body = buildSubmitRequestBody({ problem, code: "...", language: "python" });
      delete body.problemSlug;

      const result = submitSchema.safeParse(body);
      expect(result.success).toBe(false);
    });

    it("produces a clear, non-generic error message for a missing problemSlug (not the opaque zod-v4 default)", () => {
      const body = buildSubmitRequestBody({ problem, code: "...", language: "python" });
      delete body.problemSlug;

      const result = submitSchema.safeParse(body);
      expect(result.error.issues[0].message).toBe("problemSlug is required");
    });

    it("a Submit request carrying battleRoomId passes validation, and battleRoomId is omitted entirely when not provided", () => {
      const withoutRoom = buildSubmitRequestBody({ problem, code: "...", language: "python" });
      expect(withoutRoom.battleRoomId).toBeUndefined();
      expect(submitSchema.safeParse(withoutRoom).success).toBe(true);

      const withRoom = buildSubmitRequestBody({
        problem, code: "...", language: "python",
        battleRoomId: "507f1f77bcf86cd799439011",
      });
      expect(withRoom.battleRoomId).toBe("507f1f77bcf86cd799439011");
      expect(submitSchema.safeParse(withRoom).success).toBe(true);
    });

    it("rejects a malformed battleRoomId rather than silently ignoring it", () => {
      const body = buildSubmitRequestBody({ problem, code: "...", language: "python" });
      body.battleRoomId = "not-a-real-object-id";

      const result = submitSchema.safeParse(body);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toEqual(["battleRoomId"]);
    });
  });
});
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../controllers/compilerController.js", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    callJudge0: vi.fn(),
  };
});

vi.mock("../models/Problem.js", () => ({
  default: { findOne: vi.fn() },
}));

import { callJudge0 } from "./compilerController.js";
import Problem from "../models/Problem.js";
import { runHandler } from "./judgeController.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("runHandler", () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("marks a testcase as passed when stdout matches expectedOutput exactly", async () => {
    callJudge0.mockResolvedValue({ stdout: JSON.stringify([0, 1]), stderr: null, compile_output: null });
    const req = {
      body: {
        code: "def twoSum(a): return [0,1]",
        language: "python",
        functionName: "twoSum",
        testcases: [{ input: { nums: [2, 7] }, expectedOutput: [0, 1] }],
      },
      log: mockLog(),
    };

    await runHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [expect.objectContaining({ passed: true })],
      })
    );
  });

  it("returns a retryable 503 when shared execution coordination is unavailable", async () => {
    const error = Object.assign(new Error("internal Redis detail"), {
      code: "EXECUTION_COORDINATION_UNAVAILABLE",
    });
    callJudge0.mockRejectedValue(error);
    const req = {
      body: {
        code: "def twoSum(a): return [0,1]",
        language: "python",
        functionName: "twoSum",
        testcases: [{ input: { nums: [2, 7] }, expectedOutput: [0, 1] }],
      },
      log: mockLog(),
    };

    await runHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Code execution is temporarily unavailable. Please retry shortly.",
      code: "EXECUTION_COORDINATION_UNAVAILABLE",
    });
  });

  // ── comparisonMode: "unordered" — audit finding P0-3 ─────────────────────
  it("passes a differently-ordered array on Run when comparisonMode is unordered", async () => {
    callJudge0.mockResolvedValue({ stdout: JSON.stringify([2, 1]), stderr: null, compile_output: null });
    const req = {
      body: {
        code: "...",
        language: "python",
        functionName: "topKFrequent",
        testcases: [{ input: { nums: [1, 1, 2] }, expectedOutput: [1, 2] }],
        comparisonMode: "unordered",
      },
      log: mockLog(),
    };

    await runHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [expect.objectContaining({ passed: true })],
      })
    );
  });

  it("still fails a differently-ordered array on Run when comparisonMode is absent (exact, default)", async () => {
    callJudge0.mockResolvedValue({ stdout: JSON.stringify([1, 0]), stderr: null, compile_output: null });
    const req = {
      body: {
        code: "...",
        language: "python",
        functionName: "twoSum",
        testcases: [{ input: { nums: [2, 7] }, expectedOutput: [0, 1] }],
      },
      log: mockLog(),
    };

    await runHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [expect.objectContaining({ passed: false })],
      })
    );
  });

  // ── Server-side contract resolution via problemSlug — audit finding P1-1 ─
  describe("problemSlug resolves the execution contract server-side", () => {
    it("ignores a client-sent comparisonMode when problemSlug is provided, using the problem's own instead", async () => {
      Problem.findOne.mockResolvedValue({
        functionName: "topKFrequent",
        // Plan 011: Problem.returnType is a real Mongoose Map on an actual
        // document (see judgeController.js's `.get(language)` read) —
        // this fixture models that shape rather than a plain `{}`, which
        // would throw ("...get is not a function") the moment
        // runHandler tries to read it, same as it would in production if
        // the model shape and the read shape ever disagreed.
        returnType: new Map(),
        comparisonMode: "unordered", // the problem's REAL contract
        operationSequence: { enabled: false },
      });
      callJudge0.mockResolvedValue({ stdout: JSON.stringify([2, 1]), stderr: null, compile_output: null });

      const req = {
        body: {
          code: "...",
          language: "python",
          problemSlug: "top-k-frequent-elements",
          testcases: [{ input: { nums: [1, 1, 2] }, expectedOutput: [1, 2] }],
          // Client tries to send "exact" — must be ignored in favor of the
          // problem's real "unordered" contract, exactly like Submit
          // already never trusted the client for this.
          comparisonMode: "exact",
        },
        log: mockLog(),
      };

      await runHandler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          results: [expect.objectContaining({ passed: true })],
        })
      );
    });

    it("returns 404 when problemSlug doesn't match any problem", async () => {
      Problem.findOne.mockResolvedValue(null);
      const req = {
        body: {
          code: "...",
          language: "python",
          problemSlug: "does-not-exist",
          testcases: [{ input: {}, expectedOutput: 1 }],
        },
        log: mockLog(),
      };

      await runHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("falls back to client-sent contract fields when problemSlug is omitted entirely (backward compatible)", async () => {
      callJudge0.mockResolvedValue({ stdout: JSON.stringify([2, 1]), stderr: null, compile_output: null });
      const req = {
        body: {
          code: "...",
          language: "python",
          functionName: "topKFrequent",
          comparisonMode: "unordered",
          testcases: [{ input: { nums: [1, 1, 2] }, expectedOutput: [1, 2] }],
        },
        log: mockLog(),
      };

      await runHandler(req, res);

      expect(Problem.findOne).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          results: [expect.objectContaining({ passed: true })],
        })
      );
    });
  });

  // ── "single-number" incident regression — execution-contract audit ───────
  // The bug itself was a schema-level rejection (see
  // backend/routes/judge.contract.test.js and judge.test.js), so it
  // never actually reached this handler in production. This test proves
  // the OTHER half of the fix: once a request like this one legally
  // reaches runHandler (i.e. after the schema fix), it resolves and
  // executes correctly end-to-end using the real problem slug/function
  // name from the incident.
  it("resolves functionName from the problem and executes correctly for a request shaped like the single-number incident (problemSlug present, functionName omitted)", async () => {
    Problem.findOne.mockResolvedValue({
      slug: "single-number",
      functionName: "singleNumber",
      // Plan 011: see the identical comment on the other fixture above —
      // a real Problem document's returnType is a Mongoose Map.
      returnType: new Map(),
      comparisonMode: "exact",
      operationSequence: { enabled: false },
    });
    callJudge0.mockResolvedValue({ stdout: "4", stderr: null, compile_output: null });

    const req = {
      body: {
        problemSlug: "single-number",
        code: "class Solution:\n    def singleNumber(self, nums):\n        pass",
        language: "python",
        testcases: [{ input: { nums: [4, 1, 2, 1, 2] }, expectedOutput: 4 }],
        // functionName intentionally absent — exactly the incident's
        // request shape, now legal per the schema fix.
      },
      log: mockLog(),
    };

    await runHandler(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [expect.objectContaining({ passed: true })],
      })
    );
  });

  // ── Empty testcases guard — audit finding P2-2 ────────────────────────────
  it("returns an empty result set immediately for an empty testcases array, without calling Judge0 or looking up the problem", async () => {
    const req = {
      body: { code: "...", language: "python", problemSlug: "two-sum", testcases: [] },
      log: mockLog(),
    };

    await runHandler(req, res);

    expect(callJudge0).not.toHaveBeenCalled();
    expect(Problem.findOne).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ results: [], compileFailed: false });
  });
});
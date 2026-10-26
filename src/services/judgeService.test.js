import { describe, expect, it, vi, beforeEach } from "vitest";
import { judgeSubmission } from "./judgeService";
import { apiFetch, apiFetchOptional } from "./api";

vi.mock("./api", () => ({
  apiFetch: vi.fn(),
  // Guest Mode: runTestcases() (POST /api/judge/run) now calls
  // apiFetchOptional, not apiFetch, so guests can Run without a Firebase
  // session — see services/judgeService.js's own comment. judgeSubmission
  // (POST /api/judge/submit) is unaffected and still uses apiFetch, since
  // Submit remains account-only.
  apiFetchOptional: vi.fn(),
}));

describe("judgeSubmission", () => {
  const problem = {
    title: "Two Sum",
    slug: "two-sum",
    functionName: "twoSum",
    testcases: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns Accepted response from API", async () => {
    apiFetch.mockResolvedValue({
      status: "Accepted",
      passed: 4,
      total: 4,
    });

    const res = await judgeSubmission({
      problem,
      code: "dummy code",
      language: "python",
    });

    expect(res.status).toBe("Accepted");
    expect(res.passed).toBe(4);
    expect(apiFetch).toHaveBeenCalled();

    const requestBody = JSON.parse(apiFetch.mock.calls[0][1].body);
    expect(requestBody.visibletestcases).toEqual(problem.testcases);
    expect(requestBody.testcases).toBeUndefined();
  });

  it("returns Wrong Answer response from API", async () => {
    apiFetch.mockResolvedValue({
      status: "Wrong Answer",
      passed: 0,
      total: 4,
    });

    const res = await judgeSubmission({
      problem,
      code: "dummy code",
      language: "python",
    });

    expect(res.status).toBe("Wrong Answer");
    expect(res.passed).toBe(0);
  });

  it("returns Compilation Error response from API", async () => {
    apiFetch.mockResolvedValue({
      status: "Compilation Error",
    });

    const res = await judgeSubmission({
      problem,
      code: "dummy code",
      language: "python",
    });

    expect(res.status).toBe("Compilation Error");
  });

  it("returns Runtime Error response from API", async () => {
    apiFetch.mockResolvedValue({
      status: "Runtime Error",
    });

    const res = await judgeSubmission({
      problem,
      code: "dummy code",
      language: "python",
    });

    expect(res.status).toBe("Runtime Error");
  });

  it("returns Judge Error with a generic infra message when apiFetch throws a network-level error (no status)", async () => {
    // No `.status` on this error (matches what apiFetch throws for a
    // genuine network failure, as opposed to a non-2xx HTTP response —
    // see src/utils/judgeErrorTaxonomy.js) → classified as infra, not a
    // raw passthrough of error.message anymore.
    apiFetch.mockRejectedValue(new Error("Network error"));

    const res = await judgeSubmission({
      problem,
      code: "dummy code",
      language: "python",
    });

    expect(res.status).toBe("Judge Error");
    expect(res.error).toBe("Execution service temporarily unavailable. Please try again in a moment.");
    expect(res.passed).toBe(0);
  });

  it("returns Judge Error with a configuration-specific message when apiFetch throws a 400", async () => {
    const err = new Error("problemSlug is required");
    err.status = 400;
    apiFetch.mockRejectedValue(err);

    const res = await judgeSubmission({
      problem,
      code: "dummy code",
      language: "python",
    });

    expect(res.status).toBe("Judge Error");
    expect(res.error).toBe("Execution configuration error: problemSlug is required");
  });

  it("does not call apiFetch and returns a config error when no problem is loaded (frontend guardrail, item #5)", async () => {
    const res = await judgeSubmission({
      problem: null,
      code: "dummy code",
      language: "python",
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(res.status).toBe("Judge Error");
    expect(res.error).toMatch(/no problem is loaded/i);
  });
});

describe("runTestcases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends problemSlug so the backend can resolve the execution contract server-side (audit P1-1)", async () => {
    apiFetchOptional.mockResolvedValue({ results: [], compileFailed: false });

    const { runTestcases } = await import("./judgeService");
    await runTestcases({
      problem: {
        slug: "top-k-frequent-elements",
        functionName: "topKFrequent",
        testcases: [],
        comparisonMode: "unordered",
      },
      code: "dummy code",
      language: "python",
    });

    const sentBody = JSON.parse(apiFetchOptional.mock.calls[0][1].body);
    expect(sentBody.problemSlug).toBe("top-k-frequent-elements");
    // Contract fields are resolved server-side from problemSlug now — the
    // frontend no longer needs to (and doesn't) send them.
    expect(sentBody.comparisonMode).toBeUndefined();
    expect(sentBody.returnType).toBeUndefined();
    expect(sentBody.operationSequence).toBeUndefined();
  });

  it("sends code/language/testcases needed to run the preview", async () => {
    apiFetchOptional.mockResolvedValue({ results: [], compileFailed: false });

    const { runTestcases } = await import("./judgeService");
    await runTestcases({
      problem: { slug: "two-sum", functionName: "twoSum", testcases: [{ input: { nums: [1] }, expectedOutput: 1 }] },
      code: "dummy code",
      language: "python",
    });

    const sentBody = JSON.parse(apiFetchOptional.mock.calls[0][1].body);
    expect(sentBody.code).toBe("dummy code");
    expect(sentBody.language).toBe("python");
    expect(sentBody.testcases).toEqual([{ input: { nums: [1] }, expectedOutput: 1 }]);
  });

  // ── REGRESSION: the exact "single-number" incident ────────────────────────
  // Asserts the actual request payload — not just that a request was
  // sent — reproducing the production bug report verbatim.
  it("REGRESSION: for the single-number problem, sends problemSlug but does NOT send functionName", async () => {
    apiFetchOptional.mockResolvedValue({ results: [], compileFailed: false });

    const { runTestcases } = await import("./judgeService");
    await runTestcases({
      problem: {
        slug: "single-number",
        functionName: "singleNumber",
        testcases: [{ input: { nums: [4, 1, 2, 1, 2] }, expectedOutput: 4 }],
      },
      code: "class Solution:\n    def singleNumber(self, nums):\n        pass",
      language: "python",
    });

    const sentBody = JSON.parse(apiFetchOptional.mock.calls[0][1].body);
    expect(sentBody.problemSlug).toBe("single-number");
    expect(sentBody.functionName).toBeUndefined();
    expect(sentBody.code).toContain("singleNumber");
    expect(sentBody.language).toBe("python");
    expect(sentBody.testcases).toEqual([{ input: { nums: [4, 1, 2, 1, 2] }, expectedOutput: 4 }]);
  });

  it("does not call apiFetchOptional and returns a config error (not a generic/infra one) when no problem is loaded", async () => {
    const { runTestcases } = await import("./judgeService");
    const res = await runTestcases({ problem: null, code: "x", language: "python" });

    expect(apiFetchOptional).not.toHaveBeenCalled();
    expect(res.errorKind).toBe("config");
    expect(res.error).toMatch(/no problem is loaded/i);
    expect(res.compileFailed).toBe(false);
    expect(res.results).toEqual([]);
  });

  it("classifies a 400 response as errorKind 'config', distinct from infra unavailability", async () => {
    const err = new Error("functionName is required when problemSlug is not provided");
    err.status = 400;
    apiFetchOptional.mockRejectedValue(err);

    const { runTestcases } = await import("./judgeService");
    const res = await runTestcases({
      problem: { slug: "single-number", testcases: [] },
      code: "x",
      language: "python",
    });

    expect(res.errorKind).toBe("config");
    expect(res.error).toBe(
      "Execution configuration error: functionName is required when problemSlug is not provided"
    );
  });

  it("classifies a network-level failure (no status) as errorKind 'infra'", async () => {
    apiFetchOptional.mockRejectedValue(new Error("Failed to fetch"));

    const { runTestcases } = await import("./judgeService");
    const res = await runTestcases({
      problem: { slug: "single-number", testcases: [] },
      code: "x",
      language: "python",
    });

    expect(res.errorKind).toBe("infra");
    expect(res.error).toBe("Execution service temporarily unavailable. Please try again in a moment.");
  });

  it("classifies a 401 response as errorKind 'auth'", async () => {
    const err = new Error("You are not logged in. Please refresh the page and try again.");
    err.status = 401;
    apiFetchOptional.mockRejectedValue(err);

    const { runTestcases } = await import("./judgeService");
    const res = await runTestcases({
      problem: { slug: "single-number", testcases: [] },
      code: "x",
      language: "python",
    });

    expect(res.errorKind).toBe("auth");
  });
});
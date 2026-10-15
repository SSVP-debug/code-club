import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../config/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../services/executionQueue.js", () => ({
  // Pass-through — these tests are about fetchJudge0's own retry/health
  // logic, not the concurrency queue (already covered by
  // executionQueue.test.js / directExecutionQueue.test.js).
  enqueueExecution: vi.fn((job) => job()),
}));

vi.mock("../utils/generateDriverCode.js", () => ({
  generateDriverCode: vi.fn(() => "print('driver')"),
}));

vi.mock("../services/judge0Health.js", () => ({
  recordJudge0Success: vi.fn(),
  recordJudge0Failure: vi.fn(),
}));

import { recordJudge0Success, recordJudge0Failure } from "../services/judge0Health.js";
import { enqueueExecution } from "../services/executionQueue.js";
import { callJudge0 } from "./compilerController.js";

function b64(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("compilerController — Judge0 health recording (Fest Readiness Audit, P1-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    global.fetch.mockRestore?.();
  });

  it("records a success on a normal, well-formed Judge0 response — regardless of the graded verdict", async () => {
    // "Wrong Answer" is a perfectly successful Judge0 HTTP interaction —
    // the infrastructure worked; the user's code just didn't pass. Must
    // count as a health SUCCESS, not a failure.
    global.fetch.mockResolvedValue(
      jsonResponse({
        stdout: b64("wrong output"),
        stderr: null,
        compile_output: null,
        status: { id: 4, description: "Wrong Answer" },
      })
    );

    await callJudge0({
      sourceCode: "def solve(): pass",
      language: "python",
      languageId: 71,
      testcaseInput: {},
      functionName: "solve",
    });

    expect(recordJudge0Success).toHaveBeenCalledOnce();
    expect(recordJudge0Failure).not.toHaveBeenCalled();
  });

  it("records a failure when Judge0 returns 5xx on every retry attempt", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });

    await expect(
      callJudge0({
        sourceCode: "def solve(): pass",
        language: "python",
        languageId: 71,
        testcaseInput: {},
        functionName: "solve",
      })
    ).rejects.toThrow(/503/);

    expect(recordJudge0Failure).toHaveBeenCalledOnce();
    expect(recordJudge0Success).not.toHaveBeenCalled();
  });

  it("does NOT record a failure for a 4xx — that's our own bad request, not Judge0 being unhealthy", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "Unprocessable",
    });

    await expect(
      callJudge0({
        sourceCode: "def solve(): pass",
        language: "python",
        languageId: 71,
        testcaseInput: {},
        functionName: "solve",
      })
    ).rejects.toThrow(/422/);

    expect(recordJudge0Failure).not.toHaveBeenCalled();
    expect(recordJudge0Success).not.toHaveBeenCalled();
  });

  it("records a failure when every retry hits a network error", async () => {
    const networkError = new Error("fetch failed");
    networkError.cause = { code: "ECONNREFUSED" };
    global.fetch.mockRejectedValue(networkError);

    await expect(
      callJudge0({
        sourceCode: "def solve(): pass",
        language: "python",
        languageId: 71,
        testcaseInput: {},
        functionName: "solve",
      })
    ).rejects.toThrow();

    expect(recordJudge0Failure).toHaveBeenCalledOnce();
    expect(recordJudge0Success).not.toHaveBeenCalled();
  });

  it("records exactly one success, not one per internal retry, after a transient 5xx recovers", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "down" })
      .mockResolvedValueOnce(
        jsonResponse({
          stdout: b64("ok"),
          stderr: null,
          compile_output: null,
          status: { id: 3, description: "Accepted" },
        })
      );

    await callJudge0({
      sourceCode: "def solve(): pass",
      language: "python",
      languageId: 71,
      testcaseInput: {},
      functionName: "solve",
    });

    expect(recordJudge0Success).toHaveBeenCalledOnce();
    expect(recordJudge0Failure).not.toHaveBeenCalled();
  });
});

describe("compilerController — Judge0 Integration Hardening: outgoing request boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({
        stdout: b64("ok"),
        stderr: null,
        compile_output: null,
        status: { id: 3, description: "Accepted" },
      })
    );
  });

  afterEach(() => {
    global.fetch.mockRestore?.();
  });

  function outgoingBody() {
    const [, init] = global.fetch.mock.calls[0];
    return JSON.parse(init.body);
  }

  it("item 3/4 — never sends enable_network, even though nothing in the call site could inject one (fetchJudge0's request body is built from server constants only, not spread from any caller-supplied object)", async () => {
    await callJudge0({
      sourceCode: "def solve(): pass",
      language: "python",
      languageId: 71,
      testcaseInput: {},
      functionName: "solve",
    });

    const body = outgoingBody();
    expect(body).not.toHaveProperty("enable_network");
  });

  it("item 5 — every request uses the hardcoded EXECUTION_LIMITS values, regardless of language or caller", async () => {
    for (const languageId of [54, 62, 63, 71]) {
      global.fetch.mockClear();

      await callJudge0({
        sourceCode: "irrelevant",
        languageId,
        testcaseInput: {},
        functionName: "solve",
      });

      const body = outgoingBody();
      expect(body.cpu_time_limit).toBe(2);
      expect(body.wall_time_limit).toBe(5);
      expect(body.memory_limit).toBe(256000);
      expect(body.max_processes_and_or_threads).toBe(60);
      expect(body.max_file_size).toBe(1024);
    }
  });

  it("returns 503 for execution queue coordination errors without leaking infrastructure details", async () => {
    enqueueExecution.mockRejectedValueOnce(Object.assign(new Error("Redis connection string detail"), {
      code: "EXECUTION_COORDINATION_UNAVAILABLE",
    }));
    const { runCode } = await import("./compilerController.js");
    const req = {
      body: { source_code: "print(1)", language_id: 71 },
      log: { debug: vi.fn(), error: vi.fn() },
    };
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

    await runCode(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Code execution is temporarily unavailable. Please retry shortly.",
      code: "EXECUTION_COORDINATION_UNAVAILABLE",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("item 5 — runCode (the /api/compiler/run handler) also cannot have limits overridden via req.body, since fetchJudge0 only ever receives (sourceCode, languageId, stdin) as positional args", async () => {
    const { runCode } = await import("./compilerController.js");

    const req = {
      // A request body with limit-shaped fields that must be ignored —
      // runCode only ever destructures source_code/language_id/stdin.
      body: {
        source_code: "print(1)",
        language_id: 71,
        cpu_time_limit: 999,
        memory_limit: 999999999,
        max_processes_and_or_threads: 99999,
        enable_network: true,
      },
      log: { debug: vi.fn(), error: vi.fn() },
    };
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

    await runCode(req, res);

    const body = outgoingBody();
    expect(body.cpu_time_limit).toBe(2);
    expect(body.memory_limit).toBe(256000);
    expect(body.max_processes_and_or_threads).toBe(60);
    expect(body).not.toHaveProperty("enable_network");
  });
});

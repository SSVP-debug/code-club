import { generateDriverCode } from "../utils/generateDriverCode.js";
import { generateOperationSequenceDriver } from "../utils/operationSequenceDriver.js";
import { identifyOperationSequence } from "../utils/operationSequenceShape.js";
import { logger } from "../config/logger.js";
import {
  enqueueExecution,
} from "../services/executionQueue.js";
import { EXECUTION_LIMITS } from "../config/executionLimits.js";
import { recordJudge0Success, recordJudge0Failure } from "../services/judge0Health.js";
import { SUPPORTED_LANGUAGES, LANGUAGE_ID_TO_STRING } from "../config/languages.js";

// Judge0 Integration Hardening: these were previously two locally-declared
// maps duplicating the same 4 language IDs already listed in
// routes/compiler.js's Zod schema. Both now derive from the single
// allow-list in config/languages.js. Local names kept (JUDGE0_LANGUAGE_NAMES,
// LANGUAGE_STRINGS) so nothing below this line needs to change.
const JUDGE0_LANGUAGE_NAMES = SUPPORTED_LANGUAGES;
const LANGUAGE_STRINGS = LANGUAGE_ID_TO_STRING;

// ── Shared Judge0 fetch ───────────────────────────────────────────────────────
// Internal utility — not exported as a route handler.
//
// Always uses base64_encoded=true to avoid Judge0's UTF-8 conversion error.
// Root cause: if JUDGE0_API_URL in the environment omits the base64_encoded param,
// Judge0 defaults to base64_encoded=true on most hosted instances. Sending plain
// text in that case causes Judge0 to try to base64-decode it, producing invalid
// UTF-8 bytes and the error "some attributes cannot be converted to UTF-8".
//
// Fix: we base64-encode all input fields unconditionally and force
// base64_encoded=true in the URL regardless of what JUDGE0_API_URL contains.
// Response fields (stdout, stderr, compile_output, message) are decoded back to
// plain strings before returning, so all callers are unaffected.
function b64Encode(str) {
  return Buffer.from(str ?? "", "utf-8").toString("base64");
}

function b64Decode(str) {
  if (!str) return str; // preserve null/undefined
  return Buffer.from(str, "base64").toString("utf-8");
}

async function fetchJudge0(sourceCode, languageId, stdin = "") {
  return enqueueExecution(async ({ signal } = {}) => {
    // Build the URL from the env var (or default), then force base64_encoded=true.
    // This means the fix works even if JUDGE0_API_URL in Railway is missing the param.
    const rawUrl =
      process.env.JUDGE0_API_URL ||
      "https://ce.judge0.com/submissions?wait=true";

    const url = new URL(rawUrl);
    url.searchParams.set("base64_encoded", "true");
    // Ensure wait=true is present so we get a result synchronously, not a token.
    if (!url.searchParams.has("wait")) {
      url.searchParams.set("wait", "true");
    }
    const judge0Url = url.toString();

    // ── Auth headers ──────────────────────────────────────────────────────
    // Previously only Content-Type was ever sent, so JUDGE0_RAPIDAPI_KEY and
    // JUDGE0_API_KEY were dead env vars (declared in .env.example, read
    // nowhere) — see "Known gaps" in docs/judge0-setup.md. Both deployment
    // options (Option A: self-hosted with AUTHN_TOKEN, Option B: RapidAPI)
    // are supported here; neither is required, so an unset key is simply
    // omitted rather than sent empty.
    const requestHeaders = { "Content-Type": "application/json" };

    if (process.env.JUDGE0_RAPIDAPI_KEY) {
      requestHeaders["X-RapidAPI-Key"] = process.env.JUDGE0_RAPIDAPI_KEY;
      // RapidAPI requires the host it issued the key for, not just any
      // Judge0 host — derived from the configured URL so this doesn't
      // silently break if RapidAPI ever changes their Judge0 CE hostname.
      requestHeaders["X-RapidAPI-Host"] = url.hostname;
    }

    if (process.env.JUDGE0_API_KEY) {
      // Self-hosted Judge0's own AUTHN_TOKEN convention (see Judge0's
      // docker-compose.yml / ENVIRONMENT-VARIABLES docs) — unrelated to
      // RapidAPI, safe to set alongside or instead of it.
      requestHeaders["X-Auth-Token"] = process.env.JUDGE0_API_KEY;
    }

    // NOTE on enable_network: deliberately not sent here. See "Network
    // access policy" in docs/judge0-setup.md — Judge0's configured default
    // (documented as `false`) applies instead, and no field name below can
    // be influenced by request-body/header/query input from the caller;
    // this object is built entirely from server-side constants and the
    // three explicit function parameters (sourceCode, languageId, stdin).
    const requestBody = JSON.stringify({
      source_code: b64Encode(sourceCode),
      language_id: languageId,
      stdin: b64Encode(stdin),
      cpu_time_limit:
        EXECUTION_LIMITS.cpuTimeLimit,

      wall_time_limit:
        EXECUTION_LIMITS.wallTimeLimit,

      memory_limit:
        EXECUTION_LIMITS.memoryLimitKb,

      max_processes_and_or_threads:
        EXECUTION_LIMITS.maxProcessesAndOrThreads,

      max_file_size:
        EXECUTION_LIMITS.maxFileSizeKb,
    });

    // ── Retry only genuinely transient failures ─────────────────────────────
    // Network errors and 5xx responses are infra hiccups worth a couple of
    // bounded retries (a dedicated/self-hosted Judge0 instance can drop a
    // request under load same as any service). A 4xx is our fault (bad
    // request shape) and retrying it will just fail the same way three times
    // instead of one — so those are NOT retried, they throw immediately.
    const MAX_ATTEMPTS = 3;
    const BASE_DELAY_MS = 300;

    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (signal?.aborted) throw signal.reason || new Error("Execution lease was lost");
      try {
        const response = await fetch(judge0Url, {
          method: "POST",
          headers: requestHeaders,
          body: requestBody,
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
            : AbortSignal.timeout(20000),
        });

        if (!response.ok) {
          const raw = await response.text();

          // 5xx = Judge0 itself is having trouble → retry.
          // 4xx = our request is malformed → no point retrying.
          if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
            logger.warn(
              { httpStatus: response.status, attempt, maxAttempts: MAX_ATTEMPTS },
              "[Judge0] Transient HTTP error — retrying"
            );
            await sleep(BASE_DELAY_MS * attempt);
            continue;
          }

          logger.error({ httpStatus: response.status, raw }, "[Judge0] Error response (final attempt, not retrying)");

          // A 5xx that survived every retry is a genuine Judge0
          // infrastructure failure. A 4xx is OUR request being malformed —
          // that's a bug on our side, not Judge0 being unhealthy, so it's
          // deliberately NOT recorded here (Fest Readiness Audit, P1-1).
          if (response.status >= 500) {
            recordJudge0Failure();
          }

          const httpError = new Error(`Judge0 returned HTTP ${response.status}: ${raw}`);
          // This throw is caught by the catch block just below (it's a
          // synchronous throw inside this same try) — mark it so that
          // catch doesn't ALSO run its own fallback recordJudge0Failure()
          // and double-count (or wrongly count a 4xx, which the branch
          // above just deliberately chose not to record).
          httpError.judge0HealthAlreadyRecorded = true;
          throw httpError;
        }

        const data = await response.json();

        // Decode the base64-encoded output fields back to plain strings.
        recordJudge0Success();
        return {
          ...data,
          stdout: b64Decode(data.stdout),
          stderr: b64Decode(data.stderr),
          compile_output: b64Decode(data.compile_output),
          message: b64Decode(data.message),
        };
      } catch (err) {
        lastError = err;
        // A queue heartbeat abort must not be treated as a transient network
        // failure and retried after the distributed lease has been lost.
        if (signal?.aborted) throw signal.reason || err;

        // Network-level failure (connection refused, DNS, timeout abort) —
        // also transient, also worth retrying within the attempt budget.
        const isNetworkError =
          err.name === "TimeoutError" ||
          err.name === "AbortError" ||
          err.code === "ECONNREFUSED" ||
          err.cause?.code === "ECONNREFUSED";

        if (isNetworkError && attempt < MAX_ATTEMPTS) {
          logger.warn(
            { err, attempt, maxAttempts: MAX_ATTEMPTS },
            "[Judge0] Network error — retrying"
          );
          await sleep(BASE_DELAY_MS * attempt);
          continue;
        }

        // Exhausted every retry on a network error, or hit some other
        // unexpected failure trying to reach Judge0 — either way, this
        // fetchJudge0 call did not succeed. Skipped if the HTTP-status
        // branch above already made its own recording decision (including
        // deliberately not recording for a 4xx) — this fallback is only
        // for errors this function hasn't already classified.
        if (!err.judge0HealthAlreadyRecorded) {
          recordJudge0Failure();
        }
        throw err;
      }
    }

    throw lastError;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── callJudge0 ────────────────────────────────────────────────────────────────
// Named export used by backend/routes/judge.js.
//
// Generates driver code for the given testcase then runs it through Judge0.
// Returns the raw Judge0 result: { stdout, stderr, compile_output, status, time, memory }
//
// Parameters:
//   sourceCode    — the user's solution code (without driver wrapper)
//   language      — language string: "python" | "javascript" | "java" | "cpp"
//   languageId    — Judge0 language ID: 71 | 63 | 62 | 54
//   testcaseInput — plain object matching function parameter names: { nums: [...], target: 9 }
//   functionName  — the function to call: "twoSum", "maxSubArray", etc.
//   returnType    — optional declared return type for this language, from the
//                   problem's contract (Problem.returnType[language]). Passed
//                   straight through to generateDriverCode, which prefers it
//                   over guessing the type from the user's source. Only
//                   meaningful for java/cpp — safe to omit for python/js.
//   paramTypes    — optional declared per-parameter argument types for this
//                   language, from the problem's contract
//                   (Problem.paramTypes[language], e.g. { s: "String" }).
//                   Passed straight through to generateDriverCode, which
//                   prefers each declared entry over structurally guessing
//                   the type from the testcase value. Only meaningful for
//                   java/cpp — safe to omit for python/js. See audit
//                   finding P0-1.
//   operationSequence — optional { enabled, resultMode } from the problem's
//                   contract (Problem.operationSequence). When enabled,
//                   dispatches to generateOperationSequenceDriver instead
//                   of the normal single-call generateDriverCode — see
//                   audit finding P0-2 ("design" problems like LRUCache,
//                   MinStack, Trie).
export async function callJudge0({ sourceCode, language, languageId, testcaseInput, functionName, returnType, paramTypes, operationSequence }) {
  const lang = language || LANGUAGE_STRINGS[languageId] || "python";

  let driverCode;
  if (operationSequence?.enabled) {
    const shape = identifyOperationSequence(testcaseInput);
    if (!shape) {
      throw new Error(
        "operationSequence.enabled is true but testcaseInput didn't match either known operation-sequence shape"
      );
    }
    driverCode = generateOperationSequenceDriver(
      lang, sourceCode, shape, functionName, operationSequence.resultMode || "all"
    );
  } else {
    driverCode = generateDriverCode(lang, sourceCode, testcaseInput, functionName, returnType, paramTypes);
  }

  logger.debug(
    { language: lang, languageId, functionName, inputPreview: JSON.stringify(testcaseInput).slice(0, 80) },
    "[callJudge0] Dispatching to Judge0"
  );

  return fetchJudge0(driverCode, languageId, "");
}

// ── runCode (existing route handler — unchanged) ──────────────────────────────
export async function runCode(req, res) {
  const { source_code, language_id, stdin = "" } = req.body;

  if (!source_code || language_id === undefined) {
    return res.status(400).json({
      error: "source_code and language_id are required",
    });
  }

  const langName = JUDGE0_LANGUAGE_NAMES[language_id] || `id:${language_id}`;



  try {
    const data = await fetchJudge0(source_code, language_id, stdin);

    const statusDesc = data.status?.description || "Unknown";


    req.log.debug(
      {
        judge0Status: statusDesc,
        stdoutPreview: (data.stdout || "").slice(0, 120),
        stderrPreview: data.stderr ? data.stderr.slice(0, 200) : undefined,
      },
      "[Compiler] Judge0 result"
    );

    res.json(data);
  } catch (error) {
    req.log.error({ err: error }, "[Compiler] Judge0 proxy error");
    if (
      error?.code === "EXECUTION_COORDINATION_UNAVAILABLE" ||
      error?.code === "EXECUTION_CAPACITY_EXCEEDED"
    ) {
      res.setHeader?.("Retry-After", "2");
      return res.status(503).json({
        error: "Code execution is temporarily unavailable. Please retry shortly.",
        code: error.code,
      });
    }
    return res.status(502).json({
      stderr: "Failed to reach the code execution service.",
      status: { id: 13, description: "Internal Error" },
    });
  }
}
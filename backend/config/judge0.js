/**
 * Validates the Judge0 configuration at server startup and does a
 * non-blocking reachability check.
 *
 * Deliberately never throws or blocks `start()` in server.js — same
 * "never crash on an external dependency" pattern as config/db.js. A
 * misconfigured or unreachable Judge0 instance should produce a loud log
 * line, not a failed deploy; the judge/compiler routes will surface the
 * real error to the user on their next submission anyway.
 *
 * That said, a silent log line is easy to miss in production — nobody
 * tails startup logs on every deploy. `getJudge0ConfigStatus()` below is
 * the machine-readable version of the same check, surfaced at
 * GET /api/health/compiler (see controllers/healthController.js), which
 * returns HTTP 503 in production when this configuration is unsafe. That
 * makes it something a load balancer / uptime monitor / deploy pipeline
 * can actually alert on, instead of relying on someone reading logs.
 */
import { logger } from "./logger.js";

/**
 * Pure, side-effect-free check of the current Judge0 configuration.
 * Exported separately from validateJudge0Config() so both the startup
 * log and the health endpoint derive their verdict from one place —
 * exactly the "one source of truth" pattern the rest of this codebase
 * uses for streak/solved-count/etc.
 *
 * @returns {{ healthy: boolean, usingPublicSharedEndpoint: boolean, reason: string|null }}
 */
export function getJudge0ConfigStatus() {
  const isProduction = process.env.NODE_ENV === "production";
  const rawUrl = process.env.JUDGE0_API_URL;

  if (!rawUrl) {
    // No URL configured at all → defaults to the public ce.judge0.com
    // instance. Fine for local dev; not for production.
    return {
      healthy: !isProduction,
      usingPublicSharedEndpoint: true,
      reason: isProduction
        ? "JUDGE0_API_URL is not set — production is defaulting to the " +
          "public ce.judge0.com instance, which is rate-limited and " +
          "shared. See docs/judge0-setup.md."
        : null,
    };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      healthy: false,
      usingPublicSharedEndpoint: false,
      reason: `JUDGE0_API_URL is not a valid URL: "${rawUrl}".`,
    };
  }

  const usingPublicSharedEndpoint = parsed.hostname === "ce.judge0.com";
  const unsafe = isProduction && usingPublicSharedEndpoint;

  return {
    healthy: !unsafe,
    usingPublicSharedEndpoint,
    reason: unsafe
      ? "Running in production against the public ce.judge0.com instance " +
        "— it's rate-limited and shared, and is the single biggest scale " +
        "bottleneck in the stack. Migrate to a dedicated instance before " +
        "real traffic; see docs/judge0-setup.md."
      : null,
  };
}

export function validateJudge0Config() {
  const status = getJudge0ConfigStatus();
  const rawUrl = process.env.JUDGE0_API_URL;

  if (!rawUrl) {
    const log = process.env.NODE_ENV === "production" ? logger.error : logger.warn;
    log.call(
      logger,
      "[Judge0] JUDGE0_API_URL not set — defaulting to the public " +
        "ce.judge0.com instance. That instance is rate-limited and shared " +
        "with everyone else using it; fine for local dev, not for " +
        "production. See docs/judge0-setup.md for self-hosted (Docker) " +
        "and RapidAPI setup." +
        (process.env.NODE_ENV === "production"
          ? " THIS IS PRODUCTION — real user code runs will queue behind " +
            "every other ce.judge0.com user and start failing under load. " +
            "GET /api/health/compiler will report 503 until this is fixed."
          : "")
    );
    return;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    logger.error(
      `[Judge0] JUDGE0_API_URL is not a valid URL: "${rawUrl}". ` +
        "Judge/compiler routes will fail until this is fixed."
    );
    return;
  }

  if (!status.healthy) {
    logger.error(
      `[Judge0] ${status.reason} GET /api/health/compiler will report 503 until this is fixed.`
    );
  }

  // Non-blocking reachability check — fire and forget, log only.
  checkReachability(parsed.origin);
}

async function checkReachability(origin) {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(5000) });
    // Judge0's root path commonly 404s even when the service is healthy —
    // any response at all (not a thrown network error) means the host is up.
    logger.info(`[Judge0] Reachability check: ${origin} responded (HTTP ${response.status}).`);
  } catch (err) {
    logger.warn(
      { err },
      `[Judge0] Reachability check failed for ${origin} — server is starting anyway, this only affects code execution.`
    );
  }
}
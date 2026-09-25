/**
 * adminHealthController.js — GET /api/admin/system-health (plan 008)
 *
 * This is the requireAdmin-gated aggregate monitoring view. It is
 * deliberately a SEPARATE file/route from the existing, non-admin
 * `GET /api/health` (server.js) and `GET /api/health/compiler`
 * (healthController.js) — those stay public/semi-public and untouched;
 * this one composes their same underlying signals for the admin console,
 * per plan 008 step 5's explicit instruction not to mix admin-only and
 * public health surfaces in one file.
 *
 * A live snapshot only — no historical uptime charts / incident history
 * (that needs a metrics-storage pipeline, out of scope per the plan) and
 * no alerting/paging integration.
 */
import mongoose from "mongoose";
import { getJudge0Health } from "../services/judge0Health.js";
import { logger } from "../config/logger.js";

// Mirrors server.js's MONGO_STATE_LABELS (GET /api/health) exactly — kept
// as its own small const here rather than importing from server.js, since
// server.js doesn't export it and pulling a route-file export into a
// controller would be an odd direction for that dependency to point.
const MONGO_STATE_LABELS = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

// Judge0 status composition — see judge0Health.js's own comments for what
// each field means. This composes cleanly (per plan 008's escape hatch:
// STOP if it didn't) using ONLY fields that already exist there:
//   - circuitOpen true            -> "down" (5+ consecutive infra failures)
//   - requests === 0              -> "unknown" (no Judge0 traffic yet to
//                                     judge by — distinct from "up", since
//                                     there's genuinely no evidence either way)
//   - consecutiveFailures > 0     -> "degraded" (some recent failures,
//                                     not yet enough to trip the circuit
//                                     signal — a judgment call using the
//                                     existing counter, not a new threshold)
//   - otherwise                   -> "up"
function summarizeJudge0Status(judge0Health) {
  if (judge0Health.circuitOpen) return "down";
  if (judge0Health.requests === 0) return "unknown";
  if (judge0Health.consecutiveFailures > 0) return "degraded";
  return "up";
}

function summarizeDbStatus(readyState) {
  if (readyState === 1) return "up";
  if (readyState === 2 || readyState === 3) return "degraded";
  return "down"; // 0 (disconnected) or any unrecognized state
}

// ── Background jobs — investigated per plan 008 step 4 before writing ──────
// `grep -rln "cron\|node-cron\|setInterval.*[0-9]{5,}\|agenda\|bull" backend/`
// found exactly two hits, neither of which is an in-process job scheduler:
//   - backend/config/resend.js — just a comment referencing the cron script
//     below, no scheduler itself.
//   - backend/scripts/sendWeeklyReviewEmails.js — a standalone script
//     (`npm run weekly-review`), whose own header comment says it's meant
//     to run as a separate Railway Cron Job service, NOT inside this
//     Node process. This app process has no idea when/whether it last ran.
//
// TPO-6 addendum (not a re-run of the original grep, just noting the new
// job added alongside it): backend/scripts/sendAssignmentAutoReminders.js
// is the same standalone-script, no-in-process-scheduler shape as the
// weekly review job above.
//
// A broader `setInterval` grep (no size filter) found exactly one
// in-process job: backend/routes/interview.js's 10-minute sweep of expired
// in-memory interview sessions. It's real and in-process, but it exposes
// no success/failure/last-run signal to check — reporting an "up/down"
// status for it would be fabricated. It's listed here as informational
// only, not a health check.
//
// Bottom line, honestly reported rather than inventing a jobs dashboard
// this system doesn't have the infrastructure for:
function getBackgroundJobsSummary() {
  return {
    inProcess: [
      {
        name: "Interview session sweep",
        schedule: "every 10 minutes",
        source: "backend/routes/interview.js",
        note: "No-op when Redis is configured (Redis TTL expires those entries on its own). No exposed success/failure signal to report a status from — informational only.",
      },
    ],
    external: [
      {
        name: "Weekly review emails",
        schedule: "weekly (Railway Cron Job service, not this process)",
        source: "backend/scripts/sendWeeklyReviewEmails.js",
        note: "Not tracked by this app process — this process has no signal for whether/when it last ran. Check the Railway Cron Job service's own run history for that.",
      },
      {
        name: "Assignment auto-reminders",
        schedule: "hourly (Railway Cron Job service, not this process) — TPO-6",
        source: "backend/scripts/sendAssignmentAutoReminders.js",
        note: "Not tracked by this app process, same as the weekly review job above. Idempotency is per-assignment (Assignment.autoReminderSentAt), not per-run, so a missed or delayed cron tick doesn't cause a double-send.",
      },
    ],
  };
}

// ── GET /api/admin/system-health ────────────────────────────────────────────
export async function getSystemHealth(req, res) {
  const checkedAt = new Date().toISOString();

  // API: trivially "up" if this handler is running at all — a
  // self-referential check, noted explicitly here per the plan rather than
  // silently treated as a real independent signal.
  const api = { status: "up", checkedAt };

  const readyState = mongoose.connection.readyState;
  const db = {
    status: summarizeDbStatus(readyState),
    state: MONGO_STATE_LABELS[readyState] ?? "unknown",
    checkedAt,
  };

  const judge0Health = getJudge0Health();
  const judge0 = {
    status: summarizeJudge0Status(judge0Health),
    requests: judge0Health.requests,
    successes: judge0Health.successes,
    failures: judge0Health.failures,
    consecutiveFailures: judge0Health.consecutiveFailures,
    circuitOpen: judge0Health.circuitOpen,
    circuitOpenedAt: judge0Health.circuitOpenedAt,
    checkedAt,
  };

  // Storage: db.stats() needs a live connection — only call it when
  // readyState is actually connected, otherwise report unavailable rather
  // than letting the driver hang/error on a dead connection.
  let storage;
  if (readyState === 1) {
    try {
      const stats = await mongoose.connection.db.stats();
      storage = {
        status: "up",
        dataSizeBytes: stats.dataSize,
        storageSizeBytes: stats.storageSize,
        indexSizeBytes: stats.indexSize,
        checkedAt,
      };
    } catch (err) {
      logger.error({ err }, "[Admin] system health: db.stats() failed");
      storage = { status: "unavailable", reason: "db.stats() call failed", checkedAt };
    }
  } else {
    storage = { status: "unavailable", reason: "Database not connected", checkedAt };
  }

  return res.json({
    api,
    db,
    judge0,
    storage,
    backgroundJobs: getBackgroundJobsSummary(),
    checkedAt,
  });
}
/**
 * sendAssignmentAutoReminders.js
 *
 * TPO-6: auto-reminds stragglers 24h before an assignment's dueDate,
 * removing the manual step where a TPO has to remember to click
 * POST /api/tpo/assignments/:id/remind themselves.
 *
 * Like scripts/sendWeeklyReviewEmails.js and every other scheduled job in
 * this app (see controllers/adminHealthController.js's background-jobs
 * survey), this process has NO in-process scheduler — it's a standalone
 * script meant to run as its own Railway Cron Job service, not inside the
 * main web service.
 *
 * How the 24h-before window is found, and why it's window-based rather
 * than "run exactly at T-24h":
 *   Every run queries for active, not-yet-auto-reminded assignments whose
 *   dueDate falls within the next 24 hours (and isn't already in the
 *   past). Whichever run first sees an assignment in that window sends
 *   the reminder and stamps `autoReminderSentAt`, so it's never sent
 *   twice — regardless of how often the cron actually fires. This is
 *   more robust than trying to fire at one precise instant: it degrades
 *   gracefully to "as soon as possible after entering the window" if a
 *   run is skipped or delayed, rather than missing the assignment
 *   entirely. Run this at least once per REMINDER_WINDOW_HOURS (default
 *   hourly) or an assignment could enter and leave the window unseen.
 *
 * Idempotency: `autoReminderSentAt` is a one-shot flag, set the first time
 * this job handles an assignment — even if every student had already
 * finished (nothing to notify, but the assignment shouldn't be re-scanned
 * every run for the rest of its window). It is separate from manual
 * /remind calls, which never touch it — a TPO can still send extra manual
 * reminders after the automatic one runs.
 *
 * Known trade-off: if a cohort's roster changes after the reminder has
 * already been sent for that assignment (e.g. a student added mid-window),
 * the new member won't get the automatic reminder — the same "documents
 * actual behavior, not a security gap" trade-off other one-shot flags in
 * this codebase make (see lastWeeklyReviewSentAt).
 *
 * Usage:
 *   cd backend
 *   node scripts/sendAssignmentAutoReminders.js --dry-run
 *   node scripts/sendAssignmentAutoReminders.js
 *
 * Railway: separate Cron Job service, start command
 *   `node scripts/sendAssignmentAutoReminders.js`, schedule hourly,
 *   e.g. `0 * * * *`.
 */

import "../config/env.js";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Assignment from "../models/Assignment.js";
import { getAssignmentAudience } from "../services/assignmentAudienceService.js";
import { createNotificationBulk } from "../services/notificationService.js";
import { logger } from "../config/logger.js";

const REMINDER_WINDOW_HOURS = 24;
const REMINDER_WINDOW_MS = REMINDER_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Pure core, independent of Mongoose/notification wiring — same
 * dependency-injection shape as backfillAssignmentCollegeIdsCore, so this
 * is fully unit-testable without a real database.
 */
export async function sendAssignmentAutoRemindersCore({
  findDueAssignments,
  getAudience,
  markReminded,
  sendReminders,
  dryRun = false,
  log = () => {},
}) {
  const counts = {
    scanned: 0,
    remindedAssignments: 0,
    remindedStudents: 0,
    skippedEveryoneDone: 0,
    errors: 0,
  };

  const assignments = await findDueAssignments();
  counts.scanned = assignments.length;

  for (const assignment of assignments) {
    const label = `${assignment._id} (${assignment.title})`;
    try {
      const students = await getAudience(assignment);
      const incomplete = students.filter(
        (s) => !assignment.problemSlugs.every((slug) => (s.solvedSlugs || []).includes(slug))
      );

      if (incomplete.length === 0) {
        counts.skippedEveryoneDone += 1;
        log(`  - ${label}: everyone already done — nothing to send.`);
      } else {
        if (!dryRun) {
          await sendReminders(assignment, incomplete);
        }
        counts.remindedAssignments += 1;
        counts.remindedStudents += incomplete.length;
        log(
          `  - ${label}: reminded ${incomplete.length}/${students.length} student(s)${dryRun ? " [dry run]" : ""}.`
        );
      }

      if (!dryRun) {
        await markReminded(assignment._id);
      }
    } catch (err) {
      counts.errors += 1;
      log(`  ✗ ${label}: ${err.message}`);
    }
  }

  return counts;
}

export function buildMongooseDeps({ windowMs = REMINDER_WINDOW_MS } = {}) {
  return {
    findDueAssignments: () => {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + windowMs);
      return Assignment.find({
        status: "active",
        autoReminderSentAt: null,
        dueDate: { $gt: now, $lte: windowEnd },
      }).lean();
    },

    getAudience: (assignment) => getAssignmentAudience(assignment, "_id solvedSlugs"),

    markReminded: (assignmentId) =>
      Assignment.updateOne({ _id: assignmentId }, { $set: { autoReminderSentAt: new Date() } }),

    sendReminders: (assignment, incomplete) =>
      createNotificationBulk(
        incomplete.map((s) => s._id),
        {
          type: "assignment_reminder",
          title: "Reminder: assignment due soon",
          message: `${assignment.title} — due ${new Date(assignment.dueDate).toLocaleDateString()}. You haven't finished it yet.`,
          link: "/problems",
          meta: { assignmentId: assignment._id, auto: true },
        }
      ),
  };
}

function printReport(counts, dryRun) {
  console.log(`\n${dryRun ? "Would report" : "Report"}:`);
  console.log(`Scanned (due within window): ${counts.scanned}`);
  console.log(`Assignments reminded: ${counts.remindedAssignments}`);
  console.log(`Students notified: ${counts.remindedStudents}`);
  console.log(`Skipped — everyone already done: ${counts.skippedEveryoneDone}`);
  console.log(`Errors: ${counts.errors}`);
}

async function runSendAssignmentAutoReminders() {
  const dryRun = process.argv.includes("--dry-run");

  await connectDB();

  if (dryRun) {
    console.log("🔍 DRY RUN — no notifications will be sent, no assignments marked reminded\n");
  }

  const counts = await sendAssignmentAutoRemindersCore({
    ...buildMongooseDeps(),
    dryRun,
    log: console.log,
  });

  printReport(counts, dryRun);
  logger.info({ ...counts, dryRun }, "[assignment-auto-reminders] Done");

  await mongoose.disconnect();
  return counts;
}

const isMainModule =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMainModule) {
  runSendAssignmentAutoReminders()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Assignment auto-reminders failed:", err);
      process.exit(1);
    });
}

export { runSendAssignmentAutoReminders };

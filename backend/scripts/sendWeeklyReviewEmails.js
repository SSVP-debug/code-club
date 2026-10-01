/**
 * sendWeeklyReviewEmails.js
 *
 * Weekly AI review email job. Problem topics are read from the canonical
 * backend problem folders, never from the legacy frontend catalog.
 */

import "../config/env.js";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import Submission from "../models/Submission.js";
import loadProblemsFromFolders from "./lib/loadProblemsFromFolders.js";
import { logger } from "../config/logger.js";
import { getResendClient, getFromAddress } from "../config/resend.js";
import { callClaudeJSON } from "../utils/anthropicClient.js";
import { buildWeeklyReviewEmail } from "../utils/weeklyReviewEmailTemplate.js";
import { SITE_URL } from "../config/site.js";

const DRY_RUN = process.argv.includes("--dry-run");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DASHBOARD_URL = `${SITE_URL}/dashboard`;

function buildSystemPrompt() {
  return `You are a senior DSA coach writing a short weekly email to a student. \nYou'll be given this week's practice data. Respond with ONLY a JSON object with exactly these keys:\n{\n  "headline": "one short, specific sentence opening the email — mention an actual number or topic from their data, not generic praise",\n  "review": "2-3 sentences, direct and specific, based only on the numbers given — what they did well and what's weak",\n  "recommendation": "one concrete next step, naming a specific topic or problem type to focus on next"\n}\nNo markdown, no preamble, valid JSON only.`;
}

async function buildAIReview({ weekSolvedCount, weekAttempted, acceptanceRate, topicsThisWeek, totalSolved, currentStreak }) {
  const userMessage = `This week's data:\n${JSON.stringify(
    { weekSolvedCount, weekAttempted, acceptanceRate, topicsThisWeek, totalSolved, currentStreak },
    null,
    2
  )}`;

  return callClaudeJSON({ systemPrompt: buildSystemPrompt(), userMessage, maxTokens: 300 });
}

async function run() {
  await connectDB();

  const problems = await loadProblemsFromFolders();
  const slugToTopic = new Map(problems.map((p) => [p.slug, p.topic]));

  const resend = DRY_RUN ? null : await getResendClient();
  if (!DRY_RUN && !resend) {
    logger.warn("[weekly-review] RESEND_API_KEY not set — nothing will be sent. Exiting.");
    await mongoose.disconnect();
    return;
  }

  const weekStart = new Date(Date.now() - WEEK_MS);
  const candidates = await User.find({
    "emailPreferences.weeklyReview": { $ne: false },
    email: { $exists: true, $ne: null },
  });

  logger.info(`[weekly-review] ${candidates.length} candidate user(s) to check`);

  let sent = 0;
  let skippedNoActivity = 0;
  let skippedAlreadySent = 0;
  let errors = 0;

  for (const user of candidates) {
    const label = user.email || String(user._id);

    if (
      user.lastWeeklyReviewSentAt &&
      Date.now() - new Date(user.lastWeeklyReviewSentAt).getTime() < 5 * 24 * 60 * 60 * 1000
    ) {
      skippedAlreadySent++;
      continue;
    }

    let weekSubmissions;
    try {
      weekSubmissions = await Submission.find({ userId: user._id, createdAt: { $gte: weekStart } }).lean();
    } catch (err) {
      logger.error({ err, user: label }, "[weekly-review] Failed to fetch submissions — skipping user");
      errors++;
      continue;
    }

    const acceptedThisWeek = weekSubmissions.filter((s) => s.status === "Accepted");
    const weekSolvedSlugs = [...new Set(acceptedThisWeek.map((s) => s.problemSlug))];

    if (weekSolvedSlugs.length === 0) {
      skippedNoActivity++;
      continue;
    }

    const weekAttempted = new Set(weekSubmissions.map((s) => s.problemSlug)).size;
    const acceptanceRate = weekSubmissions.length > 0
      ? `${((acceptedThisWeek.length / weekSubmissions.length) * 100).toFixed(0)}%`
      : "N/A";
    const topicsThisWeek = [...new Set(weekSolvedSlugs.map((slug) => slugToTopic.get(slug)).filter(Boolean))];

    let ai;
    try {
      ai = await buildAIReview({
        weekSolvedCount: weekSolvedSlugs.length,
        weekAttempted,
        acceptanceRate,
        topicsThisWeek,
        totalSolved: user.solvedSlugs?.length ?? 0,
        currentStreak: user.currentStreak ?? 0,
      });
    } catch (err) {
      logger.error({ err, user: label }, "[weekly-review] Claude call failed — skipping user this week");
      errors++;
      continue;
    }

    const { subject, html, text } = buildWeeklyReviewEmail({
      displayName: user.displayName,
      weekSolvedCount: weekSolvedSlugs.length,
      currentStreak: user.currentStreak ?? 0,
      totalXP: user.totalXP ?? 0,
      topicsThisWeek,
      ai,
      dashboardUrl: DASHBOARD_URL,
    });

    if (DRY_RUN) {
      logger.info({ user: label, subject, ai }, "[weekly-review] DRY RUN — would send");
      sent++;
      continue;
    }

    try {
      const result = await resend.emails.send({ from: getFromAddress(), to: user.email, subject, html, text });
      if (result.error) throw new Error(result.error.message || "Resend returned an error");
      user.lastWeeklyReviewSentAt = new Date();
      await user.save();
      sent++;
    } catch (err) {
      logger.error({ err, user: label }, "[weekly-review] Resend send failed — skipping user");
      errors++;
    }
  }

  logger.info({ sent, skippedNoActivity, skippedAlreadySent, errors }, `[weekly-review] Done${DRY_RUN ? " (dry run)" : ""}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error({ err }, "[weekly-review] Fatal error");
  process.exit(1);
});

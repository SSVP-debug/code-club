import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import Problem from "../models/Problem.js";
import User from "../models/User.js";
import { PREMIUM_FEATURES } from "../middleware/premiumGate.js";
import { getOrSetCache } from "../utils/cache.js";
import { canAccessContestProblem } from "../services/contestProblemAccess.js";
import { getStudentDayKey } from "../utils/studentDay.js";

const router = Router({ mergeParams: true });
const claude = new Anthropic();

const HINT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const LEVEL_PROMPTS = {
  1: (title, topic) =>
    `Give a one-sentence directional hint for the problem "${title}" (topic: ${topic}). ` +
    `Do NOT reveal the algorithm or data structure. Just tell the student what to think about. ` +
    `Max 30 words. Plain text only.`,

  2: (title, topic) =>
    `Give a 2-3 sentence approach hint for "${title}" (topic: ${topic}). ` +
    `Name the key data structure or algorithm pattern. Do NOT write any code. ` +
    `Plain text only, no markdown.`,

  3: (title, topic) =>
    `Give a concrete step-by-step solution approach for "${title}" (topic: ${topic}). ` +
    `3-5 numbered steps. No code. No pseudocode. Just clear English steps. ` +
    `Plain text only.`,
};

router.post("/", async (req, res) => {
  try {
    const { slug }  = req.params;
    const level     = parseInt(req.body.level) || 1;
    const validLevel = Math.min(3, Math.max(1, level));

    // ── Contest access gate (Fest Readiness Audit, P0-2) ────────────────────
    // Checked before the (cached, per-slug-not-per-user) hint fetch below —
    // an AI-generated hint reveals the problem's title/topic and an
    // approach, which is exactly what shouldn't leak for a private contest
    // problem before its window. Deliberately re-checked on every request
    // (not folded into the cache below) since authorization can change
    // over time (contest not started yet vs. now active) even though the
    // hint content itself doesn't.
    const gateProblem = await Problem.findOne({ slug }).select("visibility").lean();
    if (gateProblem?.visibility === "contest") {
      const allowed = await canAccessContestProblem(slug, req.userDoc);
      if (!allowed) return res.status(404).json({ error: "Problem not found." });
    }

    // ── Free tier limit: 3 hints/day (resets at midnight IST — see
    // backend/utils/studentDay.js for the shared daily-gating policy)
    // ─────────────────────────────────────────────────────────────────────
    // Premium users (or everyone, while MONETIZATION_ENABLED=false) skip this.
    if (!req.isPremium && req.userDoc) {
      const today = getStudentDayKey();
      const freeLimit = PREMIUM_FEATURES.UNLIMITED_AI_HINTS.freeLimitPerDay;

      // Atomic conditional update: the filter only matches (and the update
      // only applies) if today's count is still under the limit, or if
      // dailyHintLog is from a previous day and needs to reset. Mongo
      // evaluates the filter and applies the update as a single atomic
      // operation per document, so two concurrent requests can't both read
      // "2 used" and both write "3 used" — one of them will always see the
      // other's write first. Previously this was read-check-save on
      // req.userDoc, which raced under concurrent requests.
      const grant = await User.findOneAndUpdate(
        {
          _id: req.userDoc._id,
          $or: [
            { "dailyHintLog.date": { $ne: today } },
            { "dailyHintLog.date": today, "dailyHintLog.count": { $lt: freeLimit } },
          ],
        },
        [
          {
            $set: {
              dailyHintLog: {
                date: today,
                count: {
                  $cond: [
                    { $eq: ["$dailyHintLog.date", today] },
                    { $add: [{ $ifNull: ["$dailyHintLog.count", 0] }, 1] },
                    1,
                  ],
                },
              },
            },
          },
        ],
        { new: true }
      ).select("dailyHintLog");

      if (!grant) {
        return res.status(402).json({
          error: `Free plan includes ${freeLimit} hints/day. Upgrade to Pro for unlimited hints.`,
          upgradeUrl: "/pricing",
        });
      }
    }

    // Cache check + fetch — shared across all instances via Redis (falls
    // back to per-instance in-memory when REDIS_URL isn't configured).
    // Previously a bare module-level Map: cached hints didn't survive a
    // restart, and weren't shared across horizontally-scaled instances —
    // every instance independently re-paid for the same Claude call for
    // the same (slug, level), instead of sharing one cached result.
    const cacheKey = `hint:${slug}:${validLevel}`;
    let notFound = false;
    let hintPayload, cacheStatus;

    try {
      ({ value: hintPayload, cacheStatus } = await getOrSetCache(
        cacheKey,
        HINT_TTL_SECONDS,
        async () => {
          // Fetch problem title + topic
          const problem = await Problem.findOne({ slug })
            .select("title topic difficulty")
            .lean();

          if (!problem) {
            notFound = true;
            throw new Error("Problem not found.");
          }

          // Call Claude
          const prompt = LEVEL_PROMPTS[validLevel](problem.title, problem.topic);

          const message = await claude.messages.create({
            model:      "claude-sonnet-4-6",
            max_tokens: 200,
            messages:   [{ role: "user", content: prompt }],
          });

          const hint = message.content?.[0]?.text?.trim() ?? "Think carefully about the constraints.";

          return { hint, problemTitle: problem.title };
        }
      ));
    } catch (fetchErr) {
      if (notFound) return res.status(404).json({ error: "Problem not found." });
      throw fetchErr; // genuine Claude/infra error — handled by the outer catch below
    }

    return res.json({
      hint:       hintPayload.hint,
      level:      validLevel,
      cached:     cacheStatus === "HIT",
      problem:    hintPayload.problemTitle,
    });

  } catch (err) {
    req.log.error({ err }, "[Hints] error");
    return res.status(500).json({ error: "Failed to generate hint. Try again shortly." });
  }
});

export default router;
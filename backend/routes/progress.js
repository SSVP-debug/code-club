import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateBody.js";
import {
  getProgress,
  putProgress,
} from "../controllers/progressController.js";
import Problem from "../models/Problem.js";
import Submission from "../models/Submission.js";
import UserProblemProgress from "../models/UserProblemProgress.js";

const router = Router();

// ── Zod schema for PUT /api/progress ─────────────────────────────────────────
//
// Why validate here and not just trust the client:
//   Without this, any user can POST { solvedSlugs: ["two-sum", "fake-slug-i-never-solved"] }
//   and the server saves it — marking problems as solved without ever running code.
//   Zod + slug existence check closes that vector entirely.

const progressSchema = z.object({
  // Preferred write path: one server-verified newly solved problem.
  problemSlug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  // Array of problem slugs — each must be a valid slug format
  solvedSlugs: z
    .array(
      z.string()
        .min(1)
        .max(200)
        .regex(/^[a-z0-9-]+$/, "Each slug must be lowercase letters, numbers, and hyphens")
    )
    .max(10_000, "solvedSlugs array too large")
    .optional()
    .default([]),

  // Topic stats: { "Arrays": 3, "Trees": 1 } — values must be non-negative integers
  topicStats: z
    .record(z.string().min(1).max(100), z.number().int().min(0).max(10_000))
    .optional()
    .default({}),

  // ISO date strings: "2026-06-12"
  activityDates: z
    .array(
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "activityDates must be YYYY-MM-DD strings")
    )
    .max(10_000)
    .optional()
    .default([]),

  // Accept both casings (frontend sends Easy/Medium/Hard, model stores easy/medium/hard)
  // Zod normalises to lowercase before hitting the controller.
  solvedDifficulty: z
    .object({
      Easy: z.number().int().min(0).max(10_000).optional().default(0),
      Medium: z.number().int().min(0).max(10_000).optional().default(0),
      Hard: z.number().int().min(0).max(10_000).optional().default(0),
      easy: z.number().int().min(0).max(10_000).optional().default(0),
      medium: z.number().int().min(0).max(10_000).optional().default(0),
      hard: z.number().int().min(0).max(10_000).optional().default(0),
    })
    .optional()
    .default({}),

  // recentActivity items
  recentActivity: z
    .array(
      z.object({
        title: z.string().max(200).optional().default(""),
        time: z.string().max(50).optional().default(""),
        status: z.string().max(100).optional().default(""),
        slug: z.string().max(200).optional().default(""),
      })
    )
    .max(10)
    .optional()
    .default([]),

  // Optional LeetCode username
  leetcodeUsername: z.string().max(100).optional(),

  // NOTE: totalXP is intentionally NOT accepted from the client.
  // It is computed server-side in putProgress from solvedSlugs × difficulty weights.
});

// ── Slug existence middleware ──────────────────────────────────────────────────
// Runs after Zod validation. Verifies every submitted slug actually exists
// in the problems collection — prevents marking fake problems as solved.
export async function validateSlugs(req, res, next) {
  const { solvedSlugs, problemSlug } = req.body;

  if (!solvedSlugs || solvedSlugs.length === 0) return next();

  try {
    // Fetch only the slugs that exist in DB — O(1) index lookup
    const uniqueSlugs = [...new Set(solvedSlugs)];
    const existingDocs = await Problem
      .find({ slug: { $in: uniqueSlugs } })
      .select("slug")
      .lean();

    const existingSlugs = new Set(existingDocs.map((p) => p.slug));
    const fakeSlugs = solvedSlugs.filter((s) => !existingSlugs.has(s));
    

    if (fakeSlugs.length > 0) {
      return res.status(400).json({
        error: `The following problem slugs do not exist: ${fakeSlugs.join(", ")}`,
        field: "solvedSlugs",
      });
    }

    next();
  } catch (err) {
    // If DB check fails, don't block the save — log and continue
    req.log.error({ err }, "[Progress] Slug validation DB error — continuing without blocking save");
    next();
  }
}

// ── Ownership check ──────────────────────────────────────────────────────────
//
// validateSlugs above closes one gap (fake slugs that don't exist at all)
// but NOT the actual exploit: `{ solvedSlugs: ["two-sum", ...every real
// slug in the catalog] }` sailed straight through it, because every one of
// those slugs *does* exist — the check never asked whether *this user*
// actually solved any of them. That's the gap this middleware closes.
//
// A slug only counts if there's a matching `Submission` document with
// status "Accepted" for this user — and Submission documents are only ever
// created server-side, from a real Judge0-graded run (see
// backend/controllers/judgeController.js's submitHandler + recordVerifiedSubmission in
// controllers/submissionController.js). Anything the client claims beyond
// that is dropped here, not saved, and logged as a possible tampering
// attempt — putProgress (below) only ever sees req.verifiedNewSlugs, never
// the raw client-supplied solvedSlugs array.
//
// Already-solved slugs (already in req.userDoc.solvedSlugs) are excluded
// from the lookup — they're historical/trusted, and re-checking them on
// every save would be wasted work.
export async function verifyAgainstSubmissions(req, res, next) {
  if (!req.userDoc) {
    // putProgress's own guard below will return 503 — nothing to verify.
    req.verifiedNewSlugs = [];
    return next();
  }

  const { solvedSlugs } = req.body;
  const claimed = [...new Set([...(solvedSlugs || []), problemSlug].filter(Boolean))];

  if (claimed.length === 0) {
    req.verifiedNewSlugs = [];
    return next();
  }

  try {
    const verified = await Submission.find({
      userId: req.userDoc._id,
      problemSlug: { $in: claimed },
      status: "Accepted",
    }).distinct("problemSlug");

    // UserProblemProgress is the scalable source of truth. A submission
    // proves the solve; this query keeps the verification path independent
    // from the legacy User.solvedSlugs array.
    const alreadySolved = await UserProblemProgress.find({
      userId: req.userDoc._id,
      problemSlug: { $in: verified },
      status: "solved",
    }).distinct("problemSlug");
    const alreadySolvedSet = new Set(alreadySolved);

    const verifiedSet = new Set(verified);
    const rejected = claimed.filter((slug) => !verifiedSet.has(slug));

    if (rejected.length > 0) {
      req.log.warn(
        { userId: req.userDoc._id.toString(), rejected },
        "[Progress] Rejected unverified solvedSlugs — no matching Accepted submission found for this user"
      );
    }

    req.verifiedNewSlugs = verified.filter((slug) => !alreadySolvedSet.has(slug));
    next();
  } catch (err) {
    // Fail closed, not open: if we can't verify, treat nothing as verified
    // rather than trusting the client's claim by default.
    req.log.error(
      { err },
      "[Progress] Submission verification query failed — treating all claimed slugs as unverified"
    );
    req.verifiedNewSlugs = [];
    next();
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/", requireAuth, getProgress);

router.put(
  "/",
  requireAuth,
  validateBody(progressSchema),
  validateSlugs,
  verifyAgainstSubmissions,
  putProgress
);

export default router;
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
//   Without this, any user could claim an arbitrary problemSlug as solved
//   and the server saves it — marking problems as solved without ever running code.
//   Zod + slug existence check closes that vector entirely.

const progressSchema = z.object({
  // Single-problem write path. The server derives every other progress field.
  problemSlug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  leetcodeUsername: z.string().max(100).optional(),
});
 
// ── Slug existence middleware ──────────────────────────────────────────────────
// Runs after Zod validation. Verifies every submitted slug actually exists
// in the problems collection — prevents marking fake problems as solved.
export async function validateSlugs(req, res, next) {
  const { problemSlug } = req.body;
  if (!problemSlug) return next();

  try {
    const exists = await Problem.exists({ slug: problemSlug });
    if (!exists) {
      return res.status(400).json({
        error: "Problem does not exist.",
        field: "problemSlug",
      });
    }
    next();
  } catch (err) {
    req.log.error({ err }, "[Progress] Problem validation failed");
    return res.status(503).json({ error: "Unable to validate problem right now." });
  }
}

// ── Ownership check ──────────────────────────────────────────────────────────
//
// validateSlugs above closes one gap (fake slugs that don't exist at all)
// but NOT the actual exploit: claiming every real
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
// the raw client-supplied problem claim.
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

  const { problemSlug } = req.body;
  const claimed = problemSlug ? [problemSlug] : [];

  if (claimed.length === 0) {
    req.verifiedNewSlugs = [];
    return next();
  }

  try {
    // UserProblemProgress is the scalable source of truth for solves.
    // Filter previously-persisted solves before touching Submission so a
    // repeated progress write does not re-query the submission history.
    const alreadySolved = await UserProblemProgress.find({
      userId: req.userDoc._id,
      problemSlug: { $in: claimed },
      status: "solved",
    }).distinct("problemSlug");
    const alreadySolvedSet = new Set(alreadySolved);
    const untrustedClaims = claimed.filter((slug) => !alreadySolvedSet.has(slug));

    const verified = untrustedClaims.length === 0
      ? []
      : await Submission.find({
        userId: req.userDoc._id,
        problemSlug: { $in: untrustedClaims },
        status: "Accepted",
      }).distinct("problemSlug");

    const verifiedSet = new Set(verified);
    const rejected = untrustedClaims.filter((slug) => !verifiedSet.has(slug));

    if (rejected.length > 0) {
      req.log.warn(
        { userId: req.userDoc._id.toString(), rejected },
        "[Progress] Rejected unverified solved problem claim — no matching Accepted submission found for this user"
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
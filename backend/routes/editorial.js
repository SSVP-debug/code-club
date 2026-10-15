import { Router } from "express";
import Problem from "../models/Problem.js";
import { isUserPremium } from "./billing.js";
import { requireRole } from "../middleware/roleGuard.js";
import { canAccessContestProblem } from "../services/contestProblemAccess.js";
import { getSolvedSlugs } from "../services/problemProgressService.js";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  try {
    const { slug } = req.params;
    const problem  = await Problem.findOne({ slug }).select("editorial slug title visibility").lean();

    if (!problem) return res.status(404).json({ error: "Problem not found." });

    // ── Contest access gate (Fest Readiness Audit, P0-2) ──────────────────
    // Premium accounts bypass the normal "solve it first" gate below by
    // design (see isUserPremium check further down) — without this check,
    // that path would let a premium user read a private contest problem's
    // editorial/solution before the contest ever opens, without solving
    // anything. Same generic 404 as "not found."
    if (problem.visibility === "contest") {
      const allowed = await canAccessContestProblem(slug, req.userDoc);
      if (!allowed) return res.status(404).json({ error: "Problem not found." });
    }

    // Check if user has solved this problem (userDoc populated by requireAuth)
    const solvedSlugs = req.userDoc?._id ? await getSolvedSlugs(req.userDoc._id) : [];
    const solved = solvedSlugs.includes(slug);
    const isAdmin = req.userDoc?.role === "admin";
    // Premium users can read any editorial without solving first — see PREMIUM_FEATURES.EDITORIAL_ACCESS
    const premium  = isUserPremium(req.userDoc);

    if (!solved && !isAdmin && !premium) {
      return res.status(403).json({
        error: "Solve this problem first to unlock the editorial.",
        locked: true,
      });
    }

    if (!problem.editorial?.content) {
      return res.json({ slug, content: "", available: false });
    }

    return res.json({
      slug,
      content:   problem.editorial.content,
      author:    problem.editorial.author  || "Code Club",
      updatedAt: problem.editorial.updatedAt,
      available: true,
    });

  } catch (err) {
    req.log.error({ err }, "[Editorial] GET error");
    return res.status(500).json({ error: "Failed to load editorial." });
  }
});

router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { slug }    = req.params;
    const { content } = req.body;

    if (typeof content !== "string") {
      return res.status(400).json({ error: "content must be a string." });
    }

    const problem = await Problem.findOneAndUpdate(
      { slug },
      { "editorial.content": content, "editorial.updatedAt": new Date() },
      { new: true }
    ).select("slug editorial");

    if (!problem) return res.status(404).json({ error: "Problem not found." });

    return res.json({ slug, saved: true });
  } catch (err) {
    req.log.error({ err }, "[Editorial] POST error");
    return res.status(500).json({ error: "Failed to save editorial." });
  }
});

export default router;
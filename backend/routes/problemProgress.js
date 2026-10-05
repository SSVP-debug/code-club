import { Router } from "express";
import { z } from "zod";
import UserProblemProgress from "../models/UserProblemProgress.js";

const router = Router();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["attempted", "solved"]).optional(),
  slugs: z.string().max(20_000).optional(),
});

router.get("/", async (req, res) => {
  if (!req.userDoc) {
    return res.status(503).json({ error: "Database unavailable. Try again shortly." });
  }

  try {
    const query = querySchema.parse(req.query);
    const requestedSlugs = String(query.slugs || "")
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean)
      .slice(0, 100);

    const filter = { userId: req.userDoc._id };
    if (query.status) filter.status = query.status;
    if (requestedSlugs.length) filter.problemSlug = { $in: requestedSlugs };

    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      UserProblemProgress.find(filter)
        .select("problemSlug status firstAttemptAt solvedAt attemptCount acceptedCount bestRuntime bestMemory lastAttemptAt -_id")
        .sort({ lastAttemptAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      UserProblemProgress.countDocuments(filter),
    ]);

    return res.json({
      progress: rows,
      page: query.page,
      limit: query.limit,
      total,
      hasNext: skip + rows.length < total,
      hasPrevious: query.page > 1,
    });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Invalid problem progress query." });
    }
    req.log.error({ err }, "[ProblemProgress] list failed");
    return res.status(500).json({ error: "Failed to fetch problem progress." });
  }
});

export default router;

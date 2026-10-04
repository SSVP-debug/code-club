import Problem from "../models/Problem.js";
import Submission from "../models/Submission.js";
import { getOrSetCache, invalidateCache } from "../utils/cache.js";
import { XP_BY_DIFFICULTY } from "../utils/computeXP.js";
import { getNextBestProblem } from "../utils/recommendNextProblem.js";
import { canAccessContestProblem } from "../services/contestProblemAccess.js";

const PROBLEMS_CACHE_KEY = "problems:catalog";
const CACHE_TTL_SECONDS = 5 * 60;
const ACCEPTANCE_CACHE_KEY = "problems:acceptanceRates";
const ACCEPTANCE_CACHE_TTL_SECONDS = 15 * 60;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

function withXP(problem) {
  return { ...problem, xp: XP_BY_DIFFICULTY[problem.difficulty] ?? null };
}

export async function invalidateProblemsCache() {
  await invalidateCache("problems:catalog", { prefix: true });
}

export async function invalidateAcceptanceRatesCache() {
  await invalidateCache(ACCEPTANCE_CACHE_KEY);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildCatalogFilter(query) {
  const filter = {
    visibility: { $ne: "contest" },
    enabled: { $ne: false },
  };

  if (query.difficulty && ["Easy", "Medium", "Hard"].includes(query.difficulty)) {
    filter.difficulty = query.difficulty;
  }
  if (query.topic) filter.topic = query.topic;
  if (query.pattern) filter.pattern = query.pattern;
  if (query.company) filter.companies = query.company;

  const search = String(query.search || "").trim();
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = { $regex: escaped, $options: "i" };
    filter.$or = [
      { title: regex },
      { slug: regex },
      { topic: regex },
      { pattern: regex },
      { companies: regex },
    ];
  }

  return filter;
}

function publicCatalogProjection() {
  return [
    "id", "slug", "title", "difficulty", "topic", "pattern",
    "sourceType", "companies", "estimatedTime", "campaignCode",
    "visibility", "enabled", "contentVersion",
    "-hiddentestcases", "-hiddenTestcaseSet", "-editorial.content",
  ].join(" ");
}

export const getProblems = async (req, res) => {
  try {
    const hasCatalogQuery = [
      "page", "limit", "search", "difficulty", "topic", "pattern", "company",
    ].some((key) => req.query[key] !== undefined);

    // Backward-compatible full-catalog mode is retained only for existing
    // consumers. New clients should always send page/limit. This lets us
    // migrate the frontend without a flag day while making the API itself
    // capable of bounded reads.
    if (!hasCatalogQuery) {
      const { value: problems, cacheStatus } = await getOrSetCache(
        `${PROBLEMS_CACHE_KEY}:all`,
        CACHE_TTL_SECONDS,
        async () => {
          const problems = await Problem.find({
            visibility: { $ne: "contest" },
            enabled: { $ne: false },
          })
            .select("-hiddentestcases -hiddenTestcaseSet -editorial.content")
            .sort({ id: 1 })
            .lean();
          return problems.map(withXP);
        }
      );
      res.set("X-Cache", cacheStatus);
      return res.json(problems);
    }

    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const filter = buildCatalogFilter(req.query);
    const cacheKey = `${PROBLEMS_CACHE_KEY}:${JSON.stringify({ page, limit, filter })}`;

    const { value: payload, cacheStatus } = await getOrSetCache(
      cacheKey,
      CACHE_TTL_SECONDS,
      async () => {
        const [problems, total] = await Promise.all([
          Problem.find(filter)
            .select(publicCatalogProjection())
            .sort({ id: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          Problem.countDocuments(filter),
        ]);

        return {
          problems: problems.map(withXP),
          page,
          limit,
          total,
          hasNext: page * limit < total,
          hasPrevious: page > 1,
        };
      }
    );

    res.set("X-Cache", cacheStatus);
    return res.json(payload);
  } catch (error) {
    req.log.error({ err: error }, "[Problems] getProblems failed");
    return res.status(500).json({ message: "Failed to fetch problems" });
  }
};

export const getProblemBySlug = async (req, res) => {
  try {
    const problem = await Problem.findOne({ slug: req.params.slug })
      .select("-hiddentestcases -hiddenTestcaseSet -editorial.content")
      .lean();

    if (!problem || problem.enabled === false) {
      return res.status(404).json({ message: "Problem not found" });
    }

    if (problem.visibility === "contest") {
      const allowed = await canAccessContestProblem(req.params.slug, req.userDoc);
      if (!allowed) return res.status(404).json({ message: "Problem not found" });
    }

    const solvedSlugs = req.userDoc?.solvedSlugs ?? [];
    const pathId = req.query.path || null;

    const [prevProblem, recommendedNext] = await Promise.all([
      Problem.findOne({ id: { $lt: problem.id } })
        .select("slug")
        .sort({ id: -1 })
        .lean(),
      getNextBestProblem(problem, { solvedSlugs, pathId }),
    ]);

    return res.json({
      problem: withXP(problem),
      prevSlug: prevProblem?.slug ?? null,
      nextSlug: recommendedNext?.slug ?? null,
      nextBestProblem: recommendedNext,
    });
  } catch (error) {
    req.log.error({ err: error }, "[Problems] getProblemBySlug failed");
    return res.status(500).json({ message: "Failed to fetch problem" });
  }
};

export const getAcceptanceRates = async (req, res) => {
  try {
    const { value: rates, cacheStatus } = await getOrSetCache(
      ACCEPTANCE_CACHE_KEY,
      ACCEPTANCE_CACHE_TTL_SECONDS,
      async () => {
        const grouped = await Submission.aggregate([
          { $group: {
            _id: "$problemSlug",
            total: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ["$status", "Accepted"] }, 1, 0] } },
          } },
        ]);

        const map = {};
        for (const row of grouped) {
          if (!row._id || row.total === 0) continue;
          map[row._id] = {
            accepted: row.accepted,
            total: row.total,
            rate: Math.round((row.accepted / row.total) * 100),
          };
        }
        return map;
      }
    );

    res.set("X-Cache", cacheStatus);
    return res.json(rates);
  } catch (error) {
    req.log.error({ err: error }, "[Problems] getAcceptanceRates failed");
    return res.status(500).json({ message: "Failed to fetch acceptance rates" });
  }
};

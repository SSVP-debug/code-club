import Submission from "../models/Submission.js";
import { topicStatsToObject } from "../utils/topicStats.js";
import { getSolvedSlugs } from "../services/problemProgressService.js";

// POST /api/insights — returns Claude-generated coaching text
// req.userDoc is guaranteed by requireAuth middleware
export async function getInsights(req, res) {
  const userDoc = req.userDoc;

  if (!userDoc) {
    return res.status(503).json({
      error: "Database unavailable. Try again in a moment.",
    });
  }

  // ── 1. Pull recent submissions from MongoDB ────────────────────────────
  let recentSubmissions = [];
  try {
    recentSubmissions = await Submission.find({ userId: userDoc._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  } catch (err) {
    req.log.warn({ err }, "[insights] Submission fetch failed — continuing with empty submission history");
    // Continue with empty array — Claude can still give profile-based advice
  }

  // ── 2. Summarise the data so the prompt stays concise ─────────────────
  const totalSubmissions = recentSubmissions.length;
  const acceptedCount = recentSubmissions.filter(
    (s) => s.status === "Accepted"
  ).length;
  const acceptanceRate =
    totalSubmissions > 0
      ? ((acceptedCount / totalSubmissions) * 100).toFixed(1)
      : null;

  // Unique problems the user has attempted (not just solved)
  const attemptedSlugs = [
    ...new Set(recentSubmissions.map((s) => s.problemSlug)),
  ];

  // Per-problem attempt/pass summary
  const problemSummary = attemptedSlugs.slice(0, 20).map((slug) => {
    const attempts = recentSubmissions.filter((s) => s.problemSlug === slug);
    const solved = attempts.some((s) => s.status === "Accepted");
    const languages = [...new Set(attempts.map((s) => s.language))];
    return { slug, attempts: attempts.length, solved, languages };
  });

  // topicStats is stored as an array of { topic, count } subdocuments —
  // convert to the plain-object wire format the rest of this function expects.
  const topicStats = topicStatsToObject(userDoc.topicStats);

  const solvedDifficulty = userDoc.solvedDifficulty || {
    easy: 0,
    medium: 0,
    hard: 0,
  };

  const totalSolved = (await getSolvedSlugs(userDoc._id)).length;

  // ── 3. Check if user has enough data for meaningful insights ──────────
  if (totalSolved === 0 && totalSubmissions === 0) {
    return res.json({
      insights: null,
      message: "Solve a few problems first — your personalised insights will appear here.",
    });
  }

  // ── 4. Build the Claude prompt ─────────────────────────────────────────
  const userProfile = {
    totalSolved,
    solvedDifficulty,
    topicStats,
    recentActivity: {
      totalSubmissions,
      acceptanceRate: acceptanceRate ? `${acceptanceRate}%` : "N/A",
      problemSummary,
    },
  };

  const systemPrompt = `You are a senior DSA coach reviewing a student's coding practice data. 
Give direct, specific, actionable coaching — like a mentor who has looked at their numbers, not a chatbot reciting tips.
Your response must be a JSON object with exactly these keys:
{
  "strongestArea": "one sentence, name the specific topic/pattern they're best at and why the data shows it",
  "weakestArea": "one sentence, name the specific topic/pattern they struggle with most",
  "nextStep": "one concrete recommendation for what to practice next, e.g. 'Try sliding window problems before moving to graphs — your array acceptance rate is strong but you've only attempted 2 sliding window problems'",
  "encouragement": "one short sentence, honest and specific to their level — not generic praise"
}
Base everything on the actual numbers. If a topic has 0 solves, say so. If acceptance rate is low, address it directly.
Respond ONLY with valid JSON. No markdown, no preamble.`;

  const userMessage = `Here is my practice data:\n${JSON.stringify(userProfile, null, 2)}`;

  // ── 5. Call Claude API ─────────────────────────────────────────────────
  let claudeResponse;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      req.log.error({ httpStatus: response.status, body: errBody }, "[insights] Anthropic API error");
      return res.status(502).json({
        error: "AI service temporarily unavailable. Try again in a moment.",
      });
    }

    claudeResponse = await response.json();
  } catch (err) {
    req.log.error({ err }, "[insights] Fetch to Anthropic failed");
    return res.status(502).json({
      error: "Could not reach AI service. Check your connection and try again.",
    });
  }

  // ── 6. Parse and return ────────────────────────────────────────────────
  const rawText = claudeResponse.content?.[0]?.text ?? "";

  let parsed;
  try {
    // Strip markdown fences if Claude adds them despite instructions
    const clean = rawText.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    req.log.error({ rawText }, "[insights] JSON parse failed on Claude response");
    return res.status(502).json({
      error: "Received an unexpected response from the AI. Try again.",
    });
  }

  return res.json({ insights: parsed });
}
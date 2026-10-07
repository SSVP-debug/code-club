import User from "../models/User.js";
import Submission from "../models/Submission.js";
import { getOrSetCache, invalidateCache } from "../utils/cache.js";
import { getLevel } from "../utils/xpLevel.js";
import { topicStatsToObject } from "../utils/topicStats.js";
import { getSolvedSlugs, getActivityDays } from "../services/problemProgressService.js";

// Shorter TTL than problems/leaderboard (2 min vs 5 min) — this endpoint is
// what recruiters and "share my profile" links hit, and a user who just
// solved a problem reasonably expects their public profile to catch up
// fairly quickly, not sit stale for 5 minutes.
const CACHE_TTL_SECONDS = 2 * 60;

function profileCacheKey(username) {
  return `profile:${username.toLowerCase()}`;
}

/** Called from progressController after a save that changes totalXP/solvedSlugs. */
export async function invalidateProfileCache(username) {
  if (!username) return;
  await invalidateCache(profileCacheKey(username));
}

export async function getPublicProfile(req, res) {
  try {
    const { username } = req.params;

    const { value: profile, cacheStatus } = await getOrSetCache(
      profileCacheKey(username),
      CACHE_TTL_SECONDS,
      async () => fetchProfile(username)
    );

    if (profile === null) {
      return res.status(404).json({ error: "Profile not found" });
    }
    if (profile.private) {
      return res.status(403).json({ error: "This profile is private" });
    }

    res.set("X-Cache", cacheStatus);
    return res.json(profile.data);

  } catch (err) {
    req.log.error({ err }, "[PublicProfile] getPublicProfile failed");
    return res.status(500).json({ error: "Failed to load profile" });
  }
}

/**
 * Does the actual DB work. Returns a wrapper object rather than throwing
 * for "not found" / "private" cases, because those are legitimate,
 * cacheable outcomes (no point re-querying Mongo every request for a
 * profile that's set to private) — only real errors should reject and
 * fall through to the getOrSetCache error path.
 */
async function fetchProfile(username) {
  const user = await User.findOne({
    username: username.toLowerCase(),
  }).lean();

  if (!user) return null;
  if (!user.isProfilePublic) return { private: true, data: null };

  const [solvedSlugs, activityDates] = await Promise.all([
    getSolvedSlugs(user._id),
    getActivityDays(user._id),
  ]);

  const level = getLevel(user.totalXP || 0);

  // ── Language breakdown — from accepted submissions ─────────────────────
  // Count accepted submissions per language.
  // This is what recruiters actually want to see — not just "50 problems solved"
  // but "50 problems solved: 30 Python, 15 Java, 5 C++"
  const acceptedSubmissions = await Submission
    .find({
      userId: user._id,
      status: "Accepted",
    })
    .select("language problemSlug")
    .lean();

  // Count per language
  const languageCounts = {};
  // Unique accepted slugs per language (one problem may be solved in multiple languages)
  const solvedPerLanguage = {};
  for (const sub of acceptedSubmissions) {
    languageCounts[sub.language] = (languageCounts[sub.language] || 0) + 1;
    if (!solvedPerLanguage[sub.language]) solvedPerLanguage[sub.language] = new Set();
    solvedPerLanguage[sub.language].add(sub.problemSlug);
  }

  const languageBreakdown = Object.entries(solvedPerLanguage)
    .map(([lang, slugSet]) => ({ language: lang, solved: slugSet.size }))
    .sort((a, b) => b.solved - a.solved);

  // ── Recent activity (last 5 solves for profile feed) ──────────────────
  const recentSolves = (user.recentActivity || [])
    .slice(0, 5)
    .map((a) => ({
      slug: a.slug,
      title: a.title,
      difficulty: a.difficulty,
      time: a.time,
    }));

  return {
    private: false,
    data: {
      username:        user.username,
      displayName:     user.displayName,
      joinedDate:      user.joinedDate,
      totalXP:         user.totalXP || 0,
      level,
      solvedCount:     solvedSlugs.length,
      currentStreak:   user.currentStreak || 0,
      longestStreak:   user.longestStreak || 0,
      solvedDifficulty: user.solvedDifficulty || { easy: 0, medium: 0, hard: 0 },
      topicStats:      topicStatsToObject(user.topicStats),
      achievements:    user.achievements || [],
      activityDates,
      // New fields for recruiter-useful profile
      languageBreakdown,
      recentSolves,
      totalSubmissions: acceptedSubmissions.length,
      // Recruiter-facing supplementary info only — never fed into totalXP
      // or this platform's own solve count. See routes/leetcode.js header
      // for why.
      leetcode: user.leetcodeUsername
        ? {
            username: user.leetcodeUsername,
            ...user.leetcodeStats,
          }
        : null,
      // Recruiter Snapshot (Phase 9C) — read-only here; editable only via
      // PATCH /api/users/me from the owner's own /profile page.
      recruiterSnapshot: {
        availableForWork: user.recruiterSnapshot?.availableForWork ?? false,
        preferredRole: user.recruiterSnapshot?.preferredRole ?? null,
        expectedGraduation: user.recruiterSnapshot?.expectedGraduation ?? null,
      },
      // Pinned Favorite Problems (Phase 9D) — already denormalized
      // (slug/title/difficulty) at pin time, no join needed here.
      pinnedProblems: user.pinnedProblems || [],

      // Developer Profile — GitHub/LinkedIn/Featured Project are treated
      // as public-safe (same tier as recruiterSnapshot above). resumeUrl
      // is only included when the owner has explicitly opted it into
      // public visibility; saving a resume link must never implicitly
      // expose it to anyone viewing this profile.
      developerProfile: {
        githubUrl: user.developerProfile?.githubUrl ?? null,
        linkedinUrl: user.developerProfile?.linkedinUrl ?? null,
        featuredProjects: user.developerProfile?.featuredProjects || [],
        resumeUrl:
          user.developerProfile?.resumeVisibility === "public"
            ? user.developerProfile?.resumeUrl ?? null
            : null,
      },
    },
  };
}
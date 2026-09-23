import Problem from "../models/Problem.js";
import { invalidateProfileCache } from "./publicProfileController.js";
import {
  normalizeGithubProfileUrl,
  normalizeLinkedinUrl,
  normalizeGenericUrl,
  parseGithubRepoUrl,
} from "../utils/profileLinks.js";

// Controlled vocabulary for preferredRole — keeps the field filterable on
// the recruiter/TPO side (a free-text field would fragment into "Backend",
// "backend dev", "Backend Developer", etc. and be useless for search).
export const PREFERRED_ROLES = [
  "Backend",
  "Frontend",
  "Full Stack",
  "Mobile",
  "Data / ML",
  "DevOps",
  "QA",
  "Other",
];

const CURRENT_YEAR = new Date().getFullYear();

function isValidGraduationYear(value) {
  if (!/^\d{4}$/.test(value)) return false;
  const year = Number(value);
  // Generous window: a few years back (recent grads still job-hunting)
  // through 8 years out (nobody's placement-planning further than that).
  return year >= CURRENT_YEAR - 5 && year <= CURRENT_YEAR + 8;
}

function serializeUser(userDoc) {
  return {
    id: userDoc._id,
    firebaseUid: userDoc.firebaseUid,
    email: userDoc.email,
    displayName: userDoc.displayName,
    username: userDoc.username || "",
    isProfilePublic: userDoc.isProfilePublic,
    visibleToTpo: userDoc.visibleToTpo ?? true,

    // Active application role vs authorized roles — see models/User.js's
    // role/roles comment. Included here so any caller of GET /api/me gets
    // the same role/roles shape as /api/init, rather than having to
    // cross-reference two endpoints.
    role: userDoc.role,
    roles: userDoc.roles?.length ? userDoc.roles : ["student"],

    leetcodeUsername: userDoc.leetcodeUsername || "",
    leetcodeStats: userDoc.leetcodeStats || null,
    joinedDate: userDoc.joinedDate,
    emailPreferences: userDoc.emailPreferences || { weeklyReview: true },

    recruiterSnapshot: {
      availableForWork: userDoc.recruiterSnapshot?.availableForWork ?? false,
      preferredRole: userDoc.recruiterSnapshot?.preferredRole ?? null,
      expectedGraduation: userDoc.recruiterSnapshot?.expectedGraduation ?? null,
    },

    preferences: {
      blankEditorByDefault: userDoc.preferences?.blankEditorByDefault ?? false,
      hideDifficultyLabels: userDoc.preferences?.hideDifficultyLabels ?? false,
    },

    pinnedProblems: userDoc.pinnedProblems || [],

    savedProblems: userDoc.savedProblems || [],

    developerProfile: {
      githubUrl: userDoc.developerProfile?.githubUrl ?? null,
      linkedinUrl: userDoc.developerProfile?.linkedinUrl ?? null,
      resumeUrl: userDoc.developerProfile?.resumeUrl ?? null,
      resumeVisibility: userDoc.developerProfile?.resumeVisibility ?? "private",
      featuredProjects: userDoc.developerProfile?.featuredProjects ?? [],
    },
  };
}

export async function getMe(req, res) {
  if (!req.userDoc) return res.status(503).json({ error: "Database unavailable." });
  res.json(serializeUser(req.userDoc));
}

export async function updateMe(req, res) {
  if (!req.userDoc) return res.status(503).json({ error: "Database unavailable." });

  const {
    leetcodeUsername,
    displayName,
    username,
    emailPreferences,
    recruiterSnapshot,
    preferences,
    developerProfile,
    visibleToTpo,
  } = req.body;

  if (visibleToTpo !== undefined) {
    if (typeof visibleToTpo !== "boolean") {
      return res.status(400).json({ error: "visibleToTpo must be a boolean" });
    }
    req.userDoc.visibleToTpo = visibleToTpo;
  }

  if (leetcodeUsername !== undefined) {
    req.userDoc.leetcodeUsername = leetcodeUsername;
  }

  if (displayName !== undefined) {
    req.userDoc.displayName = displayName;
  }

  if (username !== undefined) {
    const normalized =
      username
        .trim()
        .toLowerCase();

    const valid =
      /^[a-z0-9_-]{3,20}$/.test(
        normalized
      );

    if (!valid) {
      return res.status(400).json({
        error:
          "Username must be 3-20 chars and contain only letters, numbers, _ or -",
      });
    }

    const existing =
      await req.userDoc.constructor.findOne(
        {
          username: normalized,
          _id: {
            $ne:
              req.userDoc._id,
          },
        }
      );

    if (existing) {
      return res.status(409).json({
        error:
          "Username already taken",
      });
    }

    req.userDoc.username =
      normalized;
  }
  

  if (emailPreferences !== undefined && typeof emailPreferences.weeklyReview === "boolean") {
    req.userDoc.emailPreferences = {
      ...(req.userDoc.emailPreferences || {}),
      weeklyReview: emailPreferences.weeklyReview,
    };
  }

  if (recruiterSnapshot !== undefined) {
    const { availableForWork, preferredRole, expectedGraduation } = recruiterSnapshot;
    const next = { ...(req.userDoc.recruiterSnapshot?.toObject?.() ?? req.userDoc.recruiterSnapshot ?? {}) };

    if (availableForWork !== undefined) {
      if (typeof availableForWork !== "boolean") {
        return res.status(400).json({ error: "availableForWork must be a boolean" });
      }
      next.availableForWork = availableForWork;
    }

    if (preferredRole !== undefined) {
      if (preferredRole !== null && !PREFERRED_ROLES.includes(preferredRole)) {
        return res.status(400).json({
          error: `preferredRole must be one of: ${PREFERRED_ROLES.join(", ")}`,
        });
      }
      next.preferredRole = preferredRole;
    }

    if (expectedGraduation !== undefined) {
      if (expectedGraduation !== null && !isValidGraduationYear(expectedGraduation)) {
        return res.status(400).json({
          error: "expectedGraduation must be a 4-digit year within a reasonable range",
        });
      }
      next.expectedGraduation = expectedGraduation;
    }

    req.userDoc.recruiterSnapshot = next;
  }

  // ── Editor + display preferences ────────────────────────────────────
  if (preferences !== undefined) {
    const { blankEditorByDefault, hideDifficultyLabels } = preferences;
    const next = { ...(req.userDoc.preferences?.toObject?.() ?? req.userDoc.preferences ?? {}) };

    if (blankEditorByDefault !== undefined) {
      if (typeof blankEditorByDefault !== "boolean") {
        return res.status(400).json({ error: "blankEditorByDefault must be a boolean" });
      }
      next.blankEditorByDefault = blankEditorByDefault;
    }

    if (hideDifficultyLabels !== undefined) {
      if (typeof hideDifficultyLabels !== "boolean") {
        return res.status(400).json({ error: "hideDifficultyLabels must be a boolean" });
      }
      next.hideDifficultyLabels = hideDifficultyLabels;
    }

    req.userDoc.preferences = next;
  }

  // ── Developer Profile (GitHub / LinkedIn / Resume / Featured Project) ──
  if (developerProfile !== undefined) {
    const current =
      req.userDoc.developerProfile?.toObject?.() ?? req.userDoc.developerProfile ?? {};
    const next = { ...current };

    if (developerProfile.githubUrl !== undefined) {
      const result = normalizeGithubProfileUrl(developerProfile.githubUrl);
      if (!result.ok) return res.status(400).json({ error: result.error });
      next.githubUrl = result.value;
    }

    if (developerProfile.linkedinUrl !== undefined) {
      const result = normalizeLinkedinUrl(developerProfile.linkedinUrl);
      if (!result.ok) return res.status(400).json({ error: result.error });
      next.linkedinUrl = result.value;
    }

    if (developerProfile.resumeUrl !== undefined) {
      const result = normalizeGenericUrl(developerProfile.resumeUrl, { label: "resume link" });
      if (!result.ok) return res.status(400).json({ error: result.error });
      next.resumeUrl = result.value;
    }

    if (developerProfile.resumeVisibility !== undefined) {
      if (!["private", "public"].includes(developerProfile.resumeVisibility)) {
        return res.status(400).json({ error: "resumeVisibility must be 'private' or 'public'" });
      }
      next.resumeVisibility = developerProfile.resumeVisibility;
    }

    // Single field in, single-item array stored — same shape the schema
    // already supports for a future multi-project list. Sending null/""
    // clears it.
    if (developerProfile.featuredProjectUrl !== undefined) {
      const result = parseGithubRepoUrl(developerProfile.featuredProjectUrl);
      if (!result.ok) return res.status(400).json({ error: result.error });
      next.featuredProjects = result.value ? [result.value] : [];
    }

    req.userDoc.developerProfile = next;
  }

  await req.userDoc.save();

  // Public profile is cached for 2 minutes (see publicProfileController).
  // A student flipping "available for work" on, or adding a GitHub/resume
  // link, shouldn't have to wait for that TTL to expire before recruiters
  // see it. Fire-and-forget, same pattern as progressController — cache
  // invalidation failure must never block the save response.
  invalidateProfileCache(req.userDoc.username).catch((err) =>
    req.log?.error?.({ err }, "[userController] invalidateProfileCache failed")
  );

  res.json(serializeUser(req.userDoc));
}

// ── Pinned Favorite Problems (Phase 9D) ────────────────────────────────────

const MAX_PINNED_PROBLEMS = 6;

export async function pinProblem(req, res) {
  if (!req.userDoc) return res.status(503).json({ error: "Database unavailable." });

  const { slug } = req.body;

  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "slug is required" });
  }

  // Favorites are meant to showcase real, solved work — not a wishlist.
  // This also means we never need to worry about someone pinning a
  // problem before they've actually solved it and the display looking
  // hollow on their public profile.
  if (!req.userDoc.solvedSlugs.includes(slug)) {
    return res.status(400).json({ error: "You can only pin problems you've solved" });
  }

  const already = req.userDoc.pinnedProblems.some((p) => p.slug === slug);
  if (already) {
    return res.json(serializeUser(req.userDoc));
  }

  if (req.userDoc.pinnedProblems.length >= MAX_PINNED_PROBLEMS) {
    return res.status(400).json({
      error: `You can pin up to ${MAX_PINNED_PROBLEMS} problems. Unpin one first.`,
    });
  }

  const problem = await Problem.findOne({ slug }).select("title difficulty").lean();
  if (!problem) {
    return res.status(404).json({ error: "Problem not found" });
  }

  req.userDoc.pinnedProblems.push({
    slug,
    title: problem.title,
    difficulty: problem.difficulty,
  });

  await req.userDoc.save();

  invalidateProfileCache(req.userDoc.username).catch((err) =>
    req.log?.error?.({ err }, "[userController] invalidateProfileCache failed")
  );

  res.json(serializeUser(req.userDoc));
}

export async function unpinProblem(req, res) {
  if (!req.userDoc) return res.status(503).json({ error: "Database unavailable." });

  const { slug } = req.params;

  req.userDoc.pinnedProblems = req.userDoc.pinnedProblems.filter((p) => p.slug !== slug);

  await req.userDoc.save();

  invalidateProfileCache(req.userDoc.username).catch((err) =>
    req.log?.error?.({ err }, "[userController] invalidateProfileCache failed")
  );

  res.json(serializeUser(req.userDoc));
}

// ── Saved Problems (private read-later list) ────────────────────────────────
// Deliberately simpler than pin/unpin above: no solved-only restriction (the
// whole point is bookmarking things you HAVEN'T done yet), no cap, and no
// Problem lookup/denormalization or invalidateProfileCache — this is never
// shown on the public profile, so there's nothing to keep in sync there.

export async function saveProblem(req, res) {
  if (!req.userDoc) return res.status(503).json({ error: "Database unavailable." });

  const { slug } = req.body;

  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "slug is required" });
  }

  const already = req.userDoc.savedProblems.some((p) => p.slug === slug);
  if (already) {
    return res.json(serializeUser(req.userDoc));
  }

  req.userDoc.savedProblems.push({ slug, savedAt: new Date() });

  await req.userDoc.save();

  res.json(serializeUser(req.userDoc));
}

export async function unsaveProblem(req, res) {
  if (!req.userDoc) return res.status(503).json({ error: "Database unavailable." });

  const { slug } = req.params;

  req.userDoc.savedProblems = req.userDoc.savedProblems.filter((p) => p.slug !== slug);

  await req.userDoc.save();

  res.json(serializeUser(req.userDoc));
}

// ── POST /api/users/me/switch-role (role/profile isolation fix) ────────────
// Lets an identity with more than one authorized role (see models/User.js's
// grantRole()) change which one is currently ACTIVE — e.g. a Student+TPO
// account stepping from their Student workspace into their TPO one. This
// is the only place `role` should be reassigned to a value the account
// didn't just register for; registration (routes/tpo.js, routes/
// recruiter.js) sets both `role` and `roles` together.
//
// Deliberately backend-authoritative: the target role is checked against
// `req.userDoc.roles` (server state derived from Firebase-verified
// req.userDoc, never trusted from the request body) before it's allowed,
// so a Student can't switch themselves into "tpo" or "recruiter" just by
// calling this endpoint without ever having registered for that role.
// "admin" is intentionally excluded — that's granted out-of-band (no
// self-service registration flow for it) and uses the separate
// impersonation mechanism (middleware/auth.js) rather than this switch.
const SWITCHABLE_ROLES = ["student", "recruiter", "tpo"];

export async function switchActiveRole(req, res) {
  if (!req.userDoc) return res.status(503).json({ error: "Database unavailable." });

  const { role } = req.body || {};

  if (!SWITCHABLE_ROLES.includes(role)) {
    return res.status(400).json({
      error: `role must be one of: ${SWITCHABLE_ROLES.join(", ")}`,
    });
  }

  const authorizedRoles = req.userDoc.roles?.length ? req.userDoc.roles : ["student"];

  if (!authorizedRoles.includes(role)) {
    return res.status(403).json({
      error: `Not authorized for role: ${role}.`,
      authorizedRoles,
    });
  }

  req.userDoc.role = role;
  await req.userDoc.save();

  return res.json({ success: true, role, roles: authorizedRoles });
}
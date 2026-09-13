/**
 * GET /api/init
 *
 * Single boot endpoint that returns everything the frontend needs on first load:
 *   - User's progress (solvedSlugs, XP, streaks, achievements, …)
 *   - User's recent submission history (last 50)
 *
 * This replaces the 3 sequential API calls that were made on app boot:
 *   initProgress() → getProgress() → getSubmissions()
 *
 * Runs both MongoDB queries in parallel via Promise.all.
 * One Firebase token refresh, one HTTP round-trip, one response.
 */

import { Router } from "express";
import User from "../models/User.js";
import Submission from "../models/Submission.js";
import { progressToClientForRole } from "../controllers/progressController.js";
import { getStudentDayKey } from "../utils/studentDay.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    if (!req.userDoc) {
      // MongoDB is down but Firebase auth passed — return empty scaffold
      // so the frontend can still render rather than hard-crashing.
      return res.json({
        progress: {
          solvedSlugs: [],
          topicStats: {},
          activityDates: [],
          achievements: [],
          dailyChallengeHistory: [],
          solvedDifficulty: { easy: 0, medium: 0, hard: 0 },
          recentActivity: [],
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null,
          totalXP: 0,
          joinedDate: null,
          leetcodeUsername: "",
        },
        submissions: [],
        impersonation: { active: false },
        _dbDown: true,
      });
    }

    // Submission history is student-track data, same as progress below —
    // only fetch/return it when the session's ACTIVE role is "student".
    // Skipping the query entirely for TPO/recruiter/admin sessions is both
    // the role-isolation fix (a TPO must never see a leftover Student
    // registration's submission history) and a free perf win (no query to
    // run in the first place).
    const submissions =
      req.userDoc.role === "student"
        ? await Submission
            .find({ userId: req.userDoc._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()
        : [];

    // Admin impersonation state — req.actingAdminDoc is only set (by
    // requireAuth) while an admin is actively viewing as someone else.
    // `user.role` above already reflects the impersonated target (by
    // design, so the rest of the app behaves exactly as that user); this
    // block is purely so the UI can show "Impersonating X" instead of the
    // normal "Admin Preview" strip, and offer an Exit action.
    const impersonation = req.actingAdminDoc
      ? {
          active: true,
          adminEmail: req.actingAdminDoc.email,
          targetEmail: req.userDoc.email,
          targetDisplayName: req.userDoc.displayName,
          targetRole: req.userDoc.role,
        }
      : { active: false };

    return res.json({
      user: {
        role: req.userDoc.role,
        // Authorized roles vs the single active `role` above — see
        // models/User.js's role/roles comment. Lets the frontend offer a
        // real workspace switch (WorkspaceSwitcher.jsx) to any account
        // with more than one, not just admin.
        roles: req.userDoc.roles?.length ? req.userDoc.roles : ["student"],
        username: req.userDoc.username || "",
        leetcodeUsername: req.userDoc.leetcodeUsername || "",
        leetcodeStats: req.userDoc.leetcodeStats || null,
        recruiterSnapshot: {
          availableForWork: req.userDoc.recruiterSnapshot?.availableForWork ?? false,
          preferredRole: req.userDoc.recruiterSnapshot?.preferredRole ?? null,
          expectedGraduation: req.userDoc.recruiterSnapshot?.expectedGraduation ?? null,
        },
        preferences: {
          blankEditorByDefault: req.userDoc.preferences?.blankEditorByDefault ?? false,
          hideDifficultyLabels: req.userDoc.preferences?.hideDifficultyLabels ?? false,
        },
        pinnedProblems: req.userDoc.pinnedProblems || [],
        savedProblems: req.userDoc.savedProblems || [],
        developerProfile: {
          githubUrl: req.userDoc.developerProfile?.githubUrl ?? null,
          linkedinUrl: req.userDoc.developerProfile?.linkedinUrl ?? null,
          resumeUrl: req.userDoc.developerProfile?.resumeUrl ?? null,
          resumeVisibility: req.userDoc.developerProfile?.resumeVisibility ?? "private",
          featuredProjects: req.userDoc.developerProfile?.featuredProjects || [],
        },
      },

      impersonation,

      // Role-gated — see progressToClientForRole's comment in
      // progressController.js. Returns real solvedSlugs/XP/streak/etc.
      // only when `role === "student"`; any other active role (tpo,
      // recruiter, admin) gets the same zeroed shape as the `_dbDown`
      // fallback above, regardless of what this document's student-track
      // fields actually hold from a prior registration.
      progress: progressToClientForRole(req.userDoc),

      submissions: submissions.map((doc) => ({
        id: doc._id.toString(),
        problemSlug: doc.problemSlug,
        problemTitle: doc.problemTitle,
        language: doc.language,
        status: doc.status,
        passed: doc.passed,
        total: doc.total,
        visiblePassed: doc.visiblePassed,
        hiddenPassed: doc.hiddenPassed,
        executionTime: doc.executionTime,
        expectedOutput: doc.expectedOutput,
        actualOutput: doc.actualOutput,
        time: new Date(doc.createdAt).toISOString(),
        // Same IST day-key policy as submissionController.js's
        // toClientSubmission() — see backend/utils/studentDay.js.
        date: getStudentDayKey(doc.createdAt),
        createdAt: doc.createdAt,
      })),
    });

  } catch (err) {
    req.log.error({ err }, "[/api/init] Error");
    return res.status(500).json({ error: "Failed to load initial data." });
  }
});

export default router;
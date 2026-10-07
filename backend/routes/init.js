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
import { getSolvedSlugs, getActivityDays } from "../services/problemProgressService.js";
import { getStudentDayKey } from "../utils/studentDay.js";
import DailyChallengeCompletion from "../models/DailyChallengeCompletion.js";
import { listSavedProblems } from "../services/userSavedProblemService.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    if (!req.userDoc) {
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

    // Submission history and solved-problem progress are student-track data.
    // Keep the two reads in parallel; UserProblemProgress is the scalable
    // source for solved slugs while User remains the compatibility store for
    // the other progress fields during this migration phase.
    const [submissions, solvedSlugs, activityDates, savedProblems, dailyChallengeHistory] = await Promise.all([
      req.userDoc.role === "student"
        ? Submission
            .find({ userId: req.userDoc._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()
        : Promise.resolve([]),
      req.userDoc.role === "student"
        ? getSolvedSlugs(req.userDoc._id)
        : Promise.resolve([]),
      req.userDoc.role === "student"
        ? getActivityDays(req.userDoc._id)
        : Promise.resolve([]),
      req.userDoc.role === "student"
        ? listSavedProblems(req.userDoc._id)
        : Promise.resolve([]),
      req.userDoc.role === "student"
        ? DailyChallengeCompletion.find({ userId: req.userDoc._id })
            .select("date slug completedAt -_id")
            .sort({ date: -1 })
            .limit(30)
            .lean()
        : Promise.resolve([]),
    ]);

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
        savedProblems,
        developerProfile: {
          githubUrl: req.userDoc.developerProfile?.githubUrl ?? null,
          linkedinUrl: req.userDoc.developerProfile?.linkedinUrl ?? null,
          resumeUrl: req.userDoc.developerProfile?.resumeUrl ?? null,
          resumeVisibility: req.userDoc.developerProfile?.resumeVisibility ?? "private",
          featuredProjects: req.userDoc.developerProfile?.featuredProjects || [],
        },
      },

      impersonation,
      progress: {
        ...(await progressToClientForRole(req.userDoc, solvedSlugs, activityDates)),
        dailyChallengeHistory,
      },

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

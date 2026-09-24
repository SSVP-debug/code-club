import { Trophy } from "lucide-react";
import { createTheme } from "../themeSchema";

/**
 * Default — the neutral, unthemed experience.
 * No story, no roleplay — just plain, standard product language.
 * This is what a user gets after "Reset to Default Theme" in Settings.
 */
export const defaultTheme = createTheme({
    id: "default",

    name: "Default",

    description:
        "A clean, no-frills experience with standard labels no story, no roleplay.",

    colors: {
        // Phase 11A: previously #ffffff/#71717a placeholders. Now matches the
        // teal brand color applied app-wide in Button.jsx, so a student on
        // "no theme" sees the same identity everywhere — not a mismatched
        // white accent next to teal buttons elsewhere in the app.
        primary: "#2dd4bf",   // teal-400 — bright tone, pairs with black text
        secondary: "#18181b",
        border: "#134e4a",    // teal-tinted dark border, not generic zinc
        accent: "#0d9488",    // teal-600 — deeper tone for gradients/hover
        background: "#0b0d10",
        surface: "#10131a",
        surfaceElevated: "#141820",
        muted: "#a1a1aa",
        glow: "#2dd4bf",
        gradient: "linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%)",
    },

    background: null,

    atmosphere: {
        artworkOpacity: 0,
        artworkPosition: "center",
        overlayOpacity: 0,
        glowOpacity: 0,
        gridOpacity: 0,
        scanlineOpacity: 0,
        vignetteOpacity: 0,
        animation: "none",
    },

    words: {
        run: "Run",
        submit: "Submit",

        accepted: "Accepted",
        wrongAnswer: "Wrong Answer",

        runtimeError: "Runtime Error",
        compileError: "Compile Error",

        testcases: "Test Cases",
        debug: "Debug Console",

        dashboard: "Dashboard",
        welcomeTagline: "Ready to solve today's problem?",
        problems: "Problems",
        analytics: "Analytics",
        profile: "Profile",
        judgeError: "Judge Error",
        rank: "Rank",
        level: "Level",
        nextMilestone: "more problems to next level",
        acceptanceRate: "Acceptance Rate",
        averageRuntime: "Average Runtime",
        favoriteLanguage: "Favorite Language",
        totalSubmissions: "Total Submissions",
        dailyChallenge: "Daily Challenge",
        difficulty: "Difficulty",
        solveChallenge: "Solve Challenge",
        aiInsights: "AI Insights",
        strongestTopic: "Strongest Topic",
        weakestTopic: "Weakest Topic",
        recommendation: "Recommendation",
        coachNote: "Coach's Note",
        achievements: "Achievements",
        noAchievements: "No achievements unlocked yet.",
        achievementIcon: Trophy,
        publicProfile: "Public Profile",
        totalSolved: "Total Solved",
        easySolved: "Easy Solved",
        mediumSolved: "Medium Solved",
        hardSolved: "Hard Solved",
        topics: "Topics",
        joined: "Joined",
        recentActivity: "Recent Activity",
        connectLeetcode: "Connect LeetCode",
        searchProblems: "Search problems...",
        all: "All",
        easy: "Easy",
        medium: "Medium",
        hard: "Hard",

        problemFound: "problem found",
        problemsFound: "problems found",

        noProblemsFound: "No problems match your filters.",
        clearFilters: "Clear Filters",
        topic: "Topic",
        solveProblem: "Solve Problem",
        language: "Language",
        advancedTesting: "Advanced Testing",
        customInput: "Custom Input",
        customInputPlaceholder: "Enter custom input...",
    },
});
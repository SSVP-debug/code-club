import { FlaskConical } from "lucide-react";
import { createTheme } from "../themeSchema";

export const breakingBugTheme = createTheme({
    id: "breakingBug",

    name: "Breaking Bug",

    description:
        "Every bug is a reaction. Every solution is a discovery.",

    colors: {
        primary: "#22c55e",
        secondary: "#18181b",
        border: "#3f3f46",
        accent: "#16a34a",
        background: "#07100b",
        surface: "#0f1812",
        surfaceElevated: "#162219",
        muted: "#a7b8ab",
        glow: "#22c55e",
        gradient: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
    },

    background: "breakingBug",

    atmosphere: {
        artworkOpacity: 0.10,
        artworkPosition: "center",
        overlayOpacity: 0.78,
        glowOpacity: 0.13,
        gridOpacity: 0.03,
        scanlineOpacity: 0,
        vignetteOpacity: 0.70,
        animation: "none",
    },

    words: {
        run: "Cook",
        submit: "Publish Research",

        accepted: "Crystal Clear",
        wrongAnswer: "Unstable Reaction",

        runtimeError: "Lab Explosion(runtimeError)",
        compileError: "Formula Corrupted(compileError)",

        testcases: "Experiments",
        debug: "Lab Report",
        dashboard: "Dashboard",
        welcomeTagline: "Ready for today's experiment?",
        problems: "Experiments",
        analytics: "Research Lab",
        profile: "Scientist Profile",
        judgeError: "Research System Failure",
        rank: "Scientist Rank",
        level: "Research Level",
        nextMilestone: "more experiments to next breakthrough",
        acceptanceRate: "Experiment Success Rate",
        averageRuntime: "Reaction Speed",
        favoriteLanguage: "Primary Formula",
        totalSubmissions: "Experiments Conducted",
        dailyChallenge: "Today's Experiment",
        difficulty: "Volatility",
        solveChallenge: "Run Experiment",
        aiInsights: "Research Analysis",
        strongestTopic: "Strongest Formula",
        weakestTopic: "Unstable Formula",
        recommendation: "Lab Recommendation",
        coachNote: "Notes from the Lab",
        achievements: "Research Milestones",
        noAchievements: "No research milestones unlocked yet.",
        achievementIcon: FlaskConical,
        publicProfile: "Research Profile",
        totalSolved: "Experiments Verified",
        easySolved: "Stable Reactions",
        mediumSolved: "Reactive Studies",
        hardSolved: "Volatile Experiments",
        topics: "Research Fields",
        joined: "Lab Joined",
        recentActivity: "Research Timeline",
        connectLeetcode: "Connect Research Archive",
        searchProblems: "Search experiments...",
        all: "All",
        easy: "Stable",
        medium: "Reactive",
        hard: "Volatile",

        problemFound: "experiment found",
        problemsFound: "experiments found",

        noProblemsFound: "No experiments match your filters.",
        clearFilters: "Reset Research",

        topic: "Research Field",
        solveProblem: "Run Experiment",
        language: "Formula",
        advancedTesting: "Advanced Cook",
        customInput: "Custom Ingredients",
        customInputPlaceholder: "Enter reaction input...",
    },
});
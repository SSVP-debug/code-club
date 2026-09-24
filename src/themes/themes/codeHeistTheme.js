import { Vault } from "lucide-react";
import { createTheme } from "../themeSchema";

export const codeHeistTheme = createTheme({
    id: "codeHeist",

    name: "Code Heist",

    description:
        "Crack vaults, bypass security systems and become a legendary hacker.",

    colors: {
        primary: "#facc15",
        secondary: "#18181b",
        border: "#3f3f46",
        accent: "#eab308",
        background: "#090a0d",
        surface: "#111318",
        surfaceElevated: "#181a20",
        muted: "#a1a1aa",
        glow: "#facc15",
        gradient: "linear-gradient(135deg, #facc15 0%, #a16207 100%)",
    },

    background: "codeHeist",

    atmosphere: {
        artworkOpacity: 0.12,
        artworkPosition: "center",
        overlayOpacity: 0.74,
        glowOpacity: 0.16,
        gridOpacity: 0.08,
        scanlineOpacity: 0.025,
        vignetteOpacity: 0.74,
        animation: "scan",
    },

    visual: {
        codename: "OPERATION 042",
        eyebrow: "CLASSIFIED HEIST OPERATION",
        heroTitle: "CRACK THE SYSTEM",
        heroDescription: "Scope the target, breach the vault, and leave no loose ends.",
        status: "SECURE CHANNEL",
        artifact: "VAULT // CC-042",
        motif: "heist",
        panelStyle: "vault",
        emblem: "vault",
    },

    words: {
        run: "Open Vault",
        submit: "Execute Heist",

        accepted: "Heist Successful",
        wrongAnswer: "Security Triggered",

        runtimeError: "Escape Failed",
        compileError: "Wrong Access Code",

        testcases: "Checkpoints",
        debug: "Security Logs",

        dashboard: "Operations",
        welcomeTagline: "Ready to crack today's vault?",
        problems: "Vaults",
        analytics: "Intel",
        profile: "Profile Alias",
        judgeError: "Mission Control Error",
        rank: "Notoriety",
        level: "Crew Level",
        nextMilestone: "more vaults to next operation",
        acceptanceRate: "Mission Success Rate",
        averageRuntime: "Vault Breach Speed",
        favoriteLanguage: "Preferred Tool",
        totalSubmissions: "Operations Executed",
        dailyChallenge: "Today's Vault",
        difficulty: "Security Level",
        solveChallenge: "Breach Vault",
        aiInsights: "Mission Intelligence",
        strongestTopic: "Best Heist Skill",
        weakestTopic: "Security Weak Spot",
        recommendation: "Mission Brief",
        coachNote: "Handler's Note",
        achievements: "Heist Records",
        noAchievements: "No heist records unlocked yet.",
        achievementIcon: Vault,
        publicProfile: "Criminal Record",
        totalSolved: "Vaults Breached",
        easySolved: "Low Security",
        mediumSolved: "Guarded Vaults",
        hardSolved: "Maximum Security",
        topics: "Heist Skills",
        joined: "Recruited",
        recentActivity: "Operation History",
        connectLeetcode: "Connect Hacker Profile",
        searchProblems: "Search vaults...",
        all: "All",
        easy: "Low Security",
        medium: "Guarded",
        hard: "Maximum Security",

        problemFound: "vault found",
        problemsFound: "vaults found",

        noProblemsFound: "No vaults match your filters.",
        clearFilters: "Reset Operation",
        topic: "Target",
        solveProblem: "Breach Vault",
        language: "Equipment",
        advancedTesting: "Dry Run",
        customInput: "Mission Parameters",
        customInputPlaceholder: "Enter operation input...",
    },

});
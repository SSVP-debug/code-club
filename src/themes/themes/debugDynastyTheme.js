import { Rocket } from "lucide-react";
import { createTheme } from "../themeSchema";

/**
 * Debug Dynasty — inspired by Silicon Valley (HBO)
 * Blue + Black. Startup grind, compression ratios, pivot culture.
 * "Always be coding. Never stop pivoting."
 */
export const debugDynastyTheme = createTheme({
  id: "debugDynasty",

  name: "Debug Dynasty",

  description: "Build the next big thing. One algorithm at a time.",

  colors: {
    primary:   "#3b82f6",   // electric blue
    secondary: "#0a0f1e",
    border:    "#1e3a5f",
    accent:    "#60a5fa",
    background: "#070b14",
    surface: "#0e1421",
    surfaceElevated: "#151d2d",
    muted: "#9ba9bf",
    glow: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
  },

  background: "debugDynasty",

  atmosphere: {
    artworkOpacity: 0.16,
    artworkPosition: "center",
    overlayOpacity: 0.68,
    glowOpacity: 0.14,
    gridOpacity: 0.08,
    scanlineOpacity: 0,
    vignetteOpacity: 0.68,
    animation: "none",
  },

  visual: {
    codename: "SERIES 01",
    eyebrow: "STARTUP // ENGINEERING COMMAND",
    heroTitle: "BUILD. SHIP. REPEAT.",
    heroDescription: "Turn hard problems into working systems and ship the next release.",
    status: "SYSTEM ONLINE",
    artifact: "BUILD // CC-001",
    motif: "startup",
    panelStyle: "startup",
    emblem: "rocket",
  },

  words: {
    run:                  "Compile & Ship",
    submit:               "Push to Prod",
    accepted:             "Deployed",
    wrongAnswer:          "Build Failed",
    runtimeError:         "Server Crashed",
    compileError:         "Lint Error",
    testcases:            "Test Suites",
    debug:                "Debug Console",
    dashboard:            "Founder Dashboard",
    welcomeTagline:       "Ready to ship today?",
    problems:             "Engineering Tickets",
    analytics:            "KPI Dashboard",
    profile:              "LinkedIn",
    judgeError:           "CI/CD Failure",
    rank:                 "Valuation",
    level:                "Series",
    nextMilestone:        "more tickets to next Series",
    acceptanceRate:       "Merge Rate",
    averageRuntime:       "Deploy Speed",
    favoriteLanguage:     "Primary Stack",
    totalSubmissions:     "PRs Submitted",
    dailyChallenge:       "Daily Sprint",
    difficulty:           "Engineering Complexity",
    solveChallenge:       "Close Ticket",
    aiInsights:           "AI Product Insights",
    strongestTopic:       "Core Competency",
    weakestTopic:         "Technical Debt",
    recommendation:       "Sprint Backlog",
    coachNote:            "Manager's Note",
    achievements:         "Engineering Milestones",
    noAchievements:       "No milestones shipped yet. Start sprinting.",
    achievementIcon:      Rocket,
    publicProfile:        "Dev Profile",
    totalSolved:          "Tickets Closed",
    easySolved:           "Junior Tasks",
    mediumSolved:         "Mid Tasks",
    hardSolved:           "Staff Tasks",
    topics:               "Tech Stack",
    joined:               "Onboarded",
    recentActivity:       "Commit History",
    connectLeetcode:      "Import Dev History",
    searchProblems:       "Search tickets...",
    all:                  "All",
    easy:                 "Junior",
    medium:               "Mid-Level",
    hard:                 "Staff",
    problemFound:         "ticket found",
    problemsFound:        "tickets found",
    noProblemsFound:      "No tickets match your filters.",
    clearFilters:         "Reset Filters",
    topic:                "Tech Domain",
    solveProblem:         "Close Ticket",
    language:             "Language",
    advancedTesting:      "Staging Environment",
    customInput:          "Custom Test Case",
    customInputPlaceholder: "Enter test data...",
  },
});
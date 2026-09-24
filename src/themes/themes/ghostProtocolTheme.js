import { Terminal } from "lucide-react";
import { createTheme } from "../themeSchema";

/**
 * Ghost Protocol — inspired by Mr. Robot
 * Hacker aesthetic: terminal green on black, glitch energy, elliot vibes.
 * "You are not alone. Root access awaits."
 */
export const ghostProtocolTheme = createTheme({
  id: "ghostProtocol",

  name: "Ghost Protocol",

  description: "Hack the system. Leave no trace. Root access is the only goal.",

  colors: {
    primary:   "#00ff41",   // classic terminal green
    secondary: "#0d0d0d",   // near-black
    border:    "#1a2e1a",   // dark green border
    accent:    "#00cc33",
    background: "#050705",
    surface: "#0b0f0b",
    surfaceElevated: "#101710",
    muted: "#8ca58f",
    glow: "#00ff41",
    gradient: "linear-gradient(135deg, #00ff41 0%, #008f11 100%)",
  },

  background: "ghostProtocol",

  atmosphere: {
    artworkOpacity: 0.16,
    artworkPosition: "center",
    overlayOpacity: 0.68,
    glowOpacity: 0.14,
    gridOpacity: 0.10,
    scanlineOpacity: 0.075,
    vignetteOpacity: 0.70,
    animation: "scan",
  },

  visual: {
    codename: "NODE 07",
    eyebrow: "CLASSIFIED NETWORK ACCESS",
    heroTitle: "GO UNDERGROUND",
    heroDescription: "Trace the signal, breach the target, and disappear without a trace.",
    status: "SIGNAL ENCRYPTED",
    artifact: "GHOST // NODE-07",
    motif: "terminal",
    panelStyle: "terminal",
    emblem: "terminal",
  },

  words: {
    run:                  "Probe System",
    submit:               "Deploy Exploit",
    accepted:             "Root Access",
    wrongAnswer:          "Firewall Blocked",
    runtimeError:         "Kernel Panic",
    compileError:         "Syntax Breach",
    testcases:            "Payloads",
    debug:                "System Logs",
    dashboard:            "Command Center",
    welcomeTagline:       "Ready to breach today's target?",
    problems:             "Targets",
    analytics:            "Recon",
    profile:              "Ghost Identity",
    judgeError:           "Signal Lost",
    rank:                 "Threat Level",
    level:                "Access Level",
    nextMilestone:        "more targets to next clearance",
    acceptanceRate:       "Exploit Success Rate",
    averageRuntime:       "Intrusion Speed",
    favoriteLanguage:     "Primary Vector",
    totalSubmissions:     "Attacks Executed",
    dailyChallenge:       "Daily Target",
    difficulty:           "Defense Rating",
    solveChallenge:       "Breach Target",
    aiInsights:           "Signal Intelligence",
    strongestTopic:       "Best Attack Vector",
    weakestTopic:         "Exploitable Gap",
    recommendation:       "Mission Brief",
    coachNote:            "Handler's Note",
    achievements:         "Breach Records",
    noAchievements:       "No breaches logged yet.",
    achievementIcon:      Terminal,
    publicProfile:        "Ghost File",
    totalSolved:          "Targets Breached",
    easySolved:           "Script Kiddie",
    mediumSolved:         "Black Hat",
    hardSolved:           "Zero Day",
    topics:               "Attack Surfaces",
    joined:               "Went Dark",
    recentActivity:       "Recent Operations",
    connectLeetcode:      "Link External Database",
    searchProblems:       "Search targets...",
    all:                  "All",
    easy:                 "Script Kiddie",
    medium:               "Black Hat",
    hard:                 "Zero Day",
    problemFound:         "target found",
    problemsFound:        "targets found",
    noProblemsFound:      "No targets match your filters.",
    clearFilters:         "Clear Recon",
    topic:                "Attack Surface",
    solveProblem:         "Breach Target",
    language:             "Exploit Vector",
    advancedTesting:      "Sandbox Mode",
    customInput:          "Payload Parameters",
    customInputPlaceholder: "Enter payload...",
  },
});
import { Triangle } from "lucide-react";
import { createTheme } from "../themeSchema";

/**
 * Survival Code — inspired by Squid Game
 * Pink + Black + Teal. Every problem is a game. Lose and you're eliminated.
 * "The game is simple. The penalty is not."
 */
export const survivalCodeTheme = createTheme({
  id: "survivalCode",

  name: "Survival Code",

  description: "456 players. One winner. Your code decides your fate.",

  colors: {
    primary:   "#ff2d78",   // squid game pink
    secondary: "#0f0f0f",
    border:    "#3d1a2e",
    accent:    "#00d4aa",   // teal
    background: "#0a080c",
    surface: "#130f16",
    surfaceElevated: "#1c1420",
    muted: "#b7a7b8",
    glow: "#ff2d78",
    gradient: "linear-gradient(135deg, #ff2d78 0%, #00d4aa 100%)",
  },

  background: "survivalCode",

  atmosphere: {
    artworkOpacity: 0.09,
    artworkPosition: "center",
    overlayOpacity: 0.80,
    glowOpacity: 0.13,
    gridOpacity: 0.04,
    scanlineOpacity: 0,
    vignetteOpacity: 0.78,
    animation: "pulse",
  },

  visual: {
    codename: "ARENA 456",
    eyebrow: "SURVIVAL TRIAL // ROUND 07",
    heroTitle: "STAY IN THE GAME",
    heroDescription: "Every problem is a round. Every accepted solution keeps you alive.",
    status: "TRIAL IN PROGRESS",
    artifact: "PLAYER // 456",
    motif: "arena",
    panelStyle: "arena",
    emblem: "triangle",
  },

  words: {
    run:                  "Green Light",
    submit:               "Stake Your Life",
    accepted:             "Survive",
    wrongAnswer:          "Eliminated",
    runtimeError:         "Game Over",
    compileError:         "Invalid Move",
    testcases:            "Games",
    debug:                "Guard Review",
    dashboard:            "Arena",
    welcomeTagline:       "Ready to play today's game?",
    problems:             "Games",
    analytics:            "Survival Stats",
    profile:              "Player Card",
    judgeError:           "Referee Error",
    rank:                 "Player Number",
    level:                "Round",
    nextMilestone:        "more games to next round",
    acceptanceRate:       "Survival Rate",
    averageRuntime:       "Reaction Speed",
    favoriteLanguage:     "Weapon of Choice",
    totalSubmissions:     "Games Played",
    dailyChallenge:       "Today's Game",
    difficulty:           "Elimination Risk",
    solveChallenge:       "Play Game",
    aiInsights:           "Strategic Analysis",
    strongestTopic:       "Strongest Game",
    weakestTopic:         "Deadliest Game",
    recommendation:       "Next Game",
    coachNote:            "Survivor's Note",
    achievements:         "Survival Records",
    noAchievements:       "No games survived yet. Step in.",
    achievementIcon:      Triangle,
    publicProfile:        "Player Profile",
    totalSolved:          "Games Survived",
    easySolved:           "Red Light",
    mediumSolved:         "Tug of War",
    hardSolved:           "Glass Bridge",
    topics:               "Game Types",
    joined:               "Entered the Arena",
    recentActivity:       "Recent Games",
    connectLeetcode:      "Link External Arena",
    searchProblems:       "Search games...",
    all:                  "All",
    easy:                 "Red Light",
    medium:               "Tug of War",
    hard:                 "Glass Bridge",
    problemFound:         "game found",
    problemsFound:        "games found",
    noProblemsFound:      "No games match your filters.",
    clearFilters:         "Reset Round",
    topic:                "Game Type",
    solveProblem:         "Enter Game",
    language:             "Tool",
    advancedTesting:      "Practice Round",
    customInput:          "Custom Scenario",
    customInputPlaceholder: "Enter scenario...",
  },
});
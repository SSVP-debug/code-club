const DEFAULT_COLORS = {
    primary: "#2dd4bf",
    secondary: "#18181b",
    border: "#3f3f46",
    accent: "#0d9488",
    background: "#0b0d10",
    surface: "#10131a",
    surfaceElevated: "#141820",
    muted: "#a1a1aa",
    glow: "#2dd4bf",
    gradient: "linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%)",
};

const DEFAULT_ATMOSPHERE = {
    artworkOpacity: 0,
    artworkPosition: "center",
    overlayOpacity: 0,
    glowOpacity: 0,
    gridOpacity: 0,
    scanlineOpacity: 0,
    vignetteOpacity: 0,
    animation: "none",
};

export function createTheme(config) {
    const colors = {
        ...DEFAULT_COLORS,
        ...(config.colors ?? {}),
    };

    const atmosphere = {
        ...DEFAULT_ATMOSPHERE,
        ...(config.atmosphere ?? {}),
    };

    return {
        id: config.id,
        name: config.name,
        description: config.description,

        colors,

        atmosphere,

        background: config.background ?? null,

        words: {
            ...config.words,
        },

        emptyStates: config.emptyStates ?? {},
        dashboard: config.dashboard ?? {},
        profile: config.profile ?? {},
    };
}

export const THEME_WORD_KEYS = [
    "dashboard",
    "problems",
    "analytics",
    "profile",

    "run",
    "submit",

    "accepted",
    "wrongAnswer",
    "runtimeError",
    "compileError",
    "judgeError",

    "testcases",
    "debug",

    "rank",
    "level",
    "nextMilestone",

    "acceptanceRate",
    "averageRuntime",
    "favoriteLanguage",
    "totalSubmissions",

    "dailyChallenge",
    "difficulty",
    "solveChallenge",

    "aiInsights",
    "strongestTopic",
    "weakestTopic",
    "recommendation",
    "coachNote",

    "achievements",
    "noAchievements",
    "achievementIcon",
    "welcomeTagline",

    "publicProfile",
    "totalSolved",
    "easySolved",
    "mediumSolved",
    "hardSolved",
    "topics",
    "joined",
    "recentActivity",
    "connectLeetcode"
];
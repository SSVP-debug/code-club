import {
  useEffect,
  useState,
} from "react";

import { useAuth } from "../hooks/useAuth";
import { useGuest } from "../hooks/useGuest";

import {
  markProblemSolved as persistSolvedToMongo,
} from "../services/progressService";

import { apiFetch } from "../services/api";

import { getEarnedXP } from "../utils/xpUtils";

import { AppContext } from "./AppContextObject";

function calculateCurrentStreak(activityDates = []) {
  if (!activityDates.length) return 0;

  const sorted = [...new Set(activityDates)].sort();

  const today = new Date()
    .toISOString()
    .split("T")[0];

  const yesterday = new Date(
    Date.now() - 86400000
  )
    .toISOString()
    .split("T")[0];

  const lastDate = sorted[sorted.length - 1];

  if (
    lastDate !== today &&
    lastDate !== yesterday
  ) {
    return 0;
  }

  let streak = 1;

  for (let i = sorted.length - 1; i > 0; i--) {
    const curr = new Date(sorted[i]);
    const prev = new Date(sorted[i - 1]);

    const diff =
      (curr - prev) /



      (1000 * 60 * 60 * 24);

    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function AppContextProvider({ children }) {
  const { user } = useAuth();
  const { guestPortal } = useGuest();

  const [solvedProblems, setSolvedProblems] =
    useState([]);

  const [topicStats, setTopicStats] =
    useState({});

  const [activityDates, setActivityDates] =
    useState([]);

  const [solvedDifficulty, setSolvedDifficulty] =
    useState({
      easy: 0,
      medium: 0,
      hard: 0,
    });

  const [recentActivity, setRecentActivity] =
    useState([]);

  const [currentStreak, setCurrentStreak] =
    useState(0);

  const [longestStreak, setLongestStreak] =
    useState(0);

  const [lastActivityDate, setLastActivityDate] =
    useState(null);

  // Readiness signal for the "no route ever shows fake/empty data while
  // the backend is still cold-starting" requirement (see OnboardingGate's
  // readiness step and Dashboard's skeleton fallback). Distinct from
  // services/api.js's warmBackend(), which just nudges Render awake early
  // and doesn't tell the UI anything — this is set to true once /api/init
  // has actually resolved below, whether that resolution succeeded or
  // failed. A failure still counts as "ready": the alternative is hanging
  // the UI forever on a genuine error, which is worse than briefly showing
  // real (if degraded/empty) data. Resets to false whenever `user` changes
  // (fresh login / logout-then-login), since a new hydrate() cycle starts.
  const [isBackendReady, setIsBackendReady] = useState(false);

  // hydrationError — the gap flagged in the state-coverage audit: hydrate()
  // below always set isBackendReady(true) even when the boot call failed,
  // by design (so the UI never hangs forever on a genuine error — see the
  // comment above isBackendReady). What was missing is any user-visible
  // trace of that failure: it only ever reached console.error, so the app
  // silently rendered real (if degraded/empty) data with no way for the
  // person to know their stats might be stale, or to retry. This makes
  // that failure visible and recoverable — see Dashboard.jsx's usage via
  // AsyncState. Cleared at the start of every hydrate() attempt, including
  // retries via retryHydration.
  const [hydrationError, setHydrationError] = useState(null);

  // Bumped by retryHydration() to force the hydrate effect below to run
  // again without waiting for `user` itself to change.
  const [hydrationAttempt, setHydrationAttempt] = useState(0);

  function retryHydration() {
    setHydrationAttempt((n) => n + 1);
  }

  const [submissions, setSubmissions] =
    useState([]);
  const [achievements, setAchievements] =
    useState([]);
  const [dailyChallengeHistory, setDailyChallengeHistory,] =
    useState([]);
  const [
    newAchievements,
    setNewAchievements,
  ] = useState([]);

  const [weeklySolved, setWeeklySolved] = useState(0);

  // XP — declared here (top of state block) so it's available throughout
  // the component. Value is server-authoritative: set on hydrate from API
  // response. Optimistic update in markProblemSolved is corrected by server.
  const [totalXP, setTotalXP] = useState(0);
  const [role, setRole] = useState("student");

  // Authorized roles vs the single active `role` above — see backend
  // models/User.js's role/roles comment. Most accounts only ever have
  // ["student"]; an account that's also registered as TPO or recruiter
  // will have more than one entry here, which is what RoleAccountView
  // (rendered from Profile.jsx for non-student active roles) uses to
  // offer switching back without re-registering.
  const [roles, setRoles] = useState(["student"]);

  // Admin "Login As" state — sourced from /api/init's `impersonation`
  // block. { active: false } when not impersonating, or
  // { active: true, adminEmail, targetEmail, targetDisplayName, targetRole }
  // while an admin is viewing as someone else. `role` above already
  // reflects the target during impersonation (by design); this is purely
  // for the banner + Exit action.
  const [impersonation, setImpersonation] = useState({ active: false });

  // /api/init's progress payload has always included joinedDate (see
  // backend/controllers/progressController.js), but it was never captured
  // here — Profile.jsx was reading user?.createdAt off the raw Firebase
  // Auth object instead, which has no such field, so it always fell back
  // to "Recently". Real fix: hydrate the real value from Mongo.
  const [joinedDate, setJoinedDate] = useState(null);

  // Phase 9C — editable via updateRecruiterSnapshot below, hydrated from
  // /api/init's bootUser (not progressToClient — this is account data,
  // not progress data, same distinction as joinedDate vs XP/streaks).
  const [recruiterSnapshot, setRecruiterSnapshot] = useState({
    availableForWork: false,
    preferredRole: null,
    expectedGraduation: null,
  });

  // Editor + display preferences (Settings page) — same hydration source
  // and update pattern as recruiterSnapshot above.
  const [preferences, setPreferences] = useState({
    blankEditorByDefault: false,
    hideDifficultyLabels: false,
  });

  // Developer Profile — GitHub/LinkedIn/Resume/Featured Project. Same
  // hydration source and update pattern as recruiterSnapshot above.
  // featuredProjects is an array (schema supports multiple later) but the
  // UI only surfaces one for now.
  const [developerProfile, setDeveloperProfile] = useState({
    githubUrl: null,
    linkedinUrl: null,
    resumeUrl: null,
    resumeVisibility: "private",
    featuredProjects: [],
  });

  // Phase 9E — consolidated here instead of SettingsPage's own fetch
  // (single source of truth; also needed by ProfileCompletion).
  const [username, setUsername] = useState("");
  // Institutional placement visibility is independent from public/recruiter visibility.
  const [visibleToTpo, setVisibleToTpo] = useState(true);
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [leetcodeStats, setLeetcodeStats] = useState(null);

  // Phase 9D — [{ slug, title, difficulty }], denormalized at pin time.
  const [pinnedProblems, setPinnedProblems] = useState([]);

  // Private "read later" bookmarks — [{ slug, savedAt }]. Separate from
  // pinnedProblems (public-profile showcase); see User model comment.
  const [savedProblems, setSavedProblems] = useState([]);

  // Guest Mode: no backend account exists for a guest — there is nothing
  // to hydrate, and there must never be (Zero Persistence: a guest
  // session must not read or write any User/Progress/Submission document
  // — see Guest Mode spec). `role`/`roles` are set to the guest's chosen
  // portal (student/recruiter/tpo) rather than left at their default
  // "student" so every existing consumer that already keys off `role` —
  // Navbar's nav-link set, RoleRoute's allowedRoles check,
  // DashboardRoleRedirect's admin check — treats a guest correctly for
  // free, with no changes to their own logic (see RoleRoute.jsx/
  // ProtectedRoute.jsx for the one additional guest-bypass each of them
  // still needs on top of this, specifically for the `!user` case those
  // two check that this alone doesn't cover).
  //
  // isBackendReady is set true immediately, not left at its default
  // false: ThemeGate.jsx and RoleRoute.jsx both block rendering while
  // isBackendReady is false, waiting for hydrate() to finish — a guest
  // has no hydrate() to wait for, so leaving this false would hang those
  // gates forever instead of ever showing the guest the portal.
  //
  // Deliberately NOT inside the hydrate() effect below: guestPortal is
  // already synchronously available (GuestProvider holds no async state
  // of its own), so setting it from an effect would just be a same-tick
  // extra render for no benefit — this follows the same "adjust state
  // during render, not in an effect" pattern WorkspacePanel.jsx already
  // uses for forceTab, comparing against a second state variable instead
  // of calling setState unconditionally in an effect body.
  const [appliedGuestPortal, setAppliedGuestPortal] = useState(null);
  if (guestPortal !== appliedGuestPortal) {
    setAppliedGuestPortal(guestPortal);
    if (guestPortal) {
      setRole(guestPortal);
      setRoles([guestPortal]);
      setIsBackendReady(true);
      setHydrationError(null);
    }
  }

  // --------------------------------------------------
  // HYDRATE FROM MONGODB
  // --------------------------------------------------

  useEffect(() => {
    if (!user) return;

    async function hydrate() {
      setIsBackendReady(false);
      setHydrationError(null);

      try {
        // Single boot call — replaces 3 sequential API calls:
        // initProgress() + getProgress() + getSubmissions()
        // One token refresh, one HTTP round-trip, parallel MongoDB queries.
        const {
          user: bootUser,
          progress,
          submissions: mongoSubmissions,
          impersonation: bootImpersonation,
          _dbDown,
        } = await apiFetch("/api/init");

        if (_dbDown) {
          console.warn("[AppContext] Database unavailable on boot — using empty defaults.");
        }

        setRole(bootUser?.role || "student");
        setRoles(bootUser?.roles?.length ? bootUser.roles : ["student"]);
        setImpersonation(bootImpersonation || { active: false });

        setSolvedProblems(
          progress.solvedSlugs || []
        );

        setTopicStats(
          progress.topicStats || {}
        );

        setActivityDates(
          progress.activityDates || []
        );

        const today = new Date();

        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        // Count problems solved this week by joining recentActivity (has per-solve dates)
        // recentActivity entries have a `time` field = "YYYY-MM-DD" of the solve.
        // This is more accurate than counting activityDates (which counts days, not solves).
        const recentActivityThisWeek = (progress.recentActivity || []).filter((entry) => {
          if (!entry.time) return false;
          return new Date(entry.time) >= weekStart;
        }).length;

        // Fallback: if recentActivity is empty or sparse, count unique solved slugs
        // whose first appearance is within the last 7 days (best approximation).
        // recentActivity is capped at 10 items, so for heavy users this underestimates.
        // TODO: add a server-side weeklyCount field for accuracy above 10.
        const solvedThisWeek = recentActivityThisWeek;

        setWeeklySolved(solvedThisWeek);

        setSolvedDifficulty(
          progress.solvedDifficulty || {
            easy: 0,
            medium: 0,
            hard: 0,
          }
        );

        setRecentActivity(
          progress.recentActivity || []
        );

        setCurrentStreak(
          progress.currentStreak || 0
        );

        setAchievements(
          progress.achievements || []
        );

        setDailyChallengeHistory(
          progress.dailyChallengeHistory || []
        );

        setLongestStreak(
          progress.longestStreak || 0
        );

        setLastActivityDate(
          progress.lastActivityDate || null
        );

        setSubmissions(
          mongoSubmissions || []
        );

        setTotalXP(
          progress.totalXP || 0
        );

        setJoinedDate(
          progress.joinedDate || null
        );

        if (bootUser?.recruiterSnapshot) {
          setRecruiterSnapshot({
            availableForWork: bootUser.recruiterSnapshot.availableForWork ?? false,
            preferredRole: bootUser.recruiterSnapshot.preferredRole ?? null,
            expectedGraduation: bootUser.recruiterSnapshot.expectedGraduation ?? null,
          });
        }

        if (bootUser?.preferences) {
          setPreferences({
            blankEditorByDefault: bootUser.preferences.blankEditorByDefault ?? false,
            hideDifficultyLabels: bootUser.preferences.hideDifficultyLabels ?? false,
          });
        }

        setPinnedProblems(bootUser?.pinnedProblems || []);

        setSavedProblems(bootUser?.savedProblems || []);

        if (bootUser?.developerProfile) {
          setDeveloperProfile({
            githubUrl: bootUser.developerProfile.githubUrl ?? null,
            linkedinUrl: bootUser.developerProfile.linkedinUrl ?? null,
            resumeUrl: bootUser.developerProfile.resumeUrl ?? null,
            resumeVisibility: bootUser.developerProfile.resumeVisibility ?? "private",
            featuredProjects: bootUser.developerProfile.featuredProjects ?? [],
          });
        }

        setUsername(bootUser?.username || "");
        setVisibleToTpo(bootUser?.visibleToTpo ?? true);
        setLeetcodeUsername(bootUser?.leetcodeUsername || "");
        setLeetcodeStats(bootUser?.leetcodeStats || null);


      } catch (err) {
        console.error(
          "[AppContext] Hydration failed:",
          err
        );
        setHydrationError(
          err?.message || "Couldn't load your data. Please try again."
        );
      } finally {
        setIsBackendReady(true);
      }
    }

    hydrate();
  }, [user, hydrationAttempt]);

  // --------------------------------------------------
  // SUBMISSIONS
  // --------------------------------------------------

  // NOTE: this used to also POST the submission to the backend
  // (`createSubmission`) so it would persist to Mongo. That endpoint was a
  // security hole — it accepted client-supplied `status`/`passed`/`total`
  // and saved them as-is, meaning any authenticated user could fabricate an
  // "Accepted" submission without ever running their code (see
  // docs/security-fixes/2026-07-solve-integrity.md).
  //
  // The backend now records every submission itself, server-side, inside
  // POST /api/judge/submit — from the actual Judge0-graded result, not
  // from whatever the client claims afterward. By the time judgeSubmission()
  // (src/services/judgeService.js) resolves, the Submission row already
  // exists. So this function's only remaining job is the optimistic local
  // UI update — there's nothing left to persist here. A full history
  // (including this entry) is available via getSubmissions() / GET
  // /api/submissions on next fetch.
  function addSubmission(submission) {
    setSubmissions((prev) => [
      submission,
      ...prev,
    ]);
  }

  // --------------------------------------------------
  // PROGRESS
  // --------------------------------------------------

  async function markProblemSolved({
    slug,
    topic,
    difficulty,
    title,
  }) {
    // Guest Mode / Zero Persistence: this only ever runs from the Submit
    // success path (hooks/useProblemSolver.js), and Submit itself is
    // requireAuth-gated server-side (backend/routes/judge.js) — a guest
    // can never reach it through the UI (AuthGate intercepts the Submit
    // action first). This is a defensive second guard, not the actual
    // enforcement boundary: it exists so a guest session can never end up
    // with even an optimistic local "solved" entry or attempt a
    // persistSolvedToMongo() call below, regardless of how this function
    // gets invoked.
    if (guestPortal) return;

    if (solvedProblems.includes(slug)) {
      return;
    }

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const nextSolvedProblems = [
      ...solvedProblems,
      slug,
    ];

    const nextTopicStats = {
      ...topicStats,
      [topic]:
        (topicStats[topic] || 0) + 1,
    };

    const nextActivityDates =
      activityDates.includes(today)
        ? activityDates
        : [...activityDates, today];



    const difficultyKey =
      difficulty.toLowerCase();

    const nextSolvedDifficulty = {
      ...solvedDifficulty,
      [difficultyKey]:
        (solvedDifficulty[
          difficultyKey
        ] || 0) + 1,
    };

    const nextRecentActivity = [
      {
        title,
        time: today,
      },
      ...recentActivity,
    ].slice(0, 10);

    const nextCurrentStreak =
      calculateCurrentStreak(
        nextActivityDates
      );

    const nextLongestStreak =
      Math.max(
        longestStreak,
        nextCurrentStreak
      );

    // Local UI update first

    setSolvedProblems(
      nextSolvedProblems
    );

    setTopicStats(
      nextTopicStats
    );

    setActivityDates(
      nextActivityDates
    );

    setSolvedDifficulty(
      nextSolvedDifficulty
    );

    setRecentActivity(
      nextRecentActivity
    );

    setCurrentStreak(
      nextCurrentStreak
    );

    setLongestStreak(
      nextLongestStreak
    );

    setLastActivityDate(today);

    // Increment weekly count for every new problem solved (not just first of the day).
    // The guard above (solvedProblems.includes(slug)) already ensures this only
    // fires once per unique problem, so no double-counting.
    setWeeklySolved((prev) => prev + 1);
    // Optimistic UI update.
    // Server remains the source of truth for XP.
    const earnedXP = getEarnedXP(difficulty);

    const nextTotalXP =
      totalXP + earnedXP;



    const persistPayload = {
      solvedSlugs:
        nextSolvedProblems,

      topicStats:
        nextTopicStats,

      activityDates:
        nextActivityDates,

      solvedDifficulty:
        nextSolvedDifficulty,

      totalXP: nextTotalXP,

      recentActivity:
        nextRecentActivity,
    };



    // MongoDB

    try {
      const response =
        await persistSolvedToMongo(
          persistPayload,
          slug
        );


      if (
        response?.newAchievements?.length
      ) {
        setNewAchievements(
          response.newAchievements
        );
      }

      if (response) {
        setCurrentStreak(
          response.currentStreak ??
          nextCurrentStreak
        );

        setLongestStreak(
          response.longestStreak ??
          nextLongestStreak
        );

        setLastActivityDate(
          response.lastActivityDate ??
          today
        );

        setTotalXP(
          response.totalXP ??
          nextTotalXP
        );


      }


    } catch (err) {
      console.error(
        "[AppContext] Progress save failed:",
        err
      );
    }
  }

  // --------------------------------------------------
  // ACTIVE ROLE SWITCH (role/profile isolation fix)
  // --------------------------------------------------
  // Backend-authoritative: POST /me/switch-role rejects anything not in
  // this account's own `roles` (see userController.js's switchActiveRole),
  // so this can't be used to self-grant an unregistered role. Re-runs
  // hydrate() via retryHydration afterward so progress/submissions —
  // role-gated server-side — refresh under the new active role instead
  // of showing stale data from before the switch.
  async function switchActiveRole(targetRole) {
    const result = await apiFetch("/api/users/me/switch-role", {
      method: "POST",
      body: JSON.stringify({ role: targetRole }),
    });
    setRole(result.role);
    setRoles(result.roles?.length ? result.roles : ["student"]);
    retryHydration();
    return result;
  }

  // --------------------------------------------------
  // RECRUITER SNAPSHOT (Phase 9C)
  // --------------------------------------------------

  async function updateRecruiterSnapshot(patch) {
    const result = await apiFetch("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ recruiterSnapshot: patch }),
    });
    setRecruiterSnapshot({
      availableForWork: result.recruiterSnapshot?.availableForWork ?? false,
      preferredRole: result.recruiterSnapshot?.preferredRole ?? null,
      expectedGraduation: result.recruiterSnapshot?.expectedGraduation ?? null,
    });
    return result.recruiterSnapshot;
  }

  // --------------------------------------------------
  // PREFERENCES (Settings page — editor + display)
  // --------------------------------------------------

  async function updatePreferences(patch) {
    const result = await apiFetch("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ preferences: patch }),
    });
    setPreferences({
      blankEditorByDefault: result.preferences?.blankEditorByDefault ?? false,
      hideDifficultyLabels: result.preferences?.hideDifficultyLabels ?? false,
    });
    return result.preferences;
  }

  // --------------------------------------------------
  // INSTITUTIONAL PLACEMENT VISIBILITY
  // --------------------------------------------------

  async function updateTpoVisibility(nextVisible) {
    if (typeof nextVisible !== "boolean") {
      throw new Error("TPO visibility must be a boolean");
    }
    const result = await apiFetch("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ visibleToTpo: nextVisible }),
    });
    setVisibleToTpo(result.visibleToTpo ?? nextVisible);
    return result.visibleToTpo ?? nextVisible;
  }

  // --------------------------------------------------
  // DEVELOPER PROFILE (GitHub / LinkedIn / Resume / Featured Project)
  // --------------------------------------------------

  async function updateDeveloperProfile(patch) {
    const result = await apiFetch("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ developerProfile: patch }),
    });
    setDeveloperProfile({
      githubUrl: result.developerProfile?.githubUrl ?? null,
      linkedinUrl: result.developerProfile?.linkedinUrl ?? null,
      resumeUrl: result.developerProfile?.resumeUrl ?? null,
      resumeVisibility: result.developerProfile?.resumeVisibility ?? "private",
      featuredProjects: result.developerProfile?.featuredProjects ?? [],
    });
    return result.developerProfile;
  }

  // --------------------------------------------------
  // PINNED PROBLEMS (Phase 9D)
  // --------------------------------------------------

  async function pinProblem(slug) {
    const result = await apiFetch("/api/users/me/pinned-problems", {
      method: "POST",
      body: JSON.stringify({ slug }),
    });
    setPinnedProblems(result.pinnedProblems || []);
    return result.pinnedProblems;
  }

  async function unpinProblem(slug) {
    const result = await apiFetch(`/api/users/me/pinned-problems/${slug}`, {
      method: "DELETE",
    });
    setPinnedProblems(result.pinnedProblems || []);
    return result.pinnedProblems;
  }

  async function saveProblem(slug) {
    const result = await apiFetch("/api/users/me/saved-problems", {
      method: "POST",
      body: JSON.stringify({ slug }),
    });
    setSavedProblems(result.savedProblems || []);
    return result.savedProblems;
  }

  async function unsaveProblem(slug) {
    const result = await apiFetch(`/api/users/me/saved-problems/${slug}`, {
      method: "DELETE",
    });
    setSavedProblems(result.savedProblems || []);
    return result.savedProblems;
  }

  // --------------------------------------------------
  // --------------------------------------------------
  // CONTEXT
  // --------------------------------------------------

  const value = {
    isBackendReady,
    hydrationError,
    retryHydration,
    solvedProblems,
    topicStats,
    achievements,
    dailyChallengeHistory,
    activityDates,
    solvedDifficulty,
    recentActivity,
    currentStreak,
    longestStreak,
    lastActivityDate,
    weeklySolved,
    weeklyGoal: 10,
    submissions,
    role,
    roles,
    switchActiveRole,
    impersonation,
    totalXP,
    joinedDate,
    recruiterSnapshot,
    updateRecruiterSnapshot,
    preferences,
    updatePreferences,
    developerProfile,
    updateDeveloperProfile,
    pinnedProblems,
    pinProblem,
    unpinProblem,
    savedProblems,
    saveProblem,
    unsaveProblem,
    username,
    setUsername,
    visibleToTpo,
    updateTpoVisibility,
    leetcodeUsername,
    setLeetcodeUsername,
    leetcodeStats,
    setLeetcodeStats,
    addSubmission,
    markProblemSolved,
    newAchievements,
    setNewAchievements,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export default AppContextProvider;
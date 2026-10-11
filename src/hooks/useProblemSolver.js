import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { formatDate } from "../utils/formatters";
import { getDailyChallenge } from "../utils/dailyChallenge";
import { judgeSubmission, runTestcases } from "../services/judgeService";
import { completeDailyChallenge } from "../services/dailyChallengeService";
import { useAppContext } from "./useAppContext";
import { useIdentity } from "./useIdentity";
import { usePanelResize } from "./usePanelResize";
import { useVerticalResize } from "./useVerticalResize";
import { useTimer } from "./useTimer";
import { getEarnedXP } from "../utils/xpUtils";
import { buildLoginRedirect } from "../utils/authRedirect";
import {
  loadSavedCode,
  saveCode,
  loadLanguage,
  saveLanguage,
} from "../utils/editorStorage";

function deriveForceTab(runResults, submitInfo) {
  if (runResults?.compileFailed) return "debug";
  if (runResults?.results?.some((r) => r.error)) return "debug";
  if (runResults?.error && !runResults?.compileFailed) return "debug";
  if (runResults?.results?.length > 0) return "testcases";
  if (submitInfo?.status) {
    const s = submitInfo.status;
    if (s.includes("Compilation") || s.includes("Runtime") || s.includes("Error"))
      return "debug";
    return "testcases";
  }
  return null;
}

/**
 * All editor/run/submit business logic for a single problem: language +
 * code state (with persistence), run/submit handlers, timer/confetti on
 * first solve, and the panel-resize/mobile-tab UI state the views need.
 */
export function useProblemSolver({ problem, slug, contestId, battleRoomId }) {
  const { solvedProblems, addSubmission, markProblemSolved, preferences } = useAppContext();
  const { isAuthenticated } = useIdentity();
  const navigate = useNavigate();
  const location = useLocation();
  const isSolved = solvedProblems.includes(slug);
  const { formatted: timerFormatted, stop: stopTimer } = useTimer();

  // Only expose languages with a non-empty starter for this problem. The
  // global registry says which languages can run in general; the canonical
  // problem record determines which language templates this problem supports.
  const availableLanguageKeys = useMemo(
    () => Object.entries(problem.starterCode ?? {})
      .filter(([, starter]) => typeof starter === "string" && starter.trim().length > 0)
      .map(([key]) => key),
    [problem.starterCode]
  );

  // When the "start with blank editor" preference is on, the starter-code
  // template is simply never used as a fallback — loadSavedCode still takes
  // priority, so an in-progress attempt is never discarded because of this
  // preference. Missing templates are excluded from the language selector.
  const starterFor = (lang) =>
    preferences.blankEditorByDefault ? "" : (problem.starterCode?.[lang] ?? "");
  const resolveInitialLanguage = () => {
    const savedLanguage = loadLanguage(slug);
    if (availableLanguageKeys.includes(savedLanguage)) return savedLanguage;
    return availableLanguageKeys.includes("python")
      ? "python"
      : availableLanguageKeys[0] ?? "python";
  };

  const { editorHeight, setEditorHeight } = useVerticalResize();
  const [language, setLanguage] = useState(resolveInitialLanguage);
  const [code, setCode] = useState(() => {
    const initialLanguage = resolveInitialLanguage();
    return loadSavedCode(slug, initialLanguage, starterFor(initialLanguage));
  });
  const [customInput, setCustomInput] = useState("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [runResults, setRunResults] = useState(null);
  const [submitInfo, setSubmitInfo] = useState(null);
  const { problemWidth, setProblemWidth } = usePanelResize();
  const [mobileTab, setMobileTab] = useState("problem");
  // Tracks which (runResults, submitInfo) pair mobileTab was last derived
  // for, so the auto-switch-to-results can happen during render (React's
  // "adjusting state" pattern) instead of a useEffect that calls setState
  // synchronously.
  const [trackedResultsForMobileTab, setTrackedResultsForMobileTab] = useState({ runResults, submitInfo });

  const forceTab = useMemo(
    () => deriveForceTab(runResults, submitInfo),
    [runResults, submitInfo]
  );

  // Auto-switch mobile to results after run/submit
  if (
    runResults !== trackedResultsForMobileTab.runResults ||
    submitInfo !== trackedResultsForMobileTab.submitInfo
  ) {
    setTrackedResultsForMobileTab({ runResults, submitInfo });
    if (runResults || submitInfo) setMobileTab("results");
  }

  useEffect(() => { saveCode(slug, language, code); }, [slug, language, code]);
  useEffect(() => {
    if (loadLanguage(slug) !== language) saveLanguage(slug, language);
  }, [slug, language]);

  const handleLanguageChange = (nextLanguage) => {
    if (!availableLanguageKeys.includes(nextLanguage)) return;
    saveCode(slug, language, code);
    saveLanguage(slug, nextLanguage);
    setLanguage(nextLanguage);

    setCode(
      loadSavedCode(
        slug,
        nextLanguage,
        starterFor(nextLanguage)
      )
    );
  };

  // Resets the buffer back to the problem's starter template for the
  // current language (or blank, if that preference is on) — and persists
  // that reset immediately, so refreshing the page right after doesn't
  // bring back the discarded attempt.
  const handleResetCode = () => {
    const starter = starterFor(language);
    setCode(starter);
    saveCode(slug, language, starter);
  };

  const handleRunCode = async () => {
    if (running) return;
    try {
      setRunning(true);
      setError("");
      setRunResults(null);
      setSubmitInfo(null);
      const response = await runTestcases({ problem, code, language });
      setRunResults(response);
    } catch (err) {
      console.error(err);
      setError("Execution failed. Please try again.");
      setRunResults({ results: [], compileFailed: false, error: err.message });
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitCode = async () => {
    if (submitting) return;

    // Guest Mode: Submit persists a Submission and awards XP/streak — an
    // account is required. Rather than let this reach judgeSubmission()
    // (POST /api/judge/submit, requireAuth on the backend — see
    // backend/routes/judge.js) only to fail with a 401, redirect to the
    // login gate up front, with `next` preserving this exact problem page
    // and `reason=submit` surfacing the contextual message (see
    // AuthGate.jsx's AUTH_GATE_MESSAGES and LoginPage.jsx's banner) —
    // "guest clicks Submit → auth gate → login → return to the problem"
    // per the Guest Mode spec, reusing the existing ?next= infrastructure
    // rather than a bespoke modal.
    if (!isAuthenticated) {
      navigate(
        buildLoginRedirect(location.pathname + location.search, { reason: "submit" })
      );
      return;
    }

    const wasAlreadySolved = isSolved;

    try {
      setSubmitting(true);
      setError("");
      setRunResults(null);
      setSubmitInfo(null);

      const judgeResult = await judgeSubmission({ problem, code, language, contestId, battleRoomId, onProgress: () => { } });
      const justAccepted = judgeResult.status === "Accepted";

      setSubmitInfo({
        status: judgeResult.status,
        error: judgeResult.error ?? null,
        passed: judgeResult.passed ?? 0,
        total: judgeResult.total ?? 0,
        // ── Submission Experience fields ──────────────────────────────────
        // submissionId: ties a Reflection Score to this exact submission.
        // encouragementMessage: server-picked copy for non-Accepted results
        // (deduped against the student's last attempt — see
        // backend/utils/encouragementMessages.js); undefined for Accepted.
        // isFirstSolve / xpEarned: drive the celebration modal's XP + "new
        // solve" framing. xpEarned reuses the same getEarnedXP() the
        // context uses to persist XP server-side, so the number shown here
        // always matches what actually gets saved — never a separate guess.
        submissionId: judgeResult.submissionId ?? null,
        encouragementMessage: judgeResult.encouragementMessage ?? null,
        isFirstSolve: justAccepted ? !wasAlreadySolved : false,
        xpEarned: justAccepted && !wasAlreadySolved ? getEarnedXP(problem.difficulty) : 0,
      });

      if (justAccepted && !wasAlreadySolved) {
        await markProblemSolved({ slug, topic: problem.topic, difficulty: problem.difficulty, title: problem.title });
        try {
          const todayChallenge = await getDailyChallenge();
          if (todayChallenge?.slug === problem.slug) {
            await completeDailyChallenge(problem.slug);
          }
        } catch (err) {
          console.error("Daily challenge save failed:", err);
        }
        stopTimer();
        confetti({
          particleCount: 120, spread: 80, origin: { y: 0.6 },
          colors: ["#22c55e", "#16a34a", "#4ade80", "#ffffff", "#86efac"]
        });
        setTimeout(() => {
          confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.65 }, colors: ["#22c55e", "#4ade80", "#ffffff"] });
          confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.65 }, colors: ["#22c55e", "#4ade80", "#ffffff"] });
        }, 200);
      }

      // ── Contest scoring feedback (Fest Readiness Audit, P0-1) ────────────
      // There is no longer a separate "tell the contest API I solved it"
      // request here. judgeSubmission() already sent `contestId` on the
      // real /api/judge/submit call above, and the SERVER decided —
      // server-side, from its own Accepted verdict — whether this earned
      // contest credit (see backend/controllers/judgeController.js +
      // backend/services/contestScoring.js). This block only reads that
      // decision back to show the right toast; it cannot influence it.
      if (contestId && judgeResult.contest) {
        if (judgeResult.contest.scored) {
          if (!judgeResult.contest.alreadySolved) {
            toast.success("Contest score updated!");
          }
        } else {
          // Genuinely Accepted code that, for some contest-side reason
          // (contest ended mid-submission, not a recognized participant,
          // etc.), didn't qualify for credit — surface it rather than
          // silently saying nothing, since the student will otherwise
          // wonder why their score didn't move.
          toast.error("Solved, but this contest submission wasn't eligible for scoring.");
        }
      }

      // ── Battle Room scoring feedback ──────────────────────────────────────
      // Same shape as the contest feedback block above: no separate "tell
      // the room I solved it" call — judgeSubmission() already sent
      // `battleRoomId` on the real submit call, and the SERVER decided
      // whether it earned credit (see backend/controllers/judgeController.js
      // + backend/services/battleRoomScoring.js). This only reads that
      // decision back to show the right toast.
      if (battleRoomId && judgeResult.battleRoom) {
        if (judgeResult.battleRoom.scored) {
          if (judgeResult.battleRoom.countedForTeam) {
            toast.success("Team score updated!");
          } else if (!judgeResult.battleRoom.alreadySolvedPersonally) {
            toast.success("Solved! A teammate already had this one, so your team's score is unchanged.");
          }
        } else {
          toast.error("Solved, but this Battle Room submission wasn't eligible for scoring.");
        }
      }

      await addSubmission({
        id: crypto.randomUUID(), problemTitle: problem.title, problemSlug: problem.slug,
        language, status: judgeResult.status, date: formatDate(new Date()),
        createdAt: new Date().toISOString(),
        passed: judgeResult.passed || 0, total: judgeResult.total || 0,
        visiblePassed: judgeResult.visiblePassed || 0, hiddenPassed: judgeResult.hiddenPassed || 0,
        expectedOutput: judgeResult.expectedOutput, actualOutput: judgeResult.actualOutput,
        executionTime: judgeResult.executionTime,
        code,
      });
    } catch (err) {
      console.error(err);
      setError("Submission failed. Please try again.");
      setSubmitInfo({ status: "Submission Error", error: err.message ?? "Unexpected error.", passed: 0, total: 0 });
    } finally {
      setSubmitting(false);
    }
  };

  const hasResults = !!(runResults || submitInfo);

  return {
    isSolved,
    timerFormatted,
    availableLanguageKeys,
    editorHeight,
    setEditorHeight,
    language,
    code,
    setCode,
    customInput,
    setCustomInput,
    running,
    submitting,
    error,
    runResults,
    submitInfo,
    problemWidth,
    setProblemWidth,
    mobileTab,
    setMobileTab,
    forceTab,
    hasResults,
    handleLanguageChange,
    handleResetCode,
    handleRunCode,
    handleSubmitCode,
  };
}
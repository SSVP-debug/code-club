import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAppContext } from "../hooks/useAppContext";
import { getDailyQuizStatus, completeDailyQuiz } from "../services/dailyQuizService";
import { hasLocalDailyCheckin, markLocalDailyCheckin } from "../utils/dailyQuizClientState";
import { getStudentDayKey } from "../utils/studentDay";
import { DailyQuizContext } from "./DailyQuizContextObject";

/**
 * Owns the lightweight daily check-in state. Status lookup starts as soon as
 * Firebase auth resolves and runs independently of /api/init hydration.
 * The server remains authoritative for users without a local same-day mark;
 * local storage is only a fast path, never an access-control mechanism.
 */
export default function DailyQuizProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { role, isBackendReady } = useAppContext();
  const location = useLocation();
  // Re-evaluate the IST day when the route changes, so a tab left open
  // across midnight can show the next day's check-in on the next Dashboard entry.
  const todayKey = useMemo(() => getStudentDayKey(), [location.key]);
  const [status, setStatus] = useState("loading");
  const [statusUserId, setStatusUserId] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);

  useEffect(() => {
    if (authLoading) return undefined;

    if (!user?.uid) {
      setStatus("unlocked");
      setStatusUserId(null);
      setCompleteError(null);
      return undefined;
    }

    let cancelled = false;
    const uid = user.uid;

    // A known completion on this device avoids a status round-trip before
    // the check-in decision. If this is a new device/session, the server is
    // queried in parallel with /api/init and the Dashboard is never blocked.
    if (hasLocalDailyCheckin(uid)) {
      setStatus("unlocked");
      setStatusUserId(uid);
      return undefined;
    }

    setStatus("loading");
    setStatusUserId(uid);
    setCompleteError(null);

    async function checkStatus() {
      try {
        const data = await getDailyQuizStatus();
        if (cancelled) return;
        if (data.completed || !data.required) {
          markLocalDailyCheckin(uid);
          setStatus("unlocked");
        } else {
          setStatus("required");
        }
      } catch (error) {
        // This is an optional engagement prompt. A failed request must never
        // prevent the user from using the app or loading dashboard data.
        console.warn("[Daily check-in] Status lookup failed; continuing without prompt.", error?.message);
        if (!cancelled) setStatus("error");
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.uid, retryToken, todayKey]);

  function completeQuiz() {
    const uid = user?.uid;
    if (uid) markLocalDailyCheckin(uid);
    setStatusUserId(uid || null);
    setStatus("unlocked");
    setCompleteError(null);

    // Persist in the background. The dashboard is already mounted and this
    // request must never be on the critical path for navigation.
    if (uid) {
      setCompleting(true);
      completeDailyQuiz()
        .catch((error) => {
          console.warn("[Daily check-in] Completion persistence failed; local dismissal remains active.", error?.message);
        })
        .finally(() => setCompleting(false));
    }
  }

  // Prevent a prior account's status from flashing during account switches.
  const effectiveStatus = statusUserId === (user?.uid || null) ? status : "loading";
  const value = {
    status: effectiveStatus,
    isBackendReady,
    role,
    retry: () => setRetryToken((token) => token + 1),
    completeQuiz,
    completing,
    completeError,
  };

  return <DailyQuizContext.Provider value={value}>{children}</DailyQuizContext.Provider>;
}

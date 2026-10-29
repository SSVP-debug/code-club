import { useState } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import DailyQuickQuiz from "../components/onboarding/DailyQuickQuiz";
import { useDailyQuizStatus } from "../hooks/useDailyQuizStatus";

/**
 * Dashboard-only daily check-in. The Dashboard always mounts underneath it,
 * so /api/init and the dashboard skeleton can progress while status/question
 * UI is being resolved. This is an engagement prompt, not an access-control
 * boundary; failures never lock the application.
 */
export default function DailyQuizGate({ children }) {
  const { status, isBackendReady, completeQuiz } = useDailyQuizStatus();
  const [dismissedLocally, setDismissedLocally] = useState(false);

  // DashboardRoleRedirect is the parent, so this component is only rendered
  // for the student dashboard after role hydration. Other roles redirect first.
  const shouldShow = isBackendReady && status === "required" && !dismissedLocally;

  function finishCheckin() {
    // Provider updates UI/local day state synchronously and persists in the
    // background. Do not wait for the network before dismissing the overlay.
    setDismissedLocally(true);
    completeQuiz();
  }

  return (
    <>
      {children}
      {shouldShow && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/65 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-checkin-title"
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl sm:p-7">
            <button
              type="button"
              onClick={finishCheckin}
              aria-label="Skip today's check-in"
              className="absolute right-4 top-4 rounded-lg p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
            >
              <X size={18} />
            </button>
            <div className="mb-3 flex items-center gap-2 text-[var(--theme-primary,#2dd4bf)]">
              <Sparkles size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider">Daily check-in · 1 question</span>
            </div>
            <h2 id="daily-checkin-title" className="mb-2 text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
              Warm up your problem-solving brain
            </h2>
            <p className="mb-6 text-sm text-[var(--muted-foreground)]">
              One quick question. Your dashboard is already loading behind this.
            </p>
            <DailyQuickQuiz onComplete={finishCheckin} />
            <button
              type="button"
              onClick={finishCheckin}
              className="mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
            >
              Skip for today
            </button>
          </div>
        </div>
      )}
    </>
  );
}

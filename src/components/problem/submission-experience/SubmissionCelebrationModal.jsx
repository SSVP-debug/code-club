import { useEffect, useRef, useState } from "react";
import { CheckCircle2, X, Zap } from "lucide-react";
import { useAppContext } from "../../../hooks/useAppContext";
import { useTheme } from "../../../hooks/useTheme";
import Button from "../../ui/Button";
import StreakBadge from "../../common/StreakBadge";
import ReflectionPrompt from "./ReflectionPrompt";
import NextBestProblemCard from "./NextBestProblemCard";
import NextBestProblemEmptyState from "./NextBestProblemEmptyState";
import { pickAcceptedMessage } from "../../../utils/submissionEncouragement";

/**
 * SubmissionCelebrationModal — Feature 1 of the Submission Experience.
 *
 * The single integration point for every Accepted result: celebration
 * animation, XP earned, streak, an encouraging (non-spoiling) message, the
 * Reflection Score prompt (Feature 3), and the Next Best Problem card
 * (Feature 4). Deliberately one composed overlay rather than four separate
 * UI additions — see the "no giant popup full of text" / "avoid visual
 * clutter" requirements in the spec.
 *
 * Ownership model: this component owns its own visibility. It watches
 * `submitInfo` for a *new* Accepted result (keyed by submissionId, so a
 * resubmitted Accepted attempt on an already-solved problem still opens
 * its own modal — matching "whenever a submission is accepted" in the
 * spec) rather than being told when to open by a parent. That keeps
 * ProblemWorkspaceLayout from needing any new state of its own — it just
 * mounts this once and hands it submitInfo, exactly like it already does
 * for SubmissionResultBanner.
 */
function SubmissionCelebrationModal({ submitInfo, problem, nextBestProblem }) {
  const { currentStreak } = useAppContext();
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const shownSubmissionIdRef = useRef(null);

  const isAccepted = submitInfo?.status?.includes("Accepted");
  const submissionId = submitInfo?.submissionId ?? null;

  useEffect(() => {
    if (isAccepted && submissionId && shownSubmissionIdRef.current !== submissionId) {
      shownSubmissionIdRef.current = submissionId;
      setVisible(true);
    }
  }, [isAccepted, submissionId]);

  // Escape-to-close, matching standard modal affordances elsewhere in the app.
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  if (!visible) return null;

  const xpEarned = submitInfo.xpEarned ?? 0;
  const isFirstSolve = !!submitInfo.isFirstSolve;
  const encouragement = pickAcceptedMessage(submissionId);

  return (
    <div
      data-universe-result="accepted-celebration"
      className="universe-celebration fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Submission accepted"
      onClick={() => setVisible(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="universe-celebration__card relative w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/50 p-6 animate-celebration-pop-in"
      >
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition"
        >
          <X size={16} />
        </button>

        {/* ── Success state + celebration animation (subtle: one soft ring,
            no screen-filling effects) ────────────────────────────────── */}
        <div className="universe-celebration__hero flex flex-col items-center text-center pt-1">
          <div className="relative w-16 h-16 mb-3">
            <span
              className="absolute inset-0 rounded-full animate-celebration-ring"
              style={{ backgroundColor: "var(--theme-primary, #2dd4bf)" }}
              aria-hidden="true"
            />
            <div
              className="relative w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, var(--theme-primary, #2dd4bf), var(--theme-accent, #0d9488))",
              }}
            >
              <CheckCircle2 size={32} className="text-black" strokeWidth={2.5} aria-hidden="true" />
            </div>
          </div>

          <p
            className="text-xs font-semibold uppercase tracking-[0.2em] mb-1"
            style={{ color: "var(--theme-primary, #2dd4bf)" }}
          >
            {theme.words?.accepted ?? "Accepted"}
          </p>
          <h2 className="text-lg font-bold text-[var(--foreground)] leading-snug truncate max-w-full px-2">
            {problem.title}
          </h2>

          {/* XP + streak */}
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            {isFirstSolve && xpEarned > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 text-xs font-bold">
                <Zap size={13} strokeWidth={2.5} aria-hidden="true" />
                <span>+{xpEarned} XP</span>
              </div>
            )}
            <StreakBadge streak={currentStreak} size="sm" />
          </div>

          {/* Encouraging message — never algorithm hints, never solution talk. */}
          <p className="text-sm text-[var(--muted-foreground)] mt-3">{encouragement}</p>
        </div>

        {/* ── Reflection Score (Feature 3) ─────────────────────────────── */}
        <div className="mt-5 pt-4 border-t border-[var(--border)]">
          <ReflectionPrompt submissionId={submissionId} />
        </div>

        {/* ── Next Best Problem (Feature 4) ────────────────────────────── */}
        {/* Always rendered — never left blank. nextBestProblem is null only
            when every recommendation strategy came up empty (the user has
            solved everything currently available to them), which is a
            completion state worth celebrating, not an empty section. */}
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          {nextBestProblem ? (
            <NextBestProblemCard nextProblem={nextBestProblem} />
          ) : (
            <NextBestProblemEmptyState />
          )}
        </div>

        <Button
          variant="primary"
          className="w-full mt-5"
          onClick={() => setVisible(false)}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

export default SubmissionCelebrationModal;
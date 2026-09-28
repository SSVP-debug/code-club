import { useEffect, useState } from "react";
import { apiFetch } from "../../services/api";
import { useTheme } from "../../hooks/useTheme";
import { withAlpha } from "../../themes/themeIcons";
import SectionCard from "../ui/layout/SectionCard";
import Button from "../ui/Button";
import CollegeVerifyModal from "./CollegeVerifyModal";
import { GraduationCap, BadgeCheck, Clock, XCircle } from "lucide-react";

/**
 * EducationSection — Profile's "Education" block (Phase 12C, revised).
 *
 * Five states, derived from the two independent flags on `education`
 * (emailVerified, collegeStatus) rather than a single boolean — see
 * plans/001-college-verification-two-track-flow.md §4/§6.2:
 *   1. empty            — no education data yet        → "Add College" CTA
 *   2. email_pending     — collegeEmail set, not yet confirmed → Resend
 *   3. college_pending    — email confirmed, institution under review
 *   4. college_rejected   — email confirmed, institution not approved
 *   5. verified           — email confirmed, institution approved
 */
function deriveState(education) {
  if (!education?.collegeEmail) return "empty";
  if (!education.emailVerified) return "email_pending";
  if (education.collegeStatus === "pending") return "college_pending";
  if (education.collegeStatus === "rejected") return "college_rejected";
  return "verified"; // collegeStatus === "verified"
}

export default function EducationSection({ collapsible = true }) {
  const { theme } = useTheme();
  const [education, setEducation] = useState(undefined); // undefined = loading
  const [modalOpen, setModalOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState("");

  function refresh() {
    apiFetch("/api/college-verification/status")
      .then((d) => setEducation(d.education))
      .catch(() => setEducation(null));
  }

  useEffect(refresh, []);

  async function handleResend() {
    setResendError("");
    setResending(true);
    try {
      await apiFetch("/api/college-verification/resend", { method: "POST" });
    } catch (err) {
      setResendError(err.message || "Failed to resend verification email.");
    }
    setResending(false);
  }

  const state = deriveState(education);

  return (
    <SectionCard
      title="Education"
      subtitle="Verify your college to unlock the College Leaderboard"
      icon={<GraduationCap size={18} strokeWidth={2} />}
      accented
      collapsible={collapsible}
      defaultOpen={false}
      storageKey="profile-collapse-education"
    >
      {education === undefined ? (
        <div className="h-16 bg-[var(--surface-elevated)] rounded-xl animate-pulse" />
      ) : state === "verified" ? (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-[var(--foreground)]">{education.collegeName}</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              {[education.degree, education.branch, education.graduationYear]
                .filter(Boolean)
                .join(" · ") || "No further details added"}
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: withAlpha(theme.colors.primary, "1f"), color: theme.colors.primary }}
          >
            <BadgeCheck size={14} strokeWidth={2} aria-hidden="true" />
            Verified
          </span>
        </div>
      ) : state === "college_pending" ? (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-[var(--foreground)]">{education.collegeName}</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Your college email has been verified. We're reviewing{" "}
              {education.collegeName} before adding it to official college rankings.
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-2 flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <BadgeCheck size={12} aria-hidden="true" /> Email verified
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} aria-hidden="true" /> Institution under review
              </span>
            </p>
          </div>
        </div>
      ) : state === "college_rejected" ? (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-[var(--foreground)]">{education.collegeName}</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 flex items-center gap-1.5">
              <XCircle size={13} className="text-red-500" aria-hidden="true" />
              Wasn't approved for official college features. Your email verification is still valid.
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)} variant="secondary" size="sm">
            Try a different college
          </Button>
        </div>
      ) : state === "email_pending" ? (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-[var(--foreground)]">{education.collegeName}</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5 flex items-center gap-1.5">
              <Clock size={13} aria-hidden="true" />
              Verification pending — check {education.collegeEmail}
            </p>
            {resendError && (
              <p role="alert" className="text-red-400 text-xs mt-1">
                {resendError}
              </p>
            )}
          </div>
          <Button onClick={handleResend} variant="secondary" size="sm" disabled={resending} loading={resending}>
            Resend
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[var(--muted-foreground)] text-sm">
            Add your college to unlock the College Leaderboard, college-only
            contests, and a verified badge.
          </p>
          <Button onClick={() => setModalOpen(true)} variant="theme" size="sm">
            Add College
          </Button>
        </div>
      )}

      {modalOpen && (
        <CollegeVerifyModal
          onClose={() => setModalOpen(false)}
          onSent={() => {
            setModalOpen(false);
            refresh();
          }}
        />
      )}
    </SectionCard>
  );
}
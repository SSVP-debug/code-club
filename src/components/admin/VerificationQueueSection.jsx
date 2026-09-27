import { useState } from "react";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";

// Admin UX audit (Phase UI-3, P0): Reject used to fire on a single click,
// same as Approve. The two aren't symmetric in risk — Approve is easy to
// walk back later (suspend, from the Users table), but Reject discards
// the request outright with no record surfaced to the requester and no
// way for the admin to undo it from here. It gets a confirmation step;
// Approve stays one-click since a fast, low-friction "yes" is exactly
// what a review queue should optimize for.
function QueueRow({
  title,
  subtitle,
  meta,
  signal,
  evidenceHint,
  evidence,
  reviewHistory,
  reviewTarget,
  onApprove,
  onReject,
  busy,
}) {
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const isTpoReview = reviewTarget === "user";
  const hasDetails =
    isTpoReview &&
    ((Array.isArray(evidence) && evidence.length > 0) ||
      (Array.isArray(reviewHistory) && reviewHistory.length > 0));

  function closeRejectDialog() {
    if (busy === "reject") return;
    setConfirmingReject(false);
    setRejectReason("");
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[var(--foreground)] font-semibold text-sm truncate">{title}</p>
          <p className="text-[var(--muted-foreground)] text-xs truncate">{subtitle}</p>
          {meta && <p className="text-[var(--muted-foreground)] text-[11px] mt-0.5">{meta}</p>}
          {signal && (
            <p className="text-[var(--muted-foreground)] text-[11px] mt-1">
              Email signal: <span className="font-medium text-[var(--foreground)]">{signal.replaceAll("_", " ")}</span>
              {evidenceHint ? " · additional evidence recommended" : ""}
            </p>
          )}
          {Array.isArray(evidence) && evidence.length > 0 && (
            <p className="text-[var(--muted-foreground)] text-[11px] mt-0.5">
              Evidence: {evidence.map((item) => item.label).join(", ")}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasDetails && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setShowDetails((open) => !open)}
              aria-expanded={showDetails}
            >
              {showDetails ? "Hide details" : "Review details"}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            loading={busy === "reject"}
            onClick={() => setConfirmingReject(true)}
          >
            Reject
          </Button>
          <Button size="sm" variant="primary" disabled={busy} loading={busy === "approve"} onClick={onApprove}>
            Approve
          </Button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] grid gap-3 text-xs">
          {Array.isArray(evidence) && evidence.length > 0 && (
            <div>
              <p className="font-semibold text-[var(--foreground)] mb-1">Submitted evidence</p>
              <div className="grid gap-2">
                {evidence.map((item, index) => (
                  <div key={`${item.kind}-${index}`} className="rounded-lg border border-[var(--border)] px-3 py-2">
                    <p className="font-medium text-[var(--foreground)]">{item.label}</p>
                    <p className="text-[var(--muted-foreground)] mt-0.5">
                      {item.kind.replaceAll("_", " ")}
                      {item.reference ? ` · ${item.reference}` : ""}
                    </p>
                    {item.note && <p className="text-[var(--muted-foreground)] mt-1">{item.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(reviewHistory) && reviewHistory.length > 0 && (
            <div>
              <p className="font-semibold text-[var(--foreground)] mb-1">Previous review history</p>
              <div className="grid gap-1.5">
                {reviewHistory.map((review, index) => (
                  <div key={`${review.reviewedAt || "review"}-${index}`} className="rounded-lg bg-[var(--background)] px-3 py-2">
                    <p className="text-[var(--foreground)] font-medium capitalize">
                      {review.decision}
                      {review.reviewedAt ? ` · ${new Date(review.reviewedAt).toLocaleString()}` : ""}
                    </p>
                    {review.decisionReason && (
                      <p className="text-[var(--muted-foreground)] mt-0.5">{review.decisionReason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {confirmingReject && (
        <ConfirmDialog
          title={`Reject ${title}?`}
          description={
            isTpoReview
              ? "Record the reason for this decision. The applicant can submit a new verification request later."
              : "This discards the request. They'll need to submit a new one if they want to be reconsidered."
          }
          confirmLabel="Reject"
          destructive
          loading={busy === "reject"}
          onConfirm={() => {
            const reason = rejectReason.trim();
            if (isTpoReview && !reason) return;
            setConfirmingReject(false);
            onReject(reason || undefined);
            setRejectReason("");
          }}
          onCancel={closeRejectDialog}
        >
          {isTpoReview && (
            <div className="mb-5">
              <label htmlFor="tpo-rejection-reason" className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
                Decision reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="tpo-rejection-reason"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Explain what could not be verified or what evidence was insufficient."
                className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
                disabled={busy === "reject"}
              />
              <p className="text-[var(--muted-foreground)] text-[11px] mt-1">
                {rejectReason.length}/1000 characters
              </p>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

/**
 * VerificationQueueSection — the recruiter-requests and TPO/college-requests
 * sections are identical in structure (a heading with a count, a loading/
 * empty state, and a list of QueueRows), differing only in what data and
 * row-shaping function they use. One component, parameterized, instead of
 * two near-duplicate blocks (which is what src/pages/AdminConsolePage.jsx
 * had before this extraction — Staff review §4/§9/#12).
 */
function VerificationQueueSection({ heading, loading, emptyLabel, items, busyIds, getRow, onApprove, onReject }) {
  return (
    <section className="mb-10">
      <h2 className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] font-semibold mb-3">
        {heading} {items.length > 0 && `(${items.length})`}
      </h2>
      {loading ? (
        <p className="text-[var(--muted-foreground)] text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const row = getRow(item);
            return (
              <QueueRow
                key={row.id}
                title={row.title}
                subtitle={row.subtitle}
                meta={row.meta}
                signal={row.signal}
                evidenceHint={row.evidenceHint}
                evidence={row.evidence}
                reviewHistory={row.reviewHistory}
                reviewTarget={row.reviewTarget}
                busy={busyIds[row.id]}
                onApprove={() => onApprove(row.actionTarget ?? row.id)}
                onReject={(reason) => onReject(row.actionTarget ?? row.id, reason)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export default VerificationQueueSection;
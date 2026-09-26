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
function QueueRow({ title, subtitle, meta, signal, evidenceHint, evidence, onApprove, onReject, busy }) {
  const [confirmingReject, setConfirmingReject] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3">
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

      {confirmingReject && (
        <ConfirmDialog
          title={`Reject ${title}?`}
          description="This discards the request. They'll need to submit a new one if they want to be reconsidered — this can't be undone from here."
          confirmLabel="Reject"
          destructive
          loading={busy === "reject"}
          onConfirm={() => {
            setConfirmingReject(false);
            onReject();
          }}
          onCancel={() => setConfirmingReject(false)}
        />
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
                busy={busyIds[row.id]}
                onApprove={() => onApprove(row.actionTarget ?? row.id)}
                onReject={() => onReject(row.actionTarget ?? row.id)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export default VerificationQueueSection;
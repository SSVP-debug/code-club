import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Crown, UserPlus, UserMinus, ArrowLeftRight } from "lucide-react";
import { apiFetch } from "../../services/api";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";

/**
 * TpoTeamPanel — the "Team" tab content on TpoDashboardPage.jsx.
 *
 * Talks to the Phase 3 team endpoints (backend/routes/tpo.js):
 *   GET    /api/tpo/team
 *   POST   /api/tpo/team/invite
 *   DELETE /api/tpo/team/:tpoId
 *   POST   /api/tpo/team/:tpoId/make-primary
 *
 * The backend is the real authorization boundary here (requirePrimaryTeamAction
 * in routes/tpo.js) — hiding the invite/remove/transfer actions for a
 * secondary TPO below is a UX nicety, not the security control (item 24:
 * "Do not rely on frontend hiding buttons as security").
 */
export default function TpoTeamPanel() {
  const [team, setTeam] = useState(null);
  const [collegeName, setCollegeName] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // { type: "remove" | "transfer", member } | null — drives ConfirmDialog
  const [pendingAction, setPendingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/tpo/team");
      setTeam(data.team || []);
      setCollegeName(data.collegeName || "");
    } catch (err) {
      setError(err.message || "Failed to load TPO team.");
    } finally {
      setLoading(false);
    }
  }, []);

  // "Am I the primary TPO" isn't derivable from /team's response alone —
  // it lists everyone's isPrimary flag, but not which row is the caller.
  // /me already resolves that (routes/tpo.js), so ask it directly instead
  // of trying to match the roster against some other identifier.
  const fetchIsPrimary = useCallback(async () => {
    try {
      const me = await apiFetch("/api/tpo/me");
      setIsPrimary(Boolean(me.isPrimary));
    } catch {
      // Non-fatal — the team list itself still renders; action buttons
      // just stay hidden (fail closed) if this call fails.
    }
  }, []);

  // Standard "fetch on mount" pattern used throughout this codebase (see
  // TpoDashboardPage.jsx's fetchAll effect for the fullest write-up of
  // this decision) — the called functions are useCallback-wrapped async
  // fetchers whose setState calls happen after their own await, not
  // synchronously in this effect's body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount pattern, see comment above.
    fetchTeam();
    fetchIsPrimary();
  }, [fetchTeam, fetchIsPrimary]);

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await apiFetch("/api/tpo/team/invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      toast.success("Added to your TPO team.");
      setInviteEmail("");
      fetchTeam();
    } catch (err) {
      toast.error(err.message || "Failed to add TPO.");
    } finally {
      setInviting(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      if (pendingAction.type === "remove") {
        await apiFetch(`/api/tpo/team/${pendingAction.member.id}`, { method: "DELETE" });
        toast.success(`Removed ${pendingAction.member.name} from your TPO team.`);
      } else {
        await apiFetch(`/api/tpo/team/${pendingAction.member.id}/make-primary`, { method: "POST" });
        toast.success(`${pendingAction.member.name} is now the primary TPO.`);
      }
      setPendingAction(null);
      fetchTeam();
      fetchIsPrimary();
    } catch (err) {
      toast.error(err.message || "Action failed. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--theme-primary,#2dd4bf)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center">
        <p className="text-[var(--muted-foreground)] text-sm">{error}</p>
        <Button size="sm" variant="secondary" className="mt-4" onClick={fetchTeam}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isPrimary && (
        <form
          onSubmit={handleInvite}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col sm:flex-row gap-3"
        >
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder={`colleague@${collegeName ? "your-college.edu" : "college.edu"}`}
            type="email"
            className="flex-1 bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-[var(--foreground)] text-sm outline-none focus:border-[var(--theme-primary,#2dd4bf)]"
          />
          <Button type="submit" size="sm" loading={inviting} disabled={inviting || !inviteEmail.trim()}>
            <UserPlus size={16} strokeWidth={2} aria-hidden="true" />
            Add TPO
          </Button>
        </form>
      )}

      {(!team || team.length === 0) ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-[var(--muted-foreground)] text-sm">No TPOs found for your college yet.</p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {team.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)] truncate">{member.name}</p>
                    {member.isPrimary && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[var(--theme-primary,#2dd4bf)]/10 text-[var(--theme-primary,#2dd4bf)]"
                        aria-label="Primary TPO"
                      >
                        <Crown size={11} strokeWidth={2.5} aria-hidden="true" />
                        Primary
                      </span>
                    )}
                    {!member.verified && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-400/10 text-orange-400">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--muted-foreground)] text-sm truncate">{member.email}</p>
                </div>

                {isPrimary && !member.isPrimary && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {member.verified && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPendingAction({ type: "transfer", member })}
                      >
                        <ArrowLeftRight size={14} strokeWidth={2} aria-hidden="true" />
                        Make Primary
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setPendingAction({ type: "remove", member })}
                    >
                      <UserMinus size={14} strokeWidth={2} aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={
            pendingAction.type === "remove"
              ? `Remove ${pendingAction.member.name}?`
              : `Make ${pendingAction.member.name} the primary TPO?`
          }
          description={
            pendingAction.type === "remove"
              ? `${pendingAction.member.name}'s TPO access at ${collegeName || "your college"} will be revoked immediately. If they also have a Student account, it will be unaffected.`
              : `${pendingAction.member.name} will become the primary TPO for ${collegeName || "your college"}, and you'll become a secondary TPO. You can be made primary again later.`
          }
          confirmLabel={pendingAction.type === "remove" ? "Remove" : "Transfer"}
          destructive={pendingAction.type === "remove"}
          loading={actionLoading}
          onConfirm={confirmPendingAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
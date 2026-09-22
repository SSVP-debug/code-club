import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Pencil, Archive as ArchiveIcon } from "lucide-react";
import { apiFetch } from "../../services/api";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import TpoCohortFormModal from "./TpoCohortFormModal";
import TpoCohortRoster from "./TpoCohortRoster";

/**
 * TpoCohortDetail — cohort header (name/branch/academicYear/
 * graduatingYear/section/status) + Edit/Archive actions + roster
 * (TPO-2 Step 7). Talks to:
 *   GET  /api/tpo/cohorts/:cohortId
 *   POST /api/tpo/cohorts/:cohortId/archive
 * PATCH /api/tpo/cohorts/:cohortId happens inside TpoCohortFormModal.
 *
 * Archive is idempotent server-side (backend/services/cohortService.js's
 * archiveCohort — a repeat archive returns 200 with `alreadyArchived:
 * true`, never an error), so confirmArchive() below treats that
 * response the same as a first-time archive rather than as a failure —
 * matching that idempotent contract rather than assuming success/failure
 * is the only outcome shape. There's no unarchive action anywhere in
 * this component, per this step's explicit "no restore operation."
 */
export default function TpoCohortDetail({ cohortId, onBack, onCohortChanged }) {
  const [cohort, setCohort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const fetchCohort = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/tpo/cohorts/${cohortId}`);
      setCohort(data);
    } catch (err) {
      setError(err.message || "Failed to load cohort.");
    } finally {
      setLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount pattern, see TpoDashboardPage.jsx's fetchAll effect for the fullest write-up.
    fetchCohort();
  }, [fetchCohort]);

  async function confirmArchive() {
    setArchiving(true);
    try {
      const data = await apiFetch(`/api/tpo/cohorts/${cohortId}/archive`, { method: "POST" });
      setCohort(data);
      toast.success(data.alreadyArchived ? "This cohort is already archived." : "Cohort archived.");
      setShowArchiveConfirm(false);
      onCohortChanged?.();
    } catch (err) {
      toast.error(err.message || "Failed to archive cohort.");
    } finally {
      setArchiving(false);
    }
  }

  function handleEditSaved(updated) {
    setCohort(updated);
    setShowEditModal(false);
    onCohortChanged?.();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--theme-primary,#2dd4bf)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1.5">
          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
          Back to cohorts
        </button>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center">
          <p className="text-[var(--muted-foreground)] text-sm">{error || "Cohort not found."}</p>
          <Button size="sm" variant="secondary" className="mt-4" onClick={fetchCohort}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const isArchived = cohort.status === "archived";

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1.5">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
        Back to cohorts
      </button>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-[var(--foreground)]">{cohort.name}</h2>
              {isArchived && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[var(--surface-elevated)] text-[var(--muted-foreground)]">
                  Archived
                </span>
              )}
            </div>
            <p className="text-[var(--muted-foreground)] text-sm mt-1">
              {cohort.branch} · {cohort.academicYear} · Graduating {cohort.graduatingYear}
              {cohort.section ? ` · Section ${cohort.section}` : ""}
            </p>
            {cohort.expectedHeadcount != null && (
              <p className="text-[var(--muted-foreground)] text-xs mt-1">
                Expected headcount: {cohort.expectedHeadcount}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setShowEditModal(true)}>
              <Pencil size={14} strokeWidth={2} aria-hidden="true" />
              Edit
            </Button>
            {!isArchived && (
              <Button size="sm" variant="danger" onClick={() => setShowArchiveConfirm(true)}>
                <ArchiveIcon size={14} strokeWidth={2} aria-hidden="true" />
                Archive
              </Button>
            )}
          </div>
        </div>
      </div>

      <TpoCohortRoster cohortId={cohortId} />

      {showEditModal && (
        <TpoCohortFormModal cohort={cohort} onClose={() => setShowEditModal(false)} onSaved={handleEditSaved} />
      )}

      {showArchiveConfirm && (
        <ConfirmDialog
          title={`Archive ${cohort.name}?`}
          description="Archiving keeps this cohort and its roster — it just marks it inactive. It doesn't delete any students or remove their roster history. There's no undo for this from here."
          confirmLabel="Archive"
          destructive
          loading={archiving}
          onConfirm={confirmArchive}
          onCancel={() => setShowArchiveConfirm(false)}
        />
      )}
    </div>
  );
}

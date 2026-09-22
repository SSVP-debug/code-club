import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { UserPlus, UserMinus, Upload } from "lucide-react";
import { apiFetch } from "../../services/api";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import TpoCohortImportModal from "./TpoCohortImportModal";

const ROSTER_PAGE_SIZE = 25; // matches the backend's default (backend/routes/tpo.js)
const ROSTER_SEARCH_DEBOUNCE_MS = 300; // matches TpoDashboardPage.jsx's students-tab debounce
const ROSTER_STATUSES = ["active", "invited", "removed"];

function statusBadgeClass(status) {
  if (status === "active") return "bg-[var(--theme-primary,#2dd4bf)]/10 text-[var(--theme-primary,#2dd4bf)]";
  if (status === "invited") return "bg-orange-400/10 text-orange-400";
  return "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]"; // removed
}

/**
 * TpoCohortRoster — the roster section inside cohort detail (TPO-2 Step
 * 7). Talks to TPO-2 Steps 5/6's backend routes:
 *   GET    /api/tpo/cohorts/:cohortId/students
 *   POST   /api/tpo/cohorts/:cohortId/students
 *   DELETE /api/tpo/cohorts/:cohortId/students/:membershipId
 *   POST   /api/tpo/cohorts/:cohortId/import  (via TpoCohortImportModal)
 *
 * Search/status/page are server-side only (backend/services/
 * cohortMembershipService.js's getCohortRoster does the actual
 * filtering/pagination) — this component never filters a downloaded
 * roster client-side. The debounced-search / URL-sync pattern below is
 * a direct copy of TpoDashboardPage.jsx's own students-tab
 * implementation (down to the isFirstSearchRender guard and its
 * reasoning) rather than a new convention, per this step's "reuse the
 * existing design system" instruction — with its own `roster*` URL
 * params (rosterQ/rosterStatus/rosterPage) so they don't collide with
 * that tab's q/sort/page or TpoCohortsPanel's own cohort-list params.
 *
 * Archived-cohort note: the backend currently does NOT block roster
 * mutations (add/remove/import) on an archived cohort — confirmed by
 * reading cohortMembershipService.js/cohortImportService.js, neither of
 * which checks cohort.status. Per this step's explicit "the frontend
 * must reflect backend truth, not invent a second lifecycle" /
 * "report the mismatch" instruction, Add Student / Import CSV are
 * therefore NOT disabled here for an archived cohort — disabling them
 * would claim a restriction the API doesn't actually enforce. See this
 * session's final response for the reported mismatch.
 */
export default function TpoCohortRoster({ cohortId }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState(() => {
    const fromUrl = searchParams.get("rosterStatus");
    return ROSTER_STATUSES.includes(fromUrl) ? fromUrl : "active";
  });
  const [searchInput, setSearchInput] = useState(() => searchParams.get("rosterQ") || "");
  const [search, setSearch] = useState(() => searchParams.get("rosterQ") || "");
  const [page, setPage] = useState(() => {
    const fromUrl = parseInt(searchParams.get("rosterPage"), 10);
    return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : 1;
  });

  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ activeCount: 0, invitedCount: 0, removedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const [pendingRemove, setPendingRemove] = useState(null); // roster row | null
  const [removing, setRemoving] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);

  const fetchRoster = useCallback(
    async ({ status, search: q, page: p }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(p));
        params.set("limit", String(ROSTER_PAGE_SIZE));
        params.set("status", status);
        if (q) params.set("search", q);

        const data = await apiFetch(`/api/tpo/cohorts/${cohortId}/students?${params.toString()}`);
        setStudents(data.students || []);
        setTotal(data.total || 0);
        setCounts(data.counts || { activeCount: 0, invitedCount: 0, removedCount: 0 });
      } catch (err) {
        setError(err.message || "Failed to load roster.");
      } finally {
        setLoading(false);
      }
    },
    [cohortId]
  );

  const isFirstSearchRender = useRef(true);
  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, ROSTER_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/change pattern, see TpoDashboardPage.jsx's fetchStudents effect.
    fetchRoster({ status: statusFilter, search, page });
  }, [fetchRoster, statusFilter, search, page]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        statusFilter !== "active" ? params.set("rosterStatus", statusFilter) : params.delete("rosterStatus");
        search ? params.set("rosterQ", search) : params.delete("rosterQ");
        page > 1 ? params.set("rosterPage", String(page)) : params.delete("rosterPage");
        return params;
      },
      { replace: true }
    );
  }, [statusFilter, search, page, setSearchParams]);

  function changeStatusFilter(next) {
    setStatusFilter(next);
    setPage(1);
  }

  function refetch() {
    fetchRoster({ status: statusFilter, search, page });
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    const email = addEmail.trim();
    if (!email) return;

    setAdding(true);
    try {
      const result = await apiFetch(`/api/tpo/cohorts/${cohortId}/students`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (result.membershipStatus === "active") {
        toast.success(`${result.email} added as an active member.`);
      } else {
        toast.success(`${result.email} added to the roster as invited — no matching Code Club account yet.`);
      }
      setAddEmail("");
      refetch();
    } catch (err) {
      // 409 (already an active member) and 400 (invalid email /
      // foreign-institution / unlinked-account rejections) both arrive
      // as a clean, already-safe err.message from the backend (see
      // cohortMembershipService.js's own institution-matching comment
      // on why the foreign-college message never names the other
      // institution) — shown as-is, same as every other apiFetch error
      // in this app.
      toast.error(err.message || "Failed to add student.");
    } finally {
      setAdding(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await apiFetch(`/api/tpo/cohorts/${cohortId}/students/${pendingRemove.membershipId}`, { method: "DELETE" });
      toast.success(`Removed ${pendingRemove.email} from this cohort.`);
      setPendingRemove(null);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to remove student.");
    } finally {
      setRemoving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / ROSTER_PAGE_SIZE));
  const inputClass =
    "bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--theme-primary,#2dd4bf)]/50";

  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleAddStudent} className="flex-1 flex gap-2">
          <label htmlFor="cohort-add-email" className="sr-only">Add student by email</label>
          <input
            id="cohort-add-email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            type="email"
            placeholder="Add student by email…"
            className={`flex-1 min-w-[160px] ${inputClass}`}
            disabled={adding}
          />
          <Button type="submit" size="sm" loading={adding} disabled={adding || !addEmail.trim()}>
            <UserPlus size={15} strokeWidth={2} aria-hidden="true" />
            Add Student
          </Button>
        </form>
        <Button size="sm" variant="secondary" onClick={() => setShowImportModal(true)}>
          <Upload size={15} strokeWidth={2} aria-hidden="true" />
          Import CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="cohort-roster-search" className="sr-only">Search roster</label>
        <input
          id="cohort-roster-search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email…"
          className={`flex-1 min-w-[200px] ${inputClass}`}
        />
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter roster by status">
          {ROSTER_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => changeStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                statusFilter === s
                  ? "bg-[var(--theme-primary,#2dd4bf)] text-black"
                  : "bg-[var(--surface)] text-[var(--muted-foreground)] border border-[var(--border)]"
              }`}
            >
              {s} ({s === "active" ? counts.activeCount : s === "invited" ? counts.invitedCount : counts.removedCount})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
          <span className="flex-1">Student</span>
          <span className="w-28">Status</span>
          <span className="w-24 text-right">Action</span>
        </div>
        <div
          className={`divide-y divide-[var(--border)] max-h-[500px] overflow-y-auto transition-opacity ${
            loading ? "opacity-50" : ""
          }`}
        >
          {error ? (
            <p className="text-center text-red-400 py-12 text-sm">
              {error} —{" "}
              <button onClick={refetch} className="underline hover:text-red-300">
                Try again
              </button>
            </p>
          ) : students.length === 0 && loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[var(--theme-primary,#2dd4bf)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-center text-[var(--muted-foreground)] py-12 text-sm">
              {search
                ? `No ${statusFilter} members match "${search}".`
                : `No ${statusFilter} members in this cohort yet.`}
            </p>
          ) : (
            students.map((row) => (
              <div
                key={row.membershipId}
                className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  {/* An invited row with no matched account has no name —
                      "Unmatched" makes clear this isn't yet a real Code
                      Club account, not a display glitch (studentId is
                      null server-side — see cohortMembershipService.js). */}
                  <p className="text-sm text-[var(--foreground)] truncate">
                    {row.name || <span className="text-[var(--muted-foreground)] italic">Unmatched</span>}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] truncate">{row.email}</p>
                </div>
                <div className="flex items-center gap-3 sm:contents">
                  <span className={`sm:w-28 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide w-fit ${statusBadgeClass(row.membershipStatus)}`}>
                    {row.membershipStatus}
                  </span>
                  <span className="sm:w-24 flex sm:justify-end">
                    {row.membershipStatus !== "removed" && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setPendingRemove(row)}
                        aria-label={`Remove ${row.email} from this cohort`}
                      >
                        <UserMinus size={13} strokeWidth={2} aria-hidden="true" />
                        Remove
                      </Button>
                    )}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        {!error && total > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--border)] text-sm">
            <span className="text-[var(--muted-foreground)] text-xs">
              Page {page} of {totalPages} · {total} member{total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-strong)] text-[var(--foreground)] text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-strong)] text-[var(--foreground)] text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingRemove && (
        <ConfirmDialog
          title={`Remove ${pendingRemove.email}?`}
          description="This removes them from this cohort's roster only. It does not delete their Code Club account, and does not affect any other cohort they belong to."
          confirmLabel="Remove"
          destructive
          loading={removing}
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemove(null)}
        />
      )}

      {showImportModal && (
        <TpoCohortImportModal
          cohortId={cohortId}
          onClose={() => setShowImportModal(false)}
          onImported={refetch}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, GraduationCap } from "lucide-react";
import { apiFetch } from "../../services/api";
import Button from "../ui/Button";
import TpoCohortFormModal from "./TpoCohortFormModal";
import TpoCohortDetail from "./TpoCohortDetail";

const COHORTS_PAGE_SIZE = 25; // matches the backend's default (backend/routes/tpo.js)
const COHORT_SEARCH_DEBOUNCE_MS = 300; // matches TpoDashboardPage.jsx's students-tab debounce
const COHORT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "", label: "All" },
];

/**
 * TpoCohortsPanel — the "Cohorts" tab content on TpoDashboardPage.jsx
 * (TPO-2 Step 7). Talks to TPO-2 Step 4's cohort CRUD routes:
 *   GET  /api/tpo/cohorts
 *   POST /api/tpo/cohorts   (via TpoCohortFormModal)
 *
 * List ↔ detail is a client-side view switch, not a route change — no
 * full-page navigation, per this step's "avoid full-page reloads"
 * instruction. The selected cohort id is kept in the URL (?cohortId=…)
 * so a shared/refreshed link reopens the same cohort, same
 * deep-linkable pattern TpoDashboardPage.jsx already uses for `tab`.
 */
export default function TpoCohortsPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCohortId, setSelectedCohortIdState] = useState(() => searchParams.get("cohortId") || null);

  function selectCohort(id) {
    setSelectedCohortIdState(id);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (id) params.set("cohortId", id);
        else params.delete("cohortId");
        return params;
      },
      { replace: true }
    );
  }

  const [statusFilter, setStatusFilter] = useState("active");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchCohorts = useCallback(async ({ status, search: q, page: p }) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", String(COHORTS_PAGE_SIZE));
      if (status) params.set("status", status);
      if (q) params.set("search", q);

      const data = await apiFetch(`/api/tpo/cohorts?${params.toString()}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load cohorts.");
    } finally {
      setLoading(false);
    }
  }, []);

  const isFirstSearchRender = useRef(true);
  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, COHORT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (selectedCohortId) return; // list isn't visible/needed while a cohort is open
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/change pattern, see TpoDashboardPage.jsx's fetchStudents effect.
    fetchCohorts({ status: statusFilter, search, page });
  }, [fetchCohorts, statusFilter, search, page, selectedCohortId]);

  function changeStatusFilter(next) {
    setStatusFilter(next);
    setPage(1);
  }

  function refetchList() {
    fetchCohorts({ status: statusFilter, search, page });
  }

  const totalPages = Math.max(1, Math.ceil(total / COHORTS_PAGE_SIZE));
  const inputClass =
    "bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--theme-primary,#2dd4bf)]/50";

  if (selectedCohortId) {
    return (
      <TpoCohortDetail cohortId={selectedCohortId} onBack={() => selectCohort(null)} onCohortChanged={refetchList} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <label htmlFor="cohort-list-search" className="sr-only">Search cohorts</label>
          <input
            id="cohort-list-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search cohorts by name…"
            className={`flex-1 min-w-[200px] ${inputClass}`}
          />
          <label htmlFor="cohort-list-status" className="sr-only">Filter by status</label>
          <select
            id="cohort-list-status"
            value={statusFilter}
            onChange={(e) => changeStatusFilter(e.target.value)}
            className={inputClass}
          >
            {COHORT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Create Cohort
        </Button>
      </div>

      {error ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <Button size="sm" variant="secondary" onClick={refetchList}>
            Retry
          </Button>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[var(--theme-primary,#2dd4bf)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-elevated)] text-[var(--muted-foreground)] flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={26} strokeWidth={2} aria-hidden="true" />
          </div>
          <h3 className="text-[var(--foreground)] font-bold mb-1">No cohorts yet</h3>
          <p className="text-[var(--muted-foreground)] text-sm mb-5">
            {search || statusFilter !== "active"
              ? "No cohorts match your current filters."
              : "Create your first cohort to start managing students."}
          </p>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            Create Cohort
          </Button>
        </div>
      ) : (
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {items.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCohort(c.id)}
              className="text-left bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--theme-primary,#2dd4bf)]/50 rounded-2xl p-4 transition"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="font-bold text-[var(--foreground)] truncate">{c.name}</h3>
                {c.status === "archived" && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[var(--surface-elevated)] text-[var(--muted-foreground)]">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--muted-foreground)] truncate">
                {c.branch} · {c.academicYear} · Graduating {c.graduatingYear}
                {c.section ? ` · Section ${c.section}` : ""}
              </p>
              {c.expectedHeadcount != null && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                  Expected headcount: {c.expectedHeadcount}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {!error && total > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--muted-foreground)] text-xs">
            Page {page} of {totalPages} · {total} cohort{total === 1 ? "" : "s"}
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

      {showCreateModal && (
        <TpoCohortFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={(cohort) => {
            setShowCreateModal(false);
            refetchList();
            selectCohort(cohort.id);
          }}
        />
      )}
    </div>
  );
}

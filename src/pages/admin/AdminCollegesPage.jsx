import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, GraduationCap, Users2, ExternalLink } from "lucide-react";
import PageMeta from "../../components/seo/PageMeta";
import { useAdminColleges, COLLEGES_PAGE_SIZE } from "../../hooks/useAdminColleges";
import CollegeDetailDrawer from "../../components/admin/CollegeDetailDrawer";

// Same badge palette AdminConsolePage/CollegeVerifyConfirmPage already use
// for this exact status enum (pending/verified/rejected) — kept consistent
// rather than inventing a fourth color scheme for the same three states.
const STATUS_STYLES = {
  pending: "bg-amber-500/10 text-amber-400",
  verified: "bg-green-500/10 text-green-400",
  rejected: "bg-red-500/10 text-red-400",
};

const STATUS_FILTERS = [
  { id: "", label: "All statuses" },
  { id: "pending", label: "Pending" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
];

function StatusBadge({ status }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-semibold ${
        STATUS_STYLES[status] || "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]"
      }`}
    >
      {status}
    </span>
  );
}

// Plan 005: real Colleges page, replacing the plan-001 placeholder. The
// backend (collegeController.js) and this page's data hook
// (useAdminColleges.js) already existed and were fully wired — only this
// component itself was still "Coming soon." (found during the plan 007
// pre-flight audit; fixed here as a prerequisite, same pattern as the
// plan 005 education-schema prerequisite bugfix in PROGRESS.md).
export default function AdminCollegesPage() {
  const navigate = useNavigate();
  const [selectedCollegeId, setSelectedCollegeId] = useState(null);
  const {
    colleges,
    collegesTotal,
    collegesLoading,
    collegesPage,
    setCollegesPage,
    statusFilter,
    setStatusFilter,
    searchInput,
    setSearchInput,
    renameCollege,
    updateEmailRolePatterns,
  } = useAdminColleges();

  const selectedCollege = colleges.find((c) => c.id === selectedCollegeId) || null;

  function viewStudents(college) {
    // Deep-link into the Users page (plan 001/003), pre-filtered to this
    // college — the id is what listUsers' `college` filter needs, the name
    // is just so that page can show a "Filtered to: X" badge without a
    // second round-trip. See useAdminUsers.js's collegeFilter/collegeName.
    const params = new URLSearchParams({ college: college.id, collegeName: college.name });
    navigate(`/admin/users?${params.toString()}`);
  }

  return (
    <>
      <PageMeta title="Colleges — Admin Console — Code Club" description="Every college, with per-college aggregate stats." />
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-[var(--foreground)]">Colleges</h1>
          <p className="text-[var(--muted-foreground)] text-sm">
            {collegesTotal > 0 ? `${collegesTotal} college${collegesTotal === 1 ? "" : "s"}` : "No colleges yet."}
          </p>
        </div>

        {/* Admin UX audit (Phase UI-3, P1): same clear (×) affordance as
            the Users page search box — consistent pattern for the same
            interaction across both searchable admin lists. */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search name or domain…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-8 pr-8 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--border-strong)]"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--border-strong)]"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {collegesLoading ? (
          <p className="text-[var(--muted-foreground)] text-sm">Loading…</p>
        ) : colleges.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm">No colleges match that search.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {colleges.map((college) => (
              <div
                key={college.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCollegeId(college.id)}
                onKeyDown={(e) => e.key === "Enter" && setSelectedCollegeId(college.id)}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 flex flex-col gap-3 cursor-pointer transition hover:border-[var(--border-strong)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[var(--foreground)] font-semibold text-sm truncate">{college.name}</p>
                    <p className="text-[var(--muted-foreground)] text-xs truncate">{college.domains?.join(", ")}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={college.status} />
                    {college.autoDetected && (
                      <span
                        title="Name auto-derived from domain at signup — not yet reviewed"
                        className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide font-semibold bg-purple-500/10 text-purple-300"
                      >
                        Auto-detected
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-[var(--surface-elevated)]/60 rounded-lg py-2.5">
                  <div>
                    <p className="text-[var(--foreground)] text-xl font-black">{college.studentCount}</p>
                    <p className="text-[var(--muted-foreground)] text-[10px] uppercase tracking-wide">Students</p>
                  </div>
                  <div>
                    <p className="text-[var(--foreground)] text-xl font-black">{college.activeStudentCount}</p>
                    <p className="text-[var(--muted-foreground)] text-[10px] uppercase tracking-wide">Active</p>
                  </div>
                  <div>
                    <p className="text-[var(--foreground)] text-xl font-black">{college.tpoCount}</p>
                    <p className="text-[var(--muted-foreground)] text-[10px] uppercase tracking-wide">TPOs</p>
                  </div>
                </div>

                <p className="text-[var(--muted-foreground)] text-xs flex items-center gap-1">
                  <GraduationCap size={12} />
                  {college.totalSolvedProblems} problems solved by this college's students
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    viewStudents(college);
                  }}
                  className="mt-1 self-start flex items-center gap-1 text-xs text-[var(--foreground)] hover:text-[var(--foreground)] transition"
                >
                  <Users2 size={13} />
                  View students
                  <ExternalLink size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {collegesTotal > COLLEGES_PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 text-xs text-[var(--muted-foreground)]">
            <button
              disabled={collegesPage <= 1}
              onClick={() => setCollegesPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 rounded hover:bg-[var(--surface)] disabled:opacity-40"
            >
              ← Prev
            </button>
            <span>
              Page {collegesPage} of {Math.ceil(collegesTotal / COLLEGES_PAGE_SIZE)}
            </span>
            <button
              disabled={collegesPage >= Math.ceil(collegesTotal / COLLEGES_PAGE_SIZE)}
              onClick={() => setCollegesPage((p) => p + 1)}
              className="px-2 py-1 rounded hover:bg-[var(--surface)] disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <CollegeDetailDrawer
        college={selectedCollege}
        open={Boolean(selectedCollege)}
        onClose={() => setSelectedCollegeId(null)}
        onViewStudents={viewStudents}
        onRename={renameCollege}
        onSaveEmailRolePatterns={updateEmailRolePatterns}
      />
    </>
  );
}
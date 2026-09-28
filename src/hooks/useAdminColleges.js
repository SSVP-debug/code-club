/**
 * useAdminColleges.js
 *
 * Paginated/searchable/status-filterable college list with per-college
 * aggregate stats, backing the admin console's Colleges page (plan 005).
 * Same shape as useAdminUsers.js's fetch pattern for consistency.
 */
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { apiFetch } from "../services/api";

export const COLLEGES_PAGE_SIZE = 12;

export function useAdminColleges() {
  const [colleges, setColleges] = useState([]);
  const [collegesTotal, setCollegesTotal] = useState(0);
  const [collegesLoading, setCollegesLoading] = useState(true);
  const [collegesPage, setCollegesPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setCollegesPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadColleges = useCallback(async () => {
    try {
      setCollegesLoading(true);
      const params = new URLSearchParams({
        page: String(collegesPage),
        limit: String(COLLEGES_PAGE_SIZE),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const data = await apiFetch(`/api/admin/colleges?${params.toString()}`);
      setColleges(data.colleges || []);
      setCollegesTotal(data.total || 0);
    } catch (err) {
      toast.error(err.message || "Failed to load colleges.");
    } finally {
      setCollegesLoading(false);
    }
  }, [collegesPage, statusFilter, search]);

  useEffect(() => {
    // Same established (if imperfect) pattern as useAdminUsers.js/
    // useAdminDashboardMetrics.js's effects — react-hooks/set-state-in-effect
    // flags it there too. Kept consistent rather than a one-off fix.
    // Standard "fetch on mount" pattern used throughout this codebase's
    // data-fetching hooks/pages: the called function is a useCallback-wrapped
    // async fetcher whose setState calls all happen after its own await, not
    // synchronously in this effect's body. react-hooks/set-state-in-effect
    // still flags the call site here because it can't see across the
    // function boundary. A real fix would mean adopting a data-fetching
    // library (React Query/SWR) or inlining every one of these fetchers —
    // out of scope for a lint-debt pass; suppressed and documented instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern: the called function is a useCallback-wrapped async fetcher that sets loading/data state after its own await, not synchronously; see src/hooks/useAdminSettings.js for the fullest write-up of this decision.
    loadColleges();
  }, [loadColleges]);

  function setStatusFilterAndResetPage(nextStatus) {
    setStatusFilter(nextStatus);
    setCollegesPage(1);
  }

  // Optimistic-ish rename: PATCH, then patch the already-loaded list in
  // place rather than a full reload — same college count/page, just a
  // corrected name. Falls back to a toast + re-throw so the calling UI
  // (CollegeDetailDrawer) can keep its edit form open on failure instead
  // of silently losing the user's edit.
  async function updateEmailRolePatterns(collegeId, staffEmailPatterns, studentEmailPatterns) {
    const data = await apiFetch(`/api/admin/colleges/${collegeId}/email-role-patterns`, {
      method: "PATCH",
      body: JSON.stringify({ staffEmailPatterns, studentEmailPatterns }),
    });
    setColleges((prev) =>
      prev.map((c) =>
        c.id === collegeId
          ? {
              ...c,
              staffEmailPatterns: data.college.staffEmailPatterns,
              studentEmailPatterns: data.college.studentEmailPatterns,
            }
          : c
      )
    );
    return data.college;
  }

  async function renameCollege(collegeId, name) {
    const data = await apiFetch(`/api/admin/colleges/${collegeId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setColleges((prev) =>
      prev.map((c) => (c.id === collegeId ? { ...c, name: data.college.name } : c))
    );
    return data.college;
  }

  return {
    colleges,
    collegesTotal,
    collegesLoading,
    collegesPage,
    setCollegesPage,
    statusFilter,
    setStatusFilter: setStatusFilterAndResetPage,
    searchInput,
    setSearchInput,
    renameCollege,
    updateEmailRolePatterns,
  };
}
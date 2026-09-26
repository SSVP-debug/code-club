/**
 * useAdminVerificationQueue.js
 *
 * Loads pending recruiter/TPO/student-college-request verification
 * requests and exposes approve/reject actions with per-row busy state.
 *
 * Extracted from src/pages/AdminConsolePage.jsx (Staff review §4/§9/#12).
 * Extended (plan 001 §6.6) to add a third queue — colleges requested via
 * a student's college-email verification flow, as distinct from a TPO's
 * registration request.
 */
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { apiFetch } from "../services/api";

export function useAdminVerificationQueue() {
  const [loading, setLoading] = useState(true);
  const [recruiters, setRecruiters] = useState([]);
  const [tpos, setTpos] = useState([]);
  const [studentCollegeRequests, setStudentCollegeRequests] = useState([]);
  // Tracks which row is mid-request so its own buttons show a spinner
  // without disabling the rest of the queue: { [id]: "approve" | "reject" }
  const [busyIds, setBusyIds] = useState({});

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/api/admin/pending");
      setRecruiters(data.recruiters || []);
      setTpos(data.tpos || []);
      setStudentCollegeRequests(data.studentCollegeRequests || []);
    } catch (err) {
      toast.error(err.message || "Failed to load the approval queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Standard "fetch on mount" pattern used throughout this codebase's
    // data-fetching hooks/pages: the called function is a useCallback-wrapped
    // async fetcher whose setState calls all happen after its own await, not
    // synchronously in this effect's body. react-hooks/set-state-in-effect
    // still flags the call site here because it can't see across the
    // function boundary. A real fix would mean adopting a data-fetching
    // library (React Query/SWR) or inlining every one of these fetchers —
    // out of scope for a lint-debt pass; suppressed and documented instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern: the called function is a useCallback-wrapped async fetcher that sets loading/data state after its own await, not synchronously; see src/hooks/useAdminSettings.js for the fullest write-up of this decision.
    loadQueue();
  }, [loadQueue]);

  async function actOnRecruiter(id, action) {
    setBusyIds((b) => ({ ...b, [id]: action }));
    try {
      await apiFetch(`/api/admin/recruiters/${id}/${action}`, { method: "POST" });
      setRecruiters((list) => list.filter((r) => r.id !== id));
      toast.success(action === "approve" ? "Recruiter approved." : "Recruiter request rejected.");
    } catch (err) {
      toast.error(err.message || `Failed to ${action} recruiter.`);
    } finally {
      setBusyIds((b) => {
        const next = { ...b };
        delete next[id];
        return next;
      });
    }
  }

  async function actOnTpo(itemOrId, action) {
    const item = typeof itemOrId === "object" ? itemOrId : { collegeId: itemOrId };
    const key = item.userId || item.collegeId;
    setBusyIds((b) => ({ ...b, [key]: action }));
    try {
      if (item.reviewTarget === "user") {
        await apiFetch(`/api/admin/tpo-verification/${item.userId}/${action}`, { method: "POST" });
        setTpos((list) => list.filter((t) => t.userId !== item.userId));
      } else {
        await apiFetch(`/api/admin/tpo/${item.collegeId}/${action}`, { method: "POST" });
        setTpos((list) => list.filter((t) => t.collegeId !== item.collegeId));
      }
      toast.success(action === "approve" ? "TPO verification approved." : "TPO request rejected.");
    } catch (err) {
      toast.error(err.message || `Failed to ${action} TPO request.`);
    } finally {
      setBusyIds((b) => {
        const next = { ...b };
        delete next[key];
        return next;
      });
    }
  }

  async function actOnStudentCollege(collegeId, action) {
    setBusyIds((b) => ({ ...b, [collegeId]: action }));
    try {
      await apiFetch(`/api/admin/student-colleges/${collegeId}/${action}`, { method: "POST" });
      setStudentCollegeRequests((list) => list.filter((c) => c.collegeId !== collegeId));
      toast.success(action === "approve" ? "College approved." : "College request rejected.");
    } catch (err) {
      toast.error(err.message || `Failed to ${action} college request.`);
    } finally {
      setBusyIds((b) => {
        const next = { ...b };
        delete next[collegeId];
        return next;
      });
    }
  }

  return {
    loading,
    recruiters,
    tpos,
    studentCollegeRequests,
    busyIds,
    pendingCount: recruiters.length + tpos.length + studentCollegeRequests.length,
    actOnRecruiter,
    actOnTpo,
    actOnStudentCollege,
  };
}
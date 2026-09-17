import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { apiFetch } from "../services/api";
import PageMeta from "../components/seo/PageMeta";
import { SUPPORT_EMAIL } from "../config/site.js";
import DashboardLayout from "../layouts/DashboardLayout";
import Button from "../components/ui/Button";
import AuthGate from "../components/auth/AuthGate";
import { useIdentity } from "../hooks/useIdentity";
import { GraduationCap, Users, Flame } from "lucide-react";
import TpoTeamPanel from "../components/tpo/TpoTeamPanel";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const STUDENTS_PAGE_SIZE = 25; // matches the backend's default (backend/routes/tpo.js)
const STUDENT_SORT_OPTIONS = ["xp", "solved", "streak", "name"];
const STUDENT_SEARCH_DEBOUNCE_MS = 300;

function StatCard({ label, value, accent = "text-[var(--foreground)]" }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
      <p className={`text-3xl font-black ${accent}`}>{value}</p>
      <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function ReadinessGauge({ score }) {
  const color =
    score >= 70
      ? "var(--color-verdict-accept, #2dd4bf)"
      : score >= 40
      ? "var(--color-verdict-pending, #ffb454)"
      : "var(--color-verdict-reject, #ff5d5d)";
  const label = score >= 70 ? "Placement Ready" : score >= 40 ? "Building Momentum" : "Needs Attention";

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex items-center gap-6">
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-elevated)" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${(score / 100) * 264} 264`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-[var(--foreground)]">{score}</span>
        </div>
      </div>
      <div>
        <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-1">
          Placement Readiness Score
        </p>
        <p className="text-lg font-bold" style={{ color }}>{label}</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">Based on solve volume, hard-problem coverage, and weekly engagement.</p>
      </div>
    </div>
  );
}

function CreateAssignmentModal({ onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [slugsText, setSlugsText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const problemSlugs = slugsText.split(",").map(s => s.trim()).filter(Boolean);
    if (!title || problemSlugs.length === 0 || !dueDate) return;

    setSaving(true);
    try {
      await apiFetch("/api/tpo/assignments", {
        method: "POST",
        body: JSON.stringify({ title, problemSlugs, dueDate }),
      });
      onCreated();
      onClose();
    } catch {
      toast.error("Failed to create assignment.");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-[var(--foreground)] mb-4">New Assignment</h3>
        <div className="space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Assignment title (e.g. Week 3 — Arrays)"
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--theme-primary,#2dd4bf)]/50"
          />
          <textarea
            value={slugsText}
            onChange={e => setSlugsText(e.target.value)}
            placeholder="Problem slugs, comma-separated (e.g. two-sum, valid-parentheses)"
            rows={3}
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--theme-primary,#2dd4bf)]/50"
          />
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--theme-primary,#2dd4bf)]/50"
          />
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !title || !slugsText || !dueDate}
            loading={saving}
            className="flex-1"
          >
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TpoDashboardPage() {
  const VALID_TABS = ["overview", "students", "assignments", "team"];
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useIdentity();

  const [enabled, setEnabled] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  // Deep-linkable via ?tab=overview|students|assignments — falls back to
  // "overview" for anything missing or invalid.
  const [tab, setTabState] = useState(() => {
    const fromUrl = searchParams.get("tab");
    return VALID_TABS.includes(fromUrl) ? fromUrl : "overview";
  });

  function setTab(next) {
    setTabState(next);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("tab", next);
      return params;
    }, { replace: true });
  }

  const [showModal, setShowModal] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  // Student directory: search-as-typed (immediate, drives the input's own
  // value) vs. search-as-queried (debounced, what's actually sent to the
  // API) are deliberately separate — see the debounce effect below. All
  // three (page/search/sort) are seeded from the URL and kept in sync with
  // it, same "deep-linkable, refresh-safe" pattern as `tab` above, so a
  // shared link like ?tab=students&page=2&q=krishna&sort=name restores
  // exactly that view.
  const [studentSearchInput, setStudentSearchInput] = useState(() => searchParams.get("q") || "");
  const [studentSearch, setStudentSearch] = useState(() => searchParams.get("q") || "");
  const [studentSort, setStudentSort] = useState(() => {
    const fromUrl = searchParams.get("sort");
    return STUDENT_SORT_OPTIONS.includes(fromUrl) ? fromUrl : "xp"; // "xp" | "solved" | "streak" | "name"
  });
  const [studentPage, setStudentPage] = useState(() => {
    const fromUrl = parseInt(searchParams.get("page"), 10);
    return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : 1;
  });
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState(null);
  const [remindingId, setRemindingId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [dash, asn] = await Promise.all([
        apiFetch("/api/tpo/dashboard"),
        apiFetch("/api/tpo/assignments"),
      ]);

      if (dash.enabled === false) {
        setEnabled(false);
        setLoading(false);
        return;
      }

      setEnabled(true);
      setDashboard(dash);
      setAssignments(asn.assignments || []);
    } catch (err) {
      if (
        err.message ===
        "Your TPO account is pending verification."
      ) {
        setPendingVerification(true);
        return;
      }

      setEnabled(false);
    }
    setLoading(false);
  }, []);

  // Server-side paginated/searched/sorted student directory — the frontend
  // never downloads the full college roster, only the current page.
  // Deliberately a separate fetch/effect from fetchAll() above: it needs
  // to re-run on page/search/sort changes independently of the
  // dashboard/assignments data, which only load once.
  const fetchStudents = useCallback(async ({ page, q, sort }) => {
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(STUDENTS_PAGE_SIZE));
      params.set("sort", sort);
      if (q) params.set("q", q);

      const data = await apiFetch(`/api/tpo/students?${params.toString()}`);
      setStudents(data.students || []);
      setStudentTotal(data.total || 0);
    } catch (err) {
      if (err.message === "Your TPO account is pending verification.") {
        setPendingVerification(true);
        return;
      }
      setStudentsError(err.message || "Failed to load students.");
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  // Standard "fetch on mount" pattern used throughout this codebase's
  // data-fetching hooks/pages: the called function is a useCallback-wrapped
  // async fetcher whose setState calls all happen after its own await, not
  // synchronously in this effect's body. react-hooks/set-state-in-effect
  // still flags the call site here because it can't see across the
  // function boundary. A real fix would mean adopting a data-fetching
  // library (React Query/SWR) or inlining every one of these fetchers —
  // out of scope for a lint-debt pass; suppressed and documented instead.
  // Guest Mode: this page has no meaningful "shell" independent of student/
  // college data — StatCards, the readiness gauge, the student list, and
  // assignments ARE the page. Rather than fabricate a partial layout that
  // isn't part of the existing design, a guest sees this single AuthGate
  // in the normal chrome instead, and fetchAll() below never runs, so no
  // /api/tpo/* request is even attempted (the backend's own requireAuth +
  // requireRole + requireVerified on these routes — backend/routes/tpo.js
  // — remains the actual authorization boundary regardless).
  useEffect(() => {
    if (!isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern: the called function is a useCallback-wrapped async fetcher that sets loading/data state after its own await, not synchronously; see src/hooks/useAdminSettings.js for the fullest write-up of this decision.
    fetchAll();
  }, [fetchAll, isAuthenticated]);

  // Debounces the search box: only commits `studentSearchInput` to
  // `studentSearch` (the value actually sent to the API — see the effect
  // below) after the user pauses typing, rather than firing a request on
  // every keystroke. Guarded against running on the very first render so
  // restoring `page` from a shared/refreshed URL (e.g. ?page=3&q=krishna)
  // isn't immediately clobbered back to page 1 before the user has typed
  // anything.
  const isFirstSearchRender = useRef(true);
  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setStudentSearch(studentSearchInput);
      setStudentPage(1); // a changed search always starts back at page 1
    }, STUDENT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [studentSearchInput]);

  function changeStudentSort(next) {
    setStudentSort(next);
    setStudentPage(1); // a changed sort always starts back at page 1
  }

  // Fetches the current page of students whenever page/search/sort change
  // — including the very first time, on mount, which is why this effect
  // (not fetchAll above) owns the initial students load.
  useEffect(() => {
    if (!isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same fetch-on-mount/fetch-on-change pattern as fetchAll() above.
    fetchStudents({ page: studentPage, q: studentSearch, sort: studentSort });
  }, [fetchStudents, isAuthenticated, studentPage, studentSearch, studentSort]);

  // Keeps the URL in sync with page/search/sort — same deep-linkable,
  // refresh-safe pattern setTab() already uses for `tab`. Best-effort only:
  // never blocks rendering or the fetch above on this succeeding.
  useEffect(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      studentPage > 1 ? params.set("page", String(studentPage)) : params.delete("page");
      studentSearch ? params.set("q", studentSearch) : params.delete("q");
      studentSort !== "xp" ? params.set("sort", studentSort) : params.delete("sort");
      return params;
    }, { replace: true });
  }, [studentPage, studentSearch, studentSort, setSearchParams]);

  const [downloadingReport, setDownloadingReport] = useState(false);

  async function downloadReportPDF() {
    setDownloadingReport(true);
    try {
      const { getIdToken } = await import("../services/auth");
      const token = await getIdToken();
      const response = await fetch(`${API_URL}/api/tpo/report/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Report generation failed. Try again in a moment.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "codeclub_class_report.pdf"; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || "Failed to download report.");
    } finally {
      setDownloadingReport(false);
    }
  }

  // Search/sort/pagination now all happen server-side (see fetchStudents
  // above) — `students` is already exactly the page to render, no local
  // filter/sort derivation needed.
  const visibleStudents = students;
  const totalStudentPages = Math.max(1, Math.ceil(studentTotal / STUDENTS_PAGE_SIZE));

  async function remindIncomplete(assignmentId) {
    setRemindingId(assignmentId);
    try {
      const data = await apiFetch(`/api/tpo/assignments/${assignmentId}/remind`, { method: "POST" });
      toast.success(
        data.remindedCount > 0
          ? `Reminded ${data.remindedCount} student${data.remindedCount === 1 ? "" : "s"}.`
          : data.message
      );
    } catch (err) {
      toast.error(err.message || "Failed to send reminder.");
    }
    setRemindingId(null);
  }

  if (pendingVerification) {
    return (
      <DashboardLayout>
        <PageMeta title="Verification Pending · Code Club TPO" path="/tpo/dashboard" />
        <div className="flex items-center justify-center px-6 py-24">
          <div className="max-w-lg text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--muted-foreground)] flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={28} strokeWidth={2} aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-black text-[var(--foreground)]">
              College Verification Pending
            </h1>

            <p className="mt-4 text-[var(--muted-foreground)]">
              Your college registration request has been submitted successfully.
            </p>

            <p className="text-[var(--muted-foreground)]">
              Access will be enabled after an administrator verifies your institution.
            </p>

            <p className="text-[var(--muted-foreground)] text-sm mt-6">
              Questions in the meantime? Reach out to {SUPPORT_EMAIL}.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Guest Mode: this page has no meaningful "shell" independent of
  // student/college data — StatCards, the readiness gauge, the student
  // list, and assignments ARE the page content. Rather than fabricate a
  // partial layout that isn't part of the existing design, a guest sees
  // this single AuthGate in the normal chrome instead. fetchAll() above
  // never runs for a guest (see that effect's guard), so no /api/tpo/*
  // request is even attempted — the backend's own requireAuth +
  // requireRole + requireVerified on those routes (backend/routes/tpo.js)
  // remains the actual authorization boundary regardless.
  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <PageMeta title="TPO Portal · Code Club" path="/tpo/dashboard" />
        <div className="max-w-2xl mx-auto py-12">
          <AuthGate reason="studentData" />
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-[var(--theme-primary,#2dd4bf)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (enabled === false) {
    return (
      <DashboardLayout>
        <PageMeta title="College Dashboard Coming Soon · Code Club" path="/tpo/dashboard" />
        <div className="flex items-center justify-center px-4 py-24">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-verdict-accept/10 text-verdict-accept flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={30} strokeWidth={2} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-3">College Dashboard Coming Soon</h1>
            <p className="text-[var(--muted-foreground)] text-sm">
              We're rolling out the College Admin dashboard gradually. Reach out to
              {" "}{SUPPORT_EMAIL} to get early access for your institution.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboard || dashboard.totalStudents === 0) {
    return (
      <DashboardLayout>
        <PageMeta title="College Dashboard · Code Club" path="/tpo/dashboard" />
        <div className="flex items-center justify-center px-4 py-24">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-[var(--surface-elevated)] text-[var(--muted-foreground)] flex items-center justify-center mx-auto mb-4">
              <Users size={30} strokeWidth={2} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-3">No students yet</h1>
            <p className="text-[var(--muted-foreground)] text-sm">
              Once students from {dashboard?.domain || "your college"} sign up with their
              institutional email, you'll see their stats here.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageMeta title="College Dashboard · Code Club" path="/tpo/dashboard" />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary,#2dd4bf)]/10 text-[var(--theme-primary,#2dd4bf)] flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <GraduationCap size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-[var(--foreground)] truncate">{dashboard.college}</h1>
              <p className="text-[var(--muted-foreground)] text-sm">{dashboard.domain} · {dashboard.totalStudents} students</p>
            </div>
          </div>
          <button
            onClick={downloadReportPDF}
            disabled={downloadingReport}
            className="self-start px-4 py-2 bg-[var(--surface)] border border-[var(--border-strong)] hover:border-[var(--muted-foreground)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--foreground)] hover:text-[var(--foreground)] rounded-xl text-sm font-medium transition flex-shrink-0"
          >
            {downloadingReport ? "Preparing…" : "⬇ Download Report"}
          </button>
        </div>

        {/* Tabs — horizontally scrollable instead of wrapping/overflowing:
            three tabs at full label width ("Overview"/"Students"/
            "Assignments") don't reliably fit a 375px viewport next to each
            other, and wrapping to a second line pushes content down
            awkwardly for just one overflow tab. */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {["overview", "students", "assignments", "team"].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition flex-shrink-0 ${tab === t ? "bg-[var(--theme-primary,#2dd4bf)] text-black" : "bg-[var(--surface)] text-[var(--muted-foreground)] border border-[var(--border)]"
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-6">
            <ReadinessGauge score={dashboard.readinessScore} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Avg Solved/Student" value={dashboard.avgSolved} accent="text-green-400" />
              <StatCard label="Active This Week" value={`${dashboard.activePercent}%`} accent="text-orange-400" />
              <StatCard label="Total Solves" value={dashboard.totalSolved} />
              <StatCard label="Hard Problems Solved" value={dashboard.difficultyBreakdown.hard} accent="text-red-400" />
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-4">Topic Coverage</h3>
              {dashboard.topicCoverage.length === 0 ? (
                <p className="text-[var(--muted-foreground)] text-sm">No topic-tagged solves yet.</p>
              ) : (
                <div className="space-y-2">
                  {dashboard.topicCoverage.map(t => (
                    <div key={t.topic} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--foreground)] w-24 sm:w-40 truncate">{t.topic}</span>
                      <div className="flex-1 h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--theme-primary,#2dd4bf)] rounded-full"
                          style={{ width: `${Math.min(100, (t.totalSolves / dashboard.topicCoverage[0].totalSolves) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)] w-10 text-right">{t.totalSolves}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "students" && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
              <input
                value={studentSearchInput}
                onChange={e => setStudentSearchInput(e.target.value)}
                placeholder="Search by name or email…"
                className="flex-1 min-w-[200px] bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--theme-primary,#2dd4bf)]/50"
              />
              <select
                value={studentSort}
                onChange={e => changeStudentSort(e.target.value)}
                className="bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--theme-primary,#2dd4bf)]/50"
              >
                <option value="xp">Sort: XP</option>
                <option value="solved">Sort: Solved</option>
                <option value="streak">Sort: Streak</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
              <span className="flex-1">Student</span>
              <span className="w-20 text-right">Solved</span>
              <span className="w-20 text-right">Streak</span>
              <span className="w-20 text-right">XP</span>
            </div>
            {/* Keeps the previous page's rows visible (dimmed) while a new
                page/search/sort loads, instead of flashing to a blank
                table — makes it obvious a request is in flight without
                losing your place. */}
            <div className={`divide-y divide-[var(--border)] max-h-[600px] overflow-y-auto transition-opacity ${studentsLoading ? "opacity-50" : ""}`}>
              {studentsError ? (
                <p className="text-center text-red-400 py-12 text-sm">
                  {studentsError} —{" "}
                  <button
                    onClick={() => fetchStudents({ page: studentPage, q: studentSearch, sort: studentSort })}
                    className="underline hover:text-red-300"
                  >
                    Try again
                  </button>
                </p>
              ) : visibleStudents.length === 0 && studentsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-[var(--theme-primary,#2dd4bf)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : visibleStudents.length === 0 ? (
                <p className="text-center text-[var(--muted-foreground)] py-12 text-sm">
                  {studentSearch
                    ? `No students match "${studentSearch}".`
                    : "No students are currently registered with your institution."}
                </p>
              ) : visibleStudents.map(s => (
                  // Flex-wraps into a compact stat row on mobile instead of
                  // squeezing three fixed 80px columns next to the name —
                  // that made the name unreadable below ~400px.
                  <div key={s.email} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 px-4 py-3">
                    <span className="text-sm text-[var(--foreground)] truncate sm:flex-1">{s.name}</span>
                    <div className="flex items-center gap-4 sm:contents">
                      <span className="text-xs text-[var(--muted-foreground)] sm:w-20 sm:text-right sm:text-sm sm:text-[var(--muted-foreground)]">
                        <span className="sm:hidden">Solved </span>{s.solvedCount}
                      </span>
                      <span className="text-xs text-orange-400 sm:w-20 sm:text-right sm:text-sm">
                        {s.currentStreak > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Flame size={13} strokeWidth={2} aria-hidden="true" />
                            {s.currentStreak}
                          </span>
                        ) : "—"}
                      </span>
                      <span className="text-xs sm:w-20 sm:text-right sm:text-sm text-[var(--theme-primary,#2dd4bf)] font-semibold">
                        <span className="text-[var(--muted-foreground)] sm:hidden">XP </span>{s.totalXP}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
            {!studentsError && studentTotal > 0 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--border)] text-sm">
                <span className="text-[var(--muted-foreground)] text-xs">
                  Page {studentPage} of {totalStudentPages} · {studentTotal} student{studentTotal === 1 ? "" : "s"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                    disabled={studentPage <= 1 || studentsLoading}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-strong)] text-[var(--foreground)] text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))}
                    disabled={studentPage >= totalStudentPages || studentsLoading}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-strong)] text-[var(--foreground)] text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "assignments" && (
          <div>
            <Button
              onClick={() => setShowModal(true)}
              className="mb-4"
            >
              + New Assignment
            </Button>
            <div className="space-y-3">
              {assignments.length === 0 ? (
                <p className="text-[var(--muted-foreground)] text-sm text-center py-12">No assignments yet. Create one above.</p>
              ) : (
                assignments.map(a => (
                  <div key={a._id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <h4 className="font-semibold text-[var(--foreground)]">{a.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${a.isOverdue ? "bg-red-500/10 text-red-400" : "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]"
                        }`}>
                        Due {new Date(a.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mb-3">{a.problemSlugs.length} problems</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex-1 min-w-[80px] h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--theme-primary,#2dd4bf)]" style={{ width: `${a.completionPercent}%` }} />
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">{a.completedCount}/{a.totalStudents} done</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => remindIncomplete(a._id)}
                        disabled={remindingId === a._id}
                      >
                        {remindingId === a._id ? "Sending…" : "Remind incomplete"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "team" && <TpoTeamPanel />}
      </div>

      {showModal && (
        <CreateAssignmentModal onClose={() => setShowModal(false)} onCreated={fetchAll} />
      )}
    </DashboardLayout>
  );
}
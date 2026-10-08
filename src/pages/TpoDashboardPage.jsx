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
import TpoCohortsPanel from "../components/tpo/TpoCohortsPanel";
import TpoReportsPanel from "../components/tpo/TpoReportsPanel";
import TpoBillingPanel from "../components/tpo/TpoBillingPanel";

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
  const [target, setTarget] = useState("college");
  const [cohortId, setCohortId] = useState("");
  const [cohorts, setCohorts] = useState([]);
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [slugsText, setSlugsText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target !== "cohort") return;
    setLoadingCohorts(true);
    apiFetch("/api/tpo/cohorts?status=active&limit=100")
      .then((data) => setCohorts(data.items || []))
      .catch(() => toast.error("Failed to load cohorts."))
      .finally(() => setLoadingCohorts(false));
  }, [target]);

  async function handleCreate() {
    const problemSlugs = slugsText.split(",").map(s => s.trim()).filter(Boolean);
    if (!title || problemSlugs.length === 0 || !dueDate) return;
    if (target === "cohort" && !cohortId) return;

    setSaving(true);
    try {
      await apiFetch("/api/tpo/assignments", {
        method: "POST",
        body: JSON.stringify({ title, problemSlugs, dueDate, cohortId: target === "cohort" ? cohortId : null }),
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
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Target students</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTarget("college")} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${target === "college" ? "border-[var(--theme-primary,#2dd4bf)] bg-[var(--theme-primary,#2dd4bf)]/10 text-[var(--foreground)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}>Entire college</button>
              <button type="button" onClick={() => setTarget("cohort")} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${target === "cohort" ? "border-[var(--theme-primary,#2dd4bf)] bg-[var(--theme-primary,#2dd4bf)]/10 text-[var(--foreground)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}>Specific cohort</button>
            </div>
            {target === "cohort" && (
              <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} disabled={loadingCohorts} aria-label="Assignment cohort" className="w-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]">
                <option value="">{loadingCohorts ? "Loading cohorts…" : "Select a cohort"}</option>
                {cohorts.map((cohort) => <option key={cohort.id || cohort._id} value={cohort.id || cohort._id}>{cohort.name}{cohort.branch ? ` · ${cohort.branch}` : ""}{cohort.graduatingYear ? ` · ${cohort.graduatingYear}` : ""}</option>)}
              </select>
            )}
          </div>
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
            disabled={saving || !title || !slugsText || !dueDate || (target === "cohort" && !cohortId)}
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
  const VALID_TABS = ["overview", "reports", "students", "assignments", "cohorts", "team", "billing"];
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useIdentity();

  const [enabled, setEnabled] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [studentCursorHistory, setStudentCursorHistory] = useState([]);
  const [studentNextCursor, setStudentNextCursor] = useState(null);
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
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
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
  const [studentPage, setStudentPage] = useState(1);
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

      if (err.status === 402 || err.body?.code === "INSTITUTION_SUBSCRIPTION_REQUIRED") {
        setEnabled(true);
        setSubscriptionRequired(true);
        setLoading(false);
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
  const fetchStudents = useCallback(async ({ page, q, sort, cursor = null }) => {
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(STUDENTS_PAGE_SIZE));
      params.set("sort", sort);
      if (q) params.set("q", q);
      if (cursor) params.set("cursor", cursor);

      const data = await apiFetch(`/api/tpo/students?${params.toString()}`);
      setStudents(data.students || []);
      setStudentNextCursor(data.nextCursor || null);
      setStudentPage(page);
    } catch (err) {
      setStudentsError(err.message || "Failed to load students.");
    } finally {
      setStudentsLoading(false);
    }
  }, []);
}
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Users, Target, Layers3, RefreshCw } from "lucide-react";
import { apiFetch } from "../../services/api";
import Button from "../ui/Button";

function MetricCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest">{label}</p>
        {Icon ? <Icon size={17} className="text-[var(--muted-foreground)]" aria-hidden="true" /> : null}
      </div>
      <p className="text-3xl font-black text-[var(--foreground)] mt-2">{value}</p>
      {hint ? <p className="text-xs text-[var(--muted-foreground)] mt-1">{hint}</p> : null}
    </div>
  );
}

function DifficultyBars({ difficulty }) {
  const rows = [
    ["Easy", difficulty?.easy || 0],
    ["Medium", difficulty?.medium || 0],
    ["Hard", difficulty?.hard || 0],
  ];
  const max = Math.max(1, ...rows.map(([, value]) => value));

  return (
    <div className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-16 text-sm text-[var(--foreground)]">{label}</span>
          <div className="flex-1 h-2.5 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--theme-primary,#2dd4bf)] rounded-full"
              style={{ width: `${Math.round((value / max) * 100)}%` }}
            />
          </div>
          <span className="w-12 text-right text-xs text-[var(--muted-foreground)]">{value}</span>
        </div>
      ))}
    </div>
  );
}

function CohortBreakdownSection({ cohorts, unassignedCount }) {
  if (!cohorts || cohorts.length === 0) return null;

  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-5">
        Cohort Breakdown
      </h3>
      <div className="space-y-3">
        {cohorts.map((cohort) => (
          <div
            key={cohort.cohortId}
            className="bg-[var(--surface-elevated)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {cohort.name}
                {cohort.section ? ` · ${cohort.section}` : ""}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {cohort.branch} · Batch {cohort.graduatingYear} · {cohort.memberCount} student{cohort.memberCount === 1 ? "" : "s"}
              </p>
              {cohort.topTopics?.length ? (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Top topics: {cohort.topTopics.map((t) => t.topic).join(", ")}
                </p>
              ) : null}
            </div>
            <div className="flex gap-4 text-right shrink-0">
              <div>
                <p className="text-lg font-black text-[var(--foreground)]">{cohort.averageSolved}</p>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">Avg solved</p>
              </div>
              <div>
                <p className="text-lg font-black text-[var(--foreground)]">{cohort.activePercent}%</p>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">Active</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {unassignedCount > 0 ? (
        <p className="text-xs text-[var(--muted-foreground)] mt-4">
          {unassignedCount} visible student{unassignedCount === 1 ? "" : "s"} not yet assigned to a cohort.
        </p>
      ) : null}
    </section>
  );
}

export default function TpoReportsPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async (range = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set("from", `${range.from}T00:00:00.000Z`);
      if (range.to) params.set("to", `${range.to}T23:59:59.999Z`);
      const data = await apiFetch(`/api/tpo/report/overview${params.toString() ? `?${params}` : ""}`);
      setReport(data);
    } catch (err) {
      setError(err.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function applyRange() {
    if ((from && !to) || (!from && to) || (from && to && from > to)) {
      setError("Choose a valid start and end date.");
      return;
    }
    fetchReport({ from, to });
  }

  if (loading && !report) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-7 h-7 border-2 border-[var(--theme-primary,#2dd4bf)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="secondary" className="mt-4" onClick={() => fetchReport()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!report) return null;

  const { students, problems, cohorts, assignments, cohortBreakdown, unassignedStudents } = report;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[var(--foreground)]">Institution Report</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Placement-preparation activity for {report.college}.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-[var(--muted-foreground)]">
            From
            <input
              aria-label="Report start date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="block mt-1 bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
            />
          </label>
          <label className="text-xs text-[var(--muted-foreground)]">
            To
            <input
              aria-label="Report end date"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="block mt-1 bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
            />
          </label>
          <Button onClick={applyRange} disabled={loading}>
            {loading ? "Refreshing…" : "Apply"}
          </Button>
          <button
            type="button"
            aria-label="Refresh report"
            onClick={() => fetchReport({ from, to })}
            disabled={loading}
            className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Visible Students" value={students.total} hint={`${students.active} active · ${students.activePercent}%`} icon={Users} />
        <MetricCard label="Total Solves" value={problems.totalSolved} hint={`Avg ${problems.averageSolved} per student`} icon={BarChart3} />
        <MetricCard label="Active Cohorts" value={cohorts.active} hint={`${cohorts.total} total · ${cohorts.archived} archived`} icon={Layers3} />
        <MetricCard label="Assignment Completion" value={`${assignments.completionPercent}%`} hint={`${assignments.completedAssignments} completed student-assignment pairs`} icon={Target} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-5">
            Problem Difficulty
          </h3>
          <DifficultyBars difficulty={problems.difficulty} />
        </section>

        <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-5">
            Assignment Activity
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--surface-elevated)] rounded-xl p-4">
              <p className="text-2xl font-black text-[var(--foreground)]">{assignments.total}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Assignments</p>
            </div>
            <div className="bg-[var(--surface-elevated)] rounded-xl p-4">
              <p className="text-2xl font-black text-[var(--foreground)]">{assignments.active}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Active</p>
            </div>
            <div className="bg-[var(--surface-elevated)] rounded-xl p-4">
              <p className="text-2xl font-black text-[var(--foreground)]">{assignments.assignedStudents}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Student targets</p>
            </div>
          </div>
        </section>
      </div>

      <CohortBreakdownSection cohorts={cohortBreakdown} unassignedCount={unassignedStudents?.count || 0} />

      {students.optedOut > 0 ? (
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-2xl px-5 py-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {students.optedOut} student{students.optedOut === 1 ? "" : "s"} opted out of TPO visibility.
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Performance metrics above exclude those students. This keeps the report transparent without exposing students who chose not to appear in the TPO view.
          </p>
        </div>
      ) : null}

      <p className="text-xs text-[var(--muted-foreground)]">
        Report period: {new Date(report.range.from).toLocaleDateString()} — {new Date(report.range.to).toLocaleDateString()}
      </p>
    </div>
  );
}

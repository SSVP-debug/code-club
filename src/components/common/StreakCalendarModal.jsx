import { useEffect, useMemo, useState } from "react";
import { Flame, X, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Local-date (not UTC) YYYY-MM-DD — matches how `activityDates` entries are
// produced in AppContext (see appContext.jsx's `today` computation), so a
// day solved right around midnight lines up with the same calendar cell
// the user actually solved it on, rather than shifting a day under UTC.
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * StreakCalendarModal
 *
 * Opened by clicking the Flame streak badge (see StreakBadge.jsx). Renders
 * a real month calendar (not the 91-day GitHub-style heatmap
 * ActivityHeatmapCard already owns on the dashboard) so a user can see
 * exactly which days their streak covers and browse past months. Built
 * from `activityDates`, the same AppContext field the heatmap reads — no
 * new backend endpoint needed.
 */
function StreakCalendarModal({ streak, longestStreak, activityDates, onClose }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const activeSet = useMemo(() => new Set(activityDates || []), [activityDates]);
  const todayISO = useMemo(() => toISODate(new Date()), []);

  const { weeks, monthLabel, isCurrentMonth, activeInMonth } = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = firstOfMonth.getDay();

    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toISODate(new Date(year, month, day));
      cells.push({ iso, day, active: activeSet.has(iso), isToday: iso === todayISO });
    }

    const padded = [...Array.from({ length: leadingBlanks }, () => null), ...cells];
    while (padded.length % 7 !== 0) padded.push(null);

    const weekRows = [];
    for (let i = 0; i < padded.length; i += 7) {
      weekRows.push(padded.slice(i, i + 7));
    }

    const now = new Date();

    return {
      weeks: weekRows,
      monthLabel: firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      isCurrentMonth: year === now.getFullYear() && month === now.getMonth(),
      activeInMonth: cells.filter((c) => c.active).length,
    };
  }, [viewDate, activeSet, todayISO]);

  function goToPrevMonth() {
    setViewDate((d) => {
      const next = new Date(d);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  }

  function goToNextMonth() {
    if (isCurrentMonth) return;
    setViewDate((d) => {
      const next = new Date(d);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Streak activity calendar"
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <Flame size={18} strokeWidth={2.5} className="text-orange-400" aria-hidden="true" />
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              {streak > 0 ? `${streak}-day streak` : "No active streak"}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition p-1 -m-1 rounded-lg"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <p className="text-[var(--muted-foreground)] text-sm mb-5">
          {longestStreak > streak
            ? `Longest streak: ${longestStreak} day${longestStreak === 1 ? "" : "s"}`
            : longestStreak > 0
            ? "Personal best streak — keep it going!"
            : "Solve a problem today to start a streak."}
        </p>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={goToPrevMonth}
            aria-label="Previous month"
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <span className="text-sm font-semibold text-[var(--foreground)]">{monthLabel}</span>
          <button
            onClick={goToNextMonth}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="text-center text-[10px] text-[var(--muted-foreground)] uppercase"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((cell, di) =>
                cell ? (
                  <div
                    key={cell.iso}
                    title={cell.iso}
                    className={`aspect-square rounded-lg flex items-center justify-center ${
                      cell.isToday ? "ring-2 ring-orange-400" : ""
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                        cell.active
                          ? "bg-orange-500/15 text-orange-400"
                          : "text-[var(--muted-foreground)]"
                      }`}
                    >
                      {cell.day}
                    </span>
                  </div>
                ) : (
                  <div key={`blank-${di}`} />
                )
              )}
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
          <span>
            {activeInMonth} active day{activeInMonth === 1 ? "" : "s"} this month
          </span>
          <span>{(activityDates || []).length} total</span>
        </div>
      </div>
    </div>
  );
}

export default StreakCalendarModal;
import { useEffect, useMemo, useState } from "react";
import { Flame, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// `activityDates` entries are UTC ISO dates — `new Date().toISOString()
// .split("T")[0]`, see appContext.jsx's markProblemSolved() — not local
// calendar dates. ActivityHeatmapCard.jsx matches against that same UTC
// slice for the same reason. Building this grid from local-date strings
// instead would silently show 0 active days for anyone west of UTC (the
// stored date is "tomorrow" relative to their local calendar) or shift
// which cell lights up for anyone whose day rolls over off in either
// direction — matching the UTC slice everywhere keeps this calendar and
// the dashboard heatmap agreeing on the same set of active days.
function toUTCISODate(date) {
  return date.toISOString().split("T")[0];
}

/**
 * StreakCalendarPopover
 *
 * Opened by clicking the Flame streak badge (see StreakBadge.jsx).
 * Anchored directly under the badge as a dropdown — not a full-screen
 * modal — so it reads as "more detail about this badge" rather than
 * taking over the whole dashboard. Same open/close plumbing
 * (ref + click-outside + Escape) AvatarDropdown.jsx already uses for its
 * own anchored panel.
 *
 * Renders a real month calendar (not the 91-day GitHub-style heatmap
 * ActivityHeatmapCard already owns on the dashboard) so a user can see
 * exactly which days their streak covers and browse past months. Built
 * from `activityDates`, the same AppContext field the heatmap reads — no
 * new backend endpoint needed.
 */
function StreakCalendarPopover({ streak, longestStreak, activityDates, onClose }) {
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
  const todayISO = useMemo(() => toUTCISODate(new Date()), []);

  const { weeks, monthLabel, isCurrentMonth, activeInMonth } = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = firstOfMonth.getDay();

    const cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toUTCISODate(new Date(Date.UTC(year, month, day)));
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
      role="dialog"
      aria-modal="false"
      aria-label="Streak activity calendar"
      className="absolute right-0 top-full mt-3 w-72 sm:w-80 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl p-5"
    >
      <div className="flex items-center gap-2 mb-1">
        <Flame size={16} strokeWidth={2.5} className="text-orange-400 flex-shrink-0" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[var(--foreground)]">
          {streak > 0 ? `${streak}-day streak` : "No active streak"}
        </h3>
      </div>
      <p className="text-[var(--muted-foreground)] text-xs mb-4">
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
          <ChevronLeft size={15} strokeWidth={2} />
        </button>
        <span className="text-xs font-semibold text-[var(--foreground)]">{monthLabel}</span>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          aria-label="Next month"
          className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <ChevronRight size={15} strokeWidth={2} />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[9px] text-[var(--muted-foreground)] uppercase">
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
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold ${
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
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--muted-foreground)]">
        <span>
          {activeInMonth} active day{activeInMonth === 1 ? "" : "s"} this month
        </span>
        <span>{(activityDates || []).length} total</span>
      </div>
    </div>
  );
}

export default StreakCalendarPopover;
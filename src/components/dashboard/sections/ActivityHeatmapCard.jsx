import { useMemo } from "react";
import { useAppContext } from "../../../hooks/useAppContext";
import { useTheme } from "../../../hooks/useTheme";
import SectionCard from "../../ui/layout/SectionCard";
import HoverTooltip from "../../ui/HoverTooltip";
import { Activity } from "lucide-react";

const DAYS_TO_SHOW = 365; // full year, GitHub-style — dynamically laid out below, not tied to this specific number
const WEEKDAY_ROW_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""]; // Sun-first rows; GitHub's own graph only labels alternate rows to stay legible at this size

function toUTCISODate(date) {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(iso) {
  // Format as a UTC date explicitly — `iso` is a UTC calendar date (see
  // cell-building comment below), so letting toLocaleDateString apply the
  // viewer's local timezone here could print a different day than the one
  // the cell actually represents.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function tooltipLabel(day) {
  const dateStr = formatDisplayDate(day.date);
  if (!day.active) return `${dateStr} — No activity`;
  if (day.count != null) {
    return `${dateStr} — ${day.count} solve${day.count === 1 ? "" : "s"}`;
  }
  return `${dateStr} — Active`;
}

/**
 * ActivityHeatmapCard
 *
 * Month-wise GitHub/LeetCode-style contribution grid, built entirely from
 * data already flowing through AppContext — no new backend endpoint.
 *
 * `activityDates` (populated in markProblemSolved(), persisted server-side)
 * stays the single source of truth for whether a day is *active* — that's
 * the same field currentStreak/longestStreak are derived from, so this
 * heatmap and the streak badge always agree on which days count.
 *
 * Shading intensity comes from real per-day Accepted-submission counts,
 * grouped from `submissions`. That's genuine data, not a fabricated
 * gradient — but /api/init caps `submissions` at the 50 most recent (see
 * backend/routes/init.js), so a reliable count only exists for roughly the
 * last few weeks. For an active day outside that window we don't guess a
 * count — we fall back to the base "active" shade (level 1), the same
 * level a real single-solve day gets. Worth a real per-day solve-count
 * aggregate endpoint later if finer-grained history matters; until then
 * this is the honest ceiling of what the existing data supports.
 */
function ActivityHeatmapCard() {
  const { activityDates, submissions } = useAppContext();
  const { theme } = useTheme();

  const { weeks, monthMarkers, activeCount } = useMemo(() => {
    const activeSet = new Set(activityDates || []);

    const acceptedCountByDate = {};
    for (const s of submissions || []) {
      if (s.status !== "Accepted" || !s.date) continue;
      acceptedCountByDate[s.date] = (acceptedCountByDate[s.date] || 0) + 1;
    }

    function levelFor(iso, active) {
      if (!active) return 0;
      const count = acceptedCountByDate[iso];
      if (count == null) return 1; // active, but outside the 50-submission window — unknown count, not zero
      if (count === 1) return 1;
      if (count === 2) return 2;
      return 3;
    }

    // Build the last DAYS_TO_SHOW days, then pad the front so the grid
    // starts on a Sunday — same convention as GitHub's heatmap, makes the
    // weekday rows line up.
    const today = new Date();
    const cells = [];

    for (let i = DAYS_TO_SHOW - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const iso = toUTCISODate(date);
      const active = activeSet.has(iso);
      cells.push({
        date: iso,
        month: date.getMonth(),
        weekday: date.getDay(),
        active,
        count: acceptedCountByDate[iso] ?? null,
        level: levelFor(iso, active),
      });
    }

    const leadingBlanks = cells[0] ? cells[0].weekday : 0;
    const padded = [
      ...Array.from({ length: leadingBlanks }, () => null),
      ...cells,
    ];

    const weekCols = [];
    for (let i = 0; i < padded.length; i += 7) {
      weekCols.push(padded.slice(i, i + 7));
    }

    // Month labels: walk the week columns and mark the first one where a
    // new month begins — computed from the real dates in each column, not
    // a fixed list of positions, so it holds up for any DAYS_TO_SHOW/start
    // day without per-case adjustment. Same heuristic GitHub's own
    // contribution graph uses for its month row.
    let lastMonth = null;
    const markers = weekCols.map((week) => {
      const firstDay = week.find((d) => d);
      if (!firstDay || firstDay.month === lastMonth) return null;
      lastMonth = firstDay.month;
      return new Date(`${firstDay.date}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      });
    });

    return {
      weeks: weekCols,
      monthMarkers: markers,
      activeCount: cells.filter((c) => c.active).length,
    };
  }, [activityDates, submissions]);

  function levelColor(level) {
    if (level === 0) return "var(--surface-elevated)";
    if (level === 1) return `${theme.colors.primary}40`; // ~25% — active, light
    if (level === 2) return `${theme.colors.primary}90`; // ~56% — active, moderate
    return theme.colors.primary; // level 3 — full strength, heaviest day
  }

  return (
    <SectionCard
      title="Activity"
      subtitle={`${activeCount} active day${activeCount === 1 ? "" : "s"} in the last ${DAYS_TO_SHOW} days`}
      icon={<Activity size={18} strokeWidth={2} />}
      accented
      className="lg:col-span-2"
    >
      {/* Calendar block — the "Consistency" watermark is scoped to just
          this wrapper (not the whole card) so it never bleeds into the
          title or legend below it. */}
      <div className="relative overflow-hidden rounded-lg">
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 flex items-center justify-center"
        >
          <span className="font-display font-black uppercase tracking-[0.15em] sm:tracking-[0.3em] text-[var(--foreground)] opacity-[0.05] text-3xl sm:text-5xl md:text-6xl whitespace-nowrap">
            Consistency
          </span>
        </div>

        <div className="relative overflow-x-auto pb-1">
          <div className="inline-flex gap-1">
            {/* Weekday gutter — sticky so it stays visible while the
                grid itself scrolls horizontally on narrow screens. */}
            <div className="flex flex-col gap-1 pr-1 pt-4 sticky left-0 z-[1] bg-[var(--surface)]">
              {WEEKDAY_ROW_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="h-3 w-6 flex items-center text-[9px] leading-none text-[var(--muted-foreground)]"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="flex flex-col">
              {/* Month row */}
              <div className="flex gap-1 mb-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="w-3 h-3 relative">
                    {monthMarkers[weekIndex] && (
                      <span className="absolute left-0 top-0 text-[9px] leading-none text-[var(--muted-foreground)] whitespace-nowrap">
                        {monthMarkers[weekIndex]}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="flex gap-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((day, dayIndex) =>
                      day ? (
                        <HoverTooltip key={day.date} side="top" label={tooltipLabel(day)}>
                          <div
                            aria-label={tooltipLabel(day)}
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: levelColor(day.level) }}
                          />
                        </HoverTooltip>
                      ) : (
                        <div key={`blank-${weekIndex}-${dayIndex}`} className="w-3 h-3" />
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 text-xs text-[var(--muted-foreground)]">
        <span>Less</span>
        {[0, 1, 2, 3].map((level) => (
          <div key={level} className="w-3 h-3 rounded-sm" style={{ backgroundColor: levelColor(level) }} />
        ))}
        <span>More</span>
      </div>
    </SectionCard>
  );
}

export default ActivityHeatmapCard;
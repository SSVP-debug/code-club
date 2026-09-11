import { useState } from "react";
import { Flame } from "lucide-react";
import { useAppContext } from "../../hooks/useAppContext";
import StreakCalendarModal from "./StreakCalendarModal";

// Clicking the badge opens StreakCalendarModal — activityDates/longestStreak
// are pulled here from AppContext rather than threaded in as extra props,
// so every existing call site (Navbar x2, RankProgressSection,
// SubmissionCelebrationModal) gets the calendar for free without changing
// how they render <StreakBadge streak={...} size={...} />.
function StreakBadge({ streak, size = "sm" }) {
  const { activityDates, longestStreak } = useAppContext();
  const [calendarOpen, setCalendarOpen] = useState(false);

  if (!streak || streak <= 0) return null;

  const styles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  const iconSize = { sm: 13, md: 15, lg: 17 }[size];

  return (
    <>
      <button
        type="button"
        onClick={() => setCalendarOpen(true)}
        title={`${streak}-day streak! Tap to view your streak calendar.`}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/15 hover:border-orange-500/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${styles[size]}`}
      >
        <Flame size={iconSize} strokeWidth={2.5} aria-hidden="true" />
        <span>{streak}</span>
        <span className="text-orange-500/60 font-normal">
          {streak === 1 ? "day" : "days"}
        </span>
      </button>

      {calendarOpen && (
        <StreakCalendarModal
          streak={streak}
          longestStreak={longestStreak}
          activityDates={activityDates}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </>
  );
}

export default StreakBadge;
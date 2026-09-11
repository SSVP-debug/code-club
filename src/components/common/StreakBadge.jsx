import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { useAppContext } from "../../hooks/useAppContext";
import StreakCalendarPopover from "./StreakCalendarPopover";

// Clicking the badge opens StreakCalendarPopover, anchored directly below
// it (not a full-screen modal — see that file's own comment). activityDates/
// longestStreak are pulled here from AppContext rather than threaded in as
// extra props, so every existing call site (Navbar x2, RankProgressSection,
// SubmissionCelebrationModal) gets the calendar for free without changing
// how they render <StreakBadge streak={...} size={...} />.
function StreakBadge({ streak, size = "sm" }) {
  const { activityDates, longestStreak } = useAppContext();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Click-outside-to-close — same pattern AvatarDropdown.jsx uses for its
  // own anchored panel.
  useEffect(() => {
    if (!calendarOpen) return;
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [calendarOpen]);

  if (!streak || streak <= 0) return null;

  const styles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  const iconSize = { sm: 13, md: 15, lg: 17 }[size];

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setCalendarOpen((prev) => !prev)}
        title={`${streak}-day streak! Tap to view your streak calendar.`}
        aria-haspopup="dialog"
        aria-expanded={calendarOpen}
        className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/15 hover:border-orange-500/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${styles[size]}`}
      >
        <Flame size={iconSize} strokeWidth={2.5} aria-hidden="true" />
        <span>{streak}</span>
        <span className="text-orange-500/60 font-normal">
          {streak === 1 ? "day" : "days"}
        </span>
      </button>

      {calendarOpen && (
        <StreakCalendarPopover
          streak={streak}
          longestStreak={longestStreak}
          activityDates={activityDates}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  );
}

export default StreakBadge;
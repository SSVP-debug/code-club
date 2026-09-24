import { useMemo } from "react";
import SectionCard from "../ui/layout/SectionCard";
import EmptyState from "../ui/feedback/EmptyState";
import { ACHIEVEMENT_METADATA } from "../../config/achievementMetadata";
import { Compass, Flag } from "lucide-react";

/**
 * JourneyTimeline
 *
 * Built entirely from joinedDate + achievements[].unlockedAt (both already
 * on the User document — see backend/models/User.js achievements schema).
 * No new backend work: this is "Joined" plus every achievement unlock,
 * sorted chronologically. Milestones the audit mocked up (e.g. "Reached
 * Level 5") aren't included because there's no historical XP snapshot to
 * derive them from — would need a real event log, flagged for a later
 * phase rather than faked here.
 */
function JourneyTimeline({ joinedDate, achievements = [] }) {
  const events = useMemo(() => {
    const list = [];

    if (joinedDate) {
      list.push({
        key: "joined",
        date: new Date(joinedDate),
        icon: <Flag size={14} strokeWidth={2} aria-hidden="true" />,
        label: "Joined Code Club",
      });
    }

    achievements
      .filter((a) => a.unlockedAt)
      .forEach((a) => {
        const meta = ACHIEVEMENT_METADATA[a.key];
        if (!meta) return;
        list.push({
          key: a.key,
          date: new Date(a.unlockedAt),
          icon: meta.icon,
          label: meta.title,
        });
      });

    return list.sort((a, b) => a.date - b.date);
  }, [joinedDate, achievements]);

  return (
    <SectionCard
      className="universe-journey-timeline"
      title="Journey Timeline"
      icon={<Compass size={18} strokeWidth={2} />}
      accented
      collapsible
      defaultOpen={false}
      storageKey="profile-collapse-journey"
    >
      {events.length > 0 && (
        <div className="universe-journey-timeline__summary">
          <span>{events.length} recorded milestones</span>
          <span>Chronological journey</span>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState
          icon={<Compass size={28} strokeWidth={1.75} />}
          title="Your journey starts here"
          description="Milestones will appear as you solve and unlock achievements."
          compact
        />
      ) : (
        <div className="space-y-0">
          {events.map((event, i) => (
            <div key={event.key} className="universe-journey-event flex gap-4" data-universe-event={event.key === "joined" ? "origin" : "milestone"}>
              <div className="flex flex-col items-center">
                <div className="universe-journey-event__node w-8 h-8 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center text-sm flex-shrink-0">
                  {event.icon}
                </div>
                {i < events.length - 1 && (
                  <div className="w-px flex-1 bg-[var(--surface-elevated)] my-1" />
                )}
              </div>
              <div className="pb-6 min-w-0">
                <p className="font-medium">{event.label}</p>
                <p className="text-[var(--muted-foreground)] text-xs mt-0.5">
                  {event.date.toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default JourneyTimeline;
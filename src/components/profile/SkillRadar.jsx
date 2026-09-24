import { useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from "recharts";
import SectionCard from "../ui/layout/SectionCard";
import EmptyState from "../ui/feedback/EmptyState";
import { Radar as RadarIcon } from "lucide-react";

/**
 * SkillRadar
 *
 * Same data source and chart config as the "Topic Coverage" radar on
 * Analytics.jsx (kept in sync deliberately — this is the glance view,
 * Analytics is the deep-dive, both showing topicStats is intentional,
 * not duplication to fix).
 *
 * Shared with the public /u/:username page — same reasoning as
 * ActivityHeatmap.jsx: doesn't call useTheme() itself, accepts an
 * optional accentColor prop instead, so a viewer's own theme never
 * bleeds into someone else's public profile.
 */
function SkillRadar({ topicStats = {}, accentColor = "#2dd4bf" }) {
  const radarData = useMemo(() => {
    const entries = Object.entries(topicStats || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    return entries.map(([topic, count]) => ({
      topic: topic.length > 12 ? topic.slice(0, 12) + "…" : topic,
      count,
    }));
  }, [topicStats]);

  return (
    <SectionCard className="universe-skill-radar" title="Skill Radar" icon={<RadarIcon size={18} strokeWidth={2} />}>
      {radarData.length < 3 ? (
        <EmptyState
          icon={<RadarIcon size={28} strokeWidth={1.75} />}
          title="Not enough data yet"
          description="Solve problems across at least 3 topics to unlock your radar."
          compact
        />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="topic" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
            <Radar
              name="Solved"
              dataKey="count"
              stroke={accentColor}
              fill={accentColor}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}

export default SkillRadar;
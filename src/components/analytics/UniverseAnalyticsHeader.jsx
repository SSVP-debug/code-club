import { BarChart3, FlaskConical, LockKeyhole, Rocket, Shield, Terminal, Triangle, Activity } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

const EMBLEMS = {
  heist: LockKeyhole,
  lab: FlaskConical,
  terminal: Terminal,
  arena: Triangle,
  startup: Rocket,
  neutral: Shield,
};

function UniverseAnalyticsHeader({ stats, currentStreak }) {
  const { theme } = useTheme();
  const visual = theme.visual ?? {};
  const Icon = EMBLEMS[visual.emblem ?? visual.motif] ?? BarChart3;
  const isDefault = theme.id === "default";

  return (
    <section className={`universe-analytics-hero ${isDefault ? "universe-analytics-hero--default" : ""}`}>
      <div className="universe-analytics-hero__wash" aria-hidden="true" />
      <div className="universe-analytics-hero__top">
        <div className="universe-analytics-hero__identity">
          <div className="universe-analytics-hero__emblem" aria-hidden="true">
            <Icon size={20} strokeWidth={1.8} />
          </div>
          <div>
            <div className="universe-analytics-hero__eyebrow">
              {isDefault ? "CODE CLUB ANALYTICS" : visual.eyebrow}
            </div>
            <h1>{isDefault ? theme.words.analytics : visual.heroTitle}</h1>
          </div>
        </div>
        <div className="universe-analytics-hero__status">
          <Activity size={11} aria-hidden="true" />
          {isDefault ? "PERFORMANCE OVERVIEW" : visual.status}
        </div>
      </div>
      <div className="universe-analytics-hero__metrics">
        <div>
          <span>LEVEL</span>
          <strong>{stats.level}</strong>
        </div>
        <div>
          <span>RANK</span>
          <strong>{stats.rank}</strong>
        </div>
        <div>
          <span>ACCEPTANCE</span>
          <strong>{stats.acceptanceRate}%</strong>
        </div>
        <div>
          <span>STREAK</span>
          <strong>{currentStreak}d</strong>
        </div>
      </div>
    </section>
  );
}

export default UniverseAnalyticsHeader;

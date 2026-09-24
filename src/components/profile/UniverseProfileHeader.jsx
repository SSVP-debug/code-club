import { Activity, FlaskConical, LockKeyhole, Rocket, Shield, Terminal, Triangle, TrendingUp } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

const EMBLEMS = {
  heist: LockKeyhole,
  lab: FlaskConical,
  terminal: Terminal,
  arena: Triangle,
  startup: Rocket,
  neutral: Shield,
};

function UniverseProfileHeader({
  level,
  rank,
  current,
  needed,
  percent,
  solved,
  streak,
}) {
  const { theme } = useTheme();
  const visual = theme.visual ?? {};
  const Icon = EMBLEMS[visual.emblem ?? visual.motif] ?? Shield;
  const isDefault = theme.id === "default";

  return (
    <section
      className={`universe-profile-hero ${isDefault ? "universe-profile-hero--default" : ""}`}
      data-universe-profile={theme.id}
      aria-label={isDefault ? "Profile" : `${visual.codename} coding identity`}
    >
      <div className="universe-profile-hero__wash" aria-hidden="true" />
      <div className="universe-profile-hero__content">
        <div className="universe-profile-hero__identity">
          <div className="universe-profile-hero__emblem" aria-hidden="true">
            <Icon size={20} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="universe-profile-hero__eyebrow">
              {isDefault ? "CODE CLUB PROFILE" : visual.eyebrow}
            </div>
            <div className="universe-profile-hero__codename">
              {isDefault ? "Coding Identity" : visual.codename}
            </div>
          </div>
        </div>

        {!isDefault && (
          <div className="universe-profile-hero__status">
            <Activity size={11} aria-hidden="true" />
            {visual.status || "SYSTEM ONLINE"}
          </div>
        )}

        <div className="universe-profile-hero__signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="universe-profile-hero__progress">
          <div className="universe-profile-hero__progress-head">
            <div>
              <span className="universe-profile-hero__label">Progress // Level {level}</span>
              <strong>{rank}</strong>
            </div>
            <span className="universe-profile-hero__xp">
              {current.toLocaleString()} / {needed.toLocaleString()} XP
            </span>
          </div>
          <div
            className="universe-profile-hero__bar"
            role="progressbar"
            aria-valuenow={Math.min(percent, 100)}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label={`Level progress: ${percent}%`}
          >
            <span style={{ width: `${Math.min(percent, 100)}%` }} />
          </div>
        </div>

        <div className="universe-profile-hero__stats">
          <span><TrendingUp size={11} aria-hidden="true" /> {solved} solved</span>
          <span><Activity size={11} aria-hidden="true" /> {streak} day streak</span>
        </div>
      </div>
    </section>
  );
}

export default UniverseProfileHeader;

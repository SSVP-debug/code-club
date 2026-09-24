import { useTheme } from "../../../hooks/useTheme";
import { auth } from "../../../firebase/firebase";
import { THEME_BACKGROUNDS } from "../../../themes/themeBackgrounds";
import {
  Vault,
  FlaskConical,
  Terminal,
  Triangle,
  Rocket,
  Compass,
  Radio,
  ShieldCheck,
} from "lucide-react";

const EMBLEMS = {
  vault: Vault,
  flask: FlaskConical,
  terminal: Terminal,
  triangle: Triangle,
  rocket: Rocket,
  compass: Compass,
};

function UniverseIdentityBanner() {
  const { theme } = useTheme();
  const visual = theme.visual ?? {};
  const Icon = EMBLEMS[visual.emblem] ?? Compass;
  const artwork = theme.background ? THEME_BACKGROUNDS[theme.background] : null;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const name = auth.currentUser?.displayName?.split(" ")[0] || "Coder";

  if (theme.id === "default") {
    return (
      <section className="universe-identity universe-identity--default" aria-labelledby="universe-identity-title">
        <div className="universe-identity__content">
          <div className="universe-identity__emblem">
            <Compass size={24} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 id="universe-identity-title" className="text-xl font-bold leading-tight truncate">
              {greeting}, {name}
            </h1>
            <p className="text-[var(--muted-foreground)] text-sm mt-1 truncate">
              {theme.words.welcomeTagline}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`universe-identity universe-identity--${visual.motif ?? "neutral"}`}
      aria-labelledby="universe-identity-title"
      data-universe-panel={visual.panelStyle ?? "standard"}
    >
      {artwork && (
        <div
          aria-hidden="true"
          className="universe-identity__artwork"
          style={{ backgroundImage: `url("${artwork}")` }}
        />
      )}

      <div aria-hidden="true" className="universe-identity__wash" />
      <div aria-hidden="true" className="universe-identity__texture" />

      <div className="universe-identity__content">
        <div className="universe-identity__emblem-wrap">
          <div className="universe-identity__emblem">
            <Icon size={28} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <span className="universe-identity__emblem-label">{visual.artifact}</span>
        </div>

        <div className="universe-identity__copy">
          <div className="universe-identity__eyebrow">
            <span className="universe-identity__signal" aria-hidden="true" />
            {visual.eyebrow}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 id="universe-identity-title" className="universe-identity__title">
              {greeting}, {name}
            </h1>
            <span className="universe-identity__codename">{visual.codename}</span>
          </div>
          <p className="universe-identity__hero-title">{visual.heroTitle}</p>
          <p className="universe-identity__description">{visual.heroDescription}</p>
        </div>

        <div className="universe-identity__status" aria-label={visual.status}>
          <Radio size={14} aria-hidden="true" />
          <span>{visual.status}</span>
          <ShieldCheck size={14} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

export default UniverseIdentityBanner;

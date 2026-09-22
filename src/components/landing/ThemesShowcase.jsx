import { Link } from "react-router-dom";
import Reveal from "./Reveal";
import { getTheme } from "../../themes";
import { THEME_ICONS } from "../../themes/themeIcons";
import { THEME_BACKGROUNDS } from "../../themes/themeBackgrounds";

const ARROW = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const THEME_IDS = ["codeHeist", "breakingBug", "ghostProtocol", "survivalCode", "debugDynasty"];

const THEMES_PREVIEW = THEME_IDS.map((id) => {
  const theme = getTheme(id);
  return {
    id,
    Icon: THEME_ICONS[id],
    name: theme.name,
    description: theme.description,
    color: theme.colors.primary,
    background: THEME_BACKGROUNDS[id],
  };
});

function ThemesShowcase({ user }) {
  return (
    <Reveal as="section" className="px-6 py-20 md:px-12 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-4 font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--muted-foreground)]">
          Themed practice
        </p>
        <h2 className="text-lp-h2-detail font-display font-bold tracking-tight text-[var(--foreground)]">
          Same DSA. A different way to grind.
        </h2>
        <p className="mt-4 text-[var(--muted-foreground)]">
          Pick a universe and Code Club reframes the whole experience
          around it same problems, same judge, a different story.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES_PREVIEW.map((t) => (
          <div
            key={t.id}
            className="group relative min-h-[260px] overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1"
            style={{ borderColor: `${t.color}55` }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
              style={{ backgroundImage: `url(${t.background})` }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/55 to-black/95"
            />

            <div className="relative z-10 flex h-full flex-col">
              <span
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${t.color}1a`, color: t.color }}
                aria-hidden="true"
              >
                <t.Icon size={20} strokeWidth={2} />
              </span>
              <div className="mt-auto">
                <h3 className="font-display text-lg font-semibold text-white">{t.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/75">{t.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          to={user ? "/theme-selection" : "/login?role=student"}
          className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
        >
          Explore all universes
          {ARROW}
        </Link>
      </div>
    </Reveal>
  );
}

export default ThemesShowcase;

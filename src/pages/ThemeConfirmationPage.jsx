import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import { THEME_OPTIONS } from "../themes/themeOptions";
import { getTheme } from "../themes";
import { THEME_ICONS, withAlpha } from "../themes/themeIcons";
import ThemeFlowProgress from "../components/onboarding/ThemeFlowProgress";
import { THEME_BACKGROUNDS } from "../themes/themeBackgrounds";

export default function ThemeConfirmationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { themeId } = useTheme();
  const nextPath = searchParams.get("next")
    ? decodeURIComponent(searchParams.get("next"))
    : "/dashboard";

  const theme = THEME_OPTIONS.find((t) => t.id === themeId);

  if (!theme) {
    return <Navigate to="/theme-selection" replace />;
  }

  const colors = getTheme(themeId).colors;
  const Icon = THEME_ICONS[themeId];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center px-6 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{
          backgroundImage: THEME_BACKGROUNDS[theme.id]
            ? `url(${THEME_BACKGROUNDS[theme.id]})`
            : undefined,
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-black/65" />

      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 animate-[fadeIn_.4s_ease-out]">
        <ThemeFlowProgress step={2} />
      </div>

      <div
        className="
    relative z-10 max-w-2xl text-center
    animate-[fadeIn_.4s_ease-out]
  "
      >
        <div
          className="
    inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-6
    animate-[pulseGlow_1s_ease-out]
  "
          style={{
            backgroundColor: withAlpha(colors.primary, "1f"),
            color: colors.primary,
          }}
        >
          <Icon size={48} strokeWidth={2} aria-hidden="true" />
        </div>

        <h1 className="text-5xl font-bold mb-6">
          {theme.name.toUpperCase()}
        </h1>

        <h2 className="text-2xl font-semibold mb-4">
          {theme.onboardingTitle}
        </h2>

        <p className="text-[var(--muted-foreground)] text-lg mb-10">
          {theme.onboardingMessage}
        </p>

        <button
          onClick={() => navigate(nextPath, { replace: true })}
          style={{ backgroundColor: colors.primary, color: "#09090b" }}
          className="px-8 py-4 rounded-xl font-semibold transition hover:brightness-110"
        >
          Begin Journey
        </button>
      </div>
    </div>
  );
}
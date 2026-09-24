import { useMemo } from "react";
import { useTheme } from "../hooks/useTheme";
import { THEME_BACKGROUNDS } from "./themeBackgrounds";

function UniverseAtmosphere({ theme }) {
  const { atmosphere, background } = theme;
  const artwork = background ? THEME_BACKGROUNDS[background] : null;

  const style = useMemo(() => ({
    "--universe-bg": theme.colors.background,
    "--universe-surface": theme.colors.surface,
    "--universe-surface-elevated": theme.colors.surfaceElevated,
    "--universe-border": theme.colors.border,
    "--universe-muted": theme.colors.muted,
    "--universe-glow": theme.colors.glow,
    "--universe-gradient": theme.colors.gradient,
    "--universe-primary": theme.colors.primary,
    "--universe-artwork-opacity": atmosphere.artworkOpacity,
    "--universe-artwork-position": atmosphere.artworkPosition,
    "--universe-overlay-opacity": atmosphere.overlayOpacity,
    "--universe-glow-opacity": atmosphere.glowOpacity,
    "--universe-grid-opacity": atmosphere.gridOpacity,
    "--universe-scanline-opacity": atmosphere.scanlineOpacity,
    "--universe-vignette-opacity": atmosphere.vignetteOpacity,
  }), [theme, atmosphere]);

  return (
    <div
      aria-hidden="true"
      className="universe-atmosphere fixed inset-0 -z-10 overflow-hidden"
      data-animation={atmosphere.animation}
      data-theme-background={background ?? "default"}
      style={style}
    >
      {artwork && (
        <div
          className="universe-atmosphere__artwork"
          style={{ backgroundImage: "url(" + artwork + ")" }}
        />
      )}
      <div className="universe-atmosphere__glow" />
      <div className="universe-atmosphere__overlay" />
      <div className="universe-atmosphere__grid" />
      <div className="universe-atmosphere__scanlines" />
      <div className="universe-atmosphere__vignette" />
    </div>
  );
}

export default function ThemeSkin({ children }) {
  const { theme, themeId } = useTheme();
  const {
    primary,
    secondary,
    border,
    accent,
    background,
    surface,
    surfaceElevated,
    muted,
    glow,
    gradient,
  } = theme.colors;

  return (
    <div
      data-theme={themeId}
      data-universe-motif={theme.visual?.motif ?? "neutral"}
      style={{
        display: "contents",
        "--theme-primary": primary,
        "--theme-secondary": secondary,
        "--theme-border": border,
        "--theme-accent": accent,
        "--theme-background": background,
        "--theme-surface": surface,
        "--theme-surface-elevated": surfaceElevated,
        "--theme-muted": muted,
        "--theme-glow": glow,
        "--theme-gradient": gradient,
        "--universe-motif": theme.visual?.motif ?? "neutral",
        "--universe-panel-style": theme.visual?.panelStyle ?? "standard",
        "--background": background,
        "--foreground": "#f4f4f5",
        "--surface": surface,
        "--surface-elevated": surfaceElevated,
        "--border": border,
        "--muted-foreground": muted,
      }}
    >
      <UniverseAtmosphere theme={theme} />
      {children}
    </div>
  );
}

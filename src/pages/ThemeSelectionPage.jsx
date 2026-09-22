import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useAppContext } from "../hooks/useAppContext";
import { THEME_OPTIONS } from "../themes/themeOptions";
import { DEFAULT_THEME, getTheme } from "../themes";
import { THEME_ICONS, withAlpha } from "../themes/themeIcons";
import ThemeFlowProgress from "../components/onboarding/ThemeFlowProgress";
import { THEME_BACKGROUNDS } from "../themes/themeBackgrounds";

export default function ThemeSelectionPage() {
    // Theme note: only this page's own chrome (root background, edge-fade
    // gradients, arrow-nav buttons, "Continue without theme") is migrated
    // to the Black/White Mode tokens below. Each universe card's interior
    // (bg-[var(--tbg)], the lock icon, "Accepted →"/"Runtime Error →"
    // labels, the locked-state button) intentionally stays on that
    // theme's own colors.secondary/primary — those come from the separate
    // gamified skin system (useTheme, not useBWMode) and are tuned for
    // readability against each other, not against the page's light/dark
    // state. Migrating only some of a card's internal text while leaving
    // its background on the theme's own fixed dark tone would break that
    // internal contrast relationship instead of fixing it.
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setTheme, themeId: currentThemeId } = useTheme();
    const { totalXP = 0 } = useAppContext();
    const scrollerRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Destination after theme is picked — defaults to /dashboard
    const nextPath = searchParams.get("next")
      ? decodeURIComponent(searchParams.get("next"))
      : "/dashboard";

    // Tracks scroll position so we know which edge fade / arrow to show.
    // A 4px tolerance avoids flicker from sub-pixel rounding at the ends.
    const updateScrollState = () => {
        const el = scrollerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(
            el.scrollLeft + el.clientWidth < el.scrollWidth - 4
        );
    };

    useEffect(() => {
        updateScrollState();
        window.addEventListener("resize", updateScrollState);
        return () => window.removeEventListener("resize", updateScrollState);
    }, []);

    const scrollByCard = (direction) => {
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollBy({ left: direction * 344, behavior: "smooth" }); // card width (320) + gap (24)
    };

    const handleSelect = (themeId) => {
        // Audit fix: unlockXP was defined per-theme but never enforced —
        // every theme was selectable by every user regardless of XP.
        // Guard here too, not just via the disabled button below, so this
        // stays safe even if the button is reached another way later.
        const theme = THEME_OPTIONS.find((t) => t.id === themeId);
        if (theme && totalXP < (theme.unlockXP || 0)) return;

        setTheme(themeId);
        // If already had a theme, go straight to destination (no confirmation needed)
        if (themeId === currentThemeId) {
            navigate(nextPath, { replace: true });
            return;
        }
        // First-time selection: show confirmation page, then land on next
        const confirmDest = encodeURIComponent(nextPath);
        navigate(`/theme-confirmation?next=${confirmDest}`);
    };

    // "Continue without theme" — sets the neutral/default theme so ThemeGate
    // no longer blocks access, but skips the onboarding confirmation screen
    // since there's no story universe to introduce.
    const handleContinueWithoutTheme = () => {
        setTheme(DEFAULT_THEME);
        navigate(nextPath, { replace: true });
    };

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col items-center px-6 py-12">
            <div className="w-full max-w-6xl flex items-center justify-between mb-6 animate-[fadeIn_.4s_ease-out]">
                <ThemeFlowProgress step={1} />

                <button
                    onClick={handleContinueWithoutTheme}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline underline-offset-4 transition whitespace-nowrap"
                >
                    Continue without theme
                </button>
            </div>

            <div className="max-w-4xl w-full text-center mb-8 animate-[fadeIn_.4s_ease-out]">
                <h1 className="text-4xl font-bold mb-4">
                    Choose Your Code Club Universe
                </h1>

                <p className="text-[var(--muted-foreground)]">
                    Your coding journey should feel like an adventure.
                    Select the world where you'll begin.
                </p>
            </div>

            <div className="w-full max-w-6xl relative animate-[fadeIn_.4s_ease-out]">
                {/* Left edge fade — only visible once the row has been scrolled */}
                <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-0 top-0 bottom-6 w-16 z-10 bg-gradient-to-r from-[var(--background)] to-transparent transition-opacity duration-300 ${
                        canScrollLeft ? "opacity-100" : "opacity-0"
                    }`}
                />
                {/* Right edge fade — signals there are more universes to scroll to */}
                <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute right-0 top-0 bottom-6 w-16 z-10 bg-gradient-to-l from-[var(--background)] to-transparent transition-opacity duration-300 ${
                        canScrollRight ? "opacity-100" : "opacity-0"
                    }`}
                />

                {/* Arrow nav — desktop only; hidden at either end of the row */}
                {canScrollLeft && (
                    <button
                        onClick={() => scrollByCard(-1)}
                        aria-label="Scroll to previous universe"
                        className="hidden sm:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[var(--surface)]/90 border border-[var(--border-strong)] hover:border-teal-500 hover:bg-[var(--surface-elevated)] transition"
                    >
                        ←
                    </button>
                )}
                {canScrollRight && (
                    <button
                        onClick={() => scrollByCard(1)}
                        aria-label="Scroll to next universe"
                        className="hidden sm:flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[var(--surface)]/90 border border-[var(--border-strong)] hover:border-teal-500 hover:bg-[var(--surface-elevated)] transition"
                    >
                        →
                    </button>
                )}

                <div
                    ref={scrollerRef}
                    onScroll={updateScrollState}
                    className="custom-scrollbar flex gap-6 overflow-x-auto pb-6 px-1 snap-x snap-mandatory scroll-smooth"
                >
                    {THEME_OPTIONS.map((theme) => {
                        const colors = getTheme(theme.id).colors;
                        const Icon = THEME_ICONS[theme.id];
                        const isLocked = totalXP < (theme.unlockXP || 0);

                        return (
                            <div
                                key={theme.id}
                                style={{
                                    "--tp": colors.primary,
                                    "--tb": colors.border,
                                    "--tbg": colors.secondary,
                                }}
                                className={`
        group relative overflow-hidden
        bg-[var(--tbg)] border border-[var(--tb)] rounded-2xl p-6
        transition-all duration-300
        flex-none w-80 snap-start
        ${isLocked
            ? "opacity-60 saturate-50"
            : "hover:-translate-y-2 hover:scale-[1.02] hover:border-[var(--tp)] hover:shadow-[0_0_30px_-10px_var(--tp)]"}
    `}
                            >
                                {/* Cinematic universe artwork — background only. UI content stays above it. */}
                                <div
                                    aria-hidden="true"
                                    className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]"
                                    style={{
                                        backgroundImage: THEME_BACKGROUNDS[theme.id]
                                            ? `url(${THEME_BACKGROUNDS[theme.id]})`
                                            : undefined,
                                    }}
                                />
                                <div
                                    aria-hidden="true"
                                    className="absolute inset-0 z-0 bg-gradient-to-b from-black/20 via-black/60 to-black/95"
                                />

                                <div className="relative z-10">
                                {/* Top accent stripe — each universe's own gradient, not a shared default */}
                                <div
                                    aria-hidden="true"
                                    className="absolute top-0 left-0 right-0 h-1"
                                    style={{
                                        background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
                                    }}
                                />

                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                                    style={{
                                        backgroundColor: withAlpha(colors.primary, "1f"),
                                        color: colors.primary,
                                    }}
                                >
                                    <Icon size={28} strokeWidth={2} aria-hidden="true" />
                                </div>

                                <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
                                    {theme.name}
                                    {isLocked && (
                                        <Lock
                                            size={16}
                                            strokeWidth={2}
                                            className="text-[var(--muted-foreground)]"
                                            aria-label={`Locked — requires ${theme.unlockXP} XP`}
                                        />
                                    )}
                                </h2>
                                {currentThemeId === theme.id && (
                                    <p
                                        className="text-sm font-medium mb-2"
                                        style={{ color: colors.primary }}
                                    >
                                        Current Universe
                                    </p>
                                )}

                                <p className="text-[var(--muted-foreground)] mb-6">
                                    {theme.description}
                                </p>

                                <div className="space-y-2 mb-6 text-sm">
                                    <p>
                                        <span className="text-[var(--muted-foreground)]">Accepted → </span>
                                        <span
                                            className="font-medium"
                                            style={{ color: colors.primary }}
                                        >
                                            {theme.acceptedPreview}
                                        </span>
                                    </p>

                                    <p>
                                        <span className="text-[var(--muted-foreground)]">Runtime Error → </span>
                                        <span className="font-medium text-rose-400">
                                            {theme.runtimePreview}
                                        </span>
                                    </p>
                                </div>

                                {isLocked ? (
                                    <button
                                        disabled
                                        aria-disabled="true"
                                        className="w-full py-3 rounded-xl font-semibold bg-[var(--surface-elevated)] text-[var(--muted-foreground)] cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Lock size={16} strokeWidth={2} aria-hidden="true" />
                                        Unlock at {theme.unlockXP.toLocaleString()} XP
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSelect(theme.id)}
                                        style={{ backgroundColor: colors.primary, color: "#09090b" }}
                                        className="w-full py-3 rounded-xl font-semibold transition hover:brightness-110"
                                    >
                                        Enter Universe
                                    </button>
                                )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
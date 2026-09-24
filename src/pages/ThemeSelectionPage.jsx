
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Lock } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useAppContext } from "../hooks/useAppContext";
import { THEME_OPTIONS } from "../themes/themeOptions";
import { DEFAULT_THEME, getTheme } from "../themes";
import { THEME_ICONS } from "../themes/themeIcons";
import ThemeFlowProgress from "../components/onboarding/ThemeFlowProgress";
import { THEME_BACKGROUNDS } from "../themes/themeBackgrounds";

export default function ThemeSelectionPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setTheme, themeId: currentThemeId } = useTheme();
    const { totalXP = 0 } = useAppContext();
    const nextPath = searchParams.get("next")
        ? decodeURIComponent(searchParams.get("next"))
        : "/dashboard";

    const handleSelect = (themeId) => {
        const theme = THEME_OPTIONS.find((item) => item.id === themeId);
        if (!theme || totalXP < (theme.unlockXP || 0)) return;

        setTheme(themeId);

        if (themeId === currentThemeId) {
            navigate(nextPath, { replace: true });
            return;
        }

        navigate("/theme-confirmation?next=" + encodeURIComponent(nextPath));
    };

    const handleContinueWithoutTheme = () => {
        setTheme(DEFAULT_THEME);
        navigate(nextPath, { replace: true });
    };

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-7 sm:px-8 lg:px-10">
                <header className="flex items-center justify-between gap-6">
                    <ThemeFlowProgress step={1} />

                    <button
                        type="button"
                        onClick={handleContinueWithoutTheme}
                        className="shrink-0 text-xs text-[var(--muted-foreground)] underline underline-offset-4 transition hover:text-[var(--foreground)]"
                    >
                        Continue without theme
                    </button>
                </header>

                <section className="mx-auto w-full max-w-3xl pb-8 pt-12 text-center sm:pt-14">
                    <p className="mb-4 text-[10px] font-mono-ui uppercase tracking-[0.3em] text-teal-400">
                        Your Code Club Universe
                    </p>
                    <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                        Choose your world.
                    </h1>
                    <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">
                        The problems stay real. The world around them changes.
                        Pick the universe you want to code in.
                    </p>
                </section>

                <section
                    aria-label="Code Club universes"
                    className="grid flex-1 grid-cols-1 gap-4 pb-8 sm:grid-cols-2 xl:grid-cols-3"
                >
                    {THEME_OPTIONS.map((theme) => {
                        const colors = getTheme(theme.id).colors;
                        const Icon = THEME_ICONS[theme.id];
                        const isLocked = totalXP < (theme.unlockXP || 0);
                        const isCurrent = currentThemeId === theme.id;

                        return (
                            <article
                                key={theme.id}
                                className={[
                                    "group relative flex min-h-[390px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition duration-300",
                                    isLocked
                                        ? "opacity-80"
                                        : "hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-2xl hover:shadow-black/25",
                                ].join(" ")}
                            >
                                <div className="relative h-48 shrink-0 overflow-hidden">
                                    <img
                                        src={THEME_BACKGROUNDS[theme.id]}
                                        alt=""
                                        aria-hidden="true"
                                        loading="lazy"
                                        decoding="async"
                                        className={[
                                            "h-full w-full object-cover transition duration-700",
                                            isLocked ? "grayscale saturate-0" : "group-hover:scale-[1.04]",
                                        ].join(" ")}
                                    />

                                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-black/25 to-black/10" />

                                    <div
                                        className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/45 text-white backdrop-blur-md"
                                        aria-hidden="true"
                                    >
                                        <Icon size={19} strokeWidth={2} />
                                    </div>

                                    {isCurrent && (
                                        <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur-md">
                                            <Check size={12} aria-hidden="true" />
                                            Current
                                        </div>
                                    )}

                                    {isLocked && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
                                                <Lock size={13} aria-hidden="true" />
                                                Unlock at {theme.unlockXP.toLocaleString()} XP
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-1 flex-col p-5 sm:p-6">
                                    <h2 className="text-2xl font-bold tracking-tight">
                                        {theme.name}
                                    </h2>

                                    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                                        {theme.description}
                                    </p>

                                    <div className="mt-auto pt-5">
                                        <div className="mb-3 flex items-center gap-2 text-[11px] font-mono-ui uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                                            <span
                                                className="h-1.5 w-1.5 rounded-full"
                                                style={{ backgroundColor: colors.primary }}
                                            />
                                            {theme.acceptedPreview}
                                        </div>

                                        {isLocked ? (
                                            <button
                                                type="button"
                                                disabled
                                                aria-disabled="true"
                                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-semibold text-[var(--muted-foreground)]"
                                            >
                                                <Lock size={15} aria-hidden="true" />
                                                Locked
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleSelect(theme.id)}
                                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--foreground)] px-4 py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                                            >
                                                Enter Universe
                                                <ArrowRight size={15} aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>

                <footer className="border-t border-[var(--border)] py-5 text-center text-[11px] text-[var(--muted-foreground)]">
                    More universes can be discovered as Code Club grows.
                </footer>
            </div>
        </div>
    );
}

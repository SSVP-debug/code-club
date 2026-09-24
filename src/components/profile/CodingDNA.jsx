import { useMemo } from "react";
import SectionCard from "../ui/layout/SectionCard";
import { Dna } from "lucide-react";
import { useLanguages } from "../../hooks/useLanguages";

/**
 * CodingDNA
 *
 * Derives everything from `submissions` (last 50, from /api/init) and
 * `topicStats` — both already hydrated into AppContext, no new fetch.
 * Mirrors the favoriteLanguage/strongestTopic/averageRuntime derivations
 * already used on Analytics.jsx so the two pages never disagree.
 */
function CodingDNA({ submissions = [], topicStats = {}, solvedDifficulty = {}, longestStreak = 0, languageBreakdown = null }) {
  // Content & Execution Architecture cross-check follow-up (Phase 6):
  // was a hardcoded `LANG_LABELS` object literal — one of three
  // near-identical copies found across the frontend this session (see
  // docs/adding-a-language.md's caveat on why this needed a per-file
  // grep, not a one-time check). Derived from the registry now.
  const { languages } = useLanguages();
  const langLabels = useMemo(() => Object.fromEntries(languages.map((l) => [l.id, l.name])), [languages]);

  const { favoriteLanguage, averageRuntime } = useMemo(() => {
    // Public-profile callers don't have raw submissions (executionTime isn't
    // exposed by the public API) — when a precomputed languageBreakdown is
    // passed instead, use it for favoriteLanguage and leave averageRuntime
    // as "—" rather than fabricating a number. See plans/003-public-profile-parity.md.
    if (languageBreakdown && languageBreakdown.length > 0) {
      const topLang = languageBreakdown[0].language;
      return {
        favoriteLanguage: langLabels[topLang] ?? topLang,
        averageRuntime: "—",
      };
    }

    const acceptedSubs = submissions.filter((s) => s.status?.includes("Accepted"));

    const languageCounts = {};
    acceptedSubs.forEach((s) => {
      const lang = s.language || "unknown";
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    });
    const topLang = Object.keys(languageCounts).sort(
      (a, b) => languageCounts[b] - languageCounts[a]
    )[0];

    const runtimes = acceptedSubs
      .map((s) => Number(s.executionTime))
      .filter((n) => !Number.isNaN(n) && n > 0);
    const avgRuntime = runtimes.length
      ? (runtimes.reduce((a, b) => a + b, 0) / runtimes.length).toFixed(0)
      : null;

    return {
      favoriteLanguage: topLang ? (langLabels[topLang] ?? topLang) : "—",
      averageRuntime: avgRuntime ? `${avgRuntime}ms` : "—",
    };
  }, [submissions, languageBreakdown, langLabels]);

  const favoriteTopic = useMemo(() => {
    const entries = Object.entries(topicStats || {});
    if (!entries.length) return "—";
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, [topicStats]);

  const favoriteDifficulty = useMemo(() => {
    const entries = Object.entries(solvedDifficulty || {}).filter(([, v]) => v > 0);
    if (!entries.length) return "—";
    const top = entries.sort((a, b) => b[1] - a[1])[0][0];
    return top.charAt(0).toUpperCase() + top.slice(1);
  }, [solvedDifficulty]);

  const dnaItems = [
    { label: "Primary Language", value: favoriteLanguage },
    { label: "Favorite Topic", value: favoriteTopic },
    { label: "Favorite Difficulty", value: favoriteDifficulty },
    { label: "Avg. Runtime", value: averageRuntime },
    { label: "Best Streak", value: `${longestStreak} days` },
  ];

  return (
    <SectionCard
      className="universe-coding-dna"
      title="Coding DNA"
      icon={<Dna size={18} strokeWidth={2} />}
      accented
      collapsible
      defaultOpen={false}
      storageKey="profile-collapse-coding-dna"
    >
      <div className="grid grid-cols-2 gap-4">
        {dnaItems.map((item) => (
          <div key={item.label} className="bg-[var(--surface-elevated)] rounded-xl p-4">
            <p className="text-[var(--muted-foreground)] text-xs">{item.label}</p>
            <p className="text-lg font-semibold mt-1 truncate">{item.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export default CodingDNA;
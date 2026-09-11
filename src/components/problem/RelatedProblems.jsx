import { Link } from "react-router-dom";
import { useProblems } from "../../hooks/useProblems";
import { useHideDifficultyLabels } from "../../hooks/useHideDifficultyLabels";

const DIFFICULTY_STYLES = {
  Easy:   "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  Medium: "text-amber-400 border-amber-500/20 bg-amber-500/10",
  Hard:   "text-rose-400 border-rose-500/20 bg-rose-500/10",
};

/**
 * RelatedProblems
 *
 * Renders a list of thematically related problems as navigation links.
 * Each slug is resolved to a full problem object from the catalog.
 * Invalid/missing slugs are silently skipped.
 *
 * SECURITY (Sept 2026 architecture audit, finding D): this component used
 * to `import problems from "../../data/problems.js"` directly. That file
 * is the hand-authored source of truth and contains every problem's
 * `hiddentestcases` in plaintext — a static import here meant Vite bundled
 * the entire hidden-test dataset for all ~250 problems into the main
 * problem-workspace chunk, shipped to every visitor, completely bypassing
 * the backend's careful hidden-test exclusion (problemController.js's
 * `.select("-hiddentestcases -hiddenTestcaseSet ...")`). This re-created
 * the exact leak the Aug 2026 "problems-bundle-bloat" fix closed in
 * useProblems.js's fallback path, unconditionally rather than just on
 * API-down fallback.
 *
 * Fixed by sourcing from `useProblems()` instead, which resolves through
 * GET /api/problems — a public-fields-only, Redis-cached endpoint that
 * already excludes hidden testcase data server-side. No new hidden-data
 * exposure risk regardless of how this component's props/lookups evolve.
 */
function RelatedProblems({ relatedSlugs, currentSlug }) {
  const hideDifficulty = useHideDifficultyLabels();
  const { problems } = useProblems();

  if (!relatedSlugs || relatedSlugs.length === 0) return null;

  const resolved = relatedSlugs
    .filter((slug) => slug !== currentSlug)
    .map((slug) => problems.find((p) => p.slug === slug))
    .filter(Boolean);

  if (resolved.length === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">Related Problems</h3>
      <div className="space-y-2">
        {resolved.map((p) => (
          <Link
            key={p.slug}
            to={`/problems/${p.slug}`}
            className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)]/50 hover:bg-[var(--surface-elevated)]/60 hover:border-[var(--border-strong)] transition px-4 py-3 group"
          >
            <span className="text-sm text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition font-medium truncate pr-3">
              {p.title}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {!hideDifficulty && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    DIFFICULTY_STYLES[p.difficulty] ?? "text-[var(--muted-foreground)] border-[var(--border-strong)] bg-[var(--surface-elevated)]"
                  }`}
                >
                  {p.difficulty}
                </span>
              )}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition"
              >
                <path
                  d="M5 3L9 7L5 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default RelatedProblems;
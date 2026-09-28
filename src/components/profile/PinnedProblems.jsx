import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import SectionCard from "../ui/layout/SectionCard";
import EmptyState from "../ui/feedback/EmptyState";
import { useAppContext } from "../../hooks/useAppContext";
import { useProblems } from "../../hooks/useProblems";
import { useHideDifficultyLabels } from "../../hooks/useHideDifficultyLabels";
import { useTheme } from "../../hooks/useTheme";
import { Pin } from "lucide-react";

const DIFFICULTY_COLOR = {
  Easy: "text-green-400 border-green-500/30 bg-green-500/10",
  Medium: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  Hard: "text-red-400 border-red-500/30 bg-red-500/10",
};

const MAX_PINNED = 6;

/**
 * PinnedProblems
 *
 * Pin candidates are restricted to solved problems — a "favorites"
 * showcase only makes sense for work you've actually finished, and it
 * means the public profile never shows a pinned-but-unsolved problem.
 * The Problems page/problem-detail pin-button entry point (a more direct
 * "pin this" affordance while browsing) is deferred — this picker covers
 * the full feature without touching BrowseView's row rendering, which
 * wasn't reviewed as part of this phase.
 */
function PinnedProblems({ collapsible = true }) {
  const { pinnedProblems, pinProblem, unpinProblem, solvedProblems } = useAppContext();
  const { problems } = useProblems();
  const { theme } = useTheme();
  const hideDifficulty = useHideDifficultyLabels();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busySlug, setBusySlug] = useState(null);

  const pinnedSlugs = useMemo(
    () => new Set(pinnedProblems.map((p) => p.slug)),
    [pinnedProblems]
  );

  const pinnableOptions = useMemo(() => {
    return problems
      .filter((p) => solvedProblems.includes(p.slug) && !pinnedSlugs.has(p.slug))
      .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
  }, [problems, solvedProblems, pinnedSlugs, search]);

  async function handlePin(slug) {
    setBusySlug(slug);
    try {
      await pinProblem(slug);
      setSearch("");
    } catch (err) {
      toast.error(err.message || "Failed to pin problem");
    } finally {
      setBusySlug(null);
    }
  }

  async function handleUnpin(slug) {
    setBusySlug(slug);
    try {
      await unpinProblem(slug);
    } catch (err) {
      toast.error(err.message || "Failed to unpin problem");
    } finally {
      setBusySlug(null);
    }
  }

  const atCap = pinnedProblems.length >= MAX_PINNED;

  return (
    <SectionCard
      title="Pinned Problems"
      icon={<Pin size={18} strokeWidth={2} />}
      subtitle="Showcase your best solves shown on your public profile."
      accented
      collapsible={collapsible}
      defaultOpen={false}
      storageKey="profile-collapse-pinned"
    >
      {pinnedProblems.length === 0 && !pickerOpen ? (
        <EmptyState
          icon={<Pin size={28} strokeWidth={1.75} />}
          title="Nothing pinned yet"
          description="Pin a few of your best solved problems to show recruiters what you can do."
          actionLabel="Pin a problem"
          onAction={() => setPickerOpen(true)}
          compact
        />
      ) : (
        <div className="space-y-3">
          {pinnedProblems.map((p) => (
            <div
              key={p.slug}
              className="flex items-center justify-between bg-[var(--surface-elevated)] rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {!hideDifficulty && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${DIFFICULTY_COLOR[p.difficulty] || "text-[var(--muted-foreground)] border-[var(--border-strong)] bg-[var(--surface-elevated)]"}`}
                  >
                    {p.difficulty}
                  </span>
                )}
                <Link
                  to={`/problems/${p.slug}`}
                  className="text-sm font-medium truncate hover:text-[var(--theme-primary,#2dd4bf)] transition"
                >
                  {p.title}
                </Link>
              </div>
              <button
                onClick={() => handleUnpin(p.slug)}
                disabled={busySlug === p.slug}
                className="text-[var(--muted-foreground)] hover:text-red-400 text-xs flex-shrink-0 ml-4 transition disabled:opacity-50"
              >
                Unpin
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        {!pickerOpen ? (
          !atCap && pinnedProblems.length > 0 && (
            <button
              onClick={() => setPickerOpen(true)}
              className="text-sm hover:brightness-110 transition"
              style={{ color: theme.colors.primary }}
            >
              + Pin another problem
            </button>
          )
        ) : (
          <div className="bg-[var(--surface-elevated)]/50 border border-[var(--border-strong)] rounded-xl p-3">
            {atCap ? (
              <p className="text-[var(--muted-foreground)] text-sm">
                You've pinned the max of {MAX_PINNED}. Unpin one to add another.
              </p>
            ) : (
              <>
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your solved problems…"
                  className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm mb-2"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {pinnableOptions.length === 0 ? (
                    <p className="text-[var(--muted-foreground)] text-xs px-1 py-2">
                      {solvedProblems.length === 0
                        ? "Solve a problem first to be able to pin it."
                        : "No matching solved problems."}
                    </p>
                  ) : (
                    pinnableOptions.slice(0, 20).map((p) => (
                      <button
                        key={p.slug}
                        onClick={() => handlePin(p.slug)}
                        disabled={busySlug === p.slug}
                        className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded-lg hover:bg-[var(--surface-elevated)] transition disabled:opacity-50"
                      >
                        <span className="text-sm truncate">{p.title}</span>
                        {!hideDifficulty && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border flex-shrink-0 ml-2 ${DIFFICULTY_COLOR[p.difficulty] || "text-[var(--muted-foreground)] border-[var(--border-strong)]"}`}>
                            {p.difficulty}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
            <button
              onClick={() => { setPickerOpen(false); setSearch(""); }}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--muted-foreground)] mt-2 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export default PinnedProblems;
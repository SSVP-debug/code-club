import {
  useEffect,
  useMemo,
  useState
} from "react";
import { X, ChevronsLeft, ChevronsRight } from "lucide-react";

import { useTheme } from "../hooks/useTheme";
import { useAppContext } from "../hooks/useAppContext";
import { useProblems } from "../hooks/useProblems";
import { useLearningPaths } from "../hooks/useLearningPaths";
import { useCodeClubEdition } from "../hooks/useCodeClubEdition";
import ThemeSkin from "../themes/ThemeSkin";

import ProblemsTopbar from "../components/problem/common/ProblemsTopbar";
import CompanyTagsNotice from "../components/problem/common/CompanyTagsNotice";
import ProblemsNavigation from "../components/problem/navigation/ProblemsNavigation";
import LearningWorkspace from "../components/learning/LearningWorkspace";
import HoverTooltip from "../components/ui/HoverTooltip";

import BrowseView from "../components/problem/browse/BrowseView";
import PatternView from "../components/patterns/PatternView";
import PlaylistView from "../components/problem/playlists/PlaylistView";
import SavedView from "../components/problem/saved/SavedView";
import LearningPathsView from "../components/problem/learning-paths/LearningPathsView";
import CodeClubEditionHome from "../components/problem/code-club-edition/CodeClubEditionHome";

// View registry — add Company Tracks, Revision, AI Picks here only.
const VIEWS = {
  "code-club-edition": CodeClubEditionHome,
  browse: BrowseView,
  patterns: PatternView,
  playlists: PlaylistView,
  saved: SavedView,
  "learning-paths": LearningPathsView,
};

function ProblemsPage() {
  const { theme } = useTheme();
  const { problems, loading, error } = useProblems();
  const { solvedProblems, topicStats, currentStreak, solvedDifficulty, submissions } = useAppContext();

  // Code Club Edition missions are tagged with campaignCode and live in
  // MongoDB as real Problem documents (same catalog `problems` fetches),
  // by design — they run through the same execution engine and progress
  // tracking. But per the PRD, they must NOT appear mixed into Browse,
  // Learn by Pattern, Playlists, Saved, the total-problems count, or the
  // Learning Hub — those all get `standardProblems` instead. Only the
  // Code Club Edition view itself gets the full, unfiltered `problems`,
  // since useCodeClubEdition() needs the campaign missions present to
  // join against.
  const standardProblems = useMemo(
    // `comingSoon` problems (e.g. random-pick-with-weight, id 158) have no
    // working grading path yet — see docs/roadmap.md — so they're excluded
    // from the standard catalog the same way Code Club Edition missions are.
    () => problems.filter((p) => !p.campaignCode && !p.comingSoon),
    [problems]
  );
  const standardSlugSet = useMemo(
    () => new Set(standardProblems.map((p) => p.slug)),
    [standardProblems]
  );
  // The main Problems page's progress bar/solved-count is scoped to the
  // standard catalog only — a solved Code Club Edition mission still
  // counts toward XP and its own campaign's progress (shown in the
  // Edition hero), it just shouldn't inflate/deflate this unrelated stat.
  const standardSolvedProblems = useMemo(
    () => solvedProblems.filter((slug) => standardSlugSet.has(slug)),
    [solvedProblems, standardSlugSet]
  );

  // Reused (not re-derived) by the header's per-view count below — these
  // are the exact same hooks LearningPathsView and CodeClubEditionHome
  // call internally, so the header's numbers can never drift from what
  // the view itself is showing.
  const learningPaths = useLearningPaths(standardProblems, standardSolvedProblems);
  const { chapters: editionChapters, campaignProgress: editionProgress } =
    useCodeClubEdition(problems, solvedProblems);

  const [activeView, setActiveView] = useState(() => {
    try {
      return sessionStorage.getItem("cc_activeView") || "browse";
    } catch {
      return "browse";
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return sessionStorage.getItem("cc_sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });

  const [rightRailCollapsed, setRightRailCollapsed] = useState(() => {
    try {
      return sessionStorage.getItem("cc_rightRailCollapsed") === "true";
    } catch {
      return false;
    }
  });

  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      return sessionStorage.getItem("cc_search") || "";
    } catch {
      return "";
    }
  });

  const [selectedDifficulty, setSelectedDifficulty] = useState(() => {
    try {
      return sessionStorage.getItem("cc_difficulty") || "All";
    } catch {
      return "All";
    }
  });

  const [selectedTopic, setSelectedTopic] = useState(() => {
    try {
      return sessionStorage.getItem("cc_topic") || "All";
    } catch {
      return "All";
    }
  });

  const [hideSolved, setHideSolved] = useState(() => {
    try {
      return sessionStorage.getItem("cc_hideSolved") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("cc_activeView", activeView);
    } catch {
      // sessionStorage can throw (private browsing, storage disabled) —
      // fail open: the view preference just won't persist this session.
    }
  }, [activeView]);

  useEffect(() => {
    try {
      sessionStorage.setItem("cc_sidebarCollapsed", String(sidebarCollapsed));
    } catch {
      // Same fail-open reasoning as the view-mode effect above.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      sessionStorage.setItem("cc_rightRailCollapsed", String(rightRailCollapsed));
    } catch {
      // Same fail-open reasoning as the view-mode effect above.
    }
  }, [rightRailCollapsed]);

  useEffect(() => {
    try {
      sessionStorage.setItem("cc_search", searchTerm);
    } catch {
      // Same fail-open reasoning as the view-mode effect above.
    }
  }, [searchTerm]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "cc_difficulty",
        selectedDifficulty
      );
    } catch {
      // Same fail-open reasoning as the view-mode effect above.
    }
  }, [selectedDifficulty]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "cc_topic",
        selectedTopic
      );
    } catch {
      // Same fail-open reasoning as the view-mode effect above.
    }
  }, [selectedTopic]);

  function toggleHideSolved() {
    setHideSolved((prev) => {
      const next = !prev;

      try {
        sessionStorage.setItem(
          "cc_hideSolved",
          String(next)
        );
      } catch {
        // Same fail-open reasoning as the view-mode effect above.
      }

      return next;
    });
  }

  const solvedCount = standardSolvedProblems.length;

  // Attempted = distinct problems with at least one submission, solved or
  // not — same "distinct problemSlug" shape the backend already stores per
  // submission (see backend/models/Submission.js). Real data, not a stored
  // counter, since nothing tracks "attempted" as its own field today.
  const attemptedCount = new Set(
    (submissions || []).map((s) => s.problemSlug)
  ).size;

  const progress =
    standardProblems.length > 0
      ? Math.round(
        (solvedCount / standardProblems.length) * 100
      )
      : 0;


  const topics = useMemo(() => {
    const unique = [
      ...new Set(
        standardProblems.map((p) => p.topic).filter(Boolean)
      ),
    ];

    return [
      "All",
      ...unique.sort((a, b) =>
        a.localeCompare(b)
      ),
    ];
  }, [standardProblems]);

  // Live suggestion chips shown under the search box as the person types.
  // Topics already have their own always-visible chip row below, so this
  // only surfaces companies and patterns — the two dimensions search
  // couldn't reach before ("Google", "sliding window") — capped to a
  // handful, ranked by how many problems each match covers.
  const searchSuggestions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length < 2) return [];

    const counts = new Map(); // "type:value" -> { type, value, count }

    for (const problem of standardProblems) {
      if (problem.pattern?.toLowerCase().includes(term)) {
        const key = `pattern:${problem.pattern}`;
        counts.set(key, {
          type: "pattern",
          value: problem.pattern,
          count: (counts.get(key)?.count || 0) + 1,
        });
      }
      for (const company of problem.companies || []) {
        if (!company.toLowerCase().includes(term)) continue;
        const key = `company:${company}`;
        counts.set(key, {
          type: "company",
          value: company,
          count: (counts.get(key)?.count || 0) + 1,
        });
      }
    }

    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [standardProblems, searchTerm]);

  const filtered = useMemo(() => {
    return standardProblems.filter((problem) => {
      const matchesDifficulty =
        selectedDifficulty === "All" ||
        problem.difficulty === selectedDifficulty;

      const matchesTopic =
        selectedTopic === "All" ||
        problem.topic === selectedTopic;

      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        term === "" ||
        problem.title.toLowerCase().includes(term) ||
        problem.topic?.toLowerCase().includes(term) ||
        problem.pattern?.toLowerCase().includes(term) ||
        problem.companies?.some((c) => c.toLowerCase().includes(term));

      const matchesSolved =
        !hideSolved ||
        !solvedProblems.includes(problem.slug);

      return (
        matchesDifficulty &&
        matchesTopic &&
        matchesSearch &&
        matchesSolved
      );
    });
  }, [
    standardProblems,
    selectedDifficulty,
    selectedTopic,
    searchTerm,
    hideSolved,
    solvedProblems,
  ]);

  const learningPathsTotalProblems = useMemo(
    () => learningPaths.reduce((sum, path) => sum + path.problems.length, 0),
    [learningPaths]
  );

  const releasedEditionChapters = useMemo(
    () => editionChapters.filter((c) => !c.comingSoon),
    [editionChapters]
  );

  // Each workspace view covers a different slice of content, so "Showing
  // X of Y problems" (which only makes sense for Browse's filter/search)
  // was misleading everywhere else — it always read as if every view held
  // the full 250-problem catalog. This is that count, scoped per view.
  // Playlists/Saved are still "Coming soon" stubs with no real data behind
  // them yet, so they intentionally render no count rather than a fake one.
  const viewSummary = useMemo(() => {
    switch (activeView) {
      case "browse":
        return `Showing ${filtered.length} of ${standardProblems.length} problems`;
      case "patterns":
        return `${standardProblems.length} problems across ${topics.length - 1} topics`;
      case "learning-paths":
        return `${learningPaths.length} learning paths · ${learningPathsTotalProblems} problems`;
      case "code-club-edition":
        return `${releasedEditionChapters.length} chapters · ${editionProgress.totalMissions} missions`;
      default:
        return null;
    }
  }, [
    activeView,
    filtered.length,
    standardProblems.length,
    topics.length,
    learningPaths.length,
    learningPathsTotalProblems,
    releasedEditionChapters.length,
    editionProgress.totalMissions,
  ]);

  // The center column's reading width used to be a fixed max-w-4xl no
  // matter what — so collapsing a sidebar freed up real horizontal space
  // in the flex layout, but the problems list itself never grew into it.
  // This steps the cap up with each sidebar that's collapsed so the list
  // actually uses the space it's been given instead of leaving it as a
  // dead margin. Both open keeps the original cozy 4xl reading width;
  // both collapsed lets it breathe out to 6xl.
  const collapsedSidebarCount =
    (sidebarCollapsed ? 1 : 0) + (rightRailCollapsed ? 1 : 0);
  const contentMaxWidthClass =
    collapsedSidebarCount === 2
      ? "max-w-6xl"
      : collapsedSidebarCount === 1
      ? "max-w-5xl"
      : "max-w-4xl";

  // Learning hub (right rail) collapses off-screen below the `xl` breakpoint —
  // there simply isn't width for a 3-column layout on tablet/phone. This
  // state drives it as a slide-over sheet instead, toggled from the topbar.
  const [learningHubOpen, setLearningHubOpen] = useState(false);

  // Shared by AICoachCard (right rail) — same "jump into Browse pre-filtered"
  // behavior as PatternView's topic cards, just triggered from a different
  // surface. Also closes the mobile slide-over so the person actually lands
  // on Browse instead of staring at a hub sheet over it.
  function handlePracticeTopic(topic) {
    setSelectedTopic(topic);
    setActiveView("browse");
    setLearningHubOpen(false);
  }

  const ActiveView = VIEWS[activeView] ?? null;

  const browseProps =
    activeView === "browse"
      ? {
        loading,
        error,
        filtered,
        topics,
        selectedTopic,
        setSelectedTopic,
        selectedDifficulty,
        setSelectedDifficulty,
        searchTerm,
        setSearchTerm,
        searchSuggestions,
        hideSolved,
        toggleHideSolved,
      }
      : {};

  const patternsProps =
    activeView === "patterns"
      ? {
        problems: standardProblems,
        topicStats,
        setSelectedTopic,
        setActiveView,
      }
      : {};

  const learningPathsProps =
    activeView === "learning-paths"
      ? { problems: standardProblems, solvedProblems: standardSolvedProblems }
      : {};

  const codeClubEditionProps =
    activeView === "code-club-edition"
      ? { problems, solvedProblems }
      : {};

  const activeViewProps = { ...browseProps, ...patternsProps, ...learningPathsProps, ...codeClubEditionProps };

  return (
    <ThemeSkin>
    <div className="relative isolate h-screen flex flex-col bg-transparent text-[var(--foreground)] overflow-hidden">

      {/* Slim topbar — replaces global Navbar */}
      <ProblemsTopbar
        totalProblems={standardProblems.length}
        solvedCount={solvedCount}
        progress={progress}
        currentStreak={currentStreak}
      />

      {/* Company tags (ProblemCard, BrowseToolbar) are placeholder/test
          data for every problem right now, not real verified data — see
          CompanyTagsNotice.jsx. Dismissible, so it only nags once. */}
      <CompanyTagsNotice />

      {/* ── Mobile/tablet workspace nav — horizontal pill strip, replaces
             the left sidebar below `lg`. Sits right under the topbar. ── */}
      <div className="lg:hidden border-b border-[var(--border)] bg-[var(--background)]">
        <ProblemsNavigation
          activeView={activeView}
          setActiveView={setActiveView}
          orientation="horizontal"
        />
      </div>

      {/* 3-column body on desktop; single column + slide-over on mobile */}
      <div className="flex flex-1 min-h-0 relative">

        {/* ── LEFT: workspace nav — desktop only, `lg` swaps in the strip above ── */}
        <aside
          className={`hidden lg:flex flex-col flex-shrink-0 border-r border-[var(--border)] bg-[var(--background)] overflow-y-auto transition-all duration-200 ${
            sidebarCollapsed ? "w-16" : "w-56"
          }`}
          style={{ scrollbarWidth: "none" }}
        >
          <div className={`p-3 pt-4 flex-1 ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
            <div className={`flex items-center mb-3 ${sidebarCollapsed ? "justify-center" : "justify-between px-3"}`}>
              {!sidebarCollapsed && (
                <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Workspace
                </p>
              )}
              <button
                onClick={() => setSidebarCollapsed((c) => !c)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] transition flex-shrink-0"
              >
                {sidebarCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
              </button>
            </div>
            <ProblemsNavigation
              activeView={activeView}
              setActiveView={setActiveView}
              collapsed={sidebarCollapsed}
            />
          </div>
        </aside>

        {/* ── CENTER: only this column scrolls ── */}
        <main
          className="flex-1 min-w-0 bg-[var(--background)] overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border-strong) transparent" }}
        >
          <div className={`px-4 sm:px-7 py-4 sm:py-6 transition-[max-width] duration-200 ${contentMaxWidthClass}`}>

            {/* Page header — tighter than before */}
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {theme.words.problems}
                </h1>
                <p className="text-[var(--muted-foreground)] mt-0.5 text-sm">{theme.description}</p>
                {viewSummary && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-2">{viewSummary}</p>
                )}
              </div>

              {/* Learning hub toggle — only needed where the right rail is hidden */}
              <button
                onClick={() => setLearningHubOpen(true)}
                className="xl:hidden flex-shrink-0 flex items-center gap-1.5 rounded-full bg-[var(--surface)] border border-[var(--border-strong)] px-3.5 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] transition"
              >
                Learning Hub
              </button>
            </div>

            {ActiveView && <ActiveView {...activeViewProps} />}

          </div>
        </main>

        {/* ── RIGHT: learning hub — desktop (xl+) inline sidebar ── */}
        {rightRailCollapsed ? (
          <aside className="hidden xl:flex flex-col items-center flex-shrink-0 w-12 border-l border-[var(--border)] bg-[var(--background)] pt-4">
            <HoverTooltip label="Open Learning Hub" side="left">
              <button
                onClick={() => setRightRailCollapsed(false)}
                aria-label="Open Learning Hub"
                className="p-2 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] transition"
              >
                <ChevronsLeft size={16} />
              </button>
            </HoverTooltip>
          </aside>
        ) : (
          <aside
            className="hidden xl:block w-80 flex-shrink-0 border-l border-[var(--border)] bg-[var(--background)] overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="flex items-center justify-between px-4 pt-4">
              <span className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Learning Hub
              </span>
              <button
                onClick={() => setRightRailCollapsed(true)}
                aria-label="Collapse Learning Hub"
                className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] transition"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
            <LearningWorkspace
              problems={standardProblems}
              solvedCount={solvedCount}
              progress={progress}
              topicStats={topicStats}
              solvedDifficulty={solvedDifficulty}
              attemptedCount={attemptedCount}
              submissions={submissions}
              currentStreak={currentStreak}
              onPracticeTopic={handlePracticeTopic}
            />
          </aside>
        )}

        {/* ── Learning hub — mobile/tablet slide-over sheet ── */}
        {learningHubOpen && (
          <>
            <div
              className="xl:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setLearningHubOpen(false)}
            />
            <aside className="xl:hidden fixed top-0 right-0 h-full w-full sm:w-96 z-50 bg-[var(--background)] border-l border-[var(--border)] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] sticky top-0 bg-[var(--background)]">
                <span className="text-sm font-bold text-[var(--foreground)]">Learning Hub</span>
                <button
                  onClick={() => setLearningHubOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] transition text-[var(--muted-foreground)]"
                  aria-label="Close learning hub"
                >
                  <X size={16} />
                </button>
              </div>
              <LearningWorkspace
                problems={standardProblems}
                solvedCount={solvedCount}
                progress={progress}
                topicStats={topicStats}
                solvedDifficulty={solvedDifficulty}
                attemptedCount={attemptedCount}
                submissions={submissions}
                currentStreak={currentStreak}
                onPracticeTopic={handlePracticeTopic}
              />
            </aside>
          </>
        )}

      </div>

    </div>
    </ThemeSkin>
  );
}

export default ProblemsPage;
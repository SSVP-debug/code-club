import { useEffect, useMemo, useState } from "react";
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

const VIEWS = {
  "code-club-edition": CodeClubEditionHome,
  browse: BrowseView,
  patterns: PatternView,
  playlists: PlaylistView,
  saved: SavedView,
  "learning-paths": LearningPathsView,
};

function readSessionBoolean(key, fallback = false) {
  try { return sessionStorage.getItem(key) === "true"; } catch { return fallback; }
}

function readSessionString(key, fallback = "") {
  try { return sessionStorage.getItem(key) || fallback; } catch { return fallback; }
}

function ProblemsPage() {
  const { theme } = useTheme();
  const { solvedProblems, topicStats, currentStreak, solvedDifficulty, submissions } = useAppContext();

  const [activeView, setActiveView] = useState(() => readSessionString("cc_activeView", "browse"));
  const [browsePage, setBrowsePage] = useState(1);
  const [browseCursor, setBrowseCursor] = useState(null);
  const [browseCursorHistory, setBrowseCursorHistory] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSessionBoolean("cc_sidebarCollapsed"));
  const [rightRailCollapsed, setRightRailCollapsed] = useState(() => readSessionBoolean("cc_rightRailCollapsed"));
  const [searchTerm, setSearchTerm] = useState(() => readSessionString("cc_search"));
  const [selectedDifficulty, setSelectedDifficulty] = useState(() => readSessionString("cc_difficulty", "All"));
  const [selectedTopic, setSelectedTopic] = useState(() => readSessionString("cc_topic", "All"));
  const [hideSolved, setHideSolved] = useState(() => readSessionBoolean("cc_hideSolved"));
  const [learningHubOpen, setLearningHubOpen] = useState(false);

  const browseCatalog = useProblems({
    enabled: activeView === "browse",
    paginated: true,
    page: browsePage,
    limit: 30,
    cursor: browseCursor,
    searchTerm,
    selectedDifficulty,
    selectedTopic,
    scope: "standard",
  });
  const fullCatalog = useProblems({ enabled: activeView !== "browse" });
  const catalog = activeView === "browse" ? browseCatalog : fullCatalog;
  const { problems, loading, error } = catalog;
  const pagination = browseCatalog.pagination;

  const standardProblems = useMemo(
    () => problems.filter((p) => !p.campaignCode && !p.comingSoon),
    [problems]
  );
  const standardSlugSet = useMemo(() => new Set(standardProblems.map((p) => p.slug)), [standardProblems]);
  const standardSolvedProblems = useMemo(
    () => solvedProblems.filter((slug) => standardSlugSet.has(slug)),
    [solvedProblems, standardSlugSet]
  );

  const learningPaths = useLearningPaths(standardProblems, standardSolvedProblems);
  const { chapters: editionChapters, campaignProgress: editionProgress } = useCodeClubEdition(problems, solvedProblems);

  useEffect(() => {
    try { sessionStorage.setItem("cc_activeView", activeView); } catch {}
  }, [activeView]);
  useEffect(() => {
    try { sessionStorage.setItem("cc_sidebarCollapsed", String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);
  useEffect(() => {
    try { sessionStorage.setItem("cc_rightRailCollapsed", String(rightRailCollapsed)); } catch {}
  }, [rightRailCollapsed]);
  useEffect(() => {
    try { sessionStorage.setItem("cc_search", searchTerm); } catch {}
  }, [searchTerm]);
  useEffect(() => {
    try { sessionStorage.setItem("cc_difficulty", selectedDifficulty); } catch {}
  }, [selectedDifficulty]);
  useEffect(() => {
    try { sessionStorage.setItem("cc_topic", selectedTopic); } catch {}
  }, [selectedTopic]);

  function resetBrowsePage() {
    setBrowsePage(1);
    setBrowseCursor(null);
    setBrowseCursorHistory([]);
  }
  function handleSearchChange(value) { setSearchTerm(value); resetBrowsePage(); }
  function handleDifficultyChange(value) { setSelectedDifficulty(value); resetBrowsePage(); }
  function handleTopicChange(value) { setSelectedTopic(value); resetBrowsePage(); }
  function toggleHideSolved() {
    setHideSolved((prev) => {
      const next = !prev;
      try { sessionStorage.setItem("cc_hideSolved", String(next)); } catch {}
      return next;
    });
  }
  function handleViewChange(view) {
    setActiveView(view);
    if (view === "browse") resetBrowsePage();
  }
  function handlePracticeTopic(topic) {
    handleTopicChange(topic);
    handleViewChange("browse");
    setLearningHubOpen(false);
  }

  const solvedCount = activeView === "browse" ? solvedProblems.length : standardSolvedProblems.length;
  const totalProblems = activeView === "browse" ? pagination.total : standardProblems.length;
  const progress = totalProblems > 0 ? Math.round((solvedCount / totalProblems) * 100) : 0;
  const attemptedCount = new Set((submissions || []).map((s) => s.problemSlug)).size;

  const topics = activeView === "browse"
    ? ["All", ...browseCatalog.topics]
    : ["All", ...[...new Set(standardProblems.map((p) => p.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b))];

  const browseProblems = useMemo(
    () => hideSolved ? standardProblems.filter((problem) => !solvedProblems.includes(problem.slug)) : standardProblems,
    [standardProblems, hideSolved, solvedProblems]
  );

  const learningPathsTotalProblems = useMemo(
    () => learningPaths.reduce((sum, path) => sum + path.problems.length, 0),
    [learningPaths]
  );
  const releasedEditionChapters = useMemo(() => editionChapters.filter((c) => !c.comingSoon), [editionChapters]);

  const viewSummary = useMemo(() => {
    switch (activeView) {
      case "browse":
        return totalProblems === 0 ? "No problems match these filters" : `Showing page ${pagination.page} · ${pagination.total} problems in the standard catalog`;
      case "patterns":
        return `${standardProblems.length} problems across ${Math.max(0, topics.length - 1)} topics`;
      case "learning-paths":
        return `${learningPaths.length} learning paths · ${learningPathsTotalProblems} problems`;
      case "code-club-edition":
        return `${releasedEditionChapters.length} chapters · ${editionProgress.totalMissions} missions`;
      default:
        return null;
    }
  }, [activeView, totalProblems, pagination.page, pagination.total, standardProblems.length, topics.length, learningPaths.length, learningPathsTotalProblems, releasedEditionChapters.length, editionProgress.totalMissions]);

  const collapsedSidebarCount = (sidebarCollapsed ? 1 : 0) + (rightRailCollapsed ? 1 : 0);
  const contentMaxWidthClass = collapsedSidebarCount === 2 ? "max-w-6xl" : collapsedSidebarCount === 1 ? "max-w-5xl" : "max-w-4xl";
  const ActiveView = VIEWS[activeView] ?? null;

  const browseProps = activeView === "browse" ? {
    loading,
    error,
    filtered: browseProblems,
    topics,
    selectedTopic,
    setSelectedTopic: handleTopicChange,
    selectedDifficulty,
    setSelectedDifficulty: handleDifficultyChange,
    searchTerm,
    setSearchTerm: handleSearchChange,
    searchSuggestions: [],
    hideSolved,
    toggleHideSolved,
    pagination,
    onPreviousPage: () => {
      setBrowseCursorHistory((history) => {
        const nextHistory = [...history];
        const previousCursor = nextHistory.pop() ?? null;
        setBrowseCursor(previousCursor);
        setBrowsePage((page) => Math.max(1, page - 1));
        return nextHistory;
      });
    },
    onNextPage: () => {
      if (!pagination?.nextCursor) return;
      setBrowseCursorHistory((history) => [...history, browseCursor]);
      setBrowseCursor(pagination.nextCursor);
      setBrowsePage((page) => page + 1);
    },
  } : {};

  const patternsProps = activeView === "patterns" ? {
    problems: standardProblems,
    topicStats,
    setSelectedTopic: handleTopicChange,
    setActiveView: handleViewChange,
  } : {};
  const learningPathsProps = activeView === "learning-paths" ? { problems: standardProblems, solvedProblems: standardSolvedProblems } : {};
  const codeClubEditionProps = activeView === "code-club-edition" ? { problems, solvedProblems } : {};
  const activeViewProps = { ...browseProps, ...patternsProps, ...learningPathsProps, ...codeClubEditionProps };

  return (
    <ThemeSkin>
      <div className="relative isolate h-screen flex flex-col bg-transparent text-[var(--foreground)] overflow-hidden">
        <ProblemsTopbar totalProblems={totalProblems} solvedCount={solvedCount} progress={progress} currentStreak={currentStreak} />
        <CompanyTagsNotice />
        <div className="lg:hidden border-b border-[var(--border)] bg-[var(--background)]">
          <ProblemsNavigation activeView={activeView} setActiveView={handleViewChange} orientation="horizontal" />
        </div>

        <div className="flex flex-1 min-h-0 relative">
          <aside className={`hidden lg:flex flex-col flex-shrink-0 border-r border-[var(--border)] bg-[var(--background)] overflow-y-auto transition-all duration-200 ${sidebarCollapsed ? "w-16" : "w-56"}`} style={{ scrollbarWidth: "none" }}>
            <div className={`p-3 pt-4 flex-1 ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
              <div className={`flex items-center mb-3 ${sidebarCollapsed ? "justify-center" : "justify-between px-3"}`}>
                {!sidebarCollapsed && <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Workspace</p>}
                <button onClick={() => setSidebarCollapsed((c) => !c)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] transition flex-shrink-0">
                  {sidebarCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
                </button>
              </div>
              <ProblemsNavigation activeView={activeView} setActiveView={handleViewChange} collapsed={sidebarCollapsed} />
            </div>
          </aside>

          <main className="flex-1 min-w-0 bg-[var(--background)] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border-strong) transparent" }}>
            <div className={`px-4 sm:px-7 py-4 sm:py-6 transition-[max-width] duration-200 ${contentMaxWidthClass}`}>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{theme.words.problems}</h1>
                  <p className="text-[var(--muted-foreground)] mt-0.5 text-sm">{theme.description}</p>
                  {viewSummary && <p className="text-xs text-[var(--muted-foreground)] mt-2">{viewSummary}</p>}
                </div>
                <button onClick={() => setLearningHubOpen(true)} className="xl:hidden flex-shrink-0 flex items-center gap-1.5 rounded-full bg-[var(--surface)] border border-[var(--border-strong)] px-3.5 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition">Learning Hub</button>
              </div>
              {ActiveView && <ActiveView {...activeViewProps} />}
            </div>
          </main>

          {rightRailCollapsed ? (
            <aside className="hidden xl:flex flex-col items-center flex-shrink-0 w-12 border-l border-[var(--border)] bg-[var(--background)] pt-4">
              <HoverTooltip label="Open Learning Hub" side="left">
                <button onClick={() => setRightRailCollapsed(false)} aria-label="Open Learning Hub" className="p-2 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] transition"><ChevronsLeft size={16} /></button>
              </HoverTooltip>
            </aside>
          ) : (
            <aside className="hidden xl:block w-80 flex-shrink-0 border-l border-[var(--border)] bg-[var(--background)] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              <div className="flex items-center justify-between px-4 pt-4">
                <span className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Learning Hub</span>
                <button onClick={() => setRightRailCollapsed(true)} aria-label="Collapse Learning Hub" className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)] transition"><ChevronsRight size={14} /></button>
              </div>
              <LearningWorkspace problems={standardProblems} solvedCount={solvedCount} progress={progress} topicStats={topicStats} solvedDifficulty={solvedDifficulty} attemptedCount={attemptedCount} submissions={submissions} currentStreak={currentStreak} onPracticeTopic={handlePracticeTopic} />
            </aside>
          )}

          {learningHubOpen && (
            <>
              <div className="xl:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setLearningHubOpen(false)} />
              <aside className="xl:hidden fixed top-0 right-0 h-full w-full sm:w-96 z-50 bg-[var(--background)] border-l border-[var(--border)] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] sticky top-0 bg-[var(--background)]">
                  <span className="text-sm font-bold text-[var(--foreground)]">Learning Hub</span>
                  <button onClick={() => setLearningHubOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] transition text-[var(--muted-foreground)]" aria-label="Close learning hub"><X size={16} /></button>
                </div>
                <LearningWorkspace problems={standardProblems} solvedCount={solvedCount} progress={progress} topicStats={topicStats} solvedDifficulty={solvedDifficulty} attemptedCount={attemptedCount} submissions={submissions} currentStreak={currentStreak} onPracticeTopic={handlePracticeTopic} />
              </aside>
            </>
          )}
        </div>
      </div>
    </ThemeSkin>
  );
}

export default ProblemsPage;

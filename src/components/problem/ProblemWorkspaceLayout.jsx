/**
 * ProblemWorkspaceLayout — replaces ProblemSolverDesktopView +
 * ProblemSolverMobileView with a single component tree.
 *
 * ── Why this file exists (Batch 1 of the workspace redesign) ──────────────
 * The previous two-component split rendered BOTH the desktop split-view and
 * the mobile tabbed-view at all times, toggling visibility with Tailwind's
 * `hidden lg:flex` / `flex lg:hidden` classes. That's CSS-only visibility —
 * React still mounted both trees, so:
 *
 *   1. A <ProblemEditor> (and therefore a full Monaco instance) existed on
 *      EVERY device regardless of viewport — on an actual phone, the
 *      desktop split-view's editor was mounted invisibly (display:none),
 *      paying full Monaco init cost for nothing.
 *   2. On mobile, the tabbed view additionally *conditionally rendered*
 *      its own editor only `{mobileTab === "code" && <ProblemEditor/>}`
 *      — so switching away from the Code tab and back unmounted and
 *      remounted Monaco, silently losing cursor position and undo history.
 *
 * This file fixes both: there is exactly ONE <ProblemEditor> and ONE
 * <WorkspacePanel> in the tree, always mounted, at a fixed position in the
 * component hierarchy. Desktop vs. mobile, and mobile's active tab, are
 * expressed ONLY as className/style changes on their wrapper elements
 * (including CSS `display: contents` where a wrapper needs to disappear
 * layout-wise without disappearing from the DOM). Swapping a prop on an
 * element never remounts it — only changing an element's *position* in the
 * tree does — so this guarantees Monaco survives every tab switch and every
 * viewport resize/rotation.
 *
 * `useMediaQuery` (not a static Tailwind breakpoint) drives `isDesktop`
 * because a few desktop-only values (problemWidth/editorHeight, in pixels
 * and percent, from the resize-drag hooks) need to be applied or withheld
 * in JS, not just CSS.
 *
 * ── Batch 2: the Understand → Build → Validate stage machine ──────────────
 * `useWorkspaceStage` drives a Stage-1 reading overlay and progressive
 * testcase reveal — see that hook and ProblemUnderstandOverlay.jsx.
 *
 * ── Batch 3: WORKSPACE_V2_ENABLED ──────────────────────────────────────────
 * The Batch 2 behavior is gated behind a feature flag (src/config/
 * featureFlags.js). Flag OFF pins `stage` to "build" and `showValidation`
 * to always-true, which reproduces the exact pre-redesign layout (panel
 * always visible, no overlay) without a second copy of this component —
 * there is deliberately only ever one workspace component to maintain.
 */
import ErrorBanner from "../ErrorBanner";
import ErrorBoundary from "../ErrorBoundary";
import SubmissionResultBanner from "../workspace/SubmissionResultBanner";
import ProblemHeader from "./ProblemHeader";
import ProblemInfo from "./ProblemInfo";
import MissionHeader from "./code-club-edition/MissionHeader";
import ProblemEditor from "./ProblemEditor";
import WorkspacePanel from "./WorkspacePanel";
import ProblemUnderstandOverlay from "./ProblemUnderstandOverlay";
import UniverseWorkspaceHeader from "./UniverseWorkspaceHeader";
import SubmissionCelebrationModal from "./submission-experience/SubmissionCelebrationModal";
import Button from "../ui/Button";
import MobileTabBar from "./MobileTabBar";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useWorkspaceStage } from "../../hooks/useWorkspaceStage";
import { WORKSPACE_V2_ENABLED } from "../../config/featureFlags";

// Tailwind's default `lg` breakpoint — kept as one constant so the JS
// breakpoint and the (few) remaining Tailwind `lg:` classes below can never
// silently drift apart.
const DESKTOP_QUERY = "(min-width: 1024px)";

function ProblemWorkspaceLayout({ problem, slug, solver, nextBestProblem, editionChapterId }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const {
    isSolved,
    timerFormatted,
    editorHeight,
    setEditorHeight,
    problemWidth,
    setProblemWidth,
    language,
    code,
    setCode,
    customInput,
    setCustomInput,
    running,
    submitting,
    error,
    runResults,
    submitInfo,
    mobileTab,
    setMobileTab,
    forceTab,
    hasResults,
    handleLanguageChange,
    handleResetCode,
    handleRunCode,
    handleSubmitCode,
  } = solver;

  const stageMachine = useWorkspaceStage({ isSolved, hasResults });
  // Flag OFF: stage is pinned to "build" so the overlay condition
  // (`stage === "understand"`) below can never be true, and validation
  // visibility is pinned to always-on — together this reproduces the
  // exact pre-redesign behavior with zero duplicated layout code. Flag ON:
  // the real Understand → Build → Validate progression from the stage
  // machine.
  const stage = WORKSPACE_V2_ENABLED ? stageMachine.stage : "build";
  const enterBuild = stageMachine.enterBuild;

  // The single visibility rule for all three panels. Desktop always shows
  // all three (split view); mobile shows exactly the one matching the
  // active tab. This is the ONLY thing that changes between breakpoints —
  // every panel below stays mounted at the same tree position regardless.
  const panelVisible = {
    info: isDesktop || mobileTab === "problem",
    editor: isDesktop || mobileTab === "code",
    workspace: isDesktop || mobileTab === "results",
  };

  // Panel-reveal timing is keyed directly to `hasResults`, not `stage` —
  // `stage` flips to "validate" one render tick later (its useEffect runs
  // after the render where hasResults first becomes true), which would
  // cost a one-frame flash of "still build" right when the student's
  // eyes are on the screen waiting for their result. `stage` still exists
  // and is exposed below for the overlay/blur and any future stage-keyed
  // behavior — this is just the one spot that can't afford the lag.
  // Flag OFF: always true (workspace panel always visible, matching the
  // pre-redesign layout).
  const showValidation = WORKSPACE_V2_ENABLED ? hasResults : true;

  // Flag OFF: mobile's Results tab is always clickable, matching the
  // pre-redesign MobileTabBar (it never gated on having results yet).
  const resultsTabEnabled = WORKSPACE_V2_ENABLED ? hasResults : true;

  return (
    <div className="relative h-full w-full universe-workspace">
      <UniverseWorkspaceHeader stage={stage} isSolved={isSolved} />
      <div
        // `inert` (native attribute) removes the whole subtree from the
        // tab order and from find-in-page/AT focus while the overlay is
        // open — cheaper and more correct than hand-rolling pointer-events
        // + aria-hidden, and it can't drift out of sync the way two
        // separate props could.
        inert={stage === "understand"}
        className={
          (isDesktop
            ? "h-full flex overflow-hidden bg-[var(--background)] px-3 py-2 gap-3"
            : "flex flex-col h-full overflow-hidden") +
          (stage === "understand" ? " blur-sm brightness-75 scale-[0.99] transition-all duration-300" : " transition-all duration-300")
        }
      >
        {!isDesktop && (
          <MobileTabBar active={mobileTab} onChange={setMobileTab} hasResults={hasResults} resultsEnabled={resultsTabEnabled} />
        )}

        <div
          className={
            isDesktop
              ? "flex h-full w-full overflow-hidden relative"
              : "flex-1 min-h-0 overflow-y-auto bg-[var(--background)]"
          }
        >
          {/* ── Info panel (Problem tab on mobile) ─────────────────────────── */}
          <div
            className={
              isDesktop
                ? "h-full overflow-hidden"
                : panelVisible.info
                  ? "p-4 bg-[var(--surface)] min-h-full"
                  : "hidden"
            }
            style={isDesktop ? { width: `${problemWidth}%` } : undefined}
          >
            <div
              className={
                isDesktop
                  ? "h-full overflow-y-auto custom-scrollbar bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xl"
                  : undefined
              }
            >
              {!isDesktop && !isSolved && (
                <div className="mb-4">
                  <span className="text-xs font-mono text-[var(--muted-foreground)]">⏱ {timerFormatted}</span>
                </div>
              )}
              <MissionHeader chapterId={editionChapterId} slug={slug} />
              <ProblemHeader problem={problem} isSolved={isSolved} />
              <ProblemInfo problem={problem} />
              {!isDesktop && (
                <Button onClick={() => setMobileTab("code")} className="mt-6 w-full">
                  Start Coding →
                </Button>
              )}
            </div>
          </div>

          {/* Resize handle (horizontal — problem/editor split). A thin 1px
              line is the only thing visible; the surrounding w-2 (8px) box
              is just a generous invisible hit-area so it's still easy to
              grab — same idea VS Code/most split-pane editors use. Panel
              and handle sit flush against each other now (no flex `gap` +
              handle-margin stacking, which is what made the old gap huge).
              Stateless UI, safe to actually unmount when not on desktop. */}
          {isDesktop && (
            <div
              className="relative w-2 flex-shrink-0 cursor-col-resize group"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = problemWidth;
                const handleMove = (moveEvent) => {
                  const delta = ((moveEvent.clientX - startX) / window.innerWidth) * 100;
                  setProblemWidth(Math.min(75, Math.max(20, startWidth + delta)));
                };
                const handleUp = () => {
                  window.removeEventListener("mousemove", handleMove);
                  window.removeEventListener("mouseup", handleUp);
                };
                window.addEventListener("mousemove", handleMove);
                window.addEventListener("mouseup", handleUp);
              }}
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[var(--border-strong)] group-hover:bg-[var(--theme-primary,#2dd4bf)] transition-colors" />
            </div>
          )}

          {/* ── Editor + Workspace column ───────────────────────────────────
              `display: contents` on mobile removes this wrapper from layout
              (children stack directly in the scroll container above) without
              removing it — or them — from the DOM/React tree. */}
          <div
            className={isDesktop ? "h-full flex flex-col overflow-hidden" : "contents"}
            style={isDesktop ? { width: `${100 - problemWidth}%` } : undefined}
          >
            {error && (
              <div
                className={
                  isDesktop
                    ? "flex-shrink-0 pb-2"
                    : panelVisible.editor
                      ? "px-4 pt-3 flex-shrink-0"
                      : "hidden"
                }
              >
                <ErrorBanner
                  message={error}
                  onRetry={!running && !submitting ? handleRunCode : undefined}
                />
              </div>
            )}

            {/* Editor — always mounted, never remounted, regardless of
                breakpoint, active mobile tab, or stage. Before validation is
                earned, it fills the whole column on desktop (no split
                reserved) — the fixed height + resize handle only appear
                once there's something to split it with. */}
            <div
              className={
                isDesktop
                  ? showValidation
                    ? "flex-shrink-0"
                    : "flex-1 min-h-0 pb-2"
                  : panelVisible.editor
                    ? "flex flex-col h-full min-h-[calc(100vh-108px)]"
                    : "hidden"
              }
              style={isDesktop && showValidation ? { height: `${editorHeight}px` } : undefined}
            >
              <ErrorBoundary
                fallback={
                  <div className="h-full bg-[var(--surface)] border border-red-500 text-red-400 p-6 rounded-2xl">
                    Editor failed to load.
                  </div>
                }
              >
                <ProblemEditor
                  slug={slug}
                  language={language}
                  setLanguage={handleLanguageChange}
                  code={code}
                  setCode={setCode}
                  customInput={customInput}
                  setCustomInput={setCustomInput}
                  onRun={handleRunCode}
                  onSubmit={handleSubmitCode}
                  onReset={handleResetCode}
                  running={running}
                  submitting={submitting}
                />
              </ErrorBoundary>
            </div>

            {/* Resize handle (editor/results split). Same thin-line-in-a-
                generous-hit-area style as the horizontal handle above. Only
                meaningful once there IS a split — before validation,
                unmounting this is safe (stateless UI). */}
            {isDesktop && showValidation && (
              <div
                className="relative h-2 flex-shrink-0 cursor-row-resize group"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startHeight = editorHeight;
                  const handleMove = (moveEvent) => {
                    const delta = moveEvent.clientY - startY;
                    setEditorHeight(Math.min(600, Math.max(200, startHeight + delta)));
                  };
                  const handleUp = () => {
                    window.removeEventListener("mousemove", handleMove);
                    window.removeEventListener("mouseup", handleUp);
                  };
                  window.addEventListener("mousemove", handleMove);
                  window.addEventListener("mouseup", handleUp);
                }}
              >
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-[var(--border-strong)] group-hover:bg-[var(--theme-primary,#2dd4bf)] transition-colors" />
              </div>
            )}

            {/* Workspace/results — pretend it doesn't exist until the student
                has actually run or submitted something (per the original
                spec: "do NOT reserve empty space"). Genuinely unmounted, not
                just hidden — it holds no state worth preserving (its own
                tab selection resets harmlessly), unlike the editor above. */}
            {isDesktop ? (
              showValidation && (
                <div className="flex-1 min-h-0 flex flex-col animate-validate-panel-in">
                  <SubmissionResultBanner submitInfo={submitInfo} />
                  <div className="flex-1 min-h-0 overflow-hidden bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl">
                    <WorkspacePanel
                      runResults={runResults}
                      submitInfo={submitInfo}
                      isRunning={running}
                      isSubmitting={submitting}
                      forceTab={forceTab}
                      problem={problem}
                    />
                  </div>
                </div>
              )
            ) : (
              panelVisible.workspace && (
                <div className="p-4 animate-validate-panel-in">
                  <SubmissionResultBanner submitInfo={submitInfo} />
                  <WorkspacePanel
                    runResults={runResults}
                    submitInfo={submitInfo}
                    isRunning={running}
                    isSubmitting={submitting}
                    forceTab={forceTab}
                    problem={problem}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {stage === "understand" && (
        <ProblemUnderstandOverlay problem={problem} isSolved={isSolved} onProceed={enterBuild} />
      )}

      {/* Submission Experience (Feature 1): owns its own open/close state,
          keyed off submitInfo.submissionId — see that component's header
          comment. Always mounted so it can react the instant submitInfo
          transitions to Accepted, same pattern as ProblemUnderstandOverlay
          above. */}
      <SubmissionCelebrationModal
        submitInfo={submitInfo}
        problem={problem}
        nextBestProblem={nextBestProblem}
      />
    </div>
  );
}

export default ProblemWorkspaceLayout;
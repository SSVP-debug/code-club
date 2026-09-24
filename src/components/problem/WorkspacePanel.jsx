import { useState } from "react";
import { AlertTriangle, XCircle, Settings, Bug, Clock } from "lucide-react";
import TestcaseResultPanel from "./TestcaseResultPanel";
import { useTheme } from "../../hooks/useTheme";

// ── DebugPanel ────────────────────────────────────────────────────────────────

function DebugPanel({
    runResults,
    submitInfo,
    isRunning,
    isSubmitting,
    theme
}) {
    if (isRunning || isSubmitting) {
        return (
            <div className="p-5 space-y-3 animate-pulse">
                <div className="h-4 w-32 rounded bg-[var(--surface-elevated)]" />
                <div className="h-24 rounded-lg bg-[var(--surface-elevated)]" />
            </div>
        );
    }

    if (runResults?.compileFailed) {
        return (
            <div className="p-5 space-y-3">
                <ErrorHeader
                    kind="compile"
                    theme={theme}
                />
                <ErrorBlock text={runResults.error} color="yellow" />
            </div>
        );
    }

    if (runResults?.results?.length > 0) {
        const erroredCase = runResults.results.find(
            (r) =>
                r.error ||
                String(r.actual ?? "").trim().startsWith("RUNTIME_ERROR:")
        );
        if (erroredCase) {
            return (
                <div className="p-5 space-y-3">
                    <ErrorHeader kind="runtime" theme={theme} />
                    <div className="space-y-1.5">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
                            Example {erroredCase.index + 1}
                        </span>
                        <ErrorBlock text={erroredCase.error} color="red" />
                    </div>
                    {runResults.results.filter((r) => r.error).length > 1 && (
                        <p className="text-xs text-[var(--muted-foreground)] font-mono">
                            + {runResults.results.filter((r) => r.error).length - 1} more
                            runtime error{runResults.results.filter((r) => r.error).length > 2 ? "s" : ""}
                        </p>
                    )}
                </div>
            );
        }
    }

    if (runResults?.error && !runResults?.compileFailed) {
        // errorKind comes from src/utils/judgeErrorTaxonomy.js (set in
        // src/services/judgeService.js's runTestcases()) — falls back to
        // "infra" for any response that predates this field, so nothing
        // regresses for callers that don't set it.
        return (
            <div className="p-5 space-y-3">
                <ErrorHeader kind={runResults.errorKind ?? "infra"} theme={theme} />
                <ErrorBlock text={runResults.error} color="zinc" />
            </div>
        );
    }

    if (submitInfo?.status) {
        const isSubmitError =
            submitInfo.status.includes("Error") ||
            submitInfo.status.includes("Compilation") ||
            submitInfo.status.includes("Runtime");

        if (isSubmitError) {
            const kind = submitInfo.status.includes("Compilation")
                ? "compile"
                : submitInfo.status.includes("Runtime")
                    ? "runtime"
                    : "judge";

            return (
                <div className="p-5 space-y-3">
                    <ErrorHeader kind={kind} label={submitInfo.status} theme={theme} />
                    {submitInfo.error && <ErrorBlock text={submitInfo.error} color="red" />}
                    {submitInfo.passed !== undefined && (
                        <p className="text-xs text-[var(--muted-foreground)] font-mono">
                            {submitInfo.passed}/{submitInfo.total} testcases passed before error
                        </p>
                    )}
                </div>
            );
        }
    }

    return (
        <div className="flex items-center justify-center h-full min-h-[160px]">
            <div className="text-center space-y-2">
                <Bug size={28} strokeWidth={1.75} className="mx-auto text-[var(--muted-foreground)]" aria-hidden="true" />
                <p className="text-[var(--muted-foreground)] text-sm font-mono">No errors to show</p>
                <p className="text-[var(--muted-foreground)] text-xs font-mono">
                    Runtime errors and compile errors appear here
                </p>
            </div>
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getKindMeta(theme) {
    return {
        compile: {
            label: theme.words.compileError,
            color: "text-yellow-400",
            icon: AlertTriangle,
        },

        runtime: {
            label: theme.words.runtimeError,
            color: "text-red-400",
            icon: XCircle,
        },

        judge: {
            label: theme.words.judgeError,
            color: "text-[var(--muted-foreground)]",
            icon: Settings,
        },

        infra: {
            label: "Runner Unavailable",
            color: "text-[var(--muted-foreground)]",
            icon: Settings,
        },

        // ── Added during the execution-contract audit ───────────────────────
        // Previously every runTestcases() failure — a 400 contract/
        // validation error included — rendered under "infra"/"Runner
        // Unavailable", which is misleading: a malformed request is a
        // frontend/backend bug, not Judge0 being down. See
        // src/utils/judgeErrorTaxonomy.js for how `runResults.errorKind`
        // (read below) is derived.
        config: {
            label: "Execution configuration error",
            color: "text-yellow-400",
            icon: AlertTriangle,
        },
        auth: {
            label: "Authentication required",
            color: "text-orange-400",
            icon: AlertTriangle,
        },
        rate_limit: {
            label: "Rate limited",
            color: "text-orange-400",
            icon: Clock,
        },
    };
}

function ErrorHeader({ kind, label, theme }) {
    const KIND_META = getKindMeta(theme);
    const meta = KIND_META[kind] ?? KIND_META.judge;
    return (
        <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 text-sm font-semibold font-mono ${meta.color}`}>
                <meta.icon size={14} strokeWidth={2.25} aria-hidden="true" />
                {label ?? meta.label}
            </span>
        </div>
    );
}

const COLOR_CLASSES = {
    yellow: "border-yellow-500/25 text-yellow-200",
    red: "border-red-500/25    text-red-300",
    zinc: "border-[var(--border-strong)]      text-[var(--muted-foreground)]",
};

function ErrorBlock({ text, color = "red" }) {
    if (!text) return null;
    return (
        <div
            className={`
        bg-[var(--background)] border rounded-lg px-3 py-2.5
        font-mono text-xs whitespace-pre-wrap break-all
        max-h-56 overflow-y-auto
        ${COLOR_CLASSES[color] ?? COLOR_CLASSES.red}
      `}
        >
            {text}
        </div>
    );
}

// ── WorkspacePanel ────────────────────────────────────────────────────────────

const TABS = ["testcases", "debug"];
export default function WorkspacePanel({
    runResults,
    submitInfo,
    isRunning,
    isSubmitting,
    forceTab,
    problem,
}) {
    const [activeTab, setActiveTab] = useState("testcases");
    const [appliedForceTab, setAppliedForceTab] = useState(forceTab);
    const { theme } = useTheme();

    // Auto-switch to whichever tab the latest run/submit result calls for
    // (debug on a compile/runtime error, testcases otherwise) — mirrors
    // the mobile equivalent (mobileTab) in useProblemSolver.js. forceTab
    // was already being computed and threaded all the way down to this
    // component, but nothing ever applied it, so the desktop tab stayed
    // wherever the student last clicked even after a fresh error.
    //
    // Deliberately not a useEffect: this is React's documented pattern
    // for "adjusting state when a prop changes" — comparing against a
    // second state variable during render and calling setState
    // conditionally, rather than in an effect body, avoids the
    // cascading-render effect this codebase's lint config flags
    // (react-hooks/set-state-in-effect) elsewhere.
    if (forceTab !== appliedForceTab) {
        setAppliedForceTab(forceTab);
        if (forceTab && TABS.includes(forceTab)) setActiveTab(forceTab);
    }

    const errorCount = (() => {
        if (runResults?.compileFailed) return 1;
        if (runResults?.results) return runResults.results.filter((r) => r.error).length;
        if (
            submitInfo?.status?.includes("Error") ||
            submitInfo?.status?.includes("Compilation") ||
            submitInfo?.status?.includes("Runtime")
        ) return 1;
        return 0;
    })();

    const passCount = runResults?.results?.filter((r) => r.passed && !r.error).length ?? 0;
    const totalCount = runResults?.results?.length ?? 0;

    return (
        /* h-full fills the flex-1 wrapper. flex flex-col: tab bar fixed, content flex-1. */
        <div className="
h-full
flex
flex-col
overflow-hidden
">

            {/* ── Tab bar — flex-shrink-0, always visible ───────────────────── */}
            <div
                className="universe-workspace-panel__tabs flex items-center border-b border-[var(--border-strong)] px-1 pt-1 flex-shrink-0"
            >

                {TABS.map((tab) => {
                    const isActive = activeTab === tab;

                    const badge =
                        tab === "testcases" && totalCount > 0
                            ? `${passCount}/${totalCount}`
                            : tab === "debug" && errorCount > 0
                                ? String(errorCount)
                                : null;

                    const badgeColor =
                        tab === "testcases"
                            ? passCount === totalCount && totalCount > 0
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            : "bg-red-500/20 text-red-400";

                    return (
                        <button
                            key={tab}
                            onClick={() => {
                                setActiveTab(tab);
                            }}
                            className={`
                relative px-5 py-3 text-sm font-mono font-medium
                flex items-center gap-2 transition-colors duration-150
                ${isActive ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}
              `}
                        >
                            {tab === "testcases"
                                ? theme.words.testcases
                                : theme.words.debug}

                            {badge && (
                                <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${badgeColor}`}>
                                    {badge}
                                </span>
                            )}

                            {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--foreground)] rounded-t-full" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/*
        ── Tab content ───────────────────────────────────────────────────────
        flex-1:             takes all remaining height inside the flex-col panel.
        min-h-0:            CSS flex fix — without this, flex children won't
                            shrink below their content size, defeating overflow-y-auto.
        overflow-y-auto:    THIS is the scroll owner for workspace content.
                            Long testcase lists or error output scroll here only.
        custom-scrollbar:   project's existing thin scrollbar style.
      */}
            <div className="universe-workspace-panel__content flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {activeTab === "testcases" ? (
                    <div className="p-4">
                        <TestcaseResultPanel
                            results={runResults?.results ?? null}
                            compileFailed={runResults?.compileFailed ?? false}
                            compileError={runResults?.error ?? null}
                            isRunning={isRunning}
                            examples={problem?.examples ?? []}
                        />
                    </div>
                ) : (
                    <DebugPanel
                        runResults={runResults}
                        submitInfo={submitInfo}
                        isRunning={isRunning}
                        isSubmitting={isSubmitting}
                        theme={theme}
                    />
                )}
            </div>

        </div>
    );
}
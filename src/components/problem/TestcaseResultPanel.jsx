import { useState, useMemo } from "react";
import { useTheme } from "../../hooks/useTheme";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

// ── Runtime error normalisation ───────────────────────────────────────────────
//
// Detects "RUNTIME_ERROR: ..." in stdout (result.actual) and moves it to
// result.error so all downstream logic has a single place to check.
// Returns a new array — never mutates the input.

function normaliseResults(results) {
  if (!results) return results;
  return results.map((r) => {

    // Already has a real stderr error — leave it
    if (r.error) return r;

    const actual = String(r.actual ?? "").trim();
    if (actual.startsWith("RUNTIME_ERROR:")) {
      return {
        ...r,
        actual: "",
        passed: false,
        error: actual.replace(/^RUNTIME_ERROR:\s*/, ""),
      };
    }
    return r;
  });
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatInput(input) {
  if (!input || typeof input !== "object") return String(input ?? "—");
  return Object.entries(input)
    .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
    .join("\n");
}

function formatExpected(expected) {
  if (expected === null || expected === undefined) return "—";
  return JSON.stringify(expected);
}

function formatActual(actual) {
  const s = String(actual ?? "").trim();
  return s === "" ? "(empty)" : s;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DataRow({ label, value, highlight }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-mono-ui uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </span>
      <div
        className={`
          rounded-lg px-3 py-2.5 text-sm font-mono-ui leading-relaxed
          whitespace-pre-wrap break-all border
          ${highlight === "pass"
            ? "bg-verdict-accept/5 border-verdict-accept/20 text-verdict-accept"
            : highlight === "fail"
              ? "bg-verdict-reject/5 border-verdict-reject/20 text-verdict-reject"
              : "bg-[var(--background)] border-[var(--border-strong)] text-[var(--foreground)]"
          }
        `}
      >
        {value}
      </div>
    </div>
  );
}

function MetaChip({ label, value }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-ui">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="text-[var(--muted-foreground)]">{value}</span>
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-24 rounded-lg bg-[var(--surface-elevated)]" />
        ))}
      </div>
      <div className="space-y-3 pt-1">
        <div className="h-4 w-16 rounded bg-[var(--surface-elevated)]" />
        <div className="h-10 rounded-lg bg-[var(--surface-elevated)]" />
        <div className="h-4 w-20 rounded bg-[var(--surface-elevated)]" />
        <div className="h-10 rounded-lg bg-[var(--surface-elevated)]" />
        <div className="h-4 w-20 rounded bg-[var(--surface-elevated)]" />
        <div className="h-10 rounded-lg bg-[var(--surface-elevated)]" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TestcaseResultPanel({
  results: rawResults,
  compileFailed,
  compileError,
  isRunning,
  examples = [],
}) {
  const [activeTab, setActiveTab] = useState(0);
  // Tracks which `results` reference activeTab was last derived for, so we
  // can re-derive it during render when a new run/submit produces a new
  // `results` array — the "adjusting state when a prop changes" pattern,
  // rather than a useEffect that calls setState synchronously.
  const [trackedResults, setTrackedResults] = useState(rawResults);
  const { theme } = useTheme();


  // Normalise once — promotes "RUNTIME_ERROR:" stdout strings to r.error
  const results = useMemo(
    () => normaliseResults(rawResults),
    [rawResults]
  );

  // Auto-jump to first failing tab when results arrive
  if (rawResults !== trackedResults) {
    setTrackedResults(rawResults);
    if (results && results.length > 0) {
      const firstFail = results.findIndex((r) => !r.passed || r.error);
      setActiveTab(firstFail === -1 ? 0 : firstFail);
    }
  }

  if (isRunning) return <LoadingSkeleton />;

  if (!results && !compileFailed) {
    if (examples.length === 0) {
      return (
        <div className="flex items-center justify-center min-h-[160px]">
          <p className="text-[var(--muted-foreground)] text-sm font-mono-ui">
            Click {theme.words.run} to test against examples
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {examples.map((ex, i) => (
          <div key={i} className="rounded-xl border border-[var(--border-strong)] bg-[var(--background)] p-3 space-y-2">
            <span className="text-[11px] font-mono-ui uppercase tracking-widest text-[var(--muted-foreground)]">
              Example {i + 1}
            </span>
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono-ui uppercase tracking-widest text-[var(--muted-foreground)]">Input</span>
              <div className="rounded-lg px-3 py-2 text-sm font-mono-ui bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--foreground)] whitespace-pre-wrap break-all">
                {ex.input}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono-ui uppercase tracking-widest text-[var(--muted-foreground)]">Expected</span>
              <div className="rounded-lg px-3 py-2 text-sm font-mono-ui bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--foreground)]">
                {ex.output}
              </div>
            </div>
            {ex.explanation && (
              <p className="text-xs text-[var(--muted-foreground)] font-mono-ui pt-0.5">{ex.explanation}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (compileFailed) {
    return (
      <div className="space-y-3">
        <span className="text-verdict-pending text-sm font-semibold font-mono-ui flex items-center gap-1.5">
          <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
          {theme.words.compileError}
        </span>
        <div className="bg-[var(--background)] border border-[var(--border-strong)] rounded-lg px-3 py-2.5 font-mono-ui text-xs text-verdict-pending whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
          {compileError || "Unknown compilation error."}
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[160px]">
        <p className="text-[var(--muted-foreground)] text-sm font-mono-ui">No results returned.</p>
      </div>
    );
  }

  const safeTab = Math.min(activeTab, results.length - 1);
  const active = results[safeTab];
  const passCount = results.filter((r) => r.passed && !r.error).length;
  const allPassed = passCount === results.length;

  return (
    <div className="universe-test-results space-y-4">

      {/* ── Summary + meta ───────────────────────────────────────────── */}
      <div className="universe-test-results__summary flex items-center justify-between">
        <span
          className={`text-sm font-semibold font-mono-ui flex items-center gap-1.5 ${allPassed ? "text-verdict-accept" : "text-verdict-reject"
            }`}
        >
          {allPassed ? (
            <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
          ) : (
            <XCircle size={16} strokeWidth={2} aria-hidden="true" />
          )}
          {allPassed
            ? `${results.length}/${results.length} passed`
            : `${passCount}/${results.length} passed`}
        </span>
        <div className="flex items-center gap-3">
          <MetaChip label="time" value={active.time ? `${active.time}s` : null} />
          <MetaChip
            label="mem"
            value={active.memory ? `${Math.round(active.memory / 1024)}MB` : null}
          />
        </div>
      </div>

      {/* ── Example tabs ─────────────────────────────────────────────── */}
      <div className="universe-test-results__tabs flex gap-2 flex-wrap relative"
        style={{ zIndex: 9999 }}>
        {results.map((r, i) => {
          const isActive = safeTab === i;
          const isPassing = r.passed && !r.error;

          return (
            <button
              key={i}
              onClick={() => {
                setActiveTab(i);
              }}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-mono-ui font-medium
                flex items-center gap-1.5 transition-all duration-150
                ${isActive
                  ? isPassing
                    ? "bg-verdict-accept/15 border border-verdict-accept/40 text-verdict-accept"
                    : "bg-verdict-reject/15 border border-verdict-reject/40 text-verdict-reject"
                  : isPassing
                    ? "bg-[var(--surface-elevated)] border border-[var(--border-strong)] text-[var(--muted-foreground)] hover:border-verdict-accept/30 hover:text-verdict-accept"
                    : "bg-[var(--surface-elevated)] border border-[var(--border-strong)] text-[var(--muted-foreground)] hover:border-verdict-reject/30 hover:text-verdict-reject"
                }
              `}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPassing ? "bg-verdict-accept" : "bg-verdict-reject"
                  }`}
              />
              Example {i + 1}
            </button>
          );
        })}
      </div>


      {/* ── Active testcase body ──────────────────────── */}
      <div className="space-y-4">

        {/* Status Banner */}
        <div
          data-universe-test-status={active.error ? "runtime-error" : active.passed ? "passed" : "wrong-answer"}
          className={`universe-test-results__status
      rounded-xl
      px-4 py-3
      font-medium
      flex items-center gap-2
      ${active.error
              ? "bg-verdict-reject/10 border border-verdict-reject/30 text-verdict-reject"
              : active.passed
                ? "bg-verdict-accept/10 border border-verdict-accept/30 text-verdict-accept"
                : "bg-verdict-reject/10 border border-verdict-reject/30 text-verdict-reject"
            }
    `}
        >
          {active.error ? (
            <>
              <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
              Runtime Error
            </>
          ) : active.passed ? (
            <>
              <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
              Passed
            </>
          ) : (
            <>
              <XCircle size={16} strokeWidth={2} aria-hidden="true" />
              Wrong Answer
            </>
          )}
        </div>

        {active.error ? (
          <>
            <DataRow
              label="Input"
              value={formatInput(active.input)}
            />

            <div className="rounded-lg border border-verdict-reject/25 bg-verdict-reject/5 p-4">
              <p className="text-verdict-reject font-medium">
                {theme.words.runtimeError}
              </p>

              <p className="text-[var(--muted-foreground)] text-sm mt-1">
                Open the {theme.words.debug} tab for details →
              </p>
            </div>
          </>
        ) : (
          <>
            <DataRow
              label="Input"
              value={formatInput(active.input)}
            />

            <DataRow
              label="Expected Output"
              value={formatExpected(active.expected)}
              highlight="pass"
            />

            <DataRow
              label="Your Output"
              value={formatActual(active.actual)}
              highlight={active.passed ? "pass" : "fail"}
            />
          </>
        )}
      </div>

    </div>
  );
}
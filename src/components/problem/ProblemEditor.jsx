import { useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "../../hooks/useTheme";
import { useBWMode } from "../../hooks/useBWMode";
import { useLanguages } from "../../hooks/useLanguages";
import EditorMoreMenu from "./EditorMoreMenu";
import {
  saveCode,
  loadFontSize,
  saveFontSize,
  EDITOR_FONT_SIZE_MIN,
  EDITOR_FONT_SIZE_MAX,
} from "../../utils/editorStorage";

function ProblemEditor({
  slug,
  language,
  setLanguage,
  code,
  setCode,
  customInput,
  setCustomInput,
  onRun,
  onSubmit,
  onReset,
  running,
  submitting,
}) {
  const [showAdvancedTesting, setShowAdvancedTesting] = useState(false);
  const [fontSize, setFontSize] = useState(loadFontSize);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const { theme } = useTheme();
  const { bwMode } = useBWMode();
  const { languages } = useLanguages();
  const editorRef = useRef(null);

  function adjustFontSize(delta) {
    setFontSize((prev) => {
      const next = Math.min(
        EDITOR_FONT_SIZE_MAX,
        Math.max(EDITOR_FONT_SIZE_MIN, prev + delta)
      );
      saveFontSize(next);
      return next;
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    } catch {
      // Clipboard API can fail on insecure origins / permissions — fail
      // quietly rather than surfacing a scary error for a nice-to-have.
    }
  }

  /**
   * Called once when Monaco mounts.
   * Registers keyboard shortcuts:
   *   Ctrl+Enter (Mac: Cmd+Enter)        → Run code
   *   Ctrl+Shift+Enter (Mac: Cmd+Shift+Enter) → Submit code
   *
   * These are the de-facto standard shortcuts for any coding platform.
   * Their absence signals an unfinished product to experienced developers.
   */
  function handleEditorMount(editor, monaco) {
    editorRef.current = editor;

    // ── Ctrl+Enter → Run ────────────────────────────────────────────────────
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        if (!running && !submitting) onRun();
      }
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd |
      monaco.KeyCode.KeyS,
      () => {
        // Use editor.getValue() rather than the `code` prop — this callback
        // is registered once on mount, so `code` would otherwise be a stale
        // closure over whatever it was when Monaco first mounted.
        saveCode(slug, language, editor.getValue());
      }
    );
    editor.addCommand(
      monaco.KeyCode.Escape,
      () => {
        setShowAdvancedTesting(false);
        setIsFullscreen(false);
      }
    );

    // ── Ctrl+Shift+Enter → Submit ───────────────────────────────────────────
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      () => {
        if (!running && !submitting) onSubmit();
      }
    );
  }

  return (
    <div
      data-universe-panel="editor"
      className={
      isFullscreen
        ? "universe-editor fixed inset-0 z-50 flex flex-col bg-[var(--surface)] shadow-2xl"
        : "universe-editor flex flex-col h-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xl"
    }>
      {/* ── Editor Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]/50">

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            {theme.words.language}
          </span>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-[var(--surface-elevated)] text-[var(--foreground)] text-sm border-none rounded-md px-2 py-1 outline-none hover:brightness-110 transition-colors cursor-pointer"
          >
            {/* Content & Execution Architecture, Phase 2: sourced from
                GET /api/languages (see useLanguages.js) instead of a
                hardcoded list — a language disabled in
                backend/config/languages.js disappears from here on the
                next fetch, with no frontend code change required. */}
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>

          <EditorMoreMenu
            fontSize={fontSize}
            onFontSizeChange={adjustFontSize}
            fontSizeMin={EDITOR_FONT_SIZE_MIN}
            fontSizeMax={EDITOR_FONT_SIZE_MAX}
            onReset={onReset}
            onCopy={handleCopy}
            justCopied={justCopied}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRun}
            disabled={running || submitting}
            className="px-5 py-2 rounded-xl text-sm font-semibold border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition-all disabled:opacity-50"
            title="Run code (Ctrl+Enter)"
          >
            {running ? theme.words.running : theme.words.run}
          </button>

          <button
            data-testid="submit-code-button"
            onClick={onSubmit}
            disabled={running || submitting}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${submitting
              ? "bg-[var(--theme-primary,#2dd4bf)]/20 text-[var(--theme-primary,#2dd4bf)] border border-[var(--theme-primary,#2dd4bf)]/30"
              : "bg-[var(--theme-primary,#2dd4bf)] text-[#09090b] hover:brightness-110 shadow-lg shadow-[var(--theme-primary,#2dd4bf)]/20"
              }`}
            title="Submit solution (Ctrl+Shift+Enter)"
          >
            {submitting ? theme.words.submitting : theme.words.submit}
          </button>
        </div>
      </div>

      {/* ── Editor Content ───────────────────────────────────────────────── */}
      <div className="flex-grow min-h-[400px]">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={(value) => setCode(value || "")}
          theme={bwMode ? "light" : "vs-dark"}
          onMount={handleEditorMount}
          saveViewState={true}
          options={{
            fontSize,
            minimap: { enabled: false },
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize:
              // Content & Execution Architecture cross-check follow-up
              // (Phase 6): was `language === "javascript" ? 2 : 4` — a
              // hardcoded per-language conditional that silently gave
              // TypeScript the wrong (4, Java/C++-style) indent instead
              // of the 2-space convention it actually shares with
              // JavaScript. Now derived from the registry
              // (`editorIndentSize`, see config/languages.js) so a future
              // language's indent convention is a registry entry, not a
              // line to find and edit in this file.
              languages.find((l) => l.id === language)?.editorIndentSize ?? 4,
            // Accessibility
            accessibilitySupport: "auto",
            wordWrap: "on",
            occurrencesHighlight: "off",
            selectionHighlight: false,
            // Performance
            renderWhitespace: "none",
            smoothScrolling: true,
            guides: {
              bracketPairs: true,
            },
            bracketPairColorization: {
              enabled: true,
            },
            fontFamily:
              "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderLineHighlight: "all",
            mouseWheelZoom: true,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
          }}
        />
      </div>

      {/* ── Advanced Testing Footer ──────────────────────────────────────── */}
      <div className="mb-2 px-4">
        <button
          type="button"
          onClick={() => setShowAdvancedTesting(!showAdvancedTesting)}
          className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider hover:text-[var(--foreground)] transition-colors"
        >
          <span>{showAdvancedTesting ? "▼" : "▶"}</span>
          {theme.words.advancedTesting}
        </button>
      </div>

      {showAdvancedTesting && (
        <div className="mb-4 px-4">
          <label
            htmlFor="custom-input"
            className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2"
          >
            {theme.words.customInput}
          </label>

          <textarea
            id="custom-input"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            rows={2}
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl p-3 font-mono text-sm text-[var(--foreground)] outline-none focus:border-[var(--muted-foreground)] transition-colors placeholder:text-[var(--muted-foreground)]"
            placeholder={theme.words.customInputPlaceholder}
          />
        </div>
      )}
    </div>
  );
}

export default ProblemEditor;
// Content & Execution Architecture, Phase 2 — ProblemEditor's language
// <select> must render options from useLanguages() (backed by
// GET /api/languages) instead of a hardcoded set of four <option> tags.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProblemEditor from "./ProblemEditor";

// Guest Mode integration: useLanguages.js now calls apiFetchOptional (not
// apiFetch) against GET /api/languages, since that route is genuinely
// public — see useLanguages.js's own comment. Mock target updated to
// match; ProblemEditor itself doesn't call the API directly, this only
// matters because useLanguages() is used underneath it.
const apiFetchOptional = vi.fn();
vi.mock("../../services/api", () => ({
  apiFetchOptional: (...args) => apiFetchOptional(...args),
}));

vi.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      words: {
        language: "Language",
        run: "Run",
        running: "Running",
        submit: "Submit",
        submitting: "Submitting",
        advancedTesting: "Advanced Testing",
        customInput: "Custom Input",
        customInputPlaceholder: "Enter input...",
      },
    },
  }),
}));

// ProblemEditor now reads Black & White Mode to pick the Monaco editor
// theme (vs-dark / light) — mocked the same way useTheme is above, rather
// than wrapping every render() call in a real BWModeProvider, since these
// tests aren't exercising the toggle itself.
vi.mock("../../hooks/useBWMode", () => ({
  useBWMode: () => ({ bwMode: false, toggleBWMode: () => {} }),
}));

// Monaco is heavy and irrelevant to what most of this file covers (the
// language <select>, which lives outside the editor itself) — stubbed to
// a plain textarea-like placeholder, same "stub the unrelated heavy
// child" idea as EducationSection.test.jsx stubbing out
// CollegeVerifyModal. The stub DOES forward `options` onto a data
// attribute (rather than discarding all props) specifically so the
// tabSize tests below — a real regression test for the hardcoded
// `language === "javascript" ? 2 : 4` conditional this file used to
// have — can assert on what was actually passed to Monaco, not just
// that a placeholder rendered.
vi.mock("@monaco-editor/react", () => ({
  default: (props) => <div data-testid="monaco-editor-stub" data-tab-size={props.options?.tabSize} />,
}));

function noop() {}

describe("ProblemEditor — language selector sourced from useLanguages()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the language options returned by GET /api/languages, not a hardcoded set", async () => {
    apiFetchOptional.mockResolvedValueOnce({
      languages: [
        { id: "python", name: "Python", extension: "py" },
        { id: "javascript", name: "JavaScript", extension: "js" },
      ],
    });

    render(
      <ProblemEditor
        slug="two-sum"
        language="python"
        setLanguage={noop}
        code=""
        setCode={noop}
        customInput=""
        setCustomInput={noop}
        onRun={noop}
        onSubmit={noop}
        onReset={noop}
        running={false}
        submitting={false}
      />
    );

    // Fallback options render first (synchronously) — see useLanguages.js.
    expect(screen.getByRole("option", { name: "Python" })).toBeInTheDocument();

    await screen.findByRole("option", { name: "JavaScript" });
    expect(screen.queryByRole("option", { name: "Java" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "C++" })).not.toBeInTheDocument();
  });

  it("hides enabled languages that have no starter template for this problem", async () => {
    apiFetchOptional.mockResolvedValueOnce({
      languages: [
        { id: "python", name: "Python", extension: "py" },
        { id: "javascript", name: "JavaScript", extension: "js" },
        { id: "c", name: "C", extension: "c" },
      ],
    });

    render(
      <ProblemEditor
        slug="add-two-numbers"
        language="python"
        availableLanguageIds={["python", "javascript", "java", "cpp", "typescript"]}
        setLanguage={noop}
        code=""
        setCode={noop}
        customInput=""
        setCustomInput={noop}
        onRun={noop}
        onSubmit={noop}
        onReset={noop}
        running={false}
        submitting={false}
      />
    );

    await screen.findByRole("option", { name: "JavaScript" });
    expect(screen.queryByRole("option", { name: "C" })).not.toBeInTheDocument();
  });
});

describe("ProblemEditor — Monaco tabSize sourced from the registry's editorIndentSize (Phase 6 regression test)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithLanguage(language, languages) {
    apiFetchOptional.mockResolvedValueOnce({ languages });
    return render(
      <ProblemEditor
        slug="two-sum"
        language={language}
        setLanguage={noop}
        code=""
        setCode={noop}
        customInput=""
        setCustomInput={noop}
        onRun={noop}
        onSubmit={noop}
        onReset={noop}
        running={false}
        submitting={false}
      />
    );
  }

  it("uses the fetched language's editorIndentSize once GET /api/languages resolves (2 for TypeScript, not the old javascript-only special case)", async () => {
    renderWithLanguage("typescript", [
      { id: "python", name: "Python", extension: "py", editorIndentSize: 4 },
      { id: "typescript", name: "TypeScript", extension: "ts", editorIndentSize: 2 },
    ]);

    await screen.findByRole("option", { name: "TypeScript" });
    expect(screen.getByTestId("monaco-editor-stub").dataset.tabSize).toBe("2");
  });

  it("uses 4 for a registry language whose editorIndentSize is 4 (e.g. Java)", async () => {
    renderWithLanguage("java", [{ id: "java", name: "Java", extension: "java", editorIndentSize: 4 }]);

    await screen.findByRole("option", { name: "Java" });
    expect(screen.getByTestId("monaco-editor-stub").dataset.tabSize).toBe("4");
  });

  it("falls back to 4 for a language not present in the fetched list at all, rather than crashing", async () => {
    renderWithLanguage("some-future-language", [{ id: "python", name: "Python", extension: "py", editorIndentSize: 4 }]);

    await screen.findByRole("option", { name: "Python" });
    expect(screen.getByTestId("monaco-editor-stub").dataset.tabSize).toBe("4");
  });
});
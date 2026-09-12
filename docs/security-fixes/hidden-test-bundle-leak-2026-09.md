# Hidden-test bundle leak — Sept 2026

## What was found

A full architecture audit of the DSA problem system (Sept 2026) traced how
hidden test cases actually flow through the platform, rather than trusting
that a field named `hidden*` was automatically protected. The backend
(`problemController.js`, `judgeController.js`, `models/Problem.js`) was
already correctly excluding `hiddentestcases`/`hiddenTestcaseSet` from every
API response.

The frontend was not. `src/components/problem/RelatedProblems.jsx` had a
plain `import problems from "../../data/problems.js"` — the hand-authored
file that contains every problem's `hiddentestcases` in plaintext. Because
`RelatedProblems` is rendered on the main problem-solving page
(`ProblemWorkspaceLayout.jsx` → `ProblemInfo.jsx` → `RelatedProblems.jsx`),
Vite bundled the *entire* hidden-test dataset for all ~250 problems into the
main problem-workspace chunk, shipped to every visitor on every problem-page
load — fully bypassing the backend's protections.

This re-created (unconditionally, this time) a version of the exposure an
earlier Aug 2026 fix had already partially closed in `src/hooks/useProblems.js`
(that fix made the same file's *fallback-path* import lazy/dynamic, but
didn't cover this second, static, import site).

## Fix (Batch 1)

`RelatedProblems.jsx` now sources problem data from `useProblems()`
(→ `GET /api/problems`, a public-fields-only, Redis-cached endpoint) instead
of importing the raw content file. Verified by:
- Full frontend suite green (64/64 files, 400/400 tests) after the change.
- Production build inspected chunk-by-chunk: the problem-workspace chunk no
  longer contains hidden-test data.

## Regression guard (Batch 2)

Two independent, defense-in-depth checks were added so this can't quietly
regress again:

1. **`eslint.config.js`** — a `no-restricted-imports` rule blocks any new
   frontend file from importing `src/data/problems.js` or
   `src/data/code-club-edition/CCE-*.js`. The handful of already-reviewed
   call sites that legitimately need this data (`useProblems.js`'s
   API-down fallback, `AvatarDropdown.jsx`, `roleCommands.js`,
   `dailyChallenge.js` — all via dynamic `import()`, never a plain
   `import`) are explicitly allowlisted by filename in the same config
   block, with a comment explaining why each is safe.

2. **`scripts/checkBundleForHiddenTestLeak.js`**, run in CI right after
   `npm run build` — a representation-independent backstop behind the lint
   rule. It reads Vite's build manifest (`build.manifest: true`, added to
   `vite.config.js`) and checks the actual *static-vs-dynamic import graph*
   of the built output, not filenames or source text:
   - Finds every built chunk that contains real hidden-test data (the
     literal pattern `hiddentestcases:[{` — matches an actual populated
     array literal, not the admin authoring form's empty-field default).
   - Fails the build if any such chunk is reachable via a *static* import
     edge from anywhere in the graph.
   - Passes (with an informational log line) if the only chunk containing
     hidden-test data is reached exclusively via *dynamic* `import()` edges
     — that's the known, already-tracked `useProblems.js` fallback
     exposure, deliberately deferred to `plans/014` Batch 5, not something
     this check is meant to catch.

   **Important implementation note, kept here so it isn't relearned the
   hard way:** an earlier draft of this script allowlisted chunks by
   *filename* (e.g. `problems-*.js`). That's unsafe — Vite names a chunk
   after its source module's basename regardless of whether it was reached
   via a static or dynamic import, so a newly-reintroduced static-import
   leak produces a chunk with the exact same name prefix as the reviewed
   dynamic one. Verified this concretely: reintroducing the original
   `RelatedProblems.jsx` leak produced a chunk named `problems-<newhash>.js`
   that the filename-based version of this script let through silently.
   The manifest-graph version correctly failed on the same regression,
   reporting the exact static import chain
   (`ProblemInfo-*.js → problems-*.js`). Do not go back to name-based
   allowlisting for this check.

3. CI (`.github/workflows/ci.yml`) now actually runs `npm run lint` in the
   frontend job (previously named "install + test + build" despite no lint
   step existing) and `npm run verify:no-hidden-test-leak` right after the
   production build.

## What's still open

`src/hooks/useProblems.js`'s fallback chunk still contains real hidden-test
data as a static asset (just lazily/dynamically loaded rather than shipped
eagerly). That's a smaller, already-understood exposure — tracked as
`plans/014` Batch 5 (splitting hidden test data into a physically separate
file/path that no frontend code can import at all, static or dynamic) — not
something Batch 1/2 attempted to fix.

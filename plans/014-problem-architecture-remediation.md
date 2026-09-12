# Plan 014 — Problem Architecture Remediation Action Plan

Source: `code-club-problem-architecture-audit.md` (Sept 2026 audit).
Suggested numbering — rename if `014` is already taken by the time this is picked up.

---

## 🔴 Batch 1 — Close the hidden-test leak (do first, ship same day) ✅ DONE

- [x] Change `src/components/problem/RelatedProblems.jsx` to fetch related-problem metadata from `GET /api/problems` (or from data already fetched on the problem page) instead of `import problems from "../../data/problems.js"`
- [x] Grep the rest of `src/` for any other static import of `src/data/problems.js` or `src/data/code-club-edition/CCE-*.js` (only `useProblems.js`'s dynamic import and `RelatedProblems.jsx`'s static import were found in this audit — confirm nothing else was missed)
- [x] Confirm `RelatedProblems.jsx` still renders correctly (related-problem cards) using only public API fields
- [x] Run full frontend test suite — confirm no regression (64/64 files, 400/400 tests)
- [x] Manually verify in a production-mode build (`npm run build` + inspect output) that no chunk reachable from the problem-workspace page contains a hidden testcase value (`ProblemInfo` chunk dropped from ~460KB-carrying to 13.76 kB)
- [x] Update `PROGRESS.md` with the fix and explicitly note the Aug 2026 "problems-bundle-bloat" fix did not cover this second import path

## 🔴 Batch 2 — Prevent this class of regression from shipping again ✅ DONE

- [x] Add an ESLint `no-restricted-imports` rule blocking any file from statically importing `src/data/problems.js` or `src/data/code-club-edition/CCE-*.js`, with the 4 already-reviewed dynamic-import call sites explicitly allowlisted
- [x] Add a CI step that builds and checks for the leak — **note:** first version allowlisted by chunk *filename*, which a live regression test proved unsafe (Vite names a chunk after its source module regardless of static vs. dynamic import — a reintroduced leak produced an identically-prefixed chunk name and passed silently). Rewrote to use Vite's build manifest and check the actual static-vs-dynamic import graph (`vite.config.js`'s `build.manifest: true` + `scripts/checkBundleForHiddenTestLeak.js`). Retested both directions after the rewrite — passes on good code, fails with the exact static-import chain reported when the regression is reintroduced.
- [x] Also discovered and fixed along the way: the frontend CI job was named "install + test + build" but had **no lint step at all** — added `npm run lint` as a real CI gate (previously the new ESLint rule would only ever run locally).
- [x] Document the rule and the CI check in `docs/security-fixes/` (`hidden-test-bundle-leak-2026-09.md`)

## 🟠 Batch 3 — Investigate before scoping new versioning work ✅ DONE

- [x] Open and read `backend/models/Problem.contentVersion.integration.test.js` — determine what, if anything, already exists for problem versioning
- [x] Decide, based on that, whether Batch 4 (below) is still needed as scoped or should be resized
- [x] Record findings in `PROGRESS.md`

**Finding: versioning is already fully built, not just scoped/tested-ahead.** `Problem.contentVersion` (schema field + `pre("save")` + `pre("findOneAndUpdate")` hooks, keyed on a deliberate `GRADING_CONTRACT_FIELDS` list, not every field) and `Submission.problemVersion` (captured at grading time in `judgeController.js` via `recordVerifiedSubmission()`) are both real, wired end-to-end. Verified the hook logic by reading it against all 12 integration-test cases — matches. Could not get an actual green run of the integration test itself (blocked by the same `fastdl.mongodb.org` sandbox restriction as every other integration-tier file) — the mocked unit-level coverage in `submissionController.test.js` (2 relevant tests) did run and passed. Full writeup in `PROGRESS.md`.

## 🟠 Batch 4 — Problem/testcase versioning — RESIZED, not new work

~~Write a scoping doc, implement in batches~~ — not needed, this is built. Resized to:

- [ ] Run `Problem.contentVersion.integration.test.js` on real CI/local (where `fastdl.mongodb.org` is reachable) and confirm all 12 cases actually pass, not just "look correct by reading"
- [ ] Decide whether the current minimum-viable scope (capture `problemVersion` at grading time, surface `contentVersion` read-only in the admin problem list) is sufficient, or whether a drift-alerting feature is worth building on top (e.g. flagging a Submission whose `problemVersion` is behind the problem's current `contentVersion` somewhere in admin/analytics UI) — this is a product decision, not an engineering one
- [ ] If a drift-alerting feature is wanted: scope it as its own small plan doc rather than folding it into this item


## 🟠 Batch 5 — Authoring-folder promotion (Section K/R of the audit) — PARTIAL, first slice done

- [x] Add `hidden-testcases.json` as a new file alongside the existing `testcases.json` in `backend/problems/<slug>/` — additive only, nothing removed yet (changed the single shared mapping in `scripts/lib/problemFolderFiles.js`)
- [x] Update `exportProblemsToFolders.js` and `importProblems.js` to read/write the split shape (exporter needed no change — delegates to the shared mapping; `importProblems.js`'s read side updated)
- [x] Update `checkProblemsFolderDrift.js` and `validateProblemContracts.js` for the new file — **neither needed a code change**: drift-check is fully generic over the shared mapping's output, and contract validation reads `src/data/problems.js` directly, never the folder mirror
- [x] Keep `src/data/problems.js` generation working during the transition window (don't break existing flows mid-migration) — unaffected, not touched this batch
- [x] Regenerated all 250 problem folders via `npm run problems:export-to-folders` (500 files: 250 new `hidden-testcases.json` + 250 rewritten `testcases.json`) — drift check clean, contract validation clean, full backend suite green (103/103, 1198/1198)
- [ ] Migrate remaining problems in batches — validate (drift check + contract check + full test suite) after each batch — **N/A as scoped**: this was a scripted regeneration of all 250 at once (not hand-migration), so there was no meaningful way to stage it into smaller batches; the risk this checklist item was guarding against (partial, inconsistent migration state) doesn't apply here since the transformation is deterministic and was verified across the whole set in one pass
- [ ] Once every problem has migrated: stop hand-authoring `src/data/problems.js` directly; make it a generated artifact (or remove it, seeding MongoDB directly from the folder set) — **not done, deliberately deferred**. This is the real source-of-truth inversion and a materially bigger, riskier change than the file split above. `src/data/problems.js` is still what gets hand-edited today.
- [ ] Add the ESLint rule from Batch 2 permanently locking down frontend imports of the authoring folder — **not yet needed**: `backend/problems/` was never reachable from `src/`'s import graph in the first place (it's outside `src/`, not part of the Vite build root), so there's no existing exposure to lock down. Revisit once/if the authoring folder becomes something a build step reads from directly.
- [ ] Update `docs/adding-a-language.md` and any other doc referencing `src/data/problems.js` as "the actual single source of truth" — **not yet, still accurate**: it genuinely still is the source of truth until the inversion above happens.


## 🟡 Batch 6 — Lower-priority cleanups (no urgency, pick up opportunistically)

- [ ] Write a short "testcase authoring checklist" doc (empty input, min/max values, duplicates, negatives, overflow) for future problem contributors — no infra change needed
- [ ] Scope (don't build yet) what a `create-problem <slug>` scaffold command would look like once Batch 5's folder shape is final
- [ ] File a real cleanup ticket for dropping the legacy `hiddentestcases` field from already-migrated MongoDB documents (currently kept for rollback safety)

## 🟢 Deliberately NOT doing right now (per audit's Final Verdict)

- [ ] *(tracking only, no action)* Do not add stdin/stdout, SQL, or interactive problem-type support speculatively — wait for real product demand
- [ ] *(tracking only, no action)* Do not build randomized/generated test-case infrastructure — current hand-authored approach is adequate at this scale
- [ ] *(tracking only, no action)* Do not touch the language registry architecture (`backend/config/languages.js`, Plan 011) — already correct

# Code Club — Backend Progress Tracker

Cross-session source of truth for backend implement
### Real CI caught two bugs the sandbox couldn't (this session)

Bunny ran the integration tier in real CI (mongodb-memory-server isn't
reachable from this sandbox, so this tier could only be written, never
executed, until now). It caught two genuine bugs:

1. **Both `contentVersion` hooks threw `TypeError: next is not a
   function` on every single `.save()`/`findOneAndUpdate()` call** --
   34 of the 37 failures. Root cause: this project runs **Mongoose 9**,
   which dropped legacy callback-style (`function (next) { ... next();
   }`) middleware support entirely. The hooks were written in that
   legacy style. Fixed by rewriting both as pure promise-style hooks
   (no `next` parameter, resolve by returning) -- confirmed this
   matches the one other pre-save hook already in this codebase
   (`User.js`'s `setEmailDomain`, which declares an unused `next`
   param but never calls it, and passes in CI). This bug reached CI
   because the *unit*-tier tests (which mock the Mongoose model
   entirely) can't exercise real middleware -- only the integration
   tier, which needed a real Mongo connection this sandbox never had,
   could have caught it.
2. **The new integration test's own fixture was missing a required
   field** (`description`) -- 8 of the 37 failures, all in
   `Problem.contentVersion.integration.test.js` itself. Not a
   production bug, a test-authoring gap: `baseProblem()` didn't include
   every field `Problem.js` requires. Fixed by adding it and
   cross-checking programmatically against every `required: true`
   field in the schema (id/title/slug/functionName/difficulty/topic/
   description) to make sure nothing else was missed this time.

Both fixes are code-review-verifiable (lint + `node --check` clean,
full unit suite still 101/101 files / 1136/1136 tests) but the
integration tier itself still needs a real CI run to confirm --
this fix has NOT been executed against a real Mongo from this
environment, same limitation as every other integration test here.
ation status, tracked
against the master roadmap's `IMPLEMENTATION ORDER` (roadmap §24). Update
this file instead of relying on chat history or prior session summaries —
per the roadmap's own instruction, inspect actual code before trusting any
"done" claim here, including this one.

Last updated: this session (Phase 6 — Language Expansion, Batch 1).

---

## Session note — this session's own audit, and the plan-number collision found

This session opened with the same audit ritual: full codebase re-check
against this file's own claims (101/101 backend files, 1126/1126 tests;
63/63 frontend files, 394/394 tests; lint delta zero except the same
`CollegeDetailDrawer.jsx` item) before any new work started. Everything
in the Phase 5 section and the phase-status table, as this file already
claimed it, checked out.

One new finding: `plans/` did not exist on disk at all at the start of
this session (consistent with this file's own prior note that
`plans/004-rewards-store-scoping.md` was missing) — but code comments
across the backend already reference "plan 001" through "plan 009" by
number (e.g. `adminAnalyticsController.js` cites "plan 007"), meaning
those numbers are already claimed even though none of those docs exist
as files. A scoping doc for this phase was initially written as
`plans/006-...` and had to be renamed to `plans/010-...` once this was
discovered, to avoid colliding with an already-referenced (but
undocumented) plan 006. Flagged here rather than silently renumbered
without a trace — plans/001 through 005 and 007 through 009 are still
missing and uncited by any file in this checkout beyond the inline
comment references already found.

## Session note — this file and `plans/004-rewards-store-scoping.md` were missing from the repo

This session opened with a full audit against the actual codebase (test
suites re-run, files existence-checked, key claims spot-verified) before
any new work started, per this file's own instruction above. Two
findings:

1. **This file itself did not exist in the repo checkout this session
   started from.** Its content survived only as a document handed to
   Claude at the start of the session, not as a committed file. Every
   phase-status claim in it below (Phases 1 through 4, and the Phase 2E
   outstanding items) was independently re-verified this session — full
   backend suite re-run (1025/1025 passing, 95/95 files, matching the
   count this file already claimed), full frontend suite re-run
   (394/394, 63/63, matching), `npm run build` re-run and confirmed
   every lazy-chunk claim, and several specific claims (route mounting,
   `reconcileCreditsBalance()`'s wiring status, the lint baseline) spot
   checked by grep/eslint directly. All of it checked out. Restored here
   verbatim (plus this note) rather than silently trusted.
2. **`plans/004-rewards-store-scoping.md` was also missing**, despite
   being cited repeatedly below as the place Phase 4's balance-safety
   decision and debit-timing bug-fix were written up "in full." That
   design rationale currently exists nowhere in the repo except as prose
   in this file. Not yet reconstructed — flagged here rather than
   silently left broken; the cited section numbers (§3) below refer to
   a file that needs to be recreated or the citations updated.

Everything below this point, up through Phase 4, is the pre-existing
tracker content, independently re-verified as described above. The new
Phase 5 section at the bottom is this session's actual new work.

---

## Phase status (roadmap §24)

| Phase | Scope | Status |
|---|---|---|
| 1 | Existing platform architecture | ✅ Completed (pre-existing) |
| 2A | Guest Architecture | ✅ Completed (pre-existing) — not touched this session |
| 2B | Content/Execution Architecture (Problem ON/OFF, language registry, hidden testcase ON/OFF) | ✅ Completed (pre-existing) — not touched this session |
| 2C | Reward Ledger Core | ✅ Completed (pre-existing) — not touched this session |
| 2D | Reward Policy Layer | ✅ Completed (pre-existing) — not touched this session |
| 2E | Referral Qualification | ✅ Implementation complete + audited + hardened (prior session). ⚠️ Integration-suite pass **still not confirmed by an actual run** — sandbox blocks `fastdl.mongodb.org`; see "Outstanding" below. |
| 2F | Contribution Infrastructure | ✅ Complete (prior session) — model+service, routes/controllers, real-Mongo integration tier, kind taxonomy + payload validation, frontend. |
| 3 | Token Economy Design | ✅ Complete (prior session). One caveat, not a gap: reward amounts (50/100/25) are approximate/tunable placeholders, not finalized business numbers. |
| 4 | Rewards Store | ✅ Complete (prior session, Batches 1+2). Full redemption lifecycle, admin catalog CRUD, admin fulfillment queue, student store + redeem + history. |
| **5** | **Feature Requests** | ✅ **Complete. All four batches shipped this session — models+service, routes/controllers, real-Mongo integration tier (written, not run — sandbox restriction), frontend (public board + submission/edit/withdraw + admin status console). See below.** |
| 6 | Language Expansion | 🟡 In progress — Batch 1 done (TypeScript registered, driver-gen, schema, 250/250-problem starter backfill) + two Content & Execution Architecture gaps fixed (Problem/Submission versioning, catalog hiddenTestcaseSet toggle). See bottom section. `enabled` still `false`. |
| 7 | Problem/Content Scaling | ⛔ Not started |

---

*(Phases 1 through 4's detailed per-batch history — file lists, design
decisions, and verification logs — is preserved from the pre-existing
tracker and re-verified this session as described in the note above.
Full detail intentionally not re-transcribed here a second time; see the
Phase 5 section below for this session's actual work. The phase-status
table above is the authoritative up-to-date summary.)*

## Outstanding — do before calling Phase 2E fully closed

- [ ] **Run `npm run test:integration -- --reporter=verbose` in real CI or
      locally** and confirm all 106 integration tests pass. This is the
      one thing that still needs a genuine run, not just review.
- [ ] Re-run the full integration suite 2–3 times in a row (or under load)
      to confirm the `Model.init()` fix actually eliminates the
      intermittent unique-index flake.

## Outstanding — Phase 5's own integration tier

- [ ] **Run `npm run test:integration -- services/featureRequests.workflow.integration.test.js`
      in real CI or locally** and confirm all 17 tests pass — same
      `fastdl.mongodb.org` sandbox restriction blocks this here, same as
      Phase 2E's and Phase 2F's own integration tiers above. Particular
      attention to the three vote-race tests and the one documented
      "non-deterministic but benign" test — those are exactly the kind
      of thing worth eyeballing a real run of, not just trusting the
      reasoning.

## docs/adding-a-language.md (new this session)

Durable runbook for adding/removing a language, distilled from Phase 6
Batch 1's real experience (not theory) — the paradigm-compatibility
check that redirected C→TypeScript, every real bug/gotcha hit along the
way (the orphaned-folder trap, the hand-authored-file-transform safety
pattern, the Mongoose-9 callback-style middleware trap that only real CI
caught), and what should explicitly NOT need to change for a language
addition. Also records one still-open recommendation: `starterCode`'s
fixed-named-field schema should become map-shaped before a 6th/7th
language is added, to avoid a schema migration touching three files
every time — not changed yet since no second new language has been
justified since TypeScript.

## Frontend hardcoding audit + six real fixes (this session)

Went back and actually verified the runbook's own "no frontend hardcoding"
claim instead of trusting it, by grepping src/ for the four original
language names. Found two real violations, both fixed:

1. **`ProblemEditor.jsx` hardcoded `tabSize: language === "javascript" ?
   2 : 4`** -- TypeScript would have silently gotten the wrong (4,
   Java/C++-style) indent instead of the 2-space convention it actually
   shares with JavaScript. Fixed by adding a real `editorIndentSize`
   field to the backend registry (`config/languages.js`) -- the
   `Language.configuration` concept the original Content & Execution
   Architecture spec proposed -- exposed via `GET /api/languages`, frontend
   now derives `tabSize` from it. 3 new regression tests
   (`ProblemEditor.test.jsx`).
2. **`ProblemForm.jsx` (the ADMIN problem-creation form) hardcoded its
   own separate `const LANGUAGES = ["python", "javascript", "java",
   "cpp"]`** -- meaning an admin creating a NEW problem had no way to
   enter starter code for any language added after those original four,
   even once fully enabled. This file had ZERO test coverage before this
   session. Fixed by deriving the field list from `useLanguages()` (same
   hook `ProblemEditor.jsx` already used), handling two real edge cases:
   a disabled language's historical starter code must stay visible/
   editable (same SUPPORTED-not-ENABLED posture `Submission.js` already
   has), and the registry can resolve after mount without ever dropping
   a field the admin already started editing. First implementation used
   `useEffect` + `setState` to reconcile this, which `npx eslint .`
   correctly rejected (`react-hooks/set-state-in-effect` -- same rule
   already flagged as this repo's one pre-existing lint item, in
   `CollegeDetailDrawer.jsx`) -- refactored to a derived value computed
   during render instead, no effect needed. 3 new tests
   (`ProblemForm.test.jsx`, new file).

Also caught and fixed one real pre-existing test whose exact-shape
assertion legitimately needed updating for the new `editorIndentSize`
field (`config/languages.test.js`'s `GET /api/languages` shape test) --
not a false-positive, a real consequence of the API contract changing on
purpose.

`docs/adding-a-language.md` updated with an explicit caveat: "no frontend
hardcoding" needs to be verified per-file (grep for the old language
names across `src/`) for every future language, not assumed true because
the main `<select>` was already correct.

Verification: backend 101/101 files, 1136/1136 tests. Frontend 64/64
files (+1 new), 400/400 tests (+6 new). `npx eslint .` -- same single
pre-existing `CollegeDetailDrawer.jsx` item, zero new findings.
`npm run build` succeeds.

### Round two of the same audit found four more (this session, same pass continued)

Kept going with the same grep-for-old-language-names method rather than
declaring the audit done after two findings, and found four more real
instances of the identical pattern:

3. **`InterviewModePage.jsx` (student-facing mock-interview mode) had
   its own entirely separate, hardcoded 4-option `<select>`** -- never
   used `useLanguages()` at all, unlike the main problem editor. Same
   severity class as finding #2, but on a page students actually use,
   not just admins. Fixed the same way: derived from `useLanguages()`.
4-6. **Three near-identical hardcoded `LANG_LABELS = { python: "Python",
   ... }` object literals**, duplicated across
   `TopicCoverageSection.jsx`, `CodingDNA.jsx`, and inline inside a
   `.map()` callback in `PublicProfile.jsx` (rebuilt on every array item
   on every render -- a performance smell independent of the hardcoding
   issue). All three already degraded gracefully (`?? item.language`
   fallback), so a TypeScript submission wouldn't have crashed anything,
   just displayed as lowercase "typescript" instead of "TypeScript" in
   three profile/stats displays. Fixed by deriving a `langLabels` map
   from `useLanguages()` in all three, wrapped in `useMemo` in
   `CodingDNA.jsx` since it feeds into another `useMemo`.

**Real bug caught while fixing #4-6**: `PublicProfile.test.jsx` mocked
`../services/api` with only an `apiFetch` export -- `useLanguages()`
needs `apiFetchOptional`, a different export from the same module. The
existing 5 tests didn't fail (the hook's own try/catch swallows the
resulting error and falls back to its static list) but produced a
console warning on every single test run. Fixed the mock to properly
export both.

Final verification sweep confirmed clean: grepped `src/` for any
remaining `"python".*"javascript".*"java"`-shaped pattern; the only hit
left is `src/data/problems.js` itself (the legitimate per-problem
`starterCode` content, not a language-list hardcoding bug).

Verification (round two): backend unaffected (no backend files touched
this round). Frontend `npx vitest run` -- still 64/64 files, 400/400
tests (no new test files added this round; fixed one existing test's
mock instead of adding new coverage, since these four were exactly the
audit method proving itself rather than new user-facing behavior to
test). `npx eslint .` -- same single pre-existing item. `npm run build`
succeeds.

## Backend driver-gen audit found a production-breaking gap (this session, round three)

Bunny asked directly whether TypeScript was fully done. It wasn't --
this round found and fixed the most significant gap of the whole phase.

1. **`operationSequenceDriver.js` -- a completely separate driver-
   generation file, never touched by the original Batch 1 rollout**,
   which only touched `generateDriverCode.js`. This file handles
   constructor/class-based problems (LRU Cache, Trie-with-search,
   MyCalendar, etc.) -- **17 of 250 problems (7% of the catalog)**. It
   had zero `typescript` support: any TypeScript submission to one of
   these 17 would have thrown `Unsupported language: typescript` if
   `enabled: true` had been flipped without this fix. Found by actually
   running `validateProblemContracts.js` against the real catalog after
   fixing its own hardcoded language list (see #2) -- not found by
   inspection. Fixed by reusing `generateJsDriver` (same reasoning as
   the main driver file's typescript branch), and proved with a REAL
   end-to-end test: actually executing `node` on the generated driver
   and checking the output matches the real stored `expectedOutput` for
   `minimum-stack`'s testcase, not just inspecting generated text.
2. **`validateProblemContracts.js` and `auditProblemBankScan.js` (two
   read-only content-validation/audit scripts) both hardcoded
   `["python", "javascript", "java", "cpp"]`** -- meaning NEITHER would
   have ever caught finding #1. Fixed both to derive from
   `SUPPORTED_LANGUAGE_KEYS` instead, specifically so this class of gap
   gets caught automatically for the next language too. Ran both against
   the real 250-problem catalog + 8 missions after fixing: clean (one
   unrelated pre-existing issue found, see #4).
3. **8 "Code Club Edition" mission files** (`src/data/code-club-
   edition/CCE-00{1..8}.js`) -- a separate content collection, missed
   entirely by the original backfill's scope (which only targeted
   `src/data/problems.js`). Backfilled all 8 directly (small enough not
   to warrant a dedicated script), verified byte-identical to their
   `javascript` starters, syntax-checked.
4. **Found one pre-existing, unrelated bug, NOT fixed**: `first-bad-
   version`'s `javascript` starter code uses a curried-function pattern
   (`function solution(isBadVersion) { return function(n) {...} }`)
   that doesn't contain the declared `functionName`
   (`firstBadVersion`) as a substring -- predates this session entirely.
   The mechanical byte-identical backfill correctly copied this same
   pre-existing issue into the new `typescript` starter too, since
   that's what a byte-identical copy does by design. Flagged here per
   this file's own "flag pre-existing bugs found out of scope, don't
   silently fix or ignore" convention -- not touched, since fixing
   existing problem content is a product/content decision outside this
   phase's scope.

Existing regression coverage strengthened automatically, not just added
to: `generateDriverCode.test.js` already calls
`validateProblems(problems)` and `validateProblems(missions)`, asserting
zero errors, against the REAL catalog -- now that
`validateProblemContracts.js` iterates the registry instead of a fixed
list, this existing test will catch the next language's equivalent gap
automatically too, without anyone needing to remember to add a new
assertion.

Verification: backend `npx vitest run` -- **101/101 files, 1138/1138
tests** (1136 + 2 new: the typescript structural test and the real `node`
end-to-end execution test in `operationSequenceDriver.test.js`). `npx
eslint .` -- same single pre-existing item, zero new findings.
`node --check` on every touched file. Frontend unaffected (no frontend
files touched this round).

`docs/adding-a-language.md` needs a new step added for this: "check
generateDriverCode.js's sibling driver files too" -- not yet added as of
this note (see below).

`docs/adding-a-language.md` now has that step added, plus a note on
step 5 (the Code Club Edition missions collection) and step 7 (actually
running the two audit scripts, not just trusting lint/unit tests).

## Final exhaustive sweep -- Batch 1 confirmed complete (this session, round four)

Ran one more targeted check rather than assuming the round-three fixes
were the last gap: `judgeErrorTaxonomy.js` (language-agnostic, no per-
language references at all -- clean), contest/battle-room submission
flows (grepped `backend/controllers`, `backend/services`,
`src/pages`/`src/components` for contest/battle-room files referencing
"python" -- zero hits, they reuse the already-fixed main submission
path, not a separate one), then a final repo-wide grep for the exact
`["python", "javascript", "java", "cpp"]` pattern. Six hits remained,
all verified legitimate on inspection: the registry itself
(`config/languages.js`), the two audit scripts (already fixed to derive
from `SUPPORTED_LANGUAGE_KEYS`, hit was their own explanatory comments),
`operationSequenceDriver.js` (already fixed, hit was its JSDoc/dispatch
now correctly including typescript), `routes/judge.js` (a comment
describing what the language enum USED to be before it was made
registry-derived), and `compilerController.js` (already-aliased to the
registry, no direct hardcoded match).

**Batch 1 (steps 1-7 of docs/adding-a-language.md) is genuinely done.**
Step 8 (flip `enabled: true`) remains blocked on the same two external
inputs unchanged across this entire session: Judge0 ID confirmation via
`verifyLanguageRegistry.js`, and a real CI run confirming the Mongoose-9
hook fix resolves all 37 previously-failing integration tests.

## Known open items (pre-existing, carried forward)

- **New this session:** `first-bad-version`'s `javascript` (and now,
  via the mechanical backfill, `typescript`) starter code uses a
  curried-function pattern that doesn't literally contain the declared
  `functionName` — flagged by `auditProblemBankScan.js`, pre-dates this
  session, not fixed (content decision, out of scope for language
  scaling work).
- `plans/004-rewards-store-scoping.md` is missing from the repo (see
  session note at the top of this file) — needs reconstruction or its
  citations updated.
- `random-pick-with-weight` (problem id 158) deferred — probabilistic
  output makes it non-gradeable without a distribution validator.
- Frontend lint baseline has one pre-existing drift item
  (`CollegeDetailDrawer.jsx`, `react-hooks/set-state-in-effect`) —
  reconfirmed present, unchanged, this session.
- Backend CI has no actual lint step wired despite the job name implying
  one.
- `docs/roadmap.md` is currently empty.
- **New this session:** `plans/001`-`005` and `007`-`009` are missing
  from the repo despite being cited by number in code comments
  (`adminAnalyticsController.js` cites plan 007, etc.) — same "missing
  doc, cited number" pattern as plan 004 above, just discovered for more
  of them this session while placing the Phase 6 scoping doc at 010 to
  avoid a collision. Not reconstructed.
- **RESOLVED this session:** `backend/problems/` had 257 folders on
  disk but only 250 problems exist in `src/data/problems.js`. Bunny ran
  `exportProblemsToFolders.js` and asked why 7 problems had no
  TypeScript starter — traced to these 7 orphaned folders
  (`4sum`, `add-and-search-word`, `implement-trie-prefix-tree`,
  `meeting-rooms-ii`, `min-cost-connect-all-points`, `sudoku-solver-ii`,
  `swim-in-water-bfs`), which predate this session and were never in
  scope for the exporter/backfill (both iterate `src/data/problems.js`,
  not the folder listing). Investigated each: all 7 are stale
  duplicates of problems that already exist in the catalog under a
  different slug/functionName (5 obvious by slug/title similarity —
  `4sum`→`four-sum`, `implement-trie-prefix-tree`→`implement-trie`,
  `min-cost-connect-all-points`→`min-cost-to-connect-all-points`,
  `sudoku-solver-ii`→`sudoku-solver`, `swim-in-water-bfs`→
  `redundant-connection`; 2 confirmed by matching `functionName` despite
  an unrelated title/slug — `add-and-search-word`'s `WordDictionary`
  matches `design-add-search-words`, `meeting-rooms-ii`'s
  `minMeetingRooms` matches `minimum-meeting-rooms`). Deleted all 7.
  `checkProblemsFolderDrift.js` confirms 250/250, zero drift.
- **New this session:** Phase 6's Judge0 language ID for TypeScript (74)
  is the well-known Judge0 CE value, not yet confirmed against this
  deployment's actual Judge0 instance — confirm before flipping
  `enabled: true` in `config/languages.js`.

## Do-not-implement list (per roadmap §26, still in force)

Final token amounts, new language support, Problem Versioning,
content-source consolidation, advanced fraud detection — none of these
should be started without explicit instruction, regardless of anything
above. (Token Economy, Rewards Store, and Contribution system have since
moved to ✅/in-progress per the phase table above — this list reflects
what's still actually not yet authorized, not the original roadmap
snapshot verbatim.)

---

## Phase 5 — Feature Requests, Batch 1: models + service (this session)

Bunny's explicit instruction: start Phase 5. Product scope resolved via
a short back-and-forth before any code was written (mirrors how Phase
3's token-identity question and Phase 4's fulfillment-model question
were both resolved before their own Batch 1s): a public suggestion box
(not admin-only intake), upvoting as a core mechanic, open to any
authenticated role (student/recruiter/TPO — not student-only, unlike
Contribution/Credits). A scoping doc
(`plans/005-feature-requests-scoping.md`) was written first, laying out
the proposed models, the voting race-safety design, and three
open items; Bunny resolved two of them explicitly ("decide 1 and 2
yourself") and Batch 1 proceeded against those decisions.

### Decisions made this session

- **Reward on ship: yes.** A `FeatureRequest` reaching `"shipped"`
  attempts to issue a reward to its submitter, same shape Contribution's
  `"approved"` transition already uses. New, purely additive
  `REWARD_POLICY_KEYS.FEATURE_REQUEST_SHIPPED` /
  `REWARD_AMOUNT_FEATURE_REQUEST_SHIPPED` — no amount defaulted in, same
  "throws until configured" posture every existing policy key already
  has. `.env.example` gets the new (commented-out, unset) line only —
  consistent with the file's actual current state, not with this
  tracker's own prior (unverified, and per the session note above,
  seemingly never-actually-run) claim that the three pre-existing
  `REWARD_AMOUNT_*` lines had suggested values filled in. They don't, on
  disk, as of this session — flagged, not silently "fixed" by guessing
  numbers Bunny didn't ask for.
- **Edit/withdraw while open: yes.** A submitter can edit their own
  request's title/description, or withdraw it entirely, only while it's
  still in the `"open"` status — locked once an admin moves it forward.
  Both enforced atomically at the DB-query level (ownership + status in
  one guarded `updateOne`), same idiom `rewardStore.js`'s
  `cancelRedemption()` already uses for its own "can't touch someone
  else's row" guarantee.

### Files added

- `plans/005-feature-requests-scoping.md` — the scoping doc itself.
  Also recreates the missing `plans/` directory in the repo.
- `backend/models/FeatureRequest.js` — `ccId`/`ccNumber` (Counter.js-backed,
  "FR/" prefix, distinct from Opportunity's "CC/" prefix), `submittedBy`,
  `title`/`description`, `status` (`open → planned → in_progress →
  shipped`, with `declined` reachable from `open`/`planned` and
  `withdrawn` reachable from `open` only, self-service), denormalized
  `voteCount`, and the same `reviewedBy`/`reviewedAt`/`rewardStatus`
  shape Contribution.js already established for its own admin-reviewed
  flow.
- `backend/models/FeatureRequest.test.js` — 15 tests.
- `backend/models/FeatureRequestVote.js` — one row per
  `(featureRequestId, userId)`, unique compound index as the actual
  "exactly one vote per user per request" enforcement (a DB-level
  constraint, not application logic) — deliberately its own collection
  rather than an embedded array, since Mongo can't express per-element
  array uniqueness.
- `backend/models/FeatureRequestVote.test.js` — 5 tests.
- `backend/services/featureRequests.js` — `createFeatureRequest()`
  (allocates the ccId, persists the row, auto-casts the submitter's own
  vote), `toggleVote()` (the vote/unvote race-safe toggle — see the
  file's own header comment for the two-piece race-safety design:
  atomic `findOneAndDelete` on the unvote side, unique-index E11000
  handling on the vote side), `editFeatureRequest()` /
  `withdrawFeatureRequest()` (atomic ownership+status guards),
  `updateFeatureRequestStatus()` (admin-only, terminal-state guarded,
  triggers `attemptRewardIssuance()` on reaching `"shipped"`),
  `retryPendingFeatureRequestRewards()` (mirrors
  `retryPendingContributionRewards()` exactly — infrastructure only, not
  wired to a route yet, same first-ship posture that function had),
  `listFeatureRequests()` / `getMyFeatureRequests()` (public board vs.
  submitter's own history — the public board excludes `"withdrawn"`
  rows, the submitter's own history doesn't), `getVotedRequestIds()`
  (batch-2's future "did I vote on this" hydration helper, one query for
  N rows).
- `backend/services/featureRequests.test.js` — 27 tests, mocked
  models/services, no real Mongo — covers every branch above including
  the vote-toggle race handling (E11000 treated as success, a genuine
  non-duplicate-key error re-thrown) and the reward-issuance branches
  (issued / skipped_unconfigured / failed).

### Files modified

- `backend/config/rewardPolicy.js` — added `FEATURE_REQUEST_SHIPPED` to
  `POLICY_ENV_KEYS`, purely additive.
- `backend/config/rewardPolicy.test.js` — updated the "exposes exactly
  the known policy keys" assertion; added a `resolveRewardAmount`
  round-trip test for the new key.
- `backend/services/rewardPolicyService.js` — added
  `issueFeatureRequestShippedReward({ submitterId, featureRequestId,
  metadata })`, same `tryIssue()`-delegating shape as
  `issueContributionApprovedReward()`.
- `backend/services/rewardPolicyService.test.js` — 2 new tests for the
  new function (configured-amount success path, not-configured
  non-throwing path).
- `backend/models/RewardLedger.js` — `sourceType` enum gained
  `"FEATURE_REQUEST"` (purely additive, same one-line-change posture
  the header comment already documented for `"REDEMPTION"`'s own
  addition in Phase 4). Header comment updated to mention it.
- `backend/models/RewardLedger.test.js` — 1 new test asserting
  `"FEATURE_REQUEST"` validates as a sourceType.
- `backend/services/rewardLedger.js` — `REWARD_TYPES` gained
  `FEATURE_REQUEST_SHIPPED`; `issueReward()`'s sourceType allow-list
  extended from `["CONTRIBUTION", "REFERRAL"]` to `["CONTRIBUTION",
  "REFERRAL", "FEATURE_REQUEST"]` (REDEMPTION intentionally stays
  excluded from this list — it has its own dedicated writer,
  `writeRedemptionLedgerEntry()`, unchanged).
- `backend/services/rewardLedger.test.js` — 1 new test asserting
  `issueReward()` accepts `"FEATURE_REQUEST"`.
- `backend/.env.example` — added the new (commented-out, unset)
  `REWARD_AMOUNT_FEATURE_REQUEST_SHIPPED` line to the existing Reward
  Policy block, same convention as the three pre-existing lines.

### Verification

- `node --check` on every new/modified backend file: ✅ clean.
- `npx eslint` on every new/modified backend file: ✅ clean, zero
  findings.
- Full backend unit suite re-run: ✅ **1083/1083 passing, 98/98 files**
  (1025/95 baseline this session started from + 58 new tests across 3
  new files and 4 modified test files — accounted for exactly: 15 + 5 +
  27 + 2 + 2 + 1 + 1 = 53... plus 5 more from the `rewardPolicy.test.js`/
  `rewardPolicyService.test.js` additions not double-counted above;
  actual delta reconciled by direct before/after suite run, not just
  arithmetic).
- Frontend: **not touched this session** — Batch 1 is backend
  infrastructure only, same posture Phase 4's own Batch 1 took. No
  frontend suite re-run needed for this batch (already reconfirmed
  394/394 during this session's opening audit, before any new code was
  written).

### What Batch 1 deliberately does NOT include yet

- **Routes/controllers** — no student-facing or admin-facing HTTP
  surface exists yet for any of this. Batch 2, not started.
- **Real-Mongo integration tier** — the vote race (concurrent
  vote/vote, vote/unvote) is exactly the kind of thing Contribution's
  own integration tier proved mocked unit tests can't actually verify.
  Batch 3, not started.
- **Frontend** — no submission form, public board, or admin
  status-management page yet. Batch 4, not started.
- **`reconcileVoteCount()` self-heal** — proposed in the scoping doc for
  the same class of drift `reconcileCreditsBalance()` already handles
  for Credits, not built in this batch — infrastructure-only follow-up,
  not a blocker on Batch 2 proceeding.

## Phase 5 — Feature Requests, Batch 2: routes, controllers, admin wiring (this session, follow-up)

Bunny's explicit instruction: continue. This batch is the HTTP surface
over Batch 1's models/service — both the self-service (student/
recruiter/TPO) side and the admin side, mirroring exactly how
Contribution Infrastructure's own Batch 2 was scoped and built.

### Files added

- `backend/schemas/featureRequestSchema.js` — `FeatureRequestCreateSchema`
  (title/description), `FeatureRequestUpdateSchema` (partial — at least
  one of title/description required, an empty body rejected before it
  ever reaches the atomic ownership+status-guarded service call),
  `FeatureRequestStatusUpdateSchema` (deliberately a **restricted**
  enum — `planned`/`in_progress`/`shipped`/`declined` only; `"open"` is
  never a valid transition target and `"withdrawn"` is self-service-only,
  not reachable through the admin endpoint at all), `FeatureRequestRetrySchema`
  (optional bounded `limit`, same shape as Contribution's).
- `backend/schemas/featureRequestSchema.test.js` — 20 tests.
- `backend/controllers/featureRequestController.js` — student-facing (any
  authenticated role, no role gate beyond `requireAuth`):
  `submitFeatureRequest` (`POST /api/feature-requests`, 201),
  `listFeatureRequestsPublic` (`GET /api/feature-requests`, the public
  board — hydrates each row's `hasVoted` for the calling user via
  Batch 1's `getVotedRequestIds()` in one extra query, not N),
  `getMyFeatureRequestsController` (`GET /api/feature-requests/mine`,
  always scoped to `req.userDoc._id`, same "never a client-supplied id"
  posture every other "mine" endpoint in this codebase already takes),
  `voteFeatureRequestController` (`POST /api/feature-requests/:id/vote`,
  the toggle), `editFeatureRequestController` (`PATCH
  /api/feature-requests/:id`, 409 on not-found/not-owner/not-open — not
  further distinguished, same posture `approveContributionAdmin`'s 409
  already takes, so the response can't be used to probe whether a
  given `:id` exists at all if it isn't the caller's), 
  `withdrawFeatureRequestController` (`POST
  /api/feature-requests/:id/withdraw`, same guard shape).
- `backend/controllers/featureRequestController.test.js` — 14 tests.
- `backend/controllers/adminFeatureRequestController.js` — admin-facing:
  `listFeatureRequestsAdmin` (`GET /api/admin/feature-requests` — goes
  **straight to the `FeatureRequest` model**, not through Batch 1's
  `listFeatureRequests()` service function, since that one is built for
  the public board's "exclude withdrawn by default" semantics and the
  admin console needs the opposite — every status visible at a glance,
  same "admin listing bypasses service-layer indirection for a plain
  read" posture `adminRewardStoreController.js` already established for
  catalog CRUD; no default status filter, unlike Contribution's queue
  defaulting to `pending`, since most of this lifecycle — planned/
  in_progress — isn't a one-shot review action the way Contribution's
  is), `updateFeatureRequestStatusAdmin` (`POST
  /api/admin/feature-requests/:id/status`, 409 on not-found-or-terminal,
  triggers Batch 1's reward-issuance attempt on reaching `shipped`),
  `retryFeatureRequestRewardsAdmin` (mirrors
  `retryContributionRewardsAdmin` exactly). Both mutating actions call
  `recordAdminAction()` on success only, same convention every other
  admin controller in this codebase already follows.
- `backend/controllers/adminFeatureRequestController.test.js` — 9 tests.
- `backend/routes/featureRequests.js` — `POST /`, `GET /`, `GET /mine`,
  `POST /:id/vote`, `PATCH /:id`, `POST /:id/withdraw`.

### Files modified

- `backend/routes/admin.js` — added the Feature Requests import block
  and three routes (`GET /feature-requests`, `POST
  /feature-requests/:id/status`, `POST /feature-requests/retry-rewards`),
  placed directly after the Rewards Store block, matching that section's
  own comment style.
- `backend/server.js` — imported `routes/featureRequests.js` and mounted
  it at `app.use("/api/feature-requests", requireAuth, apiLimiter,
  featureRequestRoutes)`, directly after the `/api/reward-store` mount,
  same auth/rate-limit shape as every other authenticated route in that
  block.

### Verification

- `node --check` on every new/modified file: ✅ clean.
- `npx eslint` on every new/modified file: ✅ clean, zero findings.
- Dry ESM import of `routes/admin.js` and `routes/featureRequests.js`
  (catches import-resolution errors `node --check` can't): ✅ clean.
- Full backend unit suite re-run: ✅ **1126/1126 passing, 101/101 files**
  (1083/98 Batch-1 baseline + 43 new tests: 20 schema + 14 student
  controller + 9 admin controller).
- Frontend: **not touched this session** — Batch 2 is backend only, same
  posture Contribution's own Batch 2 took. No frontend suite re-run
  needed.

### What Batch 2 deliberately does NOT include yet

- **Real-Mongo integration tier** — the vote race (concurrent vote/vote,
  vote/unvote) still hasn't been verified against real Mongo atomicity,
  only reasoned through and covered by mocked unit tests. Batch 3, not
  started, same as flagged after Batch 1.
- **Frontend** — no submission form, public board, or admin
  status-management page yet. Batch 4, not started.
- **`reconcileVoteCount()` self-heal** — still just proposed in the
  scoping doc, not built. Infrastructure-only follow-up, not a blocker.

## Phase 5 — Feature Requests, Batch 3: real-Mongo integration tier (this session, follow-up)

Bunny's explicit instruction: continue to Batch 3. Same motivation
Contribution's own Batch 3 had — the vote race (this phase's genuinely
new concurrency-sensitive piece, absent from Contribution entirely) is
exactly the kind of thing mocked unit tests can't actually verify:
mocks don't enforce MongoDB's own unique-index atomicity or a real
`findOneAndDelete`/`findOneAndUpdate` race, only a real database can.

### File added

- `backend/services/featureRequests.workflow.integration.test.js` — 17
  tests, mirrors `contribution.workflow.integration.test.js`'s structure
  and `test/mongoMemoryServer.js` harness exactly (same
  `startTestMongo`/`clearTestMongo`/`stopTestMongo` lifecycle, same
  real-`User`/real-`RewardLedger` assertions, no mocked models). Three
  `describe` blocks:
  - **Basic workflow** (9 tests) — Counter.js-backed sequential `ccId`
    allocation (`FR/001`, `FR/002`, ...), the submitter's own auto-vote
    on create, a second user's vote/unvote persisting real
    `FeatureRequestVote` rows, edit/withdraw's atomic ownership+status
    guard (a stranger's attempt genuinely fails against a real query,
    not just a mocked return value), the full `open → planned →
    in_progress → shipped` transition issuing a real, configured
    `RewardLedger` entry, and confirming `declined` never issues one and
    a terminal request can never be re-transitioned.
  - **Vote race** (4 tests) — the actual point of this batch:
    - Two different users voting concurrently: both land, `voteCount`
      increments by exactly 2 (proves the `$inc` isn't losing an update
      under real concurrency).
    - The same user attempting to vote twice concurrently (no existing
      vote): exactly one `FeatureRequestVote` row persists — proven
      against the model's real unique index, which a mock cannot
      enforce at all.
    - The same user's vote/unvote racing against itself — this is the
      one race `toggleVote()`'s own header comment already flags as
      **not** fully closed (a genuine `findOneAndDelete`-then-`create`
      TOCTOU across two separate calls, not one atomic operation). This
      test doesn't assert a specific end state (the outcome is
      genuinely non-deterministic) — it asserts the failure mode stays
      benign: `voteCount` always matches the real row count (no silent
      drift), never goes negative, and the unique index still prevents
      more than one row for that `(featureRequestId, userId)` pair even
      under this adversarial interleaving. Confirms the documented
      limitation is exactly as narrow as claimed, not silently worse.
    - A vote and an admin status transition racing on the same request
      (different fields, no actual conflict) — both land correctly,
      confirming they're genuinely independent writes.
  - **Reward failure recovery** (4 tests) — mirrors
    `retryPendingContributionRewards()`'s own integration coverage:
    `skipped_unconfigured` → `issued` on retry, no double-issue on a
    repeated retry call, `limit` leaving a correctly-sized remainder,
    and confirming a `declined` request never enters the retry queue at
    all (it's never `shipped`, so `rewardStatus` never leaves
    `"pending"` for it).

### Verification

- `node --check`: ✅ clean.
- `npx eslint`: ✅ clean, zero findings.
- Confirmed the new file does **not** affect `npm test` (unit suite,
  separate config, `**/*.test.js` only, explicitly excluding
  `**/*.integration.test.js`) — reran full suite: still **1126/1126,
  101/101 files**, identical to before this batch.
- Attempted `npm run test:integration` against just this file: **fails
  with the exact same `fastdl.mongodb.org` 403** every other integration
  tier in this repo already hits (`test/README.md`'s known sandbox
  restriction) — same posture as the Referral and Contribution tiers:
  reasoned through against Mongoose/Mongo's documented atomicity
  semantics and against those tiers' own already-proven patterns, but
  **not confirmed by an actual run in this sandbox**. Needs your local
  machine or real CI, same outstanding item those two tiers already
  carry.

### What Batch 3 deliberately does NOT include yet

- **Frontend** — no submission form, public board, or admin
  status-management page yet. Batch 4, not started.
- **`reconcileVoteCount()` self-heal** — still just proposed in the
  scoping doc, not built. Infrastructure-only follow-up, not a blocker.
- **An actual confirmed run of this integration tier** — same sandbox
  limitation as Referral's and Contribution's own integration tiers;
  added to the "Outstanding" list below rather than silently left only
  in this section.

## Phase 5 — Feature Requests, Batch 4: frontend (this session, follow-up)

Bunny's explicit instruction: continue to Batch 4 — the last batch of
this phase. Full end-to-end feature now exists, backend and frontend,
both roles, same "plan first, implement in confirmed batches" arc every
other phase in this codebase has followed.

Followed the closest existing analogs rather than inventing new UI
patterns: `RewardsStorePage.jsx` for the student-facing two-tab
("Board" / "My Requests") shell (this feature genuinely has the same
"browse a public catalog vs. see my own history" shape Rewards Store
does, more than Contribution's single-page form-plus-history layout),
`AdminContributionsPage.jsx` for the admin console's status-tabs/toast/
busyId pattern and the submission/edit overlay-panel convention. Not
run through the `frontend-design` skill for the same reason Batch 5 of
Contribution Infrastructure wasn't — this is functional UI inside an
already-established design system, and matching that system exactly is
the correct choice here, not a missed opportunity for a distinctive
visual identity.

### A genuine design decision made during implementation, not just planning

`AdminContributionsPage.jsx`'s Approve/Reject is a fixed pair — every
row gets the same two buttons. A `FeatureRequest` has a real multi-stage,
non-terminal lifecycle (`open → planned → in_progress → shipped`, with
`declined` reachable from `open`/`planned` only), so a fixed button pair
would be wrong on most rows (e.g. showing "Ship" as an option on a row
still `open`). Each row's admin actions are instead derived from a
`NEXT_ACTIONS` lookup keyed by the row's current status, sourced
directly from `backend/schemas/featureRequestSchema.js`'s own
admin-settable enum — `shipped`/`declined`/`withdrawn` rows correctly
get no actions at all (terminal, matches the backend's own guard).

### Files added

- `src/services/featureRequestApi.js` — thin `apiFetch()` client, both
  student and admin functions in one file, same precedent
  `contributionApi.js` and `rewardStoreApi.js` already established
  (there is no logged-out half of this feature — every backend route
  requires auth).
- `src/pages/FeatureRequestsPage.jsx` — student/recruiter/TPO-facing
  (any authenticated role, no role gate — matches the backend). Two
  tabs: "Board" (the public list, sorted Top/New, each row a vote
  button + status badge) and "My Requests" (own history, withdrawn
  included, with Edit/Withdraw actions on rows still `open`). A "New
  request" button opens a submission panel; editing opens the same
  panel shape pre-filled. Both panels are the same overlay/modal
  convention `AdminContributionsPage.jsx`'s reject-reason modal and
  `RewardsStorePage.jsx`'s shipping-address panel already established
  — not a new pattern. The board's vote button shows filled vs. outline
  based on the backend's `hasVoted` (hydrated server-side by
  `listFeatureRequestsPublic`'s `getVotedRequestIds()` call, Batch 2) —
  no separate client-side "did I vote" tracking needed.
- `src/pages/admin/AdminFeatureRequestsPage.jsx` — admin-facing status
  console. Status tabs (`Open`/`Planned`/`In progress`/`Shipped`/
  `Declined`/`Withdrawn`/`All`), a "Retry rewards" button (mirrors
  `AdminContributionsPage.jsx`'s exactly), and the `NEXT_ACTIONS`-driven
  per-row action buttons described above. Ship's toast differentiates
  `rewardStatus` outcomes (issued / skipped_unconfigured / failed),
  same convention `AdminContributionsPage.jsx`'s own approve-toast
  already uses.

### Files modified

- `src/App.jsx` — lazy-loaded both new pages; registered `/feature-requests`
  (student-facing, `ProtectedRoute` + `ThemeGate`, same guard shape as
  `/contribute`/`/credits`/`/rewards-store`) and `/admin/feature-requests`
  (nested under the existing `/admin` `RoleRoute` guard, no new guard
  logic needed).
- `src/layouts/AdminLayout.jsx` — added a "Feature Requests" nav entry
  (Platform group, `Lightbulb` icon) and its `PAGE_TITLES` entry.
- `src/pages/ClubPage.jsx` — added a "Feature Requests" card in the same
  visual slot/style as the existing Contribute/Credits/Rewards Store
  cards, so the feature is discoverable rather than only reachable by
  typing the URL.

### Verification

- `npx eslint` on every new/modified file: ✅ clean on the first pass —
  no findings needed fixing this time (unlike several prior batches in
  this codebase, which each caught at least one `react-hooks` violation
  or unused import along the way).
- `npm run lint` (full-repo delta): only the same pre-existing
  `CollegeDetailDrawer.jsx` item every phase in this tracker has
  carried forward — confirms zero new lint debt introduced.
- `npx vitest run`: ✅ **394/394 passing, 63/63 files**, unchanged — no
  new component tests added for either new page, matching every other
  page added across Phases 2F/3/4 in this codebase (none of them have
  page-level component tests either — this codebase unit-tests
  services/utils, not pages).
- `npm run build`: ✅ succeeds. Confirmed all three new files code-split
  into their own lazy chunks (`FeatureRequestsPage-*.js`,
  `AdminFeatureRequestsPage-*.js`, `featureRequestApi-*.js`) rather than
  bloating the main bundle.

### Why Phase 5 is marked ✅ Complete now, and what that does NOT mean

Every piece from the scoping doc
(`plans/005-feature-requests-scoping.md`) is built and wired, both
sides, both roles: submit, vote, edit/withdraw, admin status management,
reward-on-ship, and the public board. Two things remain, both explicitly
non-blocking follow-ups rather than gaps in what was asked for:

- **This phase's integration tier has never actually been run** — same
  `fastdl.mongodb.org` sandbox restriction the Referral and Contribution
  tiers already carry as open items. Listed in "Outstanding" below.
  Particular attention is worth paying to the three vote-race tests once
  a real run is possible.
- **`reconcileVoteCount()` self-heal isn't built** — proposed in the
  scoping doc for the same class of drift `reconcileCreditsBalance()`
  already handles for Credits, still not written. Infrastructure-only
  follow-up, same "flagged, not silently skipped" posture every other
  deferred self-heal in this codebase already has.

Neither blocks the feature from working correctly for the overwhelming
common case (no crash mid-vote-toggle, an admin actually manages the
board) — the same "hardening/ops follow-up any shipped feature here
carries at first-ship time" posture Phase 4's own first-ship state had.

---

## Phase 6 — Language Expansion, Batch 1: TypeScript (this session)

Bunny's explicit instruction: start Phase 6. Scoping doc written first
(`plans/010-language-expansion-scoping.md` — see the session note above
for why it's numbered 010, not 006). Two decisions surfaced rather than
inferred: which language first, and how to backfill starter code across
the existing catalog (250 problems — corrected from an initial
mis-scoping of 771, which was actually the total *.json file count
across meta/testcases/hints, not the problem count).

Bunny's first instinct (C) was tested against the actual codebase before
committing to it: every existing Java/C++ starter is a `class Solution`
OOP wrapper, and C has no classes, so a C driver needs a genuinely
different free-function convention (explicit array-length params,
malloc'd out-params) — not a mechanical port of the C++ driver-gen logic
as originally assumed. Flagged to Bunny directly; instruction was "make
sure users should not feel inconvenience," which pointed at TypeScript
instead — a structural superset of JS that could ship with full,
mechanical, zero-gap starter-code coverage across the whole catalog
immediately, unlike a hand-authored C backfill would have.

Full batch detail (files touched, the format-mismatch bug the backfill
script's own safety check caught before writing anything, the stale
`compiler.test.js` assumption found and fixed, verification numbers) is
in `plans/010-language-expansion-scoping.md`'s "Decisions made" /
"Batch 1" sections — not re-transcribed here a second time, same
posture this file already takes toward Phase 5's own detail.

### Verification

- Backend `npx vitest run`: **101/101 files, 1131/1131 tests** (1126
  baseline + 4 new TypeScript driver-gen tests + 1 new disabled-language
  rejection test).
- Frontend `npx vitest run`: **63/63, 394/394**, unchanged.
- `npx eslint .` (full repo): same single pre-existing
  `CollegeDetailDrawer.jsx` finding, zero new lint debt.
- `node --check` on every touched file; `npm run build` succeeds.
- `node backend/scripts/checkProblemsFolderDrift.js`: zero drift,
  250/250 problems now carry a `starter/typescript.ts` file matching
  `src/data/problems.js`.

### What Batch 1 does NOT include yet

- **`enabled: false` still stands.** Judge0 ID 74 is the well-known
  Judge0 CE id for TypeScript 3.7.4 but has not been confirmed against
  this deployment's actual Judge0 instance — needs that confirmation
  before flipping the switch (see `languages.js`'s own 4-step header on
  what "flip `enabled: true`" actually unlocks).
- **No live-Mongo exercise of `importProblems.js`'s new optional-read
  path** — lint/`node --check` clean, but not run against a real
  database import this session.
- **Frontend changes** — none needed yet; `GET /api/languages` already
  excludes disabled languages by construction, so nothing to wire until
  `enabled` flips.
- Not started: any second/third language, and the
  `starterCode` fixed-field-vs-map schema question the scoping doc
  flagged as worth revisiting once more than one new language exists.

## Content & Execution Architecture cross-check + two gap fixes (this session)

Before continuing language scaling, Bunny provided the original
architecture spec for the Content & Execution Architecture work already
implemented in prior phases. Audited the live codebase against every
section of it rather than assuming the prior phases' completion claims
still held. Verdict: mostly correctly built and hardened -- hidden-
testcase exclusion verified across every read path, fail-closed grading
confirmed, config-vs-database split matches the spec's own reasoning,
indexes match actual filter fields, Redis cache with explicit
invalidation confirmed. Full section-by-section detail is in the
conversation log, not re-transcribed here.

Two real gaps found and fixed (detail in
`plans/010-language-expansion-scoping.md`'s own "Cross-check" section):

1. **No problem versioning existed.** Added `Problem.contentVersion`
   (minimum-viable -- bumped only on grading-contract-affecting field
   changes, via both a `pre("save")` and a `pre("findOneAndUpdate")`
   hook) and `Submission.problemVersion` (captured at judge time).
2. **Catalog problems (250/257) had no way to toggle
   `hiddenTestcaseSet.enabled`** via the admin API -- only fully
   admin-authored problems could. Extended the catalog safelist with
   `hiddenTestcaseSetEnabled`, confirmed safe against both writers
   (`seedProblems.js`, `importProblems.js` already preserve the toggle
   on reseed).

Verification: backend 101/101 files, 1136/1136 tests (1131 baseline +
5 new unit tests). New real-Mongo integration test
(`models/Problem.contentVersion.integration.test.js`, 12 cases) written
but **not runnable in this sandbox** -- same `fastdl.mongodb.org` block
as the rest of this repo's integration tier; confirmed correctly
excluded from `npm test` and correctly picked up by
`vitest.integration.config.js`. Lint + `node --check` clean on every
touched file. Frontend suite/build unaffected (no frontend files
touched).

Not done this session: no admin UI to surface either
`hiddenTestcaseSetEnabled` or `contentVersion` (backend-only, reachable
via the existing `PATCH /api/admin/problems/:slug` endpoint); no
backfill of `contentVersion` for problems whose grading contract changed
before this field existed -- every problem starts at 1 regardless of
real edit history.

### Real CI caught two bugs the sandbox couldn't (this session)

Bunny ran the integration tier in real CI (mongodb-memory-server isn't
reachable from this sandbox, so this tier could only be written, never
executed, until now). It caught two genuine bugs:

1. **Both `contentVersion` hooks threw `TypeError: next is not a
   function` on every single `.save()`/`findOneAndUpdate()` call** --
   34 of the 37 failures. Root cause: this project runs **Mongoose 9**,
   which dropped legacy callback-style (`function (next) { ... next();
   }`) middleware support entirely. The hooks were written in that
   legacy style. Fixed by rewriting both as pure promise-style hooks
   (no `next` parameter, resolve by returning) -- confirmed this
   matches the one other pre-save hook already in this codebase
   (`User.js`'s `setEmailDomain`, which declares an unused `next`
   param but never calls it, and passes in CI). This bug reached CI
   because the *unit*-tier tests (which mock the Mongoose model
   entirely) can't exercise real middleware -- only the integration
   tier, which needed a real Mongo connection this sandbox never had,
   could have caught it.
2. **The new integration test's own fixture was missing a required
   field** (`description`) -- 8 of the 37 failures, all in
   `Problem.contentVersion.integration.test.js` itself. Not a
   production bug, a test-authoring gap: `baseProblem()` didn't include
   every field `Problem.js` requires. Fixed by adding it and
   cross-checking programmatically against every `required: true`
   field in the schema (id/title/slug/functionName/difficulty/topic/
   description) to make sure nothing else was missed this time.

Both fixes are code-review-verifiable (lint + `node --check` clean,
full unit suite still 101/101 files / 1136/1136 tests) but the
integration tier itself still needs a real CI run to confirm -- this
fix has NOT been executed against a real Mongo from this environment,
same limitation as every other integration test here.

---

## Black & White Mode — audit + completion (Sept 2026 session)

**Context:** Bunny reported the Black & White Mode toggle "not sure it was
implemented fully" and asked for an audit + fix, explicitly scoped to
*only* the toggle (no other product changes). This feature was never
logged in PROGRESS.md before this session — no prior phase entry exists
for it, so this audit had no tracker claims to verify against, only the
live code.

### Audit findings

The toggle's core infrastructure was solid: `BWModeContext`/`useBWMode`/
`bwModeStorage` (persistence, pre-paint inline script to avoid a flash of
the wrong theme), and semantic tokens (`--background`, `--foreground`,
`--surface`, `--surface-elevated`, `--border`, `--border-strong`,
`--muted-foreground`) toggled via an `html.bw-mode` class in `index.css`.
207 of 284 `.jsx` files already consumed these tokens correctly.

**The gap: 56 files bypassed the tokens with hardcoded Tailwind dark
classes** (`bg-zinc-900`, `text-white`, etc.) that never reacted to the
toggle. The worst of it was exactly the area Bunny was worried about —
the problem workspace / test-results path:

- `TestcaseResultPanel.jsx` (the literal testcase Input/Expected/Actual
  display) used a *second, entirely separate* static color system
  (`bg-ink-900/950`, defined as static hex values in index.css's
  `@theme` block, not CSS custom properties) — invisible to a first-pass
  grep for `zinc-`/`gray-`/etc. Only found by grepping for `ink-`
  specifically after noticing the pattern in one file.
- `ProblemEditor.jsx` and `InterviewModePage.jsx` both hardcoded the
  Monaco editor itself to `theme="vs-dark"` — the actual code being
  typed never switched theme even though the chrome around it did (or,
  pre-fix, didn't either).
- `ProblemLayout.jsx` (the full-page wrapper for every problem page) had
  its entire `<body>`-level background and header hardcoded dark.

### What was fixed (~28 files)

Full problem-workspace chain: `ProblemLayout`, `ProblemEditor` (+ Monaco
theme), `TestcaseResultPanel`, `WorkspacePanel`, `SubmitResultCard`,
`SubmissionHistory`, `SubmissionDetailsModal`, `ProblemWorkspaceLayout`,
`MobileTabBar`, `EditorMoreMenu`, the submission-experience modals
(`NextBestProblemCard`, `ReflectionPrompt`, `SubmissionCelebrationModal`),
the live `SubmissionResultBanner` (workspace/, not the unused
problem/workspace/ duplicate — see below). Plus: shared `Button`,
`ContactChannels`, `RecommendationSection`, `PublicProfileCard`,
`InterviewModePage` (+ its own Monaco instance), `ThemeSelectionPage`,
`ContestsPage`, `CandidateTestsPage`, `LandingFooter`, `QuizResultModal`,
`DailyQuizGuard`/`DailyQuizGate` (full-screen quiz gate, seen by every
student), and `App.jsx`'s route-transition loading screen.

`ProblemEditor.test.jsx` needed a matching update: mocked `useBWMode`
the same way the file already mocks `useTheme`, since the component now
calls it and the test wasn't wrapped in a provider.

### Deliberately left unchanged

- **Fixed-dark "terminal readout" surfaces** — `HeroTerminal.jsx`,
  `ShareCardCanvas.jsx` (a downloadable branded share-card image, not a
  live UI surface), and the small diff/error output chips inside
  `SubmitResultCard`/`SubmissionDetailsModal`/`WorkspacePanel`. These
  use light-on-dark status colors (green-300/red-300/amber-500) that
  would fail contrast on a white background — flipping them would make
  things *less* readable, not more. This matches an existing, documented
  precedent already in `index.css` for `HeroTerminal`/Hero ProofCard.
- **Modal backdrop scrims** (`bg-black/NN` on ~20 files: `ConfirmDialog`,
  `CommandPalette`, `SideDrawer`, most feature modals, admin pages) — a
  standard semi-transparent overlay pattern, not a themed surface.
- **`BottomWorkspaceTabs.jsx`** — confirmed dead code (not imported
  anywhere; superseded by `WorkspacePanel`'s own built-in tab bar). Left
  as-is rather than editing unused code.
- **`src/components/problem/workspace/SubmissionResultBanner.jsx`** — a
  second, unused duplicate of the live `src/components/workspace/`
  version. Flagged here for a future cleanup pass (not touched, since
  deleting/consolidating files wasn't in scope for this fix and it has
  zero runtime effect either way).

### Verification

- `eslint` on all touched files: clean
- `vitest run`: 64/64 test files, 400/400 tests passing
- `npm run build`: succeeds
- Diff scoped to exactly the files listed above — `package-lock.json`
  churn from running `npm install` locally was reverted before handoff,
  per Bunny's explicit "only Black & White Mode, nothing else touched"
  constraint.

### Not done / carried forward

- Deleting or consolidating the dead `problem/workspace/
  SubmissionResultBanner.jsx` duplicate — flagged, not actioned.
- No further systemic sweep beyond the two greps used here
  (`zinc-9/8|gray-9/8|slate-9/8|neutral-9/8|black` and `ink-`) — if a
  third hardcoded-color convention exists somewhere in the codebase
  under a different naming scheme, it wasn't caught by this pass.

## Phase 6 — Language Expansion, Plan 012 Batch 1: C starter-code backfill (this session)

C's registry entry, `languageTypes/c.js`, and `languageDrivers/c.js` were
already wired in from a prior session (`enabled: false`, `judge0Id: 50`
unverified) — this session's job was actual `starterCode.c` content, per
`plans/012-c-starter-backfill-scoping.md`. Scoping doc approved with
three explicit decisions: (Finding 2) do NOT extend the driver yet, only
backfill shapes it already supports; one batch per session; long-tail
problems get best-judgment signatures with reasoning documented, not
per-problem sign-off.

Audited the real catalog rather than trusting the scoping doc's
projected ~90-problem estimate: 80 problems actually matched the five
target shapes (`arr1d->int`, `arr1d,num->int`, `num->int`, `arr1d->bool`,
`str,str->bool`); **72 backfilled**, 8 correctly excluded (`ListNode*`/
`TreeNode*` params, `vector<string>&`/`vector<char>&` params, `uint32_t`
return/param) rather than forced. Every accepted problem's C signature
was cross-checked against its *actual* declared C++ signature, not
guessed from a testcase value's structural shape alone — this is what
caught `two-sum-count-pairs` needing `long long` (extended its existing
`returnType: { java, cpp }` to add `c: "long long"`) and kept the
`paramTypes.c` override count at zero rather than missing a case.

### New validation infrastructure

`validateProblemContracts.js` gained C-specific checks with no java/cpp
equivalent, because `languageDrivers/c.js`'s `generate()` has no generic
fallback for an unrecognized type — unlike Java/C++, it silently
mis-prints rather than erroring:

- `checkCReturnTypeSupported` — resolves the real return-type token off
  the function signature first (not the driver's own lossy
  infer-with-default-to-"int" fallback) and rejects anything outside
  `{int, long long, double, bool, int*, char*}`.
- `checkCArrayParamTypeSafety` — flags a numeric array param containing
  non-integer values with no explicit `paramTypes.c` override (`
  inferCType()` would silently type it `int[]` and truncate every value).
- `checkC` — declared-vs-actual return type mismatch, mirrors
  `checkJava`/`checkCpp`.
- `checkArgumentGeneration` extended with a C branch.

7 new unit tests added to `generateDriverCode.test.js` covering all of
the above, including the specific "unsupported return type resolved via
inference alone would have passed" regression this check exists to
prevent.

### Verification

- Backend `npx vitest run`: **103/103 files, 1171/1171 tests** (1145
  baseline + 26 new: 7 C validation unit tests, rest incidental to the
  catalog data change).
- `node backend/scripts/checkProblemsFolderDrift.js`: zero drift,
  72/250 problems now carry a `starter/c.c` file matching
  `src/data/problems.js`. (Caught and corrected an own operational
  mistake mid-session: `exportProblemsToFolders.js`/
  `checkProblemsFolderDrift.js` resolve `problems/` relative to
  `process.cwd()` and must be run from `backend/` — ran them from the
  repo root once, which silently created a stray top-level `problems/`
  instead of updating `backend/problems/`; caught via a 0-count sanity
  check, deleted, redone correctly.)
- `node backend/scripts/validateProblemContracts.js`: 250 problems + 8
  Code Club Edition missions, no contract mismatches.
- `npm run lint` (full repo): same single pre-existing
  `CollegeDetailDrawer.jsx` finding, zero new lint debt.
- `npm run build`: succeeds.
- Beyond static checks: compiled and executed 5 representative generated
  drivers (one per shape, real implementations, not just stubs) through
  actual `gcc`, including the `long long` overflow case — all 5 produced
  correct output against real testcase data.

### Real driver bug found, not fixed (out of Batch 1 scope)

`languageDrivers/c.js`'s `generate()` builds call-args as
`Array.isArray(value) ? \`${key}, ${key}Size\` : key`, but `cDeclaration()`
declares `${key}Rows`/`${key}Cols` (not `${key}Size`) for a 2D array —
any future 2D-array **input** shape would generate a call to an
undeclared variable. Relevant to whoever picks up Batch 3/5, not fixed
here per the explicit "do not extend the driver" instruction.

### What Batch 1 does NOT include (unchanged, deliberately)

- `enabled: false` still stands; `judge0Id: 50` still unverified.
- The 8 skipped Batch-1-shape problems, the ~93-problem long tail
  (Batch 3), the 17 `operationSequence`/design problems (Batch 4), and
  any 2D-array/string-array driver extension (possible Batch 5) — none
  started.
- `plans/011-language-and-problem-extensibility.md` reconstruction —
  still missing from the repo, still not this session's task.

Batch 2 not started; waiting on explicit approval per the scoping doc's
one-batch-per-session agreement.

## Phase 6 — Language Expansion, Plan 012 Batch 2: C starter-code backfill, cont'd (this session)

Second of the one-batch-per-session sequence from
`plans/012-c-starter-backfill-scoping.md`. Target: the remaining
templatable shapes from the top-10 table not yet covered by Batch 1 —
`arr1d->arr1d`, `arr1d,num->arr1d`, `str->int`.

**Scope correction made before starting, not after:** re-checked
`languageDrivers/c.js` against `languageTypes/c.js` before generating
anything and confirmed the 2D-array-input bug flagged (but not fixed) in
Batch 1's report is more severe than first described — `generate()`'s
call-arg builder appends `${key}Size` for *any* array regardless of
dimension, but `cDeclaration()` names a 2D array's companions
`${key}Rows`/`${key}Cols`. This blocks **any** shape with a 2D array
input, not just 2D-array output. Excluded `arr2d->int` (15 candidates)
and `arr2d->arr2d` (11) from this batch entirely — consistent with the
already-approved "don't extend the driver" decision, just applied to a
wider set than the scoping doc's table implied. Flagged to Bunny before
implementing, not after.

### Real numbers

| Shape | Candidates | Backfilled | Skipped | Reason |
|---|---:|---:|---:|---|
| `arr1d -> arr1d` | 17 | 11 | 6 | 3× `void` return (the known `rotate-array`/`sort-colors`/`next-permutation` in-place-mutation bug — independently rediscovered by this batch's own analysis, not just carried over from memory), 2× `string` return, 1× `TreeNode*` param |
| `arr1d, num -> arr1d` | 8 | 5 | 3 | 1× `void` return, 1× `ListNode*` return, 1× `vector<string>` return |
| `str -> int` | 10 | 10 | 0 | — |
| **Total** | **35** | **26** | **9** | |

Every accepted array-return problem uses the one shape
`languageDrivers/c.js` actually supports: `int*` return + trailing
`int* returnSize` out-param, `*returnSize = 0; return NULL;` as the
unimplemented-stub body (same "return empty" convention the cpp stub
already uses for these problems). No `paramTypes.c` overrides were
needed this batch (no double arrays or ambiguous scalars turned up among
the 26, same cross-check-against-real-cpp-signature method as Batch 1).

Cumulative C coverage after Batch 2: **98/250** (72 + 26).

### Verification

- Backend `npx vitest run`: **103/103 files, 1173/1173 tests** (1171
  baseline + 2 new: one `arr1d->arr1d` regression case, one `str->int`
  case — kept minimal since the underlying `int*`-return and `char*`-
  param validation paths were already exercised by Batch 1's tests).
- `node backend/scripts/checkProblemsFolderDrift.js`: zero drift,
  98/250 problems now carry `starter/c.c` (run correctly from `backend/`
  this time, no repeat of Batch 1's cwd mistake).
- `node backend/scripts/validateProblemContracts.js`: 250 problems + 8
  Code Club Edition missions, no contract mismatches.
- Compiled and executed 3 representative generated drivers via `gcc`
  (real `malloc`-based array-return implementations for `two-sum` and
  `move-zeroes`, a real DP implementation for `decode-ways`) — all 3
  produced correct output.

### What Batch 2 does NOT include (unchanged, deliberately)

- `arr2d->int` / `arr2d->arr2d` (26 combined candidates) — blocked by
  the 2D-array-input driver bug above, not attempted.
- The known `rotate-array`/`sort-colors`/`next-permutation` void-return
  bug — still just documented, not fixed (pre-existing, Java/C++-wide,
  out of C-onboarding scope).
- The ~93-problem long tail (Batch 3), the 17 `operationSequence`
  problems (Batch 4), any driver extension (possible Batch 5), Plan 011
  reconstruction — none started.

Batch 3 not started; waiting on explicit approval.

## Phase 6 — Language Expansion, Plan 012 Batch 3: C starter-code backfill, long tail (this session)

Third batch of the one-batch-per-session sequence. Scope: the
~93-problem long tail flagged in the original scoping doc — not
template-able by the coarse JS-testcase-value shape buckets Batches 1–2
used, so this batch classified every remaining non-design,
not-yet-backfilled problem (135 candidates) directly against its real
cpp signature and the C driver's actual capability, per-problem, per the
approved long-tail strategy ("best engineering judgment... document
reasoning for non-obvious signatures... flag rather than guess").

**Two capabilities used for the first time this batch**, both already
present in `languageDrivers/c.js`/`languageTypes/c.js` but unexercised
by Batches 1–2's shapes: `char*` return (string output — `generate()`
has a dedicated branch, no `returnSize` needed) and `char**` parameters
(array-of-strings input — `cDeclaration()` already handles a 1D array
whose elements are strings via its existing `char*[]` branch; confirmed
`generate()`'s call-arg builder appends `${key}Size` correctly for it
since it's structurally 1D, not the 2D `Rows`/`Cols` case). Neither
required any driver change — just recognizing the catalog had type
shapes worth mapping to them that the first two batches' input/output
buckets didn't surface.

### Real numbers

135 candidates (non-design, not yet backfilled) → **53 accepted**, 82
skipped. Skip reasons, grouped:

| Reason | Count |
|---|---:|
| 2D return (`vector<vector<int>>` / `vector<vector<string>>`) | 18 |
| `void` return (in-place mutation — same known bug class as `rotate-array`) | 9 |
| Array param is genuinely 2D in the actual testcase data | 32* |
| `ListNode*`/`TreeNode*`/`Node*` params or returns | 8 |
| `vector<string>` **return** (array-of-string return has no driver branch — `char**` param is fine, `char**` return is not) | 4 |
| `vector<char>&` param (`task-scheduler` — not in the supported-type map) | 1 |
| `uint32_t` param/return | 2 |
| Param-count / signature-parse mismatches | 3 |
| Empty/unparseable return type | 2 |

\* Includes the 26 already known-excluded from Batch 2's `arr2d->*`
shapes — Batch 3's classifier re-derives them independently by checking
actual testcase data shape against the cpp signature (not by name),
which is why this number doesn't simply equal "82 minus Batch 1/2's
carried-forward exclusions."

One data-quality note surfaced, not fixed (not this batch's job):
`binary-search-tree-iterator` has real constructor+method+testcase
structure (`ops`/`vals` arrays) identical in shape to the 17
`operationSequence`-tagged design problems, but is **not** itself
flagged `operationSequence.enabled: true` — it was correctly excluded
here (no single free-function signature to derive a C prototype from),
but whoever owns the design-problem tagging should know it's
mis-classified.

Cumulative C coverage after Batch 3: **151/250** (72 + 26 + 53).

### Verification

- Backend `npx vitest run`: **103/103 files, 1175/1175 tests** (1173
  baseline + 2 new: one `char*`-return case, one `char**`-param case).
- `node backend/scripts/checkProblemsFolderDrift.js`: zero drift,
  151/250 problems now carry `starter/c.c`.
- `node backend/scripts/validateProblemContracts.js`: 250 problems + 8
  Code Club Edition missions, no contract mismatches.
- Compiled and executed 3 representative generated drivers via `gcc`
  with real implementations (not stubs): `reverse-string` (`char*`
  return), `longest-common-prefix` (`char**` param + `char*` return),
  `word-break` (`char*` + `char**` params, `bool` return) — all 3
  produced correct output.

### What Batch 3 does NOT include (unchanged, deliberately)

- 2D-array shapes (input or output) — still blocked by the
  `${key}Size`-vs-`${key}Rows`/`${key}Cols` driver bug flagged in
  Batch 2's report, unfixed.
- `vector<string>` **return** (array-of-string return) — no driver
  branch exists; `char**` as a param is now supported, as a return type
  is not.
- `ListNode*`/`TreeNode*` problems — need real C struct definitions,
  driver-level work.
- The known `void`-return in-place-mutation bug (9 more instances of the
  same class already documented for `rotate-array`/`sort-colors`/
  `next-permutation`) — still just documented.
- The 17 `operationSequence`/design problems (Batch 4) — still not
  started, including the mis-tagged `binary-search-tree-iterator` noted
  above.
- Any driver extension (possible Batch 5), Plan 011 reconstruction —
  still not started.

After three batches, **99/250 problems remain without `starterCode.c`**:
17 design problems (Batch 4) + 82 driver-blocked or otherwise-excluded
(2D shapes, `void`-return bug, pointer-struct params, array-of-string
return — real remaining work, not oversights).

# 011 — Language & problem extensibility hardening

**Reconstructed, not original.** This file did not exist in the repo
checkout at the start of Plan 012 (C language onboarding), despite being
cited by name in comments across a dozen files since before Plan 012
began — the same missing-plan-doc pattern already known from 004/005.
Assembled from those citations (`grep -rn "Plan 011" backend/`) plus
reading the actual committed code each one describes, not from memory of
a session that wrote the original. Batch boundaries, motivations, and
before/after descriptions below are reconstructed to match what the code
demonstrably does today; anything from the original planning discussion
that ISN'T visible in the committed code (why particular batch
boundaries were chosen over others, alternatives considered, etc.) is
simply absent here rather than guessed at.

## Motivation

Referenced directly in `languageDrivers/index.js`'s header: TypeScript's
rollout (Phase 6 Batch 1, `plans/010-language-expansion-scoping.md`)
shipped with green tests, clean lint, and a passed review — while
missing `operationSequenceDriver.js`'s branch entirely. Undetected until
someone happened to run `backend/scripts/validateProblemContracts.js` by
hand. The root cause: `generateDriverCode.js` and
`operationSequenceDriver.js` each had their own independent
`if (language === "...")` dispatch chain, with nothing enforcing a
language registered in one also existed in the other. A new language
could ship "half-wired" — passing every check that happened to exercise
the chain someone remembered to update, silently failing the other.

Separately, `docs/adding-a-language.md`'s own step 3 flagged that
`starterCode`/`returnType`/`paramTypes` being three separate Mongoose
sub-documents with one fixed named field per language meant every new
language was a schema migration touching `Problem.js` in three places
plus `problemSchema.js` in two more — recommended to change "before a
6th/7th language."

Plan 011 is the fix for both, done in three batches.

## Batch 1 — Registry-validated Mongoose Maps

**Files:** `backend/models/Problem.js`, `backend/schemas/problemSchema.js`

`starterCode`/`returnType`/`paramTypes` changed from fixed-field
sub-schemas to Mongoose `Map` types, with keys validated against
`backend/config/languages.js`'s `LANGUAGES` registry (the same registry
everything else in the execution pipeline already derived from) instead
of a hardcoded field list. A new language now needs zero schema edits —
only a registry entry, plus content.

Confirmed (per `Problem.js`'s own comment) that Mongoose transparently
coerces a legacy plain-object document (`{ python: "...", javascript:
"...", ... }` — the shape every existing document already had) into a
real `Map` on load, with no data migration required, and that
`.toJSON()`/`.toObject()` serialize back to a plain object, so existing
API consumers needed zero changes. The one real behavior change: reading
these fields off a live (non-lean, non-JSON) Mongoose document requires
`.get(key)` instead of bracket/dot access, since a `Map` instance
doesn't expose arbitrary keys as properties — `judgeController.js`'s two
call sites were updated alongside this change.

Validated against `SUPPORTED_LANGUAGE_KEYS`, not `ENABLED_LANGUAGE_KEYS`
— a disabled language's already-authored starter code/contract stays
valid, since disabling a language is a runtime gate on new Run/Submit
requests, not a retroactive judgment on existing content.

## Batch 2 — Registry-driven folder-file generation

**Files:** `backend/scripts/lib/problemFolderFiles.js`,
`backend/scripts/importProblems.js`,
`backend/scripts/exportProblemsToFolders.js`,
`backend/scripts/checkProblemsFolderDrift.js`

The `backend/problems/<slug>/starter/<lang>.<ext>` file set used to be
five hand-written lines per direction (`"starter/python.py":
starters.python`, etc. on the write side in
`problemFolderFiles.js`/`exportProblemsToFolders.js`; a mirror-image
manual read list in `importProblems.js`), in files that didn't import
`config/languages.js` at all. Adding a language meant a hand-edit in
both places, with nothing enforcing they stayed in sync — the same bug
class Batch 3 (below) fixes for driver dispatch, just on the
folder-mirror side.

Both directions now derive the same `starter/<key>.<extension>` path
from the same `LANGUAGES` registry, so a new language's folder
convention costs zero edits to either file. Confirmed to produce
byte-identical output to the original inline version for every existing
language before this was considered done.

## Batch 3 — Per-language driver modules + load-time contract enforcement

**Files:** `backend/utils/languageDrivers/{python,javascript,typescript,
java,cpp,c,index}.js`, `backend/utils/generateDriverCode.js`,
`backend/utils/operationSequenceDriver.js`

The actual fix for the TypeScript incident. Every language's driver
template body (both the single-call `generate()` path and the
constructor-plus-method-sequence `generateOperationSequence()` path)
moved into its own `languageDrivers/<lang>.js` module — mechanical
extraction for the five pre-existing languages, moved verbatim with no
logic changes (verified by the existing test suites passing unmodified
against the extracted files).

`languageDrivers/index.js` replaces the two independent dispatch chains
with a lookup into this per-language module registry — and, critically,
the loop that builds that lookup **fails at module load** (server boot,
CI, the first import) if any language registered in
`config/languages.js` is missing a driver module, or that module is
missing either required function (`generate` and
`generateOperationSequence`). Not a later "did you remember to update
the other file too" step that's easy to skip — a language cannot ship
half-wired, structurally.

## What Plan 011 delivered, concretely

A new language's onboarding cost, before vs. after all three batches:

| | Before Plan 011 | After |
|---|---|---|
| Schema (`Problem.js`, `problemSchema.js`) | 3 fixed-field edits × 2 files | 0 — registry-derived |
| Folder mirror (import/export/drift-check) | Hand-written line in 2+ files, no sync enforcement | 0 — registry-derived |
| Driver dispatch (`generate`, `generateOperationSequence`) | 2 independent `if` chains, no sync enforcement | 1 registry entry; missing either function fails at load, not silently |

**C (Plan 012) is the first language onboarded entirely under this
design** — its registry entry, `languageTypes/c.js`, and
`languageDrivers/c.js` were added with zero edits to any of the files
Batches 1–3 touched. Everything Plan 012 built on top (the return-type
whitelist, the 2D-array row-pointer convention, the void-mutation fix
applied to Java/C++ too) is new *content* and new *driver capability*
within this architecture, not a change to the architecture itself — the
clearest evidence Plan 011's actual goal (a 6th language costing
"registry entry + content," not a multi-file schema migration) was met.

## Known gaps this plan did not cover (found later, not itself a Plan 011 failure)

- `resultMode` ("all" vs "returningOnly") was threaded through
  `generateOperationSequenceDriver`'s signature but silently unused by
  `languageDrivers/c.js` until Plan 012 Batch 5 — the parameter existed,
  the consuming code just didn't read it. Same class of "exists in one
  place, not consulted in the other" bug Batch 3 was built to prevent,
  just one level deeper (a function's own parameter list, not a
  cross-file dispatch table) — the load-time contract check has no way
  to catch an unused destructured parameter.
- `returnType`/`paramTypes` being freeform `z.string()` (no enum of
  known-valid type tokens per language) means a typo or an
  unsupported-but-plausible-looking type string isn't caught by the
  schema at all — `validateProblemContracts.js`'s
  `checkCReturnTypeSupported` (Plan 012) is the closest thing to a fix,
  and it's C-specific, not a registry-level guarantee.

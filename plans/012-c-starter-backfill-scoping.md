# 012 — C language: starter-code backfill scoping

Plan numbering: highest plan number cited anywhere in the codebase
(comments) is 011 (`languageDrivers/index.js`, `Problem.js`'s Map-field
comments), even though only `plans/010-*.md` exists on disk — same
missing-file pattern this project has hit before at 004/005. This doc
takes 012 to avoid colliding with the already-cited-but-undocumented 011.
**`plans/011-language-and-problem-extensibility.md` should be
reconstructed separately** — not done here, flagged so it isn't lost a
second time.

## Where this picks up

`backend/config/languages.js` already has a `c` entry (`enabled: false`,
`judge0Id: 50`, unverified), and `backend/utils/languageDrivers/c.js` +
`backend/utils/languageTypes/c.js` are already written and pass
`languageDrivers/index.js`'s load-time contract check. Because
`starterCode`/`returnType`/`paramTypes` are now registry-validated Maps
(Plan 011), **zero schema or pipeline files need to change** to onboard
C — `importProblems.js`, `problemFolderFiles.js`,
`problemSchema.js` all derive the language list from the registry
already. The only remaining work is **content**: writing
`starterCode.c` for all 250 problems, plus `returnType.c`/`paramTypes.c`
where the driver's inference can't cover it.

This is the same fork in the road Batch 1 hit and chose TypeScript
over (see `plans/010-language-expansion-scoping.md`): C is not a
mechanical byte-copy of any existing language, because every existing
Java/C++ starter is a `class Solution` OOP wrapper and C has no classes.
This doc scopes what a real backfill costs and where it should be split
into batches, rather than treating it as one script run.

## Finding 1 — signature-shape distribution (audited against the real catalog)

Classified all 250 problems by (input-value-shapes → output-shape),
inferred from each problem's first testcase (`analyze_tmp.mjs`, run and
discarded — not committed, trivially reproducible from `problems.js`):

- **17 problems** are `operationSequence`-enabled (design/constructor
  problems — LRU Cache, Trie, etc.) and excluded from the shape buckets
  below; see Finding 3.
- Of the remaining **233**, the top 10 shapes cover **~140 problems
  (60%)**:

  | Shape | Count |
  |---|---|
  | `arr1d -> int` | 42 |
  | `arr1d -> arr1d` | 17 |
  | `arr1d, num -> int` | 16 |
  | `arr2d -> int` | 15 |
  | `arr2d -> arr2d` | 11 |
  | `str -> int` | 10 |
  | `num -> int` | 10 |
  | `arr1d, num -> arr1d` | 8 |
  | `arr1d -> bool` | 6 |
  | `str, str -> bool` | 6 |

- The remaining **~93 problems** are spread across **52 distinct
  shapes**, most appearing only once or twice — genuinely one-off
  signatures, not template-able.

**Implication:** a small library of C signature templates (one per
common shape: scalar-in/scalar-out, array-in/scalar-out,
array-in/array-out, two-array-in, string-in/bool-out, etc.) can
mechanically cover roughly 60% of the catalog once someone commits to
the template per shape. The long tail still needs individual
consideration, same as Java/C++ always have.

## Finding 2 — the current C driver does not support every shape above (blocking, must scope around)

`languageDrivers/c.js`'s `generate()` only implements array-*return* for
one shape: `int*` + trailing `int* returnSize`. Checking against the
shape table above, this means, **as the driver stands today**:

- `arr2d -> arr2d` (11 problems), `arr1d -> arr2d` (4), and any
  string-array or 2D-array return shape are **not supported** — no
  `char**`/2D branch exists in `generate()`.
- A `returnType.c` value outside the driver's whitelist
  (`int`, `long long`, `double`, `bool`, `int*`, `char*`) silently falls
  through to the default scalar-print block rather than erroring loudly
  — i.e. authoring starter code for an unsupported shape today would
  **generate a program that compiles but prints the wrong thing**, not a
  clean failure. This is the same class of risk
  `validateProblemContracts.js` exists to catch for Java/C++, and it
  does not check C at all yet (see Batch plan below).

**This needs a decision from you before backfill starts on those
shapes**, not a silent workaround:
- (a) extend `languageDrivers/c.js` to support 2D/string-array returns
  first (real driver work, same complexity class as the original C
  driver itself), or
- (b) scope C's first release to the ~60% of problems whose shapes the
  driver already supports, and flag the rest `starterCode.c` absent
  (tolerated — the schema treats it as optional, same posture
  `random-pick-with-weight` already has for a different reason), or
- (c) something else.

Recommendation, doesn't preempt your call: (b) first, matching Batch 1's
own precedent of shipping a real subset rather than blocking on 100%
coverage (TypeScript shipped before Java-parity error handling was
fully resolved, per its own doc). (a) can be a follow-up batch once (b)
proves the pipeline end-to-end.

## Finding 3 — the 17 design/operationSequence problems

`generateOperationSequence()` already exists in the C driver but is
scoped to scalar (long-representable) results only — no string/array
method results, no void-detection (`resultMode` is a no-op for C). All
17 of the excluded problems need checking individually against that
constraint before any C starter is written for them; likely a mix of
in-scope (e.g. counter/stack-style classes returning ints/bools) and
out-of-scope (anything returning a string or list). Proposed: separate,
later batch — same reasoning as Finding 2's (b).

## Finding 4 — `returnType.c`/`paramTypes.c` contract coverage

Only **1 of 250** problems declares an explicit `returnType` today
(`{ java: "long", cpp: "long long" }`, for overflow). C's driver prefers
a declared `returnType.c`/`paramTypes.c` over its own regex/structural
inference the same way Java/C++ do, and needs it for anything outside
its narrow inferrable whitelist — most notably: any problem whose
correct return type is `long long` for overflow (the ~1 problem above,
plus likely a few more never audited for C's narrower `int` overflow
boundary vs. Java/C++'s), and any array-of-string or 2D-array param
(`paramTypes.c` needed for `cDeclaration()` to pick the right element
type rather than guessing from the testcase value's structural shape).
This audit (which problems need explicit contracts) hasn't been done
yet — proposed as part of Batch 1 below, not deferred, since getting it
wrong produces the same "compiles but prints garbage" risk as Finding 2.

## Proposed batches (pending your approval, per usual)

1. **Batch 1 — infrastructure + first shape templates.** Extend
   `validateProblemContracts.js` to check C (mirrors its existing
   java/cpp checks); build the template library for the top ~5 shapes
   (`arr1d->int`, `arr1d,num->int`, `num->int`, `arr1d->bool`,
   `str,str->bool` — covers ~90 problems); backfill those; run
   `validateProblemContracts.js` + `checkProblemsFolderDrift.js`; report
   real numbers, not projected ones.
2. **Batch 2 — remaining templatable shapes** (`arr1d->arr1d`,
   `arr1d,num->arr1d`, `arr2d->int`, `str->int`, etc. — the rest of the
   top-10 table).
3. **Batch 3 — the ~93-problem long tail**, one at a time or in small
   topic-grouped batches, each needing individual signature review (not
   template-driven).
4. **Batch 4 — design/operationSequence problems** (Finding 3), scoped
   to the ones actually within the scalar-only constraint.
5. **Batch 5 (only if you choose Finding 2's option (a))** — extend the
   driver for 2D/string-array returns, then backfill those shapes.
6. **Final step, all batches:** run
   `node backend/scripts/verifyLanguageRegistry.js` against the real
   Judge0 instance to confirm `judge0Id: 50` (currently unverified, same
   "well-known public ID, not confirmed" caveat TypeScript's `74` had
   before Batch 1), then flip `enabled: true`. `requiredForNewProblems`
   stays `false` even after this — same posture TypeScript has (not a
   hard requirement for admin-authored new problems going forward).

## Open decisions needed from you

- Finding 2: (a), (b), or (c) for unsupported return shapes?
- Batch size/pace: one batch per session (your usual cadence), or do
  you want Batches 1–2 combined given they're both mechanical
  template application?
- Should the ~93-problem long tail (Batch 3) be reviewed by you
  problem-by-problem, or do you want best-judgment signatures with the
  reasoning documented per problem (same "make a professional judgment,
  document it" delegation pattern as elsewhere)?

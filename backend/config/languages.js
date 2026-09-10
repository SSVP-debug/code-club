/**
 * Single source of truth for language identity across Code Club's backend
 * — Judge0 IDs, internal language strings, file extensions, and which
 * languages are currently enabled for new Run/Submit requests.
 *
 * Content & Execution Architecture, Phase 2. This module supersedes the
 * original "Judge0 Integration Hardening" registry documented below by
 * folding in ENABLED state (previously implicit — every language was
 * always on) and consolidating what used to be several independent
 * hand-maintained lists into one:
 *   - compilerController.js's JUDGE0_LANGUAGE_NAMES / LANGUAGE_STRINGS
 *     (already derived from this file before this phase — unchanged)
 *   - judgeController.js's own separate `languageIdMap` literal (now
 *     replaced with LANGUAGE_KEY_TO_ID from here — see that file)
 *   - routes/judge.js's two hand-written `z.enum([...])` literals (now
 *     ENABLED_LANGUAGE_KEYS)
 *   - routes/compiler.js's SUPPORTED_LANGUAGE_IDS check (now additionally
 *     gates on ENABLED_LANGUAGE_IDS)
 *   - the frontend's hardcoded <select> in ProblemEditor.jsx (now fetches
 *     GET /api/languages, backed by getEnabledLanguagesForApi() below)
 *
 * ── IMPORTANT: "supported" vs. "enabled" are not the same thing ──────────
 * A language appearing in LANGUAGES below means Code Club has real
 * implementation for it — generateDriverCode.js / languageTypes/*.js know
 * how to build a driver for it, and it has a Judge0 ID. That is what
 * "supported" means throughout this codebase, and it is NOT something a
 * config flag can create by itself: making a genuinely new language work
 * still requires writing that driver-generation code (see the module
 * comment at the top of ../utils/generateDriverCode.js).
 *
 * `enabled` is the separate, narrower thing this phase adds: a runtime-ish
 * (config-deploy-level, not database-level — see the audit's §F for why)
 * on/off switch for an *already-supported* language. Flipping it to
 * `false` immediately removes that language from GET /api/languages and
 * causes new Run/Submit requests using it to be rejected — see
 * ENABLED_LANGUAGE_KEYS / ENABLED_LANGUAGE_IDS below and their call sites
 * in routes/judge.js and routes/compiler.js. It does NOT remove the
 * language's driver-generation code, and it does NOT touch historical
 * Submission documents already stored with that language (see
 * models/Submission.js's own comment on why its enum is intentionally
 * NOT filtered to only-enabled languages).
 *
 * ── Original "Judge0 Integration Hardening" context (kept for history) ───
 * `routes/compiler.js` previously validated `language_id` as any positive
 * integer, so an authenticated client could submit a Judge0 language Code
 * Club never intended to expose (e.g. 46 for Bash) and have it forwarded
 * to Judge0 as-is. `compilerController.js` and `judgeController.js` each
 * separately hardcoded the same 4 IDs in their own local maps, so there
 * was no one place to update if the supported set ever changed. This
 * module was created to be that one place, and Phase 2 above finished the
 * job by removing the one map (`judgeController.js`'s `languageIdMap`)
 * that a prior, narrower-scoped task had deliberately left untouched.
 *
 * ── Adding a genuinely new language (e.g. Rust) — where everything lives ─
 *   1. Register it below in LANGUAGES (its Judge0 ID, display name, file
 *      extension). Start it with `enabled: false` until steps 2-3 are done.
 *   2. Implement driver generation for it in ../utils/generateDriverCode.js
 *      (and ../utils/languageTypes/ if it needs its own type-declaration
 *      logic the way java/cpp do).
 *   3. Implement Problem.starterCode support for it — see
 *      models/Problem.js's `starterCode` sub-schema; it's currently 4
 *      fixed named fields, not a map, so adding a language there is a
 *      small schema change, not a config change (see the audit's §F).
 *   4. Flip `enabled: true` here. It now appears in GET /api/languages
 *      and becomes usable for new Run/Submit requests — no other file in
 *      the backend needs to change for that last step.
 * Steps 1-3 are genuine implementation work no registry can eliminate;
 * step 4 is the "flip a switch" step this phase was actually asked for.
 */

// ── The registry ────────────────────────────────────────────────────────
// Order here is preserved by every derived list/message below (e.g. the
// "language must be: python, javascript, java, or cpp" validation
// message) — insertion order in a plain object is preserved by
// Object.keys/values/entries in modern JS, so reordering these entries
// reorders that message too. Kept in the same order as the four languages
// have always been listed throughout the codebase.
export const LANGUAGES = {
  python: {
    name: "Python",
    judge0Id: 71,
    extension: "py",
    // Content & Execution Architecture cross-check follow-up (Phase 6):
    // this exists specifically to replace a hardcoded
    // `language === "javascript" ? 2 : 4` conditional found in
    // src/components/problem/ProblemEditor.jsx — TypeScript conventionally
    // indents like JavaScript (2), not like Java/C++ (4), and that
    // conditional had no way to express that without becoming a growing
    // per-language if/else chain in a frontend file no language addition
    // should need to touch. This is exactly the `configuration` field the
    // original Content & Execution Architecture spec's `Language` shape
    // proposed — added narrowly (just this one property) rather than a
    // generic catch-all bag, per that same spec's explicit
    // "do not blindly implement this schema" / avoid-over-engineering
    // instruction.
    editorIndentSize: 4,
    enabled: true,
    // Plan 011: every problem's starterCode map must include this key.
    // See REQUIRED_STARTER_LANGUAGE_KEYS below.
    requiredForNewProblems: true,
  },
  javascript: {
    name: "JavaScript",
    judge0Id: 63,
    extension: "js",
    editorIndentSize: 2,
    enabled: true,
    requiredForNewProblems: true,
  },
  java: {
    name: "Java",
    judge0Id: 62,
    extension: "java",
    editorIndentSize: 4,
    enabled: true,
    requiredForNewProblems: true,
    // Plan 011: statically-typed languages need Problem.returnType/
    // paramTypes contract support. See STATICALLY_TYPED_LANGUAGE_KEYS
    // below and generateDriverCode.js's use of the declared contract over
    // regex-inference.
    requiresTypeDeclaration: true,
  },
  cpp: {
    name: "C++",
    judge0Id: 54,
    extension: "cpp",
    editorIndentSize: 4,
    enabled: true,
    requiredForNewProblems: true,
    requiresTypeDeclaration: true,
  },
  // C — added structurally (registry entry + driver module) but starts
  // disabled and NOT required for new problems, same posture TypeScript
  // started with, for a stronger reason: TypeScript was a near-zero-risk
  // reuse of JavaScript's driver; C is NOT a near-zero-risk reuse of
  // anything already registered. It has no classes, no `string`, no
  // `vector<T>`, and arrays don't carry their own length — see
  // backend/utils/languageTypes/c.js and backend/utils/languageDrivers/c.js
  // for the conventions this required (an auto-generated `<key>Size`
  // companion variable per array argument; a single supported
  // array-return shape; operation-sequence/design-problem support
  // restricted to scalar (long-representable) return values only, since C
  // has no reflection or template mechanism to generically detect a void
  // return the way Java/C++ do). Read both files' header comments before
  // writing the first real C starter code or backfill script — this is
  // NOT a drop-in the way TypeScript was.
  c: {
    name: "C",
    // Judge0 CE's well-known id for "C (GCC 9.2.0)" on the public
    // ce.judge0.com instance (same instance TypeScript's judge0Id: 74 was
    // confirmed against above) — NOT yet independently confirmed for this
    // entry. Run scripts/verifyLanguageRegistry.js before flipping
    // `enabled: true`.
    judge0Id: 50,
    extension: "c",
    editorIndentSize: 4,
    enabled: true,
    // Deliberately omitted (falsy) — see this entry's header comment.
    // requiredForNewProblems: false,
    requiresTypeDeclaration: true,
  },
  // Phase 6 (Language Expansion) — see plans/010-language-expansion-scoping.md
  // for why TypeScript went first (structural superset of JS → driver-gen
  // reuses formatJsArg/the JS call-and-print pattern almost entirely, and
  // the 250-problem starter-code backfill is mechanical rather than
  // hand-authored — see scripts/backfillTypescriptStarter.js). Starts
  // disabled until that backfill + a real run against this deployment's
  // Judge0 instance both happen — see the note on judge0Id below.
  typescript: {
    name: "TypeScript",
    // Judge0 CE's well-known id for "TypeScript (3.7.4)". Confirmed
    // against this deployment's real Judge0 instance (public
    // ce.judge0.com, not self-hosted — per JUDGE0_API_URL) via
    // scripts/verifyLanguageRegistry.js on 2026-09-03: reports
    // "TypeScript (3.7.4)" at id 74, matching this entry exactly.
    judge0Id: 74,
    extension: "ts",
    editorIndentSize: 2,
    enabled: true,
    // Deliberately omitted (falsy): TypeScript is dynamically typed for
    // this purpose (reuses JavaScript's untyped call-and-print driver
    // shape — see generateDriverCode.js) and its starter-code backfill,
    // while complete, isn't a hard requirement the way the original four
    // are. See REQUIRED_STARTER_LANGUAGE_KEYS / STATICALLY_TYPED_LANGUAGE_KEYS
    // below.
    // requiredForNewProblems: false,
    // requiresTypeDeclaration: false,
  },
};

// ── Derived exports — ALL registered languages (supported, regardless of
// enabled state) ──────────────────────────────────────────────────────────

// Judge0 language ID → display name. Same shape/name as before this phase
// (compilerController.js's JUDGE0_LANGUAGE_NAMES aliases this) —
// deliberately includes every registered language, not just enabled ones,
// since this is used for display/logging of results for submissions that
// may have been made while a language was still enabled.
export const SUPPORTED_LANGUAGES = Object.fromEntries(
  Object.values(LANGUAGES).map((lang) => [lang.judge0Id, lang.name])
);

// Judge0 language ID → internal language string (used by
// generateDriverCode/generateOperationSequenceDriver to pick the right
// code-generation path).
export const LANGUAGE_ID_TO_STRING = Object.fromEntries(
  Object.entries(LANGUAGES).map(([key, lang]) => [lang.judge0Id, key])
);

// Internal language string → Judge0 language ID. Replaces
// judgeController.js's own previously-separate `languageIdMap` literal —
// same values, single source now.
export const LANGUAGE_KEY_TO_ID = Object.fromEntries(
  Object.entries(LANGUAGES).map(([key, lang]) => [key, lang.judge0Id])
);

// The full allow-list of registered Judge0 IDs — unrelated to `enabled`.
// Used where "is this a Judge0 ID Code Club has ever heard of" is the
// actual question (e.g. interpreting/labeling a historical result), as
// opposed to "can a NEW request use this" (see ENABLED_LANGUAGE_IDS).
export const SUPPORTED_LANGUAGE_IDS = Object.values(LANGUAGES).map((lang) => lang.judge0Id);

export function isSupportedLanguageId(languageId) {
  return SUPPORTED_LANGUAGE_IDS.includes(languageId);
}

// All registered internal language keys, regardless of enabled state.
// Used by models/Submission.js's `language` enum specifically BECAUSE it
// must stay valid for historical documents even if a language is later
// disabled — see that file's own comment.
export const SUPPORTED_LANGUAGE_KEYS = Object.keys(LANGUAGES);

// ── Derived exports — ENABLED languages only (Phase 2) ───────────────────
// These are the ones that gate new Run/Submit requests and populate
// GET /api/languages. A disabled language stays in every export above
// (it's still "supported"/registered) but disappears from all of these.

export const ENABLED_LANGUAGE_KEYS = Object.entries(LANGUAGES)
  .filter(([, lang]) => lang.enabled)
  .map(([key]) => key);

export const ENABLED_LANGUAGE_IDS = Object.values(LANGUAGES)
  .filter((lang) => lang.enabled)
  .map((lang) => lang.judge0Id);

export function isEnabledLanguageKey(languageKey) {
  return Boolean(LANGUAGES[languageKey]?.enabled);
}

export function isEnabledLanguageId(languageId) {
  return ENABLED_LANGUAGE_IDS.includes(languageId);
}

// Shape consumed by GET /api/languages (see controllers/languageController.js)
// and, on the frontend, by useLanguages.js / ProblemEditor.jsx's language
// selector — a plain list an admin toggling `enabled` above (and
// redeploying) will see reflected here with no other change required.
export function getEnabledLanguagesForApi() {
  return Object.entries(LANGUAGES)
    .filter(([, lang]) => lang.enabled)
    .map(([key, lang]) => ({
      id: key,
      name: lang.name,
      extension: lang.extension,
      editorIndentSize: lang.editorIndentSize,
    }));
}

// Oxford-comma-joined list of currently enabled language keys, e.g.
// "python, javascript, java, or cpp" — used to build a human-readable
// Zod validation message in routes/judge.js without hand-maintaining that
// sentence as a separate literal (previously it was one, and had already
// drifted out of sync with the actual allow-list once before).
export function formatEnabledLanguageKeysMessage() {
  const keys = ENABLED_LANGUAGE_KEYS;
  if (keys.length === 0) return "no languages are currently enabled";
  if (keys.length === 1) return keys[0];
  if (keys.length === 2) return `${keys[0]} or ${keys[1]}`;
  return `${keys.slice(0, -1).join(", ")}, or ${keys[keys.length - 1]}`;
}

export function isSupportedLanguageKey(languageKey) {
  return SUPPORTED_LANGUAGE_KEYS.includes(languageKey);
}

// ── Registry-driven contract scoping (plan 011) ──────────────────────────
// Two derived lists replacing what used to be hand-maintained `[java,
// cpp]` literals duplicated across Problem.js's returnTypeSchema/
// paramTypesSchema and problemSchema.js's ReturnTypeSchema/ParamTypesSchema
// — every one of those four had to be edited, separately, the day a third
// statically-typed language showed up. Source of truth is now the
// `requiresTypeDeclaration` flag on each LANGUAGES entry (same pattern as
// `editorIndentSize`: a real per-language registry field, not a growing
// conditional). Python/JavaScript/TypeScript don't declare it (defaults to
// falsy) since dynamically-typed languages have never needed a returnType/
// paramTypes contract — generateDriverCode.js's regex-inference fallback
// (or, for TS, just reusing JS's own untyped call-and-print shape) covers
// them.
export const STATICALLY_TYPED_LANGUAGE_KEYS = Object.entries(LANGUAGES)
  .filter(([, lang]) => lang.requiresTypeDeclaration)
  .map(([key]) => key);

export function requiresTypeDeclaration(languageKey) {
  return STATICALLY_TYPED_LANGUAGE_KEYS.includes(languageKey);
}

// Which languages a problem's starterCode map MUST include an entry for.
// Source of truth is each LANGUAGES entry's `requiredForNewProblems` flag —
// replacing the hand-maintained 4-language literal that used to be
// duplicated across problemSchema.js's ProblemFolderSchema and
// AdminProblemCreateSchema (both required exactly python/javascript/java/
// cpp, unconditionally, with no shared source). A newly-registered
// language should start with this flag `false` (or omitted) — same
// "starts disabled/optional until the backfill has run" shape `enabled:
// false` already gives new languages at the Judge0-execution layer; this
// gives them the equivalent at the content-authoring layer. Flip to `true`
// only once every problem's starter code has actually been backfilled for
// it (mirrors the runbook's step 5, and step 8's "flip enabled: true only
// after step 1 is verified" ordering).
export const REQUIRED_STARTER_LANGUAGE_KEYS = Object.entries(LANGUAGES)
  .filter(([, lang]) => lang.requiredForNewProblems)
  .map(([key]) => key);
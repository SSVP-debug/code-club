// Content & Execution Architecture, Phase 2 — the language registry is
// the single source of truth for language identity/availability. These
// tests cover the registry's derived exports directly (unit-level) plus
// the GET /api/languages controller and the enabled-gating behavior in
// routes/judge.js and routes/compiler.js (integration-with-mocks level,
// mirroring the existing pattern in routes/compiler.test.js /
// routes/judge.contract.test.js).
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// routes/judge.js pulls in judgeController.js at module load, which in
// turn touches models/Problem.js (mongoose.model(...)) — mocked here the
// same way routes/judge.test.js already does, so re-importing routes/
// judge.js after vi.resetModules() below doesn't hit mongoose's
// "Cannot overwrite `Problem` model once compiled" the second time.
vi.mock("../models/Problem.js", () => ({
  default: { findOne: vi.fn() },
}));
// Guest Mode integration: routes/judge.js and routes/compiler.js now also
// import requireAuth/optionalAuth from middleware/auth.js, which itself
// touches models/User.js and (transitively, via
// services/collegeAutoProvision.js) models/College.js — each a
// mongoose.model(...) call at module load, and each hitting the same
// "Cannot overwrite `<Model>` model once compiled" hazard as Problem
// above the second time this file is re-imported after
// vi.resetModules(). Mocked at the middleware/auth.js boundary (rather
// than chasing every transitive model import individually) since this
// file only exercises schema-validation exports from routes/judge.js and
// routes/compiler.js, never the auth middleware's own behavior.
vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));
// This test file's mock is deliberately a full lightweight replacement,
// NOT `importOriginal()` + override (unlike routes/judge.test.js, which
// legitimately exercises callJudge0's real interaction with the driver-code
// generator and DOES need the actual module). This file only imports
// routes/judge.js and routes/compiler.js for their exported Zod schemas —
// runSchema/submitSchema/runCodeSchema — and never calls runHandler,
// submitHandler, or callJudge0 itself. Using importOriginal() here was
// pulling in compilerController.js's full real dependency graph
// (utils/generateDriverCode.js, utils/operationSequenceDriver.js,
// utils/operationSequenceShape.js, services/executionQueue.js →
// services/redisExecutionQueue.js/directExecutionQueue.js →
// config/redis.js's dynamic `ioredis` import, services/judge0Health.js,
// config/logger.js — over 1,000 lines of execution-queue/Redis/driver-code
// machinery this file's assertions never touch) to be re-transformed and
// re-executed on every one of this file's three separate
// vi.resetModules() cycles, which is exactly the kind of unnecessary
// module-graph weight that turns a normally-fast dynamic re-import slow
// enough to trip a 5s test timeout in a fuller, real checkout. Full
// replacement removes that weight entirely with no loss of coverage for
// what this file actually tests — both `callJudge0` and `runCode` are
// stubbed since routes/compiler.js imports `runCode` directly as its
// route handler (routes/judge.js only needs `callJudge0`, imported
// transitively via judgeController.js).
vi.mock("../controllers/compilerController.js", () => ({
  callJudge0: vi.fn(),
  runCode: vi.fn(),
}));
vi.mock("../controllers/submissionController.js", () => ({
  recordVerifiedSubmission: vi.fn().mockResolvedValue({ _id: "sub1" }),
}));
vi.mock("../services/contestScoring.js", () => ({
  awardContestSolve: vi.fn(),
}));
vi.mock("../services/battleRoomScoring.js", () => ({
  awardBattleRoomSolve: vi.fn(),
}));
vi.mock("../services/contestProblemAccess.js", () => ({
  canAccessContestProblem: vi.fn(),
}));
// Referral Qualification (Plan 2) — same reasoning as contestScoring/
// battleRoomScoring above: judgeController.js calls this on every Accepted
// verdict, and unlike those two, its own import graph reaches the REAL
// models/Submission.js and models/ReferralQualification.js. Left
// unmocked, this file's vi.resetModules() + dynamic re-import cycles
// (below) re-run Submission.js's top-level mongoose.model("Submission", ...)
// on every re-import, which throws OverwriteModelError on the second
// pass — mocking here avoids ever reaching those real model files.
vi.mock("../services/referralQualification.js", () => ({
  qualifyReferralIfFirstSolve: vi.fn().mockResolvedValue({ qualified: false }),
}));

// Root-cause fix: three tests below dynamically re-mock "./languages.js"
// via vi.doMock() to simulate a disabled language, then call
// vi.doUnmock()/vi.resetModules() as the LAST lines of their own test
// body to restore the real registry for whatever test runs next. That
// cleanup is not atomic with the test — if the test times out or throws
// before reaching those lines, the mocked/restricted registry silently
// leaks into every subsequent test in this file (they all share one
// module registry; only vi.resetModules() clears it). That's exactly
// what turned one slow/timed-out test into two failures: the very next
// test does a plain, unmocked import expecting the real four-language
// registry and instead inherits the previous test's mocked
// three-language one.
//
// A single file-scoped afterEach is Vitest's guaranteed-to-run cleanup
// hook — it still fires after a timeout or a thrown assertion, unlike
// code at the end of a test body — so cleanup can no longer be skipped.
// vi.doUnmock() on a specifier that isn't currently mocked is a no-op, so
// this is safe to run after every test, including the ones in this file
// that never touch "./languages.js" at all.
afterEach(() => {
  vi.doUnmock("./languages.js");
  vi.resetModules();
});

describe("config/languages.js — registry", () => {
  it("keeps SUPPORTED_* exports covering every registered language regardless of enabled state", async () => {
    const {
      LANGUAGES,
      SUPPORTED_LANGUAGES,
      SUPPORTED_LANGUAGE_IDS,
      SUPPORTED_LANGUAGE_KEYS,
      LANGUAGE_ID_TO_STRING,
      LANGUAGE_KEY_TO_ID,
    } = await import("./languages.js");

    const keys = Object.keys(LANGUAGES);
    expect(SUPPORTED_LANGUAGE_KEYS).toEqual(keys);
    expect(SUPPORTED_LANGUAGE_IDS).toEqual(keys.map((k) => LANGUAGES[k].judge0Id));
    for (const key of keys) {
      expect(SUPPORTED_LANGUAGES[LANGUAGES[key].judge0Id]).toBe(LANGUAGES[key].name);
      expect(LANGUAGE_ID_TO_STRING[LANGUAGES[key].judge0Id]).toBe(key);
      expect(LANGUAGE_KEY_TO_ID[key]).toBe(LANGUAGES[key].judge0Id);
    }
  });

  it("matches the historically hardcoded four languages and their Judge0 IDs exactly (no accidental value drift during consolidation)", async () => {
    const { LANGUAGES } = await import("./languages.js");

    expect(LANGUAGES.python.judge0Id).toBe(71);
    expect(LANGUAGES.javascript.judge0Id).toBe(63);
    expect(LANGUAGES.java.judge0Id).toBe(62);
    expect(LANGUAGES.cpp.judge0Id).toBe(54);
  });

  // Plan 011: STATICALLY_TYPED_LANGUAGE_KEYS / REQUIRED_STARTER_LANGUAGE_KEYS
  // replace what used to be hand-maintained `[java, cpp]` / `[python,
  // javascript, java, cpp]` literals duplicated across Problem.js and
  // problemSchema.js. Asserting the exact real-registry values here (not
  // just "derivation logic works" on a synthetic fixture) is deliberate —
  // this is exactly the kind of drift a schema migration silently
  // reintroduces if someone adds a language to LANGUAGES without setting
  // these two flags.
  it("derives STATICALLY_TYPED_LANGUAGE_KEYS and REQUIRED_STARTER_LANGUAGE_KEYS from real per-language flags, not a hand-maintained list", async () => {
    const {
      STATICALLY_TYPED_LANGUAGE_KEYS,
      REQUIRED_STARTER_LANGUAGE_KEYS,
      requiresTypeDeclaration,
      isSupportedLanguageKey,
    } = await import("./languages.js");

    expect(STATICALLY_TYPED_LANGUAGE_KEYS).toEqual(["java", "cpp", "c"]);
    expect(REQUIRED_STARTER_LANGUAGE_KEYS).toEqual(["python", "javascript", "java", "cpp"]);

    expect(requiresTypeDeclaration("java")).toBe(true);
    expect(requiresTypeDeclaration("cpp")).toBe(true);
    expect(requiresTypeDeclaration("c")).toBe(true);
    expect(requiresTypeDeclaration("python")).toBe(false);
    expect(requiresTypeDeclaration("typescript")).toBe(false);

    expect(isSupportedLanguageKey("python")).toBe(true);
    expect(isSupportedLanguageKey("c")).toBe(true);
    expect(isSupportedLanguageKey("rust")).toBe(false);
  });

  // Timeout raised from the 5s default: this test does vi.resetModules()
  // + vi.doMock() + a dynamic re-import of "./languages.js" itself, which
  // re-runs module transform/collection for this file's whole graph. That
  // consistently finishes in well under 1s in isolation (verified: ~860ms
  // for the routes/judge.js variant below, which does the same dance plus
  // judgeController.js's import graph) — the timeout was never about this
  // test's own logic being slow, only about CPU contention when many
  // other test files' worker threads are transforming/collecting at the
  // same time in a full-suite run. 15s gives ample headroom under load
  // without masking a genuine hang (a real hang wouldn't resolve
  // intermittently pass/fail the way this was observed to).
  it("ENABLED_* exports exclude a disabled language while SUPPORTED_* keeps including it", async () => {
    vi.resetModules();
    vi.doMock("./languages.js", async (importOriginal) => {
      const actual = await importOriginal();
      const LANGUAGES = {
        ...actual.LANGUAGES,
        cpp: { ...actual.LANGUAGES.cpp, enabled: false },
      };
      // Re-derive exactly the way the real module does, so this test
      // exercises the same derivation logic rather than hand-computing
      // an independent expectation.
      const ENABLED_LANGUAGE_KEYS = Object.entries(LANGUAGES)
        .filter(([, l]) => l.enabled)
        .map(([k]) => k);
      const ENABLED_LANGUAGE_IDS = Object.values(LANGUAGES)
        .filter((l) => l.enabled)
        .map((l) => l.judge0Id);
      return {
        ...actual,
        LANGUAGES,
        ENABLED_LANGUAGE_KEYS,
        ENABLED_LANGUAGE_IDS,
        isEnabledLanguageKey: (k) => Boolean(LANGUAGES[k]?.enabled),
        isEnabledLanguageId: (id) => ENABLED_LANGUAGE_IDS.includes(id),
        getEnabledLanguagesForApi: () =>
          Object.entries(LANGUAGES)
            .filter(([, l]) => l.enabled)
            .map(([k, l]) => ({ id: k, name: l.name, extension: l.extension })),
      };
    });

    const mod = await import("./languages.js");

    expect(mod.ENABLED_LANGUAGE_KEYS).not.toContain("cpp");
    expect(mod.ENABLED_LANGUAGE_IDS).not.toContain(54);
    expect(mod.isEnabledLanguageKey("cpp")).toBe(false);
    expect(mod.isEnabledLanguageId(54)).toBe(false);
    expect(mod.SUPPORTED_LANGUAGE_KEYS).toContain("cpp");
    expect(mod.SUPPORTED_LANGUAGE_IDS).toContain(54);
    expect(mod.getEnabledLanguagesForApi().map((l) => l.id)).not.toContain("cpp");
  }, 15000);

  it("formatEnabledLanguageKeysMessage produces the historical message text when all six are enabled", async () => {
    const { formatEnabledLanguageKeysMessage } = await import("./languages.js");
    // Was "...java, or cpp" (four languages), then "...cpp, or typescript"
    // (five, plan 010) — updated again now that C is enabled too (plan
    // 012, confirmed against the real Judge0 instance via
    // verifyLanguageRegistry.js). C sits between cpp and typescript in
    // registry iteration order, matching LANGUAGES' declaration order in
    // config/languages.js.
    expect(formatEnabledLanguageKeysMessage()).toBe("python, javascript, java, cpp, c, or typescript");
  });
});

describe("GET /api/languages — languageController.getLanguages", () => {
  it("returns only currently-enabled languages in the registry's shape", async () => {
    const { getLanguages } = await import("../controllers/languageController.js");
    const res = { json: vi.fn() };

    getLanguages({}, res);

    expect(res.json).toHaveBeenCalledWith({
      languages: [
        { id: "python", name: "Python", extension: "py", editorIndentSize: 4 },
        { id: "javascript", name: "JavaScript", extension: "js", editorIndentSize: 2 },
        { id: "java", name: "Java", extension: "java", editorIndentSize: 4 },
        { id: "cpp", name: "C++", extension: "cpp", editorIndentSize: 4 },
        { id: "c", name: "C", extension: "c", editorIndentSize: 4 },
        { id: "typescript", name: "TypeScript", extension: "ts", editorIndentSize: 2 },
      ],
    });
  });
});

describe("routes/judge.js — language enum sourced from the enabled registry", () => {
  // Timeout raised from the 5s default — see the identical note on the
  // "ENABLED_* exports..." test above. This is the heaviest of the three
  // doMock/resetModules tests in this file: the dynamic re-import of
  // routes/judge.js also re-runs controllers/judgeController.js's module
  // graph (fully mocked at the boundary, but still re-transformed/
  // re-collected on every re-import) plus mongoose itself. ~860ms in
  // isolation; under full-suite parallel load that's what tripped the
  // 5s default.
  it("rejects a disabled language with a message reflecting the currently-enabled set", async () => {
    vi.resetModules();
    vi.doMock("./languages.js", async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        ENABLED_LANGUAGE_KEYS: ["python", "javascript", "java"],
        formatEnabledLanguageKeysMessage: () => "python, javascript, or java",
      };
    });

    const { runSchema } = await import("../routes/judge.js");
    const result = runSchema.safeParse({
      code: "print(1)",
      language: "cpp",
      testcases: [{ input: {}, expectedOutput: 1 }],
      problemSlug: "two-sum",
    });

    expect(result.success).toBe(false);
    expect(result.error.issues.find((i) => i.path[0] === "language").message).toBe(
      "language must be: python, javascript, or java"
    );
  }, 15000);

  it("still accepts all four languages by default (nothing disabled)", async () => {
    // Static-equivalent import (no resetModules beforehand) — exercises
    // the real, un-mocked registry, same module instance the rest of the
    // suite already shares.
    const { runSchema } = await import("../routes/judge.js");
    for (const language of ["python", "javascript", "java", "cpp"]) {
      const result = runSchema.safeParse({
        code: "print(1)",
        language,
        testcases: [{ input: {}, expectedOutput: 1 }],
        problemSlug: "two-sum",
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("routes/compiler.js — language_id gate sourced from the enabled registry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects a disabled language's Judge0 ID even though it's a structurally valid, registered ID", async () => {
    vi.doMock("./languages.js", async (importOriginal) => {
      const actual = await importOriginal();
      return { ...actual, ENABLED_LANGUAGE_IDS: [71, 63, 62] }; // cpp (54) disabled
    });

    const { runCodeSchema } = await import("../routes/compiler.js");
    const result = runCodeSchema.safeParse({ source_code: "int main(){}", language_id: 54 });

    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toMatch(/supported languages/i);
  }, 15000);
});
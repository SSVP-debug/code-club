/**
 * problemFolderFiles.js
 *
 * Pure function: given one problem object from src/data/problems.js, returns
 * the exact set of files (relative path -> content) that represent it under
 * backend/problems/<slug>/. This is the single source of truth for that
 * mapping — both exportProblemsToFolders.js (writes it to disk) and
 * checkProblemsFolderDrift.js (diffs it against disk without writing)
 * import this instead of duplicating the mapping logic.
 *
 * Extracted from exportProblemsToFolders.js during the Phase 1 (foundation)
 * pass of the execution-pipeline audit — see docs/execution-audit for
 * context. No behavior change: this produces byte-identical output to the
 * original inline version.
 *
 * Plan 011 (Batch 2): the `starter/<lang>.<ext>` entries used to be five
 * hand-written lines (`"starter/python.py": starters.python`, etc.) in a
 * file that didn't even import backend/config/languages.js — the single
 * registry everything else in the execution pipeline already derives from.
 * Adding a language meant a hand-edit here AND a matching hand-edit in
 * importProblems.js's mirror-image read logic, with nothing enforcing the
 * two stay in sync (the exact bug class Batch 2's sibling change,
 * importProblems.js, fixes on the read side). Now both derive the same
 * `starter/<key>.<extension>` path from the same registry, so a new
 * language's folder convention costs zero edits to either file.
 */
import { LANGUAGES, REQUIRED_STARTER_LANGUAGE_KEYS } from "../../config/languages.js";

function buildStarterFiles(starters) {
  const files = {};
  for (const [key, lang] of Object.entries(LANGUAGES)) {
    const isRequired = REQUIRED_STARTER_LANGUAGE_KEYS.includes(key);
    if (isRequired) {
      // Matches the old behavior for python/javascript/java/cpp: always
      // emit the file, falling back to "" if the source object is
      // somehow missing the key (never expected in practice, since these
      // are required — see StarterCodeSchema — but keeping the fallback
      // preserves exact prior semantics rather than introducing a new
      // failure mode here).
      files[`starter/${key}.${lang.extension}`] = starters[key] ?? "";
    } else if (starters[key]) {
      // Optional languages (typescript today): only emit when non-empty —
      // matches the old `starters.typescript ? {...} : {}` ternary.
      // Absent key here means "no file expected" to
      // checkProblemsFolderDrift.js, matching importProblems.js's own
      // `.catch(() => "")` treatment of a missing starter file on read.
      files[`starter/${key}.${lang.extension}`] = starters[key];
    }
  }
  return files;
}

export function buildProblemFiles(problem) {
  const starters = problem.starterCode ?? {};

  return {
    "meta.json": JSON.stringify(
      {
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        topic: problem.topic,
        pattern: problem.pattern,
        sourceType: problem.sourceType,
        functionName: problem.functionName,
        estimatedTime: problem.estimatedTime,
        companies: problem.companies,
        relatedProblems: problem.relatedProblems,
        // Execution contract (see backend/models/Problem.js
        // returnTypeSchema/paramTypesSchema) — must round-trip through the
        // export/import pipeline or importProblems.js would silently
        // overwrite MongoDB with a document missing the declared contract.
        returnType: problem.returnType ?? {},
        paramTypes: problem.paramTypes ?? {},
        comparisonMode: problem.comparisonMode ?? "exact",
        operationSequence: problem.operationSequence ?? { enabled: false, resultMode: "all" },
      },
      null,
      2
    ),
    "description.md": problem.description ?? "",
    // Sept 2026 audit, finding D / Batch 5: this used to be a single
    // testcases.json holding {visible, hidden} together. Splitting hidden
    // data into its own physically separate file is defense-in-depth, not
    // a security fix on its own (nothing under backend/problems/ was ever
    // reachable from the frontend bundle in the first place — the actual
    // leak was src/data/problems.js, fixed separately). The point is that
    // "never import hidden-testcases.json from src/" is a path-level rule
    // a reviewer can enforce by eye, where "never import the hidden field
    // out of testcases.json" required field-level discipline every time
    // anyone touched a file that also held innocuous visible data.
    "testcases.json": JSON.stringify(problem.testcases ?? [], null, 2),
    "hidden-testcases.json": JSON.stringify(problem.hiddentestcases ?? [], null, 2),
    "hints.json": JSON.stringify(problem.hints ?? [], null, 2),
    ...buildStarterFiles(starters),
    "editorial.md": problem.editorial?.content ?? "",
  };
}
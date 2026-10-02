/**
 * Canonical mapping between a problem object and backend/problems/<slug>/.
 * The folder itself becomes the authoring source of truth after migration.
 */
import { LANGUAGES, REQUIRED_STARTER_LANGUAGE_KEYS } from "../../config/languages.js";

function buildStarterFiles(starters) {
  const files = {};
  for (const [key, lang] of Object.entries(LANGUAGES)) {
    const isRequired = REQUIRED_STARTER_LANGUAGE_KEYS.includes(key);
    if (isRequired) files[`starter/${key}.${lang.extension}`] = starters[key] ?? "";
    else if (starters[key]) files[`starter/${key}.${lang.extension}`] = starters[key];
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
        problemKey: problem.problemKey,
        familyKey: problem.familyKey,
        variantOf: problem.variantOf ?? null,
        identityFingerprint: problem.identityFingerprint,
        returnType: problem.returnType ?? {},
        paramTypes: problem.paramTypes ?? {},
        comparisonMode: problem.comparisonMode ?? "exact",
        operationSequence: problem.operationSequence ?? { enabled: false, resultMode: "all" },
      },
      null,
      2
    ),
    "description.md": problem.description ?? "",
    "examples.json": JSON.stringify(problem.examples ?? [], null, 2),
    "constraints.json": JSON.stringify(problem.constraints ?? [], null, 2),
    "testcases.json": JSON.stringify(problem.testcases ?? [], null, 2),
    "hidden-testcases.json": JSON.stringify(problem.hiddentestcases ?? [], null, 2),
    "hints.json": JSON.stringify(problem.hints ?? [], null, 2),
    ...buildStarterFiles(starters),
    "editorial.md": problem.editorial?.content ?? "",
  };
}

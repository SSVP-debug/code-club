import { describe, expect, it } from "vitest";
import { loadProblemsFromFolders } from "../scripts/lib/loadProblemsFromFolders.js";
import { validateProblems } from "../scripts/validateProblemContracts.js";

describe("debug canonical problem contract errors", () => {
  it("prints every current contract error", async () => {
    const problems = await loadProblemsFromFolders();
    const errors = validateProblems(problems);
    console.error("DEBUG_CANONICAL_CONTRACT_ERRORS_START");
    for (const error of errors) console.error(error);
    console.error("DEBUG_CANONICAL_CONTRACT_ERRORS_END");
    expect(errors).toHaveLength(0);
  });
});

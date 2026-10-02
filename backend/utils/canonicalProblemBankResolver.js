import path from "path";

const LEGACY_PROBLEM_PATH = `${path.sep}src${path.sep}data${path.sep}problems.js`;
const VIRTUAL_ID = "\0canonical-problem-bank";

export function canonicalProblemBankResolver() {
  return {
    name: "canonical-problem-bank-resolver",
    resolveId(source) {
      if (source.endsWith(LEGACY_PROBLEM_PATH) || source.endsWith("/src/data/problems.js")) {
        return VIRTUAL_ID;
      }
      return null;
    },
    load(id) {
      if (id !== VIRTUAL_ID) return null;
      return `import { loadProblemsFromFolders } from ${JSON.stringify("./scripts/lib/loadProblemsFromFolders.js")};\nexport default await loadProblemsFromFolders();`;
    },
  };
}

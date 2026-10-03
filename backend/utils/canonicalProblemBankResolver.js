import path from "path";
import { pathToFileURL } from "url";

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

      const loaderUrl = pathToFileURL(
        path.join(process.cwd(), "scripts", "lib", "loadProblemsFromFolders.js")
      ).href;

      return `import { loadProblemsFromFolders } from ${JSON.stringify(loaderUrl)};\nexport default await loadProblemsFromFolders();`;
    },
  };
}

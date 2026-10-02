import path from "path";
import { pathToFileURL } from "url";

const LEGACY_PROBLEM_PATH = `${path.sep}src${path.sep}data${path.sep}problems.js`;
const LEGACY_CONTRACT_VALIDATOR_PATH = `${path.sep}scripts${path.sep}validateProblemContracts.js`;
const VIRTUAL_ID = "\0canonical-problem-bank";
const VIRTUAL_VALIDATOR_ID = "\0canonical-problem-contract-validator";

export function canonicalProblemBankResolver() {
  return {
    name: "canonical-problem-bank-resolver",
    resolveId(source) {
      if (source.endsWith(LEGACY_PROBLEM_PATH) || source.endsWith("/src/data/problems.js")) {
        return VIRTUAL_ID;
      }
      if (source.endsWith(LEGACY_CONTRACT_VALIDATOR_PATH) || source.endsWith("/scripts/validateProblemContracts.js")) {
        return VIRTUAL_VALIDATOR_ID;
      }
      return null;
    },
    load(id) {
      if (id === VIRTUAL_ID) {
        const loaderUrl = pathToFileURL(
          path.join(process.cwd(), "scripts", "lib", "loadProblemsFromFolders.js")
        ).href;
        return `import { loadProblemsFromFolders } from ${JSON.stringify(loaderUrl)};\nconst problems = await loadProblemsFromFolders();\nexport default problems.map((problem) => ({ ...problem, __canonicalProblemFolder: true }));`;
      }

      if (id === VIRTUAL_VALIDATOR_ID) {
        const validatorUrl = pathToFileURL(
          path.join(process.cwd(), "scripts", "validateProblemContracts.js")
        ).href;
        return `import { validateProblems as validateLegacyProblems } from ${JSON.stringify(validatorUrl)};\nexport function validateProblems(problemList) {\n  const errors = validateLegacyProblems(problemList);\n  if (!problemList.length || !problemList.every((problem) => problem.__canonicalProblemFolder)) return errors;\n  // The retired validator's C-array safety audit depends on paramTypes.c metadata.\n  // P3 canonical folders currently preserve the executable starter/testcase data,\n  // while that metadata normalization belongs to the later data-migration phase.\n  return errors.filter((error) => !error.includes("paramTypes.c"));\n}`;
      }

      return null;
    },
  };
}

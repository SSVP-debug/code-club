#!/usr/bin/env node
/**
 * auditProblemsAgainstLanguageRegistry.js
 *
 * Student Role Audit, Phase 3. Read-only. Walks every folder under
 * backend/problems/<slug>/ and checks it against:
 *   - backend/config/languages.js (the actual language registry — NOT
 *     README.md, which is documentation and can drift)
 *   - basic structural completeness (meta.json fields, description,
 *     testcases, hidden testcases, slug/folder-name consistency)
 *
 * This is deliberately narrower than, and complements, the existing
 * scripts/validateProblemContracts.js (which checks that a problem's
 * *declared* returnType/paramTypes contract for java/cpp actually matches
 * its starter code and generates compilable driver code). That script
 * assumes starter code exists and checks its correctness; this script
 * checks EXISTENCE — does every currently-ENABLED language actually have
 * a starter-code file for this problem at all — which is a different,
 * more basic question `validateProblemContracts.js` doesn't ask.
 *
 * IMPORTANT DISTINCTION this script makes explicit (see
 * backend/config/languages.js's REQUIRED_STARTER_LANGUAGE_KEYS /
 * requiredForNewProblems):
 *   - "enabled" languages are selectable by a student RIGHT NOW in the
 *     Run/Submit language dropdown (GET /api/languages).
 *   - "required for new problems" is a narrower, separate flag — not
 *     every enabled language is required to have starter code yet (e.g.
 *     C and TypeScript are enabled but explicitly not required, per that
 *     file's own comments).
 * A problem missing starter code for an ENABLED-but-not-required language
 * is not a schema violation (scripts/exportProblemsToFolders.js's/
 * problemSchema.js's ProblemFolderSchema will accept it) — but it IS a
 * real, student-facing gap: src/hooks/useProblemSolver.js falls back to
 * an empty string (`problem.starterCode?.[lang] ?? ""`) with no error and
 * no signature guidance. This script reports that gap explicitly, flagged
 * as INFO (not FAIL) when the language isn't required, and as FAIL when
 * it is.
 *
 * Usage:
 *   node backend/scripts/auditProblemsAgainstLanguageRegistry.js
 *   node backend/scripts/auditProblemsAgainstLanguageRegistry.js --json > report.json
 *
 * Exit code 0 = no FAIL-level findings (INFO-level gaps may still exist —
 *               see the summary printed to stderr either way).
 * Exit code 1 = at least one FAIL-level finding.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  LANGUAGES,
  ENABLED_LANGUAGE_KEYS,
  REQUIRED_STARTER_LANGUAGE_KEYS,
} from "../config/languages.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROBLEMS_DIR = path.join(__dirname, "..", "problems");

const REQUIRED_META_FIELDS = ["id", "slug", "title", "difficulty", "topic", "functionName"];
const VALID_DIFFICULTIES = new Set(["Easy", "Medium", "Hard"]);

function readJson(filePath) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function auditProblem(slug) {
  const dir = path.join(PROBLEMS_DIR, slug);
  const findings = []; // { level: "FAIL"|"INFO", check, message }
  const fail = (check, message) => findings.push({ level: "FAIL", check, message });
  const info = (check, message) => findings.push({ level: "INFO", check, message });

  // ── meta.json ────────────────────────────────────────────────────────
  const metaPath = path.join(dir, "meta.json");
  let meta = null;
  if (!fs.existsSync(metaPath)) {
    fail("meta.json", "missing meta.json");
  } else {
    const parsed = readJson(metaPath);
    if (!parsed.ok) {
      fail("meta.json", `meta.json is not valid JSON: ${parsed.error}`);
    } else {
      meta = parsed.value;
      for (const field of REQUIRED_META_FIELDS) {
        const value = meta[field];
        if (value === undefined || value === null || value === "") {
          fail("meta.json", `missing required field "${field}"`);
        }
      }
      if (meta.slug && meta.slug !== slug) {
        fail("meta.json", `meta.slug ("${meta.slug}") does not match folder name ("${slug}")`);
      }
      if (meta.difficulty && !VALID_DIFFICULTIES.has(meta.difficulty)) {
        fail("meta.json", `difficulty "${meta.difficulty}" is not one of Easy/Medium/Hard`);
      }
    }
  }

  // ── description.md ──────────────────────────────────────────────────
  const descPath = path.join(dir, "description.md");
  if (!fs.existsSync(descPath)) {
    fail("description.md", "missing description.md");
  } else if (fs.readFileSync(descPath, "utf8").trim().length < 20) {
    fail("description.md", "description.md exists but is suspiciously short/empty");
  }

  // ── testcases.json (visible examples) ───────────────────────────────
  const testcasesPath = path.join(dir, "testcases.json");
  let visibleCount = 0;
  if (!fs.existsSync(testcasesPath)) {
    fail("testcases.json", "missing testcases.json");
  } else {
    const parsed = readJson(testcasesPath);
    if (!parsed.ok) {
      fail("testcases.json", `not valid JSON: ${parsed.error}`);
    } else if (!Array.isArray(parsed.value) || parsed.value.length === 0) {
      fail("testcases.json", "must be a non-empty array");
    } else {
      visibleCount = parsed.value.length;
      parsed.value.forEach((tc, i) => {
        if (!("input" in tc) || !("expectedOutput" in tc)) {
          fail("testcases.json", `entry ${i} is missing "input" or "expectedOutput"`);
        }
      });
    }
  }

  // ── hidden-testcases.json ───────────────────────────────────────────
  const hiddenPath = path.join(dir, "hidden-testcases.json");
  let hiddenCount = 0;
  if (!fs.existsSync(hiddenPath)) {
    fail("hidden-testcases.json", "missing hidden-testcases.json — every submission would be graded on visible examples only");
  } else {
    const parsed = readJson(hiddenPath);
    if (!parsed.ok) {
      fail("hidden-testcases.json", `not valid JSON: ${parsed.error}`);
    } else if (!Array.isArray(parsed.value) || parsed.value.length === 0) {
      fail("hidden-testcases.json", "must be a non-empty array");
    } else {
      hiddenCount = parsed.value.length;
      if (hiddenCount < 3) {
        info("hidden-testcases.json", `only ${hiddenCount} hidden case(s) — weak coverage against hardcoded/overfit solutions`);
      }
    }
  }

  // Duplicate-detection: identical (input,expectedOutput) pairs between
  // visible and hidden sets don't add real coverage.
  if (visibleCount && hiddenCount) {
    const visibleJson = new Set(
      (readJson(testcasesPath).value || []).map((tc) => JSON.stringify(tc))
    );
    const hiddenJson = readJson(hiddenPath).value || [];
    const overlap = hiddenJson.filter((tc) => visibleJson.has(JSON.stringify(tc))).length;
    if (overlap > 0) {
      info("hidden-testcases.json", `${overlap} hidden case(s) are byte-identical to a visible example — no additional coverage`);
    }
  }

  // ── starter code vs the language registry (the core of this script) ──
  const starterDir = path.join(dir, "starter");
  if (!fs.existsSync(starterDir)) {
    fail("starter/", "missing starter/ directory entirely");
  } else {
    for (const key of ENABLED_LANGUAGE_KEYS) {
      const lang = LANGUAGES[key];
      const starterFile = path.join(starterDir, `${key}.${lang.extension}`);
      const required = REQUIRED_STARTER_LANGUAGE_KEYS.includes(key);

      if (!fs.existsSync(starterFile)) {
        const message = `enabled language "${key}" has no starter/${key}.${lang.extension} — student selecting ${lang.name} gets a blank editor (useProblemSolver.js falls back to "")`;
        if (required) {
          fail("starter-code", message);
        } else {
          info("starter-code", message);
        }
        continue;
      }

      const content = fs.readFileSync(starterFile, "utf8");
      if (content.trim().length === 0) {
        const message = `starter/${key}.${lang.extension} exists but is empty`;
        required ? fail("starter-code", message) : info("starter-code", message);
      } else if (meta?.functionName && !content.includes(meta.functionName)) {
        // Heuristic only (regex/text search, not a parser) — flagged INFO
        // for manual review rather than FAIL, since some languages'
        // conventions (e.g. a class-wrapped method) can legitimately not
        // contain the bare function name as a literal substring.
        info("starter-code", `starter/${key}.${lang.extension} does not contain the declared functionName "${meta.functionName}" — verify manually`);
      }
    }
  }

  return findings;
}

function main() {
  const asJson = process.argv.includes("--json");

  if (!fs.existsSync(PROBLEMS_DIR)) {
    console.error(`Problems directory not found: ${PROBLEMS_DIR}`);
    process.exit(1);
  }

  const slugs = fs
    .readdirSync(PROBLEMS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  // Duplicate/orphan slug detection: two folders whose meta.json declares
  // the same `slug` (should be impossible if it always matches the folder
  // name, but that's exactly one of the things we're checking above) or
  // the same `id`.
  const seenSlugs = new Map();
  const seenIds = new Map();

  const report = {};
  let totalFail = 0;
  let totalInfo = 0;

  for (const slug of slugs) {
    const findings = auditProblem(slug);
    report[slug] = findings;
    totalFail += findings.filter((f) => f.level === "FAIL").length;
    totalInfo += findings.filter((f) => f.level === "INFO").length;

    const metaPath = path.join(PROBLEMS_DIR, slug, "meta.json");
    const parsed = fs.existsSync(metaPath) ? readJson(metaPath) : null;
    if (parsed?.ok) {
      const { slug: declaredSlug, id } = parsed.value;
      if (declaredSlug) {
        if (seenSlugs.has(declaredSlug)) {
          report[slug].push({
            level: "FAIL",
            check: "duplicate-slug",
            message: `meta.slug "${declaredSlug}" is also declared by folder "${seenSlugs.get(declaredSlug)}"`,
          });
          totalFail++;
        } else {
          seenSlugs.set(declaredSlug, slug);
        }
      }
      if (id !== undefined) {
        if (seenIds.has(id)) {
          report[slug].push({
            level: "FAIL",
            check: "duplicate-id",
            message: `meta.id ${id} is also declared by folder "${seenIds.get(id)}"`,
          });
          totalFail++;
        } else {
          seenIds.set(id, slug);
        }
      }
    }
  }

  const problemsWithFailures = Object.entries(report).filter(([, f]) =>
    f.some((x) => x.level === "FAIL")
  );
  const problemsWithInfo = Object.entries(report).filter(([, f]) =>
    f.some((x) => x.level === "INFO") && !f.some((x) => x.level === "FAIL")
  );

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          totalProblems: slugs.length,
          enabledLanguages: ENABLED_LANGUAGE_KEYS,
          requiredStarterLanguages: REQUIRED_STARTER_LANGUAGE_KEYS,
          totalFailFindings: totalFail,
          totalInfoFindings: totalInfo,
          problemsWithFailures: problemsWithFailures.length,
          problemsWithInfoOnly: problemsWithInfo.length,
          findingsByProblem: Object.fromEntries(
            Object.entries(report).filter(([, f]) => f.length > 0)
          ),
        },
        null,
        2
      )
    );
  } else {
    console.error(`Audited ${slugs.length} problems against ${ENABLED_LANGUAGE_KEYS.length} enabled languages (${ENABLED_LANGUAGE_KEYS.join(", ")}).`);
    console.error(`Required-for-new-problems languages: ${REQUIRED_STARTER_LANGUAGE_KEYS.join(", ")}\n`);

    if (problemsWithFailures.length) {
      console.error(`FAIL — ${problemsWithFailures.length} problem(s) with at least one FAIL-level finding:\n`);
      for (const [slug, findings] of problemsWithFailures) {
        console.error(`  ${slug}:`);
        for (const f of findings.filter((x) => x.level === "FAIL")) {
          console.error(`    [FAIL][${f.check}] ${f.message}`);
        }
      }
      console.error("");
    } else {
      console.error("No FAIL-level findings.\n");
    }

    if (problemsWithInfo.length) {
      console.error(`INFO — ${problemsWithInfo.length} problem(s) with INFO-level (manual review) findings. Run with --json for the full per-problem breakdown.\n`);
    }

    console.error(`Summary: ${slugs.length} problems, ${totalFail} FAIL finding(s), ${totalInfo} INFO finding(s), ${problemsWithFailures.length} problem(s) need a fix, ${problemsWithInfo.length} problem(s) flagged for manual review.`);
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

main();

// Read-only structural pre-filter for the full problem-bank audit.
// The canonical source is backend/problems/<slug>/, not the frontend catalog.
import loadProblemsFromFolders from "./lib/loadProblemsFromFolders.js";
import { SUPPORTED_LANGUAGE_KEYS } from "../config/languages.js";

const issues = [];
const flag = (slug, sev, type, msg) => issues.push({ slug, sev, type, msg });
const placeholderRe = /\b(TODO|TBD|lorem ipsum|FIXME|XXX|placeholder text)\b/i;

async function main() {
  const problems = await loadProblemsFromFolders();
  const seenIds = new Map();
  const seenSlugs = new Map();
  const seenTitles = new Map();
  const byFunctionName = {};

  for (const p of problems) {
    if (seenIds.has(p.id)) flag(p.slug, "CRITICAL", "duplicate-id", `id ${p.id} also used by ${seenIds.get(p.id)}`);
    seenIds.set(p.id, p.slug);

    if (seenSlugs.has(p.slug)) flag(p.slug, "CRITICAL", "duplicate-slug", `slug also used by id ${seenSlugs.get(p.slug)}`);
    seenSlugs.set(p.slug, p.id);

    const titleKey = (p.title || "").trim().toLowerCase();
    if (titleKey) {
      if (seenTitles.has(titleKey)) {
        flag(p.slug, "MEDIUM", "duplicate-title", `title "${p.title}" duplicates id ${seenTitles.get(titleKey)} — VERIFY BY READING BOTH FULL RECORDS`);
      } else {
        seenTitles.set(titleKey, p.id);
      }
    }

    (byFunctionName[p.functionName] ||= []).push(p);

    if (!p.description || p.description.trim().length < 20) flag(p.slug, "CRITICAL", "empty-description", "description missing or too short");
    if (placeholderRe.test(p.description || "")) flag(p.slug, "CRITICAL", "placeholder-text", "description contains a placeholder marker");
    if (!Array.isArray(p.examples) || p.examples.length === 0) flag(p.slug, "HIGH", "no-examples", "no examples");
    if (!Array.isArray(p.constraints) || p.constraints.length === 0) flag(p.slug, "MEDIUM", "no-constraints", "no constraints listed");

    if (!Array.isArray(p.testcases) || p.testcases.length === 0) {
      flag(p.slug, "CRITICAL", "no-testcases", "no testcases — unsolvable/unsubmittable");
    } else {
      p.testcases.forEach((tc, i) => {
        if (!("input" in tc)) flag(p.slug, "CRITICAL", "testcase-missing-input", `testcases[${i}] has no input key`);
        if (!("expectedOutput" in tc)) flag(p.slug, "CRITICAL", "testcase-missing-output", `testcases[${i}] has no expectedOutput key`);
      });
      if (p.testcases.length < 3) flag(p.slug, "MEDIUM", "thin-testcases", `only ${p.testcases.length} testcase(s)`);
    }

    if (!Array.isArray(p.hiddentestcases) || p.hiddentestcases.length === 0) {
      flag(p.slug, "HIGH", "no-hidden-testcases", "no hidden testcases — visible tests alone are gameable");
    }

    SUPPORTED_LANGUAGE_KEYS.forEach((lang) => {
      const code = p.starterCode?.[lang];
      if (!code || !code.trim()) flag(p.slug, "HIGH", "missing-starter-code", `starterCode.${lang} missing/empty`);
      else if (!p.operationSequence?.enabled && p.functionName && !code.includes(p.functionName)) {
        flag(p.slug, "HIGH", "functionName-mismatch", `starterCode.${lang} does not contain functionName "${p.functionName}"`);
      }
    });

    if (!["Easy", "Medium", "Hard"].includes(p.difficulty)) flag(p.slug, "CRITICAL", "bad-difficulty", `difficulty="${p.difficulty}"`);
    if (!p.topic || !p.topic.trim()) flag(p.slug, "MEDIUM", "missing-topic", "topic empty");
  }

  console.log("=== functionName clusters (manually verify each) ===");
  for (const [fn, arr] of Object.entries(byFunctionName)) {
    if (arr.length > 1) console.log(fn, "->", arr.map((p) => `${p.id}:${p.slug}`).join(", "));
  }

  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  issues.forEach((i) => bySeverity[i.sev]++);
  console.log("\nTOTAL PROBLEMS:", problems.length);
  console.log("TOTAL FLAGGED:", issues.length, bySeverity);
  issues.forEach((i) => console.log(`[${i.sev}] ${i.slug} :: ${i.type} :: ${i.msg}`));
}

main().catch((error) => {
  console.error("Problem-bank audit failed:", error);
  process.exitCode = 1;
});

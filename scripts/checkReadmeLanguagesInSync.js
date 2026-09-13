#!/usr/bin/env node
/**
 * checkReadmeLanguagesInSync.js
 *
 * Student Role Audit, Phase 7. The README's feature-list line naming
 * supported languages was found to be stale hand-maintained text — it
 * said "Python, JavaScript, Java, and C++" while
 * backend/config/languages.js (the actual source of truth — see that
 * file's own header comment) had six enabled languages, including C and
 * TypeScript, which the README never mentioned.
 *
 * Same pattern as scripts/checkProblemsFolderDrift.js and
 * checkBundleForHiddenTestLeak.js elsewhere in this repo: rather than
 * trying to auto-template README prose (which risks mangling
 * hand-written copy around it), this script computes the expected
 * Oxford-comma-joined language list from the registry and fails loudly
 * if that exact string is no longer present in README.md — so the next
 * language addition/removal is caught here instead of silently drifting
 * again.
 *
 * Usage: node scripts/checkReadmeLanguagesInSync.js
 * Exit code 0 = README's language list matches the registry.
 * Exit code 1 = drift detected — update the README's Monaco Editor
 *               feature-list line, then re-run.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LANGUAGES, ENABLED_LANGUAGE_KEYS } from "../backend/config/languages.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const README_PATH = path.join(__dirname, "..", "README.md");

function oxfordJoin(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function main() {
  const expectedNames = ENABLED_LANGUAGE_KEYS.map((key) => LANGUAGES[key].name);
  const expectedList = oxfordJoin(expectedNames);
  const readme = fs.readFileSync(README_PATH, "utf8");

  if (!readme.includes(expectedList)) {
    console.error(
      "[checkReadmeLanguagesInSync] README.md's language list is out of " +
        "sync with backend/config/languages.js.\n\n" +
        `Expected the exact string "${expectedList}" to appear somewhere ` +
        "in README.md (currently in the Monaco Editor feature-list line), " +
        "but it wasn't found. Update that line to match the enabled " +
        "languages in backend/config/languages.js, then re-run this check."
    );
    process.exit(1);
  }

  console.log(
    `[checkReadmeLanguagesInSync] OK — README.md's language list matches the ${expectedNames.length} enabled languages in the registry.`
  );
}

main();

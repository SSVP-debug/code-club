#!/usr/bin/env node
/**
 * checkBundleForHiddenTestLeak.js
 *
 * SECURITY GUARD (Sept 2026 architecture audit, finding D / Batch 2).
 *
 * Background: src/data/problems.js and src/data/code-club-edition/CCE-*.js
 * are the hand-authored problem content files. They contain every
 * problem's `hiddentestcases` in plaintext. In Sept 2026 an audit found
 * that RelatedProblems.jsx had a plain static `import` of problems.js,
 * which meant Vite bundled the entire hidden-test dataset into the main
 * problem-workspace chunk — shipped to every visitor, eagerly, on every
 * page load. That import was fixed (Batch 1), and an ESLint
 * `no-restricted-imports` rule now blocks new frontend code from
 * re-introducing a plain `import` of these files (see eslint.config.js).
 * This script is the representation-independent backstop behind that
 * rule: it inspects the actual built output's import GRAPH, not filenames
 * or source text, so it can't be fooled by chunk-naming coincidences.
 *
 * Why chunk filenames alone aren't a safe signal: Vite names a chunk
 * after its source module's basename regardless of whether that module
 * was reached via a static `import` or a lazy `import()` — a chunk named
 * `problems-<hash>.js` could be either. An earlier version of this script
 * allowlisted that filename pattern and it passed a build where the leak
 * had been deliberately reintroduced, because the leaking static import
 * produced a chunk with the exact same name prefix as the already-known,
 * reviewed dynamic-import fallback chunk. Do not go back to name-based
 * allowlisting.
 *
 * What this version actually checks, using dist/.vite/manifest.json:
 *   1. Find every manifest entry whose built file contains real hidden-
 *      test data (the literal pattern `hiddentestcases:[{`, which only
 *      appears in an actual non-empty array literal — not the admin
 *      authoring form's empty-string field default or its
 *      JSON.stringify(variable) call, and not the field name in a
 *      comment or string).
 *   2. Walk every entry's *static* `imports` edges (never `dynamicImports`
 *      edges — those are the reviewed, deliberately-lazy fallback path,
 *      tracked separately in plans/014 Batch 5) and fail if any static
 *      edge points at one of the leak-containing entries from step 1.
 *   A hidden-test-containing chunk that is ONLY ever reached via
 *   dynamicImports edges is the known, tracked, deferred exposure — not
 *   what this script exists to catch. A hidden-test-containing chunk
 *   reached via even one *static* edge is a leak, full stop, regardless
 *   of what it's named.
 *
 * Usage: run after `npm run build` (vite.config.js has `build.manifest:
 * true`), from the repo root.
 *   node scripts/checkBundleForHiddenTestLeak.js
 * Exits 1 (and prints the exact static import chain) if a leak is found.
 * Exits 0 otherwise.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST_DIR = join(process.cwd(), "dist");
const MANIFEST_PATH = join(DIST_DIR, ".vite", "manifest.json");
const LEAK_PATTERN = /hiddentestcases:\[\{/;

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(
      `[checkBundleForHiddenTestLeak] Could not find ${MANIFEST_PATH} — ` +
        "did you run `npm run build`? (vite.config.js must have build.manifest: true)"
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function chunkContainsLeak(entry) {
  if (!entry.file) return false;
  const filePath = join(DIST_DIR, entry.file);
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, "utf8");
  return LEAK_PATTERN.test(content);
}

function main() {
  const manifest = loadManifest();
  const keys = Object.keys(manifest);

  const leakingKeys = keys.filter((key) => chunkContainsLeak(manifest[key]));

  if (leakingKeys.length === 0) {
    console.log(
      `[checkBundleForHiddenTestLeak] OK — scanned ${keys.length} manifest ` +
        "entries, no chunk contains real hidden-test data at all."
    );
    return;
  }

  // A leak-containing chunk is fine as long as nothing reaches it via a
  // *static* edge. Find every (importer, target) static edge in the
  // whole graph and check it against the leaking set.
  const staticLeakEdges = [];
  for (const key of keys) {
    const entry = manifest[key];
    const staticImports = entry.imports ?? [];
    for (const target of staticImports) {
      if (leakingKeys.includes(target)) {
        staticLeakEdges.push({ importer: key, target });
      }
    }
  }

  if (staticLeakEdges.length > 0) {
    console.error(
      "[checkBundleForHiddenTestLeak] FAILED — real hidden-test data is " +
        "reachable via a STATIC import in the production bundle:\n" +
        staticLeakEdges
          .map(({ importer, target }) => `  - ${importer}  --(static import)-->  ${target}`)
          .join("\n") +
        "\n\nThis means some frontend code now pulls hidden testcase data " +
        "eagerly into the bundle (Sept 2026 audit, finding D — this is " +
        "exactly what RelatedProblems.jsx used to do). Find the new static " +
        "import chain above and remove it. If the data genuinely needs to " +
        "be reachable client-side, it must be behind a *dynamic* import() " +
        "with its own security review — see eslint.config.js's ignores list."
    );
    process.exit(1);
  }

  console.log(
    `[checkBundleForHiddenTestLeak] OK — ${leakingKeys.length} chunk(s) contain ` +
      "hidden-test data (known, tracked, dynamic-import-only exposure — see " +
      "plans/014 Batch 5), but none are reachable via a static import. " +
      `Scanned ${keys.length} manifest entries.`
  );
}

main();

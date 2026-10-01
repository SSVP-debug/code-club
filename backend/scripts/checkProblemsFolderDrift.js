/**
 * checkProblemsFolderDrift.js
 *
 * DEPRECATED: the problem-bank source of truth is now
 * backend/problems/<slug>/*, not src/data/problems.js.
 *
 * The old implementation compared generated problem folders against the
 * legacy frontend catalog. That check is intentionally no longer used by CI
 * because it enforces the architecture we are migrating away from.
 *
 * Use these canonical checks instead:
 *   npm run validate:problem-folders
 *   npm run validate:problems
 *
 * This compatibility entrypoint remains temporarily so older local scripts
 * fail with a clear migration message rather than silently validating the
 * wrong source of truth.
 */

export function findDrift() {
  throw new Error(
    "checkProblemsFolderDrift.js is deprecated: backend/problems/* is now canonical. " +
      "Use validate:problem-folders and validate:problems instead."
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error(
    "checkProblemsFolderDrift.js is deprecated. Use `npm run validate:problem-folders` and `npm run validate:problems`."
  );
  process.exit(1);
}

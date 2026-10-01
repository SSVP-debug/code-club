# Plan 014 — Problem Architecture Remediation Action Plan

Source: `code-club-problem-architecture-audit.md` (Sept 2026 audit).

---

## Batch 1 — Hidden-test leak ✅ DONE

- [x] Remove the static frontend import of `src/data/problems.js` from related-problem rendering.
- [x] Add frontend import restrictions and bundle-graph regression checks.
- [x] Verify the problem workspace no longer carries hidden tests in the normal bundle path.

## Batch 2 — Execution-contract hardening ✅ DONE

- [x] Problem execution contracts and language registry validation are enforced.
- [x] Problem content versioning already exists through `Problem.contentVersion` and `Submission.problemVersion`.

## Batch 3 — Canonical authoring-folder promotion 🔄 IN PROGRESS

- [x] Split visible and hidden testcases into separate files.
- [x] Make `backend/scripts/seedProblems.js` delegate to the canonical folder importer.
- [x] Add Mongo-free folder validation with `importProblems.js --dry-run`.
- [x] Replace the CI folder-drift gate with canonical folder validation.
- [x] Add a generated public-safe frontend fallback from `backend/problems/<slug>/`.
- [x] Make `useProblems.js` load that fallback only when the API is unavailable/empty.
- [x] Add `loadProblemsFromFolders.js` as the shared backend reader for maintenance/audit scripts.
- [x] Move XP backfill and weekly-review topic lookup to the canonical folder loader.
- [x] Move the problem-bank structural audit to the canonical folder loader.
- [x] Add a canonical execution-contract validator and make `validate:problems` use it.
- [ ] One-time migrate `examples.json` and `constraints.json` into all 250 problem folders.
- [ ] Verify canonical folder validation passes with the completed metadata shape.
- [ ] Migrate/remove remaining legacy maintenance scripts that import `src/data/problems.js`.
- [ ] Remove/archive `src/data/problems.js` only after all consumers are gone.
- [ ] Remove obsolete folder-export/drift tooling after the one-time metadata migration is verified.
- [ ] Update documentation that still calls `src/data/problems.js` the source of truth.
- [ ] Add a permanent CI guard forbidding backend runtime/maintenance code from importing `src/data/problems.js`.

### Batch 3A — Fallback hardening ✅ DONE

The emergency frontend catalog is a generated artifact. It reads public problem content from the canonical folders and never reads hidden tests or editorial content.

### Batch 3B — Metadata completeness ⚠️ ACTIVE

The first folder migration preserved execution data but did not include the public `examples` and `constraints` fields. The folder contract has now been expanded with:

```text
examples.json
constraints.json
```

The shared exporter/importer/schema/loader/fallback have been updated. A one-time regeneration of all folders is still required before the new contract can be enforced.

## Batch 4 — Problem/testcase versioning 🟡 FOLLOW-UP

- [ ] Run `Problem.contentVersion.integration.test.js` on real CI/local infrastructure where MongoDB binary download is available.
- [ ] Decide whether submission/version drift should be surfaced in admin analytics.

## Batch 5 — Lower-priority cleanup

- [ ] Add a testcase-authoring checklist.
- [ ] Scope a `create-problem <slug>` scaffold command.
- [ ] Remove the legacy MongoDB `hiddentestcases` field after rollback safety is no longer needed.

## Deliberately not doing now

- [ ] Do not add stdin/stdout, SQL, or interactive problem types speculatively.
- [ ] Do not build randomized/generated testcase infrastructure without product demand.
- [ ] Do not redesign the language registry architecture.

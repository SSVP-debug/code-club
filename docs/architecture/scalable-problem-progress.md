# Scalable Problem Progress

## Purpose

Code Club historically keeps `User.solvedSlugs` as a denormalized compatibility field. That works for the current product, but it should not remain the primary per-problem store as the catalog and student base grow.

This phase introduces two bounded, indexed stores:

- `UserProblemProgress`: one document per user/problem pair.
- `ProblemStats`: one document per problem for submission/acceptance counters.

## Write path

A server-verified submission is still persisted in `Submission` first. After that write succeeds, the submission service updates both derived stores. Derived-write failures are logged without failing the already durable submission.

`PUT /api/progress` continues to dual-write the legacy `User` progress fields and synchronizes solved slugs into `UserProblemProgress`, preserving compatibility during migration.

## Read path

The problem catalog's acceptance-rate endpoint now reads `ProblemStats` rather than aggregating the complete `Submission` collection. Paginated catalog callers can request rates for only the visible problem slugs.

The existing `User.solvedSlugs` field remains available to legacy consumers during this phase. `UserProblemProgress` is the scalable source for future per-problem reads, filtering, and analytics.

## Migration

Run:

```bash
npm run backfill:problem-progress:dry-run
npm run backfill:problem-progress
```

The migration is idempotent and uses aggregation + batched `bulkWrite` operations. It reconstructs both stores from the immutable `Submission` history.

## Why this scales

- Per-user problem state is O(number of problems that user has attempted), not a single ever-growing user document.
- Acceptance reads are O(number of problem-stat documents requested), not O(total submission history).
- Unique/indexed `(userId, problemSlug)` lookups keep current-page progress queries bounded.
- `Submission` remains the audit/source-of-truth record rather than being replaced by derived counters.

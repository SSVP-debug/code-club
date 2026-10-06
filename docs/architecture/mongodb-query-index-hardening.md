# MongoDB Query & Index Hardening

## Scope

This pass audits the high-growth query paths after the catalog, progress, submission-history, leaderboard, and analytics scalability work.

## Findings and fixes

### Admin registration trends

`User` does not use Mongoose `createdAt` timestamps. Its canonical account creation field is `joinedDate`. Registration analytics now aggregate on `joinedDate`, and the rollout script ensures an index on `{ joinedDate: -1 }`.

### Submission time-window analytics

Submission trend, active-user, and retention queries filter by `createdAt`. The rollout script ensures `{ createdAt: 1 }` so these bounded time-window scans can use an index as submission history grows.

### Problem popularity

Problem popularity now reads `ProblemStats` instead of grouping the ever-growing `Submission` collection. The queries sort by `accepted` with `problemSlug` as a deterministic tie-breaker, so two compound indexes are ensured:

- `{ accepted: -1, problemSlug: 1 }`
- `{ accepted: 1, problemSlug: 1 }`

The existing unique `problemSlug` index remains the lookup index for problem-to-stats joins and point reads.

## Deliberate non-indexes

Not every filter benefits from another index. In particular, predicates using `$ne` (for example `visibility: { $ne: "contest" }`) are not treated as candidates for speculative indexes. Indexes are added only for stable, repeated query shapes where the leading fields match the filter/sort boundary.

The language-popularity aggregation remains a full aggregation because it groups the entire submission history by language; a simple index does not eliminate that grouping work. A future pre-aggregated language-stat counter can address that if this endpoint becomes hot enough to justify another derived-stat collection.

## Rollout

Run:

```bash
npm run ensure:indexes:analytics
```

The command uses named `createIndex` calls, so rerunning it is idempotent.

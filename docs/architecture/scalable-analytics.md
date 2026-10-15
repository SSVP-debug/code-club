# Scalable Analytics Queries

## Goal

Admin analytics must remain bounded as users and submissions grow. Reporting endpoints should not load an entire MongoDB collection into Node just to calculate a small recent chart.

## Trend queries

Registration and submission trends use MongoDB aggregation over the exact reporting window already defined by `timeBuckets.js`:

- daily: 30 days
- weekly: 12 rolling seven-day buckets
- monthly: 12 calendar months

The pipeline first matches `createdAt` to that bounded window and then groups by a bucket index using `$dateDiff`. The response is still filled with zero-count buckets so the API contract remains unchanged.

This replaces the previous `find().select("createdAt").lean()` approach, which transferred every historical timestamp to application memory.

## Problem popularity

Problem popularity previously grouped the ever-growing `Submission` collection by problem. `ProblemStats` already maintains per-problem accepted/attempt counters from server-verified submissions, so the analytics endpoint now reads those counters directly and only fetches metadata for the small ranked result set.

The catalog count and solved-catalog count remain visibility-aware, so `neverSolvedCount` does not include contest-only problems.

## Index rollout

Run:

```bash
npm run ensure:indexes:analytics
```

This idempotently creates:

- `User.createdAt`
- `Submission.createdAt`
- `ProblemStats.accepted`

The first two indexes support bounded reporting-window scans; the third supports both ascending and descending top/least popularity reads by reversing the same single-field index.

## Intentionally unchanged

Active-user and retention endpoints already constrain submissions to 7/30-day windows and use `distinct("userId")`. Language popularity still aggregates all submissions because there is no persisted language counter yet; that is a separate pre-aggregation phase rather than a reason to compromise the current analytics contract.

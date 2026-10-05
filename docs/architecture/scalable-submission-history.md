# Scalable Submission History

## Problem

Submission documents are the immutable audit trail, but history reads must not rely on `skip`/offset pagination or grow their response size with the number of submissions.

## Design

`GET /api/submissions` now supports optional cursor pagination:

```text
GET /api/submissions?limit=50
GET /api/submissions?limit=50&cursor=<opaque-cursor>
GET /api/submissions?problemSlug=two-sum&limit=50&cursor=<opaque-cursor>
```

Paginated responses use:

```json
{
  "submissions": [],
  "nextCursor": "...",
  "hasMore": true
}
```

The cursor contains only the last page's `createdAt` and `_id`, encoded as base64url. The query uses a keyset boundary:

```text
createdAt < cursor.createdAt
OR (createdAt == cursor.createdAt AND _id < cursor.id)
```

and sorts by `{ createdAt: -1, _id: -1 }`.

This gives stable traversal without `skip`, including when multiple submissions share the same millisecond timestamp.

## Compatibility

Existing callers that request `/api/submissions` without pagination parameters continue to receive the original array response. New callers opt into pagination with `limit` and/or `cursor`, so this phase does not require a coordinated frontend migration.

`src/services/submissionService.js` exposes pagination options while preserving its existing default behavior.

## Indexing

`Submission` retains the existing `{ userId: 1, createdAt: -1 }` index and adds `{ userId: 1, createdAt: -1, _id: -1 }` for deterministic keyset pagination.

## Safety

- Cursor input is validated before it reaches MongoDB.
- `limit` is bounded to 1–100.
- The query is always scoped to the authenticated user's `userId`.
- `problemSlug` remains an optional server-side filter.
- The API still returns only the existing client-safe submission projection; submitted source code is never exposed by the history endpoint.

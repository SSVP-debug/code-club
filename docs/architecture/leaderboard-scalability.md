# Leaderboard scalability

## PR #50

The previous leaderboard computed `solvedCount` for every public user before sorting and then kept only the top 500 rows. Cache misses therefore scaled with the whole public-user collection.

The new read path:

1. uses `totalXP` as the indexed primary ordering;
2. materializes only the requested candidate window (up to 500 globally / 100 per college);
3. computes `solvedCount` only for those candidates;
4. uses `solvedCount` as a tie-breaker after XP;
5. projects only leaderboard fields;
6. caches each global page independently;
7. reports the real public-user count separately from the capped ranked window.

College leaderboards use the persisted `emailDomain` field instead of a regex against the full email address. The domains endpoint uses a Mongo aggregation and cache instead of loading all public-user emails into Node.js.

## Index rollout

Run:

```bash
npm run ensure:indexes:leaderboard
```

This creates the idempotent indexes `leaderboard_global_public_xp` and `leaderboard_college_domain_public_xp`.

The application intentionally keeps the global and college ranked windows bounded. `total`, `capped`, and `hasNext` make that boundary explicit to API consumers rather than silently pretending the endpoint contains an unbounded ranking.

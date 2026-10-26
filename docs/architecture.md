# Architecture

## System overview

```
                              ┌──────────────────────────┐
                              │        Browser            │
                              │  React 19 SPA (PWA)        │
                              └─────────────┬──────────────┘
                                            │ HTTPS
                    ┌───────────────────────┼────────────────────────┐
                    │                       │                        │
                    ▼                       ▼                        ▼
          ┌──────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
          │  Firebase Auth    │    │  Vercel           │    │  Backend host         │
          │  (Google sign-in) │    │  (static hosting, │    │  Node.js + Express     │
          │  issues ID tokens │    │  serves the SPA)  │    │  backend API           │
          └──────────────────┘    └──────────────────┘    └───────────┬─────────────┘
                                                                        │
                    ┌───────────────────────┬───────────────────────────┼───────────────────────┐
                    ▼                       ▼                           ▼                        ▼
          ┌──────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
          │ Firebase Admin    │   │ MongoDB Atlas          │   │ Judge0                 │   │ Redis (optional)  │
          │ SDK — verifies    │   │ via Mongoose — sole    │   │ self-hosted (Docker)   │   │ Render add-on or │
          │ ID tokens on      │   │ datastore (Firestore   │   │ or RapidAPI — sandboxed │   │ Upstash — shared  │
          │ every protected   │   │ was fully migrated     │   │ code execution          │   │ cache across       │
          │ request           │   │ away from)             │   └──────────────────────┘   │ instances; falls  │
          └──────────────────┘   └──────────────────────┘                                  │ back to per-       │
                                                                                             │ instance in-memory │
                                                                                             │ cache if unset     │
                                                                                             └──────────────────┘

Also called from the backend, not shown above for clarity:
  - Anthropic Claude API — AI hints, dashboard insights, interview mode
  - Razorpay — payment processing (billing routes; feature-flagged off)
  - Sentry — error monitoring (no-op if SENTRY_DSN unset)
```

## Request lifecycle

1. Browser loads the React SPA from Vercel (static build output of `vite build`).
2. User signs in via Firebase Auth (Google provider). Firebase issues a short-lived ID token, refreshed client-side automatically.
3. Every authenticated API call from the SPA attaches that ID token as a `Bearer` header. `backend/middleware/auth.js` (`requireAuth`) verifies it against Firebase Admin SDK, then loads/creates the matching MongoDB `User` document and attaches it to `req.userDoc` for the rest of the request. The user lookup itself is short-TTL cached in-process (`backend/utils/userAuthCache.js`, default 5s) rather than hitting Mongo on every call — a cache HIT hands back the live Mongoose document (safe for routes that mutate `req.userDoc` and `.save()` it), and staleness across backend replicas is bounded by the TTL, same tradeoff as the Redis leaderboard/profile caches.
4. The route handler runs, touching MongoDB (via Mongoose), Redis (if configured), Judge0 (for `/api/compiler` and `/api/judge`), or the Claude API (for `/api/hints`, `/api/insights`, `/api/interview`) as needed.
5. Response returns as JSON. Every request/response is logged through Pino (`config/logger.js` + `httpLogger` middleware), tagged with `userId`, `route`, and `responseTime`.

## Service boundaries

| Concern | Owner | Notes |
|---|---|---|
| Identity | Firebase Auth + Firebase Admin SDK | Backend never issues its own sessions/JWTs — it only verifies Firebase-issued tokens per request. |
| Persistence | MongoDB Atlas (Mongoose) | Sole database. Firestore was used early on and has been fully migrated away from — no Firestore reads/writes remain in the backend. |
| Code execution | Judge0 (self-hosted Docker or RapidAPI) | Fully decoupled behind `fetchJudge0()` in `backend/controllers/compilerController.js` — the call site doesn't know or care which Judge0 deployment it's talking to. See `docs/judge0-setup.md`. |
| Caching | Redis (`ioredis`) with automatic in-memory fallback | Used for `/api/problems`, `/api/leaderboard`, `/api/public/:username`. A single backend instance runs fine on the in-memory fallback; Redis becomes necessary once you scale to multiple backend instances that need to agree on cached data. |
| AI features | Anthropic Claude API | Hint system (`/api/hints`), dashboard insights (`/api/insights`), interview mode (`/api/interview`), and the weekly review email script all call Claude directly from the backend — never from the browser, so the API key never reaches the client. |
| Email | Resend | Weekly AI review email only (`scripts/sendWeeklyReviewEmails.js`, run via the configured cron scheduler, not an HTTP route). No-op if `RESEND_API_KEY` is unset. See `docs/weekly-review-email-setup.md`. |
| Payments | Razorpay | Behind the `MONETIZATION_ENABLED` feature flag (default `false`) — fully built, invisible to users until flipped on. |
| Logging | Pino | Structured JSON logs with `userId`/`route`/`responseTime` on every request via `httpLogger`. A subset of Phase 5–7 route files still use `console.*` directly rather than the shared logger — tracked as a follow-up, not a correctness issue. |
| Error monitoring | Sentry | No-op if `SENTRY_DSN` is unset — never blocks startup or crashes the process on a missing/invalid DSN. |

## Feature flags

Two boolean flags in `backend/config/featureFlags.js`, both read from env vars and default to `false`:

- **`MONETIZATION_ENABLED`** — gates the entire billing/paywall system. Everyone is treated as premium while it's `false`. Flipping it on requires no redeploy of code, just the env var + Razorpay keys.
- **`B2B_ENABLED`** — gates TPO (Training & Placement Officer) college-admin features independently of consumer billing, so a college pilot can go live before individual subscriptions do.

This pattern — build the full feature, gate it behind a flag, ship code before the business decision to turn it on — is used consistently across Phase 6–8 rather than maintaining long-lived feature branches.

## XP integrity

XP is always computed server-side from `solvedSlugs.length × difficulty weight` at read time — it is never trusted from the client, and the client never sends a `totalXP` value that the backend acts on. This is the single most load-bearing invariant in the codebase: every leaderboard, dashboard stat, and certification claim ultimately derives from `solvedSlugs`, not from a mutable stored counter.

## Known architectural gaps (as of Phase 8 / Batch E)

Two items previously listed here are resolved — see `docs/phase8-progress.md` for the full log:

- ~~Razorpay webhook body parsing~~ — resolved. `backend/routes/billingWebhook.js` handles this separately, mounted ahead of the global `express.json()` with `express.raw()` (`backend/server.js:103-107`).
- ~~`User` model has no `subscription` field~~ — resolved. `backend/models/User.js` now defines a `subscription` subdocument. See `docs/database-schema.md`.

Still open:

- **RapidAPI headers for Judge0** aren't wired up yet — see `docs/judge0-setup.md`.
# Database Schema

MongoDB Atlas via Mongoose is the **sole** datastore. Code Club used Firestore
early on; it has been fully migrated away from — there are no remaining
Firestore reads or writes anywhere in the backend. (A stray comment in
`server.js` still says "all Firestore routes" — that's leftover text from the
migration, not a real dependency; ignore it.)

Seven models, in `backend/models/`:

---

## `User`

The largest and most central model — one document per person, regardless of role (`student`, `recruiter`, `tpo`, `admin`).

| Field | Type | Notes |
|---|---|---|
| `firebaseUid` | String, required, unique, indexed | Links to Firebase Auth. Source of truth for identity. |
| `email` | String | Lowercased, trimmed. |
| `displayName` | String | |
| `username` | String, unique, sparse | Used in public profile URLs (`/api/public/u/:username`). |
| `isProfilePublic` | Boolean, default `true` | |
| `leetcodeUsername` | String | Predates the LeetCode-import feature; kept for backwards compatibility. |
| `leetcodeStats` | `{ easySolved, mediumSolved, hardSolved, totalSolved, source: "manual"\|"api", lastSyncedAt }` | Populated manually or via `/api/leetcode/fetch`. **Not** fed into `totalXP`/`solvedSlugs` — LeetCode problems aren't part of Code Club's own catalog. |
| `joinedDate` | Date, default now | |
| `solvedSlugs` | `[String]` | **The single source of truth for XP.** Every derived stat (leaderboard rank, dashboard XP, certification eligibility) is computed from this array's length × difficulty weight at read time — never stored as a mutable counter the client can influence. |
| `topicStats` | Map<String, Number> | Solve count per topic (e.g. "Dynamic Programming" → 12). |
| `activityDates` | `[String]` | Used for streak + heatmap calculation. |
| `solvedDifficulty` | `{ easy, medium, hard }` (Numbers) | |
| `currentStreak`, `longestStreak` | Number | |
| `totalXP` | Number | **Computed server-side, never trusted from the client.** |
| `recentActivity` | `[{ title, slug, difficulty, time }]` | |
| `role` | String enum: `student`, `recruiter`, `tpo`, `admin`; indexed | Default `student`. |
| `recruiterProfile` | `{ companyName, designation, companyDomain, verified, verifiedAt }` | Only meaningful when `role === "recruiter"`. |
| `collegeDomain`, `collegeName` | String | Only meaningful when `role === "tpo"` — set via `/api/tpo/register`, matched against student emails for `/api/tpo/students` and `/api/tpo/dashboard`. |
| `profileSignature` | `{ hash, signedAt, solvedCount }` | HMAC-SHA256 proving profile data wasn't tampered with; recruiters verify against this at `/api/recruiter/verify/:username`. |
| `certificates` | `[{ trackId, trackName, issuedAt, verifyCode }]` | |
| `referralCode` | String, unique, sparse | |
| `referredBy` | String | Another user's `referralCode`. |
| `referralRewardDays` | Number, default 0 | |
| `dailyChallengeHistory` | `[{ date, slug }]` | |
| `emailPreferences.weeklyReview` | Boolean, default `true` | Opt-out (not opt-in) — existing users who predate this field are treated as opted-in. Read/write via `GET`/`PATCH /api/users/me`. |
| `lastWeeklyReviewSentAt` | Date | Set by `scripts/sendWeeklyReviewEmails.js` after a successful send — a double-send guard, not a scheduler. |

### `subscription` field

`backend/models/User.js` defines a `subscription` subdocument, read and written by `backend/routes/billing.js` in `/subscription`, `/verify`, and `/cancel`:

```js
subscription: {
  plan:        { type: String, default: "free" },
  status:      { type: String, enum: ["none", "active", "cancelled", "expired"], default: "none" },
  startedAt:   { type: Date, default: null },
  expiresAt:   { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
},
```

This previously didn't exist (a payment verification would report success but silently fail to persist) — see `docs/phase8-progress.md` for when it was resolved. A separate, intentional `UserSubscription`-model sync step remains in progress per `docs/migrations/user-model-split.md`; that's a planned migration step, not a data-loss bug.

---

## `Submission`

One document per code submission (both `/api/judge/submit` and the legacy `/api/submissions` POST path write here).

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId, ref `User`, required | |
| `problemSlug` | String, required, trimmed | |
| `problemTitle` | String | Denormalized for display without a join. |
| `language` | String enum: `javascript`, `python`, `java`, `cpp` | |
| `status` | String enum — see `SUBMISSION_STATUSES` export: `Accepted`, `Wrong Answer`, `Compilation Error`, `Runtime Error`, `Time Limit Exceeded`, `Judge Error` | The emoji-suffixed display strings shown in the UI are derived from these exact values — don't rename them without updating the frontend mapping. |
| `statusDescription` | String | Raw Judge0 status text. |
| `passed`, `total`, `visiblePassed`, `hiddenPassed` | Number | Test case counts. |
| `executionTime`, `judge0Time` | String | |
| `memory` | Number, default 0 | KB, from Judge0. |
| `actualOutput` | String | |
| `code` | String | The submitted source. |

---

## `Problem`

The problem catalog.

| Field | Type | Notes |
|---|---|---|
| `id` | Number | |
| `title`, `slug` | String | `slug` is the primary lookup key used throughout the API. |
| `functionName` | String | Used by `generateDriverCode` to scaffold the starter function signature. |
| `difficulty` | String enum: `Easy`, `Medium`, `Hard` | |
| `topic`, `pattern` | String | |
| `sourceType` | String enum: `core`, `variant`, `original` | |
| `description` | String | |
| `examples` | `[{ input, output, explanation }]` | |
| `constraints` | `[String]` | |
| `starterCode` | `{ python, javascript, java, cpp }` | Per-language starter templates. |
| `testcases` | `[{ input: Mixed, expectedOutput: Mixed }]` | Visible test cases (shown to the user, used by `/api/judge/run`). |
| `hiddentestcases` | Same shape | Hidden — only used by `/api/judge/submit`, never sent to the client. |
| `estimatedTime` | String | |
| `companies` | `[String]` | |
| `relatedProblems` | — | Cross-links for the "related problems" UI. |

---

## `Contest`

| Field | Type | Notes |
|---|---|---|
| `title`, `description` | String | |
| `type` | String enum: `public`, `private` | |
| `status` | String enum: `upcoming`, `active`, `ended` | |
| `createdBy` | ObjectId, ref `User`, required | |
| `inviteCode` | String, sparse | Only set for `type: "private"`. |
| `collegeDomain` | String | Scopes a private contest to one college. |
| `startsAt`, `endsAt` | Date, required | |
| `durationMs` | Number | Auto-computed from start/end. |
| `problemSlugs` | `[String]` | |
| `participants` | `[{ userId, username, displayName, solvedSlugs[], score, rank, joinedAt }]` | Embedded, not a separate collection — fine at contest scale (hundreds, not millions, of participants per contest). |

Indexed on `{ status: 1, startsAt: 1 }` for the "upcoming/active contests" list query.

---

## `Assignment`

TPO-created problem sets for a college (`B2B_ENABLED` feature).

| Field | Type | Notes |
|---|---|---|
| `tpoId` | ObjectId, ref `User`, required | |
| `collegeDomain` | String, required, indexed | |
| `title` | String, required | |
| `problemSlugs` | `[String]`, required | |
| `dueDate` | Date, required | |
| `createdAt` | Date, default now | |

Completion percentage is computed at read time in `/api/tpo/assignments` by cross-referencing each matching student's `solvedSlugs` — not stored.

---

## `Ambassador`

Campus ambassador program applications.

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId, ref `User` | |
| `collegeName`, `collegeDomain` | String, required, trimmed | |
| `motivation` | String, max 1000 chars | |
| `status` | String enum: `pending`, `approved`, `rejected`; default `pending` | |
| `appliedAt` | Date, default now | |
| `reviewedAt` | Date | |
| `reviewedBy` | ObjectId, ref `User` | The admin who reviewed it. |
| `rejectionReason` | String | |
| `milestonesClaimed` | `[String]` | |

---

## `SkillsTest`

Recruiter-assigned timed skills tests for candidates.

| Field | Type | Notes |
|---|---|---|
| `recruiterId` | ObjectId, ref `User`, required | |
| `recruiterCompany` | String | |
| `candidateId` | ObjectId, ref `User`, required | |
| `candidateUsername` | String, required | Denormalized. |
| `problemSlugs` | `[String]`, required | |
| `durationMs` | Number, default 90 min | |
| `note` | String | |
| `status` | String enum: `pending`, `in_progress`, `submitted`, `expired`; default `pending` | |
| `startedAt`, `expiresAt`, `submittedAt` | Date | |
| `solvedSlugs` | `[String]` | |
| `score` | Number | |

---

## Not modeled as MongoDB collections (in-memory)

- **Interview Mode sessions** (`backend/routes/interview.js`) are stored in a plain in-process `Map`, not MongoDB — acceptable for MVP-scale, low-volume usage per the file's own comment. They don't survive a backend restart, and won't be consistent across multiple Railway instances if you scale horizontally before this is moved to Redis or Mongo.

### `College.subscription` (TPO-6)

Institution billing state belongs to the College rather than an individual TPO account. This preserves entitlement when the primary TPO changes.

| Field | Type | Notes |
|---|---|---|
| `plan` | String | `none`, `pilot`, `college_monthly`, `college_yearly`, `enterprise` |
| `status` | String | `none`, `trialing`, `active`, `cancelled`, `expired` |
| `startedAt`, `expiresAt`, `cancelledAt` | Date | Lifecycle timestamps; cancellation does not erase paid expiry. |
| `provider` | String | `manual`, `razorpay`, or `stripe` |
| `providerCustomerId`, `providerSubscriptionId` | String | Provider references; never expose these through TPO status responses. |
| `lastPaymentAt` | Date | Last successful payment timestamp. |


TPO-6 Batch 2 additionally persists `providerOrderId` and `providerPaymentId` on `College.subscription`. These provider identifiers are internal payment reconciliation fields and are not returned by the TPO billing-status API.

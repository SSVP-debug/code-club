# Daily Quiz and Dashboard Startup Audit

**Date:** 2026-10-29  
**Repository:** SSVP-debug/code-club  
**Scope:** Landing CTA → authentication/portal → daily question → dashboard hydration and routes.

## Executive verdict

The existing gate is not aligned with the intended UX. The intended behavior is one local question on the first authenticated student dashboard entry of each IST calendar day; it must not block data fetching, turn other protected routes into quiz gates, or make users wait for a completion request before navigating.

This audit is based on source inspection of the repository's main branch. No code behavior was executed in a browser or local test run during this audit, so latency attribution remains a code-based diagnosis, not a measured performance profile.

## Confirmed findings

### P0 — Five-question flow differs from product decision

- `src/components/onboarding/DailyQuickQuiz.jsx` defines `QUESTION_COUNT = 5`.
- Each question waits for a 900 ms feedback timer.
- The five-question flow then displays a result and review screen, requiring a separate “Continue to Dashboard” action.
- `src/utils/quizEngine.js` selects random questions from the local bundled question bank; the selection/scoring itself does not require an API.
- Existing tests explicitly expect five questions, so changing to one must update component and engine tests.

### P0 — The quiz gate blocks every authenticated protected route

- `src/components/ProtectedRoute.jsx` wraps every authenticated protected page in `DailyQuizGate`.
- This affects paths beyond `/dashboard`, including problems, analytics, profile, club, recruiter/TPO-related protected routes, settings and other pages using `ProtectedRoute`.
- Product requirement is narrower: show the check-in on the first dashboard entry of the day, not force it before every protected destination.
- Guest portal access and unauthenticated redirect behavior must be preserved.

### P0 — Quiz visibility waits on backend initialization and status

- `src/context/appContext.jsx` hydrates using authenticated `GET /api/init` and changes `isBackendReady` after the request settles.
- `src/context/DailyQuizProvider.jsx` waits for authenticated user, backend readiness and role resolution before issuing `GET /api/daily-quiz/status`.
- `src/routes/DailyQuizGate.jsx` displays a full-screen spinner while either `isBackendReady` is false or quiz status is loading.
- Thus the local question bank is not the reason the quiz must wait; the surrounding gate and status/hydration sequencing make it wait.

### P1 — Dashboard code is lazily loaded without an explicit prefetch in App.jsx

- `src/App.jsx` uses `lazy(() => import("./pages/Dashboard"))`.
- No explicit Dashboard dynamic-import prefetch is present in the inspected route setup.
- Prefetch the dashboard chunk when intent to navigate is known (e.g. authenticated CTA hover/focus/click, or when the daily check-in starts) and dedupe concurrent imports. Do not eagerly load the large Monaco/problem-editor chunk.

### P1 — There is already an early warm-up request

- `src/App.jsx` calls `warmBackend()` at app mount.
- `src/services/api.js` sends fire-and-forget `GET /api/health`.
- This helps start the backend wake-up earlier, but it does not hydrate authenticated dashboard data or mean that `/api/init` is ready.
- Retain the warm-up; independently start authenticated hydration as soon as Firebase reports a real user. Do not gate quiz rendering on the warm-up.

### P1 — Current quiz completion waits for server persistence

- `src/context/DailyQuizProvider.jsx` calls `completeDailyQuiz()` and only then changes status to unlocked.
- The visible gate's completion callback is server-backed and errors keep the user locked.
- This is inappropriate for a lightweight bridge UX. A submission should record the day in the background and never hold dashboard navigation hostage. Whether to persist completion before or after navigation must preserve once-per-day behavior and retry semantics.

### P1 — Multiple historical/alternative implementations remain

- `src/routes/DailyQuizGuard.jsx` duplicates quiz gate behavior but is not the implementation imported by current `ProtectedRoute.jsx`.
- `src/routes/OnboardingGate.jsx`, `src/components/onboarding/OnboardingContainer.jsx`, `DailyMission.jsx`, `TodaysFocus.jsx`, `WorkspacePreparationScreen.jsx`, and `dailyQuizStorage.js` represent old/onboarding flows and/or are documented as unused in the active path.
- Avoid wiring these old flows back into the app. Remove unused duplicate gate code only after repository-wide reference search and tests confirm it is safe.

### P1 — Current tests codify the old mandatory five-question behavior

Key test files:
- `src/components/onboarding/DailyQuickQuiz.test.jsx`
- `src/utils/quizEngine.test.js`
- `src/routes/DailyQuizGate.test.jsx`
- `src/context/DailyQuizProvider.test.jsx`
- `src/components/ProtectedRoute.test.jsx`
- `backend/controllers/dailyQuizController.test.js`
- `backend/models/User.dailyQuizCompletedDate.integration.test.js`

Update expectations to one question and a short feedback/explanation. Preserve server IST date semantics and Mongo persistence tests. Add tests for the new dashboard-only check-in and non-blocking behavior.

## Intended UX contract

1. Apply to authenticated student users only. Preserve role-specific routing for admin, recruiter and TPO. Preserve guest portal behavior.
2. Show at most one local multiple-choice question on the first Dashboard entry per IST calendar day.
3. Do not make question content depend on network, Firebase token retrieval, MongoDB or API status.
4. On selecting an option, immediately show correct/incorrect feedback and a concise explanation. Offer a clear “Continue to dashboard” action; do not add an extra result page.
5. The user must never be forced to wait for the question, answer, explanation, or completion POST before dashboard data loading starts.
6. Allow bypass/skip for users who want the dashboard immediately. Skipping should still mark the check-in as seen for that day only if product policy explicitly considers skipping completed; recommended policy is not to count a skip as a correct answer, and still mark the gate dismissed for that day to avoid coercion. Track answered vs skipped separately if analytics are needed.
7. Persist completion/dismissal per authenticated user on the server using the existing IST day key, with client-side per-user/day memoization as an optimization only. Server remains authoritative after a status check completes; client cache must not be used as a security boundary.
8. The daily check-in must not appear on every protected route. It belongs to first Dashboard entry only.
9. Begin `/api/init` as soon as the Firebase-authenticated user is known; reuse/in-flight-dedupe it so routing and dashboard do not create duplicated boot calls.
10. Prefetch the Dashboard JS chunk separately from API hydration. Keep the initial landing bundle small and avoid preloading Monaco.
11. Dashboard route should mount immediately after the gate is answered/skipped (or immediately when no check-in is due), render its existing skeleton while data is unavailable, and display the existing recoverable hydration error UI on failures.
12. Measure actual startup timings with performance marks and the browser Network waterfall; do not infer that Render cold start is the only cause.

## Recommended implementation phases

### Phase A — Change the product behavior
- Reduce the quiz to one question.
- Remove the multi-question progression, score summary and answer-review screen from this daily bridge flow; preserve reusable components if used elsewhere.
- Add one-tap answer feedback and explanation, with no artificial delay.
- Place the check-in on the dashboard-entry path only; remove the gate from generic `ProtectedRoute`.

### Phase B — Separate UX from backend
- Start `/api/init` hydration in parallel with the question and never await it from the quiz component.
- Allow dashboard navigation without waiting for the completion POST; send the completion/dismissal persistence request in the background with idempotent handling.
- Keep backend IST-day persistence. Reconcile in-flight status and completion requests without race conditions.
- Preserve auth and role routing correctness.

### Phase C — Reduce route/bundle latency
- Add a named, deduplicated Dashboard preloader for the lazy chunk.
- Trigger preloading before the user navigates (intent) and in parallel with the check-in.
- Retain `warmBackend()`; do not make it a hard dependency.

### Phase D — Tests and measurement
- Update quiz-engine and component tests for a single question.
- Test first dashboard entry / rest of day / next IST day / refresh / second tab / skip / post failure / slow `/api/init` / guest / admin / recruiter / TPO / direct deep links.
- Test that non-dashboard routes do not show the check-in.
- Test the Dashboard JS preload is deduplicated and the check-in renders without waiting for `/api/init` or quiz-status network responses where cached day state can be safely used.
- Run frontend targeted tests, backend daily-quiz unit and Mongo integration tests, full frontend tests, build and lint.
- Validate with DevTools Network throttling and production timings.

## Acceptance criteria

- For a due student, question UI appears without waiting for authenticated `/api/init` or a dedicated quiz-status request when local day state can be used for an optimistic display.
- Exactly one question is shown, with immediate answer feedback and explanation.
- User can continue immediately; a slow/failing completion request never blocks dashboard access.
- Dashboard chunk prefetch begins before navigation and the lazy import is deduplicated.
- Dashboard data loads in parallel and existing skeleton/error states work.
- No quiz appears on Problems/Profile/Analytics/Club/recruiter/TPO pages just because the day changed.
- Once-per-IST-day state survives refresh and is consistent across tabs/devices after server reconciliation.
- Auth redirects, guest portal access, role redirects, and admin exemptions remain intact.
- Test and build results are reported honestly; no claim of validation without actually running the relevant checks.

## Important implementation note

The intended behavior relaxes the existing “fail closed and block all protected routes until server status/completion is confirmed” design. That is a product-level change, not merely a CSS/loading tweak. Do not retain that old behavior under a new component name; implement the dashboard-only daily check-in explicitly and document the persistence trade-off.

# Weekly Review Email Setup

Commit 097 — sends each active student a short AI-generated review of their
past week (problems solved, streak, topics, one concrete recommendation) via
email. Runs as a standalone script, not an HTTP route — it's meant to be
triggered on a schedule, not by a request.

## 1. Resend account + API key

1. Sign up at [resend.com](https://resend.com).
2. Verify a sending domain (Resend → Domains → Add Domain, then add the DNS
   records it gives you). You can send from `onboarding@resend.dev` without
   this for testing, but real sends to Gmail/Outlook are far more likely to
   land in spam from an unverified domain — verify your own domain before
   sending to real students.
3. Resend → API Keys → create one, then set in `backend/.env`:

   ```
   RESEND_API_KEY=re_your_key_here
   RESEND_FROM_EMAIL=Code Club <reviews@yourdomain.com>
   ```

   Leave both blank to disable the feature entirely — the script logs a
   warning and exits cleanly rather than failing.

## 2. Try it locally first

```bash
cd backend
npm run weekly-review:dry-run
```

This connects to MongoDB, computes what each eligible user's email *would*
say (including the real Claude-generated review text), and logs it —
without calling Resend or writing anything back to the database. Read the
output before ever running the real command.

```bash
npm run weekly-review
```

Sends for real, and records `lastWeeklyReviewSentAt` on each user who
received one.

## 3. Who gets emailed

- Users who solved **at least one problem in the last 7 days**. No activity
  → no email. This is deliberate — an AI "review" of a week with nothing to
  review is either empty filler or feels like a nag, neither of which is
  the goal.
- Users with `emailPreferences.weeklyReview` not explicitly set to `false`.
  This defaults to `true` (opt-out, not opt-in) for every user, including
  existing ones who predate this field. There's no frontend settings toggle
  for this yet — `PATCH /api/users/me` already accepts
  `{ emailPreferences: { weeklyReview: false } }` and persists it correctly,
  but wiring an actual switch into the Profile page's settings section is a
  small follow-up, not done as part of 097.
- A user who already got one in the last 5 days is skipped, as a guard
  against double-sending if the cron schedule ever fires twice in the same
  window — this is a safety net, not a real scheduling mechanism.

## 4. Scheduling the job

Run the script with a scheduler that can execute commands from this repository.
The backend's Render Web Service does not automatically run this script on a
schedule. If your Render plan supports a Cron Job service, configure one
separately; otherwise use another trusted scheduler.

Recommended command and settings:

1. Use the same repository and set the working/root directory to `backend`.
2. Start command: `npm run weekly-review`.
3. Example schedule: `0 9 * * 1` (every Monday at 09:00 UTC; adjust to the
   timezone that works for your students).
4. Configure the required environment variables separately in the scheduled
   job: `MONGODB_URI`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
   `RESEND_FROM_EMAIL`, and `FRONTEND_URL`. Do not assume they are inherited
   from the Render Web Service.
5. Run `npm run weekly-review:dry-run` first and inspect the logs before
   enabling real email sends.

Check your hosting provider's current pricing and cron-job availability before
creating a scheduled service. Never commit production secrets to the repository.

## 5. Cost awareness

Each email sent makes one Claude API call (same model as
`insightsController.js`, ~300 max output tokens) plus one Resend send. For
a few hundred active weekly users this is inexpensive, but it does scale
linearly with your active user count — there's no batching or caching of
the AI review text, since each one is meant to be genuinely personal to
that student's week.
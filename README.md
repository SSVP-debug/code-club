# Code Club

A LeetCode-style DSA (Data Structures & Algorithms) practice platform built for Indian engineering students preparing for placement season. Write code, run it instantly, submit against hidden test cases, track progress, and build a recruiter-ready public profile.

**Live:** [code-club-one.vercel.app](https://code-club-one.vercel.app)

---

## Features

- **Monaco Editor** - VS Code-quality editor with syntax highlighting for Python, JavaScript, Java, C++, C, and TypeScript
- **Live code execution** - runs code via Judge0 (self-hosted or RapidAPI) with custom stdin support
- **Judge system** - submits against visible + hidden test cases, returns Accepted / Wrong Answer / Runtime Error / Compilation Error / Time Limit Exceeded
- **250+ curated problems** - Easy through Hard, across Arrays, Two Pointers, Sliding Window, Hash Maps, Binary Search, Dynamic Programming, Bit Manipulation, Greedy, Stacks, Strings, Linked Lists, Trees, Graphs, Heaps, Backtracking, Tries, and more
- **Progress tracking** - solved problems, activity streak, difficulty breakdown, topic-level stats — all computed server-side from `solvedSlugs`, never trusted from the client
- **Firebase Auth** - Google sign-in with persistent sessions
- **Contests** - public and private/invite-only, live leaderboards
- **Certifications** - topic-track completion certificates with QR-verifiable public codes
- **Recruiter portal** - candidate search, signature-verified public profiles, timed skills tests
- **TPO (college admin) dashboard** — class-wide stats, placement-readiness score, problem-set assignments — feature-flagged (`B2B_ENABLED`)
- **Premium features** - AI-powered mock interview mode, billing via Razorpay — feature-flagged (`MONETIZATION_ENABLED`)
- **AI coaching** - Claude-powered hints and dashboard insights
- **Weekly AI review email** - automated, personalized weekly progress email via Resend (opt-out per user)
- **Installable PWA** - offline problem *reading* (not solving), works on mobile
- **Recruiter-ready exports** - profile PDF and certification PDFs with QR codes

See `docs/architecture.md` for the full system diagram and `docs/api-contracts.md` for every endpoint.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TailwindCSS 4, React Router v7 |
| Code editor | Monaco Editor (`@monaco-editor/react`) |
| Auth | Firebase Authentication (Google) |
| Database | MongoDB Atlas via Mongoose — sole datastore (fully migrated off Firestore) |
| Backend | Node.js, Express 5 (ES modules) |
| Code execution | Judge0 — self-hosted (Docker) or RapidAPI, see `docs/judge0-setup.md` |
| Caching | Redis (`ioredis`) with automatic in-memory fallback if unset |
| Logging | Pino, structured JSON with `userId`/`route`/`responseTime` |
| AI | Anthropic Claude API — hints, insights, mock interviews |
| Payments | Razorpay (feature-flagged off by default) |
| Error monitoring | Sentry (no-op if unconfigured) |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Project Structure

```
code-club/
├── src/
│   ├── context/          # AuthContext, AppContext
│   ├── firebase/         # Firebase init (auth export)
│   ├── hooks/            # useProblems, useRunCode, useTimer, useDashboardData, usePanelResize...
│   ├── pages/            # Dashboard, ProblemsPage, ProblemDetailsPage, Profile, Contests, Pricing,
│   │                      # TpoDashboard, RecruiterDashboard, InterviewMode, Certifications...
│   ├── components/       # ProtectedRoute, ProblemEditor, ProblemResults, SubmissionHistory...
│   ├── services/         # api.js, compiler.js, judgeService.js, progressService.js...
│   ├── utils/            # generateDriverCode, parseJudge0Result, editorStorage, formatters
│   └── data/             # problems.js (250+ problems, seeded into MongoDB)
├── backend/
│   ├── config/           # db.js, env.js, firebaseAdmin.js, judge0.js, logger.js, featureFlags.js
│   ├── middleware/        # auth.js (requireAuth), roleGuard.js, rateLimiter.js, premiumGate.js
│   ├── models/            # User, Submission, Problem, Contest, Assignment, Ambassador, SkillsTest
│   ├── routes/            # see docs/api-contracts.md for the full list
│   └── scripts/           # seedProblems.js, backfillXP.js
├── docs/                 # architecture.md, api-contracts.md, database-schema.md, judge0-setup.md
├── .github/
│   └── workflows/        # ci.yml
├── public/               # manifest.webmanifest, sw.js, icons — PWA assets
└── vercel.json
```

---

## Local Development

### Prerequisites

- Node.js 20+
- A Firebase project (Auth enabled — Google provider)
- MongoDB Atlas cluster (or local MongoDB)
- Judge0 access — public `ce.judge0.com` works for dev; see `docs/judge0-setup.md` for production options
- (Optional) Redis, Anthropic API key, Razorpay keys, Sentry DSN — the app runs fine without any of these, with clearly-logged fallback behavior

### 1. Clone and install

```bash
git clone https://github.com/SSVP-debug/code-club.git
cd code-club

# Frontend dependencies
npm install

# Backend dependencies
cd backend && npm install
```

### 2. Environment variables

**Frontend** — copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your Firebase web app config and `VITE_API_URL` (default `http://localhost:5000` for local dev).

**Backend** — copy `backend/.env.example` to `backend/.env`:

```bash
cd backend && cp .env.example .env
```

At minimum for local dev, fill in:
- `MONGODB_URI` — from MongoDB Atlas → Connect → Drivers
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — from Firebase Console → Project Settings → Service Accounts → Generate new private key (the private key must keep its literal `\n` line breaks)

Everything else in `backend/.env.example` (Redis, Sentry, Anthropic, Razorpay, Judge0 overrides) is optional for local dev — each one degrades gracefully and logs a clear warning when unset, rather than crashing the server.

### 3. Run locally

```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — Backend
cd backend && npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:5000

### 4. Seed problems (first time only)

```bash
cd backend
node scripts/seedProblems.js
```

Seeds all 250+ problems from `src/data/problems.js` into MongoDB. Upserts on `slug`, so it's safe to re-run.

---

## Deployment

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) and connect your GitHub repo
2. Framework preset: **Vite** (auto-detected)
3. Root directory: `.` (project root)
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add all `VITE_*` environment variables
7. Set `VITE_API_URL` to your Railway backend URL

### Backend → Railway

1. Go to [railway.app](https://railway.app) and create a new project from GitHub
2. In service settings, set **Root Directory** to `backend`
3. Railway auto-detects `npm start` from `package.json`
4. Add all environment variables from `backend/.env.example` (Redis via Railway's add-on injects `REDIS_URL` automatically if you use it)
5. Set `FRONTEND_URL` to your Vercel deployment URL
6. Set `NODE_ENV=production`

After deploying both, update:
- Vercel: `VITE_API_URL` → your Railway backend URL
- Railway: `FRONTEND_URL` → your Vercel frontend URL

For Judge0 in production, see `docs/judge0-setup.md` — the public `ce.judge0.com` instance is fine for dev but rate-limited and not suitable for real traffic.

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system diagram, service boundaries, feature flags, known gaps
- [`docs/api-contracts.md`](docs/api-contracts.md) — every mounted API route
- [`docs/database-schema.md`](docs/database-schema.md) — all MongoDB models
- [`docs/judge0-setup.md`](docs/judge0-setup.md) — self-hosted Docker vs. RapidAPI
- [`docs/weekly-review-email-setup.md`](docs/weekly-review-email-setup.md) — Resend + Railway cron setup for the weekly AI review email
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution guide, commit conventions, GitHub secrets

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes following [Conventional Commits](https://www.conventionalcommits.org/): `git commit -m "feat: your feature"`
4. Push and open a pull request

See `CONTRIBUTING.md` for the full setup and testing guide.

---

## License

MIT

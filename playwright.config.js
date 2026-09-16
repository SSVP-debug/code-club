import { defineConfig, devices } from "@playwright/test";

/**
 *
 * This config was added to finally wire up Playwright itself (the
 * `@playwright/test` dependency, this config file, and npm scripts) —
 * none of that existed yet, even though `e2e/critical-path.spec.js`,
 * `e2e/fixtures/testUser.js`, and `e2e/README.md` were already committed
 * and reference exactly this setup. That existing suite documents a real,
 * more ambitious flow (Firebase Auth Emulator + real backend + real Judge0
 * grading — see e2e/README.md) — this config supports it (the
 * `E2E_BASE_URL` override, the generous default timeout for real Judge0
 * grading) but does NOT itself stand up the Auth Emulator, backend, or
 * MongoDB; that's real infrastructure the README already covers.
 *
 * `e2e/public-pages.spec.js` and `e2e/protected-route-redirect.spec.js`
 * are new, much smaller additions alongside it — pages/behavior that need
 * only the frontend (booted with `.env.test`'s placeholder Firebase
 * config) and no backend at all, so they're runnable the moment a browser
 * binary can be downloaded, with none of the critical-path suite's
 * infrastructure prerequisites.
 *
 * ── Running these locally / in CI ────────────────────────────────────────
 *   npx playwright install chromium   (one-time, downloads a browser binary
 *                                      from cdn.playwright.dev — this will
 *                                      fail in network-restricted sandboxes;
 *                                      needs a normal internet connection)
 *   npm run test:e2e                              # everything
 *   npx playwright test public-pages protected-route-redirect  # just the
 *                                                                no-backend ones
 * `E2E_BASE_URL` overrides the frontend URL if it's not on the Vite
 * default (matches e2e/README.md's documented override).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 30s covers real Judge0 grading in critical-path.spec.js (which itself
  // also sets a more generous 30s wait specifically on the submission
  // result) without every trivial public-page assertion waiting that long
  // to fail when something's actually broken.
  timeout: 30_000,
  reporter: "html",

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
  },

  // Chromium only for now — the smallest useful starting point. Add
  // firefox/webkit projects here once there's an actual cross-browser bug
  // this project has hit; no evidence yet that it needs three browsers'
  // worth of binaries and CI time by default.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Only boots the frontend — critical-path.spec.js additionally needs the
  // backend, MongoDB, the Firebase Auth Emulator, and Judge0 up per
  // e2e/README.md; none of that is started here. When E2E_BASE_URL points
  // at an already-running server (e.g. one already wired up with all of
  // the above), set reuseExistingServer or run against that URL directly.
  webServer: {
    command: "npm run dev -- --mode test",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

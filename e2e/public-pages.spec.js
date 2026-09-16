import { test, expect } from "@playwright/test";

// These four pages render with no backend/auth dependency at all, so
// they're safe first tests for this new infrastructure — see
// playwright.config.js's header comment for what this suite can't cover
// yet (anything needing a real signed-in session or backend data).

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Code Club");
});

test("login page renders the sign-in form", async ({ page }) => {
  await page.goto("/login");
  // Google-only sign-in (see src/pages/LoginPage.jsx) — no email/password
  // fields to assert on, and the heading text varies by ?portal=, so the
  // one stable, portal-independent thing to check is the sign-in button.
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
});

test("privacy policy page loads", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
});

test("terms of service page loads", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
});

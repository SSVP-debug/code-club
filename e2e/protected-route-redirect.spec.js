import { test, expect } from "@playwright/test";

// ProtectedRoute (src/components/ProtectedRoute.jsx) redirects an
// unauthenticated visitor to /login?next=<intended path>, preserving where
// they were headed. This is the one "requires auth logic but not a real
// backend" behavior worth covering here — Firebase resolving to "no user"
// against the placeholder .env.test config is enough to exercise it, no
// live backend/database needed.

test("visiting a protected TPO route while signed out redirects to /login with ?next= preserved", async ({ page }) => {
  await page.goto("/tpo/dashboard");
  await expect(page).toHaveURL(/\/login\?.*next=%2Ftpo%2Fdashboard/);
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
});

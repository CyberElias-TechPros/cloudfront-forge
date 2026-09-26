import { expect, test } from "@playwright/test";

/**
 * Smoke: the core user stories work end-to-end against the real Worker.
 * Auth uses the dev-session path (dev tokens) — no Firebase project needed.
 */

test("API is reachable through the SPA proxy", async ({ request }) => {
  const health = await request.get("/health");
  expect(health.ok()).toBe(true);
  const body = await health.json();
  expect(body).toBeTruthy();
});

test("landing page renders the public shell", async ({ page }) => {
  await page.goto("/");
  // Hero CTA to the sign-in flow (dev auth may render the signed-in shell).
  await expect(page.getByRole("link", { name: /enter the loop/i }).first()).toBeVisible();
});

test("sign in → dashboard boots with live data", async ({ page }) => {
  await page.goto("/auth/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();

  // Dev auth auto-establishes a session and lands on the dashboard.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await expect(page.getByText(/welcome back/i).first()).toBeVisible({ timeout: 30_000 });
  // Live API sections render (quests or the queue block), not an error wall.
  await expect(page.getByText(/next in your queue|daily quests/i).first()).toBeVisible({
    timeout: 30_000,
  });
});

test("notifications inbox shows a real empty state", async ({ page }) => {
  await page.goto("/notifications");
  await expect(page.getByText(/no notifications yet/i)).toBeVisible({ timeout: 30_000 });
  // No request-failed wall on a signed-in page.
  await expect(page.getByText(/failed to fetch|something went wrong/i)).toHaveCount(0);
});

test("profile page opens the edit dialog", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: /edit profile/i }).click();
  await expect(page.getByRole("heading", { name: /^edit profile$/i })).toBeVisible();
  await expect(page.getByLabel(/display name/i)).toBeVisible();
});

test("theme preference applies and survives a reload", async ({ page }) => {
  await page.goto("/settings");
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark|light/);

  await page.getByRole("radio", { name: /^light$/i }).click();
  await expect(html).toHaveClass(/light/);

  await page.reload();
  await expect(html).toHaveClass(/light/);
  // Preference persisted in storage, not just the DOM.
  const stored = await page.evaluate(() => localStorage.getItem("loopsquad-theme"));
  expect(stored).toBe("light");
});

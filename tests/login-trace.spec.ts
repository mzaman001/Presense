import { test, expect } from "@playwright/test";

// PERF-10a: one-off trace — magic link via the new server action.
// Submitting should reach the "Check your inbox" state without an error.

test("login magic link flows through server action (PERF-10a trace)", async ({
  page,
}) => {
  await page.goto("/login");
  await page.fill("#email", "perf-test@presense.app");
  await page.click('button[type="submit"]');
  await expect(page.getByText("Check your inbox")).toBeVisible({
    timeout: 15000,
  });
});

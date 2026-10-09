import { test, expect } from "@playwright/test";
import { NO_SEED, readSeed, seedCookie } from "./seed";

// TOOL-18: prove the seeded test account reaches an authed route. The app's
// UI only offers Google sign-in, so a UI-driven login isn't repeatable;
// global-setup.ts seeds the account and mints a session with the service
// role, and the session cookie is injected here (see tests/seed.ts).
//
// It used to check the loaded chunks for "src/app/(app)/do/" paths, which
// only `next dev` includes: against a production build it always failed.

test.describe("authed-route measurement (TOOL-18)", () => {
  test("seeded account reaches /do", async ({ page }) => {
    const seed = readSeed();
    test.skip(!seed, NO_SEED);
    await page.context().addCookies([seedCookie(seed!)]);

    const response = await page.goto("/do", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    // The proxy must NOT have bounced us to /login — that is the previous
    // unauthenticated behavior this whole task exists to replace.
    await expect(page).toHaveURL(/\/do$/);

    // The Do page itself rendered, not the sign-in screen.
    await expect(page.getByRole("button", { name: "Add task" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with google/i }),
    ).toHaveCount(0);
  });
});

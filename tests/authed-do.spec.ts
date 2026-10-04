import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

// TOOL-18: prove the seeded test account can reach an authed route with the
// real post-login chunk set. The app's UI only offers Google sign-in, so a
// UI-driven login is not repeatable in CI; instead we seed the account, mint a
// session for it with the service role and inject the @supabase/ssr session
// cookie (see scripts/seed-test-user.mjs).

test.describe("authed-route measurement (TOOL-18)", () => {
  test("seeded account reaches /do with the real page chunk set", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Seed + mint a session via the service role (idempotent), get the cookie.
    let out;
    try {
      out = execFileSync(
        process.execPath,
        [path.join(ROOT, "scripts", "seed-test-user.mjs"), "--json"],
        { cwd: ROOT, encoding: "utf8", timeout: 60000 },
      );
    } catch (e) {
      // Skip (not fail) when Supabase env is absent — e.g. a contributor
      // without the project's .env.local.
      test.skip(
        !process.env.CI,
        `seed unavailable: ${String(e).slice(0, 200)}`,
      );
      throw e;
    }
    const { cookieName, cookieValue } = JSON.parse(out);

    await page.context().addCookies([
      {
        name: cookieName,
        value: cookieValue,
        domain: "localhost",
        httpOnly: false,
        sameSite: "Lax",
        path: "/",
      },
    ]);

    // Turbopack names dev chunks by content hash, so the route a chunk belongs
    // to is read from its body, which lists module paths
    // ("[project]/src/app/(app)/do/DoView.tsx"). Playwright runs against
    // `next dev` (see playwright.config.ts webServer).
    const chunkBodies: Promise<string>[] = [];
    page.on("response", (res) => {
      if (/\/_next\/static\/chunks\/.+\.js$/.test(res.url()))
        chunkBodies.push(res.text().catch(() => ""));
    });

    const response = await page.goto("/do", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    // The proxy must NOT have bounced us to /login — that is the previous
    // unauthenticated behavior this whole task exists to replace.
    await expect(page).toHaveURL(/\/do$/);

    // The real Do page chunks must be in the loaded script set, and none of
    // the login page's.
    await page.waitForLoadState("networkidle");
    const bodies = await Promise.all(chunkBodies);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.some((b) => b.includes("src/app/(app)/do/"))).toBe(true);
    expect(bodies.some((b) => b.includes("src/app/(auth)/login/"))).toBe(false);
  });
});

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

// TOOL-18: prove the seeded test account can reach an authed route with the
// real post-login chunk set. The app's UI only offers magic-link/Google, so a
// UI-driven login is not repeatable in CI; instead we seed the account and
// inject the @supabase/ssr session cookie (see scripts/seed-test-user.mjs).

test.describe("authed-route measurement (TOOL-18)", () => {
  test("seeded account reaches /do with the real page chunk set", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Seed + sign in via the service role (idempotent), get the session cookie.
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

    const chunkSeen: string[] = [];
    page.on("response", (res) => {
      const u = res.url();
      // dev: src_app_(app)_do_page_tsx_*.js · prod: app/(app)/do/page-*.js
      if (u.includes("do_page_tsx") || u.includes("/do/page-"))
        chunkSeen.push(u);
    });

    const response = await page.goto("/do", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    // The proxy must NOT have bounced us to /login — that is the previous
    // unauthenticated behavior this whole task exists to replace.
    await expect(page).toHaveURL(/\/do$/);

    // The real Do page chunk must be in the loaded script set, not the login
    // chunk set (17 scripts incl. app/(auth)/login/page-*).
    await page.waitForLoadState("networkidle");
    expect(chunkSeen.length).toBeGreaterThan(0);
    expect(chunkSeen[0]).toMatch(/do_page_tsx|do\/page-/);

    const scripts = await page.evaluate(() =>
      [...document.querySelectorAll("script[src]")].map(
        (s) => s.getAttribute("src") ?? "",
      ),
    );
    expect(
      scripts.some((s) => s.includes("do_page_tsx") || s.includes("do/page-")),
    ).toBe(true);
    expect(
      scripts.some(
        (s) => s.includes("login/page-") || s.includes("login_page_tsx"),
      ),
    ).toBe(false);
  });
});

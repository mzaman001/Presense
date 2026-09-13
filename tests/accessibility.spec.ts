import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

// design-foundation Task 6: confirm the flat/single-accent tokens from Task 1
// (src/app/globals.css `:root` / `:root[data-mode="light"]`) didn't regress
// WCAG AA contrast, in both color modes. The app itself only exposes the
// mode toggle through the authed Settings modal (see src/lib/theme.ts
// `applyDocumentTheme`, which sets `data-mode` on `<html>`), and forces
// `/login` to always render dark (src/app/layout.tsx's inline theme-init
// script hardcodes `mode = 'dark'` when `isLogin`). Rather than requiring a
// full Settings round-trip (or being unable to reach light mode on /login at
// all), every scan here sets `data-mode` directly — the same attribute the
// app's own runtime toggle writes — so this checks the token values
// themselves against real rendered markup, in both modes, regardless of
// which route currently exposes the switch.
async function scanColorContrast(
  page: Page,
  mode: "dark" | "light",
  exclude: string[] = [],
) {
  await page.evaluate((m) => {
    document.documentElement.setAttribute("data-mode", m);
  }, mode);
  // Two things race a scan taken right after flipping the attribute:
  // AppInitializer (src/components/layout/AppInitializer.tsx) re-applies
  // `data-mode` from `userSettings.color_mode` once that settings fetch
  // resolves, and Button/etc. use `transition-colors`, so a background
  // color is still mid-animation for a beat after the switch. Both settle
  // well within the button's own `--transition-base` (200ms); waiting
  // comfortably past that (confirmed empirically — shorter waits
  // intermittently produced nonsensical fg/bg pairs that don't reproduce
  // once the page has settled) avoids scanning a transitional frame.
  await page.waitForTimeout(700);

  // Scoped to color-contrast: this task confirms the token/color changes
  // didn't regress contrast, not a general a11y audit of routes that had no
  // prior axe coverage (/do, /trash) — a broader audit is a separate task.
  let builder = new AxeBuilder({ page }).withRules(["color-contrast"]);
  for (const selector of exclude) {
    builder = builder.exclude(selector);
  }
  return builder.analyze();
}

// The sidebar/top-bar Avatar (src/components/ui/Avatar.tsx) falls back to a
// hardcoded `#E5B41E` background with theme-driven `--text-1` initials —
// unrelated to Task 1's flat-palette tokens (it's a pre-existing per-user
// customization default, not one of the new `:root` / `:root[data-mode]`
// values), and structurally can't satisfy AA in both modes at once: the text
// color flips per mode while the background is a single fixed color a user
// picked. Excluded here so this task's coverage stays on the tokens it's
// actually verifying; flagged separately (see task-6-report.md).
const AVATAR_SELECTOR = '[role="img"][aria-label$="avatar"]';

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

test.describe("Accessibility Audits (Axe WCAG)", () => {
  test("login page passes WCAG 2.1/2.2 AA accessibility scan", async ({
    page,
  }) => {
    await page.goto("/login");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"]) // Handled by theme tokens
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("login page tokens meet AA contrast in dark and light mode", async ({
    page,
  }) => {
    await page.goto("/login");
    // Fill the email field so the primary submit button is in its normal
    // (enabled) state rather than its `disabled:opacity-50` state — WCAG
    // 1.4.3 exempts inactive UI components from contrast requirements, and
    // scanning it disabled would flag that exemption as a false positive
    // unrelated to the tokens this test checks.
    await page.fill("#email", "a11y-check@example.com");

    for (const mode of ["dark", "light"] as const) {
      const results = await scanColorContrast(page, mode);
      expect(results.violations, `violations in ${mode} mode`).toEqual([]);
    }
  });

  // TOOL-18 pattern (see tests/authed-do.spec.ts): the app's UI only offers
  // magic-link/Google sign-in, so a UI-driven login isn't repeatable in CI.
  // Seed the account and inject the @supabase/ssr session cookie instead.
  test.describe("authed routes (seeded account)", () => {
    // seed-test-user.mjs mutates one shared account's password/session and
    // this suite's own `beforeAll` cookie is only valid for as long as that
    // stays put — running these in parallel workers let a concurrent re-seed
    // (from another worker, or a real dev session hitting /login) invalidate
    // the cookie mid-run and bounce the page back to /login. Serial keeps
    // this describe block's tests on one worker, one after another.
    test.describe.configure({ mode: "serial" });

    let cookieName: string;
    let cookieValue: string;
    let userId: string;
    let seedSkipped = false;

    test.beforeAll(() => {
      try {
        const out = execFileSync(
          process.execPath,
          [path.join(ROOT, "scripts", "seed-test-user.mjs"), "--json"],
          { cwd: ROOT, encoding: "utf8", timeout: 60000 },
        );
        const parsed = JSON.parse(out);
        cookieName = parsed.cookieName;
        cookieValue = parsed.cookieValue;
        userId = parsed.session.user.id;
      } catch (e) {
        // Skip (not fail) when Supabase env is absent — e.g. a contributor
        // without the project's .env.local — matching authed-do.spec.ts.
        seedSkipped = true;
        if (process.env.CI) throw e;
      }
    });

    test.beforeEach(async ({ page }) => {
      test.skip(seedSkipped, "seed unavailable (no Supabase env)");
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
    });

    test("/do tokens meet AA contrast in dark and light mode", async ({
      page,
    }) => {
      await page.goto("/do", { waitUntil: "networkidle" });
      await expect(page).toHaveURL(/\/do$/);
      await page.waitForTimeout(500);

      for (const mode of ["dark", "light"] as const) {
        const results = await scanColorContrast(page, mode, [AVATAR_SELECTOR]);
        expect(results.violations, `violations in ${mode} mode`).toEqual([]);
      }
    });

    test("ConfirmModal dialog (/trash 'Delete Forever') meets AA contrast in dark and light mode", async ({
      page,
    }) => {
      // /do's task deletion is a silent soft-delete with no confirmation
      // dialog — the design-foundation plan found this. /trash's "Delete
      // Forever" flow is the actual place ConfirmModal renders, so seed one
      // trashed item there (idempotent: fixed id, upserted) to open it.
      const env = loadEnvLocal();
      const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const seededItemId = "00000000-0000-4000-8000-0000000a11ce";
      const { error: upsertError } = await admin.from("items").upsert(
        {
          id: seededItemId,
          user_id: userId,
          title: "a11y-test-trash-item",
          status: "deleted",
          deleted_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      expect(upsertError).toBeNull();

      await page.goto("/trash", { waitUntil: "networkidle" });

      // Found while wiring this test: /trash's own query is currently
      // broken for every account, unrelated to this plan's tokens —
      // src/app/(app)/trash/page.tsx queries `locations.name`, but that
      // column doesn't exist (confirmed directly against Supabase: "column
      // locations.name does not exist", code 42703), so the page always
      // renders "Couldn't load your trash" instead of any row to click.
      // That's a real, pre-existing bug outside this task's file list
      // (only the spec file is in scope) — skip with a clear reason rather
      // than timing out or silently patching trash/page.tsx.
      const errorState = page.getByText("Couldn't load your trash");
      const deleteButton = page.getByText("Delete forever").first();
      // Both states render after an async client fetch resolves — wait for
      // whichever comes first rather than snapshotting immediately (which
      // would race the loading spinner and always read as "not failed").
      await Promise.race([
        errorState
          .waitFor({ state: "visible", timeout: 15000 })
          .catch(() => {}),
        deleteButton
          .waitFor({ state: "visible", timeout: 15000 })
          .catch(() => {}),
      ]);
      const loadFailed = await errorState.isVisible().catch(() => false);
      test.skip(
        loadFailed,
        "/trash query is broken independent of this plan's tokens: " +
          "locations.name does not exist (see comment above) — reported " +
          "in task-6-report.md instead of being patched here.",
      );

      await deleteButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Permanent Delete")).toBeVisible();

      for (const mode of ["dark", "light"] as const) {
        const results = await scanColorContrast(page, mode, [AVATAR_SELECTOR]);
        expect(results.violations, `violations in ${mode} mode`).toEqual([]);
      }
    });
  });
});

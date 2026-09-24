import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

// Walks the onboarding wizard on the seeded test account (see
// scripts/seed-test-user.mjs) with an Axe scan on every screen, at phone
// and desktop sizes. The account's settings are snapshotted first and
// restored afterwards; it finishes with "Skip for now", so no tasks are
// created.

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

async function axe(page: Page) {
  // Let the step's entrance animation settle before measuring contrast.
  await page.waitForTimeout(600);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => n.target.join(" ") + " " + n.failureSummary).join(" | ")}`,
    ),
  ).toEqual([]);
}

// Both runs share the one seeded account.
test.describe.configure({ mode: "serial" });

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test(`onboarding wizard is accessible on ${viewport.name}`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    let seed: {
      cookieName: string;
      cookieValue: string;
      session: { user: { id: string } };
    };
    try {
      seed = JSON.parse(
        execFileSync(
          process.execPath,
          [path.join(ROOT, "scripts", "seed-test-user.mjs"), "--json"],
          { cwd: ROOT, encoding: "utf8", timeout: 60000 },
        ),
      );
    } catch (e) {
      test.skip(
        !process.env.CI,
        `seed unavailable: ${String(e).slice(0, 200)}`,
      );
      throw e;
    }
    const env = loadEnv();
    const admin: SupabaseClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
    const uid = seed.session.user.id;
    const { data: snapshot } = await admin
      .from("user_settings")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();

    try {
      await admin
        .from("user_settings")
        .update({ onboarding_complete: false })
        .eq("user_id", uid);

      await page.setViewportSize(viewport);
      await page.context().addCookies([
        {
          name: seed.cookieName,
          value: seed.cookieValue,
          domain: "localhost",
          sameSite: "Lax",
          path: "/",
        },
      ]);

      await page.goto("/onboarding");
      await expect(
        page.getByRole("heading", { name: /Clear your head/ }),
      ).toBeVisible();
      await axe(page);
      await page.getByRole("button", { name: "Get started" }).click();

      const name = page.getByRole("textbox", {
        name: "What should we call you?",
      });
      await expect(name).toBeFocused();
      await name.fill("");
      await expect(
        page.getByRole("button", { name: /Continue/ }),
      ).toBeDisabled();
      await name.fill("Robin");
      await axe(page);
      await name.press("Enter");

      await page.getByText("Light", { exact: true }).click();
      await axe(page);
      await page.getByRole("button", { name: /Continue/ }).click();

      await expect(
        page.getByRole("heading", {
          name: "When do you like to plan your day, Robin?",
        }),
      ).toBeVisible();
      await axe(page);
      await page.getByRole("button", { name: /Continue/ }).click();

      await expect(
        page.getByRole("heading", {
          name: "When do you usually call it a day?",
        }),
      ).toBeVisible();
      await axe(page);
      await page.getByRole("button", { name: /Continue/ }).click();

      await page.getByText("6h", { exact: true }).click();
      await axe(page);
      await page.getByRole("button", { name: /Continue/ }).click();

      await expect(
        page.getByRole("button", { name: "Plan my day" }),
      ).toBeVisible();
      await axe(page);

      // Dark mode, same last screen.
      await page.evaluate(() =>
        document.documentElement.setAttribute("data-mode", "dark"),
      );
      await axe(page);

      await page.getByRole("button", { name: "Skip for now" }).click();
      await page.waitForURL((u) => u.pathname === "/");

      const { data: saved } = await admin
        .from("user_settings")
        .select(
          "display_name, color_mode, daily_capacity_minutes, onboarding_complete",
        )
        .eq("user_id", uid)
        .single();
      expect(saved).toMatchObject({
        display_name: "Robin",
        color_mode: "light",
        daily_capacity_minutes: 360,
        onboarding_complete: true,
      });
    } finally {
      if (snapshot) {
        await admin.from("user_settings").update(snapshot).eq("user_id", uid);
      }
    }
  });
}

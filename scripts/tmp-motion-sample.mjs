// Temporary: how long after the trigger a panel first becomes visible, on
// the first open (code not loaded yet) and a second open.
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
const BASE = "http://localhost:3000";
const seed = JSON.parse(execFileSync("node", ["scripts/seed-test-user.mjs", "--json", "--rituals-done"], { encoding: "utf8" }));
const browser = await chromium.launch({ channel: "chromium" });

// Time from now until the selector exists and is at least slightly visible.
function firstVisible(page, selector) {
  return page.evaluate(
    (selector) =>
      new Promise((resolve) => {
        const t0 = performance.now();
        const tick = () => {
          const el = document.querySelector(selector);
          if (el && Number(getComputedStyle(el).opacity) > 0.02) return resolve(Math.round(performance.now() - t0));
          if (performance.now() - t0 > 3000) return resolve("never");
          requestAnimationFrame(tick);
        };
        tick();
      }),
    selector,
  );
}

for (const [label, w, h] of [["phone", 412, 823], ["desktop", 1280, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addCookies([{ name: seed.cookieName, value: seed.cookieValue, url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(BASE + "/do", { waitUntil: "networkidle" });
  await page.waitForTimeout(8000);
  const times = [];
  for (let i = 0; i < 2; i++) {
    const p = firstVisible(page, '[role="dialog"]');
    await page.keyboard.press("c");
    times.push(await p);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  }
  console.log(`${label} capture visible after: 1st open ${times[0]} ms, 2nd open ${times[1]} ms`);
  if (label === "desktop") {
    const s = [];
    for (let i = 0; i < 2; i++) {
      const p = firstVisible(page, '[role="dialog"][aria-label="Settings"]');
      await page.getByRole("button", { name: /settings/i }).first().click();
      s.push(await p);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }
    console.log(`${label} settings visible after: 1st open ${s[0]} ms, 2nd open ${s[1]} ms`);
  }
  await ctx.close();
}
await browser.close();

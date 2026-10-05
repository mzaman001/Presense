#!/usr/bin/env node
// Measures how smooth the signed-in app's interactions are on a desktop
// viewport: rail hover, quick capture, search, settings and rail navigation.
// Load-time tools (Lighthouse TBT, check-budgets) say nothing about these, so
// a perf change can make the app load faster and feel worse; run this before
// and after one.
//
// Per interaction window it records React commits (a stub DevTools hook
// counts onCommitFiberRoot), animation frames longer than 25 ms (rAF gaps),
// the longest frame, Event Timing's longest event duration, long animation
// frames' blocking time and layout shift. Each scenario runs --runs times
// (default 5); the first run is reported apart from the median of the rest,
// since a first open also loads code.
//
// Needs a production server: `npm run build && npm start` (port 3000), the
// seeded test account (scripts/seed-test-user.mjs, SUPABASE_SERVICE_ROLE_KEY
// in .env.local) and Playwright's full Chromium.
//
// Usage: node scripts/interaction-perf.mjs [--base http://localhost:3000]
//          [--runs 5] [--cpu 4] [--out file.json] [--headed]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = opt("--base", "http://localhost:3000");
const RUNS = Number(opt("--runs", "5"));
const OUT = opt("--out", null);
const HEADED = args.includes("--headed");
const CPU = Number(opt("--cpu", "1")); // CPU slowdown factor, e.g. 4

// Installed before any page script: counts React commits and collects frame,
// event, long-animation-frame and layout-shift data for the open window.
function instrument() {
  const w = window;
  w.__perf = { commits: 0, frames: [], events: [], loafs: [], shifts: 0 };
  w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject() {
      return 1;
    },
    onCommitFiberRoot() {
      w.__perf.commits++;
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };
  let last = 0;
  const tick = (t) => {
    if (last) w.__perf.frames.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const observe = (type, fn, extra = {}) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(fn)).observe({
        type,
        buffered: false,
        ...extra,
      });
    } catch {
      /* type unsupported */
    }
  };
  observe("event", (e) => w.__perf.events.push(e.duration), {
    durationThreshold: 16,
  });
  observe("long-animation-frame", (e) =>
    w.__perf.loafs.push(e.blockingDuration),
  );
  observe("layout-shift", (e) => {
    if (!e.hadRecentInput) w.__perf.shifts += e.value;
  });
}

async function reset(page) {
  await page.evaluate(() => {
    const p = window.__perf;
    p.commits = 0;
    p.frames = [];
    p.events = [];
    p.loafs = [];
    p.shifts = 0;
  });
}

async function collect(page) {
  return page.evaluate(() => {
    const p = window.__perf;
    const long = p.frames.filter((f) => f > 25);
    return {
      commits: p.commits,
      longFrames: long.length,
      maxFrame: Math.round(Math.max(0, ...p.frames)),
      maxEvent: Math.round(Math.max(0, ...p.events)),
      loafBlocking: Math.round(p.loafs.reduce((a, b) => a + b, 0)),
      shift: Number(p.shifts.toFixed(4)),
    };
  });
}

async function measure(page, action, settleMs = 900) {
  await reset(page);
  await action();
  await page.waitForTimeout(settleMs);
  return collect(page);
}

// For closes: how long the dialog stays in the DOM after the key press, i.e.
// whether an exit animation plays (0 = it vanished in the same frame).
async function measureClose(page, action) {
  await reset(page);
  const t0 = Date.now();
  await action();
  await page
    .waitForFunction(() => !document.querySelector('[role="dialog"]'), null, {
      timeout: 3000,
      polling: "raf",
    })
    .catch(() => {});
  const exitMs = Date.now() - t0;
  await page.waitForTimeout(600);
  return { ...(await collect(page)), exitMs };
}

const PARK = { x: 900, y: 450 }; // over the page, away from the rail

const scenarios = [
  {
    name: "rail hover in",
    run: (page) =>
      measure(page, async () => {
        await page.mouse.move(30, 420, { steps: 4 });
      }),
    after: (page) => page.mouse.move(PARK.x, PARK.y, { steps: 4 }),
  },
  {
    name: "rail hover out",
    before: async (page) => {
      await page.mouse.move(30, 420, { steps: 4 });
      await page.waitForTimeout(700);
    },
    run: (page) =>
      measure(page, async () => {
        await page.mouse.move(PARK.x, PARK.y, { steps: 4 });
      }),
  },
  {
    name: "capture open",
    run: (page) => measure(page, () => page.keyboard.press("c")),
    after: async (page) => {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
    },
  },
  {
    name: "capture close",
    before: async (page) => {
      await page.keyboard.press("c");
      await page.waitForTimeout(900);
    },
    run: (page) => measureClose(page, () => page.keyboard.press("Escape")),
  },
  {
    name: "search open",
    run: (page) => measure(page, () => page.keyboard.press("Control+k")),
    after: async (page) => {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
    },
  },
  {
    name: "search close",
    before: async (page) => {
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(900);
    },
    run: (page) => measureClose(page, () => page.keyboard.press("Escape")),
  },
  {
    name: "settings open (rail click)",
    run: (page) =>
      measure(page, () =>
        page.locator('aside button[aria-label="Settings"]').click(),
      ),
    after: async (page) => {
      await page.keyboard.press("Escape");
      await page.mouse.move(PARK.x, PARK.y, { steps: 4 });
      await page.waitForTimeout(800);
    },
  },
  {
    name: "settings close",
    before: async (page) => {
      await page.locator('aside button[aria-label="Settings"]').click();
      await page.mouse.move(PARK.x, PARK.y, { steps: 4 });
      await page.waitForTimeout(900);
    },
    run: (page) => measureClose(page, () => page.keyboard.press("Escape")),
  },
  {
    name: "rail nav Home -> Do",
    before: async (page) => {
      if (new URL(page.url()).pathname !== "/") {
        await page.locator('aside a[href="/"]').click();
        await page.waitForURL((u) => u.pathname === "/");
        await page.waitForTimeout(800);
      }
    },
    run: (page) =>
      measure(
        page,
        async () => {
          await page.locator('aside a[href="/do"]').click();
          await page.waitForURL((u) => u.pathname === "/do");
        },
        1200,
      ),
    after: (page) => page.mouse.move(PARK.x, PARK.y, { steps: 4 }),
  },
];

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
}

function summarise(runs) {
  const [first, ...rest] = runs;
  const med = {};
  for (const key of Object.keys(first))
    med[key] = median(rest.map((r) => r[key]));
  return { first, median: med };
}

async function main() {
  const out = execFileSync(
    process.execPath,
    [path.join("scripts", "seed-test-user.mjs"), "--json", "--rituals-done"],
    { encoding: "utf8", timeout: 60000 },
  );
  const { cookieName, cookieValue } = JSON.parse(out);

  const browser = await chromium.launch({
    channel: "chromium",
    headless: !HEADED,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies([
    {
      name: cookieName,
      value: cookieValue,
      domain: new URL(BASE).hostname,
      path: "/",
      sameSite: "Lax",
    },
  ]);
  await context.addInitScript(instrument);
  const page = await context.newPage();
  if (CPU > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  }
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  if (new URL(page.url()).pathname !== "/")
    throw new Error(`not signed in: landed on ${page.url()}`);
  await page.mouse.move(PARK.x, PARK.y);
  await page.waitForTimeout(2000);

  const results = {};
  for (const s of scenarios) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      if (s.before) await s.before(page);
      runs.push(await s.run(page));
      if (s.after) await s.after(page);
      await page.waitForTimeout(300);
    }
    results[s.name] = summarise(runs);
    const { first, median: m } = results[s.name];
    console.log(
      `${s.name.padEnd(28)} first: ${JSON.stringify(first)}\n${"".padEnd(28)} median: ${JSON.stringify(m)}`,
    );
  }
  await browser.close();
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

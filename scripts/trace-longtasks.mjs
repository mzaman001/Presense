import { chromium } from "playwright";

// §26.1/26.3 instrumentation: login route, Playwright Chromium,
// 390x844, 3x DPR, CPU throttle 4x, 150ms latency / 1.6Mbps down / 800Kbps up.
// Longtasks via injected PerformanceObserver; prints start + duration.

const url = process.argv[2] || "http://localhost:3111/login";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (800 * 1024) / 8,
  });

  await page.addInitScript(() => {
    window.__longtasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__longtasks.push({
          start: Math.round(entry.startTime),
          duration: Math.round(entry.duration),
        });
      }
    }).observe({ type: "longtask", buffered: true });
  });

  const t0 = Date.now();
  const collected = [];
  cdp.on("Tracing.dataCollected", (e) => {
    if (Array.isArray(e.value)) collected.push(...e.value);
  });
  await cdp.send("Tracing.start", {
    traceConfig: {
      recordMode: "recordUntilFull",
      enableSystrace: false,
      includedCategories: [
        "devtools.timeline",
        "v8.execute",
        "blink.user_timing",
      ],
      excludedCategories: [],
    },
    transferMode: "ReportEvents",
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  await cdp.send("Tracing.end");
  await page.waitForTimeout(1000);
  const fs = await import("node:fs");
  const events = collected;
  if (events.length === 0) {
    console.log("TRACE EMPTY");
  }
  fs.writeFileSync(
    `${process.cwd()}/scripts/trace-login.json`,
    JSON.stringify(events),
  );
  console.log(`trace saved: scripts/trace-login.json (${(JSON.stringify(events).length / 1024).toFixed(0)} KiB)`);

  const longtasks = await page.evaluate(() => window.__longtasks);
  console.log(`load to networkidle: ${Date.now() - t0} ms`);
  for (const lt of longtasks.sort((a, b) => a.start - b.start)) {
    console.log(
      `${String(lt.start).padStart(6)} ms start  ${String(lt.duration).padStart(4)} ms dur`,
    );
  }
  await browser.close();
})();

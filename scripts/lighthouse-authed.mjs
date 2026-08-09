#!/usr/bin/env node
// TOOL-18: session-enabled Lighthouse run against an authed route.
//
// Seeds the test account, signs in, and runs Lighthouse with the session
// cookie injected via --extra-headers, so authed routes (/do) can be measured
// the same way the /login baseline was. Requires the prod server to be
// running (next start) and CHROME_PATH set to a Chrome/Edge binary.
//
// Usage: node scripts/lighthouse-authed.mjs [url] [--budget <file>]
//   default url: http://localhost:3111/do
//   --budget: fail the run when a metric/resource exceeds perf-lh-budget.json
// Output: <repo>/lh-authed-report.json + printed perf score / key metrics

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const budgetIdx = argv.indexOf("--budget");
const budgetFile = budgetIdx !== -1 && argv[budgetIdx + 1] ? argv[budgetIdx + 1] : null;
const url = argv[0] && argv[0] !== "--budget" ? argv[0] : "http://localhost:3111/do";
const root = process.cwd();
const outPath = path.join(root, "lh-authed-report.json");
const headersPath = path.join(root, ".lh-headers.tmp.json");

// 1. Seed + sign in, get the raw Cookie header value.
const seed = spawnSync(process.execPath, [path.join(root, "scripts", "seed-test-user.mjs"), "--cookie"], {
  cwd: root,
  encoding: "utf8",
});
if (seed.status !== 0) {
  console.error("seed failed:", seed.stderr);
  process.exit(1);
}
const cookie = seed.stdout.trim();

// 2. Write the extra-headers JSON (npx CLI chokes on inline JSON on Windows).
fs.writeFileSync(headersPath, JSON.stringify({ Cookie: cookie }), "utf8");

// 3. Run Lighthouse (quiet, mobile perf preset like the baseline).
const env = { ...process.env, CHROME_PATH: process.env.CHROME_PATH ?? "" };
const args = [
  "npx",
  "-y",
  "lighthouse",
  url,
  "--preset=perf",
  "--only-categories=performance",
  "--chrome-flags=--headless=new --no-sandbox",
  `--extra-headers=${headersPath}`,
  "--output=json",
  `--output-path=${outPath}`,
  "--quiet",
];
if (budgetFile) {
  args.push(`--budget-path=${path.resolve(budgetFile)}`);
}
const lh = spawnSync("cmd", ["/c", ...args], { cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

fs.rmSync(headersPath, { force: true });

if (lh.status !== 0) {
  console.error("lighthouse failed:", lh.stderr || lh.stdout);
  process.exit(1);
}

// 4. Summarize.
const lhr = JSON.parse(fs.readFileSync(outPath, "utf8"));
const id = (name) => lhr.audits[name]?.displayValue ?? "n/a";
console.log(`finalURL: ${lhr.finalDisplayedUrl}`);
console.log(`perf score: ${Math.round(lhr.categories.performance.score * 100)}`);
console.log(`LCP: ${id("largest-contentful-paint")}  TBT: ${id("total-blocking-time")}`);
console.log(`FCP: ${id("first-contentful-paint")}  TTFB: ${id("server-response-time")}`);
console.log(`report: ${outPath}`);

#!/usr/bin/env node
// TOOL-18: session-enabled Lighthouse run against an authed route.
//
// Seeds the test account, signs in, and runs Lighthouse with the session
// cookie injected via --extra-headers, so authed routes (/do) can be measured
// the same way the /login baseline was. Requires the prod server to be
// running (next start) and CHROME_PATH set to a Chrome/Edge binary.
//
// Usage: node scripts/lighthouse-authed.mjs [url] [--runs N] [--budget <file>]
//   default url: http://localhost:3111/do
//   --runs: run N times and print the median TBT and LCP (single runs vary)
//   --budget: fail the run when a metric/resource exceeds perf-lh-budget.json
// Output: <repo>/lh-authed-report.json (last run) + printed key metrics

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const budgetIdx = argv.indexOf("--budget");
const budgetFile = budgetIdx !== -1 && argv[budgetIdx + 1] ? argv[budgetIdx + 1] : null;
const runsIdx = argv.indexOf("--runs");
const runs = runsIdx !== -1 ? Math.max(1, Number(argv[runsIdx + 1]) || 1) : 1;
const flagValues = new Set(
  [budgetIdx, runsIdx].filter((i) => i !== -1).map((i) => argv[i + 1]),
);
const url =
  argv.find((arg) => !arg.startsWith("--") && !flagValues.has(arg)) ??
  "http://localhost:3111/do";
// Only plain http(s) URLs: the value is handed to Lighthouse as an argument.
let parsedUrl;
try {
  parsedUrl = new URL(url);
} catch {
  parsedUrl = null;
}
if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) {
  console.error(`Not an http(s) URL: ${url}`);
  process.exit(1);
}
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

// 3. Run Lighthouse (quiet, mobile perf preset like the baseline), `runs` times.
const env = { ...process.env, CHROME_PATH: process.env.CHROME_PATH ?? "" };
// Run npm's npx-cli.js with this Node binary instead of `cmd /c npx ...`:
// no shell re-parses the URL or paths (CodeQL
// js/shell-command-injection-from-environment). npm ships beside node.exe on
// Windows and under ../lib on Linux/macOS.
const nodeDir = path.dirname(process.execPath);
const npxCli = [
  path.join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js"),
  path.join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npx-cli.js"),
].find((p) => fs.existsSync(p));
if (!npxCli) {
  console.error("Could not find npm's npx-cli.js next to", process.execPath);
  process.exit(1);
}
const args = [
  npxCli,
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
const results = [];
for (let run = 1; run <= runs; run++) {
  const startedAt = Date.now();
  const lh = spawnSync(process.execPath, args, { cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const output = `${lh.stderr ?? ""}${lh.stdout ?? ""}`;
  const fresh = fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs >= startedAt;
  // On Windows chrome-launcher can't delete its temp profile once the run is
  // over (EPERM in destroyTmp), so Lighthouse exits 1 with the report already
  // written. That report is valid; any other failure is not.
  const cleanupOnly = lh.status !== 0 && fresh && /EPERM/.test(output) && /destroyTmp/.test(output);
  if (lh.status !== 0 && !cleanupOnly) {
    fs.rmSync(headersPath, { force: true });
    console.error("lighthouse failed:", output);
    process.exit(1);
  }

  // 4. Summarize this run.
  const lhr = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const audit = (name) => lhr.audits[name];
  const shown = (name) => audit(name)?.displayValue ?? "n/a";
  results.push({
    tbt: audit("total-blocking-time")?.numericValue ?? NaN,
    lcp: audit("largest-contentful-paint")?.numericValue ?? NaN,
  });
  console.log(
    `run ${run}: ${lhr.finalDisplayedUrl}  score ${Math.round(lhr.categories.performance.score * 100)}` +
      `  LCP ${shown("largest-contentful-paint")}  TBT ${shown("total-blocking-time")}` +
      `  FCP ${shown("first-contentful-paint")}  TTFB ${shown("server-response-time")}`,
  );
}
fs.rmSync(headersPath, { force: true });

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
if (runs > 1) {
  console.log(`median TBT: ${Math.round(median(results.map((r) => r.tbt)))} ms`);
  console.log(`median LCP: ${(median(results.map((r) => r.lcp)) / 1000).toFixed(1)} s`);
}
console.log(`report (last run): ${outPath}`);

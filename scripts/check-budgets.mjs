#!/usr/bin/env node
// PERF-09: enforce initial-JS bundle budgets against a running production server.
//
// Fetches each budgeted route's HTML, extracts its <script src> set (the
// authoritative per-route initial JS, per EXECUTION_SPEC §26.2), gzips each
// chunk file from disk, and compares the total against perf-budgets.json.
// Exits 1 when any route is over budget so CI can gate on it.
//
// Usage: node scripts/check-budgets.mjs [--base <url>] [--budgets <file>] [--next <dir>]
//   --base     default http://localhost:3000
//   --budgets  default ./perf-budgets.json
//   --next     default .next

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const base = arg("--base", "http://localhost:3000");
const budgetsPath = arg("--budgets", path.join(process.cwd(), "perf-budgets.json"));
const nextDir = arg("--next", ".next");

let config;
try {
  config = JSON.parse(fs.readFileSync(budgetsPath, "utf8"));
} catch (err) {
  console.error(`check-budgets: cannot read ${budgetsPath}: ${err.message}`);
  process.exit(1);
}

function chunkFile(src) {
  const disk = src.replace(/^\/(?:_next|next)\//, "");
  const file = path.join(nextDir, disk);
  return fs.existsSync(file) ? file : null;
}

function gzKiB(src) {
  const file = chunkFile(src);
  if (!file) return null;
  return zlib.gzipSync(fs.readFileSync(file)).length / 1024;
}

const isPolyfill = (src) => /polyfills-[^/]*\.js/.test(src);

let failed = false;
for (const route of config.routes ?? []) {
  const url = new URL(route.path, base);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`check-budgets: GET ${route.path} -> ${res.status} (expected 200)`);
    failed = true;
    continue;
  }
  const html = await res.text();
  const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);

  let totalKiB = 0;
  let polyfillKiB = 0;
  const missing = [];
  for (const src of scriptSrcs) {
    const gz = gzKiB(src);
    if (gz === null) {
      missing.push(src);
      continue;
    }
    if (isPolyfill(src)) polyfillKiB += gz;
    else totalKiB += gz;
  }

  const budgetKiB = route.initialGzKiB;
  const over = totalKiB > budgetKiB;
  if (over) failed = true;
  console.log(
    `${over ? "FAIL" : "pass"} ${route.path}: ${scriptSrcs.length} scripts, ` +
      `${totalKiB.toFixed(1)} KiB gz (${polyfillKiB.toFixed(1)} KiB polyfills) vs budget ${budgetKiB} KiB`
  );
  if (missing.length) console.error(`  missing chunk files on disk: ${missing.join(", ")}`);
}

if (failed) {
  console.error("check-budgets: budget exceeded — see perf-budgets.json");
  process.exit(1);
}
console.log("check-budgets: all routes within budget");

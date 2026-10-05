# Phone Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut signed-in Total Blocking Time on `/do` and `/` from 520–600 ms towards 200 ms with no visible or behavioural change (one exception, called out in Task 3).

**Architecture:** Five independent fixes to the shared `(app)` shell, each its own commit and each gated by a before/after Lighthouse measurement: lazy ritual overlay, browser-only Sentry tracing removal, no nav tooltips, store seeded with settings before hydration, fewer shell re-renders.

**Tech Stack:** Next.js 16.3 (Turbopack), React 19, zustand 5, @sentry/nextjs 10.70, Vitest + Testing Library, Playwright, Lighthouse.

**Spec:** `docs/superpowers/specs/2026-10-04-phone-performance-design.md`

## Global Constraints

- No visible or behavioural change. If a step needs one, stop and show a mockup first. (Task 3 removes a tooltip that only ever flashes; it is called out in the PR.)
- Keep a fix only if it measurably lowers TBT or main-thread time; otherwise revert it.
- `npm run lint` 0 errors, `npx tsc --noEmit`, `npm test`, `npm run build` must pass after every task.
- Server-side Sentry keeps tracing (`tracesSampleRate` 0.1 in `src/sentry.server.config.ts` / `src/sentry.edge.config.ts`): nothing may change server bundles.
- AGENTS.md invariants: `next/dynamic` components render conditionally on their open state; tokens only; no `transition-all`.
- Working tree is CRLF; don't rewrite whole files in LF.

## How to measure (used by every task)

Build and serve production on :3107, then three signed-in Lighthouse runs per route:

```bash
npm run build
```

Start the server with the preview tool (`prod` in `.claude/launch.json`, `next start -p 3107`). Then, with Edge as Chrome:

```bash
CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node scripts/lighthouse-authed.mjs http://localhost:3107/do --runs 3
CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node scripts/lighthouse-authed.mjs http://localhost:3107/ --runs 3
```

Record median TBT for each route in the task's commit message. Baseline: `/do` 520 ms, `/` 560 ms (medians of the spec's runs).

---

### Task 0: Make `lighthouse-authed.mjs` work on Windows and run N times

On Windows, chrome-launcher fails to delete its temp profile (`EPERM … lighthouse.NNNN`) *after* writing the report, Lighthouse exits non-zero, and the script discards a good result. Also add `--runs N` with a median so every task measures the same way.

**Files:**
- Modify: `scripts/lighthouse-authed.mjs`

**Interfaces:**
- Produces: CLI `node scripts/lighthouse-authed.mjs <url> [--runs N] [--budget <file>]`, prints one line per run and `median TBT: <ms> ms` / `median LCP: <s> s`.

- [ ] **Step 1: Run the current script and confirm the failure**

Run: `CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node scripts/lighthouse-authed.mjs http://localhost:3107/do`
Expected: `lighthouse failed: … EPERM … destroyTmp`, exit 1, although `lh-authed-report.json` was rewritten.

- [ ] **Step 2: Accept a fresh report despite a cleanup-only failure, and loop runs**

Replace everything from `// 3. Run Lighthouse` to the end of the file with:

```js
// 3. Run Lighthouse (quiet, mobile perf preset like the baseline) `runs` times.
const runsIdx = argv.indexOf("--runs");
const runs = runsIdx !== -1 ? Math.max(1, Number(argv[runsIdx + 1]) || 1) : 1;
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
  // On Windows chrome-launcher can't delete its temp profile after the run
  // (EPERM in destroyTmp) and Lighthouse exits 1 with the report already
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
  results.push({
    tbt: audit("total-blocking-time")?.numericValue ?? NaN,
    lcp: audit("largest-contentful-paint")?.numericValue ?? NaN,
  });
  console.log(
    `run ${run}: ${lhr.finalDisplayedUrl} score ${Math.round(lhr.categories.performance.score * 100)}` +
      `  LCP ${audit("largest-contentful-paint")?.displayValue ?? "n/a"}` +
      `  TBT ${audit("total-blocking-time")?.displayValue ?? "n/a"}` +
      `  FCP ${audit("first-contentful-paint")?.displayValue ?? "n/a"}`,
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
```

Also update the header comment's usage line to:
`// Usage: node scripts/lighthouse-authed.mjs [url] [--runs N] [--budget <file>]`
and make the URL parse skip flag values: change the `url` line to

```js
const flagValues = new Set(["--budget", "--runs"].flatMap((f) => (argv.includes(f) ? [argv[argv.indexOf(f) + 1]] : [])));
const url = argv.find((a) => !a.startsWith("--") && !flagValues.has(a)) ?? "http://localhost:3111/do";
```

- [ ] **Step 3: Run it**

Run: `CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node scripts/lighthouse-authed.mjs http://localhost:3107/do --runs 3`
Expected: three `run N:` lines, `median TBT: ~520 ms`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/lighthouse-authed.mjs
git commit -m "fix(scripts): lighthouse-authed survives Windows temp cleanup, --runs N"
```

---

### Task 1: Mount the ritual overlay only while a ritual is open

**Files:**
- Modify: `src/components/layout/RitualOverlayDynamic.tsx`
- Modify: `src/components/layout/AppInitializer.tsx:47-76` (auto-open waits for the chunk)
- Modify: `src/components/layout/Navigation.tsx` (`SidebarRitual`: preload on hover/focus)
- Modify: `src/app/(app)/HomeView.tsx:107` ("You haven't planned your day yet" button: preload on hover/focus)
- Test: `src/components/layout/__tests__/RitualOverlayDynamic.test.tsx` (new)

**Interfaces:**
- Produces: `RitualOverlayDynamic()` (renders nothing unless `useAppStore((s) => s.activeRitual) !== null`), `loadRitualOverlay(): Promise<unknown>`, `preloadRitualOverlay(): void` from `@/components/layout/RitualOverlayDynamic`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/layout/__tests__/RitualOverlayDynamic.test.tsx
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/useAppStore";

const loaded = vi.fn();
vi.mock("@/components/features/RitualOverlay", () => {
  loaded();
  return { RitualOverlay: () => <div data-testid="ritual">ritual</div> };
});

import { RitualOverlayDynamic } from "../RitualOverlayDynamic";

describe("RitualOverlayDynamic", () => {
  beforeEach(() => {
    loaded.mockClear();
    useAppStore.setState({ activeRitual: null });
  });

  it("renders nothing and does not load the ritual while none is active", async () => {
    const { container } = render(<RitualOverlayDynamic />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(loaded).not.toHaveBeenCalled();
  });

  it("loads and shows the ritual once one becomes active", async () => {
    render(<RitualOverlayDynamic />);
    act(() => useAppStore.setState({ activeRitual: "morning" }));
    expect(await screen.findByTestId("ritual")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/layout/__tests__/RitualOverlayDynamic.test.tsx`
Expected: the first test FAILS (`loaded` called / container not empty), because the overlay is mounted unconditionally.

- [ ] **Step 3: Implement**

Replace `src/components/layout/RitualOverlayDynamic.tsx` with:

```tsx
"use client";
// PERF-19: client wrapper that lazy-loads RitualOverlay with ssr:false, so
// RitualOverlay and its react-textarea-autosize dependency stay out of the
// shared (app)-shell bundle of every protected route.
//
// It is mounted only while a ritual is open (AGENTS.md: an unconditionally
// rendered next/dynamic component still downloads and mounts on every page).
// Mounted always, it cost every page ~150-250 ms of main thread on a phone:
// the chunk's evaluation, the closed overlay's hooks, its first
// toLocaleDateString (ICU setup) and an ssr:false client-render bailout.
import dynamic from "next/dynamic";
import { withPreload } from "@/lib/preloadable";
import { useAppStore } from "@/store/useAppStore";

/** Resolves once the ritual's code is loaded; opening then has no blank frame. */
export const loadRitualOverlay = () =>
  import("@/components/features/RitualOverlay");

const RitualOverlay = withPreload(
  dynamic(
    () =>
      import("@/components/features/RitualOverlay").then((m) => ({
        default: m.RitualOverlay,
      })),
    { ssr: false, loading: () => null },
  ),
  loadRitualOverlay,
);

/** Warm the chunk from an entry point's hover or focus. */
export const preloadRitualOverlay = () => RitualOverlay.preload();

export function RitualOverlayDynamic() {
  const open = useAppStore((s) => s.activeRitual !== null);
  return open ? <RitualOverlay /> : null;
}
```

In `src/components/layout/AppInitializer.tsx`, import `loadRitualOverlay` and open the ritual only after its code has loaded, re-checking that nothing else opened one meanwhile. Replace the two `setActiveRitual(...)` calls inside `checkRituals` with `open("morning")` / `open(decision.kind)` and add above `checkRituals`:

```tsx
    // Fetch the ritual's code first so it opens fully drawn, not blank.
    const open = (kind: "morning" | "evening") => {
      void loadRitualOverlay()
        .catch(() => undefined)
        .then(() => {
          if (useAppStore.getState().activeRitual === null) setActiveRitual(kind);
        });
    };
```

In `Navigation.tsx` `SidebarRitual`, add `onPointerEnter`/`onFocus` support: give `NavRow` an optional `onIntent?: () => void` prop that it passes as `onPointerEnter={onIntent}` and `onFocus={onIntent}` to the `<button>` (not the `<Link>`), and pass `onIntent={preloadRitualOverlay}` from `SidebarRitual`.

In `HomeView.tsx` add `onPointerEnter={preloadRitualOverlay}` and `onFocus={preloadRitualOverlay}` to the "You haven't planned your day yet" `<button>` (line ~107), importing `preloadRitualOverlay` from `@/components/layout/RitualOverlayDynamic`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/layout src/app`
Expected: PASS (new test plus existing Sidebar/AppInitializer tests).

- [ ] **Step 5: Lint, typecheck, build, measure**

Run: `npm run lint && npx tsc --noEmit && npm run build`, restart the prod server, measure both routes (see *How to measure*).
Expected: median TBT lower on both routes; no "Recovered" entry needed to confirm, the numbers decide.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/RitualOverlayDynamic.tsx src/components/layout/AppInitializer.tsx src/components/layout/Navigation.tsx "src/app/(app)/HomeView.tsx" src/components/layout/__tests__/RitualOverlayDynamic.test.tsx
git commit -m "perf(shell): mount the ritual overlay only while a ritual is open

/do TBT <before> -> <after> ms, / <before> -> <after> ms (median of 3)."
```

---

### Task 2: Strip Sentry tracing from the browser bundle only

`withSentryConfig({ webpack: { treeshake: { removeTracing: true } } })` is applied by a webpack DefinePlugin; `next build` uses Turbopack, so `__SENTRY_TRACING__` stays undefined in the browser and `@sentry/nextjs`'s client `init` adds `browserTracingIntegration`. `compiler.define` can't be used: it applies to server bundles too, and the server uses tracing. A browser-only Turbopack rule can.

**Files:**
- Create: `scripts/turbopack/sentry-no-tracing-loader.cjs`
- Modify: `next.config.ts` (`turbopack.rules`, comment on the webpack option)
- Test: `scripts/turbopack/__tests__/sentry-no-tracing-loader.test.ts` (new; check `vitest.config` `include` covers `scripts/**`, else put it in `src/lib/__tests__/sentry-no-tracing-loader.test.ts` importing the `.cjs`)

**Interfaces:**
- Produces: CommonJS webpack-style loader `module.exports = function (source: string): string` replacing the identifier `__SENTRY_TRACING__` with `false`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const loader = require("../sentry-no-tracing-loader.cjs") as (s: string) => string;

describe("sentry-no-tracing-loader", () => {
  it("turns the tracing guard into a constant false", () => {
    const src = 'if (typeof __SENTRY_TRACING__ === "undefined" || __SENTRY_TRACING__) { a(); }';
    const out = loader(src);
    expect(out).not.toContain("__SENTRY_TRACING__");
    // typeof false is "boolean", so the guard is false and the bundler drops a().
    expect(new Function("a", out.replace("{ a(); }", "{ return a(); } return 'skipped';"))(() => "ran")).toBe("skipped");
  });

  it("leaves identifiers that merely contain the name alone", () => {
    expect(loader("const x__SENTRY_TRACING__y = 1;")).toBe("const x__SENTRY_TRACING__y = 1;");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run <test path>`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the loader**

```js
// scripts/turbopack/sentry-no-tracing-loader.cjs
//
// Turbopack equivalent of @sentry/nextjs's webpack-only
// `treeshake.removeTracing` (a DefinePlugin setting __SENTRY_TRACING__ to
// false). next.config.ts runs this on browser-bound @sentry files only:
// the server keeps tracing (tracesSampleRate in sentry.server.config.ts), so
// a global `compiler.define` is not an option.
module.exports = function sentryNoTracingLoader(source) {
  return source.replace(/(?<![\w$])__SENTRY_TRACING__(?![\w$])/g, "false");
};
```

- [ ] **Step 4: Run the test**

Expected: PASS.

- [ ] **Step 5: Wire it into `next.config.ts`**

Replace `turbopack: {},` with:

```ts
  turbopack: {
    rules: {
      // Strip Sentry's tracing code from the browser bundle (see the loader).
      "*.js": {
        condition: {
          all: [
            "browser",
            { path: /node_modules[\\/]@sentry/ },
            { content: /__SENTRY_TRACING__/ },
          ],
        },
        loaders: [require.resolve("./scripts/turbopack/sentry-no-tracing-loader.cjs")],
      },
    },
  },
```

`next.config.ts` is ESM-compiled by Next; if `require` is unavailable, use `path.resolve(process.cwd(), "scripts/turbopack/sentry-no-tracing-loader.cjs")` with `import path from "node:path"`. Update the comment above `webpack: { treeshake: { removeTracing: true } }` to say it now only affects webpack builds (`ANALYZE=true`), and that Turbopack builds get the same through `turbopack.rules`.

- [ ] **Step 6: Build and verify the bundle**

Run: `npm run build`, then
`grep -l "__SENTRY_TRACING__\|browserTracingIntegration" .next/static/chunks/*.js`
Expected: no output (before: the Sentry chunk matched). Record the Sentry chunk's gzip size before/after (`gzip -c <chunk> | wc -c`; before 72,089 bytes).
Also confirm the server keeps tracing: `grep -rl "browserTracingIntegration\|__SENTRY_TRACING__" .next/server | head -3` is unchanged in count versus a build of the previous commit is not required; instead check `.next/server/chunks` still contain `tracesSampleRate`'s consumer `hasSpansEnabled` without a literal `false` substitution: `grep -c "__SENTRY_TRACING__" .next/server/chunks/*.js | grep -v ":0" | head -3` returns at least one file.

- [ ] **Step 7: Lint, typecheck, tests, measure**

Run: `npm run lint && npx tsc --noEmit && npm test`, restart prod server, measure both routes.

- [ ] **Step 8: Commit**

```bash
git add scripts/turbopack next.config.ts <test path>
git commit -m "perf(sentry): strip browser tracing under Turbopack

The webpack-only treeshake option never applied to next build. Sentry
chunk <before> -> <after> bytes gz; /do TBT ..., / ... (median of 3)."
```

---

### Task 3: Remove the desktop rail's redundant tooltips

Measured on the live rail (Playwright, 1280×800): hovering a row shows its tooltip at once, the rail expands 100 ms later and shows the same label, and the tooltip is then disabled. On keyboard focus the rail expands immediately and the tooltip never appears. So each of the 11 rows mounts a full Base UI tooltip (Root, Trigger, Portal, Positioner) for a sub-second flash of text the rail already shows; in the dev trace that's 75 `TooltipTrigger`, 49 `TooltipRoot`, 33 `TooltipContent` renders on load. The flash goes away: call this out in the PR.

**Files:**
- Modify: `src/components/layout/Navigation.tsx` (`NavRow` returns the element directly; drop the tooltip import; keep `aria-label`)
- Modify: `src/app/(app)/layout.tsx` (remove `TooltipProvider`)
- Modify: `src/components/layout/__tests__/Sidebar.test.tsx` (remove the `TooltipProvider` wrapper)
- Delete: `src/components/ui/tooltip.tsx` (only if `grep -rn "components/ui/tooltip" src` shows no other user after the edits)

- [ ] **Step 1: Write the failing test** (in `Sidebar.test.tsx`)

```tsx
  it("renders nav rows as plain links and buttons, without tooltip wiring", () => {
    renderSidebar();
    expect(document.querySelector('[data-slot="tooltip-trigger"]')).toBeNull();
    expect(screen.getByRole("link", { name: /inbox/i })).toBeInTheDocument();
  });
```

(`renderSidebar` is the file's existing render helper; reuse it.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/layout/__tests__/Sidebar.test.tsx`
Expected: FAIL, a `tooltip-trigger` element exists.

- [ ] **Step 3: Implement**

In `NavRow`, replace the final `return (<Tooltip …>…</Tooltip>);` with `return element;`, remove the `Tooltip, TooltipContent, TooltipTrigger` import and the now-unused `expanded`/`disabled` uses only if lint reports them unused (`expanded` is still passed by callers; if unused inside `NavRow`, remove the prop from the type and the callers' `shared` object only if nothing else reads it: `shared` also carries `reducedMotion`). Remove `<TooltipProvider>`/`</TooltipProvider>` and its import from `src/app/(app)/layout.tsx` and from the Sidebar test. Delete `src/components/ui/tooltip.tsx` if unreferenced.

- [ ] **Step 4: Run tests, lint, typecheck, build, measure**

Run: `npx vitest run src/components/layout && npm run lint && npx tsc --noEmit && npm run build`, then measure.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/layout src/components/ui "src/app/(app)/layout.tsx"
git commit -m "perf(nav): drop the rail's tooltips, which only flashed before it expands

..."
```

---

### Task 4: Seed the store with the server's settings before hydration

Today the server renders every settings reader with `userSettings = {}` (the global zustand store is never written on the server), and `AppInitializer` copies the settings in after hydration, so the shell renders twice (a 94 ms "Cascading Update" on `/do`) and the rail flashes "Presense User" before the real name. zustand 5's hook hydrates with `getInitialState()`, so seeding the store alone isn't enough.

Design: a client `AppStoreSeed` provider receives the settings from the layout. During its first client render it writes them into the global store (once, only if the store has none). `useAppStore` becomes a thin `useSyncExternalStore` hook whose server snapshot is the store's state with the seeded settings, cached per seed object. Server render and hydrating render then see the same settings, and nothing re-renders afterwards. The server never writes the global store (no cross-request leak).

**Files:**
- Modify: `src/store/useAppStore.ts`
- Create: `src/components/providers/AppStoreSeed.tsx`
- Modify: `src/app/(app)/layout.tsx` (wrap the tree in `<AppStoreSeed settings={…}>`, stop passing `initialSettings` to `AppInitializer`)
- Modify: `src/components/layout/AppInitializer.tsx` (delete the `initialSettings` prop and its copy-in effect)
- Test: `src/store/__tests__/useAppStore.seed.test.tsx` (new, jsdom), `src/store/__tests__/useAppStore.server.test.tsx` (new, `// @vitest-environment node`)

**Interfaces:**
- Produces: `useAppStore` with the same call signatures as now (`useAppStore(selector)`, `useAppStore.getState/setState/subscribe/getInitialState`); `SettingsSeedContext` (internal); `AppStoreSeed({ settings, children }: { settings: UserSettings | null; children: ReactNode })`.

- [ ] **Step 1: Write the failing hydration test**

```tsx
// src/store/__tests__/useAppStore.seed.test.tsx
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/useAppStore";
import { AppStoreSeed } from "@/components/providers/AppStoreSeed";

let renders = 0;
function Name() {
  renders++;
  return <span>{useAppStore((s) => s.userSettings.display_name ?? "Presense User")}</span>;
}

describe("AppStoreSeed", () => {
  it("hydrates with the server's settings and renders once", async () => {
    const settings = { display_name: "Ada" };
    const tree = <AppStoreSeed settings={settings}><Name /></AppStoreSeed>;

    const html = renderToString(tree);
    expect(html).toContain("Ada");

    // A fresh page: the browser's store starts empty.
    useAppStore.setState(useAppStore.getInitialState(), true);
    const container = document.createElement("div");
    container.innerHTML = html;
    renders = 0;
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("Ada");
    expect(renders).toBe(1);
    expect(useAppStore.getState().userSettings).toBe(settings);
  });

  it("does not overwrite settings the client already has", () => {
    const current = { display_name: "Changed in Settings" };
    useAppStore.setState({ userSettings: current });
    renderToString(<AppStoreSeed settings={{ display_name: "Ada" }}><Name /></AppStoreSeed>);
    expect(useAppStore.getState().userSettings).toBe(current);
  });
});
```

```tsx
// src/store/__tests__/useAppStore.server.test.tsx
// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useAppStore } from "@/store/useAppStore";
import { AppStoreSeed } from "@/components/providers/AppStoreSeed";

function Name() {
  return <span>{useAppStore((s) => s.userSettings.display_name ?? "Presense User")}</span>;
}

describe("AppStoreSeed on the server", () => {
  it("renders with the request's settings without writing the shared store", () => {
    const html = renderToString(<AppStoreSeed settings={{ display_name: "Ada" }}><Name /></AppStoreSeed>);
    expect(html).toContain("Ada");
    expect(useAppStore.getState().userSettings).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/store/__tests__/useAppStore.seed.test.tsx src/store/__tests__/useAppStore.server.test.tsx`
Expected: FAIL, `AppStoreSeed` does not exist.

- [ ] **Step 3: Implement the store hook**

In `src/store/useAppStore.ts`:
- change `import { create } from "zustand";` to
  `import { createContext, useContext, useSyncExternalStore } from "react";`
  `import { createStore } from "zustand/vanilla";`
- change `export const useAppStore = create<AppState>((set) => ({` to `const store = createStore<AppState>()((set) => ({` (body unchanged).
- append:

```ts
/**
 * The settings the server rendered the app shell with (AppStoreSeed).
 * Null outside the (app) layout: onboarding, login, tests without a seed.
 */
export const SettingsSeedContext = createContext<UserSettings | null>(null);

// The server's view of the store: its state plus the request's settings.
// The shared store itself is never written on the server, where it is one
// module instance for every request. Cached per seed object because React
// requires getServerSnapshot to return the same value for the same input.
const seeded = new WeakMap<UserSettings, AppState>();
function serverState(seed: UserSettings | null): AppState {
  const state = store.getState();
  if (!seed || Object.keys(state.userSettings).length > 0) return state;
  let withSeed = seeded.get(seed);
  if (!withSeed) {
    withSeed = { ...state, userSettings: seed };
    seeded.set(seed, withSeed);
  }
  return withSeed;
}

const identity = (state: AppState) => state;

/**
 * zustand's own hook hydrates from getInitialState(), i.e. without the
 * user's settings, then re-renders every settings reader once they arrive.
 * This one hydrates from the same settings the server used.
 */
function useBoundAppStore(): AppState;
function useBoundAppStore<T>(selector: (state: AppState) => T): T;
function useBoundAppStore<T>(
  selector: (state: AppState) => T = identity as (state: AppState) => T,
): T {
  const seed = useContext(SettingsSeedContext);
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(serverState(seed)),
  );
}

export const useAppStore = Object.assign(useBoundAppStore, store);
```

- [ ] **Step 4: Implement `AppStoreSeed`**

```tsx
// src/components/providers/AppStoreSeed.tsx
"use client";

import { useState, type ReactNode } from "react";
import {
  SettingsSeedContext,
  useAppStore,
  type UserSettings,
} from "@/store/useAppStore";

/**
 * Puts the server's settings in the store before anything below renders,
 * so the hydrating render matches the server's HTML and nothing re-renders
 * once it's on screen. Settings already in the store (changed since, or
 * kept across a client navigation) win.
 */
export function AppStoreSeed({
  settings,
  children,
}: {
  settings: UserSettings | null;
  children: ReactNode;
}) {
  // useState's initializer: runs once, before the children render.
  useState(() => {
    if (
      typeof window !== "undefined" &&
      settings &&
      Object.keys(useAppStore.getState().userSettings).length === 0
    ) {
      useAppStore.setState({ userSettings: settings });
    }
  });
  return (
    <SettingsSeedContext.Provider value={settings}>
      {children}
    </SettingsSeedContext.Provider>
  );
}
```

- [ ] **Step 5: Use it in the layout; drop the copy-in effect**

In `src/app/(app)/layout.tsx` import `AppStoreSeed` and wrap the whole returned fragment's contents (from the skip link to `</SessionProvider>`) in `<AppStoreSeed settings={(settings as UserSettings) ?? null}>…</AppStoreSeed>`; change `<AppInitializer initialSettings={…} />` to `<AppInitializer />`.

In `AppInitializer.tsx` remove the `initialSettings` prop, its type, and the first `useEffect` (the `setUserSettings(initialSettings)` copy). Remove `setUserSettings` from the `useShallow` selector if now unused.

- [ ] **Step 6: Run the new tests and the whole suite**

Run: `npx vitest run src/store && npm test`
Expected: PASS. If an existing test relied on `AppInitializer` copying settings in, give that test `useAppStore.setState({ userSettings })` or render inside `AppStoreSeed`.

- [ ] **Step 7: Check for hydration warnings in a real browser**

Start the dev server (`dev` in launch.json) and load `/`, `/do`, `/inbox`, `/think`, `/remember/locations`, `/trash` signed in through Playwright (seeded cookie), collecting `console` messages. Expected: no "hydration" / "did not match" errors. Anything time-of-day based that now renders with settings on the server and differs on the client must be fixed at its source (render it after mount) before continuing.

- [ ] **Step 8: Lint, typecheck, build, measure, commit**

```bash
git add src/store src/components/providers/AppStoreSeed.tsx src/components/layout/AppInitializer.tsx "src/app/(app)/layout.tsx"
git commit -m "perf(shell): hydrate with the server's settings instead of copying them in after

..."
```

---

### Task 5: Fewer repeat renders of the shell

After Tasks 1–4, re-trace `/do` on the dev server (per-component track) and list shell components rendering 3+ times on load, with the store/query subscription that triggers each. Known now: `Sidebar` (9×) re-renders every `NavRow`, whose props are fresh closures each time.

**Files:**
- Modify: `src/components/layout/Navigation.tsx`
- Modify: whatever the re-trace names (e.g. `MobileTopBar.tsx`, `MobileDrawer.tsx`): narrow `useShallow` selections that take the whole `userSettings` object to the fields actually read.

- [ ] **Step 1: Re-trace and record** the per-component counts (dev build, `trace.mjs`-style Playwright trace, 4× CPU) for `/do`. Write the list into the commit message.

- [ ] **Step 2: Memoise `NavRow` with stable props**

Wrap: `const NavRow = memo(function NavRow({...}) {...});` (import `memo` from React). Hoist the rail's handlers and constant badges to module scope so props are stable across renders:

```tsx
const openCapture = () => useAppStore.getState().setCaptureModalOpen(true);
const openSearch = () => useAppStore.getState().setSearchModalOpen(true);
const openFocus = () =>
  useAppStore.getState().setActiveTimer({ taskTitle: "Focus Session" });
const openSettings = () => useAppStore.getState().setSettingsModalOpen(true);
const captureKbd = (
  <kbd className="sidebar-shortcut sidebar-capture-kbd" aria-hidden>
    C
  </kbd>
);
const searchKbd = (
  <span className="sidebar-shortcut text-caption" aria-hidden>
    ⌘K
  </span>
);
```

and use them in `Sidebar` (`onClick={openCapture}` `badge={captureKbd}` etc.). Pass `expanded`/`reducedMotion` directly instead of spreading a new `shared` object (spreading is fine for memo since it spreads primitives; keep it).

- [ ] **Step 3: Narrow the subscriptions the re-trace names**

For each, select only the fields rendered, e.g. in `MobileDrawer`:

```tsx
const { isMobileDrawerOpen, setIsMobileDrawerOpen, displayNameSetting, email, avatarColor, colorMode } =
  useAppStore(useShallow((s) => ({
    isMobileDrawerOpen: s.isMobileDrawerOpen,
    setIsMobileDrawerOpen: s.setIsMobileDrawerOpen,
    displayNameSetting: s.userSettings.display_name,
    email: typeof s.userSettings.email === "string" ? s.userSettings.email : "",
    avatarColor: s.userSettings.avatar_color,
    colorMode: s.userSettings.color_mode,
  })));
```

(adjust the component's later reads accordingly).

- [ ] **Step 4: Tests, lint, typecheck, build, re-trace, measure**

Run: `npx vitest run src/components/layout && npm run lint && npx tsc --noEmit && npm run build`; re-trace (render counts must drop) and measure. Revert anything that doesn't reduce renders or TBT.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout
git commit -m "perf(shell): stop re-rendering every nav row on unrelated updates

..."
```

---

### Task 6: Verify end to end, document, PR

- [ ] **Step 1: Full gates**

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Then with `next start -p 3000`: `npm run check:budgets`. If `package-lock.json` changed: `npx -y npm@10.8.2 ci --legacy-peer-deps=false`.

- [ ] **Step 2: Playwright**

`npx playwright test tests/accessibility.spec.ts tests/authed-do.spec.ts`, plus a signed-in pass (Playwright, seeded cookie, never pasted by hand) on `/do` and `/` at 412×823 and 1280×800 checking: the ritual opens from the rail and from Home's "You haven't planned your day yet" and shows content on first frame; the drawer opens/closes; the rail expands on hover and focus with labels; the rail shows the real name on first paint; no console errors.

- [ ] **Step 3: Final measurement** (3 runs each, `/do` and `/`) and update CLAUDE.md: *Verified state* table rows and date, *Known weak points* TBT figures, and replace the "Moving the page UIs to Server Components with client islands is the remaining fix" sentence with what remains, based on the numbers.

- [ ] **Step 4: Commit docs, push, open PR** with the before/after table and the tooltip-flash note; merge when `ci` is green and the user agrees.

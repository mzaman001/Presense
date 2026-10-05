# Phone performance: cut main-thread blocking on load

Date: 2026-10-04. Status: approved design, not yet implemented.

## Goal

Bring signed-in Total Blocking Time on `/do` and Home (`/`) from the measured
520–600 ms towards the 200 ms budget, with **no visible or behavioural change**.
If a step turns out to need a visible change, stop and show a mockup first.

This replaces "move page UIs to Server Components" as the first move (CLAUDE.md,
*Known weak points*). Measurement showed the page UIs themselves are a small
share of the cost; the shared app shell and code that loads without being used
are most of it. Whether a Server Components rewrite is still worth it is decided
after these fixes, from the new numbers.

## Baseline (2026-10-04, `main` at `380b13f`)

`next build` + `next start`, `scripts/lighthouse-authed.mjs` (mobile preset,
seeded test account), Edge as `CHROME_PATH`, three runs each:

| Route | TBT | LCP | Score |
|---|---|---|---|
| `/do` | 520 / 520 / 530 ms | 2.3 / 4.6 / 2.5 s | 83 / 58 / 81 |
| `/` | 600 / 540 / 560 ms | 2.9 / 2.6 / 2.6 s | 74 / 81 / 79 |

Script transfer: ~535 KiB over 37 requests (`/do`).

## Where the time goes

From Chrome traces under 4× CPU throttling: a React profiling build
(`next build --profile`, with temporary source maps) for attribution, and a dev
build for per-component timings. Neither was used for the numbers above.

| Cost on `/do` | Approx. | Cause |
|---|---|---|
| Ritual overlay | 150–250 ms | `RitualOverlayDynamic` renders `<RitualOverlay />` unconditionally, so the ~1,600-line ritual chunk downloads, evaluates and mounts on every page while closed. Its mount calls `toLocaleDateString` (~80 ms of first-use ICU setup), and the `ssr: false` bailout shows as a 77 ms "Recovered" client render. AGENTS.md already forbids unconditional `next/dynamic` mounts. |
| Sentry SDK chunk | ~130 ms | Already loaded at idle, but `withSentryConfig({ webpack: { treeshake: { removeTracing } } })` is webpack-only and `next build` uses Turbopack: `__SENTRY_TRACING__` and `browserTracingIntegration` are still in the 72 KB gz chunk. |
| Module evaluation at start-up | ~220 ms | Top-level code of every shell module runs in one task. |
| Repeat renders after hydration | 100–250 ms | A "Cascading Update" (94 ms), two expensive "Prewarm" passes (103 + 65 ms) and a second large commit (81 ms). |
| Shell components (dev timings) | — | `Sidebar` renders 9×, with 24 `NavRow`s, each a full tooltip (75 `TooltipTrigger`, 49 `TooltipRoot`, 33 `TooltipContent` renders). It is hidden by CSS on phones but still hydrated. `MobileTopBar` renders 8×, the closed `MobileDrawer` 5×. `AppInitializer` copies the server's settings into the store in a `useEffect`, so every settings reader renders twice. |
| `DoView` itself | 15–30 ms | Small. |

## Fixes, in order

Each fix is its own commit. After each: fresh production build, three
Lighthouse runs on `/do` and `/`. A fix that does not measurably reduce TBT
(or main-thread time in the trace) is dropped, not kept.

1. **Mount the ritual only when a ritual is active.** `RitualOverlayDynamic`
   renders the dynamic component only while `activeRitual !== null`. All of
   `RitualOverlay`'s effects only matter while it is open (checked). Preload
   the chunk when `AppInitializer` decides a ritual is due, so opening it is not
   delayed by the download.
2. **Strip Sentry tracing under Turbopack, in the browser only.** The server
   uses tracing (`tracesSampleRate` 0.1), so `compiler.define` (which applies
   to every bundle) is out. A `turbopack.rules` entry with the built-in
   `browser` condition runs a small loader on browser-bound `@sentry` files
   that replaces `__SENTRY_TRACING__` with `false`, which is what the webpack
   option's DefinePlugin does. Verify by grepping the built chunk.
   Error capture, buffering and the idle load stay as they are.
3. **Remove the rail's tooltips.** Checked on the live rail (2026-10-05): a
   row's tooltip appears on hover, the rail expands 100 ms later showing the
   same label, and the tooltip is then disabled; on keyboard focus it never
   appears. Eleven full tooltips are mounted for a sub-second flash of text the
   rail already shows, so they go (the flash is the one visible difference;
   called out in the PR). The closed mobile drawer already renders no content
   (Radix portal), so its cost is re-renders, handled in fix 5.
4. **Settings in the store before the first client render.** Seed the store
   so the hydrating render already has the server's settings, removing the
   post-hydration re-render. It must not cause a server/client markup mismatch
   (the server store is module-global, so it can't be written per request on
   the server). If that can't be done safely, measure and report instead.
5. **Fewer repeat renders of the shell.** Memoise `NavRow` (and anything else
   the trace shows re-rendering without changed props). If that isn't enough,
   enabling the React Compiler is a separate measured step that needs the
   user's go-ahead first.

Then re-measure, update CLAUDE.md's *Verified state* and *Known weak points*
with the new figures, and decide with the user whether to do the Server
Components rewrite.

## Out of scope

- Any visual or behaviour change.
- The Server Components rewrite (decided afterwards).
- `/api/telemetry` returning 429 during repeated test runs (per-user rate
  limit hit by the shared test account; not a performance issue).

## Verification

Every commit: `npm run lint` (0 errors), `npx tsc --noEmit`, `npm test`,
`npm run build`, `npm run check:budgets`. Before the PR: `npm ci` with npm
10.8.2 and `--legacy-peer-deps=false` if the lockfile changed, the Axe tests
(`tests/accessibility.spec.ts`), `tests/authed-do.spec.ts`, and a Playwright
pass on the signed-in `/do` and Home checking: the morning ritual still opens
when due and works, nav tooltips appear on hover and on keyboard focus, the
mobile drawer opens and closes, and no new console errors.

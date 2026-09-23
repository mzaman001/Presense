# CLAUDE.md — Presense

**Read [`AGENTS.md`](AGENTS.md) first.** It holds the architecture, the invariants and the quality bar. This file only adds the commands and the current measured state, so the two cannot drift apart.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Lint | `npm run lint` (must be 0 errors) |
| Typecheck | `npx tsc --noEmit` |
| Unit tests | `npm test` |
| Build | `npm run build` |
| E2E / a11y | `npx playwright test` |
| Bundle budgets | `npm run check:budgets` (needs a prod server on :3000) |
| Regenerate DB types | `npm run types:generate` |
| Check DB type drift | `npm run types:check` (needs Supabase CLI auth + network) |

`types:check` is **not** wired into `build`. It used to run as a `prebuild` hook, which meant any build without Supabase CLI access — CI included — failed before it started. Run it deliberately after a migration.

## Verified state (2026-09-23)

| Gate | Result |
|---|---|
| `npm ci` | not re-run since 2026-09-13 (lockfile content unchanged) |
| `npm run lint` | ✅ 0 errors (52 warnings) |
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 340 passed / 38 files |
| `npm run build` | ✅ |

The bundle and Web Vitals figures below predate the 2026-09 design pass; re-measure before relying on them.

Measured on the authenticated app shell (`next start`, uncompressed, headless Chromium):

| Metric | Before | After |
|---|---|---|
| JS transferred | 2,369 KB | 2,179 KB (−8.0%) |
| JS requests | 52 | 45 |
| Total transferred | 2,567 KB | 2,361 KB |

The bundle is still large. The Lighthouse figures under "Known weak points" predate this work — treat them as not yet re-measured, not as current truth.

## Known weak points

- **Nearly every page is a Client Component.** This is the single biggest cause of the bundle size and the loading spinners. Moving pages to Server Components with interactive islands is the highest-value remaining work.
- **Core Web Vitals were last measured 2026-08-09** on `/do`: LCP 6.4s, TBT 440ms, CLS 0.138 — all over budget. Re-measure before claiming any improvement.
- **`/login` ships ~1.1 MB of JS** for a single email field.
- Realtime echo suppression is a 500ms global window per table; it can drop a genuine remote update that lands right after a local write.

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

## Verified state (2026-09-25)

| Gate | Result |
|---|---|
| `npm ci` | not re-run since 2026-09-13 (lockfile content unchanged) |
| `npm run lint` | ✅ 0 errors (38 warnings) |
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 524 passed / 56 files |
| `npm run build` | ✅ |
| `npx playwright test tests/onboarding.spec.ts` | ✅ 2 passed (Axe, phone + desktop) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |

`/onboarding` initial JS: 200.1 KiB gz, 13 scripts (`next build` + `next start`, measured like check-budgets but with the seeded session; `/login` measured the same way: 202.9 KiB). check-budgets can't cover it: the route needs a signed-in account that hasn't finished onboarding.

The bundle and Web Vitals figures below predate the 2026-09 design pass; re-measure before relying on them.

Measured on the authenticated app shell (`next start`, uncompressed, headless Chromium):

| Metric | Before | After |
|---|---|---|
| JS transferred | 2,369 KB | 2,179 KB (−8.0%) |
| JS requests | 52 | 45 |
| Total transferred | 2,567 KB | 2,361 KB |

The bundle is still large. The Lighthouse figures under "Known weak points" predate this work — treat them as not yet re-measured, not as current truth.

## Known weak points

- **Total Blocking Time is still over budget.** Lighthouse (`scripts/lighthouse-authed.mjs`, mobile preset, two runs, 2026-09-25): `/do` LCP 2.3 / 2.4 s, TBT 400 / 440 ms, CLS 0, score 85 / 85. Home LCP 3.3 / 2.8 s, TBT 450 / 470 ms, CLS 0, score 74 / 80. LCP and CLS are fixed; TBT (budget 200 ms) is hydration work: every page UI is a client view (react-dom alone is ~1.2 s of scripting under 4x CPU throttling). Moving the page UIs to Server Components with client islands is the remaining fix.
- **Anything that server-renders hidden and waits for JS to show will wreck LCP.** The (app) template used to render every page at `opacity: 0` until framer-motion loaded (6.3 s of render delay on `/do`). Page entrances are CSS now; keep them that way.
- `/login` initial JS is 202.9 KiB gz under `next build` + `next start` (the old "~1.1 MB" note was stale). `perf-budgets.json` measures a webpack ANALYZE build, which reads lower.

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

## Production domain

| | |
|---|---|
| Live URL | **https://getpresense.vercel.app** (Vercel project `presense`, team `zamans-projects-4a7dbf2d`) |
| Old URL | `https://presense-kohl.vercel.app`: 308-redirects to the live URL (path and query kept), set in Vercel → Settings → Domains. **Never delete it:** the redirect needs it attached, and a released name can be claimed by anyone, who would then receive every old link and installed PWA. Don't link to it. |
| Not ours | `presense.vercel.app` is an unrelated app by someone else. Never link to it. |

- The code never hardcodes its own domain. Auth redirects come from the browser/request origin (`src/lib/auth-redirect.ts`, `src/app/auth/callback/route.ts`), which is why a domain change needs no code change. Keep it that way: derive absolute URLs from the request, don't add a domain constant.
- Changing the domain again means updating, outside the repo: Supabase → Authentication → URL Configuration (Site URL, plus `https://<domain>/auth/callback` in Redirect URLs, otherwise sign-in fails), the README demo link, and the Google OAuth consent screen's home page / privacy links. Google's redirect URI is Supabase's own callback, so it doesn't change.
- **Supabase redirect rules (checked 2026-10-02).** The Site URL is the live public address. It's where Supabase sends any return address that isn't allowed, so if it points at a protected `*-zamans-projects-*.vercel.app` URL, users land on Vercel's "You Need Access" page. Redirect URLs are exact addresses: never put `*` in the host. `*` matches any text up to a `.`, so `https://presense-*-zamans-projects-4a7dbf2d.vercel.app` also matched a free `presense-x-zamans-projects-4a7dbf2d.vercel.app` that anyone could register, letting them receive other people's sign-ins. Production uses the exact callback path; `**` is only for `localhost` ([Supabase docs](https://supabase.com/docs/guides/auth/redirect-urls)). To check without signing in: `GET <supabase-url>/auth/v1/verify?type=magiclink&token=x&redirect_to=<url>` redirects to `<url>` only if it's allowed, and to the Site URL otherwise. Supabase also always allows any path on the Site URL's own host (built in, can't be switched off), so `https://getpresense.vercel.app/anything` passing is expected, not a leftover `**` entry.

## Sign-in

Google is the only sign-in method (`src/app/(auth)/login`). Email links were removed on 2026-10-02 because Supabase's built-in mailer only delivers to the project's own team members, so they never reached real users. Don't bring email sign-in back without first setting up custom SMTP (Supabase → Authentication → Emails → SMTP Settings); the closed PR #54 has a link-plus-code version ready for that day.

`types:check` is **not** wired into `build`. It used to run as a `prebuild` hook, which meant any build without Supabase CLI access — CI included — failed before it started. Run it deliberately after a migration.

## Service worker and reminders

- The worker is `src/app/sw.ts`, bundled and served at `/serwist/sw.js` by the route `src/app/serwist/[path]/route.ts` (`@serwist/turbopack`). Until 2026-10-03 production had **no** worker: `@serwist/next` only hooks webpack, and `next build` uses Turbopack. Don't bring `@serwist/next` back. `public/sw.js` is a stale local leftover if you see one.
- It caches static assets only. Pages, RSC, `/api` and Supabase are network-only so no one's tasks stay in Cache Storage after sign-out; don't switch to Serwist's `defaultCache`. It's registered by a plain `register()` in `ServiceWorkerRegistrar`, not Serwist's provider: the provider ships `@serwist/window` (and would cache pages on navigation), and it pushed `/login` over its JS budget. `/serwist/` is outside the proxy matcher (a worker script can't redirect), `/~offline` is a public route (it's precached), and the CSP has `worker-src 'self'` (with `'strict-dynamic'`, `'self'` in script-src doesn't count).
- The planning reminder (`src/lib/reminders.ts`) only fires while a tab is open in the background. It shows through `registration.showNotification()` (Android throws on `new Notification()`), and permission is asked only from the Settings switch tap. Server-sent Web Push is Phase 1 of `reports/Task reminder notifications.md`.

## Scheduled jobs

`pg_cron` calls two Edge Functions: `cron_recurrence` (hourly at :05, re-creates completed recurring tasks; nothing in the app does this) and `cron_cleanup` (01:00 UTC, hard-deletes rows soft-deleted 30+ days ago). Defined in `supabase/migrations/20261002094935_cron_jobs_read_vault.sql`; the URL, the public anon key and `cron_secret` come from Vault, never inline. `cron_secret` must equal the `CRON_SECRET` Edge Function secret.

- **`cron.job_run_details` saying "succeeded" proves nothing**: pg_net only queues the request. Check the answer in `net._http_response` (kept ~6 h). Until 2026-10-02 the hourly job sent a placeholder key and got 401 on every run.
- **Edge Functions don't deploy on merge.** After changing `supabase/functions/*`, deploy (`supabase functions deploy <name>` or the Supabase MCP) and confirm a 200. Type-check first: `npx -y deno check supabase/functions/<name>/index.ts`.
- The old `cleanup_trash` function (deployed only, not in the repo) targets the dropped `explores` table and has no schedule any more; delete it in the dashboard.

## Verified state (2026-10-02)

| Gate | Result |
|---|---|
| `npm ci` | ✅ in CI on every PR (`.github/workflows/ci.yml`); lockfile last changed by #53 (2026-10-01) |
| `npm run lint` | ✅ 0 errors (33 warnings) |
| `npx tsc --noEmit` | ✅ clean |
| `npx -y deno check supabase/functions/*/index.ts` | ✅ clean (tsc excludes `supabase/`; Edge Functions run on Deno) |
| `npm test` | ✅ 692 passed / 61 files |
| `npm run build` | ✅ |
| `npx playwright test tests/accessibility.spec.ts -g login` | ✅ 2 passed (Axe scan + AA contrast, dark and light) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| GitHub code scanning / Dependabot | ✅ 0 open once the 2026-10-02 code-scanning fix merges / 0 open |

`ci` is a required status check on `main` (ruleset "main: require ci", admin bypass), so PRs can't merge until it passes and GitHub auto-merge works.

`/onboarding` initial JS: 200.1 KiB gz, 13 scripts (`next build` + `next start`, measured like check-budgets but with the seeded session; 2026-09-25). `/login` was 202.9 KiB measured the same way, before it became Google-only on 2026-10-02 (email form and Turnstile removed). On 2026-10-02 every script `/login` fetches until network idle, each gzipped, came to 235.7 KiB / 14 scripts before the brush ensō and 237.6 KiB after (+1.9 KiB; LCP unchanged). That method counts lazy chunks too, so it isn't directly comparable with the 202.9 figure. check-budgets can't cover it: the route needs a signed-in account that hasn't finished onboarding.

The bundle and Web Vitals figures below predate the 2026-09 design pass; re-measure before relying on them.

Measured on the authenticated app shell (`next start`, uncompressed, headless Chromium):

| Metric | Before | After |
|---|---|---|
| JS transferred | 2,369 KB | 2,179 KB (−8.0%) |
| JS requests | 52 | 45 |
| Total transferred | 2,567 KB | 2,361 KB |

The bundle is still large. See "Known weak points" for the current Lighthouse figures.

## Known weak points

- **Total Blocking Time is still over budget.** Lighthouse (`scripts/lighthouse-authed.mjs`, mobile preset, two runs, 2026-09-25): `/do` LCP 2.3 / 2.4 s, TBT 400 / 440 ms, CLS 0, score 85 / 85. Home LCP 3.3 / 2.8 s, TBT 450 / 470 ms, CLS 0, score 74 / 80. LCP and CLS are fixed; TBT (budget 200 ms) is hydration work: every page UI is a client view (react-dom alone is ~1.2 s of scripting under 4x CPU throttling). Moving the page UIs to Server Components with client islands is the remaining fix.
- **Anything that server-renders hidden and waits for JS to show will wreck LCP.** The (app) template used to render every page at `opacity: 0` until framer-motion loaded (6.3 s of render delay on `/do`). Page entrances are CSS now; keep them that way.
- `/login` initial JS was 202.9 KiB gz under `next build` + `next start` before the 2026-10-02 Google-only rewrite; see the 2026-10-02 network-idle figure above (237.6 KiB, a broader measure). `perf-budgets.json` measures a webpack ANALYZE build, which reads lower.

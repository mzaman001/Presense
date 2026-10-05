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

**Test account (`perf-test@presense.app`).** `scripts/seed-test-user.mjs` upserts it and prints a session cookie for `tests/authed-do.spec.ts`, `scripts/lighthouse-authed.mjs` and manual signed-in checks (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; a worktree needs its own copy and its own `npm ci`, since Turbopack won't compile from the main checkout's `node_modules`). The session is minted with the service role: `auth.admin.generateLink({ type: "magiclink" })` and then `verifyOtp({ token_hash })`. Nothing is emailed, and it works with the Email provider off (checked 2026-10-04: password and self-service OTP sign-in both still answer "Email logins are disabled"). The account has no known password: each run sets a random one. Don't switch the Email provider back on for testing.

**Playwright runs full Chromium (`channel: 'chromium'`), not the default headless shell.** The shell kills the renderer on `/` and `/do` ("bad Mojo message … OnDeviceSpeechRecognition") as soon as `useSpeechCapture` calls `SpeechRecognition.available()`. Real Chrome is fine. Run `npx playwright install chromium` once if the full build is missing.

`types:check` is **not** wired into `build`. It used to run as a `prebuild` hook, which meant any build without Supabase CLI access — CI included — failed before it started. Run it deliberately after a migration.

## Service worker and reminders

- The worker is `src/app/sw.ts`, bundled and served at `/serwist/sw.js` by the route `src/app/serwist/[path]/route.ts` (`@serwist/turbopack`). Until 2026-10-03 production had **no** worker: `@serwist/next` only hooks webpack, and `next build` uses Turbopack. Don't bring `@serwist/next` back. `public/sw.js` is a stale local leftover if you see one.
- It caches static assets only. Pages, RSC, `/api` and Supabase are network-only so no one's tasks stay in Cache Storage after sign-out; don't switch to Serwist's `defaultCache`. It's registered by a plain `register()` in `ServiceWorkerRegistrar`, not Serwist's provider: the provider ships `@serwist/window` (and would cache pages on navigation), and it pushed `/login` over its JS budget. `/serwist/` is outside the proxy matcher (a worker script can't redirect), `/~offline` is a public route (it's precached), and the CSP has `worker-src 'self'` (with `'strict-dynamic'`, `'self'` in script-src doesn't count).
- **Reminders are Web Push from the server** (Phase 1, 2026-10-04). Two kinds, both opt-in at a time the user chose: a task's "Remind me" (`items.remind_at`, never derived from `deadline`) and the morning/evening ritual at `nudge_time`/`shutdown_time` in `user_settings.timezone`, skipped if that ritual is already done today. `notifications_enabled = false` silences both. The app never shows a notification itself any more.
- Flow: `push_reminders` cron (every minute) → Edge Function `push_reminders` → `claim_push_reminders()` (marks rows sent as it returns them, `SKIP LOCKED`, drops anything >15 min late) → sends to every row in `push_subscriptions` for the user, deleting 404/410s. Devices register through `register_push_subscription()` (`src/lib/push.ts`) when the Settings switch is turned on, and again on every app open (`AppInitializer`), because browsers drop subscriptions silently. Sign-out unsubscribes.
- Payload is Safari's declarative format (`{ web_push: 8030, notification }`, built in `supabase/functions/_shared/push-payload.ts`); the worker's `push` handler shows it elsewhere. A task reminder opens `/do?remind=<id>` (`ReminderSheet`: Start, or Later at routine times). Later sets `snoozed_until` too, so repeated snoozes feed the stuck-task help; nothing ever pushes about a stuck or overdue task.
- Secrets: `VAPID_KEYS` (private JWK pair) and `VAPID_SUBJECT` are Edge Function secrets; the public key is `VAPID_PUBLIC_KEY` in `src/lib/push.ts`. Rotating means changing both; devices re-subscribe on next open. Lockfile changes: see the legacy-peer-deps note in the PR #64 history (`npm install --legacy-peer-deps=false` with npm 10.8.2).

## Timezone

- `user_settings.timezone` is the zone the server uses: ritual reminders (`push_reminders`) and the server-rendered Do list. **Settings → "Set timezone automatically"** (`timezone_auto`, default `true`, migration `20261005140203`) keeps it equal to the device's: `TimezoneSync` (in the `(app)` layout) saves the device zone when they differ, silently, on an idle callback (reading the zone during hydration cost Home ~25 ms of blocking). Off: the picker shows and the chosen zone stays. Like a phone's "Set automatically"; Sunsama and Todoist keep an account timezone the same way.
- **The Do list renders on the server** in the saved zone at request time (`do/page.tsx` → `DoView`'s `clock`). Its date logic goes through `src/lib/zoned-date.ts`, `src/lib/do-buckets.ts` and `DisplayClock` (`useLiveClock`: the hydrating render reuses the server's clock, then it moves to the device zone and a minute tick), with a fixed `en-US` locale. Don't reintroduce `toDateString()`/`toLocale*(undefined)` in `TaskCard` or the bucketing: the browser's zone or locale differing from the server's breaks hydration.
- **Known limitation:** with the switch *off* and the device elsewhere, the Do list and reminders follow the chosen zone but other screens (Home, calendar, rituals, capture's "tomorrow 9am") still use the device clock. With it on (the default) they agree. Chromium reports some zones by old ids (India is `Asia/Calcutta`); Settings shows `Intl`'s readable name, not the id.

## Scheduled jobs

`pg_cron` calls three Edge Functions: `push_reminders` (every minute, sends due reminders; `supabase/migrations/20261004090000_push_reminders.sql`), `cron_recurrence` (hourly at :05, re-creates completed recurring tasks; nothing in the app does this) and `cron_cleanup` (01:00 UTC, hard-deletes rows soft-deleted 30+ days ago). Defined in `supabase/migrations/20261002094935_cron_jobs_read_vault.sql`; the URL, the public anon key and `cron_secret` come from Vault, never inline. `cron_secret` must equal the `CRON_SECRET` Edge Function secret.

- **`cron.job_run_details` saying "succeeded" proves nothing**: pg_net only queues the request. Check the answer in `net._http_response` (kept ~6 h). Until 2026-10-02 the hourly job sent a placeholder key and got 401 on every run.
- **Edge Functions don't deploy on merge.** After changing `supabase/functions/*`, deploy (`supabase functions deploy <name>` or the Supabase MCP) and confirm a 200. Type-check first: `npx -y deno check supabase/functions/<name>/index.ts`.
- The old `cleanup_trash` function (deployed only, not in the repo) targets the dropped `explores` table and has no schedule any more; delete it in the dashboard.

## Verified state (2026-10-04)

Run on `main` at `b5c9b9b` (after #68).

| Gate | Result |
|---|---|
| `npm ci` | ✅ in CI on every PR (`.github/workflows/ci.yml`), and clean locally with CI's npm 10.8.2 and `--legacy-peer-deps=false`; lockfile last changed by #64 (2026-10-04) |
| `npm run lint` | ✅ 0 errors (33 warnings) |
| `npx tsc --noEmit` | ✅ clean |
| `npx -y deno check supabase/functions/*/index.ts` | ✅ clean, all four (`cron_cleanup`, `cron_recurrence`, `push_reminders`, `push_test`); tsc excludes `supabase/`, Edge Functions run on Deno |
| `npm test` | ✅ 853 passed / 81 files (2026-10-05) |
| `npm run build` | ✅ |
| Bundle budget gate (`check-budgets.mjs`, in CI) | ✅ `/login` 164.4 KiB gz vs 164.7 budget (2026-10-05, with the React Compiler, which added 1.8 KiB: only 0.3 KiB headroom left). CI measures a `--webpack` ANALYZE build; the same check against a Turbopack `next build` reads ~202 KiB on `main` too, so compare like with like |
| `npx playwright test tests/accessibility.spec.ts -g login` | ✅ 2 passed (Axe scan + AA contrast, dark and light) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| GitHub code scanning / Dependabot | ⚠️ 1 open / ✅ 0 open. The one is osv-scanner alert #82, `braces@3.0.3` (GHSA-vfj7-8cjw-p6xm, high), reached only through the ESLint chain (`@next/eslint-plugin-next` → `fast-glob` → `micromatch`); dev-only, nothing ships it. npm's only fix is a breaking downgrade of `eslint-config-next`, so it waits for an upstream release. |
| Push reminders, end to end | ✅ real Microsoft Edge subscribed on the live site got a reminder from the deployed `push_reminders` within seconds (twice); Android (Brave) registered, got a test push and a task reminder. Not yet seen: iPhone, a ritual push at a real nudge/shutdown time. |

The seeded test account signs in again since #69 (session minted with the service role, see *Sign-in* above), so `tests/authed-do.spec.ts` and `scripts/lighthouse-authed.mjs` reach signed-in pages. Pasting that session into a browser by hand is blocked by Claude Code's auto-mode credential check; go through Playwright, which injects the cookie itself.

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

- **Total Blocking Time is still over budget (200 ms), though lower.** `node scripts/lighthouse-authed.mjs <url> --runs 5` (mobile preset, real 4x CPU throttling, Edge as `CHROME_PATH`, median of 5), all three builds re-measured back to back on 2026-10-05: before #72 `/do` 611 ms / Home 557 ms; after #72 (ritual overlay mounted only while open, Sentry tracing stripped from the browser bundle, no rail tooltips, store hydrated with the server's settings) ~476 / ~476 ms; with the React Compiler (`reactCompiler: true`, Babel plugin) ~400 / ~411 ms. Runs vary by ±25 ms, so compare medians of builds measured in one sitting.
  - **Windows: check for leftover browsers before trusting a number.** chrome-launcher's EPERM also left every run's headless Edge running (942 processes and 2.5 GB of temp profiles after two days); they loaded the machine and inflated #72's first figures (reported as 589 → 422). `lighthouse-authed.mjs` now stops them after each run.
  - **Measure the ordinary load.** The script seeds the test account with today's rituals done (`--rituals-done`); without that a ritual opened 2 s into every measured load and was counted as page cost. `--ritual-due` measures that case on purpose (442 ms on `/do`).
  - **What's left** (2026-10-06, after not preloading the mono font: `/do` ~295 ms, Home ~385 ms, control 386 / 464 back to back): Home's dashboard still renders only after hydration (`HomeView`'s `hydrated` gate, device-timezone week and day boundaries), the same pattern the Do list had before #75 and the largest remaining cost on Home; start-up module evaluation (~110 ms on `/do`, ~61 ms of it Next.js/React itself; app-controllable parts are ~10 ms: `pino` in the browser, `lucide-react`, Supabase's cookie parsing); style and layout before first paint (counts toward FCP, not TBT).
  - **Tried and measured worse, don't retry blindly:** loading framer-motion's `domMax` with the page instead of via `LazyMotion`'s async loader (`/do` 400/384 → 537/467 ms: the parse costs more than the re-render it saves), and fetching it at idle or first interaction (`/do` 445/478). Hand-memoising the rail's `NavRow`s (no gain; the React Compiler covers it).
  - **Fonts:** only Inter and Newsreader are preloaded (both on every first screen). JetBrains Mono has `preload: false`: preloading it on every page for text no first screen shows cost ~90 ms of TBT and 0.2–0.3 s of LCP.
- **Anything that server-renders hidden and waits for JS to show will wreck LCP.** The (app) template used to render every page at `opacity: 0` until framer-motion loaded (6.3 s of render delay on `/do`). Page entrances are CSS now; keep them that way.
- `/login` initial JS was 202.9 KiB gz under `next build` + `next start` before the 2026-10-02 Google-only rewrite; see the 2026-10-02 network-idle figure above (237.6 KiB, a broader measure). `perf-budgets.json` measures a webpack ANALYZE build, which reads lower.

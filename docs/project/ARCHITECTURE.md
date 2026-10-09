# Architecture

How Presense fits together, as of 2026-10-08. For the rules (invariants, data access, design system) read [`AGENTS.md`](../../AGENTS.md); for commands, measured performance and operational detail (domains, reminders, timezone, cron) read [`CLAUDE.md`](../../CLAUDE.md). This file doesn't repeat them.

## Shape

A single-user planner: one account sees only its own rows. Next.js 16 (App Router, Turbopack, React 19 with the React Compiler) on Vercel (`syd1`), Supabase for Postgres, Auth (Google only), Realtime and Edge Functions, installed as a PWA.

## Routes (`src/app`)

| Route | What it is |
|---|---|
| `(app)/` | Home: greeting, today's focus, week in review |
| `(app)/inbox` | Captures not yet sorted |
| `(app)/do` | Tasks. **Rendered on the server** in the user's saved timezone (`DoView`, `src/lib/do-buckets.ts`, `zoned-date.ts`) |
| `(app)/think`, `think/[id]` | Threads of notes; entries are added and removed through RPCs (`append_thread_entry`, `remove_thread_entry`) |
| `(app)/remember`, `remember/locations` | Where things are kept |
| `(app)/trash` | 30-day trash for items, threads and locations |
| `(app)/share` | Web Share Target: hands shared text to Quick Capture |
| `(auth)/login`, `auth/callback` | Google sign-in and the OAuth code exchange |
| `onboarding` | First-run wizard |
| `(legal)/privacy`, `(legal)/terms`, `~offline` | Public pages; `~offline` is the service worker's fallback |
| `api/account` | Account deletion (service role) |
| `api/telemetry` | Web Vitals reports; the client sends only poor ones (public, rate-limited) |
| `serwist/[path]` | Serves the bundled service worker (`src/app/sw.ts`) |

`src/proxy.ts` runs on every matched request: CSP nonce, `getClaims()` auth, redirect to `/login`. The `(app)` layout reads the session and settings on the server and seeds the client (`SessionProvider`, `AppStoreSeed`), and applies the account's colour mode before paint (`src/lib/theme-boot.ts`).

## Data

Tables (all with per-operation RLS, `auth.uid() = user_id`): `items` (tasks and inbox captures), `threads`, `locations`, `categories`, `user_settings`, `ritual_logs`, `session_logs` (focus sessions), `push_subscriptions`. Types are generated into `src/types/database.types.ts` (`npm run types:generate`).

How a capture travels:

1. **Parse, on the device.** `src/lib/capture-router.ts` (chrono-node with custom rules in `chrono-custom.ts`) decides task, thought or location, and reads dates, repeats and places. Nothing is sent to an AI service.
2. **Save locally first.** `src/lib/capture-outbox.ts` writes the rows, with their ids, to localStorage, then syncs them (`CaptureSync`). Retries reuse the ids, so nothing is duplicated and nothing is lost offline.
3. **Read through TanStack Query**, with optimistic edits through `src/lib/task-cache.ts` and status changes only through `src/lib/item-lifecycle.ts`.
4. **Stay live.** `RealtimeProvider` holds one channel per table and invalidates queries, ignoring echoes of this device's own writes.

## Background jobs

`pg_cron` calls the scheduled Edge Functions (`supabase/functions`, Deno), which require the `x-cron-secret` header:

| Function | Schedule | Job |
|---|---|---|
| `push_reminders` | every minute | Sends due task and ritual reminders as Web Push (`_shared/send-push.ts`, payload in `_shared/push-payload.ts`) |
| `cron_recurrence` | hourly at :05 | Re-creates completed recurring tasks |
| `cron_cleanup` | 01:00 UTC | Hard-deletes rows trashed 30+ days ago |
| `push_test` | not scheduled | Sends a test push to the caller's own devices (authenticated with the user's token; for manual checks, the app doesn't call it) |

The schedules are in migrations (`20261002094935_cron_jobs_read_vault.sql`, `20261004090000_push_reminders.sql`) and read their URL and keys from Vault.

## Client

- **State:** zustand (`src/store/useAppStore.ts`) for UI state and settings, TanStack Query for server data.
- **UI:** owned primitives in `src/components/ui`, features in `src/components/features`, the app shell in `src/components/layout`. Tailwind 4 with tokens in `src/app/globals.css`; framer-motion through `LazyMotion` (features loaded async).
- **PWA:** Serwist via `@serwist/turbopack`; static assets cached, pages and data network-only.
- **Errors:** route boundaries (`error.tsx` → `AppErrorFallback`), `ModalErrorBoundary` and `global-error.tsx` all report to Sentry; client code through the lazy `src/lib/sentry-client.ts`.

## Tests and checks

- **Unit and component tests:** Vitest with jsdom, next to the code (`__tests__/`).
- **Browser tests:** Playwright in `tests/`, on full Chromium. They seed `perf-test@presense.app` once per run (`tests/global-setup.ts`).
- **CI (`.github/workflows/ci.yml`):** lint, types, unit tests, build, bundle budgets, the public Playwright tests, and `deno check` on the Edge Functions.
- **Security scans:** CodeQL, Semgrep (`p/default`) and OSV.

## Deploying your own

1. A Supabase project. `npx supabase link`, then `npx supabase db push`.

   **Caveat:** migrations `001`–`009` predate the timestamped ones and don't exactly match what production ran. Squashing them into one baseline is an open task, so check the result against `src/types/database.types.ts`.
2. Enable Google as the Auth provider. Add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for development) to Redirect URLs.
3. Deploy the four Edge Functions (`npx supabase functions deploy <name>`), and set these function secrets:
   - `CRON_SECRET`;
   - `VAPID_KEYS` and `VAPID_SUBJECT`, for push.

   The public VAPID key lives in `src/lib/push.ts`; replace it with yours.
4. Create the three Vault secrets the cron migration reads:

   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<anon key>', 'anon_key');
   select vault.create_secret('<same as CRON_SECRET>', 'cron_secret');
   ```
5. On Vercel (Node 22), set the variables from `.env.example`. Upstash Redis is required in production: without it, rate-limited routes refuse requests.

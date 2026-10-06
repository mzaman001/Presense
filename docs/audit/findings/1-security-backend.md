# Audit findings: 1-security-backend

2026-10-07, `main` at `c28daf7`. The live checks ran against production: Supabase project `mhfzmgrrtruxuiscvbhm` (advisors and read-only catalog queries) and https://getpresense.vercel.app (headers, one telemetry probe).

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 3 |
| P2 | 6 |
| P3 | 6 |

**What's solid** (checked, nothing to do):
- RLS is on for all 8 public tables. Each has separate select/insert/update/delete policies for `authenticated`, using `(select auth.uid()) = user_id`.
- Every `SECURITY DEFINER` function pins `search_path`, and none is executable by `anon`.
- Every user-owned table cascades from `auth.users`, so account deletion is complete.
- The cron jobs read their secrets from Vault, and all 366 runs in the last 6 h answered 200.
- The CSP is nonce-based with `strict-dynamic`, alongside HSTS, `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- The rate limiter is backed by Redis in production (the probe got a 204).
- Edge functions are gated by `x-cron-secret`, and `push_test` by the user's JWT plus a 20 s cooldown.

---

### [P1] Voice capture is blocked on the live site by the app's own Permissions-Policy
- **Where:** `next.config.ts:17-20` (`microphone=()`), applied to every route by `headers()`.
- **Evidence:** live `/login` sends `Permissions-Policy: camera=(), microphone=(), geolocation=()`. In Playwright's full Chromium on the live site, with microphone permission granted, `document.permissionsPolicy.allowsFeature("microphone")` is `false`, `getUserMedia({audio:true})` throws `NotAllowedError`, and `SpeechRecognition.start()` errors `not-allowed`. The header dates from `c405bdef` (2026-06-17), before voice capture existed (#58, 2026-10-02). #61 ("only say the mic is blocked when it really is") looks like a symptom of this.
- **Impact:** voice capture can't work for anyone on Chrome, Edge or Android, whatever they allow. The mic button shows a "blocked" state.
- **Fix:** `microphone=(self)`. Keep `camera=()` and `geolocation=()`.
- **Verify:** repeat the Playwright probe: `allowsFeature("microphone") === true` and recognition reaches `onstart`. Add a unit test that the header contains `microphone=(self)`.
- **Confidence:** confirmed.

### [P1] A task that ever had a focus session can't be permanently deleted, and it blocks the nightly purge of every other task
- **Where:** FK `session_logs_task_id_fkey` → `items` has `ON DELETE NO ACTION` (live catalog). `src/app/(app)/trash/TrashList.tsx:91-97` hard-deletes one item. `supabase/functions/cron_cleanup/index.ts:49-54` hard-deletes all expired items in **one** statement.
- **Evidence:** `PomodoroTimer.tsx:150-156` inserts `session_logs.task_id = activeTimer.taskId`. A hard delete of that item violates the FK (23503). Trash shows "Failed to delete" with the raw Postgres message. `cron_cleanup` runs a single `DELETE … WHERE status='deleted' AND deleted_at <= cutoff`, so one such row fails the whole statement. It then returns **HTTP 200** with `"status":"partial"`, so `net._http_response` looks healthy. Nothing is stuck today (0 items past 30 days, 4 session logs), so the cleanup half is latent.
- **Impact:** "Delete forever" fails for any task you've focused on. After 30 days the first such task stops all task purging, silently.
- **Fix:** migration: `ALTER TABLE session_logs DROP CONSTRAINT session_logs_task_id_fkey, ADD CONSTRAINT … FOREIGN KEY (task_id) REFERENCES items(id) ON DELETE SET NULL`. Focus minutes stay in the stats; the link to the task goes. Make `cron_cleanup` return a non-200 on `partial` so monitoring sees it.
- **Verify:** SQL test: insert an item and a session log, delete the item, and expect success with `task_id` set to null. In the browser, "Delete forever" on a focused task succeeds.
- **Confidence:** confirmed (FK and code). The cleanup half is latent.

### [P1] Recurring tasks can't be stopped, and the next instance can get a stale date
- **Where:** `supabase/functions/cron_recurrence/index.ts:49-123`, index `items_unique_active_recurring_idx` (`20260817000003`).
- **Evidence:** every hourly run selects **all** `status='done'` recurring items completed in the last 90 days. For each one it inserts a new active copy and treats 23505 (an active sibling exists) as success. Nothing marks a done instance as already renewed, and nothing removes `recurrence` from done instances. So:
  1. If the user deletes the upcoming instance, there's no active sibling at the next run, and a done instance recreates it.
  2. Clearing the repeat rule on the active instance doesn't help, because the done instances still carry the rule.
  3. With several done instances (daily task, a week of completions), the first row processed decides the new deadline. Row order is unspecified, so an old completion can produce a deadline already in the past, and the task lands in "Earlier".
- **Impact:** a deleted recurring task comes back within an hour, for up to 90 days. A renewed task can show as overdue straight away.
- **Fix:** renew only from the most recent done instance per series, and record the renewal. Add `items.renewed_at`; set it when the next copy is inserted, or when it already exists. Skip instances with `renewed_at` set. Also stop the series when the user deletes the active instance or turns off its recurrence: treat the series key `(user_id, title, recurrence)` as ended if a `deleted` row or a rule change exists after the last completion. Simplest version: when the app deletes an active recurring instance or clears its recurrence, also null `recurrence` on that series' done rows.
- **Verify:**
  1. Write a Deno test for the selection logic.
  2. On a branch DB: complete, wait, delete the new instance, run the function, and expect nothing recreated.
  3. Complete twice, run the function, and expect a deadline after the latest completion.
- **Confidence:** likely, from the code. Not reproduced against data.

### [P2] Ritual reminder claim costs ~185 ms per minute with 11 users and scales linearly
- **Where:** `claim_push_reminders()` (migrations `20261004090000`, `20261004140000`): `cross join lateral (select … from pg_catalog.pg_timezone_names n where n.name = s.timezone)`, run for every settings row, twice per call.
- **Evidence:** a single lookup of `pg_timezone_names` takes **1,018 ms** (EXPLAIN ANALYZE: a function scan over 1,196 rows). `pg_stat_statements` shows `claim_push_reminders` at 4,312 calls, a mean of **185 ms**, a max of **4.8 s**, and **800 s** total.
- **Impact:** the cost grows with users who have a push subscription. A few hundred would make a run take longer than its one-minute schedule, so runs overlap and steal database CPU from the app.
- **Fix:** validate timezones once, on write. A `safe_tz(text)` plpgsql helper that tries `now() AT TIME ZONE $1` and returns `'UTC'` on `invalid_parameter_value` is microseconds per call. Use it in the claim function, or add a CHECK or trigger on `user_settings.timezone` and use the column directly.
- **Verify:** EXPLAIN ANALYZE the claim function's ritual CTEs before and after; mean time in `pg_stat_statements` drops to low milliseconds.
- **Confidence:** confirmed.

### [P2] Ritual reminders set between 23:46 and 23:59 never fire
- **Where:** `claim_push_reminders()`: `l.local_now::time < l.nudge_time + interval '15 minutes'` (and the same for `shutdown_time`).
- **Evidence:** `time '23:50' + interval '15 minutes'` = `00:05`, so `23:55 >= 23:50 AND 23:55 < 00:05` is false (checked live).
- **Impact:** an evening wind-down set late (e.g. 23:50) never notifies, with no error.
- **Fix:** compare in minutes modulo 1440, or compare `local_now` against a timestamp built from `local_day + nudge_time`.
- **Verify:** a SQL test with a shutdown time of 23:50 and a local time of 23:55 claims one row.
- **Confidence:** confirmed.

### [P2] Every page load sends ~5 serverless calls and ~5 Sentry events for web vitals
- **Where:** `src/components/layout/WebVitalsReporter.tsx:24-32` → `src/app/api/telemetry/route.ts:208-230`.
- **Evidence:** every metric from `useReportWebVitals` is posted. The route calls `Sentry.captureMessage(name, { level: "info" })` and `console.warn` for each one. The proxy also runs `getClaims` on each call.
- **Impact:** Sentry quota and Issues fill with info "messages" (TTFB, FCP, LCP…) that nobody reads. Vercel function invocations and logs grow about 5× page views. Real errors get buried.
- **Fix:** send only `poor` ratings (or a 10% sample), batched into one beacon on `visibilitychange`. Record web vitals as Sentry measurements or tags, or drop them in favour of Vercel Speed Insights. Remove the `console.warn`.
- **Verify:** one page view produces at most one `/api/telemetry` request, and none when every vital is good.
- **Confidence:** confirmed (code).

### [P2] The repo's first nine migrations aren't what production ran
- **Where:** `supabase/migrations/001_baseline.sql` … `009_rename_category_rpc.sql` against `supabase_migrations.schema_migrations`.
- **Evidence:** all 40 versions match. For 001–009, live names are `schema, rls, search, add_theme_settings, do_space_extensions, do_space_startdate_rrule, inbox, think_space, think_and_explore`. The repo files are `baseline, add_linked_people, add_category_colors, fix_onboarding_complete, …`.
- **Impact:** `supabase db reset`, a preview branch, or a disaster-recovery rebuild from the repo may not reproduce production's schema, RLS or functions. Nothing in CI checks this (`types:check` isn't wired in).
- **Fix:** take `supabase db dump --schema public` from production and diff it against a local reset of the repo migrations. If they differ, squash into a single new baseline matching production, and mark the old versions applied with `supabase migration repair`.
- **Verify:** a schema diff between a local reset and production comes back empty.
- **Confidence:** likely (versions match, names don't; contents not diffed).

### [P2] Two high-severity advisories in production dependencies
- **Where:** `npm audit --omit=dev`: `sharp <0.35.5` (GHSA-wq5f-xc86-pv6w, librsvg) and `source-map-js 1.0.0-1.2.1` (GHSA-68fv-2mgg-jv7q, event-loop DoS).
- **Evidence:** both report "fix available via `npm audit fix`". CLAUDE.md's verified state (2026-10-04) says 0.
- **Impact:** low real exposure. Vercel optimises images with its own service, and source-map-js runs at build time. But the stated gate is failing.
- **Fix:** `npm audit fix` (with `--legacy-peer-deps=false` and npm 10.8.2, per the lockfile note), then build.
- **Verify:** `npm audit --omit=dev` reports 0. CI `npm ci` passes.
- **Confidence:** confirmed.

### [P2] `/api/capture` is an unused authenticated endpoint
- **Where:** `src/app/api/capture/route.ts`.
- **Evidence:** no caller in `src/` (grep). Capture runs `routeCapture` on the client. The route runs the full NLP router on 10,000 characters for any signed-in user, at up to 100 calls a minute.
- **Impact:** extra attack and CPU surface, and code that drifts from the real capture path.
- **Fix:** delete the route and its schema (`captureSchema`), unless a programmatic client is planned.
- **Verify:** `grep -r "api/capture" src` is empty, and the build passes.
- **Confidence:** confirmed.

### [P3] `anon` still holds table privileges on every public table
- **Where:** live grants: `has_table_privilege('anon', <table>, 'SELECT')` is true for all 8 tables.
- **Evidence:** RLS has no `anon` policies, so reads return nothing today.
- **Impact:** defence in depth only. A future permissive policy written `TO public`, or RLS switched off by a migration, would expose data to unauthenticated requests.
- **Fix:** `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;`, and alter default privileges the same way.
- **Confidence:** confirmed.

### [P3] The CSP allows connections to any Supabase project
- **Where:** `src/proxy.ts:55-56`: `connect-src 'self' https://*.supabase.co wss://*.supabase.co`.
- **Impact:** if XSS ever lands, data can be sent to an attacker's own `*.supabase.co` project without breaking the CSP.
- **Fix:** use the exact project origin from `NEXT_PUBLIC_SUPABASE_URL` (and its `wss:` form), as `img-src` already does.
- **Confidence:** confirmed.

### [P3] Errors leak raw database text to users and callers
- **Where:** `TrashList.tsx:99-101` (toast shows `err.message`), `supabase/functions/push_test/index.ts:236,245`, `push_reminders/index.ts:51,60` (`error.message` in the JSON body).
- **Impact:** users see Postgres constraint names (as in the FK case above). The cron and test responses describe the schema.
- **Fix:** show a plain message, and log the detail.
- **Confidence:** confirmed.

### [P3] Leaked-password protection is off (Supabase advisor)
- **Where:** Auth settings.
- **Impact:** none today: email and password sign-in is disabled (Google only). It matters only if email sign-in comes back.
- **Fix:** turn it on together with any future email sign-in (CLAUDE.md, *Sign-in*).
- **Confidence:** confirmed.

### [P3] `pg_trgm` is installed in `public` (Supabase advisor), and 12 indexes have never been used
- **Where:** extension placement; unused `idx_items_title`, `idx_threads_title`, `items_due_reminders_idx`, `idx_items_active`, and others.
- **Impact:** small. With only 11 users, Postgres scans sequentially, so "unused" mostly reflects data size. `items_due_reminders_idx` should start being used as rows grow.
- **Fix:** move `pg_trgm` to `extensions` when convenient. Re-check unused indexes at 10× the data before dropping any.
- **Confidence:** confirmed (advisor).

### [P3] Stale comment: functions are in Sydney, not iad1
- **Where:** `src/proxy.ts:140-144`.
- **Evidence:** `vercel.json` sets `regions: ["syd1"]`, and live responses carry `X-Vercel-Id: bom1::syd1::…`, so functions sit next to the ap-southeast-2 database.
- **Fix:** correct the comment. The `getClaims` choice still stands, since it avoids a round trip.
- **Confidence:** confirmed.

---

## Coverage

Files read: 52 / 77 in the slice.

Read in full: `src/proxy.ts`, `next.config.ts`, all three API routes, `auth/callback`, `auth-redirect`, `supabase.ts`, `supabase-server.ts`, `env.ts`, `public-env.ts`, `rate-limit.ts`, `push.ts`, `user-settings-server.ts`, `instrumentation*.ts`, `sentry.server.config.ts`, `vercel.json`, `.env.example`, `.sentryclirc`, every Edge Function except `cron_recurrence/next-occurrence.ts`, and the cron, push and recurrence migrations.

The live database was checked through the catalog instead of re-reading the historical migrations: policies, functions, grants, FKs, cron jobs and migration history.

Not read line by line: the older migrations 001–20260923 (superseded; their live result was verified instead), `cron_recurrence/next-occurrence.ts` (covered by slice 2's recurrence logic review), `sentry.edge.config.ts`, the turbopack loader and its test, the three colocated tests in `src/lib/__tests__/` (auth-redirect, push, rate-limit), and `supabase/config.toml` (only grepped for auth settings; it configures the local CLI, not production).

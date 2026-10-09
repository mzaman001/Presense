# Audit findings: 2-data-layer

2026-10-07, `main` at `7e1adb6`. Method: code reading, a throwaway fuzz test, and read-only production checks.
- **Fuzz test:** 148 hostile inputs (huge offsets, impossible dates, odd times) run through the real `parseTaskText` → `routeCapture` → `rowsForCapture` path, plus a printed sample of edge cases.
- **Node checks:** which timezones `Intl` accepts on Node 24, and how pino serialises errors.
- **Production (read-only):** column defaults, row counts, and `pg_stat_statements`.

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 1 |
| P2 | 5 |
| P3 | 8 |

**What's solid** (checked, nothing to do):
- **Offline capture outbox:**
  - row ids are fixed at capture, so a retry can't duplicate;
  - partial saves only resend what's missing;
  - overlapping flushes share one run;
  - a storage failure falls back to memory.
- **Fuzzing:** no input made the parser or router throw or produce an invalid date.
- **Realtime:** one channel per table, debounced, and joins in-flight refetches.
- **Echo suppression** is per row.
- **Stuck-task rule and planned-days count** follow the stated research and avoid nagging and streaks.
- **Status writes:** item-lifecycle patches cover nearly every one of them.

Also from slice 1's rollout: `claim_push_reminders` has averaged ~13 ms per run since `safe_timezone` (6 runs, 09:41–09:47 UTC), against a 157 ms average before.

---

### [P1] If you skip the morning plan, the evening "Wind down" notification opens the app to nothing
- **Where:** `src/lib/rituals.ts:86` (`currentMinutes >= shutdownMinutes && !eveningDone && morningDone`) and `claim_push_reminders()` (evening branch: only `last_evening_ritual_date`).
- **Evidence:** the client offers the evening ritual only when today's morning plan is done. The sidebar (`Navigation.tsx:143-163`) and the auto-open (`AppInitializer.tsx:63-73`) both go through `getRitualDecision`; with the morning skipped it returns `morning_window_missed`/`none`. The server sends the evening push whether or not the morning was done.
- **Impact:** a user who didn't plan in the morning gets "Wind down: Close the day and set up tomorrow" at shutdown time. Tapping it opens Home and nothing happens: a notification that leads nowhere.
- **Fix (a product choice):**
  - **(a)** Let the evening ritual stand alone: drop `&& morningDone` from the client rule. The evening sweep and "set up tomorrow" make sense without a morning plan.
  - **(b)** Keep the rule, and add `and s.last_ritual_date = local_day` to the server's evening branch.

  (a) matches the push copy and the "close the day" intent.
- **Verify:** a unit test for `getRitualDecision` (shutdown passed, morning not done → evening), or a SQL test for (b).
- **Confidence:** confirmed from the code paths.

### [P2] A device reporting an invalid timezone breaks the Do page on every visit
- **Where:** `src/components/layout/TimezoneSync.tsx:33-35` saves `deviceTimeZone()` unvalidated. `src/app/(app)/do/page.tsx:40` passes `settings.timezone` to `DoView`. `src/lib/zoned-date.ts:23` does `new Intl.DateTimeFormat(…, { timeZone })`.
- **Evidence:** on Node 24, `new Intl.DateTimeFormat("en-US", { timeZone: "Etc/Unknown" })` throws `RangeError`, and so does any unknown id. Chromium reports `Etc/Unknown` when the OS timezone is misconfigured, and automatic timezone (on by default) saves whatever the device reports. `user_settings.timezone` has no constraint.
- **Impact:** after one such save, the server render of `/do` throws on every visit (the error page), and the client formatters throw too. Server reminders survive, because `safe_timezone` falls back to UTC.
- **Fix:** add `validTimeZone(z)` to `zoned-date.ts` (try `Intl.DateTimeFormat`, return `undefined`/`"UTC"` on failure). Use it in `TimezoneSync` (don't save an invalid zone) and in `loadClock`/`dateKeyIn`'s formatter (fall back to UTC).
- **Verify:** unit tests: `TimezoneSync` with `deviceTimeZone()` returning `"Etc/Unknown"` makes no update, and `bucketTasks` with `timeZone: "Not/AZone"` doesn't throw.
- **Confidence:** confirmed mechanism. How often devices report it is unknown.

### [P2] Server error logs lose every error's message and stack
- **Where:** `src/lib/logger.ts:22-26`: `pinoLogger.error({ args }, message)`.
- **Evidence:** pino serialises an `Error` inside `args` as `{}`. A reproduction printed `"args":[{}],"msg":"[account] deleteUser failed:"`, while the same error under the `err` key keeps `type`, `message` and `stack`. There are 11 `logger.error(...)` call sites in `src/`.
- **Impact:** Vercel logs show only the label, with no detail. Some sites also send to Sentry, but those that don't, plus every rate-limit, env and account log, are blind.
- **Fix:** in the wrapper, put the first `Error` in `args` under `err` (pino's serializer) and leave the rest in `args`.
- **Verify:** a unit test that `logger.error("x", new Error("boom"))` produces `err.message === "boom"`.
- **Confidence:** confirmed.

### [P2] Home's "Open Threads" counts trashed and archived threads, and both Home counts stop at 100
- **Where:** `src/lib/dashboard.ts:65` (`threads … .eq("user_id", userId).range(0, 99)`, no status filter) → `HomeView.tsx:829` (`threads.length`). Active tasks: `dashboard.ts:54-58` `.range(0, 99)` → `HomeView.tsx:817`.
- **Impact:** the Open Threads number includes threads in the trash or archived. A user with over 100 active tasks sees "100 Active Tasks".
- **Fix:**
  - **Threads:** `.eq("status", "active")` (or `.not("status", "in", "(deleted,archived)")`, per the vocabulary doc).
  - **Counts:** use `select("id", { count: "exact", head: true })` queries (as `useInboxCount` does) instead of `rows.length` from a capped list. Keep the capped lists only where rows are rendered.
- **Verify:** a test with a trashed thread in the mocked response, expecting the count to exclude it.
- **Confidence:** confirmed (code).

### [P2] Undoing "complete", or restoring from Trash, a recurring task fails once the next copy exists
- **Where:** unique index `items_unique_active_recurring_idx (user_id, title, recurrence) WHERE status='active'`, against `uncompleteTaskPatch` (`item-lifecycle.ts:20`) and `restoreItemPatch`.
- **Evidence:** `cron_recurrence` runs hourly at :05 and inserts the next active copy. Reactivating the completed (or trashed) instance afterwards violates the index (23505).
- **Impact:** complete a daily task at 10:04, tap Undo at 10:06, and you get an error toast; the task stays done. Restoring a trashed recurring task fails the same way.
- **Fix:** when reactivating an instance whose series already has an active copy, either delete that newer copy (the undo case: the newer copy was created from this completion; `recurrence_renewed_at` now tells you so) or show a plain "The next one is already on your list" message instead of the raw error.
- **Verify:** an integration-style test with mocked 23505, expecting the newer copy removed and the undo to succeed.
- **Confidence:** likely (from the index and code). Not reproduced.

### [P2] One failed optimistic edit can undo another, unrelated one on screen
- **Where:** `src/lib/task-cache.ts:56-81` (`patchTaskCaches` snapshots whole caches; `rollback` restores them).
- **Evidence:** two quick actions A then B each snapshot the cache. If A's request fails after B was applied, A's rollback restores the pre-A snapshot, which lacks B's change.
- **Impact:** for example, complete one task, then edit another, then the first request fails: the second edit visually reverts until the next refetch. It's a visual glitch, not data loss, since B's write still lands.
- **Fix:** roll back by inverse patch (re-apply the row's previous values for that task id only) instead of restoring the whole snapshot.
- **Confidence:** likely (classic pattern).

### [P3] Smaller items
- **The parser's odd edge cases** (from the fuzz sample, reference time Wed 23:50):
  - "call mum **tonight**" → 21:00, already past;
  - "pay rent **in -5 days**" → a past date, with the title "Pay rent in";
  - "in 999999 weeks" → year 21192, with no sanity bound;
  - "call mum **1 jan 275760**" → title "Call mum 60".
  - Hour guess: "**at 9**" → 09:00, but "gym every weekday **at 7**" → 19:00.

  Suggestions: "tonight" after its default hour should mean later tonight (or now plus a little); ignore negative offsets and dates more than ~10 years out.
- **"Tomorrow morning" between midnight and the planning time** skips the coming morning (`reminder-times.ts:131-134`). At 00:30 it means the next date's 10:00, about 33 h away. When `now` is before today's nudge time, offer today's.
- **Client and server default ritual times differ:** `rituals.ts:62-63` uses 09:00/17:00 and `reminder-times` uses 10:00/18:00, while the DB default and server use 10:00/18:00. No production row is null (0/11), so it's latent. Use one shared constant.
- **Status written by hand** outside `item-lifecycle`: `capture-outbox.ts:141` (`"inbox" : "active"`) and `remember/locations/LocationsView.tsx:179` (`status: "deleted"` with `deleted_at`, slice 4). This breaks the INFRA-19 grep invariant. Route both through the lifecycle helpers.
- **Echo suppression:**
  - any RPC, or any failed write, mutes realtime for **all** tables for the window (`mutation-tracking.ts:179, 299`), which includes `register_push_subscription` on every app open;
  - `rowMutations` only removes an entry when a later event checks that row, so it grows for the session.
- **Pending captures stay in `localStorage` after sign-out** (`capture-outbox.ts:40`). That's by design for zero-loss, but on a shared device the next person's browser holds the previous user's capture text until it syncs. Clear it on sign-out only once the outbox is empty, or say so in the sign-out copy.
- **`loadFocusTimer` doesn't validate its shape** (`focus-timer.ts:46-53`). A corrupt or older saved state yields `NaN` durations. Validate the fields and drop the state if it's malformed.
- **`formatRRule` drops the day for multi-month rules** (`utils.ts:25-30`): "every 2 months on the 15th" reads "Every 2 months".

---

## Coverage

Source files read in full or nearly so (25 of the 54 non-test files):
- `capture-outbox`, `rituals`, `task-cache`, `mutation-tracking`, `useRealtime`, `useInboxCount`;
- `zoned-date`, `do-buckets`, `do-tasks`, `focus-timer`, `reminder-times`;
- `item-lifecycle`, `planned-days`, `stuck-tasks`, `trash` (query), `logger`;
- `utils` (formatting and escaping), `useAppStore` (earlier in the session, PR #79 review), `capture-router` (structure and deadline path).

Exercised by fuzzing instead of a line-by-line read: `nlp/parse-task-text`, `chrono-custom`, `capture-router` routing.

Scanned for specific risks only: `dashboard` (queries), `useSpeechCapture` (lifecycle and errors), `display-clock`.

Not read, judged low-risk (UI helpers or constants): `theme`, `first-run`, `greeting`, `chime`, `useHaptics`, `animations`, `constants`, `nav-config`, `legal`, `sentry-client`, `sentry-sdk`, `preloadable`, `platform`, `format-minutes`, `quick-capture`, `think-threads`, `locations`, `inbox-items`, `nlp/spoken`, `types/*`, and the hooks `useDialogFocus`, `useBodyScrollLock`, `useVisualViewport`, `useUnsavedGuard`, `useMediaQuery`, `useIsTouch`, `useReducedMotion`, `useRealtimeStatus`.
- `useDialogFocus` and `useBodyScrollLock` are reviewed with the dialogs in slice 5.

Colocated tests (47 files) weren't audited individually; they're slice 6's subject.

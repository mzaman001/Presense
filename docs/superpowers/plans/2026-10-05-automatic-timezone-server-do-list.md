# Automatic timezone + server-rendered Do list — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Saved timezone follows the device by default (no prompts); the Do list renders on the server.

**Architecture:** additive `timezone_auto` column; client sync in `AppInitializer`; `DisplayClock` context + `zoned-date` helpers make the Do list's date logic explicit about timezone and "now", so server and first client render match.

**Spec:** `docs/superpowers/specs/2026-10-05-automatic-timezone-and-server-do-list-design.md`

## Global Constraints

- Additive migration only; RLS per-operation policies on `user_settings` already cover new columns.
- Every mutation through `safeMutate`; tokens only; Settings rows via `SettingRow`/`Switch`.
- No hydration mismatch on `/do` in either switch state (checked in a browser whose timezone differs from the saved one).
- Lint 0 errors, tsc, `npm test`, build, budget gate (webpack build), Playwright.

### Task 1: Schema
- [ ] `supabase/migrations/20261005140203_user_settings_timezone_auto.sql`: `alter table public.user_settings add column if not exists timezone_auto boolean not null default true;` with a column comment.
- [ ] `src/types/database.types.ts`: add `timezone_auto` to `user_settings` Row (`boolean`), Insert/Update (`boolean?`).
- [ ] `UserSettings` (store) and `settingsSchema` (`timezone_auto: z.boolean().optional()`).
- [ ] Apply to the live project after the user confirms (additive; app code treats a missing value as `true`).

### Task 2: `src/lib/zoned-date.ts` (TDD)
- `deviceTimeZone(): string`
- `dateKeyIn(date: Date, timeZone?: string): string` → `YYYY-MM-DD` in that zone (`en-CA` format with `timeZone`).
- `addDaysKey(key: string, days: number): string`
- `formatShortDate(date, timeZone?)` → "Oct 7"; `formatClockTime(date, timeZone?)` → "3:05 PM"; `formatWeekdayDate(date, timeZone?)` → "Mon, Oct 12". All `en-US`.
- Tests: zone boundaries (UTC 23:30 vs Asia/Kolkata next day), DST day in America/New_York, `addDaysKey` across month/year ends.

### Task 3: `DisplayClock` context (`src/lib/display-clock.tsx`)
- `DisplayClockProvider({ timeZone?: string; now: number; children })`, `useDisplayClock(): { timeZone?: string; now: number }` (default: device zone, `Date.now()` at call).
- `useLiveClock(initial: { timeZone: string; now: number }, effectiveTimeZone: string)`: first render returns `initial`; after mount `{ timeZone: effectiveTimeZone, now: Date.now() }`, re-ticking every 60 s.

### Task 4: Do list on the server
- `src/app/(app)/do/page.tsx`: read the cached settings (`getUserSettings`) for `timezone`; pass `clock={{ timeZone, now: Date.now() }}` to `DoView` → `DoBoard`.
- `DoBoard`: drop the `hydrated` gate (`loading = isLoading`); `const clock = useLiveClock(props.clock, effectiveTz)` where `effectiveTz = settings.timezone_auto === false ? settings.timezone : deviceTimeZone()` (computed after mount only); bucketing uses `dateKeyIn(d, clock.timeZone)` and `clock.now`; wrap the board in `DisplayClockProvider`.
- Extract bucketing to a pure `bucketTasks(tasks, filter, clock)` in `src/lib/do-buckets.ts` with tests (overdue / today / upcoming / someday, `start_date` in the future, the "today" filter) in two timezones.
- `TaskCard`: `formatDeadline`, "From <date>", snooze time and `formatReminderTime` use `useDisplayClock()` and the zoned formatters. `formatReminderTime(at, now, timeZone?)` gains the zone and `en-US`.

### Task 5: Automatic timezone
- `AppInitializer`: once settings are present and `timezone_auto !== false`, if `deviceTimeZone() !== settings.timezone`, update the store and persist `{ timezone }` with `safeMutate` (no toast). Test with the device zone mocked.
- Settings → Account: "Set timezone automatically" `Switch` row ("Follows this device. Now: <zone label>"); the existing Timezone dropdown renders only when it's off; turning it on also sets `timezone` to the device zone. Add `timezone_auto` to the watched settings and the autosave payload.
- `scripts/seed-test-user.mjs`: seed `timezone` as the machine's zone and `timezone_auto: true`, so measured loads don't include a correction.

### Task 6: Verify, measure, document, PR
- Gates; Playwright signed-in pass with `timezoneId` set to a zone different from the saved one, switch on and off; hydration check across app pages.
- Lighthouse `/do` and `/`, main vs branch, back to back, 5 runs.
- CLAUDE.md: weak points + the known limitation; open PR.

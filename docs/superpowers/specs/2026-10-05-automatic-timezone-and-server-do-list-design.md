# Automatic timezone and a server-rendered Do list

Date: 2026-10-05. Status: approved (Settings mockup approved in chat).

## Goal

1. The saved timezone follows the device by default, with no prompts, so
   reminders and "today" stay right when the user travels.
2. The Do list arrives with the page instead of being drawn after hydration,
   cutting `/do`'s main-thread blocking time (CLAUDE.md, *Known weak points*).

## How the leaders do it (checked 2026-10-05)

- **Sunsama:** one account timezone "across all your devices", plus a
  "Time zone alert" when the device's timezone changes (on by default).
- **Todoist / TickTick:** an account timezone used for "today", reminders
  and recurrences; it follows the device or offers to.
- **Things 3:** device-local only.
- Due dates are calendar dates, not instants, everywhere; Presense already
  stores them that way.

Presense takes the account timezone (needed for server-sent reminders and
server rendering) and the iPhone's "Set automatically" behaviour (no prompt),
which is the least work for the user.

## Behaviour

- `user_settings.timezone_auto boolean not null default true` (additive
  migration). Existing users get `true`.
- **On** (default): every app open compares the device timezone
  (`Intl.DateTimeFormat().resolvedOptions().timeZone`) with the saved one and
  saves the device's if they differ. Silent.
- **Off**: the saved timezone is whatever the user picked; it isn't changed.
- Settings → Account: a "Set timezone automatically" switch ("Follows this
  device. Now: <zone>"). The timezone picker shows only while it's off.
  Turning it on saves the device timezone immediately.

## Do list

- The server renders the list with the saved timezone and the request time.
  The first client render uses exactly those (passed as props), so hydration
  matches; after mount the list switches to the effective timezone
  (`timezone_auto` ? device : saved) and the live clock, ticking each minute.
  When the saved timezone already equals the device's (the normal case),
  nothing changes on screen.
- All of the list's date logic (bucketing in `DoView`, `formatDeadline`, the
  "From <date>" label, snooze and reminder times in `TaskCard`) takes the
  timezone and "now" from a small `DisplayClock` context instead of the
  device clock, via `src/lib/zoned-date.ts` (`Intl` with `timeZone`), and
  formats with a fixed `en-US` locale (the browser's locale would differ from
  the server's and break hydration; `TaskCard` already used `en-US` for
  dates).
- `DoBoard`'s `hydrated` gate (client-only list) goes.

## Known limitation (documented in CLAUDE.md)

With the switch **off** and the device in another timezone, the Do list and
reminders follow the chosen timezone while other screens (Home, calendar,
rituals, capture's "tomorrow 9am") still use the device's clock. Converting
those 18 files is out of scope; with the switch on (the default) they agree.

## Out of scope

Calendar, Home, rituals and NLP date parsing; per-task timezones.

## Verification

Unit tests for `zoned-date` (DST and date-line cases), the bucketing, the
timezone sync, and a hydration test of the Do list rendered on the "server"
in one timezone and hydrated with the same props. Gates in CLAUDE.md;
Playwright signed-in pass with the browser in a different timezone from the
saved one (both switch states), checking no hydration errors and the right
groups; before/after Lighthouse on `/do` measured back to back.

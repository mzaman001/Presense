# Audit findings: 4-home-rituals-settings

2026-10-07, `main` after #90. Method:
- **Code reading:** the Think thread page's writes, Settings' data actions (export, clear, delete account, sign-out), `RitualOverlay`'s save paths, `SearchModal`'s queries, and the calendar's reschedule and slot logic.
- **Axe scan** (WCAG 2.0/2.1/2.2 A and AA) on a production build in full Chromium, signed in as the seeded account: Home, Think, Remember, Trash and Inbox, plus the Settings modal (Account, Appearance, Reminders and Data tabs) and Search with results.

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 2 |
| P2 | 4 |
| P3 | 4 |

**What's solid** (checked, nothing to do):
- **Axe:** no violations on any of the pages or modals scanned.
- **Ritual saves:** the morning and evening finish write the date first, log second, and show a plain toast. A failed log only affects the "days planned" count.
- **Account deletion:** goes through the server route with the service role, and data cascades (slice 1).
- **The evening ritual stands alone** (#85).
- **Search quoting:** search escapes `,` `(` `)` and quotes inside its PostgREST `or()` filter.

---

### [P1] Adding or deleting a Think entry can overwrite or remove the wrong one
- **Where:**
  - `src/app/(app)/think/[id]/page.tsx:197-233` (add) and `:259-283` (delete) write `entries: updatedEntries`, built from the page's loaded copy.
  - The same read-modify-write happens in `RitualOverlay.tsx:880-915` (evening daily note) and `HomeView.tsx:265-330` (Home's quick note).
- **Evidence:**
  - `threads.entries` is a `jsonb[]` written whole.
  - The thread page builds the new array from `thread.entries` as loaded, not as stored now.
  - Delete removes **by position** (`filter((_, i) => i !== deleteEntryIndex)`).
- **Impact:** with the thread open on two devices, or the daily note open while Home's quick note adds to it, or a realtime update missed while offline, a new entry overwrites one added meanwhile. A delete after the list changed removes a **different** entry than the one tapped.
- **Fix:** two RPCs (security invoker, so RLS still applies) and their use in all three places:
  - `append_thread_entry(thread_id, entry jsonb)`: `update … set entries = array_append(coalesce(entries,'{}'), entry), last_updated = now() returning entries`;
  - `remove_thread_entry(thread_id, created_at text)`: removes by the entry's `created_at`, not its index.
- **Verify:** SQL tests: two appends, then both present; a remove after an insert removes the right entry. Component tests use the RPCs.
- **Confidence:** confirmed (code).

### [P1] Data export can be incomplete without saying so
- **Where:** `src/components/features/SettingsModal.tsx:1168-1205`.
- **Evidence:**
  - Each of the four queries' `error` is ignored (`items.data ?? []`), so a failed query exports an empty list and the toast still says "Export downloaded".
  - The queries aren't paginated; Supabase's API returns at most 1,000 rows per request by default (project setting "Max rows").
  - `categories`, `session_logs` (focus history) and `ritual_logs` aren't exported.
- **Impact:** the user's backup or data-portability copy silently lacks data. That's worst for heavy users with over 1,000 tasks, or whenever a request fails.
- **Fix:** page through each table (`.range` in steps of 1,000 until a short page). Fail the export loudly if any request errors. Add `categories`, `session_logs` and `ritual_logs`. Include a `counts` block so the file says what it holds.
- **Verify:** a unit test with a mocked 2,500-row table expects all 2,500, and a failing table means no download plus an error toast.
- **Confidence:** errors ignored: confirmed. Row cap: likely (the Supabase default; the project setting wasn't checked).

### [P2] Search shows trashed and completed items, and a task result doesn't open the task
- **Where:** `src/components/features/SearchModal.tsx:74-93` (no status or `deleted_at` filter) and `:106` (`path: "/do"` for every task).
- **Impact:**
  - Trashed tasks, threads and places crowd the 5 results per type.
  - Choosing a task goes to Do, where a trashed or completed one isn't shown, and an active one still has to be found.
  - A trashed thread opens with no sign it's in Trash.
- **Fix:**
  - Filter out trashed rows: `.is("deleted_at", null)`, and for items, `.neq("status","done")` or a "Done" label.
  - Open the task itself, e.g. `/do?task=<id>` opening `TaskAddPanel`, like `/do?remind=`.
- **Confidence:** confirmed (code).

### [P2] A task dropped on a day in month view, or created from a day's all-day slot, is due at 00:00 and immediately overdue
- **Where:** `src/components/features/calendar/CalendarView.tsx:205-221` (`newDeadline = targetDay` for a task without a deadline, which is midnight) and `WeekView.tsx:262-265` (`handleAllDayClick`: `setHours(0, 0, 0, 0)`).
- **Evidence:** everywhere else a date-only deadline is 23:59 (`DATE_ONLY_TIME` in the parser), and Do's buckets count `deadline < now` as overdue.
- **Impact:** drag a task onto today, and it lands in "Earlier" as overdue. Drop it on Friday, and it becomes overdue as Friday *starts*.
- **Fix:** use 23:59 for date-only drops and all-day slots (a shared `endOfDay(day)`).
- **Verify:** a unit test: dropping an undated task on a date gives that date at 23:59.
- **Confidence:** confirmed (code).

### [P2] A place on the Remember list can't be opened from the keyboard
- **Where:** `src/app/(app)/remember/locations/LocationsView.tsx:292-293` (`<GlassCard onClick={() => setEditingItem(item)}>`: a plain `div`).
- **Impact:** the same WCAG 2.1.1 failure as the task cards had (fixed in #88). Keyboard and screen-reader users can't edit a place.
- **Fix:** make the place's name an "Edit <place>" button, as #88 did for tasks.
- **Confidence:** confirmed (code). Not exercised in the browser: the test account has no places.

### [P2] Deleting the account leaves private text on the device
- **Where:** `SettingsModal.tsx:1248-1280`. The sign-out branch clears only the theme keys.
- **Evidence:** the capture outbox (`presense_capture_outbox_v1:<id>`), the capture draft (`presense_capture_draft_v1:<id>`) and the saved focus timer (`pomodoro_state`, which holds the task title) stay in `localStorage`.
- **Impact:** after "delete my account", the device still holds that account's unsynced captures and draft text.
- **Fix:** on account deletion, remove every `presense_*:<userId>` key, plus `pomodoro_state` and `pomodoro_logged`. On ordinary sign-out keep the outbox (zero-loss), but clear the draft and the focus timer.
- **Confidence:** confirmed (code).

### [P3] Smaller items
- **"Clear stale places" deletes permanently, but its confirm doesn't say so** (`SettingsModal.tsx:1230-1245, 1929-1931`: `.delete()`, so it isn't in Trash). Say "Permanently delete places not updated in 30+ days? This can't be undone."
- **Search LIKE wildcards:** a `%` or `_` typed into search acts as a wildcard (`ilikeContains` quotes the value but doesn't escape LIKE specials), so "100%" matches nearly everything. Escape `\`, `%` and `_` before wrapping.
- **Search only matches thread titles,** not entry text. Think's own list filters entries client-side, but global search doesn't. A `threads` text search over entries, or a search RPC, would make "where did I write about X" work.
- **Error text in Think and Settings** still uses `err instanceof Error ? err.message : "Unknown error"` (`think/[id]/page.tsx:227, 278`; `SettingsModal.tsx:1201, 1222, 1241, 1276`). Use `friendlyError` (#91).

---

## Coverage

Read for the risky paths:
- `think/[id]/page` (all writes);
- `SettingsModal` (data tab actions, sign-out, delete);
- `RitualOverlay` (morning finish, estimates, evening entries);
- `SearchModal` (queries and paths);
- `CalendarView` and `WeekView` (reschedule and slots);
- `HomeView` (quick-note write), `LocationsView` (card) and `TrashList` (fixed in #85).

Axe-scanned in the browser as above.

Not read line by line:
- `ThinkView`'s list UI, `MonthView`, `MobileCalendar`, `CalendarTaskChip`, `MindSweep`, `RemindMeChip`, `FocusHorizon`;
- the rest of `SettingsModal`'s form UI, already reviewed for autosave in #80;
- the route shells (`page`, `layout`, `loading`, `error`, `template`, `share`);
- the colocated tests (slice 6).

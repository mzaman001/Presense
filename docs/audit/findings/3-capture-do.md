# Audit findings: 3-capture-do

2026-10-07, `main` at `3f693b3`.

Method:
- **Code reading:** the save paths of `CaptureModal`, `TaskAddPanel` and Inbox routing; `DoView`'s complete and undo; `PomodoroTimer`'s timing and logging; `TaskCard`'s accessibility.
- **Browser checks:** a production build in Playwright's full Chromium, signed in as the seeded account, at 1280×800 and 390×844 (touch). Checked: capture close and reopen, Tab order on `/do`, horizontal overflow, and target sizes.

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 2 |
| P2 | 4 |
| P3 | 4 |

**What's solid** (checked, nothing to do):
- **Saving a capture:** written to the device first; a re-entry guard stops a held Enter or double-click from double-saving; routing failures fall back to Inbox verbatim.
- **The task editor:** confirms before discarding edits, and warns before reload or tab close.
- **Complete:** the checkmark moment plays, undo is in the toast, and a failure restores the row.
- **The focus timer:** counts against the wall clock, so background throttling can't skew it. A session that ends while the app is closed completes on the next open.
- **Inbox routing:** inserts first, and trashes the original only on success, with undo.
- **Layout:** no horizontal overflow on desktop or phone.
- **Labels:** every card button has a specific accessible name ("Complete Finish the report").

---

### [P1] Closing the capture panel throws away what was typed
- **Where:** `src/components/features/CaptureModal.tsx:566-573`. The `Sheet`'s `onClose` is `setCaptureModalOpen(false)`. The text lives only in component state (`useState`, line 304), and the modal unmounts on close.
- **Evidence:** in the browser: open capture, type "remember to renew passport next month", press Escape, reopen, and the input is `""`. The same happens on a backdrop tap, a swipe down, or the close button.
- **Impact:** capture is the "never lose a thought" path. A stray tap outside the sheet, or a swipe on a phone, silently deletes a half-typed thought.
- **Fix:** keep an unsaved draft. On close with non-empty text, store it (`captureDraft` in the store, mirrored to `sessionStorage`), seed the input from it on the next open (as `captureModalPrefill` already does), and clear it on save. No confirm dialog is needed: the text simply comes back.
- **Verify:** a component test (type, close, reopen, text present; save, reopen, empty) and the same Playwright steps.
- **Confidence:** confirmed.

### [P1] A task can't be opened for editing from the keyboard
- **Where:** `src/components/features/TaskCard.tsx:321-323`: `<GlassCard onClick={() => openEditPanel(task)}>`. `GlassCard` (`src/components/ui/GlassCard.tsx`) renders a plain `div`, with no role, no tab stop and no key handler.
- **Evidence:** Tabbing through `/do` reaches each card's "Complete …", "Start focus session: …" and "Move … to trash" buttons, but nothing that opens the task. The Axe test passes because it can't see click-only elements.
- **Impact:** keyboard and screen-reader users can't edit any task from Do. That covers title, dates, reminder and notes. It fails WCAG 2.1.1 (Keyboard).
- **Fix:** make the title a real button (`<button className="text-left …" onClick={() => openEditPanel(task)}>`) with a name such as "Edit Finish the report". Keep the card-wide click for pointer users. Do the same anywhere else `GlassCard onClick` opens something (grep it).
- **Verify:** a Playwright step (Tab to "Edit …", press Enter, the editor opens) and an RTL test.
- **Confidence:** confirmed.

### [P2] "Add task" isn't zero-loss the way capture is
- **Where:** `src/components/features/TaskAddPanel.tsx:575-624`.
- **Evidence:** the panel closes and the task shows optimistically, but the insert goes straight to Supabase. On failure (offline, flaky network) it rolls the task back, and only a toast with "Retry" holds it. Once the toast is gone, the task is too.
- **Impact:** a task added from Do while offline disappears. Capture, by contrast, keeps it on the device and syncs later.
- **Fix:** route new tasks through `capture-outbox` (`enqueueCapture` with a prepared row and the same fixed id), or at least keep failed inserts in the outbox for `CaptureSync` to retry. Edits can keep the current toast-with-retry.
- **Verify:** a test with a rejecting insert: the row stays queued and syncs on the next flush.
- **Confidence:** confirmed (code).

### [P2] Routing an inbox item to Think or Remember puts the original in Trash
- **Where:** `src/app/(app)/inbox/InboxView.tsx:280-330`: after inserting the thread or location, the inbox item gets `moveItemToTrashPatch()`.
- **Impact:** every routed item appears in Trash as a deleted "Task" for 30 days, although nothing was deleted. That's confusing, and it pushes real deletions down the list.
- **Fix:** hard-delete the inbox row once the new row is saved. Undo already recreates it from the item in hand (`restoreItemPatch` currently restores the trashed row, so undo would insert it back instead). Or give routed rows a status Trash doesn't list.
- **Confidence:** confirmed (code).

### [P2] A focus session can be logged twice with two tabs open
- **Where:** `PomodoroTimer.tsx:283-323` (resume from `localStorage`) and `DynamicModals.tsx` (restores the timer on every page load).
- **Evidence:** each tab restores the same saved timer and runs its own countdown, and each calls `handleComplete` → `logSession(...)`.
- **Impact:** with Presense open in two tabs (or a tab and the installed app), one 25-minute session is recorded twice. Focus minutes and the task's time spent are doubled.
- **Fix:** claim the completion once. Before logging, write `pomodoro_logged:<startedAt>` to `localStorage` only if it's absent, and let only the tab that wrote it log. A `storage` event can also close the timer in other tabs when one ends it.
- **Confidence:** likely, from the code. Not reproduced.

### [P2] The Do archive loads every completed task ever
- **Where:** `src/app/(app)/do/DoView.tsx:307-316` (`fetchArchived`: `status = done`, ordered, no limit).
- **Impact:** for a long-time user, opening the archive fetches thousands of rows at once.
- **Fix:** `.range(0, 99)`, plus a "Show more".
- **Confidence:** confirmed.

### [P3] Smaller items
- **Database text in toasts:**
  - the shared `safeMutate` (`src/lib/supabase.ts:63-66`) shows `error.message`;
  - so do `TaskAddPanel.tsx:334,609,629`, `ReminderSheet.tsx:65`, `LocationAddPanel.tsx:129-151`, `DoView.tsx:374` and `InboxView.tsx:428`.

  Supabase errors aren't `Error` objects, so some show "Unknown error" and others show Postgres wording. Add a single helper (`friendlyError(err)`: code → plain sentence) and use it everywhere. Trash already does this (#85).
- **Inbox → Remember copies the whole text into both fields** (`item_name` and `location_text`, `InboxView.tsx:269-273`), where capture parses them apart (`capture-outbox.ts:122`). Inbox → Think creates a thread with no first entry, while capture adds one. Reuse `rowsForCapture` for routing.
- **Phone targets below 44 px:**
  - the view switcher (Board/Today/Calendar) is 30 px tall;
  - the filter chips and "Archive" are 36 px;
  - "Dismiss tip" is 32 px.

  These pass WCAG 2.2 AA (24 px) but fall short of the 44 px Apple and Android guidance for thumbs.
- **Completing the same task twice** (a double-click before the row folds) sends two updates and shows two toasts. Ignore a second complete while `completing === id`.

---

## Coverage

Source files read in full or for their risky paths, 10 of 19:
- `CaptureModal` (state, save, voice, close);
- `DoView` (complete, undo, archive, realtime);
- `TaskCard` (actions, accessibility, swipe);
- `TaskAddPanel` (save path, guards);
- `PomodoroTimer` (resume, tick, complete, logging);
- `InboxView` (routing and undo);
- `ReminderSheet`, `LocationAddPanel` and `StuckTaskHelp` (error handling only).

Checked in the browser as above. Not read line by line: the rest of `TaskAddPanel`'s form UI, `StuckTaskHelp`'s flow, the `do/` and `inbox/` route shells (`page`, `loading`, `error`), and the 7 colocated tests (slice 6).

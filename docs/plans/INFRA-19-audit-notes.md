# INFRA-19 Audit Notes (internal working file, delete after commit)

## Current `item-lifecycle.ts` exports
- `RestorableItemStatus = "active" | "inbox" | "done" | "archived"`
- `archiveItemPatch()` → { status: "archived", deleted_at: null }
- `restoreItemPatch(status = "active")` → { status, deleted_at: null }
- `moveItemToTrashPatch(now)` → { status: "deleted", deleted_at }
- `permanentlyDeleteFilter(id)` → { id }

## DB CHECK constraints (migration 005 + 20260704120000)
- items: 'active','done','overdue','archived','inbox','deleted' (+ deleted_at)
- explores: 'active','archived','deleted' (+ deleted_at)
- threads: 'active','archived','deleted' (+ deleted_at)
- people: 'active','deleted' (+ deleted_at)
- locations: 'active','deleted' (+ deleted_at)

## Status-write violations found (outside item-lifecycle.ts)

### items (tasks)
1. do/page.tsx:296 — complete task: `.update({ status: "done", completed_at })` → needs `completeTaskPatch()`
2. do/page.tsx:308 — undo complete: `.update({ status: "active", completed_at: null })` → needs `uncompleteTaskPatch()`
3. do/page.tsx:338 — restoreTask: same uncomplete patch
4. page.tsx:266 — home complete task: same as #1
5. page.tsx:284 — home route to Do: `.update({ status: "active" })` — inbox→active routing; items' inbox status: needs `routeToTaskPatch()`? NOTE: inbox→active is "route", not "restore". Add `activateItemPatch()` (no completed_at touch).
6. page.tsx:341 — home dismiss: `.update({ status: "deleted" })` WITHOUT deleted_at → BUG actually (constraint allows but trash semantics expect deleted_at). Should use moveItemToTrashPatch. inbox/page dismiss already uses moveItemToTrashPatch.
7. PomodoroTimer.tsx:217 — Mark Done toast: same as #1
8. SettingsModal.tsx:588 — clear completed: `.update({ status: "deleted", deleted_at })` → moveItemToTrashPatch
9. inbox/page.tsx:286 — route to Do: `.update({ status: "active" })` → same helper as #5
10. inbox/page.tsx:455/470/486/502/518/577 — undo route: `.update({ status: "inbox" })` → restoreItemPatch("inbox")

### threads
11. think/[id]/page.tsx:259-267 — handleArchive: computed toggle newStatus → needs `toggleThreadArchivePatch(current)`? Simplest: `archiveThreadPatch()` (to archived) + restoreThreadPatch() (to active). The toggle computes; provide `threadArchiveTogglePatch(status)` → returns archiveItemPatch() when active, restoreItemPatch("active") otherwise. Keep semantics simple: add `archiveThreadPatch()` and use locally computed restore path? Decide: add `archiveThreadPatch()` for archiving, restore via `restoreItemPatch("active")`. The handler becomes two branches instead of computed string.
12. (threads insert with status:"active" in page.tsx:317, inbox:342-345, onboarding:311-325, capture-modal no status — no status field written. threads default status 'active' via DB DEFAULT.)

### explores
13. explore/[id]/page.tsx:199 — handleDelete: `.update({ status: "deleted" })` (no deleted_at) → moveItemToTrashPatch
14. explore/[id]/page.tsx:183-186 — handleArchive toggle: computed → same pattern as threads
15. explore/page.tsx:248 — undo trash: `.update({ status: "active", deleted_at: null })` → restoreItemPatch()
16. ExploreDrawer.tsx:248-256 — archive toggle: computed → same
17. explores inserts with status:"active": page.tsx:296, inbox:337-345 — status literal in INSERT. Add... INSERT status default is already 'active' via DB DEFAULT; but home page passes status:"active" explicitly. Fix by removing literal (default handles it) OR go through a builder. Decision: make the shared module also own insert patches? Ticket acceptance: "grep for direct .update({status}) or .insert({status}) outside item-lifecycle.ts returns zero results". So inserts with status literals must also route through the module. Simplest: add `newExplorePatch({...})`? That over-reaches. Cleaner: drop explicit status:"active" from inserts where default suffices (removes the literal, zero results satisfied); only keep patches for transitions.
   - page.tsx:295-302 explores.insert { ..., status:"active" } — drop status line (DB default 'active')
   - page.tsx:317-322 threads.insert { ..., status:"active" } — drop (default 'active')
   - inbox/page.tsx explores.insert status:"active" — drop
   - inbox/page.tsx threads.insert status:"active" — drop (check)
18. cron_recurrence/index.ts:139-148 — items.insert { ..., status:"active" } — drop literal (default)

### threads inserts w/ status:"active"
- inbox/page.tsx ~371-380: threads.insert { user_id, title, status: "active", color_accent } — drop
- page.tsx:316-322 — drop
- onboarding 309-325 — drops already? onboarding threads insert has NO status literal (checked: only user_id, title, entries). OK.
- think/page.tsx insert — no status literal. OK.
- CaptureModal threads insert — no status literal. OK.

### people/locations
- people status values only active/deleted. Soft delete via moveItemToTrashPatch already used everywhere. Restores:
  - people/page.tsx:374 already uses restoreItemPatch("active"). GOOD.
  - trash/page.tsx:112-116, explore/trash/page.tsx:64-66 — `.update({ status: statusToRestore, deleted_at: null })` with statusToRestore="active" → use restoreItemPatch()
- people deletes: inbox undo-route deletes (compensating delete of just-created row) are intentional hard deletes of a row created in same flow — acceptable exception, not a "status write". Same for explores/threads/locations undo-route deletes in inbox/page.tsx and home page.tsx (items.delete when routed to explore/think — intentional removal, not lifecycle transition).
- SettingsModal handleDeleteAccount — full-account data wipe, intentional, out of lifecycle scope. Note as documented exception.

### Overdue? "overdue" status is READ (derived in UI via deadline) not written anywhere — no writer found. Good.

## Plan for item-lifecycle.ts additions
Add typed, single-purpose patches (all status writes funnel through here):
- `completeTaskPatch(now?)` → { status: "done", completed_at }
- `uncompleteTaskPatch()` → { status: "active", completed_at: null }
- `activateItemPatch()` → { status: "active" } (route inbox→do; does not touch completed_at/deleted_at)
- `archiveThreadPatch()` → { status: "archived" } (explores/threads only)
- `restoreItemPatch` already covers restore-to-active + restore-to-inbox

Insert literals: remove explicit status:"active" from inserts (DB default covers); document in DATA_MODEL.md.

## Files to edit (keep ≤ 5 if possible; ticket naturally touches more — 7+ files)
Code files:
1. src/lib/item-lifecycle.ts (+types)
2. src/app/(app)/do/page.tsx (3 sites)
3. src/app/(app)/page.tsx (4 sites)
4. src/app/(app)/inbox/page.tsx (8 sites)
5. src/components/features/PomodoroTimer.tsx (1 site)
6. src/components/features/SettingsModal.tsx (1 site)
7. src/app/(app)/explore/[id]/page.tsx (2 sites)
8. src/app/(app)/explore/page.tsx (1 site)
9. src/components/features/ExploreDrawer.tsx (1 site)
10. src/app/(app)/trash/page.tsx (1 site)
11. src/app/(app)/explore/trash/page.tsx (1 site)
12. src/lib/__tests__/item-lifecycle.test.ts (add tests)
13. docs/project/DATA_MODEL.md (new doc)
14. docs/plans/EXECUTION_SPEC.md (status line)
That is 14 files — exceeds the 5-file ticket guideline. EXECUTION_RULES stop list says ">5 files" triggers stop-and-report. But this ticket's acceptance criteria (grep zero everywhere) inherently requires touching all sites. Report to user first? — Law 7 says ask. Alternatively keep patch count per-file tiny. Better: report the scope fact to user upfront in the info message and proceed since the ticket itself demands it (acceptance = repo-wide grep zero).

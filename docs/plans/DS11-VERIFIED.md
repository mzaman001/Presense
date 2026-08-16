# DS-11 verified conventions (internal; delete before push)

## Verified in code (Aug 17, 2026)

### Create entry points
Per-space "+" header buttons open space-scoped creator sheets/panels:
- /do → TaskAddPanel (setTaskToEdit(null); setIsPanelOpen(true)); empty-state "Add Task" buttons (do/page lines 451-453, 637-639, 727-729) match header — verified.
- /think → new-thread composer; /explore → ExploreDrawer; /remember/people → add-person panel; /remember/locations → LocationAddPanel.
- Quick Capture (CaptureModal): global, NLP-routed (capture-router). Global shortcuts (AppContentWrapper.tsx): ⌘K/Ctrl+K = SearchModal (preloads chunk, PERF-20); "c" = CaptureModal; "/" = SearchModal; "1".."6" = inbox/do/people/think/explore/home; Escape = close all modals + blur inputs.
- Inbox empty state ("Inbox Zero") = documented Quick Capture exception (DS-24 AC).

### Edit
TaskAddPanel handles both create and edit: taskToEdit ? "Edit Task" : "Add Task" (TaskAddPanel.tsx:605). Opened by clicking task row / "Edit" from card context (do/page line 358 setTaskToEdit(task)).

### Delete/undo/confirm
- Canonical deletion = moveItemToTrashPatch() (status "deleted" + deleted_at) via src/lib/item-lifecycle.ts — zero direct status literals elsewhere (INFRA-19, AGENTS invariant).
- Point-of-action: optimistic removal + toast.success("Task moved to trash", { action: { label: "Undo", onClick: restoreItemPatch("active") with rollback } }) — TaskCard.tsx:161-196 pattern. (TaskCard's label says "archive" in error toast text at line 208 — cosmetic, do not touch per rules.)
- Restore: /trash?filter=<item|thread|explore|person|location> (BUG-08).
- Permanent delete: ConfirmModal on /trash with title "Permanent Delete", confirmLabel "Delete Forever", confirmDestructive (trash/page.tsx:258-267).
- Purge: cron_cleanup 30-day retention (INFRA-09).
- Archive ≠ trash: completeTaskPatch()/uncompleteTaskPatch()/archiveItemPatch(); status "archived" = done, not deleted.

### Toast conventions
sonner toast.success (with Undo action via { action: { label, onClick } }) on optimistic success; toast.error on failure. safeMutate() wrapper on all client mutations.

### item-lifecycle.ts exports (for doc reference)
RestorableItemStatus = "active"|"inbox"|"done"|"archived"; archiveItemPatch, completeTaskPatch(now), uncompleteTaskPatch, activateItemPatch, archiveThreadPatch, activateItemWithDeadlinePatch(deadline), restoreItemPatch(status="active"), revertItemPatch(status, deadline), moveItemToTrashPatch(now), newTaskInsert<T>(payload), permanentlyDeleteFilter(id).

## Doc placement decision
docs/project/INTERACTION_PATTERNS.md (new; matches project/ folder; DS-11 spec allows "or a new INTERACTION_PATTERNS.md"). DESIGN_SYSTEM.md stays visual-only.
CLAUDE.md "key files to read" list: not in repo (lives in user's Antigravity config at C:\Users\muhdz\.gemini\antigravity, not browsable as text). Acceptance says "referenced from CLAUDE.md's key files to read list" — since we can't edit the user's external config from here, record the reference instruction in AGENTS.md §2 table (the single entry point all agents read) + EXECUTION_SPEC status line noting CLAUDE.md should add the pointer. AGENTS.md is the repo-side equivalent; GEMINI.md points to it. This is the pragmatic resolution — report to user.

## INFRA-09 next (user already approved sequence)
- Find INFRA-09 ticket block in EXECUTION_SPEC.md; likely scope: cron_cleanup Edge Function retention purge across 5 tables + schedule setup (Supabase cron); verify existing supabase/functions/cron_cleanup and supabase config (config.toml cron jobs).

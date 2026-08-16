# INTERACTION_PATTERNS.md — Presense

This document is the **canonical, enforceable contract** for object creation, editing, deletion, toast behavior, and keyboard shortcuts in Presense. It resolves `BUG-04`, `BUG-24`, `BUG-08`/`CONF-04`/`CONF-10`, and closes `DS-11`. Every future feature must conform to exactly one pattern per interaction described below — there are no alternative acceptable options, and each rule carries a single canonical code example. When the code disagrees with this document, the code is wrong unless this document carries a dated amendment.

`BUG-38`'s mutation-invariant (every Supabase mutation checks `error` — see `AGENTS.md` invariant 7 and `item-lifecycle.ts`) applies to every interaction below and is not restated per section.

---

## 1. Object creation entry points

**The rule:** each space owns exactly one structured creator surface, opened by its header "+" button and by every empty-state "Add" action in that space. Quick Capture is the single *ambiguous* entry point for unstructured input and is never a space's default creator.

| Space | Creator surface | Component / mechanism |
|---|---|---|
| Do | Add-task sheet (create **and** edit) | `TaskAddPanel.tsx` via `setTaskToEdit(null); setIsPanelOpen(true)` |
| Think | New-thread composer | space-scoped composer (same component as the header "New thread") |
| Explore | Add-explore drawer | `ExploreDrawer.tsx` |
| Remember → People | Add-person panel | space-scoped add panel |
| Remember → Locations | Add-location panel | `LocationAddPanel.tsx` |
| Inbox | **No creator** — "Inbox Zero" intentionally has no add action; this is the documented exception, not a bug | — |
| Anywhere | Quick Capture (NLP-routed) | `CaptureModal.tsx` — the *global* entry point, correct for Inbox routing only |

**Canonical example (Do):**

```tsx
// Header "+" and every empty-state "Add Task" on /do — identical target:
setTaskToEdit(null);
setIsPanelOpen(true);
```

**Canonical example (global Quick Capture):**

```tsx
useAppStore.getState().setCaptureModalOpen(true); // the only ambiguous entry point
```

The reasoning behind the split (`12-interaction-patterns.md` §Create): per-space "+" buttons are *space-scoped creators* — the user is already inside a space, so the action is unambiguous and must skip the NLP router. Quick Capture is the *ambiguity-absorbing* entry point: the user types natural language and `capture-router.ts` routes it. Never route a space-scoped creator through Quick Capture, and never route Quick Capture through a space-scoped creator. Verified against `BUG-04`/`BUG-24`: all empty-state "Add" actions now match their header actions, with Inbox's Quick Capture routing the single documented exception.

---

## 2. Inline vs. sheet editing

**The rule:** editing opens the same component that creates the object, with a preloaded payload; editing never uses a separate edit screen, a separate panel, or an NLP re-parse.

The sheet/panel is a dual-mode component distinguished by a single edit-handle value:

**Canonical example (`TaskAddPanel.tsx:605`):**

```tsx
title={taskToEdit ? "Edit Task" : "Add Task"}
```

Opening for edit loads the object into the edit state (`setTaskToEdit(task)`); opening for create clears it (`setTaskToEdit(null)`). The save path in the same component inserts on create and updates on edit. What this forbids: clicking a calendar slot or a row and funneling the interaction through `captureModalPrefill` natural-language strings (the pre-`BUG-05` defect), or maintaining a second edit sheet that can drift from the creator.

---

## 3. Delete / undo / confirm behavior

**The rule:** deletion is one model — `moveItemToTrashPatch()` from `src/lib/item-lifecycle.ts` — for every entity table (`items`, `threads`, `explores`, `people`, `locations`). There is no hard delete from any user-facing surface, no "archive" that means "deleted," and no per-surface variation in recoverability.

The lifecycle module is the only place in the codebase permitted to write the `status` column (AGENTS invariant; `BUG-08`/`INFRA-19`). The deletion contract has three stages:

**Stage 1 — soft delete with 5-second undo.** Optimistic removal, then a success toast carrying an Undo action:

**Canonical example (`TaskCard.tsx:161`):**

```tsx
toast.success("Task moved to trash", {
  action: { label: "Undo", onClick: async () => {
    const { error: undoError } = await supabase
      .from("items").update(restoreItemPatch("active")).eq("id", task.id);
    if (undoError) throw undoError;
    // rollback optimistic state on failure …
  } },
});
```

**Stage 2 — restore from the global trash.** The single recovery surface is `/trash`, which lists all five entity types and accepts `?filter=<item|thread|explore|person|location>` per the `CONF-10` Option C decision. Per-space empty/error states carry thin "check the trash" pointers; no per-space trash logic exists anywhere.

**Stage 3 — permanent delete requires an explicit destructive confirmation.**

**Canonical example (`trash/page.tsx:258`):**

```tsx
<ConfirmModal
  isOpen={!!itemToPermanentDelete}
  onConfirm={handlePermanentDelete}
  title="Permanent Delete"
  description="Are you sure you want to permanently delete this item? This action cannot be undone."
  confirmLabel="Delete Forever"
  confirmDestructive
/>
```

**The archive is not deletion.** `status: "archived"` means *done* (the Do completed-tasks archive, toggled by `showArchive`); `status: "deleted"` with `deleted_at` means *removed*. Never reuse `archived` for removal (`BUG-08`'s root cause), and never omit `deleted_at` on a trash write. Retention purge is `cron_cleanup` at 30 days (`INFRA-09`).

---

## 4. Toast conventions

**The rule:** `sonner` toasts are the only in-app feedback channel. Success toasts on optimistic writes carry an Undo action where the write is reversible; failure toasts carry an explicit error message (never a silent failure, never "Something went wrong" without a label).

| Situation | Toast |
|---|---|
| Optimistic reversible write (trash, undo, snooze cancel) | `toast.success(<past-tense action copy>, { action: { label: "Undo", onClick } })` |
| Irreversible action (permanent delete) | no success toast — the ConfirmModal's confirmation is the feedback |
| Mutation failure | `toast.error(<explicit copy>)` after `error`/exception handling |

Client mutations must flow through `safeMutate(mutationFn, errorLabel)` in `src/lib/supabase.ts`, which handles the failure toast; server components check `error` and log (no toast available there). Success copy is past tense and describes what happened ("Task moved to trash"), not what was attempted.

---

## 5. Keyboard shortcuts

**The rule:** one global handler (`AppContentWrapper.tsx`'s `handleGlobalKeyDown`) owns every global shortcut. No component installs its own global `keydown` listener. Shortcuts are inert while the user types in an input/textarea/contenteditable (Escape blurs).

| Shortcut | Action | Canonical example |
|---|---|---|
| `⌘K` / `Ctrl+K` | Open search (`SearchModal`) with chunk preloading | `(SearchModal as … & { preload: () => void }).preload(); setSearchModalOpen(true);` (`AppContentWrapper.tsx`) |
| `c` | Open Quick Capture | `setCaptureModalOpen(true)` |
| `/` | Open search | `setSearchModalOpen(true)` |
| `1`–`6` | Navigate: inbox, do, people, think, explore, home | `router.push("/do")` |
| `Escape` | Close every modal sheet; blur focused input | `setCaptureModalOpen(false); setSearchModalOpen(false); setSettingsModalOpen(false)` |
| `Enter` | Submit the focused composer (CaptureModal: auto-route the routed preview) | `if (e.key === "Enter") …` |

Component-local keyboard behavior (ArrowUp/ArrowDown/Enter for result lists in `SearchModal`) belongs to the component but follows the same principle: keyboard never duplicates pointer behavior through a different code path — the Enter key activates the same handler a click would.

---

## Amendments

| Date | Amendment |
|---|---|
| Aug 17, 2026 | Created — resolves `DS-11`; supersedes the audit's `12-interaction-patterns.md` as the enforceable contract. `CONF-10` Option C (global `/trash` + `?filter=` + thin per-space pointers) is the delete-surface contract. `INFRA-19`'s `status-lifecycle-vocabulary.md` remains the authoritative source for status *meanings*; this document governs status *use in interactions*. |

# Status & Lifecycle Vocabulary

> The settled vocabulary for entity status transitions across Presense. This is the human-readable companion to `src/lib/item-lifecycle.ts`, which is the **only** place where a `status` value may be written to an entity table. Zero hand-written `status` literals anywhere in `src/` or `supabase/functions/`.

**Status:** closed, Aug 17 2026 (INFRA-19). Supersedes the partial status sweep recorded in `docs/plans/EXECUTION_SPEC.md` (the pre-INFRA-19 "status sweep" block).

---

## 1. The vocabulary at a glance

Presense is a single-user capture-and-organize tool. Its data model has one governing invariant: **trash is always reversible for 30 days, and `deleted_at` — never `status` alone — is what makes a row trash.** Anything else is a scheduling or archival decision and must not touch `deleted_at`.

| Status | Meaning | Lifecycle family | Notes |
|---|---|---|---|
| `active` | Live on Do (has deadline context) or in the active Explore list | Living states | The only status a brand-new row ever receives |
| `inbox` | Captured, not yet routed | Living state (items only) | Triage routes it; a *route* is activation, not restoration |
| `done` | Completed task | Terminal-ish (reversible) | `completed_at` **must** be set alongside `status` |
| `overdue` | Derived, not written | — | Never inserted or updated; computed from `active` + `deadline` |
| `archived` | Put aside (threads, explores, items) | Archival | Explicitly *not* deleted — `deleted_at` stays null |
| `deleted` | In the 30-day trash | Trashed | `deleted_at` **must** be set alongside `status` |

Two pairs are deliberately easy to confuse and are the whole reason this document exists:

- **`archived` vs `deleted`.** Archive means "put aside, still mine." Trash means "removed, recoverable for 30 days, then gone forever." A trashed row keeps its prior history (`completed_at`, deadlines); an archived row is just hidden from default views.
- **`activate` vs `restore`.** Routing `inbox → Do` is *activation* (the item was never dead). Restoring from trash or archive is a *restore* because it must also clear `deleted_at` or undo `archived`. They are different patches.

`overdue` is a **derived view-state**, not a lifecycle state. Nothing writes it; queries and UI derive it from `deadline < today` for `active` items. The cron that nudges overdues reads `active`/`inbox` + deadline math — it does not mutate status.

## 2. The transition table

Every allowed transition, the patch that implements it, and where it is consumed. Rows marked "not allowed" are the failure modes the vocabulary prevents (e.g., a "restore to active" that forgets `deleted_at` makes the row invisible to the trash list forever).

| From → To | Patch / helper | Consumer sites |
|---|---|---|
| any → `done` | `completeTaskPatch(now)` — stamps `completed_at` | Do complete, Home complete, Pomodoro "Mark Done" |
| `done` → `active` | `uncompleteTaskPatch()` — clears `completed_at` | Do undo, Home undo |
| `inbox` → `active` | `activateItemPatch()` | Inbox "Route to Do", Home route |
| `inbox`/`overdue` → `active` + deadline | `activateItemWithDeadlinePatch(deadline)` | RitualOverlay triage (today / backlog / snooze) |
| triage undo | `revertItemPatch(capturedStatus, capturedDeadline)` | RitualOverlay undo |
| items/threads/explores → `archived` | `archiveItemPatch()` / `archiveThreadPatch()` | Do archive, Think archive, Explore archive, ExploreDrawer |
| `archived` → `active` | `restoreItemPatch("active")` | archive-toggle un-archive paths |
| any → `deleted` + `deleted_at` | `moveItemToTrashPatch(now)` | Every trash/dismiss/delete UI action, Settings "clear completed" |
| `deleted` → prior status | `restoreItemPatch()` (defaults `active`) | Trash restore, inbox undo, ExploreDrawer restore, Drawer undo |
| brand-new row | `newTaskInsert(payload)` | TaskAddPanel create, cron recurrence re-create (no status field) |

Mutations that already carried `user_id` by construction (`.insert()` of form data, `.delete()` on the trashed-30-days cron) were never status writes and required no change. Single-row lookups, status *reads* for filtering views, and compensating undo deletes on form rollback are also out of scope — the invariant targets **writes that set a status**.

## 3. Invariants enforced by the module

1. **No direct status writes.** `grep -r 'status: "active"\|status: "done"\|...' src supabase/functions` must return zero results outside `item-lifecycle.ts` and its own tests. This is the ticket's acceptance criteria and is now machine-checkable.
2. **`done` ⇔ `completed_at`.** The two are one atomic fact. `completeTaskPatch` stamps both; `uncompleteTaskPatch` clears both. Writing one without the other is a bug (the archive view sorts by `completed_at`, so an un-completed task would still rank as done).
3. **`deleted` ⇔ `deleted_at`.** Same atomicity rule for trash. The pre-INFRA-19 Home dismiss wrote `status: "deleted"` *without* `deleted_at` — a broken trash row that the trash list could not recover. This defect is fixed; all trash writes now go through `moveItemToTrashPatch`.
4. **Restore clears the flag it undoes.** `restoreItemPatch` always sets `deleted_at: null`. A restore that forgets this leaves the row permanently invisible to recovery UIs.
5. **Archive ≠ trash.** Archival patches never touch `deleted_at` to a timestamp; they only guarantee `deleted_at: null` when un-archiving.
6. **New rows start `active`.** `newTaskInsert` owns the only remaining literal, so the vocabulary stays grepable. The `cron_recurrence` re-create follows the DB default and omits `status` entirely.

## 4. Documented exceptions (not transitions)

- **`SettingsModal` full-account wipe** — a permanent, multi-table `.delete()` on account deletion. This destroys data; it is not a lifecycle transition and is not expressed as a patch.
- **Form-compensating deletes** — TaskAddPanel rolls back a freshly inserted subtask on save failure. That delete removes a row created seconds earlier; no status is involved.
- **`permanentlyDeleteFilter`** — exists only so the Edge Function's purge cron has a named identity; it carries no status.

## 5. Enforcement & verification

- **Lint-time:** the acceptance grep is documented above; run it as part of any future status-touching change.
- **Type-time:** patches are typed (`RestorableItemStatus` restricts what a restore can write); `revertItemPatch` intentionally stays loose because it re-applies a captured row value — the Postgres `CHECK` constraint on `status` remains the final authority.
- **Test-time:** the existing `item-lifecycle` test file covers the patch shapes; `npm test` (181/181) and `VERCEL=1 npm run build` pass with this vocabulary in place.

---

*Part of the INFRA-* series. Predecessor: `docs/plans/EXECUTION_SPEC.md` status sweep. Source of truth: `src/lib/item-lifecycle.ts`.*

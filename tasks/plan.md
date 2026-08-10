# Implementation Plan: BUG-42 — Unsaved-changes warning

## Overview

The audit ticket (EXECUTION_SPEC `BUG-42`, verified still open Aug 10, 2026: zero `beforeunload` hits) asks for a dirty-form guard before closing a sheet or navigating away. Read-only planning found the ticket is **partially implemented already**: TaskAddPanel, AddPersonPanel, and LocationAddPanel each have a `handleClose` + "Discard Changes?" `ConfirmModal` wired to `Sheet`'s `onClose`, and every Sheet close path (X button, backdrop, Escape, drag-dismiss — `Sheet.tsx:35,51,66,99`) routes through it.

What is **genuinely missing**:

1. **`beforeunload` — 0 occurrences repo-wide.** Browser refresh / tab close / back-out while a dirty sheet is open loses data with no prompt.
2. **ExploreDrawer — no guard at all.** Plain `useState` form (title, url, note, type, tags, linkedThreadId); `onClose` passes straight through to `Sheet` (`ExploreDrawer.tsx:230`).
3. **RHF `isDirty` blind spots.** TaskAddPanel's non-RHF fields — `subtasks`, `timeEstimate`, `linkedPeopleIds`, `freq`/`days`/`customRRule`/`customInterval`, `startDate` — and AddPersonPanel's `color` are plain state; edits to them never set `isDirty`, so the existing close guard silently misses them (LocationAddPanel is fully covered: both fields are RHF-registered).

## Architecture Decisions

- **`useUnsavedGuard(isDirty)` hook** (new, `src/hooks/`) registers a `beforeunload` listener only while dirty (add/remove in effect, legacy `preventDefault() + returnValue = ""` pattern). Per-panel wiring, no global store plumbing.
- **Snapshot-compare at close time** for non-RHF fields, not per-change state wiring: capture a baseline ref of the plain-state fields when the sheet opens (same effect that resets the form), compare at close. Zero new `onChange` churn, and it naturally excludes transient state like `newCategoryName`.
- **Sheet-close guard stays local per panel** (existing pattern): `handleClose` checks combined dirty (RHF `isDirty` OR snapshot-diff), shows the existing "Discard Changes?" `ConfirmModal` pattern. Successful saves already call `onClose()` directly, so no false warnings.
- **`beforeunload` only covers browser-level unload.** In-app Next.js client-side navigation while a sheet is open unmounts the sheet without firing it — accepted limitation for this ticket (noted in Risks; a router-level guard is a separate decision).
- No code changes to `Sheet.tsx` (its close contract is fine), no changes to `ConfirmModal`.

## Task List

### Phase 1: Foundation

- [ ] **Task 1: `useUnsavedGuard` hook + test** (XS, 2 files)
  - **Description:** New hook `src/hooks/useUnsavedGuard.ts` — `useUnsavedGuard(isDirty: boolean)`: while `isDirty`, add a `beforeunload` listener that calls `e.preventDefault()` and sets `e.returnValue = ""` (legacy-compat so the browser shows the prompt); remove on `false`/unmount. Follows existing hook style (`useMediaQuery`-like, no `motion`).
  - **Acceptance criteria:**
    - [ ] `rg 'beforeunload' src` shows exactly the hook file (all panels route through it)
    - [ ] Listener present while dirty, removed when not / on unmount (assertable via dispatched `beforeunload` `defaultPrevented`)
  - **Verification:**
    - [ ] New test passes: `npx vitest run src/hooks` (jsdom; `renderHook` + `window.dispatchEvent(new Event("beforeunload", { cancelable: true }))`)
    - [ ] `npm run build` succeeds
  - **Dependencies:** None
  - **Files likely touched:** `src/hooks/useUnsavedGuard.ts` (new), `src/hooks/__tests__/useUnsavedGuard.test.tsx` (new)
  - **Estimated scope:** Small (2 files)

### Checkpoint: hook + test green
- [ ] `npm test` passes (expect 145+ tests), `npm run build` succeeds

### Phase 2: Panel guards (independent — parallelizable)

- [ ] **Task 2: TaskAddPanel — cover non-RHF fields** (S, 1 file)
  - **Description:** In the existing `isOpen` reset effect (`TaskAddPanel.tsx:262-342`), also snapshot `subtasks`, `timeEstimate`, `linkedPeopleIds`, `freq`, `days`, `customRRule`, `customInterval`, `startDate` into a `useRef` baseline (reset on every open). `handleClose` (line 130) becomes: warn if `isDirty || snapshotDiffers()`. Wire `useUnsavedGuard(isDirty || snapshotDiffers())`. Delete-confirm and save paths already call `onClose()` directly — untouched.
  - **Acceptance criteria:**
    - [ ] Adding a subtask / time estimate / linked person / repeat setting, then closing → "Discard Changes?" modal appears
    - [ ] Opening with no edits → closes without prompt (both add and edit modes)
    - [ ] Browser refresh while dirty → native leave prompt; clean state → no prompt
  - **Verification:**
    - [ ] `npm test` (extend `src/lib/__tests__/phase4.test.tsx` TaskAddPanel block: edit subtask state, click close button, assert Discard modal)
    - [ ] `npm run build`
    - [ ] Manual: /do → Add Task → type title → add subtask → close → prompt; Cancel keeps sheet open
  - **Dependencies:** Task 1
  - **Files likely touched:** `src/components/features/TaskAddPanel.tsx`, `src/lib/__tests__/phase4.test.tsx`
  - **Estimated scope:** Medium (2 files)

- [ ] **Task 3: AddPersonPanel — cover `color`** (XS, 1 file)
  - **Description:** Snapshot `color` (plain state, line 43) into a ref alongside the `isOpen` reset effect (line 79); `handleClose` (line 70) warns if `isDirty || color !== baseline`. Wire `useUnsavedGuard`. The relationship fix-up in the open effect must not count as user dirt (it runs at open, before any baseline snapshot is taken — verify ordering: snapshot after fix-up).
  - **Acceptance criteria:**
    - [ ] Choosing an avatar color then closing → prompt; picking the same color (re-click) → no prompt
    - [ ] No edits → no prompt
  - **Verification:**
    - [ ] `npm test` (phase3/phase4 AddPersonPanel coverage — extend with color-then-close case)
    - [ ] `npm run build`
    - [ ] Manual: /remember/people → Add Person → pick a color → close → prompt
  - **Dependencies:** Task 1
  - **Files likely touched:** `src/components/features/AddPersonPanel.tsx`, one test file
  - **Estimated scope:** Small (2 files)

- [ ] **Task 4: LocationAddPanel — beforeunload only** (XS, 1 file)
  - **Description:** Both fields are RHF-registered; close guard already complete. Add `useUnsavedGuard(isDirty)` only. No snapshot needed.
  - **Acceptance criteria:**
    - [ ] Browser refresh while fields edited → native prompt; clean → none
  - **Verification:**
    - [ ] `npm run build`, `npm test`
    - [ ] Manual: /remember/locations → Log Location → type → refresh → prompt
  - **Dependencies:** Task 1
  - **Files likely touched:** `src/components/features/LocationAddPanel.tsx`
  - **Estimated scope:** XS (1 file)

- [ ] **Task 5: ExploreDrawer — full guard (close + beforeunload)** (S, 1-2 files)
  - **Description:** ExploreDrawer has no dirty concept. Snapshot baseline of `title, url, note, type, tags, linkedThreadId` in the `isOpen` effect (line 64) for both add and edit mode (edit baseline = item values). Add `showUnsavedWarning` state, `handleClose` wrapper (`dirty = JSON-diff(current, baseline)` → ConfirmModal "Discard Changes?", else `onClose`), wire `handleClose` to `Sheet`, reset baseline after successful `handleSave` (and after delete). Wire `useUnsavedGuard(dirty)`.
  - **Acceptance criteria:**
    - [ ] Typing a note (or title/url/type/tags/thread link) then closing via X, backdrop, Escape, or drag → prompt; confirm discards, cancel keeps sheet open
    - [ ] Opening untouched in both add and edit mode → no prompt
    - [ ] After successful save → close never prompts
  - **Verification:**
    - [ ] `npm test` (extend phase4 with ExploreDrawer: type note, close, assert modal; save, close, assert none)
    - [ ] `npm run build`
    - [ ] Manual: /explore → Save to Explore → type note → close → prompt; Save → close → none
  - **Dependencies:** Task 1
  - **Files likely touched:** `src/components/features/ExploreDrawer.tsx`, one test file
  - **Estimated scope:** Medium (2 files)

### Checkpoint: BUG-42 complete
- [ ] `npm test` green (144 baseline + new tests), `npm run build` green
- [ ] `rg 'beforeunload' src` → exactly `src/hooks/useUnsavedGuard.ts`; `rg 'showUnsavedWarning' src` → the 4 guarded panels
- [ ] Manual sweep: each of the 4 panels — dirty-close prompts, clean-close silent, save-then-close silent
- [ ] Commit `fix: BUG-42 unsaved-changes guard — beforeunload hook + ExploreDrawer + non-RHF field coverage` (+ doc close-out commit `docs: BUG-42 close-out ...` updating EXECUTION_SPEC ticket, §24.3/§24.7 rows, DOCS_NEEDS_CODE, CONTEXT.md, AGENTS.md §4.6-if-touched) — human reviews before pushing

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `beforeunload` fires on every navigation in some browsers / is ignored by others (modern Chrome shows no custom text) | Low — prompt is browser-styled, may not appear in some contexts | Standard legacy pattern (`returnValue` + `preventDefault`); only registered while dirty, so it never fires spuriously |
| Baseline snapshot drift: field changed programmatically (e.g., chrono auto-fill sets `deadline` — RHF, covered; `setParsedDeadline` isn't part of the manual snapshot) | Med — false prompts or missed prompts | Snapshot only the named plain-state fields, taken at open after all reset logic; RHF fields left to `isDirty`. Task 2 acceptance includes "open with no edits → no prompt" for both modes |
| AddPersonPanel relationship fix-up (open effect) counts as dirt | Low | Snapshot taken after the fix-up runs; verify ordering in Task 3 |
| In-app Next.js client navigation unmounts sheets without `beforeunload` | Med (known limitation) | Documented in plan + ticket close-out; router-level guard is a follow-up decision, out of BUG-42 scope |

## Open Questions (resolved Aug 10, 2026 — human-approved scoping)

- ~~SettingsModal debounced-autosave loss window (close within 1s drops pending save)~~ → **Separate follow-up ticket** (noted as ticket candidate in report; flush-on-close is a distinct concern from dirty-guarding).
- ~~CaptureModal in-progress text loss~~ → **Out of scope** (capture is designed to be instant; audit didn't name it).
- ~~In-app Next.js client-side navigation while a sheet is open~~ → **Out of scope**; documented limitation — `beforeunload` covers browser-level unload only; router-level guard is a follow-up decision.

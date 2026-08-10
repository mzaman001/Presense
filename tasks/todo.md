# Task List — BUG-42 unsaved-changes warning

Status legend: [ ] pending · [~] in progress · [x] done

## Phase 1: Foundation
- [x] Task 1: `useUnsavedGuard(isDirty)` hook (`src/hooks/useUnsavedGuard.ts`) — beforeunload add/remove while dirty; test `src/hooks/__tests__/useUnsavedGuard.test.tsx` (5/5 pass)
  - Acceptance: `rg 'beforeunload' src` → only the hook; dirty → defaultPrevented, clean → not
  - Verify: `npx vitest run src/hooks` + `npm run build`

## Checkpoint: hook + test green
- [x] `npm test` (145+), `npm run build`

## Phase 2: Panel guards (Tasks 2-5 independent)
- [x] Task 2: TaskAddPanel — snapshot baseline of non-RHF fields (subtasks, timeEstimate, linkedPeopleIds, freq, days, customRRule, customInterval, customFreq, startDate) at open; handleClose warns if `isDirty || snapshotDiffers`; wire hook; extend phase4 tests
  - Extra: `shouldDirty: true` added to all 10 user-driven `setValue` sites (category chips/add, priority chips, deadline picker/manual/quick) — `setValue` does not mark RHF dirty by default
- [x] Task 3: AddPersonPanel — baseline snapshot of all fields + `color` at open (after relationship fix-up); handleClose warns on diff; wire hook; extend test
  - Rework: RHF destructured `isDirty` is non-reactive for unwatched fields (component only re-rendered on `watch("relationship")`) — replaced with value-baseline compare via `watch` subscriptions
- [x] Task 4: LocationAddPanel — baseline snapshot of itemName/locationText at open; wire hook; extend test
  - Rework: same reactivity bug as Task 3 (no fields were watched at all — guard silently broken); baseline-compare now deterministic
- [x] Task 5: ExploreDrawer — baseline snapshot of title/url/note/type/tags/linkedThreadId at open (add + edit); handleClose + "Discard Changes?" ConfirmModal; reset baseline after save/delete; wire hook; extend phase4 tests

## Checkpoint: BUG-42 complete
- [x] `npm test` green (167/167), `npm run build` green, `npx tsc --noEmit` clean
- [x] `rg 'beforeunload' src` → hook only (`useUnsavedGuard.ts`; test file references it to assert listener behavior); `rg 'showUnsavedWarning' src` → 4 panels
- [ ] Manual sweep (human): 4 panels — dirty-close prompts / clean-close silent / save-then-close silent
- [x] Commit `fix: BUG-42 ...` (`3e555a0`) + docs close-out (`docs: BUG-42 close-out ...` — EXECUTION_SPEC ticket + §24.3/§24.7 + root-pattern-7 row, DOCS_NEEDS_CODE, CONTEXT.md)
- [ ] Push after human review

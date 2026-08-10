# Task List — MOB-05 close-out + stale-open verification sweep

Status legend: [ ] pending · [~] in progress · [x] done

## Phase 1: MOB-05 close-out (docs only)
- [x] Task 1: Verify MOB-05 current state (read-only) — `rg 'h-screen|100vh' src` = 0 hits; all 6 audit-listed files on `h-dvh`/`min-h-dvh`; fixing commit `8c249b6` (July 7, 2026)
- [x] Task 2: MOB-05 doc close-out — EXECUTION_SPEC (§17.3, §18, §24.1, §24.2 #1, §24.3, DS-29 note), CONTEXT.md, DOCS_NEEDS_CODE.md → Resolved, AGENTS.md §4.3, DESIGN_SYSTEM.md
  - Acceptance: zero stale "h-screen"/"NOT FULLY DONE" text in living docs; every spot cites `8c249b6` + proof
  - Verify: rg sweep + npm run build + npm test

## Checkpoint: MOB-05 closed
- [x] Commit `docs: MOB-05 close-out — verified fixed in 8c249b6, zero h-screen remains` (with sweep close-outs — see Phase 2)
- [x] Human approved: "commit and push anything left with accurate comments and notes"

## Phase 2: Stale-open verification sweep (read-only)
- [x] Task 3: Verify each quick-win ticket against current code → status table (FIXED-with-evidence / OPEN / UNVERIFIED)
  - Pre-verified in planning: BUG-41 (globals.css:1366-1375 16px floor), BUG-36/39 (Sheet.tsx:61 dragListener={false}, ad79e81), BUG-32 (ToastProvider data-mode + MutationObserver), BUG-29 (think/page.tsx:148-151 error toast, real hex), BUG-35 (no setCaptureModalOpen in think/explore), BUG-23 (template.tsx exists), BUG-25/33+BUG-43 (no datalist/select/type=time in src), A11Y-03 (skip link in (app)/layout.tsx), BUG-42 (OPEN — no beforeunload)
  - Still to verify: BUG-02, BUG-08, BUG-09, BUG-11, BUG-30, BUG-31, DS-14, DS-30, ROOT PATTERN 7 (error/loading.tsx + ModalErrorBoundary), ROOT PATTERN 4 (hex count)
- [x] Task 4: Doc close-outs for each verified-fixed ticket — EXECUTION_SPEC §24.7 sweep record + quick-win rows, CONTEXT.md, DOCS_NEEDS_CODE (BUG-43/25-33/31/32/29/30, DS-14, BUG-23, ROOT PATTERN 7 error/loading, A11Y-03, cross-refs), AGENTS.md §4.3/4, DESIGN_SYSTEM.md (§3.6, §4.2, §6.7, §6.9, §6.11, §8.8)
  - Note: CONF-14 = UI collapse DONE, `quiet_start`/`quiet_end` schema cleanup still pending

## Checkpoint: sweep done
- [x] All close-out commits in; build + tests green (144/144)
- [ ] Genuinely-open list + next-ticket recommendation presented to human

# Implementation Plan: MOB-05 close-out + stale-open ticket verification sweep

## Overview

The user asked to start work on MOB-05 (replace `h-screen` with `h-dvh`). Read-only verification shows **MOB-05 is already fixed** — commit `8c249b6` (July 7, 2026) migrated exactly the 6 files the July-9 audit lists as offenders; `rg 'h-screen|100vh' src` returns **zero hits** today (9 `h-dvh`/`min-h-dvh` sites verified). The audit examined a stale state — the same failure mode already closed for ROOT PATTERN 2 (warm-light) and BUG-38's counts.

A bounded verification sweep of the other P0/P1 quick wins found the same pattern is widespread: BUG-41 (16px input floor, `globals.css:1366-1375`), BUG-36/39 (Sheet `dragListener={false}`, `ad79e81`), BUG-32 (ToastProvider `data-mode` binding), BUG-29 (`handleNewThread` error toast + real hex), BUG-35 (empty-state buttons use `handleNewThread`), BUG-23 (`template.tsx` exists), BUG-25/33 + BUG-43 (zero `<datalist>`/`<select>`/`type="time"` in src), A11Y-03 (skip link in `(app)/layout.tsx`) are all **already implemented but still documented as open**.

Work = verify-and-close in docs (no code changes), then re-verify what is genuinely open before picking the next code ticket.

## Architecture Decisions

- **Verify-then-close, one commit per ticket** (MOB-05 precedent: root patterns 1 & 2 were closed the same way Aug 10, 2026). Each close-out cites the fixing commit + the verification command that proves it.
- **No code changes** unless a sweep check contradicts current code state (then that becomes a genuine code ticket instead).
- **Per-rule doc discipline**: EXECUTION_SPEC §17.3/§18/§24 rows, DOCS_NEEDS_CODE (move to Resolved), CONTEXT.md, AGENTS.md §4, DESIGN_SYSTEM stale bullets — only stale statuses edited, historical audit text (docs/audits/*) left untouched.
- **Scope discipline (Law 7):** the sweep is read-only and bounded to the P0/P1 quick-win list; anything not verified stays "unverified", never assumed. A genuinely-open ticket is proposed at the checkpoint for human approval, not started unilaterally.

## Task List

### Phase 1: MOB-05 close-out (docs only)
- [ ] **Task 1: Verify MOB-05 current state** (XS, read-only) — DONE in planning: `rg 'h-screen|100vh' src` → 0 hits; all 6 audit-listed files use `h-dvh`/`min-h-dvh` (verified line-by-line); fixing commit `8c249b6` identified.
- [ ] **Task 2: MOB-05 doc close-out** (S, 5 docs files, no code)
  - Acceptance: no stale "7 h-screen / NOT FULLY DONE / 6 files still reference h-screen" text remains in living docs; each updated spot cites `8c249b6` + the zero-hit rg proof.
  - Files: `docs/plans/EXECUTION_SPEC.md` (§17.3 row 1373, §18 row 1403, §24.1 row 1710, §24.2 quick win #1, §24.3, DS-29 dependency note ~1585), `docs/project/CONTEXT.md` (~273), `docs/project/DOCS_NEEDS_CODE.md` (~31-40 → Resolved section), `AGENTS.md` (§4.3 item 3), `docs/project/DESIGN_SYSTEM.md` (~398).
  - Verification: `rg -n 'h-screen|NOT FULLY DONE'` in living docs → only intentional historical mentions; `npm run build` + `npm test` unaffected (docs-only, but run anyway per rules).

### Checkpoint: MOB-05 closed
- [ ] Docs-only commit `docs: MOB-05 close-out — verified fixed in 8c249b6, zero h-screen remains`
- [ ] Human reviews before proceeding

### Phase 2: Stale-open verification sweep (read-only)
- [ ] **Task 3: Verify each remaining P0/P1 quick-win against current code** (S, read-only) — record a status table: BUG-41, BUG-36/39, BUG-32, BUG-29, BUG-35, BUG-23, BUG-25/33, BUG-43, A11Y-03 (each already spot-verified in planning; re-confirm with command evidence), plus genuinely-unknown: BUG-02, BUG-08, BUG-09, BUG-11, BUG-30, BUG-31, BUG-42 (verified open — no `beforeunload`), DS-14, DS-30, ROOT PATTERN 7 (error/loading files, ModalErrorBoundary), ROOT PATTERN 4 (hardcoded hex count).
  - Acceptance: every item gets a `FIXED (commit/line evidence)` or `OPEN` or `UNVERIFIED` verdict; table lands in the sweep report.
- [ ] **Task 4: Doc close-out for each verified-fixed ticket** (M, ~5-9 docs files total, one commit per ticket — grouped only for tickets sharing a single audit row where the row is one edit)
  - Acceptance: no living-doc "open" status remains for a code-verified-fixed ticket; EXECUTION_SPEC §24.1 rows and §24.2 quick wins reflect reality.

### Checkpoint: sweep done
- [ ] All close-out commits in, build + tests green (144/144)
- [ ] Genuinely-open list presented to human with recommendation for next code ticket (candidates: BUG-42 beforeunload guard, BUG-30 autosave loop, BUG-31 dropdown type-ahead, DS-30 hover standardization)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| A sweep "verify" misses a real open bug in a file I close out | Med | Only close tickets whose fixing commit/rule I can cite line-exactly; everything else stays OPEN/UNVERIFIED |
| Doc edits drift from the "one copy" rule (AGENTS.md §2) | Med | Edit only the single canonical copies listed in AGENTS.md; grep before/after for duplicates |
| Scope creep into a full re-audit | Med | Sweep is bounded to the named quick-win/ticket list; results table, then stop at the human gate |

## Open Questions

- After the sweep, which genuinely-open ticket should be next? (recommendation offered at checkpoint; BUG-42 beforeunload guard is the only verified-open P1 quick win so far)

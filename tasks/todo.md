# Task List — PERF-12 task 4 (remaining TTFB + main-thread cost)

Status legend: [ ] pending · [~] in progress · [x] done · [X] closed with attribution (no code)

## Phase 1: Attribution (read-only, temp probes reverted)
- [x] Task 4.1: Re-attribute TTFB split (proxy getUser vs layout user_settings vs render) + map chunk 0cau6ws9nif22 via webpack ANALYZE rebuild → evidence table in §28
  - Acceptance: measured ms split + chunk module map with reclaimable-vs-framework verdict — MET: getUser 293–366 ms / settings ~300 ms / render ~60 ms; shell = invariant providers + supabase, not reclaimable per-route

## Gate 1 (human): TTFB option — A leave / B TTL cache + client reconcile / C client-only (rejected)
- [x] Human decides A or B → **Option A chosen (recommendation adopted)**
- [x] If B: Law 7 approval — N/A (A chosen)

## Phase 2: Execute TTFB option
- [x] Task 4.2: Option A — doc-only close with attribution (no code); ledger §26.5 row + §28 status added
  - Acceptance (A): verdict recorded, no code touched — MET
  - Verify: N/A (no code; 144/144 unaffected)

## Phase 3: Main-thread shared chunk
- [x] Task 4.3: Decouple barrel-import culprit if map shows one; else close with attribution → **CLOSED: shared shell is invariant-required providers + supabase; turbopack merging not app-configurable; no app-level lever**
  - Acceptance: script-set gz reduced on all (app) routes + Lighthouse parity-or-better, OR documented close-with-attribution verdict — MET (verdict documented)

## Checkpoint: PERF-12 close-out (human review)
- [x] All acceptance criteria met or closed with attribution — **PERF-12 CLOSED with attribution (human-approved)**: TBT met; LCP/perf attributed to security boundary + SSR gating + invariant-required shell; verdict in §28
- [x] npm test 144/144, npm run build green — confirmed at close-out
- [x] Ledger §26.5 rows for every attempt — fixes 1–2 + task 4 recorded
- [x] §28 status paragraphs updated — tasks 1–4 + verdict
- [x] Final verdict vs acceptance (perf ≥ 70, LCP ≤ 4 s, TBT ≤ 1 s) — TBT met (440/450 ms), LCP/perf short, CLOSED with attribution per PERF-11 precedent
- [x] Human reviews before further work — done; follow-up suggestion: /do rendering-strategy study (not ticketed)

# Implementation Plan: §29 Audit Queue — Final 4 Tickets

## Overview

Complete the remaining 4 §29 audit tickets in dependency order: PERF-13 (one-liner, quick win), PWA2-01 (asset + manifest), INFRA-23 (edge functions + migration), SEC2-02 (Dashboard verification — needs human). Each lands as an independent commit pair (implementation + docs close-out), following the established SEC2-01/OBS-01/CI-01..04 pattern.

## Architecture Decisions

- **No batching across tickets.** Each ticket is one commit pair per EXECUTION_RULES. Commit with ticket ID in message.
- **PWA2-01 maskable icon:** generate via `maskable.app` or manual safe-zone crop of existing `icon-192.png`/`icon-512.png`. Manifest fields (`screenshots`, `shortcuts`, `scope`, `id`, `categories`) added from the audit spec.
- **INFRA-23 cron race:** add a partial unique index on `(user_id, title) WHERE status = 'active'` in a new Supabase migration, then treat insert conflict as success (fail-and-swallow) instead of the preceding `select`. Both edge functions rewritten to use `Deno.serve` + `npm:@supabase/supabase-js@2`.
- **SEC2-02 is a human-action ticket.** I prep the checklist; you click through the Dashboard. Record decisions.

## Task List

### Phase 1: Quick Win

- [ ] **Task 1 (PERF-13):** Change `removeConsole: process.env.NODE_ENV === "production"` to `removeConsole: { exclude: ["error"] }` in `next.config.ts`. Verify `rg 'console\\.error' .next/static/chunks` shows retained calls in prod build.

### Checkpoint: PERF-13
- [ ] `npm run build` green; `rg 'console' .next/static` shows `console.error` retained

### Phase 2: PWA2-01

- [ ] **Task 2:** Generate maskable icons at 192/512 with 80% safe-zone padding (keep existing icons as `"purpose": "any"` only).
- [ ] **Task 3:** Add manifest fields: `screenshots` (one wide + one narrow `form_factor`), `shortcuts` (Quick Capture), `scope`, `id`, `categories`. Verify `maskable.app` passes.

### Checkpoint: PWA2-01
- [ ] Icons visually correct (safe zone), manifest validates, install dialog shows rich variant

### Phase 3: INFRA-23

- [ ] **Task 4:** Rewrite `cron_cleanup` and `cron_recurrence` to use `Deno.serve` + `npm:@supabase/supabase-js@2` (replace deprecated `deno.land/std` + `esm.sh` imports).
- [ ] **Task 5:** Add Supabase migration: partial unique index on `(user_id, title) WHERE status = 'active'` for recurring tasks. Update `cron_recurrence` to treat insert conflict as success (fail-and-swallow).
- [ ] **Task 6:** Verify both functions run under `Deno.serve`; concurrent-invocation yields exactly one recurring task.

### Checkpoint: INFRA-23
- [ ] Migration applies clean; both functions use new imports; no duplicate recurring tasks on concurrent trigger

### Phase 4: SEC2-02 (Human Action)

- [ ] **Task 7:** Prep checklist (password floor, CAPTCHA, email confirmation, Supavisor/PITR, Edge Function invocation auth). You run through Dashboard and record decisions. I close out the ticket in docs once decisions are recorded.

### Checkpoint: §29 Complete
- [ ] All 4 tickets closed in EXECUTION_SPEC §29 + DOCS_NEEDS_CODE
- [ ] Push all commits after human review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| PWA2-01 icon generation tooling | Low | `maskable.app` is a free web tool; manual crop as fallback |
| INFRA-23 partial unique index requires migration | Medium | Write migration carefully; test concurrent trigger locally if possible |
| SEC2-02 needs human Dashboard access | Blocker | Prep checklist now; human runs it when ready |

## Open Questions

- **PWA2-01:** Do you have the original icon source file (Figma/SVG), or should I work from the existing PNGs in `public/`?
- **SEC2-02:** Can you access the Supabase Dashboard now, or should I park this ticket and move to the wider backlog (BUG-44, DS-30)?

## Completed

> **✅ COMPLETE Aug 12, 2026** — all 4 tickets landed, §29 queue closed.
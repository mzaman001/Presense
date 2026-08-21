# Presense: Active Queue

This is the **only** file an agent reads to find their next task. One ticket at a time.

## Current Phase: Governance Reset (Aug 21, 2026)

| ID | Ticket | Priority | Status |
|---|---|---|---|
| RESET-01 | **Governance Reset Execution** | Critical | 🔄 In Progress |
| SEC2-03 | Magic-link rate limit + enumeration closure | High | ⬜ Open |
| INFRA-24 | Dependabot triage & vulnerability closure | Medium | ⬜ Open |
| PERF-14 | Zustand selector reads sweep | Medium | ⬜ Open |
| TOOL-11 | Sentry secret wiring (Human action) | Medium | ⬜ Blocked |
| SEC3-02 | Supabase secret wiring (Human action) | Medium | ⬜ Blocked |

## Rules for Agents

1. Read `AGENTS.md` first.
2. Pick the top-most **Open** ticket.
3. Perform the work (Build + Test + Commit + Stop).
4. Update this file: mark the ticket ✅ CLOSED and move to the next.
5. If the queue is empty, ask the user for the next phase.

*Full backlog history: `docs/audits/archive/EXECUTION_SPEC-archive-aug21.md`*

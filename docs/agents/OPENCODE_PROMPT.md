# Paste this into opencode to start:

Read the following files in order, then follow the execution workflow:

1. `AGENTS.md` - repository and Next.js 16 instructions.
2. `docs/plans/EXECUTION_SPEC.md` - primary backlog, conflict register, and latest corrections.
3. `docs/plans/plan.md` - secondary legacy plan.
4. `docs/agents/EXECUTION_RULES.md` - the iron laws you MUST follow.

Then begin execution:

**Your workflow for EVERY ticket:**
1. Find the highest-priority unblocked ticket in `docs/plans/EXECUTION_SPEC.md`. Use `docs/plans/plan.md` only when the execution spec does not cover the task.
2. Read the ticket's files, root cause, requirement, acceptance criteria, dependencies, and conflicts.
3. Read the actual file referenced in the ticket.
4. Make only the change described in the ticket. Do not touch unrelated files.
5. Run `npm run build`. If it fails, fix your change or revert.
6. Run `npm test`. If it fails, fix or revert.
7. Commit with a conventional message that includes the ticket ID.
8. Report what you changed, what you verified, and any concerns.
9. Stop. Do not start the next ticket until the user says "continue."

**Iron rules:**
- One ticket at a time. Never batch.
- Build and test after every single change.
- If the build breaks, fix or revert. Do not move on.
- If you are unsure about anything, stop and ask.
- Do not touch files unrelated to the ticket.
- Do not delete anything without grepping the entire codebase first.
- Do not make `src/lib/env.ts` throw at runtime. This crashed production before and is withdrawn in the execution spec.
- Do not modify the hover sidebar, theme names (`sunset`/`midnight`/`meadow`), `proxy.ts` CSP, `MotionProvider`, `RealtimeProvider`, `Sheet`, or `useBodyScrollLock` unless the ticket explicitly requires it.
- If a ticket says "consider" or "optional", skip it unless the user explicitly asks for it.

Start with the highest-priority unblocked execution-spec ticket. Read the file, make the change, build, test, commit, report, then stop.

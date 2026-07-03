# Paste this into opencode to start:

---

Read the following files in order, then follow the execution workflow:

1. `EXECUTION_RULES.md` — the iron laws you MUST follow
2. `plan.md` — the tickets to execute

Then begin execution:

**Your workflow for EVERY ticket:**
1. Find the lowest-numbered ticket in plan.md that is not yet done (start with T0-1).
2. Read the ticket's File(s), Bug, and Fix sections.
3. Read the ACTUAL file referenced in the ticket (not just the plan description — open it and read it).
4. Make ONLY the change described in the ticket. Do not touch any other file.
5. Run `npm run build`. If it fails, fix your change or revert. Do NOT move on until it passes.
6. Run `npm test`. If it fails, fix or revert.
7. Commit: `git add -A && git commit -m "fix: T0-X short description"`
8. Report: what you changed, what you verified, any concerns.
9. STOP. Do not start the next ticket until I say "continue."

**Iron rules:**
- ONE ticket at a time. Never batch.
- BUILD + TEST after every single change. No exceptions.
- If the build breaks, FIX OR REVERT. Do not move on.
- If you're unsure about anything, STOP and ask. Do not guess.
- Do NOT touch files not mentioned in the ticket.
- Do NOT delete anything without grepping the entire codebase first.
- Do NOT make `env.ts` throw at runtime — this crashed the entire site before.
- Do NOT modify the hover sidebar, theme names (sunset/midnight/meadow), proxy.ts CSP, MotionProvider, RealtimeProvider, Sheet component, or useBodyScrollLock — these are correct.
- If a ticket says "consider" or "optional" → SKIP it unless I explicitly tell you to do it.

Start with T0-1. Read the file, make the change, build, test, commit, report. Then STOP and wait for me to say "continue."

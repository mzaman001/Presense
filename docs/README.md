# Presense Documentation

This folder keeps project context out of the repository root.

## Structure

- `plans/EXECUTION_SPEC.md` - primary backlog, conflict register, latest corrections, and explicit human-decision gates.
- `plans/plan.md` - older ticket plan. Treat as secondary when it conflicts with the execution spec.
- `agents/EXECUTION_RULES.md` - required workflow for coding agents.
- `agents/OPENCODE_PROMPT.md` - prompt for starting an opencode execution session.
- `project/` - architecture, design system, identity, and project notes.
- `archive/` - historical request/context documents kept for reference.

## Source Of Truth

Use `plans/EXECUTION_SPEC.md` first. It contains newer regression notes and conflict resolutions that supersede the older `plans/plan.md`, including the rule that `src/lib/env.ts` must not throw at runtime.

# AGENTS.md — Presense

> **This file is the single entry point for every coding agent** (Antigravity, Cursor, Claude Code, Codex, opencode, or any other tool). If any other file disagrees with this one, **this file wins.**
>
> **Antigravity-specific note:** Antigravity resolves `GEMINI.md` ABOVE `AGENTS.md`. If `GEMINI.md` exists and disagrees with this file, Antigravity will silently follow `GEMINI.md` instead. `GEMINI.md` in this repo is a one-line pointer to this file — do not add rules to it.

---

## 0. Before you do anything

1. **Read this file fully.** It is short on purpose (under 100 lines).
2. **Read `docs/plans/EXECUTION_SPEC.md`** — the only active backlog. Find the highest-priority ticket that is not blocked by an unresolved conflict (`CONF-*`). `plan.md` no longer exists; if you find one, it is stale — flag it, do not follow it.
3. **If you are about to create or modify any UI** (component, sheet, panel, dropdown, menu, card, form, input, button, icon usage) — **STOP and read `docs/project/DESIGN_SYSTEM.md` first.** If what you need is not documented there, **stop and ask** before inventing new markup, new colors, new spacing, or new patterns. This is the rule this project has been violated on most often.

---

## 1. Hard invariants — do not change without recorded approval

Violating any of these has previously broken this project in production. Changing them requires a line in the PR description: `Invariant-change-approved-by: <name/date>` — no line, no merge.

1. **`src/lib/env.ts` must never throw at runtime** on a missing env var. It returns empty strings. An earlier version that threw crashed the entire site. Do not adopt `@t3-oss/env-nextjs` in its default (throwing) configuration.
2. **Theme IDs are `"warm" | "navy" | "forest"`** (see `src/lib/theme.ts`). Stored in `localStorage`, `user_settings.theme` column, and CSS `data-theme` attribute. This is the third name this set has had. It does not get a fourth without explicit recorded decision.
3. **`Dropdown.tsx` and `Popover.tsx` render via `createPortal(..., document.body)`.** Do not replace with a z-index-only fix — it silently breaks inside any `overflow: hidden` ancestor.
4. **Sidebar is pure hover-expand** (`w-[80px] hover:w-[248px] focus-within:w-[248px]`). No click-toggle, no pinning.
5. **`MotionProvider` keeps `LazyMotion features={domMax} strict`.** All motion components use `m.*` not `motion.*`. `RealtimeProvider` uses ref-counted, debounced (5s) shared channels — do not replace with per-component subscriptions.
6. **Never drop a database column in a migration.** Never remove `auth.uid() = user_id` from an RLS policy. Never delete a file under `src/components/ui/` or `supabase/migrations/`.
7. **`useBodyScrollLock` sets `data-overlay-open` on `<html>`.** Lenis checks this to pause. Do not change this coordination mechanism.

---

## 2. Where everything lives — do not duplicate

| Topic | File | Notes |
|---|---|---|
| Active backlog, bugs, conflicts | `docs/plans/EXECUTION_SPEC.md` | The only backlog. Ticket IDs: `BUG-*`, `DS-*`, `A11Y-*`, `MOB-*`, `PERF-*`, `INFRA-*`, `CONF-*`. |
| Design tokens, component specs, visual rules | `docs/project/DESIGN_SYSTEM.md` | The authoritative design spec. Every component pattern, every token, every state. |
| Component inventory (what exists, what's stable) | `docs/project/COMPONENT_MANIFEST.md` | Machine-checkable list of approved UI primitives. |
| System architecture, data model | `docs/project/ARCHITECTURE.md` | Reference only. |
| What the app is (stack, spaces, philosophy) | `docs/project/CONTEXT.md` | Read for project context. Not instructions — reference. |
| Agent workflow (one ticket at a time, build+test+stop) | `docs/agents/EXECUTION_RULES.md` | Read before your first ticket. |
| Historical context | `docs/archive/` | Read-only. Never current instruction. |

**If you find a second copy of any of these files** (at repo root, in an old path, anywhere) — that is a bug. Delete the stale copy.

---

## 3. Workflow

Follow `docs/agents/EXECUTION_RULES.md` exactly:
1. **One ticket at a time.** Read the actual files before editing.
2. **`npm run build` and `npm test` after every change.**
3. **Commit** with the ticket ID in the message (`fix: BUG-02 short description`).
4. **STOP and report.** Do not batch tickets. Do not fix things you noticed but weren't asked to fix — note them as new ticket candidates instead.

---

## 4. The design system rule (most violated rule in this project)

**If you are about to write any JSX that renders a visible UI element, and the pattern is not in `docs/project/DESIGN_SYSTEM.md`, STOP.** Do not invent a new card style, a new input style, a new button style, a new spacing value, or a new color. Ask first. Every time an agent has invented a new pattern on the spot, the app has gotten more inconsistent.

**The approved primitives are in `docs/project/COMPONENT_MANIFEST.md`.** Use them. If none fits, add a ticket to `EXECUTION_SPEC.md` requesting a new primitive. Do not build a one-off.

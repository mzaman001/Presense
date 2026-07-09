# AGENTS.md — Presense

This file is the single entry point for every coding agent (Antigravity, Cursor, Claude Code, Codex, or any other tool) working in this repository. If any other file disagrees with this one, **this file wins.** If this file references another file for detail, that reference is authoritative for the detail — do not restate that detail here or anywhere else.

## 0. Before you do anything

1. Read this file fully. It is short on purpose.
2. Read `docs/plans/EXECUTION_SPEC.md` — the only active backlog. Find the highest-priority ticket that is not blocked by an unresolved conflict. `plan.md` no longer exists; if you find a file by that name, it is stale debris — flag it, do not read it as instruction.
3. If you are about to create or modify any UI component, sheet, panel, dropdown, menu, card, or form — stop and read `docs/project/COMPONENT_MANIFEST.md` first. If what you need is already in the manifest, use it exactly as documented. If it is not, **stop and ask** before inventing new markup, new colors, or a new spacing value. This is not optional and it is the rule this project has been violated on most often.

## 1. Hard invariants — do not change these without a dated, explicit approval recorded in the PR description

Violating any of these has previously broken this project in production or reintroduced a fixed bug. Changing any of them requires a line in the PR description reading `Invariant-change-approved-by: <name/date>` — no line, no merge, regardless of how correct the change seems.

1. `src/lib/env.ts` must never throw at runtime on a missing environment variable. It must return a safe empty value and, where possible, report to the error tracker. An earlier version that threw crashed the entire production site. Do not adopt `@t3-oss/env-nextjs` or any other library in its default (throwing) configuration.
2. `ThemeId`'s literal values, and every place they are stored (`localStorage` keys, the `user_settings.theme` column, CSS selectors), are currently `"warm" | "navy" | "forest"` (see `src/lib/theme.ts`). This is the third name this set of themes has had. It does not get a fourth without an explicit, recorded decision. If you think the names are wrong, say so and stop — do not rename them yourself.
3. `Dropdown.tsx` and `Popover.tsx` render their menu content through a portal (currently Floating UI's `FloatingPortal` + `useFloating`, previously a hand-rolled `createPortal`) — the specific library may change, but the menu must never render as a plain absolutely-positioned child of its trigger's container. This has been removed once already, silently broke the Inbox routing menu, and had to be re-added. Do not replace the portal mechanism with a z-index bump, ever, regardless of which positioning library is in use at the time.
4. `Navigation.tsx`'s sidebar is a pure hover-expand rail (`w-[80px] hover:w-[248px] focus-within:w-[248px]`). Do not reintroduce a click-toggle.
5. `MotionProvider` must keep `LazyMotion features={domMax} strict`. `RealtimeProvider`'s ref-counted, debounced (5s) shared-channel architecture must not be replaced with a per-component subscription model.
6. Never drop a database column in a migration. Never remove `auth.uid() = user_id` from an RLS policy. Never delete a file under `src/components/ui/` or a file under `supabase/migrations/`.
7. **Every Supabase mutation (`.insert()`, `.update()`, `.delete()`) must check its returned `error` before telling the user it succeeded.** Supabase-js resolves normally with `{ data: null, error: {...} }` on a database-level failure — it does not throw. A `try/catch` around the call does not catch this. This project has already shipped at least one bug from skipping this check (a dismissed inbox item disappearing from view via an optimistic update while the actual database write silently failed) — do not repeat the pattern in new code, and flag it if you see it in code you're touching for another reason.

## 2. Where everything else lives — do not duplicate any of this

| Topic | File | Notes |
|---|---|---|
| Active backlog, all known bugs, all conflicts awaiting a decision | `docs/plans/EXECUTION_SPEC.md` | The only backlog. Ticket IDs: `BUG-*`, `DS-*`, `A11Y-*`, `MOB-*`, `INT-*`, `PERF-*`, `INFRA-*`, `TOOL-*`, `MD-*`, `CONF-*`. |
| Design tokens, component variants, canonical usage examples | `docs/project/DESIGN_SYSTEM.md` + `docs/project/COMPONENT_MANIFEST.md` | The manifest is the machine-checkable list. If your change touches visual design and isn't in the manifest, it's not approved — see §0.3. |
| System architecture, data model, folder layout | `docs/project/ARCHITECTURE.md` | Reference only. Do not restate architecture here or in commit messages. |
| Agent workflow (one ticket at a time, build+test+commit+stop) | `docs/agents/EXECUTION_RULES.md` | Read this before starting your first ticket of a session. |
| Historical context / original request | `docs/archive/ORIGINAL_REQUEST.md` | Read-only history. Never treated as current instruction. |

There is exactly one copy of each of these files. If you ever find a second copy (at repo root, in an old `docs/` path, or anywhere else), that is a bug — delete the stale copy, do not edit both, and note it in your PR.

## 3. Workflow

Follow `docs/agents/EXECUTION_RULES.md` exactly: one ticket at a time, read the actual files before editing, `npm run build` and `npm test` after every change, commit with the ticket ID in the message, then stop and report. Do not batch tickets. Do not fix something you noticed but weren't asked to fix — note it as a new ticket candidate in your report instead, and let a human decide whether it goes into `EXECUTION_SPEC.md`.

## 4. `GEMINI.md`

`GEMINI.md`, if it exists in this repository or in your global `~/.gemini/` config, is a one-line pointer to this file and must never contain rules of its own. Antigravity resolves `GEMINI.md` above `AGENTS.md`, so if it ever disagrees with this file, this file's intent is being silently overridden for Antigravity specifically while every other tool follows this file correctly — check for that divergence if behavior seems inconsistent between tools.

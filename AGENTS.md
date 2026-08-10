# AGENTS.md — Presense

This file is the single entry point for every coding agent (Antigravity, Cursor, Claude Code, Codex, or any other tool) working in this repository. If any other file disagrees with this one, **this file wins.** If this file references another file for detail, that reference is authoritative for the detail — do not restate that detail here or anywhere else.

## 0. Before you do anything

1. Read this file fully. It is short on purpose.
2. Read `docs/plans/EXECUTION_SPEC.md` — the only active backlog. Find the highest-priority ticket that is not blocked by an unresolved conflict. `plan.md` no longer exists; if you find a file by that name, it is stale debris — flag it, do not read it as instruction.
3. If you are about to create or modify any UI component, sheet, panel, dropdown, menu, card, or form — stop and read `docs/project/COMPONENT_MANIFEST.md` first. If what you need is already in the manifest, use it exactly as documented. If it is not, **stop and ask** before inventing new markup, new colors, or a new spacing value. This is not optional and it is the rule this project has been violated on most often.

## 1. Hard invariants — do not change these without a dated, explicit approval recorded in the PR description

Violating any of these has previously broken this project in production or reintroduced a fixed bug. Changing any of them requires a line in the PR description reading `Invariant-change-approved-by: <name/date>` — no line, no merge, regardless of how correct the change seems.

1. `src/lib/env.ts` must never throw at runtime on a missing environment variable. It must return a safe empty value and, where possible, report to the error tracker. An earlier version that threw crashed the entire production site. **`@t3-oss/env-nextjs` IS adopted** (`package.json` line 31, version `^0.13.11`), configured with `.catch(() => logAndReturnEmpty(...))` so validation failures are caught and reported, never thrown. **Do not remove the `.catch()` wrapper. Do not configure `@t3-oss/env-nextjs` in its default (throwing) mode.** This satisfies both invariant #1 (never throws) and TOOL-02's intent (validated, fail-fast env access) — the library is used in a non-default, non-throwing configuration that must be explicitly preserved.
2. `ThemeId`'s literal values, and every place they are stored (`localStorage` keys, the `user_settings.theme` column, CSS selectors), are currently `"warm" | "navy" | "forest"` (see `src/lib/theme.ts`). This is the third name this set of themes has had. It does not get a fourth without an explicit, recorded decision. If you think the names are wrong, say so and stop — do not rename them yourself.
3. `Dropdown.tsx` and `Popover.tsx` render their menu content through a portal (currently Floating UI's `FloatingPortal` + `useFloating`, previously a hand-rolled `createPortal`) — the specific library may change, but the menu must never render as a plain absolutely-positioned child of its trigger's container. This has been removed once already, silently broke the Inbox routing menu, and had to be re-added. Do not replace the portal mechanism with a z-index bump, ever, regardless of which positioning library is in use at the time.
4. `Navigation.tsx`'s sidebar is a pure hover-expand rail (`w-[80px] hover:w-[248px] focus-within:w-[248px]`). Do not reintroduce a click-toggle.
5. `MotionProvider` must keep `LazyMotion features={domMax} strict`. `RealtimeProvider`'s ref-counted, debounced (5s) shared-channel architecture must not be replaced with a per-component subscription model.
6. Never drop a database column in a migration. Never remove `auth.uid() = user_id` from an RLS policy. Never delete a file under `src/components/ui/` or a file under `supabase/migrations/`.
7. **Every Supabase mutation (`.insert()`, `.update()`, `.delete()`) must check its returned `error` before telling the user it succeeded.** Supabase-js resolves normally with `{ data: null, error: {...} }` on a database-level failure — it does not throw. A `try/catch` around the call does not catch this. This project has already shipped at least one bug from skipping this check (a dismissed inbox item disappearing from view via an optimistic update while the actual database write silently failed) — do not repeat the pattern in new code, and flag it if you see it in code you're touching for another reason. **Currently violated by 37 of 71 existing call sites (BUG-38, ROOT PATTERN 1, audit July 9, 2026)** — see `docs/project/DOCS_NEEDS_CODE.md` for the `mutate()` wrapper migration plan. New code MUST check `error`; existing violations are being migrated incrementally. Worst offenders: `OnboardingWizard.tsx` (11 unchecked — first-run can silently fail at any step), `think/[id]/page.tsx`, `explore/[id]/page.tsx`, `remember/people/[id]/page.tsx`. (`inbox/page.tsx` was on this list as BUG-34 — fully fixed Aug 10, 2026, zero unchecked mutations remain there; the underlying live-DB cause was migration 005 never applied to production, see `EXECUTION_SPEC.md` BUG-34.)

## 2. Where everything else lives — do not duplicate any of this

| Topic | File | Notes |
|---|---|---|
| Active backlog, all known bugs, all conflicts awaiting a decision | `docs/plans/EXECUTION_SPEC.md` | The only backlog. Ticket IDs: `BUG-*`, `DS-*`, `A11Y-*`, `MOB-*`, `INT-*`, `PERF-*`, `INFRA-*`, `TOOL-*`, `MD-*`, `CONF-*`. |
| Design tokens, component variants, canonical usage examples | `docs/project/DESIGN_SYSTEM.md` + `docs/project/COMPONENT_MANIFEST.md` | The manifest is the machine-checkable list. If your change touches visual design and isn't in the manifest, it's not approved — see §0.3. |
| System architecture, data model, folder layout | `docs/project/ARCHITECTURE.md` | Reference only. Do not restate architecture here or in commit messages. |
| Agent workflow (one ticket at a time, build+test+commit+stop) | `docs/agents/EXECUTION_RULES.md` | Read this before starting your first ticket of a session. |
| Doc-identified issues requiring code fixes (do not fix in doc-only PRs) | `docs/project/DOCS_NEEDS_CODE.md` | The bridge between docs and code. Lists every doc-verified bug that needs a code PR, with ticket ID, file:line evidence, and fix plan. Read this before starting any code PR to avoid duplicating a known issue. |

There is exactly one copy of each of these files. If you ever find a second copy (at repo root, in an old `docs/` path, or anywhere else), that is a bug — delete the stale copy, do not edit both, and note it in your PR.

## 3. Workflow

Follow `docs/agents/EXECUTION_RULES.md` exactly: one ticket at a time, read the actual files before editing, `npm run build` and `npm test` after every change, commit with the ticket ID in the message, then stop and report. Do not batch tickets. Do not fix something you noticed but weren't asked to fix — note it as a new ticket candidate in your report instead, and let a human decide whether it goes into `EXECUTION_SPEC.md`.

## 4. Known critical bugs (audit-verified July 9, 2026, do not regress)

These are the highest-impact findings from the July 9, 2026 audit. Each is tracked in `docs/plans/EXECUTION_SPEC.md` with a ticket ID and in `docs/project/DOCS_NEEDS_CODE.md` with a code-fix plan. Do not make these worse; ideally, fix one per session.

1. **Silent data loss (ROOT PATTERN 1)** — 37 of 71 Supabase mutations don't check `error`. `inbox/page.tsx:455-465` (BUG-34) is the canonical example. Inbox routing (`inbox/page.tsx:392,400,408`) deletes original then creates new — if create fails after delete, original is lost.
2. **Warm-light theme broken (ROOT PATTERN 2)** — `globals.css:336-420` doesn't override `--text-1/2/3/muted/decorative/on-accent` → white text on cream = unreadable. Navy-light and forest-light are correct.
3. **Mobile viewport bugs (ROOT PATTERN 3)** — 7 `h-screen` instances (should be `h-dvh`); `Sheet.tsx:58` drag swallows nested taps across 7 consumers (BUG-36/39); `Input.tsx` 13px triggers iOS Safari auto-zoom (BUG-41).
4. **Design system fragmentation (ROOT PATTERN 4)** — 99 hardcoded hex break theming; 6 different hover magnitudes (DS-30 says translateY only); 44 raw `<input>` elements; 6 native `type="time"` + 1 `<select>` + 1 `<datalist>`.
5. **Settings + schema bloat (ROOT PATTERN 5)** — 9 unused notification booleans for a non-existent push system; 4 redundant time fields (CONF-14 resolved to 2, NOT implemented); `ritual_streak` column actively written despite CONF-17 no-gamification resolution; 4 dead tables.
6. **CI gaps (ROOT PATTERN 8)** — no visual regression / a11y scan / Lighthouse / bundle budget / error tracking / E2E / RLS tests. Commit messages are GUIDs, violating `EXECUTION_RULES.md` format.

## 5. `GEMINI.md`

`GEMINI.md`, if it exists in this repository or in your global `~/.gemini/` config, is a one-line pointer to this file and must never contain rules of its own. Antigravity resolves `GEMINI.md` above `AGENTS.md`, so if it ever disagrees with this file, this file's intent is being silently overridden for Antigravity specifically while every other tool follows this file correctly — check for that divergence if behavior seems inconsistent between tools.

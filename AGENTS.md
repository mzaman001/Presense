# AGENTS.md — Presense

This is the single entry point for every coding agent. If any other file disagrees, **this file wins.**

## 0. Before you do anything

1. Read this file fully. It is short on purpose.
2. Read `docs/QUEUE.md` — the **only** active backlog. Pick the top-most unblocked ticket.
3. If modifying UI, read `docs/project/COMPONENT_MANIFEST.md` first. Do not invent new markup or spacing.

## 1. Hard Invariants

Do not change these without dated, explicit approval in the PR.

1. `src/lib/env.ts` must never throw. Use `@t3-oss/env-nextjs` in non-throwing mode with `.catch()`.
2. `ThemeId` values are strictly `"warm" | "navy" | "forest"`. Do not rename.
3. `Dropdown.tsx` and `Popover.tsx` must render through a portal. No z-index hacks.
4. `Navigation.tsx` is hover-expand only (`w-[80px] hover:w-[248px]`). No click-toggle.
5. `MotionProvider` uses `LazyMotion domMax strict`. `RealtimeProvider` uses ref-counted debounced channels.
6. Never drop DB columns or delete files in `supabase/migrations/` or `src/components/ui/`.
7. **Every Supabase mutation must check `error` before reporting success.** Use `safeMutate()`.

## 2. Reference Map

| Topic | Location |
|---|---|
| Active Queue | `docs/QUEUE.md` |
| Design Tokens | `docs/project/DESIGN_SYSTEM.md` |
| Component List | `docs/project/COMPONENT_MANIFEST.md` |
| Architecture | `docs/project/ARCHITECTURE.md` |
| Workflow Rules | `docs/agents/EXECUTION_RULES.md` |
| Interaction Contract | `docs/project/INTERACTION_PATTERNS.md` |
| Closed History | `docs/audits/archive/` |

## 3. Workflow

Follow `docs/agents/EXECUTION_RULES.md`: one ticket at a time, read files before editing, `npm run build` + `npm test` after every change, commit with ticket ID, then stop.

# CONTEXT — What Presense Is

> **Read this for project context.** This file describes what the app is, not how to work on it. For how to work, read `docs/agents/EXECUTION_RULES.md`. For the visual spec, read `docs/project/DESIGN_SYSTEM.md`.

---

## One-line summary

Presense is a personal productivity web app for a solo user — a second brain that refuses to be another infinite canvas. It captures tasks, people, thoughts, and memories, and surfaces them back at the right moment.

---

## Stack (verified July 5, 2026)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.9 |
| Language | TypeScript | 5.x (strict) |
| Runtime | React | 19.2.4 |
| Styling | Tailwind CSS | 4.x |
| Animation | Framer Motion (m.* + LazyMotion strict) | 12.x |
| Smooth scroll | Lenis | 1.3.x |
| State (client) | Zustand | 5.x |
| State (server) | TanStack Query | 5.x |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) | 2.x |
| NLP | compromise.js + chrono-node (local, no AI APIs) | 14.x / 2.x |
| Validation | Zod | 4.x |
| PWA | Serwist | 9.x |
| Rate limiting | Upstash Redis + Ratelimit | 2.x |
| Icons | Lucide React | 1.17.x |
| Drag-and-drop | @dnd-kit | 6.x / 10.x |
| Testing | Vitest + Playwright | 4.x / 1.61.x |

**No paid AI APIs. Zero.** All NLP is local via `lib/capture-router.ts`.

---

## The four spaces

The app has four primary "spaces" plus an inbox and a home dashboard:

| Space | Route | Purpose | Icon |
|---|---|---|---|
| **Home** | `/` | Dashboard: today's tasks, meetings, recent threads, stale explores |
| **Inbox** | `/inbox` | Un-routed captures. Process them into other spaces. |
| **Do** | `/do` | Tasks with implementation intentions. Board / Today / Calendar views. |
| **Think** | `/think` | Threaded thoughts that resurface. Daily notes, journals, ideas. |
| **Remember** | `/remember/people` + `/remember/locations` | Lightweight personal CRM + "where did I put it" inventory. |
| **Explore** | `/explore` | Curated reading queue. Auto-archives after 30 days. |
| **Trash** | `/trash` | Global soft-delete recovery. 30-day retention. |

---

## Design philosophy (the 4 pillars)

From the original design identity (now merged into `docs/project/DESIGN_SYSTEM.md`) — these are NON-NEGOTIABLE:

1. **Atmosphere over flatness** — Every background has ambient light from orbs, every card has surface shimmer. The app exists in an environment, never on a blank canvas.
2. **Warmth at the centre** — Amber, coral, deep orange. Cool colours appear only as secondary accents and space identifiers. The default experience is warm.
3. **Glass as the language of depth** — Cards, panels, modals, dropdowns, toasts — everything is a glass surface floating in the atmospheric background.
4. **Inter carries the voice** — All type is Inter. No font mixing except JetBrains Mono for numeric data.

---

## Theme system (current, verified)

The app uses **3 themes** with `data-theme` + `data-mode` attributes on `<html>`:

| Internal ID | Display name | Description |
|---|---|---|
| `warm` | Warm | Default. Amber/coral/deep-orange on near-black. (Formerly "Wahala"/"sunset"/"orange") |
| `navy` | Navy | Deep blue. (Formerly "blue"/"midnight") |
| `forest` | Forest | Deep green. (Formerly "forest"/"meadow") |

**Default:** `warm` theme, `dark` mode.

**Legacy name mapping** (handled by `src/lib/theme.ts`):
- `orange`, `wahala`, `sunset` → `warm`
- `blue`, `midnight`, `navy` → `navy`
- `forest`, `meadow` → `forest`

**NEVER use the old names in new code.** Use `warm`/`navy`/`forest` only.

---

## Key files (read before touching related code)

| File | What it contains | When to read it |
|---|---|---|
| `src/app/globals.css` | All CSS custom properties, theme tokens, component classes | Before touching any styling |
| `src/lib/theme.ts` | Theme normalization, `applyDocumentTheme()`, legacy mapping | Before touching theme code |
| `src/lib/rituals.ts` | Ritual timing logic (morning/evening decision) | Before touching ritual code |
| `src/lib/capture-router.ts` | All NLP and routing logic | Before touching capture code |
| `src/lib/item-lifecycle.ts` | Status standardization (archive vs delete vs trash) | Before touching delete/archive code |
| `src/lib/env.ts` | Environment variable access (NEVER throws at runtime) | Before touching env code |
| `src/lib/supabase.ts` | Browser Supabase client | Before touching client queries |
| `src/lib/supabase-server.ts` | Server Supabase client | Before touching server queries |
| `src/proxy.ts` | Next.js proxy (middleware) — CSP nonce, auth, redirects | Before touching middleware |
| `src/store/useAppStore.ts` | Zustand store (UI state, settings, modals) | Before touching global state |
| `src/components/providers/RealtimeProvider.tsx` | Shared Supabase Realtime channels | Before touching realtime |
| `src/components/layout/MotionProvider.tsx` | LazyMotion + MotionConfig wrapper | Before touching animation |

---

## Architecture decisions (locked in, do not change)

1. **App Router, not Pages Router.** All authenticated pages are in `src/app/(app)/`.
2. **`proxy.ts` replaces `middleware.ts`.** Next.js 16 renamed the convention. The file exports `proxy` not `middleware`.
3. **`env.ts` must NEVER throw at runtime.** It returns empty strings on missing vars. The app handles the failure downstream. (This was the root cause of the site going down — never repeat.)
4. **`LazyMotion strict` mode is enabled.** All motion components must use `m.*` not `motion.*`. Components outside a `MotionProvider` will silently render nothing.
5. **Dropdowns and Popovers use `createPortal`.** This prevents z-index clipping by `overflow: hidden` ancestors. See `AGENTS.md` invariant 3.
6. **`useBodyScrollLock` is ref-counted.** Multiple overlays can lock/unlock without conflict. It sets `data-overlay-open` on `<html>`, which Lenis checks to pause smooth scroll.
7. **RealtimeProvider uses shared channels.** One channel per table, ref-counted, with 5-second teardown debounce. Do not create per-component channels.
8. **`Sheet` component handles mobile modals.** Drag-to-dismiss, `useVisualViewport` for keyboard avoidance, `useDialogFocus` for focus trapping.
9. **Sidebar is hover-expand.** `w-[80px]` collapsed, `hover:w-[248px]` expanded, `focus-within:w-[248px]` for keyboard. No click-toggle, no pinning. See `AGENTS.md` invariant 4.
10. **Button system is `Button.tsx` only.** The old `.btn-*` CSS classes are deleted. All buttons use the `<Button>` component with `variant` and `size` props. See `docs/project/COMPONENT_MANIFEST.md` for the full list of approved primitives.

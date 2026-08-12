# CONTEXT — What Presense Is

> **Read this for project context.** This file describes what the app is, not how to work on it. For how to work, read `docs/agents/EXECUTION_RULES.md`. For the visual spec, read `docs/project/DESIGN_SYSTEM.md`. For the system architecture, read `docs/project/ARCHITECTURE.md`.

---

## One-line summary

Presense is a personal productivity web app for a solo user — a second brain that refuses to be another infinite canvas. It captures tasks, people, thoughts, and memories, and surfaces them back at the right moment. The positioning is deliberately personal: a student capturing an essay deadline, a professional tracking a meeting, or anyone with a busy mind emptying their head before bed. It is not a multi-tenant SaaS, not a team tool, and not a developer-only tool.

---

## Stack (verified July 9, 2026, audit-aligned)

### Core framework + runtime

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, `proxy.ts` not `middleware.ts`) | 16.2.9 |
| Language | TypeScript (strict) | 5.x |
| Runtime | React / React DOM | 19.2.4 |
| Styling | Tailwind CSS | 4.x |
| Animation | Framer Motion (`m.*` + `LazyMotion strict`) | 12.40.0 |
| Smooth scroll | Lenis | 1.3.25 |
| State (client) | Zustand | 5.0.14 |
| State (server) | TanStack Query (+ DevTools, dev-only pending) | 5.101.0 |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) | 2.108.1 |
| NLP | compromise.js + chrono-node (local, no AI APIs) | 14.15.1 / 2.9.1 |
| Validation | Zod | 4.4.3 |
| Forms | React Hook Form + `@hookform/resolvers` | 7.81.0 / 5.4.0 |
| URL state | nuqs | 2.9.0 |
| PWA | Serwist (`@serwist/next` + `serwist`) | 9.5.11 |
| Rate limiting | Upstash Redis + Ratelimit | 1.38.0 / 2.0.8 |
| Env validation | `@t3-oss/env-nextjs` (non-throwing `.catch()` config) | 0.13.11 |
| Logging | Pino + `pino-pretty` | 10.3.1 |
| Error/Perf monitoring | `@sentry/nextjs` | 10.70.0 | DSN-gated client/server/edge init; telemetry forwards; CSP `report-uri` (OBS-01, Aug 12, 2026) |
| Icons | Lucide React | 1.17.0 |
| Drag-and-drop | `@dnd-kit/{core,sortable,utilities}` | 6.x / 10.x / 3.x |
| Testing | Vitest + Playwright | 4.1.9 / 1.61.1 |

### UI primitives layer

| Concern | Library | Notes |
|---|---|---|
| Accessible button base | `@base-ui/react` | Button.tsx wraps `@base-ui/react/button` with bespoke `cva` variants |
| Portal positioning | `@floating-ui/react` | Dropdown.tsx + Popover.tsx use `FloatingPortal` + `useFloating` with `flip`/`shift` middleware |
| Toasts | sonner | `ToastProvider.tsx` wraps `<Toaster>` — see BUG-32 (must bind `theme` to app `data-mode`, not `"system"`) |
| Textarea autosize | `react-textarea-autosize` | Used by `Textarea.tsx` |
| Debounce | `use-debounce` | Used in capture preview, settings autosave |
| Class utilities | `clsx` + `tailwind-merge` + `class-variance-authority` + `tw-animate-css` | Standard shadcn-style toolkit |

### Tooling

| Concern | Tool | Notes |
|---|---|---|
| Linting | ESLint 9 + `eslint-config-next` 16.2.9 | `eslint.config.mjs` |
| Formatting | Prettier 3 + `prettier-plugin-tailwindcss` | Runs in pre-commit hook |
| Pre-commit | Husky 9 + lint-staged 16 | `.husky/pre-commit` runs eslint --fix + prettier --write + tsc --noEmit on staged files |
| Image optimization | sharp 0.35 | Used by Next.js image pipeline |
| Bundle analysis | `@next/bundle-analyzer` 16.2 | `ANALYZE=true npm run build` |
| Test environment | jsdom 29 + `@testing-library/{dom,jest-dom,react}` | Vitest config |
| TypeScript | `@types/{node,react,react-dom}` | TS 5.x strict |

**No paid AI APIs. Zero.** All NLP is local via `lib/capture-router.ts` (compromise.js + chrono-node). The `user_settings.ollama_enabled` / `ollama_url` columns exist in the schema but are **dead plumbing** — no UI consumes them and no code path routes to Ollama. See `docs/project/DOCS_NEEDS_CODE.md` for the "ship or remove" decision.

---

## Verified file counts (audit July 9, 2026)

| What | Count | Notes |
|---|---|---|
| Total files in repo | 225 | excluding node_modules / .git / .next / package-lock.json |
| Source directories | 44 | organized into 5 top-level groups |
| Routes in `src/app` | 21 | 11 in `(app)`, 1 in `(auth)/login`, 1 onboarding, 1 offline, 1 not-found, 1 global-error, 4 API routes, 1 auth callback |
| Components total | 52 | 11 features (incl. 4 calendar), 12 layout, 22 UI primitives (audit count; ZIP has 28 files in `ui/`), 1 provider |
| Lib modules | 15 | 1082 lines total; `capture-router.ts` largest at 313 lines |
| Hooks | 10 | 303 lines total; `useRealtime.ts` largest at 137 lines; `useUnsavedGuard.ts` added BUG-42 (Aug 10, 2026) |
| Store | 1 | `useAppStore.ts` (116 lines) |
| Type files | 2 | `database.types.ts` (733 lines, generated), `calendar.ts` (14 lines) |
| Supabase migrations | 25 | dual naming: `001_`–`009_` then timestamped `20260628…` |
| Edge functions | 2 | `cron_cleanup` (30-day hard-delete), `cron_recurrence` (recurring task generation) |
| Test files | 16 | 2742 lines total; `phase4.test.tsx` largest at 1021 lines; 181 tests pass (Aug 12, 2026) |
| Playwright specs | 2 | `sanity.spec.ts` (9 lines), `realtime.spec.ts` (92 lines) |
| GitHub workflows | 3 | ci, osv-scanner, semgrep (eslint.yml, trivy.yml, sonarcloud.yml, sonarqube.yml deleted — CI-01..CI-03, Aug 12, 2026) |
| Coverage thresholds | 50% lines / 50% functions / 40% branches | low — flagged in audit |

---

## Complete route inventory (21 routes, verified)

```
src/app/
├── layout.tsx                          # Root layout (theme init script, fonts)
├── global-error.tsx                    # Root error boundary
├── not-found.tsx                       # 404
├── icon.tsx                            # Favicon
├── sw.ts                               # Serwist service worker
├── globals.css                         # All CSS custom properties, theme tokens, component classes
├── (app)/                              # Authenticated spaces
│   ├── layout.tsx                      # Auth + onboarding-complete gate
│   ├── template.tsx                    # (MISSING — BUG-23, page-to-page is hard cut)
│   ├── error.tsx                       # App-level error boundary
│   ├── loading.tsx                     # App-level loading skeleton
│   ├── page.tsx                        # Home dashboard (40 KB, largest page)
│   ├── do/                             # Tasks — Board / Today / Calendar
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   └── page.tsx
│   ├── think/                          # Threaded thoughts
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── page.tsx
│   │   └── [id]/page.tsx               # Thread detail (no custom error/loading — ROOT PATTERN 7)
│   ├── remember/
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── people/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx           # Person detail (no custom error/loading — ROOT PATTERN 7)
│   │   └── locations/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   ├── explore/                        # Reading queue
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx               # Explore detail (no custom error/loading — ROOT PATTERN 7)
│   │   └── trash/page.tsx
│   ├── inbox/page.tsx                  # Un-routed captures (no custom error/loading — ROOT PATTERN 7)
│   └── trash/page.tsx                  # Global soft-delete recovery (no custom error/loading — ROOT PATTERN 7)
├── (auth)/
│   ├── layout.tsx
│   └── login/
│       ├── layout.tsx
│       └── page.tsx
├── onboarding/
│   ├── layout.tsx
│   ├── page.tsx
│   └── OnboardingWizard.tsx            # 416 lines, 5 steps (all mutations error-checked — BUG-38, Aug 10, 2026)
├── auth/callback/route.ts              # OAuth code exchange → /onboarding or /login?error
├── api/
│   ├── account/route.ts                # Server-only, uses SUPABASE_SERVICE_ROLE_KEY for auth.admin.deleteUser
│   ├── capture/route.ts                # NLP routing server endpoint (rate-limited)
│   ├── people/reorder/route.ts         # DnD reorder
│   └── telemetry/route.ts              # Error tracking endpoint — forwards client-error/web-vital to Sentry (OBS-01, Aug 12, 2026)
└── ~offline/page.tsx                   # PWA offline fallback (tilde prefix is Next 16 convention)
```

---

## The four spaces

The app has four primary "spaces" plus an inbox, a home dashboard, and a global trash:

| Space | Route | Purpose | Icon |
|---|---|---|---|
| **Home** | `/` | Dashboard: today's tasks, meetings, recent threads, stale explores |
| **Inbox** | `/inbox` | Un-routed captures. Process them into other spaces. |
| **Do** | `/do` | Tasks with implementation intentions. Board / Today / Calendar views. |
| **Think** | `/think` | Threaded thoughts that resurface. Daily notes, journals, ideas. |
| **Remember** | `/remember/people` + `/remember/locations` | Lightweight personal CRM + "where did I put it" inventory. |
| **Explore** | `/explore` | Curated reading queue. Auto-archives after 30 days. |
| **Trash** | `/trash` | Global soft-delete recovery. 30-day retention enforced by `cron_cleanup` edge function. |

---

## Design philosophy (the 4 pillars)

From the original design identity (now merged into `docs/project/DESIGN_SYSTEM.md`) — these are NON-NEGOTIABLE:

1. **Atmosphere over flatness** — Every background has ambient light from orbs, every card has surface shimmer. The app exists in an environment, never on a blank canvas.
2. **Warmth at the centre** — Amber, coral, deep orange. Cool tones (navy, forest) are alternate **full themes** a user opts into, not accents layered onto the warm theme. Per-space colors (`--space-do`/`-think`/`-remember`/`-explore`) are derived in OKLCH from each theme's own `--accent` hue, so all four spaces stay within that theme's color family — see `DESIGN_SYSTEM.md` §1.5 (DS-28).
3. **Glass as the language of depth** — Cards, panels, modals, dropdowns, toasts — everything is a glass surface floating in the atmospheric background. But glass is a tool for hierarchy, not decoration on every element (see DESIGN_SYSTEM §3.4 for where glass is NOT allowed).
4. **Inter carries the voice** — All type is Inter. JetBrains Mono only for numeric data / timestamps. **Note (audit July 9, 2026):** `layout.tsx:47` also loads `Geist` and sets it to `--font-sans`, conflicting with Inter. `globals.css:17` `--font-sans: var(--font-sans)` is self-referential and broken. See `docs/project/DOCS_NEEDS_CODE.md` — Geist import should be removed.

---

## Theme system (current, verified)

The app uses **3 themes** with `data-theme` + `data-mode` attributes on `<html>`:

| Internal ID | Display name | Description |
|---|---|---|
| `warm` | Warm | Default. Amber/coral/deep-orange on near-black (`--bg-base: #0F0A00`, `--accent: #E5B41E`). |
| `navy` | Navy | Deep blue (`--bg-base: #04091A`, `--accent: #7692FF`). |
| `forest` | Forest | Deep green (`--bg-base: #080D06`, `--accent: #EFDD8D`). |

**Default:** `warm` theme, `dark` mode.

### Theme × mode readability matrix (audit-verified, 6 combos)

| Theme | Dark mode | Light mode |
|---|---|---|
| Warm | ✓ High contrast (white on near-black) | ✓ Correct — dark warm brown `#1A0E00` text on cream `#FBF6EE` (`globals.css:374-381`). The July 9 audit's "BROKEN" claim was stale (text overrides have existed since `e6fd96b4`, July 5); verified live Aug 10, 2026 — see `EXECUTION_SPEC.md` §24.1 root pattern 2. |
| Navy | ✓ High contrast (white on deep blue-black) | ✓ Correct (dark navy text `#040930` on pale blue `#EEF3FF`) |
| Forest | ✓ High contrast (white on deep forest) | ✓ Correct (dark green text `#0D1A08` on pale green `#F5F9F0`) |

All three themes override text colors in light mode correctly (warm since July 5, `e6fd96b4`). The audit's warm-light finding was a stale-state artifact — verified correct in live rendering Aug 10, 2026. See `docs/project/DOCS_NEEDS_CODE.md`.

### Theme name history (3 generations, all in `LEGACY_THEME_MAP`)

`src/lib/theme.ts`'s `LEGACY_THEME_MAP` normalizes all three generations of legacy names:

| Generation | Names | Status |
|---|---|---|
| 1 (original) | `wahala` / `orange` / `blue` / `forest` | Legacy — mapped to current |
| 2 (intermediate, post-BUG-07) | `sunset` / `midnight` / `meadow` | Legacy — mapped to current |
| 3 (current, post-`20260704000000_update_theme_names_to_warm.sql`) | `warm` / `navy` / `forest` | **Current — DO NOT rename again** |

`forest` is the only name that survived all three generations unchanged. The two rename migrations (`20260703000004_rename_theme_values.sql` and `20260703000005_default_legacy_blue_to_sunset.sql`) contradict each other on whether `midnight` is a first-class theme (CONF-07) — this is now moot for current operations since themes are `warm`/`navy`/`forest`, but the historical contradiction remains in the migration chain.

**NEVER use the old names in new code.** Use `warm`/`navy`/`forest` only. Per AGENTS.md invariant 2: "This is the third name this set of themes has had. It does not get a fourth without an explicit, recorded decision."

---

## Key files (read before touching related code)

| File | What it contains | When to read it |
|---|---|---|
| `src/app/globals.css` | All CSS custom properties, theme tokens (6 theme×mode blocks), component classes, `@theme inline` Tailwind mapping | Before touching any styling |
| `src/lib/theme.ts` | Theme normalization (`normalizeThemeId`, `normalizeColorMode`, `applyDocumentTheme`), `LEGACY_THEME_MAP` for 3 generations of names | Before touching theme code |
| `src/lib/rituals.ts` | Ritual timing logic (morning/evening decision) — pure functions, T0-1 applied | Before touching ritual code |
| `src/lib/capture-router.ts` | All NLP and routing logic (313 lines, largest lib module) — compromise.js + chrono-node | Before touching capture code |
| `src/lib/item-lifecycle.ts` | Status standardization (`moveItemToTrashPatch`, `restoreItemPatch`, `archiveItemPatch`) — single source for soft-delete | Before touching delete/archive code |
| `src/lib/env.ts` | Environment variable access via `@t3-oss/env-nextjs` with `.catch(() => logAndReturnEmpty(...))` — NEVER throws | Before touching env code |
| `src/lib/supabase.ts` | Browser Supabase client | Before touching client queries |
| `src/lib/supabase-server.ts` | Server Supabase client | Before touching server queries |
| `src/lib/logger.ts` | Pino logger (27-line stub — no transport configured; browser logs stay in console, server logs to stdout; Sentry covers error context since OBS-01, Aug 12, 2026 — log-drain remains TOOL-05) | Before touching logging |
| `src/lib/rate-limit.ts` | Upstash Redis rate limiting — silently returns `null` in production if env vars absent (TOOL-08) | Before touching rate limiting |
| `src/proxy.ts` | Next.js 16 proxy (middleware) — CSP nonce, auth, cookie forwarding via `cookiesToSet` array | Before touching middleware |
| `src/instrumentation-client.ts` | Client Sentry init (Next 16 client instrumentation, auto-loaded) — browser SDK auto-captures `window error`/`unhandledrejection`; exports `onRouterTransitionStart` (OBS-01, Aug 12, 2026) | Before touching error tracking |
| `src/store/useAppStore.ts` | Zustand store (UI state, settings, modals) | Before touching global state |
| `src/components/providers/RealtimeProvider.tsx` | Shared Supabase Realtime channels — ref-counted, 5-second teardown debounce | Before touching realtime |
| `src/components/layout/MotionProvider.tsx` | LazyMotion + MotionConfig wrapper (`features={domMax} strict`) | Before touching animation |
| `src/components/ui/Sheet.tsx` | Mobile modal surface — drag-to-dismiss, `useVisualViewport` (BUG-36/39: drag swallows nested taps) | Before touching sheets |
| `src/types/database.types.ts` | Generated Supabase types (733 lines) — `prebuild` regenerates + fails on drift | Before touching DB queries |

---

## Architecture decisions (locked in, do not change)

1. **App Router, not Pages Router.** All authenticated pages are in `src/app/(app)/`.
2. **`proxy.ts` replaces `middleware.ts`.** Next.js 16 renamed the convention. The file exports `proxy` not `middleware`. CSP nonce propagates via `cookiesToSet` array.
3. **`env.ts` must NEVER throw at runtime.** It uses `@t3-oss/env-nextjs` with `.catch(() => logAndReturnEmpty(...))` — validation failures are caught and reported, never thrown. (This was the root cause of the site going down — never repeat. Do NOT remove the `.catch()` wrapper. Do NOT configure `@t3-oss/env-nextjs` in its default throwing mode.)
4. **`LazyMotion strict` mode is enabled.** All motion components must use `m.*` not `motion.*`. Components outside a `MotionProvider` will silently render nothing.
5. **Dropdowns and Popovers use portal rendering.** Currently Floating UI's `FloatingPortal` + `useFloating` with `flip`/`shift` middleware. This prevents z-index clipping by `overflow: hidden` ancestors (BUG-03, BUG-27 — has regressed once and been re-fixed; do not replace portal with z-index bump).
6. **`useBodyScrollLock` is ref-counted.** Multiple overlays can lock/unlock without conflict. It sets `data-overlay-open` on `<html>`, which Lenis checks to pause smooth scroll.
7. **RealtimeProvider uses shared channels.** One channel per table, ref-counted, with 5-second teardown debounce. Do not create per-component channels. Tracks 3 states: `connected`, `reconnecting`, `disconnected` (surfaced via `ConnectionStatus` UI component).
8. **`Sheet` component handles mobile modals.** Drag-to-dismiss, `useVisualViewport` for keyboard avoidance, `useDialogFocus` for focus trapping. **Known bug (BUG-36/39):** `Sheet.tsx:58` `drag="y"` on whole surface swallows taps on nested buttons across 7 consumers (ConfirmModal, AddPersonPanel, SearchModal, TaskAddPanel, CaptureModal, ExploreDrawer, LocationAddPanel). Fix: dedicated drag handle + `dragListener={false}`. See `docs/project/DOCS_NEEDS_CODE.md`.
9. **Sidebar is hover-expand.** `w-[80px]` collapsed, `hover:w-[248px]` expanded, `focus-within:w-[248px]` for keyboard. No click-toggle, no pinning. See `AGENTS.md` invariant 4. (CONF-05 retroactively resolved: pure hover, no pin.)
10. **Button system is `Button.tsx` only.** The old `.btn-*` CSS classes are deleted. All buttons use the `<Button>` component with `variant` and `size` props. See `docs/project/COMPONENT_MANIFEST.md` for the full list of approved primitives.
11. **Every Supabase mutation must check `error`.** Supabase-js resolves normally with `{data: null, error: {...}}` on DB errors — `try/catch` does NOT catch this. **✅ CLOSED Aug 10, 2026 (BUG-38)** — all 27 mutation-bearing files audited; the final 10 unchecked sites were migrated to `safeMutate()` (commit `660f5a3`); zero error-unchecked mutation sites remain (one intentional exception: `think/page.tsx` daily-note insert is a conflict-fallback pair that never claims success). New code MUST still check `error` — do not regress.

---

## Known critical gaps (audit-verified, do not regress)

These are the highest-impact findings from the July 9, 2026 audit. Each is tracked in `docs/plans/EXECUTION_SPEC.md` with a ticket ID and in `docs/project/DOCS_NEEDS_CODE.md` with a code-fix plan.

### ROOT PATTERN 1 — Silent Data Loss (Critical, trust-breaking) — ✅ CLOSED Aug 10, 2026

**37 of 71 Supabase mutations (52%) didn't check the returned `error`** at audit time. Worst offenders were `OnboardingWizard.tsx` (11 unchecked — first-run could silently fail at any step), `think/[id]/page.tsx`, `explore/[id]/page.tsx`, `remember/people/[id]/page.tsx`. (`inbox/page.tsx` was the canonical case — BUG-34 — fully fixed Aug 10, 2026; the live root cause was migration 005 never applied to production, so `items_status_check` rejected `'deleted'`.) **CLOSED Aug 10, 2026:** BUG-38 full pass (commit `660f5a3`) — all 27 mutation-bearing files audited line-by-line; the last 10 unchecked sites (`TaskAddPanel` addCategory, `CalendarView` undo, `RitualOverlay` ×7, `(app)/layout` server upsert) migrated to `safeMutate()`/server-side error checks; repo-wide sweep confirms zero violations. New code MUST still check `error`.

### ROOT PATTERN 2 — Warm-Light Theme (RESOLVED — stale audit finding)

The audit claimed `globals.css:336-420` overrode `--bg-base` to cream without overriding text colors (white on cream). **Not true in the current build:** the warm-light block has had dark-warm text overrides (`--text-1: #1A0E00`, etc., `globals.css:374-381`) since `e6fd96b4` (July 5, 2026, predates the audit). Verified live Aug 10, 2026: computed styles on `/`, `/do`, `/inbox`, `/think` all render dark text on cream in warm-light. Closed as a false positive — see `EXECUTION_SPEC.md` §24.1.

### ROOT PATTERN 3 — Mobile Viewport + Form Bugs (High) — ✅ CLOSED Aug 10, 2026

- **~~7 `h-screen` instances~~** cause layout jumps on mobile Safari/Chrome when URL bar shows/hides. **Fixed** in commit `8c249b6` (July 7, 2026) — all 6 audit-listed files (`OnboardingBackground.tsx`, `Navigation.tsx`, `not-found.tsx`, `OnboardingWizard.tsx`, `~offline/page.tsx`, `(auth)/login/page.tsx`) use `h-dvh`/`min-h-dvh`; `rg 'h-screen|100vh' src` = 0 hits (verified Aug 10, 2026).
- **~~BUG-36/39:~~** `Sheet.tsx:58` whole-surface `drag="y"` swallows taps. **Fixed** in `ad79e81` — dedicated drag handle + `dragListener={false}` (Sheet.tsx:59-61).
- **~~BUG-41:~~** `Input.tsx` 13px iOS auto-zoom. **Fixed** — `globals.css:1366-1375` forces 16px floor on mobile.

### ROOT PATTERN 4 — Design System Fragmentation (High, polish erosion)

- **99 hardcoded hex values** in `.tsx` files break theme switching. Top offenders: SettingsModal (19), OnboardingBackground (12), remember/people/[id] (10), think/[id] (9), AddPersonPanel (7), CaptureModal (5), PomodoroTimer (3), CalendarTaskChip (3).
- **6 different hover magnitudes** — TaskCard `whileHover={{y:-2}}` (correct), People/Think/Explore `hover:scale-[1.01]` (causes cut-border due to `overflow-hidden` in GlassCard — DS-30), People list `hover:scale-[1.005]`, Button `hover:-translate-y-[1px]`, RitualOverlay `hover:scale-110`, SettingsModal `hover:scale-125`. Standardize on `translateY` lift only.
- **3 different dashed-border tokens**, **9 distinct icon sizes** (no shared scale), **7 distinct strokeWidth values** (DS-12 says all should be 1.5; 55 correct, 11 deviate), **44 raw `<input>` elements** (not using `Input.tsx`), **6 native `type="time"`** + **1 native `<select>`** + **1 native `<datalist>`** (BUG-43/25/33).

### ROOT PATTERN 5 — Settings + Schema Bloat (Medium, calm-identity erosion)

- **9 unused notification booleans** in `user_settings` (`notifications_enabled`, `notif_72h`, `notif_24h`, `notif_6h`, `notif_1h`, `notif_overdue`, `notif_briefing`, `notif_stale_threads`) — but **0 push notification system exists**. `push_subscriptions` table exists but unused.
- **4 redundant time fields** (Quiet Start/End + Morning Nudge + Evening Shutdown) — CONF-14 resolved to collapse to 2 (morning + evening ritual time only), NOT YET implemented.
- **`Density` field** marked for removal (INFRA-20), still present.
- **`ritual_streak` column** actively written by `RitualOverlay.tsx:524,544,555,670,690,701` despite CONF-17 resolving against gamification — **active contradiction**.
- **4 dead tables** (0 src usages): `push_subscriptions`, `session_logs`, `ritual_logs`, `categories`. **2 dead columns**: `confidence_threshold`, `pomodoros_completed`. **Dead plumbing**: `ollama_enabled`/`ollama_url`.

### ROOT PATTERN 6 — Missing Industry-Standard Flows (Strategic)

No calendar integration, no native mobile/desktop apps, no AI features (despite `ollama_*` plumbing), no semantic search, no command palette (Cmd+K opens CaptureModal, not a command palette — DS-08 not started), no weekly review (FEAT-01 not started), no recurring task UI (despite `recurrence` column + `cron_recurrence` edge function), no snooze UI (despite `snoozed_until` column), no linked-people UI from TaskAddPanel (despite `linked_people_ids` column), no bulk actions, no drag-between-spaces, no password reset UI, no magic link resend UI.

### ROOT PATTERN 7 — Incomplete Error Boundaries + Loading States (Medium) — partially fixed

- ~~5 routes missing custom `error.tsx`~~ — **Fixed**: `error.tsx` exists at `(app)`, `do`, `explore`, `remember`, `think` (verified Aug 10, 2026); `inbox`, `trash`, `[id]` routes inherit from their segment.
- ~~5 routes missing custom `loading.tsx`~~ — **Fixed**: same 5 segments (verified Aug 10, 2026).
- `ModalErrorBoundary` used in 3 modals (CaptureModal, SearchModal, SettingsModal) — **still missing** from AddPersonPanel, LocationAddPanel, ExploreDrawer, TaskAddPanel, PomodoroTimer.
- 0 `aria-live` regions (realtime changes invisible to screen readers).
- ~~0 `beforeunload`/`isDirty` guards (BUG-42 — accidental close loses form data)~~ — **Fixed Aug 10, 2026** (commit `3e555a0`): `useUnsavedGuard` hook + guards in all 4 Sheet-based forms (TaskAddPanel, AddPersonPanel, LocationAddPanel, ExploreDrawer). Note: RHF's destructured `isDirty` is non-reactive for unwatched fields and `setValue` never marks dirty without `shouldDirty: true` — panels use baseline-snapshot comparison instead. See `EXECUTION_SPEC.md` BUG-42.
- ~~0 skip-to-content link (A11Y-03)~~ — **Fixed** (`(app)/layout.tsx`).
- ~~`/api/telemetry` endpoint only does `console.warn` — black hole in production (TOOL-06 / Sentry not installed).~~ **FIXED Aug 12, 2026 (OBS-01, commit `83a95e1`)** — forwards `client-error`/`web-vital` to Sentry (`captureMessage`); API-route catch blocks `captureException`; CSP `report-uri` derived from the DSN in `proxy.ts`.

### ROOT PATTERN 8 — CI/CD Has Minimum Viable Gates (Medium)

CI runs lint + typecheck + test + build (4 steps) + 7 security scans (osv-scanner, semgrep, sonarcloud, sonarqube, trivy, eslint, ci). Pre-commit hook via Husky + lint-staged. **Missing:** visual regression tests, axe-core a11y scan, Lighthouse CI with thresholds, bundle-size budget, error tracking in production, E2E user-flow tests (only 2 minimal Playwright specs), RLS automated test suite. **Commit hygiene issue:** 10 of 11 commits have GUID messages, violating `EXECUTION_RULES.md` commit format (`fix: T0-X short description`). Branch protection not verifiable from zip — must confirm on GitHub UI.

---

## Onboarding & empty-state posture (audit-verified)

### Onboarding (5-step wizard, 416 lines)

`src/app/onboarding/OnboardingWizard.tsx` — 5 steps: name → struggles → day shape → first capture → tour.

- **All 10 mutation sites error-checked** (BUG-38, Aug 10, 2026 — the audit's "11 unchecked at lines 79, 102, 128, 157, 167, 169, 176, 183, 189, 213" count was stale; the migration had already landed during BUG-34-era work). A brand-new user's first experience can no longer silently fail.
- **0 skip logic** on steps 1-4 (only step 5 has "Skip tour").
- **0 resume logic** — closed browser = restart from step 1. `(app)/layout.tsx:30-46` auto-completes onboarding if items exist (partial workaround, not real resume).
- **0 progress indicator** (no 5-dots-at-top showing current step).
- **0 keyboard navigation** (Enter to advance, Backspace to go back — mouse-only).
- Step transitions use Framer Motion `initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}` per step (good baseline). Step 5 has `scale:0.95` (celebratory feel).

Fix plan: add skip + resume + error-checking + progress indicator + keyboard nav. See `docs/project/DOCS_NEEDS_CODE.md`.

### Empty states

- **5 spaces use `EmptyState` component**: Do (3 instances), Inbox (1, "Inbox Zero" celebratory tone), Home (multiple), People (1), Trash (1, via different pattern).
- **3 spaces hand-roll** their own empty states (don't use `EmptyState`): Think (`think/page.tsx:279` — bare `<h3>No threads yet</h3>`), Explore (`explore/page.tsx:272` — bare `<h3>Nothing saved yet</h3>`), Locations (~~hand-rolled~~ — **fixed Aug 10, 2026**: uses `EmptyState` at `locations/page.tsx:123`, BUG-40).
- **0 first-time-user variant** — all empty states are the same regardless of whether it's a brand-new user or an existing user who filtered to empty.
- ~~Think + Explore empty-state buttons open wrong target (BUG-35/37)~~ — **fixed Aug 10, 2026** (verified): both call `handleNewThread`, not `setCaptureModalOpen`.
- **1 filtered empty state**: SearchModal "No results" (hand-rolled, not using `EmptyState`).

Fix plan (remaining): migrate Think/Explore to `EmptyState` (still hand-rolled), add first-time-user variant. See `docs/project/DOCS_NEEDS_CODE.md`.

---

## Motion safety for mobile (audit-verified)

### `prefers-reduced-motion: reduce` — ✅ DONE Aug 10, 2026 (DS-14)

`globals.css:1131-1146` now removes hover-transform distance entirely (`transform: none !important` for `hover:scale*`, `hover:-translate*`, `active:scale*`, `.glass-card:hover`, etc.), plus 0.01ms duration fallbacks at `:775`/`:1120`. The audit's "delivers instant movement" claim is stale — verified in code Aug 10, 2026. Remaining DS-14 gap: `prefers-reduced-transparency` (0 occurrences) still unimplemented.

### `prefers-reduced-transparency: reduce` — 0 occurrences in codebase

Should swap all `--elev-*-blur` to `blur(0px)` and raise surfaces to opaque colors. Not handled anywhere.

### Hover must be gated behind `@media (hover: hover) and (pointer: fine)`

Touch devices get no hover state, only active/pressed. Do not inherit half-working hover states on touch.

### Cards always `translateY` lift, never `scale` (DS-30)

`hover:scale-[1.01]` grows the rendered box past its layout box, which clips visibly inside any `overflow-hidden`/`overflow-x-auto` ancestor (a horizontally-scrollable Kanban column, for instance). `translateY` lift repositions without growing the box. Every hoverable card/row must use the same lift distance, duration, and easing.

### `backdrop-filter` budget (PERF-04)

23 `backdrop-filter` declarations in `globals.css`, 0 `contain: paint`. No more than 2 stacked/nested `backdrop-filter` regions on screen at once. Each is a GPU layer; compounds on mobile. `--elev-overlay-blur` (24px, heaviest) only for the single topmost surface in focus (open modal/sheet). `--elev-floating-blur` (dropdowns, toasts) and `--elev-raised-blur` (cards) are the two "at once" the budget allows.

### Duplicate `useReducedMotion`

Defined in both `src/hooks/useReducedMotion.ts` AND `src/lib/animations.ts:21`. Pick one. See `docs/project/DOCS_NEEDS_CODE.md`.

### `template.tsx` for page transitions (BUG-23) — ✅ DONE Aug 10, 2026

`src/app/(app)/template.tsx` exists (verified Aug 10, 2026 — the audit's "does not exist" claim was stale). Verify the actual transition matches the spec (one shared opacity-only fade, `--dur-base`, no y-axis movement) when next touching it.

---

## Libs / fonts inventory (audit-verified)

### Fonts (3 Google Fonts loaded)

| Font | CSS variable | Used for | Status |
|---|---|---|---|
| Inter | `--font-inter` | Body text (all UI) | ✓ Primary |
| JetBrains Mono | `--font-mono` | Numbers, timestamps, tabular data | ✓ Used in SearchModal, PomodoroTimer, Kbd, AppErrorFallback |
| Geist | `--font-sans` | (Conflicts with Inter) | **✗ Conflicts** — `layout.tsx:47` sets Geist to `--font-sans`, `layout.tsx:8` sets Inter to `--font-inter`, `globals.css:17` `--font-sans: var(--font-sans)` is self-referential/broken. Whichever loads last wins. Remove Geist import. |

### Icons (Lucide React, 38 files import it)

- **9 distinct icon sizes** used: 12, 13, 14, 16, 17, 18, 20, 22, 24, 28 — no shared size scale. Should be 4 sizes (e.g., 14/16/20/24).
- **7 distinct strokeWidth values**: 0, 1.5, 1.7, 1.8, 2, 2.5, 3, 6. DS-12 says all should be 1.5; 55 instances correct, 11 deviate. `Navigation.tsx:103` uses 1.7, `:346` uses 2, `PomodoroTimer.tsx:356,362` use 6 (SVG ring stroke).
- `src/components/ui/Icon.tsx` wrapper standardizes `strokeWidth` to 1.5 default, 2.0 for `variant="solid"` — correct pattern, but not all consumers use the wrapper.

---

## Dead code / unused (audit-verified)

### Dead tables (0 src usages)

| Table | Status |
|---|---|
| `push_subscriptions` | 0 usages — no push notification system exists |
| `session_logs` | 0 usages |
| `ritual_logs` | 0 usages |
| `categories` | 0 usages (Do uses `user_settings.do_categories` array instead) |

### Dead columns

| Column | Status |
|---|---|
| `confidence_threshold` | 0 usages |
| `pomodoros_completed` | Only in generated types, never read/written (replaced by `time_spent_minutes` per `007_time_spent.sql`) |
| `--text-4` CSS token | 0 usages (was problematic per DS-06) |
| `--text-decorative` CSS token | 0 usages |

### Columns contradicting design direction

| Column | Contradiction |
|---|---|
| `ritual_streak` | Actively written by `RitualOverlay.tsx:524,544,555,670,690,701` despite CONF-17 resolving against gamification. **Active contradiction** — app silently tracks a streak the design says shouldn't exist. |
| `ollama_enabled` / `ollama_url` | Schema + store + types defined but no UI consumes them. Dead plumbing. Decide: ship Ollama integration or remove. |

### Dead scripts (4 unreferenced in package.json or CI)

| Script | Issue |
|---|---|
| `scripts/read_data.py` | Hardcoded Windows path `C:\Users\muhdz\.gemini\antigravity\brain\...` — not portable, leaks dev username, not referenced |
| `scripts/refactor.js` | One-off refactor script, not referenced |
| `scripts/refactor.ps1` | PowerShell, not cross-platform, not referenced |
| `scripts/run_migrations.ps1` | PowerShell, not cross-platform, not referenced |

(2 scripts ARE referenced: `clean-threads.js` via `npm run script:clean`, `check_snooze.js` via `npm run script:snooze`.)

### Duplicate files

| Duplicate | Status |
|---|---|
| Root `ARCHITECTURE.md` | Byte-for-byte duplicate of `docs/project/ARCHITECTURE.md`. **Must be removed** per AGENTS.md §2 + EXECUTION_SPEC §15.3 MD-01. |
| `useReducedMotion` | Defined in both `src/hooks/useReducedMotion.ts` AND `src/lib/animations.ts:21`. Pick one. |

---

## Folder structure (verified, full tree)

```
Presense-main/
├── .github/workflows/          # 3 CI workflows (ci, osv-scanner, semgrep) — all .yml, no .md
├── .husky/pre-commit           # Husky pre-commit hook
├── docs/
│   ├── agents/EXECUTION_RULES.md
│   ├── audits/2026-08-08-EXTERNAL-AUDIT.md   # External review — triaged into EXECUTION_SPEC §29 (Aug 10, 2026)
│   ├── plans/EXECUTION_SPEC.md  # 2001 lines, 29 sections, only active backlog
│   └── project/{ARCHITECTURE, COMPONENT_MANIFEST, CONTEXT, DESIGN_SYSTEM, DOCS_NEEDS_CODE}.md
├── public/                      # icons (icon.svg, icon-192.png, icon-512.png), manifest.json, vercel/next/file/globe/window.svg
├── scripts/                     # 6 ad-hoc scripts (2 referenced, 4 dead — see "Dead code" above)
├── src/
│   ├── app/                     # Next 16 app router — 21 routes (see "Complete route inventory" above)
│   ├── components/
│   │   ├── features/            # 11 domain components (CaptureModal, TaskCard, TaskAddPanel, PomodoroTimer, RitualOverlay, SettingsModal, SearchModal, AddPersonPanel, LocationAddPanel, ExploreDrawer, + calendar/)
│   │   │   └── calendar/        # 4 calendar components (CalendarView, WeekView, MonthView, CalendarTaskChip)
│   │   ├── layout/              # 12 layout components (Navigation, MobileTopBar, MobileDrawer, AmbientBackground, OnboardingBackground, LenisProvider, MotionProvider, QueryProvider, AppContentWrapper, AppInitializer, DynamicModals, WebVitalsReporter)
│   │   ├── providers/           # 1 provider (RealtimeProvider + test)
│   │   └── ui/                  # 28 UI primitives (see COMPONENT_MANIFEST.md)
│   ├── hooks/                   # 10 hooks (useUnsavedGuard added Aug 10, 2026 — BUG-42)
│   ├── lib/                     # 15 lib modules + __tests__/ (13 test files)
│   ├── store/useAppStore.ts     # Zustand store
│   ├── types/                   # database.types.ts (generated), calendar.ts
│   ├── instrumentation-client.ts # Client Sentry init (Next 16 client instrumentation — OBS-01, Aug 12, 2026)
│   ├── sentry.server.config.ts   # DSN-gated Sentry init (Node runtime)
│   ├── sentry.edge.config.ts     # DSN-gated Sentry init (edge runtime)
│   └── proxy.ts                 # Next 16 middleware (proxy, not middleware)
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── cron_cleanup/        # 30-day hard-delete cron
│   │   └── cron_recurrence/     # Recurring task generation cron
│   └── migrations/              # 25 SQL migrations (dual naming: 001_-009_ then timestamped)
├── tests/                       # 2 Playwright specs (sanity, realtime)
├── AGENTS.md                    # Single entry point for coding agents
├── GEMINI.md                    # One-line pointer to AGENTS.md (Antigravity resolution)
├── README.md                    # Public-facing readme
├── package.json, package-lock.json
├── components.json, tsconfig.json, next.config.ts, vitest.config.ts, playwright.config.ts
├── eslint.config.mjs, postcss.config.mjs
└── .env.example
```

**Note on migration naming:** First 9 use `001_`–`009_` style, then switches to timestamped `20260628121249_ritual_tracking.sql`. Two naming conventions coexisting — not a bug, but inconsistent.

**Note on `scripts/`:** 6 ad-hoc files, mixed Node + Python + PowerShell, no README, no clear purpose documentation for the 4 unreferenced ones.

**Note on `src/app/~offline/page.tsx`:** tilde prefix is Next 16 convention but unusual, looks like a typo — it is not.

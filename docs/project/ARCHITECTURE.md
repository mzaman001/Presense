# Architecture

## Overview

Presense is a personal productivity "second brain" built with Next.js 16, Supabase, and a bespoke glassmorphic UI. It is a single-user app (not multi-tenant SaaS, not a team tool) that captures tasks, people, thoughts, and memories across four opinionated spaces (Do, Think, Remember, Explore) plus an Inbox, Home dashboard, and global Trash. The app is installable as a PWA, works offline, and uses local NLP (compromise.js + chrono-node) for zero-cloud-cost capture routing. For the full product context, see `docs/project/CONTEXT.md`. For the visual spec, see `docs/project/DESIGN_SYSTEM.md`.

## Tech Stack (verified July 9, 2026)

### Core framework + runtime

| Layer | Technology | Version | Notes |
|:---|:---|:---|:---|
| **Framework** | Next.js (App Router, `proxy.ts` not `middleware.ts`) | 16.2.9 | Server Components, Turbopack, App Router |
| **Language** | TypeScript | 5.x (strict) | `tsconfig.json` strict mode |
| **Runtime** | React / React DOM | 19.2.4 | |
| **Styling** | Tailwind CSS | 4.x | `@theme inline` mapping, `tw-animate-css` |
| **Animation** | Framer Motion | 12.40.0 | `m.*` + `LazyMotion features={domMax} strict` |
| **Smooth scrolling** | Lenis | 1.3.25 | App-wide via `LenisProvider.tsx` |
| **State (client)** | Zustand | 5.0.14 | `useAppStore.ts` (116 lines) |
| **State (server)** | TanStack Query | 5.101.0 | `refetchOnWindowFocus: false` (PERF-07 fixed) |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) | 2.108.1 | 11 tables, 25 migrations, 2 edge functions |
| **NLP** | compromise.js + chrono-node | 14.15.1 / 2.9.1 | Local, zero API costs, in `lib/capture-router.ts` |
| **Validation** | Zod | 4.4.3 | |
| **Forms** | React Hook Form + `@hookform/resolvers` | 7.81.0 / 5.4.0 | |
| **URL state** | nuqs | 2.9.0 | Shareable/bookmarkable view/filter state |
| **PWA** | Serwist (`@serwist/next` + `serwist`) | 9.5.11 | `src/app/sw.ts`, `~offline/page.tsx` fallback |
| **Rate limiting** | Upstash Redis + Ratelimit | 1.38.0 / 2.0.8 | `/api/capture` endpoint |
| **Env validation** | `@t3-oss/env-nextjs` | 0.13.11 | Non-throwing `.catch()` config — invariant #1 |
| **Logging** | Pino + `pino-pretty` | 10.3.1 | `logger.ts` (27-line stub, no transport configured) |
| **Icons** | Lucide React | 1.17.0 | 38 files import it |
| **Drag-and-drop** | `@dnd-kit/{core,sortable,utilities}` | 6.x / 10.x / 3.x | Do Board, People reorder |
| **Testing** | Vitest + Playwright | 4.1.9 / 1.61.1 | 144 tests pass; 2 Playwright specs |

### UI primitives layer

| Concern | Library | Notes |
|:---|:---|:---|
| **Accessible button base** | `@base-ui/react` | `Button.tsx` wraps `@base-ui/react/button` with bespoke `cva` variants (6 variants × 5 sizes) |
| **Portal positioning** | `@floating-ui/react` | `Dropdown.tsx` + `Popover.tsx` use `FloatingPortal` + `useFloating` with `flip`/`shift` middleware (BUG-03/27 resolved) |
| **Toasts** | sonner | `ToastProvider.tsx` wraps `<Toaster>` (BUG-32: must bind `theme` to app `data-mode`, not `"system"`) |
| **Textarea autosize** | `react-textarea-autosize` | Used by `Textarea.tsx` |
| **Debounce** | `use-debounce` | Capture preview, settings autosave |
| **Class utilities** | `clsx` + `tailwind-merge` + `class-variance-authority` | Standard shadcn-style toolkit |
| **Custom primitives** | 28 files in `src/components/ui/` | See `docs/project/COMPONENT_MANIFEST.md` for full list |

## Directory Structure (verified, 225 files / 44 dirs)

```
Presense-main/
├── .github/workflows/          # 8 CI workflows (ci, eslint, osv-scanner, semgrep, sonarcloud, sonarqube, trivy) — all .yml
├── .husky/pre-commit           # Husky pre-commit hook (eslint --fix + prettier --write + tsc --noEmit on staged files)
├── docs/
│   ├── agents/EXECUTION_RULES.md
│   ├── plans/EXECUTION_SPEC.md  # 1684 lines, 23 sections, only active backlog
│   └── project/{ARCHITECTURE, COMPONENT_MANIFEST, CONTEXT, DESIGN_SYSTEM, DOCS_NEEDS_CODE}.md
├── public/                      # icons (icon.svg, icon-192.png, icon-512.png), manifest.json, vercel/next/file/globe/window.svg
├── scripts/                     # 6 ad-hoc scripts (2 referenced: clean-threads.js, check_snooze.js; 4 dead: read_data.py, refactor.js/.ps1, run_migrations.ps1)
├── src/
│   ├── app/                     # Next 16 app router — 21 routes (see below)
│   │   ├── (app)/               # Authenticated spaces (11 routes)
│   │   │   ├── do/              # Tasks — Board / Today / Calendar
│   │   │   ├── think/           # Threaded thoughts (page + [id]/page)
│   │   │   ├── remember/        # People (page + [id]/page) + Locations (page)
│   │   │   ├── explore/         # Reading queue (page + [id]/page + trash/page)
│   │   │   ├── inbox/page.tsx
│   │   │   ├── trash/page.tsx
│   │   │   ├── page.tsx         # Home dashboard (40 KB, largest page)
│   │   │   ├── layout.tsx       # Auth + onboarding-complete gate
│   │   │   ├── error.tsx, loading.tsx
│   │   │   └── template.tsx     # MISSING — BUG-23 (page-to-page is hard cut)
│   │   ├── (auth)/login/        # Login page + layout
│   │   ├── onboarding/          # 5-step wizard (OnboardingWizard.tsx, 416 lines)
│   │   ├── auth/callback/route.ts  # OAuth code exchange
│   │   ├── api/                 # 4 route handlers (account, capture, people/reorder, telemetry)
│   │   ├── ~offline/page.tsx    # PWA offline fallback (tilde prefix = Next 16 convention)
│   │   ├── layout.tsx           # Root layout (theme init script, fonts)
│   │   ├── global-error.tsx     # Root error boundary
│   │   ├── not-found.tsx        # 404
│   │   ├── icon.tsx             # Favicon
│   │   ├── sw.ts                # Serwist service worker
│   │   └── globals.css          # 41 KB — all CSS custom properties, 6 theme×mode blocks, component classes
│   ├── components/
│   │   ├── features/            # 11 domain components
│   │   │   ├── calendar/        # 4 calendar components (CalendarView, WeekView, MonthView, CalendarTaskChip)
│   │   │   ├── CaptureModal.tsx (538 lines), TaskCard.tsx (690), TaskAddPanel.tsx (1099)
│   │   │   ├── PomodoroTimer.tsx (467), RitualOverlay.tsx (1539, largest), SettingsModal.tsx (1693, 9 tabs)
│   │   │   ├── SearchModal.tsx (189), AddPersonPanel.tsx (254), LocationAddPanel.tsx (195)
│   │   │   └── ExploreDrawer.tsx (402)
│   │   ├── layout/              # 12 layout components
│   │   │   ├── Navigation.tsx (388), MobileTopBar.tsx, MobileDrawer.tsx (120)
│   │   │   ├── AmbientBackground.tsx, OnboardingBackground.tsx (213, 12 hardcoded hex — BUG-21)
│   │   │   ├── LenisProvider.tsx, MotionProvider.tsx (LazyMotion strict)
│   │   │   ├── QueryProvider.tsx, AppContentWrapper.tsx (83), AppInitializer.tsx (86)
│   │   │   ├── DynamicModals.tsx, WebVitalsReporter.tsx
│   │   ├── providers/           # 1 provider
│   │   │   └── RealtimeProvider.tsx (ref-counted shared channels, 5s teardown debounce)
│   │   └── ui/                  # 28 UI primitives (see COMPONENT_MANIFEST.md)
│   ├── hooks/                   # 9 hooks (useReducedMotion, useHaptics, useIsTouch, useMediaQuery, useBodyScrollLock, useDialogFocus, useRealtime, useRealtimeStatus, useVisualViewport)
│   ├── lib/                     # 15 lib modules + __tests__/ (13 test files)
│   │   ├── capture-router.ts (313, largest), item-lifecycle.ts, rituals.ts
│   │   ├── theme.ts (normalizer for 3 generations of legacy names)
│   │   ├── env.ts (@t3-oss/env-nextjs with .catch(), NEVER throws)
│   │   ├── supabase.ts, supabase-server.ts, schemas.ts, animations.ts
│   │   ├── chrono-custom.ts, constants.ts, utils.ts, logger.ts (27-line stub)
│   │   ├── rate-limit.ts, auth-redirect.ts, capture-router.ts
│   │   └── __tests__/ (13 test files, 2740 lines total)
│   ├── store/useAppStore.ts     # Zustand store (116 lines)
│   ├── types/                   # database.types.ts (733 lines, generated), calendar.ts (14 lines)
│   ├── instrumentation-client.ts # Global error handlers (window.error + unhandledrejection → /api/telemetry)
│   └── proxy.ts                 # Next 16 middleware (proxy, not middleware) — CSP nonce, auth, cookie forwarding
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── cron_cleanup/        # 30-day hard-delete cron (deletes status='deleted' older than 30 days across 5 entity tables)
│   │   └── cron_recurrence/     # Recurring task generation cron
│   └── migrations/              # 25 SQL migrations (dual naming: 001_-009_ then timestamped 20260628…)
├── tests/                       # 2 Playwright specs (sanity.spec.ts 9 lines, realtime.spec.ts 92 lines)
├── AGENTS.md, GEMINI.md, README.md
├── package.json, package-lock.json
├── components.json, tsconfig.json, next.config.ts, vitest.config.ts, playwright.config.ts
├── eslint.config.mjs, postcss.config.mjs
└── .env.example
```

## Key Patterns

### State Management
- **Zustand** for global state (user settings, modals, active timers, sidebar state) — `src/store/useAppStore.ts` (116 lines)
- **TanStack Query** for server state (tasks, threads, people, explores, locations) — `refetchOnWindowFocus: false` (PERF-07 fixed, avoids fighting Realtime)
- **Optimistic updates** for instant UI feedback
- **Typed Supabase client** — `src/types/database.types.ts` (733 lines, generated); `prebuild` script runs `npm run types:check` which regenerates types via `supabase gen types` and fails the build on schema drift

### Realtime
- **Supabase Realtime** via `src/components/providers/RealtimeProvider.tsx` — ref-counted shared channels (one channel per table) with 5-second teardown debounce
- Tracks 3 connection states: `connected`, `reconnecting`, `disconnected` — surfaced via `ConnectionStatus` UI component
- Responds to `CHANNEL_ERROR`, `TIMED_OUT`, `SUBSCRIBED` events
- Echo lockout to prevent self-triggered updates
- Tab visibility handling for background updates
- **Gap (audit July 9, 2026):** 0 `onAuthStateChange` handlers in src/ — if Supabase auth token expires and refresh fails, Realtime may silently disconnect, mutations fail silently, no redirect to /login

### Animation
- **Framer Motion** `m.*` components (not `motion.*`) for tree-shaking — `LazyMotion features={domMax} strict` via `MotionProvider.tsx`
- `MotionConfig` with `reducedMotion="user"` for accessibility
- Shared layout animations for smooth transitions
- **Motion tokens** in `src/lib/animations.ts`: `dur.fast/base/slow/verySlow` + `ease.spring/smooth/inOut`
- **Duplicate `useReducedMotion`** — defined in both `src/hooks/useReducedMotion.ts` AND `src/lib/animations.ts:21` (audit finding, consolidate to one)
- **DS-14 NOT implemented** — `prefers-reduced-motion: reduce` only zeroes duration, does NOT remove transform value; `prefers-reduced-transparency: reduce` has 0 occurrences in codebase

### Offline
- **Serwist** service worker at `src/app/sw.ts` (30 lines) — `@serwist/next` + `serwist` 9.5.11
- NetworkFirst for API calls, CacheFirst for static assets
- Offline fallback page at `src/app/~offline/page.tsx` (40 lines) — calm copy: "Your data is safe and will sync when you're back online"
- `UpdatePrompt.tsx` listens for service worker `controllerchange`, shows toast with Reload button, `duration: Infinity`
- **Gaps:** 0 `navigator.onLine` checks in app shell, 0 offline mutation queue (mutations on offline = silent failure), 0 retry logic

## Theme System

The app uses **3 themes** × **2 modes** = 6 combinations via `data-theme` + `data-mode` attributes on `<html>`:

| Theme | `--bg-base` (dark) | `--accent` (dark) | Default? |
|---|---|---|---|
| `warm` | `#0F0A00` (near-black warm) | `#E5B41E` (amber) | ✓ Default theme + dark mode |
| `navy` | `#04091A` (deep blue-black) | `#7692FF` (periwinkle) | |
| `forest` | `#080D06` (deep forest) | `#EFDD8D` (warm yellow) | |

`src/lib/theme.ts` normalizer (`normalizeThemeId`, `normalizeColorMode`, `applyDocumentTheme`) maps 3 generations of legacy names: `wahala`/`orange`/`blue`/`forest` (original) → `sunset`/`midnight`/`meadow` (intermediate) → `warm`/`navy`/`forest` (current). Per-space colors (`--space-do/-think/-remember/-explore`) resolve to 4 warm-family hues (`#E5B41E`/`#EB4233`/`#F4A261`/`#A76011`), derived in OKLCH from each theme's `--accent` per DS-28 (spec written, OKLCH derivation NOT YET implemented — current values are hand-picked warm hex).

**⚠ Critical bug (ROOT PATTERN 2):** Warm-light theme is broken — `globals.css:336-420` overrides `--bg-base` to `#FBF6EE` (cream) but does NOT override `--text-1/2/3/muted/decorative/on-accent`, so they stay at dark-mode `#FFFFFF` → white text on cream = unreadable. Navy-light and forest-light correctly override text colors. See `docs/project/DOCS_NEEDS_CODE.md`.

**99 hardcoded hex values** in `.tsx` files break theme switching (top offenders: SettingsModal 19, OnboardingBackground 12, remember/people/[id] 10, think/[id] 9, AddPersonPanel 7, CaptureModal 5, PomodoroTimer 3, CalendarTaskChip 3). See `docs/project/DOCS_NEEDS_CODE.md`.

## Hard Invariants (cross-ref `AGENTS.md` §1)

Changing any of these requires a line in the PR description reading `Invariant-change-approved-by: <name/date>` — no line, no merge.

1. `src/lib/env.ts` must never throw at runtime — uses `@t3-oss/env-nextjs` with `.catch(() => logAndReturnEmpty(...))`. Do NOT remove the `.catch()` wrapper. Do NOT configure in default (throwing) mode. (Earlier version that threw crashed the entire production site.)
2. `ThemeId` literal values = `"warm" | "navy" | "forest"` — third name set; do NOT rename a fourth time. `LEGACY_THEME_MAP` in `theme.ts` handles all 3 generations.
3. `Dropdown.tsx` and `Popover.tsx` render menu content through portal (Floating UI's `FloatingPortal` + `useFloating`). Never replace portal with z-index bump.
4. `Navigation.tsx` sidebar = pure hover-expand rail (`w-[80px] hover:w-[248px] focus-within:w-[248px]`). No click-toggle, no pinning.
5. `MotionProvider` keeps `LazyMotion features={domMax} strict`. `RealtimeProvider` ref-counted, debounced (5s) shared channels — no per-component subscriptions.
6. Never drop a database column in a migration. Never remove `auth.uid() = user_id` from an RLS policy. Never delete a file under `src/components/ui/` or `supabase/migrations/`.
7. Every Supabase mutation (`.insert()`, `.update()`, `.delete()`) must check returned `error` before telling the user it succeeded. **✅ BUG-38 CLOSED Aug 10, 2026** — all 27 mutation-bearing files audited, final 10 unchecked sites migrated to `safeMutate()` (commit `660f5a3`); zero error-unchecked mutation sites remain. New code MUST still check `error` (standard wrapper: `safeMutate(mutationFn, errorLabel)` in `src/lib/supabase.ts`; server components check `error` and log).

## Database (verified)

- **11 tables**: items, people, threads, explores, locations, push_subscriptions, user_settings, ritual_logs, session_logs, categories, + 1 more
- **25 migrations** in `supabase/migrations/` — dual naming (`001_`–`009_` then timestamped `20260628…`)
- **Soft-delete** via `status='deleted'` + `deleted_at` timestamp — centralized in `src/lib/item-lifecycle.ts` (`moveItemToTrashPatch`, `restoreItemPatch`, `archiveItemPatch`)
- **30-day hard-delete** enforced by `cron_cleanup` edge function (`supabase/functions/cron_cleanup/index.ts:14-30`) — deletes `status='deleted'` older than 30 days across 5 entity tables
- **Recurrence** generation via `cron_recurrence` edge function
- **RLS** uses `FOR ALL` (12 policies across 3 migration files) instead of 4 separate per-action policies (SELECT/INSERT/UPDATE/DELETE) — means customizing per-action is impossible without rewriting. 16 bare `auth.uid()` calls, 0 wrapped in `(select auth.uid())` — Postgres performance anti-pattern (re-evaluates per row).
- **Dead tables** (0 src usages): `push_subscriptions`, `session_logs`, `ritual_logs`, `categories`
- **Dead columns**: `confidence_threshold` (0 usages), `pomodoros_completed` (only in generated types)
- **Contradicting columns**: `ritual_streak` (actively written by `RitualOverlay.tsx:524,544,555,670,690,701` despite CONF-17 resolving against gamification), `ollama_enabled`/`ollama_url` (dead plumbing — no UI consumes them)

## Tests & CI (verified)

### Tests
- **144 tests pass** (Vitest, mostly in `src/lib/__tests__/`)
- **15 test files** totaling 2740 lines (`phase4.test.tsx` largest at 850 lines)
- **2 Playwright specs**: `sanity.spec.ts` (9 lines), `realtime.spec.ts` (92 lines) — minimal E2E coverage
- **Coverage thresholds**: 50% lines / 50% functions / 40% branches (low — flagged in audit)

### CI (`.github/workflows/`)
- **8 GitHub workflows**: ci (lint + tsc + test + build), eslint, osv-scanner, semgrep, sonarcloud, sonarqube, trivy
- **Pre-commit hook** via Husky + lint-staged: runs `eslint --fix` + `prettier --write` + `tsc --noEmit` on staged files
- **CI uses placeholder env vars** for build step (`NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co`) — correct, doesn't expose real secrets
- **`.gitignore`** properly excludes `.env*` except `.env.example`. 0 `.env` files committed. 0 hardcoded secrets in src/ (verified by grep for `sk-`, `service_role`, `eyJ` patterns).

### Missing in CI (audit ROOT PATTERN 8)
- 0 visual regression tests
- 0 axe-core a11y scan
- 0 Lighthouse CI with thresholds
- 0 bundle-size budget
- 0 error tracking in production (TOOL-06 / Sentry not installed)
- 0 E2E user-flow tests (only 2 minimal Playwright specs)
- 0 RLS automated test suite (TOOL-18 not started)
- Branch protection not verifiable from zip — must confirm on GitHub UI
- **Commit hygiene issue**: 10 of 11 commits have GUID messages (`cf91b58a-06b1-4367-ab05-a540d55980f6` etc.), violating `EXECUTION_RULES.md` commit format (`fix: T0-X short description`)

## Logging & Error Tracking

- **`src/lib/logger.ts`** — 27-line stub using Pino (good — structured logging) but `browser: { asObject: true }` only, no transport configured. Browser logs stay in console, server logs go to stdout.
- **`src/instrumentation-client.ts:25,33`** — global `window.addEventListener("error")` + `unhandledrejection` handlers. Both report to `/api/telemetry`. Good baseline.
- **`/api/telemetry` endpoint** (`src/app/api/telemetry/route.ts:38`) validates with Zod but only does `console.warn("[telemetry]", parsed.data)` — goes to stdout, not a log drain, not an error tracker. **In production, this is effectively a black hole.**
- **`ModalErrorBoundary`** used in 3 modals (SearchModal, CaptureModal, SettingsModal). **Missing from**: AddPersonPanel, LocationAddPanel, ExploreDrawer, TaskAddPanel, PomodoroTimer (verify if Sheet-based modals need it).
- **`AppErrorFallback`** used in 6 `error.tsx` files: `(app)`, `do`, `explore`, `think`, `remember`, `global-error`.
- **5 routes missing custom `error.tsx`**: `inbox`, `trash`, `remember/people/[id]`, `think/[id]`, `explore/[id]`
- **5 routes missing custom `loading.tsx`**: same set
- **Sentry not installed** (TOOL-06 open)

## Resilience Gaps (audit-verified)

- **0 `onAuthStateChange` handlers** — Supabase auth events (TOKEN_REFRESHED, SIGNED_OUT) NOT explicitly handled. If refresh fails (revoked session), no redirect to /login.
- **0 `navigator.onLine` checks** — no offline detection in app shell
- **0 offline mutation queue** — mutations on offline = silent failure (no queue, no retry, no error toast)
- **0 retry logic** for failed mutations (only `retry: false` in test mocks)
- **0 `beforeunload`/`isDirty` guards** — accidental close loses form data (BUG-42)
- **0 `aria-live` regions** — realtime changes invisible to screen readers
- **0 skip-to-content link** (A11Y-03)
- **0 `window.confirm`** (good — uses `ConfirmModal` instead, 14 instances across 9 files)
- **Trash/recovery**: soft-delete via `status='deleted'` + `deleted_at`; global `/trash` page shows all 5 entity types with restore + permanent-delete; 30-day retention by `cron_cleanup`. **Gap:** if `cron_cleanup` fails to run, no alert. Restore is per-item; no bulk restore. BUG-34 means some items never reach trash (they vanish from cache before write).

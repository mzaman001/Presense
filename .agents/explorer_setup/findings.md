# Codebase Exploration and Configuration Analysis Report

## 1. Project Overview
- **Name**: Presense
- **Type**: Personal productivity web application for solo student users
- **Stack**: Next.js 16.2.9 App Router (using React 19.2.4), Supabase (Postgres, Auth, Realtime, Edge Functions), Tailwind CSS 4, Framer Motion, and `compromise.js` for natural language processing (NLP).
- **Core Principle**: No external paid AI APIs. A local rule-based NLP parser (`src/lib/capture-router.ts`) is used for routing user input to task manager, memory log, web bookmarks, etc.

---

## 2. Directory Layout & Key Modules
The project follows a standard Next.js App Router structure:
```
C:\Users\muhdz\.gemini\antigravity\scratch\presense\
├── .agents/                    # Agent metadata (plans, progress, handoffs)
├── public/                     # Static assets (icons, SVGs, manifest.json)
├── scripts/                    # Maintenance & utility scripts
│   ├── check_snooze.js         # Debug snooze logic in Supabase
│   ├── clean-threads.js        # Supabase thread deduplication script
│   ├── read_data.py            # Diagnostic script to extract logs & docs
│   ├── refactor.js             # Refactor inline styles to CSS variables
│   ├── refactor.ps1            # PowerShell wrapper for refactoring styles
│   └── run_migrations.ps1      # Runs migrations starting from 014_snooze.sql
├── src/                        # Main codebase
│   ├── app/                    # Next.js app routes (grouped under (app), (auth), api)
│   ├── components/             # React component library (features, layout, ui)
│   ├── hooks/                  # Custom React hooks (useRealtime.ts)
│   ├── lib/                    # Library code & utilities (capture-router, chrono-custom, supabase)
│   │   └── __tests__/          # Vitest test suite for lib modules
│   └── store/                  # Client-side store management (useAppStore.ts)
├── supabase/                   # Supabase configuration
│   ├── functions/              # Deno-based edge functions (cron_cleanup, cron_recurrence)
│   └── migrations/             # SQL migrations (001_baseline.sql to 007_time_spent.sql)
└── (Config files in root)
```

---

## 3. Configuration Files Analysis

### A. `package.json`
- **Dependency Highlights**:
  - React/React-DOM: `19.2.4`
  - Next.js: `16.2.9`
  - Tailwind CSS & PostCSS: `^4`
  - Supabase SSR & JS: `^0.12.0` / `^2.108.1`
  - Vitest: `^4.1.9`
  - compromise: `^14.15.1` (rule-based NLP parsing)
  - framer-motion: `^12.40.0`
  - zustand: `^5.0.14`
- **Scripts**:
  - `dev`: `next dev` (runs Next.js local development server)
  - `build`: `next build` (builds production-ready static & dynamic routes)
  - `start`: `next start` (starts Next.js production server)
  - `lint`: `eslint` (runs ESLint)
  - `test`: `vitest run` (runs tests once in environment)
  - `test:watch`: `vitest` (runs tests in watch mode)
  - `script:clean`: `node scripts/clean-threads.js`
  - `script:snooze`: `node scripts/check_snooze.js`

### B. `tsconfig.json`
- Target environment: `ES2017`
- Uses Next.js plugin support (`"plugins": [{"name": "next"}]`)
- Strict type-checking enabled (`"strict": true`, `"noEmit": true`)
- Custom path aliases: `@/*` mapped to `./src/*`
- Inclusions cover `**/*.ts`, `**/*.tsx`, `**/*.mts`, and `.next` types.
- Exclusions: `node_modules` and `supabase` folders.

### C. `eslint.config.mjs`
- Combines Next.js core vitals rules (`eslint-config-next/core-web-vitals`) and Next.js TypeScript configurations (`eslint-config-next/typescript`).
- Custom global ignore overrides specified for: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`.

### D. `vitest.config.ts`
- Uses `jsdom` testing environment.
- Globals enabled (`globals: true`).
- Configures resolve path alias (`@` maps to `src` directory) matching TSConfig.

---

## 4. Script Verification Results

### A. Testing (`npm run test`)
Running `npm run test` executes Vitest against the suite in `src/lib/__tests__/capture-router.test.ts`.
- **Result**: **SUCCESSFUL**
- **Stats**: 1 test file passed, 28 tests passed.
- **Duration**: ~5.3 seconds.
- **Coverage**: Evaluates smart routing, NLP date extraction, location extraction, URL parsing, and multi-segment parsing rules.

### B. Linting (`npm run lint`)
Running `npm run lint` executes ESLint across the codebase.
- **Result**: **FAILED**
- **Errors**: **80 errors and 33 warnings (113 total problems)**.
- **Common Issues Identified**:
  - `react-hooks/set-state-in-effect`: Calling `setState` synchronously within a `useEffect` effect block.
    - Affected files: `SearchModal.tsx` (line 29), `AmbientBackground.tsx` (line 11), `ContextualTip.tsx` (line 18).
  - `@typescript-eslint/no-explicit-any`: Broad typing using `any` instead of specific interfaces.
    - Affected files: `SearchModal.tsx` (line 16), `SettingsModal.tsx` (line 505), `TaskCard.tsx` (line 40, 43), `AppInitializer.tsx` (line 6), `utils.ts` (line 19), Supabase edge functions.
  - `@next/next/no-img-element`: Suggests using Next.js optimized `<Image />` component rather than native `<img>`.
    - Affected files: `Avatar.tsx` (line 34).
  - `react-hooks/exhaustive-deps`: Missing dependencies in React effect hook dependency arrays.
    - Affected files: `Popover.tsx` (line 39).
  - `@typescript-eslint/no-unused-vars`: Declared variables that are never read.
    - Affected files: `TaskAddPanel.tsx` (`nlp`), `chrono-custom.ts` (`_match`), Supabase edge functions.

### C. Build (`npm run build`)
Running `npm run build` runs the production Next.js compiler.
- **Result**: **SUCCESSFUL**
- **Stats**: Compiled successfully in 6.9s. TypeScript type verification completed in 6.8s. All static and dynamic pages generated successfully.

---

## 5. Development & Project State Analysis

### A. Current Progress (via `PLAN.md`)
- **Completed**:
  - Phase 1 (Foundation): Replaced native browser dialogs with `ConfirmModal`, settings persistence foundation, dashboard task counts, realtime space subscriptions (Think, Explore, Remember), and task snooze logic.
  - Phase 2 (Capture Rework): Custom space dropdown, NLP date stripping, location name sanitization, and recurring task NLP extraction.
- **Pending**:
  - Phase 3 (Settings Rebuild): Slide-over settings interface, debounced auto-save, theme selectors, data export.
  - Phase 4 to 12: Onboarding flow overhaul, Do tab enhancements, Remember tab details, Pomodoro tracker build, visual polish, and navigation updates.

### B. Architectural Audit (via `FIX_LIST.md` and Source Exploration)
- **Database Schema Drift**: High risk. The baseline migrations do not define several columns (e.g. detailed fields on `user_settings`, `recurrence` on `items`, `pinned` on `threads`).
- **Missing Tables**: `categories` and `session_logs` tables have no corresponding migrations in the codebase despite being references in features.
- **Data Anti-Pattern**: People notes and thread entries are stored as `jsonb[]` arrays within single records, meaning updates/deletions require modifying and writing back the entire array.
- **UI State**: The Zustand store `useAppStore.ts` is a massive single store that handles UI state, settings, timer, and mutation tracking together.

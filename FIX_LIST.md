# PRESENSE — COMPREHENSIVE AUDIT & FIX LIST
Generated: June 17, 2026
Based on: Full codebase review, industry standards research, and top-app benchmarking

---

## TABLE OF CONTENTS
1. [Critical Bugs & Broken Things](#1-critical-bugs--broken-things)
2. [Architecture & Code Quality Issues](#2-architecture--code-quality-issues)
3. [Missing Features & Incomplete Work](#3-missing-features--incomplete-work)
4. [UX & Design Problems](#4-ux--design-problems)
5. [Performance Issues](#5-performance-issues)
6. [Security Gaps](#6-security-gaps)
7. [Testing Vacuum](#7-testing-vacuum)
8. [Infrastructure & DevOps](#8-infrastructure--devops)
9. [Stupid Decisions & Hallucinations](#9-stupid-decisions--hallucinations)
10. [What Holds This App Back](#10-what-holds-this-app-back)
11. [Forward Plan — Breaking Away from CRUD](#11-forward-plan--breaking-away-from-crud)

---

## 1. CRITICAL BUGS & BROKEN THINGS

### 1.1 Zero Automated Tests
- **Impact**: CRITICAL. Any change can silently break anything. No confidence in deployments.
- **Industry standard**: 70-80% coverage on business logic, 90%+ on auth/data flows.
- **Fix**: Add Vitest + React Testing Library for unit/component tests. Playwright for E2E. Start with capture router, auth flow, and task CRUD.

### 1.2 Settings Don't Persist (PARTIALLY FIXED)
- **Status**: Task 1.2 in PLAN.md claims fixed, but the `user_settings` table schema is incomplete.
- **Issue**: The DB schema (001_baseline.sql) is missing columns that the Zustand store expects: `theme`, `color_mode`, `pomodoro_duration`, `short_break_duration`, `long_break_duration`, `auto_start_breaks`, `default_view`, `auto_archive_days`, `do_categories`, `do_category_colors`, `smart_routing_enabled`, `nlp_date_parsing`, `routing_confidence`, `pomodoro_long_break_interval`, `explore_custom_types`, `onboarding_complete`, `primary_struggles`.
- **Fix**: Write a migration that adds ALL missing columns to `user_settings`. The store has 40+ fields but the DB has ~20.

### 1.3 Database Schema Drift
- **Issue**: The `items` table in the migration has `status IN ('active','done','overdue','archived')` but PLAN.md references `status = 'inbox'` and `status = 'deleted'`. The `threads` table has no `status` or `is_pinned` column. The `explores` table has no `status` or `deleted_at` column. The `people` table has no `sort_order` column.
- **Fix**: Write comprehensive migrations to align the DB schema with what the app code actually expects. Every column referenced in PLAN.md must exist.

### 1.4 No `categories` Table
- **Issue**: PLAN.md Task 3.1 references a `categories` table for custom user categories, but no migration creates it.
- **Fix**: Create the `categories` table with proper RLS.

### 1.5 No `session_logs` Table
- **Issue**: PLAN.md Task 8.1 references `session_logs` for Pomodoro tracking, but no migration creates it.
- **Fix**: Create the table with proper RLS and foreign keys.

### 1.6 Missing `pinned` Column on `threads`
- **Issue**: PLAN.md Task 11.1 references `ALTER TABLE threads ADD COLUMN pinned boolean DEFAULT false` but this migration doesn't exist.
- **Fix**: Add the migration.

### 1.7 Missing `sort_order` on `people`
- **Issue**: PLAN.md Task 6.1 references `sort_order` for people reordering. The `/api/people/reorder` route exists but the column may not.
- **Fix**: Verify and add the column if missing.

### 1.8 Recurring Task Cron May Be Broken
- **Issue**: The `cron_recurrence` edge function exists but the `recurrence` column on `items` is not in the baseline migration. Also, `status IN ('active','done','overdue','archived')` doesn't include `'inbox'` or `'deleted'` which the cron and cleanup functions may need.
- **Fix**: Add `recurrence text` column to `items`. Verify the cron function's SQL matches the actual schema.

---

## 2. ARCHITECTURE & CODE QUALITY ISSUES

### 2.1 Single Zustand Store for Everything
- **Issue**: `useAppStore.ts` is a flat bag of 40+ fields mixing UI state, user settings, timer state, and mutation tracking. This will not scale.
- **Fix**: Split into focused stores: `useUIStore`, `useSettingsStore`, `useTimerStore`. Or use Zustand slices.

### 2.2 No Error Boundaries
- **Issue**: No React error boundaries exist. Any component crash takes down the entire app.
- **Fix**: Add error boundaries at the route level (Next.js `error.tsx` files) and at the app shell level.

### 2.3 No Loading States / Suspense
- **Issue**: No streaming SSR or Suspense boundaries. Pages likely show nothing while data loads.
- **Fix**: Add `loading.tsx` files for each route group. Use React Suspense for data-dependent UI.

### 2.4 No TypeScript Strict Mode
- **Issue**: `tsconfig.json` has `"strict": true` (good), but there's no `noUncheckedIndexedAccess`, `noImplicitOverride`, or `exactOptionalPropertyTypes`. The `[key: string]: unknown` escape hatch in `UserSettings` defeats type safety.
- **Fix**: Enable stricter TS flags. Remove the index signature from `UserSettings` and type all fields explicitly.

### 2.5 Inconsistent Component Patterns
- **Issue**: Some components use slide-in panels (TaskAddPanel, AddPersonPanel), others use drawers (ExploreDrawer), others use modals (SettingsModal). No consistent pattern.
- **Fix**: Standardize on: full-page slide-over for complex forms, centered modal for confirmations, drawer for quick edits. Document the pattern.

### 2.6 No Shared Component Library
- **Issue**: UI primitives in `components/ui/` are minimal (8 components). Many patterns are reimplemented per-feature (date pickers, tag inputs, color pickers).
- **Fix**: Build a proper component library: DatePicker, TagInput, ColorPicker, TimePicker, PillSelect, SearchInput.

### 2.7 No API Route Validation
- **Issue**: `/api/capture` and `/api/people/reorder` have no input validation. No Zod schemas. No rate limiting.
- **Fix**: Add Zod validation to all API routes. Add rate limiting middleware.

### 2.8 Hardcoded Values Throughout
- **Issue**: Magic numbers scattered: `2.5` seconds for mutation echo window, `30` days for trash, `4` for max pinned threads, `44px` for touch targets.
- **Fix**: Extract all constants to `lib/constants.ts` with descriptive names.

### 2.9 No Proper Error Handling Pattern
- **Issue**: Some mutations use `toast.error()`, others silently fail, others throw. No consistent error handling.
- **Fix**: Create a `handleMutationError()` utility that logs to Sentry (when added), shows toast, and reverts optimistic updates.

### 2.10 No Code Splitting
- **Issue**: No dynamic imports. The SettingsModal (~862 lines), CaptureModal, PomodoroTimer, and SearchModal all load on initial page load.
- **Fix**: Use `next/dynamic` for heavy components that aren't immediately visible.

---

## 3. MISSING FEATURES & INCOMPLETE WORK

### 3.1 PLAN.md Phases 3-12 Are Incomplete
- **Status**: Only Phase 1 (Foundation) and Phase 2 (Capture Rework) are marked complete. Phases 3-12 are all unchecked.
- **Impact**: Settings rebuild, onboarding rebuild, Do space fixes, Remember fixes, Explore fixes, Pomodoro build, Home fixes, Navigation fixes, Think improvements, and Theme system are all unfinished.

### 3.2 No Push Notifications Implementation
- **Issue**: `push_subscriptions` table exists. Settings have notification toggles. But there's no service worker, no push subscription registration, no notification sending logic.
- **Fix**: Implement the full push notification pipeline: service worker, VAPID keys, subscription registration, notification triggers.

### 3.3 No Data Export
- **Issue**: Settings reference "Export all data" but no implementation exists.
- **Fix**: Build a `/api/export` route that queries all user data and returns a JSON file.

### 3.4 No Delete Account
- **Issue**: PLAN.md describes a Delete Account flow but it's not implemented.
- **Fix**: Implement with confirmation modal, 30-day soft delete, and actual deletion cron.

### 3.5 No Onboarding Data Persistence
- **Issue**: PLAN.md Task 4.1 notes onboarding screens are cosmetic and don't save data. This is listed as incomplete.
- **Fix**: Implement the full 5-screen onboarding with data persistence.

### 3.6 No Search Across All Spaces
- **Issue**: `SearchModal.tsx` exists but it's unclear if it actually searches across all tables (items, threads, people, explores, locations).
- **Fix**: Implement cross-space search with Supabase full-text search (GIN trigram indexes exist but may not be leveraged).

### 3.7 No Keyboard Shortcuts Beyond Cmd+K
- **Issue**: Only Cmd+K is implemented. Linear, Todoist, and other top apps have shortcuts for everything.
- **Fix**: Add a keyboard shortcut system: Cmd+N (new task), Cmd+Shift+N (new thread), Cmd+/ (search), Escape (close modals), 1-5 (switch spaces).

### 3.8 No Drag-and-Drop Reordering
- **Issue**: `@dnd-kit` is installed but not used for task reordering, people reordering, or thread reordering. Only the reorder API route exists.
- **Fix**: Implement drag-and-drop for task priority reordering, people list reordering, and thread list reordering.

### 3.9 No Offline Support
- **Issue**: PWA manifest exists but there's no service worker, no offline caching, no background sync.
- **Fix**: Implement with `next-pwa` or `serwist`. Cache the app shell. Queue mutations for background sync.

### 3.10 No Calendar Integration
- **Issue**: Tasks have deadlines but there's no calendar view. Top apps (Sunsama, Amie, Akiflow) all have calendar views.
- **Fix**: Add a calendar view to the Do space showing tasks on their deadlines.

### 3.11 No Weekly Review / Summary
- **Issue**: Sunsama's weekly review is a key differentiator. Presense has no way to review what happened this week.
- **Fix**: Build a weekly review screen showing: tasks completed, pomodoros logged, people contacted, threads updated.

### 3.12 No Habits / Recurring Tracking
- **Issue**: Recurring tasks exist but there's no habit tracker or streak system. This is a major gap for a "second brain" app.
- **Fix**: Add habit tracking with streaks, completion rates, and visualizations.

---

## 4. UX & DESIGN PROBLEMS

### 4.1 No Consistent Empty States
- **Issue**: Empty lists likely show nothing or generic messages. Top apps have illustrated empty states with CTAs.
- **Fix**: Design empty states for each space with illustrations, helpful text, and action buttons.

### 4.2 No Skeleton Loading States
- **Issue**: No skeleton screens while data loads. Users see either nothing or spinners.
- **Fix**: Add skeleton loaders that match the layout of each page's content.

### 4.3 No Responsive Design Verified
- **Issue**: The sidebar collapses on mobile but it's unclear if all pages work well at 320px-768px.
- **Fix**: Test and fix every page at mobile breakpoints. Ensure touch targets are 44px minimum.

### 4.4 No Animation System
- **Issue**: Framer Motion is installed but used minimally. No page transitions, no list animations, no micro-interactions.
- **Fix**: Add: page transitions (slide/fade), list item enter/exit animations, button press feedback, modal open/close animations.

### 4.5 No Focus Management
- **Issue**: No focus trapping in modals, no focus restoration after modal close, no skip navigation links.
- **Fix**: Implement focus trap in all modals/overlays. Add skip-to-content link. Manage focus on route changes.

### 4.6 No Color Contrast Verification
- **Issue**: The amber-on-dark theme may not meet WCAG AA 4.5:1 contrast ratio for normal text.
- **Fix**: Audit all text/background combinations. The `--text-3` token (rgba(255,255,255,0.45)) on `--bg-base` (#0F0A00) likely fails.

### 4.7 No Touch Gesture Support
- **Issue**: Mobile users can't swipe to complete tasks, swipe to delete, or pull to refresh.
- **Fix**: Add swipe gestures for common actions on mobile.

### 4.8 No Haptic Feedback
- **Issue**: Mobile app has no haptic feedback for actions. This is a subtle but important quality signal.
- **Fix**: Add navigator.vibrate() for task completion, timer end, and important actions.

### 4.9 No Dark/Light Mode Transition
- **Issue**: Switching between dark and light mode likely causes a flash of unstyled content.
- **Fix**: Use the ThemeProvider pattern from PLAN.md Task 12.2 to apply theme before first paint.

### 4.10 No Unsaved Changes Warning
- **Issue**: Editing a task and navigating away loses changes without warning.
- **Fix**: Add beforeunload warning and route change guards for forms with unsaved changes.

---

## 5. PERFORMANCE ISSUES

### 5.1 No Code Splitting
- **Issue**: All JavaScript loads upfront. SettingsModal (862 lines), CaptureModal, PomodoroTimer all bundle together.
- **Fix**: Dynamic imports for modals, overlays, and heavy components.

### 5.2 No Image Optimization
- **Issue**: No `next/image` usage. Any images (avatars, photos) load unoptimized.
- **Fix**: Use `next/image` with proper sizing, blur placeholders, and lazy loading.

### 5.3 No Font Optimization
- **Issue**: Inter and JetBrains Mono load via `next/font/google` (good), but no font-display strategy for icons.
- **Fix**: Ensure all text uses the optimized fonts. Consider subsetting Inter for faster load.

### 5.4 No Bundle Analysis
- **Issue**: No awareness of bundle size. No analyzer script.
- **Fix**: Add `@next/bundle-analyzer`. Target: < 200KB first load JS for the main bundle.

### 5.5 No Caching Strategy
- **Issue**: No HTTP caching headers. No stale-while-revalidate patterns. Every page load hits Supabase.
- **Fix**: Add proper cache headers for static assets. Use React Query's staleTime for data fetching.

### 5.6 Large CSS Bundle
- **Issue**: `globals.css` is 1224 lines. All themes, all components, all states in one file.
- **Fix**: While Tailwind handles purging, consider splitting CSS into logical modules for maintainability.

### 5.7 No Prefetching
- **Issue**: No route prefetching. Navigation feels slow because data loads after route change.
- **Fix**: Add `<Link prefetch>` for likely navigation targets. Use React Query prefetching.

---

## 6. SECURITY GAPS

### 6.1 No Security Headers
- **Issue**: No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, or `Permissions-Policy` headers.
- **Fix**: Add all security headers in `next.config.ts` or middleware.

### 6.2 No Rate Limiting
- **Issue**: API routes (`/api/capture`, `/api/people/reorder`) have no rate limiting. Vulnerable to abuse.
- **Fix**: Add rate limiting middleware (e.g., `@upstash/ratelimit` with Redis, or in-memory sliding window).

### 6.3 No Input Sanitization
- **Issue**: User input goes directly to Supabase without sanitization. XSS possible if data is rendered unsafely.
- **Fix**: Sanitize all user input. Use Zod schemas for validation. Ensure React's default XSS protection is maintained.

### 6.4 No CSRF Protection
- **Issue**: No CSRF tokens on API routes.
- **Fix**: Add CSRF protection via SameSite cookies (Supabase handles this) or custom tokens.

### 6.5 No Auth on API Routes
- **Issue**: `/api/capture` and `/api/people/reorder` may not verify the user is authenticated before processing.
- **Fix**: Verify `supabase.auth.getUser()` in every API route handler.

### 6.6 Exposed Supabase Keys
- **Issue**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is client-side exposed (this is by design for Supabase), but ensure no service role key is ever exposed.
- **Fix**: Audit `.env` and `.env.local` to ensure no `SUPABASE_SERVICE_ROLE_KEY` is in `NEXT_PUBLIC_` prefixed variables.

### 6.7 No Content Security Policy for Inline Scripts
- **Issue**: Next.js may inject inline scripts that break strict CSP.
- **Fix**: Configure CSP with nonces or use `next/script` with proper strategy.

---

## 7. TESTING VACUUM

### 7.1 No Unit Tests
- **Impact**: Can't verify individual functions work correctly.
- **Priority targets**:
  - `lib/capture-router.ts` — the NLP engine is the core differentiator. Must have 90%+ coverage.
  - `lib/chrono-custom.ts` — custom date parsers need extensive edge case testing.
  - Zustand store actions — settings updates, timer state, UI toggles.

### 7.2 No Component Tests
- **Impact**: Can't verify UI renders correctly or responds to interactions.
- **Priority targets**:
  - `ConfirmModal` — opens, closes, confirms, cancels.
  - `TaskCard` — renders priority, handles completion, shows snooze.
  - `CaptureModal` — NLP routing, chip generation, space selection.

### 7.3 No Integration Tests
- **Impact**: Can't verify data flows work end-to-end.
- **Priority targets**:
  - Capture flow: type text → NLP routes → item created in correct table.
  - Settings flow: change setting → auto-saves → persists on reload.
  - Task flow: create → complete → undo → snooze.

### 7.4 No E2E Tests
- **Impact**: Can't verify the full user journey works.
- **Priority targets**:
  - Onboarding → first capture → home dashboard.
  - Login → create task → complete task → view stats.
  - Capture → route to Think → add entry → pin thread.

### 7.5 No Visual Regression Tests
- **Impact**: Design changes can silently break layouts.
- **Fix**: Use Playwright screenshot comparisons or Chromatic for visual regression.

### 7.6 No Lighthouse CI
- **Impact**: Performance, accessibility, and SEO regressions go unnoticed.
- **Fix**: Add Lighthouse CI to the pipeline. Target: 90+ on all categories.

---

## 8. INFRASTRUCTURE & DEVOPS

### 8.1 No CI/CD Pipeline
- **Issue**: No GitHub Actions, no automated testing, no automated deployment.
- **Fix**: Create `.github/workflows/ci.yml`: lint → typecheck → test → build → preview deploy.

### 8.2 No Error Tracking
- **Issue**: No Sentry, no error logging, no crash reporting. Bugs in production are invisible.
- **Fix**: Add Sentry for error tracking and performance monitoring.

### 8.3 No Analytics
- **Issue**: No way to know how users use the app. No feature adoption metrics.
- **Fix**: Add privacy-friendly analytics (Plausible or Fathom). Track: capture usage, space navigation, pomodoro completions.

### 8.4 No Uptime Monitoring
- **Issue**: No way to know if the app is down.
- **Fix**: Add BetterStack or Pingdom for uptime monitoring.

### 8.5 No Staging Environment
- **Issue**: Only dev and production. No way to test changes safely.
- **Fix**: Use Vercel preview deployments for every PR as a staging environment.

### 8.6 No Database Backups
- **Issue**: Supabase handles backups on paid plans, but no verification or restore process exists.
- **Fix**: Document the backup/restore process. Consider pg_dump scheduled backups.

### 8.7 No Environment Variable Management
- **Issue**: `.env` and `.env.local` are local files. No secret rotation, no access control.
- **Fix**: Use Vercel environment variables with proper scoping (development, preview, production).

### 8.8 No Logging
- **Issue**: No structured logging. No way to debug issues in production.
- **Fix**: Add a logging utility that sends to a service (Axiom, Datadog, or just console with structured JSON).

---

## 9. STUPID DECISIONS & HALLUCINATIONS

### 9.1 Single-User App With Multi-User Overhead
- **Decision**: RLS policies on every table, user_id filtering on every query, auth checks everywhere.
- **Reality**: This is a solo student app. The auth/RLS overhead adds complexity without benefit.
- **Fix**: Keep RLS for future-proofing, but simplify where possible. Consider a "personal mode" that skips auth for local development.

### 9.2 No AI But Full AI Infrastructure
- **Decision**: "No paid AI APIs. Zero." But the settings have `ollama_enabled`, `ollama_url`, and the capture router has Ollama integration hooks.
- **Reality**: The Ollama integration is dead code that adds complexity. Either use it or remove it.
- **Fix**: Either implement Ollama support properly or remove all Ollama references from the codebase.

### 9.3 Compromise.js for NLP
- **Decision**: Using compromise.js for natural language processing.
- **Reality**: compromise.js is a lightweight NLP library that works for basic tasks but struggles with complex sentences, ambiguous phrasing, and multi-language input. It's the right choice for zero-cost NLP, but the limitations should be documented.
- **Fix**: Document the NLP limitations. Add a fallback: if compromise can't parse, ask the user to manually classify.

### 9.4 JSONB Arrays for Notes
- **Decision**: People notes stored as `jsonb[]` (PostgreSQL arrays of JSON objects).
- **Reality**: This makes individual note updates/deletes extremely difficult. You have to read the entire array, modify, and write back. This is a classic anti-pattern.
- **Fix**: Create a `person_notes` table with proper foreign keys. Migrate existing data.

### 9.5 No Unique Constraint on Items
- **Decision**: No unique constraint on `(user_id, title)` for items.
- **Reality**: Users can accidentally create duplicate tasks. Threads have this constraint but items don't.
- **Fix**: Add a unique partial index: `CREATE UNIQUE INDEX idx_items_unique_title ON items (user_id, title) WHERE status != 'deleted'`.

### 9.6 Hardcoded Category List
- **Decision**: Categories are hardcoded in CHECK constraint: `('work','study','personal','errand','health','other')`.
- **Reality**: Users should be able to create custom categories. The CHECK constraint prevents this.
- **Fix**: Remove the CHECK constraint. Use the `categories` table for dynamic categories.

### 9.7 No Optimistic Updates for Realtime
- **Decision**: Using `lastMutationAt` timestamp to ignore realtime echo during optimistic updates.
- **Reality**: This is a hack. A 2.5-second window means legitimate changes from other devices (if multi-device) are also ignored.
- **Fix**: Use a proper mutation ID system. Include a unique ID with each mutation and ignore realtime events that match the ID.

### 9.8 Thread Entries as JSONB Array
- **Decision**: Thread entries stored as `jsonb[]` in the threads table.
- **Reality**: Same problem as person notes. Individual entry updates require full array read/write.
- **Fix**: Create a `thread_entries` table with proper foreign keys.

### 9.9 No Version Control for Database Migrations
- **Decision**: Migrations are plain SQL files in `supabase/migrations/`.
- **Reality**: No migration tool (like Prisma Migrate, Drizzle Kit, or Supabase CLI) tracks which migrations have been applied. Manual execution is error-prone.
- **Fix**: Use Supabase CLI for migration management. Run `supabase db push` or `supabase migration up`.

### 9.10 No Type Safety Between Frontend and Backend
- **Decision**: TypeScript types for database entities are manually defined (or not defined at all).
- **Reality**: The DB schema can drift from the frontend types without any compile-time error.
- **Fix**: Generate TypeScript types from the Supabase schema using `supabase gen types typescript`.

---

## 10. WHAT HOLDS THIS APP BACK

### 10.1 No Unique Value Proposition
- **Problem**: The app does task management, note-taking, people tracking, and link saving. Every competitor does at least one of these better.
- **What competitors do better**: Todoist (tasks), Notion (notes), Sunsama (daily planning), Things 3 (task philosophy), Linear (keyboard-first).
- **What Presense has**: The NLP capture router is genuinely unique — "type anything and it routes to the right space" is a compelling feature. But it's buried behind incomplete UX.
- **Fix**: Make the capture router THE hero feature. Build the entire UX around it. The capture modal should be the primary interface, not a secondary Cmd+K popup.

### 10.2 Incomplete Core Experience
- **Problem**: 60% of PLAN.md is unfinished. Settings, onboarding, and most space improvements are stubs.
- **Impact**: Users hit broken or missing features immediately. No retention.
- **Fix**: Complete Phases 3-12 before adding any new features.

### 10.3 No Mobile App
- **Problem**: PWA manifest exists but it's not a real PWA. No service worker, no offline support, no app store presence.
- **Impact**: 80%+ of productivity app usage is mobile. Without a mobile app, the app is unusable for most of the day.
- **Fix**: Implement proper PWA with offline support. Consider Capacitor for native mobile.

### 10.4 No Data Portability
- **Problem**: Data is locked in Supabase. No standard export format. No Obsidian/Notion import.
- **Impact**: Users won't invest time in an app they can't leave.
- **Fix**: Implement JSON export (already planned). Add Markdown export. Consider importing from Todoist, Notion.

### 10.5 No Social / Sharing Features
- **Problem**: Completely solo. No way to share tasks, notes, or links with others.
- **Impact**: Limits use cases. Students often need to collaborate.
- **Fix**: Add shared lists, shared threads, or at minimum, shareable export links.

### 10.6 No Integrations
- **Problem**: No Google Calendar sync, no email integration, no Slack, no GitHub.
- **Impact**: Users must manually keep multiple apps in sync. This is the #1 reason people leave productivity apps.
- **Fix**: Start with Google Calendar sync (tasks → calendar events). Add email-to-capture.

### 10.7 No Gamification / Motivation
- **Problem**: No streaks, no achievements, no weekly stats, no progress visualization.
- **Impact**: No reason to come back daily. Todoist has Karma. Streaks create habit loops.
- **Fix**: Add daily streaks, completion stats, weekly reviews, and gentle nudges.

### 10.8 No Onboarding for Retention
- **Problem**: Onboarding is cosmetic. No "aha moment" guidance. No progress toward value.
- **Impact**: 72% of users abandon apps within 30 days.
- **Fix**: Guide users to their first capture, first task completion, and first weekly review within the first session.

### 10.9 No Documentation for Users
- **Problem**: No help docs, no tooltips, no feature explanations. The app assumes users understand the philosophy.
- **Impact**: Users don't discover features. The NLP capture is powerful but undocumented.
- **Fix**: Add contextual tips (ContextualTip component exists but may not be used), a help center, and feature tooltips.

### 10.10 No Pricing / Monetization Strategy
- **Problem**: No clear path to sustainability. Free forever = no revenue = no maintenance.
- **Impact**: The app will eventually be abandoned.
- **Fix**: Consider: freemium (basic free, advanced features paid), one-time purchase (like Things 3), or donation-based.

---

## 11. FORWARD PLAN — BREAKING AWAY FROM CRUD

### The Core Insight
Presense's unique advantage is the **NLP capture router** — the ability to type anything and have it automatically classified and routed to the right space. This is what Todoist, Sunsama, and others are building toward with AI, but Presense does it locally with zero cost. This should be THE defining feature.

### Phase 0: Foundation Hardening (Week 1-2)
Complete the critical fixes before building anything new:

1. **Database Schema Alignment** — Write migrations for ALL missing columns and tables
2. **TypeScript Types from Schema** — Generate types with `supabase gen types typescript`
3. **Add Error Boundaries** — Route-level error.tsx files
4. **Add Loading States** — loading.tsx files for all routes
5. **Security Headers** — Add all OWASP headers in next.config.ts
6. **Add Sentry** — Error tracking and performance monitoring
7. **Basic Test Suite** — Vitest for capture router, Playwright for critical paths

### Phase 1: Make Capture THE Hero (Week 3-4)
Build the entire UX around the capture router:

1. **Full-Screen Capture Mode** — Not just a Cmd+K modal. A dedicated capture experience with large text input, real-time NLP analysis, and multi-segment batch capture.
2. **Smart Suggestions** — After routing, suggest related actions: "This looks like a task. Want to add a deadline?" "This mentions a person. Want to save them to Remember?"
3. **Capture History** — Show recent captures with the ability to re-route or edit. Users can see what they captured and how it was classified.
4. **Capture Analytics** — Show "You captured 47 items this week. 23 went to Do, 12 to Think, 8 to Explore." Make the NLP feel magical.
5. **Batch Capture** — Type multiple items separated by newlines. Each gets independently classified and routed.

### Phase 2: Daily Ritual (Week 5-6)
Build the Sunsama-style daily planning ritual:

1. **Morning Briefing** — When the app opens, show: today's tasks (sorted by priority), upcoming deadlines, people to contact, threads to revisit. This is the "good morning" screen.
2. **End-of-Day Review** — Prompt users to review what they did: tasks completed, pomodoros logged, new captures. Show a summary and ask "What's one thing you're proud of today?"
3. **Weekly Review** — A dedicated screen showing: tasks completed vs planned, pomodoro focus time, most active spaces, streak status, and a prompt to plan next week.
4. **Daily Note** — Auto-create a daily note in Think space. Show it on the morning briefing. Let users journal quickly.

### Phase 3: Keyboard-First Power User Mode (Week 7-8)
Linear/Raycast-style keyboard shortcuts:

1. **Command Palette** — Full command palette (not just capture). Access any action with keyboard: create task, switch space, toggle theme, open settings.
2. **Keyboard Navigation** — Arrow keys to navigate lists, Enter to open, Delete to remove, Cmd+Enter to complete.
3. **Quick Switcher** — Cmd+T to switch between spaces instantly. Shows recent spaces.
4. **Vim-Style Motions** — For power users: `dd` to delete, `jj` to exit insert mode, `/` to search.

### Phase 4: Intelligence Layer (Week 9-10)
Add smart features that leverage the NLP and data:

1. **Smart Scheduling** — Based on task priorities and deadlines, suggest optimal work blocks. "You have 3 urgent tasks due tomorrow. Block 2-4pm for focused work."
2. **Overdue Detection** — Proactively surface overdue tasks with escalating urgency. Show patterns: "You've snoozed this task 3 times. Want to break it down?"
3. **People Insights** — "You haven't contacted [Name] in 2 weeks. They have a meeting coming up." Auto-suggest follow-ups.
4. **Content Resurfacing** — Weekly digest of Explore items saved >7 days ago. "You saved this article 2 weeks ago. Still relevant?"
5. **Stale Thread Detection** — "You haven't updated [Thread] in 10 days. Still thinking about this?"

### Phase 5: Visual Polish & Micro-Interactions (Week 11-12)
Make the app feel premium:

1. **Page Transitions** — Smooth slide/fade between spaces. No jarring page loads.
2. **List Animations** — Items enter/exit with spring animations. Staggered entry for lists.
3. **Completion Celebration** — When completing a task: satisfying animation (checkmark fills, particles burst). Todoist does this well.
4. **Empty State Illustrations** — Custom SVG illustrations for each space's empty state. Warm, inviting, on-brand.
5. **Skeleton Loaders** — Shimmer loading states that match the content layout.
6. **Theme Transitions** — Smooth color transitions when switching themes. No flash.

### Phase 6: Mobile Excellence (Week 13-14)
Make the PWA feel native:

1. **Swipe Gestures** — Swipe right to complete, left to delete. Swipe on task cards in Do.
2. **Pull to Refresh** — Native-feeling pull-to-refresh on all list views.
3. **Bottom Sheet** — Mobile-native bottom sheets for forms (not slide-in panels).
4. **Haptic Feedback** — Vibrate on completion, timer end, important actions.
5. **Offline Mode** — Full offline support with background sync. Show cached data when offline.
6. **Home Screen Widget** — iOS/Android widget showing today's tasks and capture button.

### Phase 7: Integration Layer (Week 15-16)
Connect to the user's ecosystem:

1. **Google Calendar Sync** — Two-way sync: tasks appear on calendar, calendar events appear in Do.
2. **Email Capture** — Send an email to a unique address, it appears in Inbox. Forward newsletters to Explore.
3. **Browser Extension** — Save links to Explore directly from Chrome/Safari. One-click capture.
4. **Apple Watch** — Quick capture from wrist. Show today's tasks. Timer controls.
5. **Siri Shortcuts** — "Hey Siri, capture: buy groceries tomorrow" routes through the capture API.

### Phase 8: Analytics & Insights (Week 17-18)
Help users understand their patterns:

1. **Focus Analytics** — Pomodoro history with trends: "You focused 12 hours this week, up 20% from last week."
2. **Task Analytics** — Completion rates, overdue patterns, category distribution.
3. **Capture Analytics** — What types of things you capture most. When you capture most.
4. **People Analytics** — Who you interact with most. Who you've lost touch with.
5. **Knowledge Analytics** — What you save but never revisit. Suggested cleanup.

### Phase 9: Social & Sharing (Week 19-20)
Break the solo constraint:

1. **Shared Lists** — Share a task list with a study group. Real-time sync.
2. **Shared Threads** — Collaborate on a Think thread with a colleague.
3. **Accountability Partner** — Share your daily stats with a friend. "I completed 8 tasks today."
4. **Public Profiles** — Share your Explore feed (curated links) as a public page.

### Phase 10: Monetization & Launch (Week 21-24)
Sustainability:

1. **Freemium Model** — Free: 50 captures/day, 3 spaces, basic timer. Pro: unlimited, all spaces, analytics, integrations.
2. **One-Time Purchase Option** — Like Things 3: pay once, own forever. Build loyalty.
3. **App Store Submission** — Submit PWA to app stores via TWA (Trusted Web Activity).
4. **Marketing Site** — Beautiful landing page showcasing the capture router as the hero feature.
5. **Documentation Site** — Full help center with guides, tutorials, and API docs.
6. **Community** — Discord server for users to share tips, request features, and connect.

---

## PRIORITY MATRIX

| Priority | Items | Impact |
|----------|-------|--------|
| **P0 — Do First** | DB schema alignment, error boundaries, security headers, test suite, Sentry | Prevents data loss, security breaches, and silent bugs |
| **P1 — Do Next** | Complete PLAN.md Phases 3-12, keyboard shortcuts, loading states | Core experience must work before adding features |
| **P2 — Do Soon** | Capture hero UX, daily ritual, visual polish, mobile excellence | Differentiation and retention |
| **P3 — Do Later** | Intelligence layer, integrations, analytics, social features | Growth and monetization |
| **P4 — Do Eventually** | Monetization, app store, marketing, community | Sustainability |

---

## BENCHMARK: WHAT TOP APPS DO THAT PRESENSE SHOULD LEARN FROM

| Feature | Todoist | Sunsama | Things 3 | Linear | Presense | Gap |
|---------|---------|---------|----------|--------|----------|-----|
| NLP Capture | Yes (AI) | No | No | No | Yes (local) | **Advantage** |
| Daily Ritual | No | Yes | No | No | No | Major gap |
| Keyboard-First | Partial | Partial | Yes | Yes | No | Major gap |
| Calendar View | Yes | Yes | Yes | No | No | Major gap |
| Offline Support | Yes | No | Yes | No | No | Major gap |
| Mobile App | Yes | Yes | Yes (native) | Yes (native) | PWA (incomplete) | Major gap |
| Integrations | 80+ | 10+ | 0 | 20+ | 0 | Major gap |
| Gamification | Karma | No | No | No | No | Gap |
| Weekly Review | No | Yes | No | No | No | Gap |
| Drag-and-Drop | Yes | Yes | Yes | Yes | Partial (dnd-kit installed) | Gap |
| Dark Mode | Yes | Yes | Yes | Yes | Partial (themes exist) | Gap |
| Offline-First | Yes | No | Yes | No | No | Major gap |
| Export Data | Yes | No | Yes | Yes | No | Gap |
| API Access | Yes | No | No | Yes | No | Gap |
| Open Source | No | No | No | No | No | Opportunity |

---

*This document should be treated as the master reference for all improvement work on Presense. Update it as items are completed.*

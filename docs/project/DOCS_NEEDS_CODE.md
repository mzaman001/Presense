# DOCS_NEEDS_CODE — Doc-Identified Issues Requiring Code Fixes

> **Purpose:** This file is the bridge between docs and code. It lists every issue identified during documentation work (the July 9, 2026 audit + this merger pass) that requires a **code change** to resolve. Documentation-only PRs cannot fix these — they need a code PR with `npm run build && npm test` verification per `docs/agents/EXECUTION_RULES.md`.
>
> **How to use:** Before starting any code PR, read this file to avoid duplicating a known issue. Pick one item, implement it, run build + tests, commit with the ticket ID, then mark it done here by moving it to the "Resolved" section at the bottom.
>
> **Cross-references:** Each item links to its ticket in `docs/plans/EXECUTION_SPEC.md` and its impact assessment in the audit (`Presense_Full_Complete_Audit.md`, July 9, 2026). The audit's 8 root patterns are the prioritization framework — see `docs/plans/EXECUTION_SPEC.md` §24.

---

## P0 — Critical (must fix before next release)

### ROOT PATTERN 1 — Silent Data Loss

**BUG-38 — 37 of 71 Supabase mutations don't check `error`** — ✅ **RESOLVED Aug 10, 2026** — full pass landed in commit `660f5a3`; see Resolved section below. Summary: all 27 mutation-bearing files audited; 10 genuinely-unchecked sites fixed (`TaskAddPanel.tsx` `handleAddCategory`, `CalendarView.tsx` reschedule Undo, `RitualOverlay.tsx` ×7, `(app)/layout.tsx` server upsert — server variant checks `error` + `console.error` since no toast is available server-side); final repo-wide sweep confirms zero error-unchecked mutation sites remain. One intentional exception documented: `think/page.tsx` daily-note insert is a conflict-fallback pair (unique-index fetch) that never claims success in UI. The audit's 37/71 count and 10-file offender list were stale — most sites had already been migrated during BUG-34-era incremental work.

**BUG-34 — `dismissInboxItem` data loss (subset of BUG-38)** — ✅ **RESOLVED Aug 10, 2026** — see Resolved section below.

**Inbox routing data loss (subset of BUG-38)** — ✅ **RESOLVED Aug 10, 2026** — see Resolved section below.

### ROOT PATTERN 2 — Warm-Light Theme Broken

**Warm-light theme text overrides missing** — ✅ **RESOLVED Aug 10, 2026 — false positive.** The warm-light block (`globals.css:374-381`) has had dark-warm text overrides (`--text-1: #1A0E00`, etc.) since `e6fd96b4` (July 5, 2026, predating the July 9 audit). Verified live via computed styles across `/`, `/do`, `/inbox`, `/think`. See Resolved section below.

### External audit (Aug 8, 2026) — Critical findings (triage: `EXECUTION_SPEC.md` §29)

**OBS-01 — No production error/performance monitoring is wired up** — ✅ **RESOLVED Aug 12, 2026** (commit `83a95e1`; see Resolved section below)

- **Files:** `src/app/api/telemetry/route.ts:26-33`, `src/lib/logger.ts:1-24`, `package.json`
- **What's wrong:** Three layers look complete but ship nothing durable: `/api/telemetry` Zod-validates then `console.warn`s and returns 204 (data discarded — ephemeral, unalertable serverless log stream); `logger.ts` is Pino with no transport; `package.json` has no `@sentry/*`. There is currently no way to learn something broke in production except a user reporting it. This also leaves the reporting contracts of `AGENTS.md` invariant #1 and BUG-38's `safeMutate()` with no sink.
- **Fix:** Adopt Sentry (`@sentry/nextjs`, per TOOL-06) or Vercel Log Drains + Speed Insights/Web Analytics; forward `/api/telemetry` to it instead of `console.warn`; coordinate logger with TOOL-05; add CSP `report-uri`/`report-to` to `src/proxy.ts` (audit §5) once the sink exists.
- **Priority:** P0 (Critical for release — sequence before any fix whose failure reporting depends on it).
- **Depends on:** TOOL-06 / TOOL-05 coordination.

---

## P1 — High (next 1-2 months, polish + consistency)

### ROOT PATTERN 3 — Mobile Viewport + Form Bugs — ✅ RESOLVED Aug 10, 2026 (all three)

**7 `h-screen` instances → `h-dvh`** — ✅ **RESOLVED** (fixed in commit `8c249b6`, July 7, 2026). Verified Aug 10, 2026: `rg 'h-screen\|100vh' src` = 0 hits; all 6 audit-listed files (`OnboardingBackground.tsx`, `Navigation.tsx`, `not-found.tsx`, `OnboardingWizard.tsx`, `~offline/page.tsx`, `(auth)/login/page.tsx`) use `h-dvh`/`min-h-dvh`.

**BUG-36/39 — Sheet whole-surface drag swallows taps** — ✅ **RESOLVED** (fixed in commit `ad79e81`). Verified: `Sheet.tsx:59-61` has a dedicated drag handle and `dragListener={false}` — the exact fix the audit prescribed. All 7 consumers fixed at once by the shared-component change.

**BUG-41 — Input 13px triggers iOS Safari auto-zoom** — ✅ **RESOLVED**. Verified: `globals.css:1366-1375` ("T5-3: iOS input zoom fix") forces `font-size: max(16px, var(--text-body-lg))` on mobile for `.input`, `.input-title`, `.input-search`; `:1334-1338` covers `textarea`/`select`.

### ROOT PATTERN 4 — Design System Fragmentation

**99 hardcoded hex values → tokenize**

- **Files (top offenders):** `src/components/features/SettingsModal.tsx` (19), `src/components/layout/OnboardingBackground.tsx` (12, BUG-21), `src/app/(app)/remember/people/[id]/page.tsx` (10), `src/app/(app)/think/[id]/page.tsx` (9), `src/components/features/AddPersonPanel.tsx` (7), `src/components/features/CaptureModal.tsx` (5), `src/components/features/PomodoroTimer.tsx` (3 — `#2DD4BF`/`#818CF8` break-phase colors), `src/components/features/calendar/CalendarTaskChip.tsx` (3 — `#ef4444` priority 1)
- **What's wrong:** Each hardcoded hex breaks theme switching — the color doesn't respond to `data-theme`/`data-mode` changes.
- **Fix:** Replace each hex with a `var(--token)` reference. If the needed token doesn't exist, add it to `globals.css` in the same PR and document in `docs/project/DESIGN_SYSTEM.md`. PomodoroTimer break-phase colors → `--status-upcoming`/`--status-someday`. CalendarTaskChip priority → `--status-overdue` or new `--priority-1` token.
- **Priority:** P1 — 1-2 weeks.
- **Depends on:** None.

**DS-30 — 6 different hover magnitudes → standardize on translateY**

- **Files:** `src/components/features/TaskCard.tsx:233` (`whileHover={{y:-2}}` ✓ correct), `src/app/(app)/remember/people/page.tsx:112` (`hover:scale-[1.01]` ✗), `src/app/(app)/think/page.tsx` (`hover:scale-[1.01]` ✗), `src/app/(app)/explore/page.tsx` (`hover:scale-[1.01]` ✗), People list row (`hover:scale-[1.005]` ✗), `src/components/ui/button.tsx` (`hover:-translate-y-[1px]` ✗ different from TaskCard), RitualOverlay close (`hover:scale-110` ✗), SettingsModal theme swatch (`hover:scale-125` ✗)
- **What's wrong:** `hover:scale-*` grows the rendered box past its layout box, which clips visibly inside `overflow-hidden`/`overflow-x-auto` ancestors (GlassCard has `overflow-hidden` in base class). 6 different magnitudes = fragmentation.
- **Fix:** Replace all `hover:scale-*` with `whileHover={{ y: -2 }}` (Framer Motion) or `hover:-translate-y-0.5` (CSS). Use the same lift distance (2px), duration (`--dur-fast`), and easing (`--ease-smooth`) for every hoverable card/row. Gate all hover behind `@media (hover: hover) and (pointer: fine)`.
- **Priority:** P1 — 3-5 days.
- **Depends on:** None.

**44 raw `<input>` elements → migrate to `Input.tsx`**

- **Files:** 15 files with raw `<input>` elements not using the `Input.tsx` component
- **What's wrong:** Bypasses the a11y wiring (`aria-invalid`, `aria-describedby`, label association) that `Input.tsx` provides.
- **Fix:** Migrate all 44 raw `<input>` to `<Input>` component. Coordinate with DS-09 (input primitives with a11y wiring).
- **Priority:** P1 — 1 week.
- **Depends on:** DS-09.

**BUG-43 — Settings native `<select>` + 4 `type="time"`** — ✅ **RESOLVED Aug 10, 2026** (verified: `rg '<select|type="time"' src` = 0 hits — the Auto-Archive `<select>` and all native time inputs are gone; Morning Nudge/Evening Shutdown now use `Dropdown variant="select"` with `TIME_OPTIONS`). Note: `quiet_start`/`quiet_end` survive as unused schema/type fields — CONF-14's column cleanup is still pending (UI collapse is done).

**BUG-25/33 — Explore Type field native `<datalist>`** — ✅ **RESOLVED Aug 10, 2026** (verified: `rg '<datalist'` = 0 hits in src)

**BUG-31 — Dropdown no scroll/type-ahead** — ✅ **RESOLVED Aug 10, 2026** (verified: `Dropdown.tsx:43-121` implements key-buffer type-ahead via `searchBuffer`/`searchTimeout`)

**BUG-32 — Sonner toast theme bound to OS, not app** — ✅ **RESOLVED Aug 10, 2026** (verified: `ToastProvider.tsx` binds `theme` to `data-mode` with a MutationObserver — never `"system"`)

**BUG-29 — Think "New thread" silently fails** — ✅ **RESOLVED Aug 10, 2026** (verified: `think/page.tsx:148-151` shows `toast.error` on insert failure; `color_accent` is real hex `#E5B41E`, not `var(--accent)` — answers EXECUTION_SPEC §17.4 open question)

**BUG-30 — Settings autosave loops forever** — ✅ **RESOLVED Aug 10, 2026** (verified: `SettingsModal.tsx:425-429` — `lastSavedSettingsRef` JSON-snapshot guard skips unchanged saves and only advances on success, plus `useDebounce(settings, 1000)`)

**3 different dashed-border tokens → unify**

- **Files:** Various — `border-[rgba(255,255,255,0.08)]` (Inbox, Think, Explore, Locations), `border-[var(--color-border)]` (Trash, People), `border-[var(--border-default)]` (Trash, People alt)
- **What's wrong:** 3 different tokens for the same dashed border concept.
- **Fix:** Pick one (`--border-default` is the canonical token) and migrate all 3 to use it.
- **Priority:** P1.
- **Depends on:** None.

### ROOT PATTERN 5 — Settings + Schema Bloat

**CONF-14 — Collapse 4 time fields to 2**

- **File:** `src/components/features/SettingsModal.tsx:1026,1039,1303,1323`
- **What's wrong:** 4 `type="time"` inputs (Quiet Start/End + Morning Nudge/Evening Shutdown) for what should be 2 concepts (morning ritual time + evening ritual time). CONF-14 is decided but NOT implemented.
- **Fix:** Collapse to 2 time pickers (morning + evening ritual time), matching `rituals.ts`'s own two-ritual model. Build custom time picker on Dropdown/Popover portal infrastructure (not native `type="time"`).
- **Priority:** P1 — 3-5 days.
- **Depends on:** BUG-31 (share Dropdown fix), BUG-43.

**Density field removal (INFRA-20)**

- **File:** `src/components/features/SettingsModal.tsx` (Density toggle), `user_settings` schema
- **What's wrong:** Density field marked for removal per INFRA-20, still present. Not load-bearing for a personal app.
- **Fix:** Remove Density toggle from SettingsModal. Remove `density` column from `user_settings` (new migration — never edit existing).
- **Priority:** P1.
- **Depends on:** None.

**`ritual_streak` column contradicts CONF-17**

- **Files:** `src/components/features/RitualOverlay.tsx:524,544,555,670,690,701` (writes `ritual_streak`), `supabase/migrations/001_baseline.sql` (column definition)
- **What's wrong:** CONF-17 resolved against gamification, but `RitualOverlay.tsx` actively writes `ritual_streak` — app silently tracks a streak the design says shouldn't exist.
- **Fix:** Remove the 6 code references in `RitualOverlay.tsx` first (stop writing the column). Then add a new migration to drop the column (never edit existing migration).
- **Priority:** P1 — quick win (<1 day for code removal; 1 day for migration).
- **Depends on:** None.

**9 unused notification booleans**

- **File:** `supabase/migrations/001_baseline.sql` (`notifications_enabled`, `notif_72h`, `notif_24h`, `notif_6h`, `notif_1h`, `notif_overdue`, `notif_briefing`, `notif_stale_threads`), `src/components/features/SettingsModal.tsx` (Notifications tab)
- **What's wrong:** 9 notification boolean fields in `user_settings` for a push notification system that doesn't exist. `push_subscriptions` table exists but is unused.
- **Fix:** Decision required: build push notifications (significant feature work) OR remove the 9 booleans + `push_subscriptions` table. If removing: new migration to drop columns + table, remove Notifications tab from SettingsModal.
- **Priority:** P1 — decision + 1-4 weeks.
- **Depends on:** Product decision (ship or remove).

**`ollama_enabled`/`ollama_url` dead plumbing**

- **Files:** `supabase/migrations/001_baseline.sql:140-141`, `src/store/useAppStore.ts`, `src/types/database.types.ts`
- **What's wrong:** Schema + store + types defined but no UI consumes them. Dead plumbing that suggests a feature exists when it doesn't.
- **Fix:** Decision required: ship Ollama integration (local LLM for capture enrichment, thread summarization, semantic search — fits privacy-first identity) OR remove the columns. If removing: new migration to drop columns, remove from store + types.
- **Priority:** P1 — decision + 1-4 weeks.
- **Depends on:** Product decision (ship or remove). Blocks AI features (P2 #43 in audit roadmap).

**4 dead tables**

- **Files:** `push_subscriptions`, `session_logs`, `ritual_logs`, `categories` (all 0 src usages)
- **What's wrong:** 4 tables with 0 usages in src/. `categories` is superseded by `user_settings.do_categories` array.
- **Fix:** Decision required per table: ship the feature that uses it OR drop the table. If dropping: new migration (never edit existing).
- **Priority:** P1.
- **Depends on:** Product decisions (push notifications, weekly review for ritual_logs/session_logs, category management UI).

**2 dead columns**

- **Files:** `confidence_threshold` (0 usages), `pomodoros_completed` (only in generated types, never read/written — replaced by `time_spent_minutes` per `007_time_spent.sql`)
- **Fix:** New migration to drop both columns.
- **Priority:** P1 — quick win.
- **Depends on:** None.

### DS-14 — Reduced motion/transparency — PARTIAL (motion ✅ DONE, transparency still open)

**`prefers-reduced-transparency: reduce` — 0 occurrences** — still open (unchanged)

- **File:** Entire codebase
- **What's wrong:** 0 occurrences of `prefers-reduced-transparency: reduce`. Should swap all `--elev-*-blur` to `blur(0px)` and raise surfaces to opaque colors.
- **Fix:** Add `@media (prefers-reduced-transparency: reduce)` block to `globals.css` that disables all backdrop blur and ambient orb animation, falling back to opaque surface colors.
- **Priority:** P1.
- **Depends on:** None.

**`prefers-reduced-motion: reduce`** — ✅ **RESOLVED Aug 10, 2026** (verified: `globals.css:1131-1146` sets `transform: none !important` for `hover:scale*`/`hover:-translate*`/`active:scale*`/`.glass-card:hover` — hover distance is now removed, not merely zeroed-duration; 0.01ms duration fallbacks remain at `:775`/`:1120`. The audit's "delivers instant movement" claim is stale)

### DS-28 — Per-space colors NOT OKLCH-derived

**`--space-*` are hand-picked warm hex, not OKLCH-derived**

- **File:** `src/app/globals.css` (`--space-do`/`-think`/`-remember`/`-explore` definitions)
- **What's wrong:** Current values (`#E5B41E`/`#EB4233`/`#F4A261`/`#A76011`) are hand-picked warm hex, not derived in OKLCH from each theme's `--accent` hue per DS-28 spec. They're too similar and don't sit naturally in every theme.
- **Fix:** In OKLCH, derive each space's color from the theme's `--accent` hue rotated by a fixed offset, with lightness and chroma held roughly constant. Same offsets in every theme — only base accent hue differs.
- **Priority:** P1 — 1 week.
- **Depends on:** DS-02 (token consolidation).

### BUG-23 — No page-to-page transitions — ✅ RESOLVED Aug 10, 2026

**Missing `template.tsx`** — ✅ **RESOLVED** (verified: `src/app/(app)/template.tsx` exists — the audit's "does not exist" claim was stale; page-to-page transitions render through it). Open sub-item: confirm the transition matches the spec (one shared opacity-only fade, `--dur-base`, no y-axis movement) when next touching it.

### BUG-35/37/40 — Empty-state bugs

**Think + Explore empty states open wrong target**

- **Files:** `src/app/(app)/think/page.tsx:279`, `src/app/(app)/explore/page.tsx:272`
- **What's wrong:** Both call `useAppStore.getState().setCaptureModalOpen(true)` (opens Quick Capture) instead of their own creator. Think should open new-thread composer, Explore should open Save-to-Explore panel.
- **Fix:** Wire Think's empty-state button to `handleNewThread` (once BUG-29 fix lands). Wire Explore's empty-state button to open `ExploreDrawer`.
- **Priority:** P1 — 1-2 days.
- **Depends on:** BUG-29 (Think's fix specifically).

**Locations doesn't use `EmptyState`**

- **File:** `src/app/(app)/remember/locations/page.tsx:126`
- **What's wrong:** Hand-rolls bare `<h3>No locations here</h3>` instead of using the shared `EmptyState` component.
- **Fix:** Migrate to `EmptyState` component, wired to its own "Log item" panel (`LocationAddPanel`).
- **Priority:** P1.
- **Depends on:** None.

**0 first-time-user empty-state variant**

- **File:** `src/components/ui/EmptyState.tsx`
- **What's wrong:** All empty states are the same regardless of whether it's a brand-new user or an existing user who filtered to empty.
- **Fix:** Add a `variant` prop to `EmptyState`: `"first-time"` (richer copy + illustration: "Welcome to [Space] — here's what to do first") vs `"filtered"` ("No matches for '[query]'" with "Clear filters" action) vs `"cleared"` (celebratory: "Inbox Zero — nice work") vs `"default"` (current behavior).
- **Priority:** P1.
- **Depends on:** None.

### BUG-42 — No unsaved-changes warning

**0 `beforeunload`/`isDirty` guards**

- **Files:** `src/components/features/TaskAddPanel.tsx`, `src/components/features/AddPersonPanel.tsx`, `src/components/features/LocationAddPanel.tsx`, any form that can hold meaningful unsaved input
- **What's wrong:** 0 occurrences of `beforeunload` or any unsaved-changes guard. Accidental close loses form data.
- **Fix:** For each form, track dirty/unsaved state (React Hook Form's `formState.isDirty`, already available where RHF is adopted). Prompt before closing the sheet/navigating away if dirty.
- **Priority:** P1 — 1-2 days.
- **Depends on:** None.
- **Status:** ✅ **RESOLVED Aug 10, 2026** — commit `3e555a0` (`fix: BUG-42 unsaved-changes guard`): `useUnsavedGuard` hook (`src/hooks/useUnsavedGuard.ts`) + guards in all 4 Sheet-based forms (TaskAddPanel, AddPersonPanel, LocationAddPanel, ExploreDrawer) covering every close path and `beforeunload`. **Implementation note (read before any future dirty-tracking work):** RHF's destructured `formState.isDirty` only refreshes when the component re-renders (unwatched fields never trigger it), and `setValue()` does not mark dirty unless `shouldDirty: true` is passed — verified by isolated probes during this fix. The panels therefore compare a `watch`-subscribed field-value snapshot against a baseline captured at open (`JSON.stringify` diff at close time) instead of relying on `isDirty`; TaskAddPanel's user-driven `setValue` sites pass `shouldDirty: true`. Beforeunload is registered only while dirty. See `EXECUTION_SPEC.md` BUG-42 for full details and scoped-out items (SettingsModal autosave debounce, CaptureModal, in-app client navigation).

### BUG-44 — No pointer-accessible delete on People/Explore/Think

**Swipe-only delete, or none at all**

- **Files:** `src/app/(app)/remember/people/page.tsx`, `src/app/(app)/explore/page.tsx`, `src/app/(app)/think/page.tsx`
- **What's wrong:** People + Explore have swipe-to-reveal-delete (touch only) — no equivalent for mouse/trackpad/keyboard. Think doesn't even have swipe. Violates DESIGN_SYSTEM §8.5 gesture-parity rule.
- **Fix:** Add a small, hover-revealed (desktop) / always-swipeable (touch) delete icon to every list row across People, Explore, Think. Position at row's trailing edge with enough spacing from other inline actions. Every delete action routes through the same `ConfirmModal` and same `item-lifecycle.ts` soft-delete function.
- **Priority:** P1 — 3-5 days.
- **Depends on:** BUG-08 (shared delete path).

---

## P1 — Onboarding + Empty States (audit gaps #7, #8)

### Onboarding skip + resume + error-checking

**File:** `src/app/onboarding/OnboardingWizard.tsx` (416 lines, 5 steps; all mutations error-checked — BUG-38, Aug 10, 2026)
- **0 skip on steps 1-4** (only step 5 has "Skip tour")
- **0 resume logic** — closed browser = restart from step 1
- **0 progress indicator** (no 5-dots-at-top)
- **0 keyboard navigation** (Enter to advance, Backspace to go back)

**Fix:**
1. Add Skip option on every step (sensible defaults: name="Friend", struggles=[], day shape=9am-10pm).
2. Add Resume logic — persist current step to `localStorage` (`presense_onboarding_step`). On reload, resume from saved step.
3. ~~Fix unchecked mutations~~ — **DONE (BUG-38, Aug 10, 2026)**.
4. Add copy that excites — warmer welcome ("Welcome to your second brain. What should I call you?").
5. Add first-capture delight — animate destination badge (pulse + accent color) to confirm "I understood you."
6. Add progress indicator — 5 dots at top.
7. Add "Why we ask" tooltips for struggles + day shape questions.
8. Add keyboard navigation — Enter to advance, Backspace to go back.
9. Mobile keyboard avoidance — verify `useVisualViewport` is used in OnboardingWizard's text inputs.

**Priority:** P1.
**Depends on:** BUG-38 (error-checking).

---

## P1 — Duplicate cleanup

**Duplicate `useReducedMotion`**

- **Files:** `src/hooks/useReducedMotion.ts` AND `src/lib/animations.ts:21`
- **Fix:** Pick one (recommend `src/hooks/useReducedMotion.ts` as the canonical location since hooks live in `hooks/`). Delete the other. Update all imports.
- **Priority:** P1 — quick win.
- **Depends on:** None.

**Geist font conflicts with Inter**

- **File:** `src/app/layout.tsx:47` (`const geist = Geist({subsets:['latin'],variable:'--font-sans'})`)
- **What's wrong:** Geist and Inter both target `--font-sans` variable. `globals.css:17` `--font-sans: var(--font-sans)` is self-referential and broken. Whichever loads last wins.
- **Fix:** Remove Geist font import from `layout.tsx`. Keep Inter (primary). Consolidate `--font-sans` definition to one source of truth.
- **Priority:** P1 — quick win.
- **Depends on:** None.

**`--text-4` and `--text-decorative` unused tokens**

- **File:** `src/app/globals.css`
- **What's wrong:** 0 usages of `var(--text-4)` or `var(--text-decorative)` — they were problematic per DS-06 and were effectively abandoned.
- **Fix:** Remove both tokens from `globals.css`.
- **Priority:** P1 — quick win.
- **Depends on:** None.

**4 dead scripts**

- **Files:** `scripts/read_data.py` (hardcoded `C:\Users\muhdz\.gemini\antigravity\brain\...` Windows path — leaks dev username), `scripts/refactor.js`, `scripts/refactor.ps1`, `scripts/run_migrations.ps1`
- **What's wrong:** 4 unreferenced scripts in `scripts/`. Mixed Node + Python + PowerShell, no README.
- **Fix:** Delete all 4. (2 scripts ARE referenced and should stay: `clean-threads.js` via `npm run script:clean`, `check_snooze.js` via `npm run script:snooze`.)
- **Priority:** P1 — quick win.
- **Depends on:** None.

**Duplicate root `ARCHITECTURE.md`**

- **File:** `ARCHITECTURE.md` (root) — byte-for-byte duplicate of `docs/project/ARCHITECTURE.md`
- **What's wrong:** AGENTS.md §2 says "exactly one copy of each file." Audit §8.2 #12 says remove. EXECUTION_SPEC §15.3 MD-01 says consolidate.
- **Fix:** `git rm ARCHITECTURE.md` (root). The canonical copy is `docs/project/ARCHITECTURE.md`.
- **Priority:** P1 — quick win.
- **Depends on:** None. (Note: this docs-merger task has already excluded the root copy from deliverables — a code PR needs to execute the actual `git rm` in the real repo.)

---

## P1 — Error boundaries + loading states (ROOT PATTERN 7)

**5 routes missing custom `error.tsx`** — ✅ **RESOLVED Aug 10, 2026** (verified: `error.tsx` exists at `(app)`, `do`, `explore`, `remember`, `think` — 5 files; `inbox`, `trash`, and the `[id]` detail routes inherit from their segment, which is the correct App Router pattern — the audit's "missing" list was counting files the architecture intentionally shares)

**5 routes missing custom `loading.tsx`** — ✅ **RESOLVED Aug 10, 2026** (verified: `loading.tsx` exists at the same 5 segments — `(app)`, `do`, `explore`, `remember`, `think`)

**`ModalErrorBoundary` missing from 5 Sheet-based modals**

- **Files:** `src/components/features/AddPersonPanel.tsx`, `src/components/features/LocationAddPanel.tsx`, `src/components/features/ExploreDrawer.tsx`, `src/components/features/TaskAddPanel.tsx`, `src/components/features/PomodoroTimer.tsx`
- **Fix:** Wrap each in `<ModalErrorBoundary>`. Verify if Sheet-based modals need it (they may, since they render via portal).
- **Priority:** P1.
- **Depends on:** None.

**0 `aria-live` regions**

- **Files:** Various (any component that updates via Realtime)
- **What's wrong:** Realtime changes invisible to screen readers.
- **Fix:** Add `aria-live="polite"` regions for realtime UI changes (e.g., "Task completed" announcements, connection status changes).
- **Priority:** P1 — 1-2 days.
- **Depends on:** None.

**0 skip-to-content link (A11Y-03)** — ✅ **RESOLVED Aug 10, 2026** (verified: `(app)/layout.tsx` renders a skip link as the first focusable element targeting `#main`, with `id="main"` on the content region — the audit's "0 occurrences" was stale)

---

## P1 — Resilience gaps

**0 `onAuthStateChange` handlers**

- **Files:** Entire `src/` (0 occurrences)
- **What's wrong:** Supabase auth events (TOKEN_REFRESHED, SIGNED_OUT) NOT explicitly handled. If refresh fails (revoked session), no redirect to /login.
- **Fix:** Add `supabase.auth.onAuthStateChange((event, session) => {...})` handler in `AppInitializer.tsx` or `RealtimeProvider.tsx`. On `TOKEN_REFRESHED` failure or `SIGNED_OUT`, redirect to `/login`.
- **Priority:** P1.
- **Depends on:** None.

**0 offline mutation queue**

- **Files:** Entire `src/`
- **What's wrong:** Mutations on offline = silent failure (no queue, no retry, no error toast).
- **Fix:** Build an offline mutation queue (localStorage-backed). On `navigator.onLine` going from false → true, replay queued mutations. Show "You're offline — changes will sync when reconnected" banner.
- **Priority:** P1.
- **Depends on:** None.

**0 `navigator.onLine` checks**

- **Files:** Entire `src/`
- **Fix:** Add `navigator.onLine` check in app shell. Show `ConnectionStatus` component prominently when offline for >10s.
- **Priority:** P1.
- **Depends on:** None.

---

## P1 — CI/CD gaps (ROOT PATTERN 8)

**`/api/telemetry` is a black hole** — ✅ **RESOLVED Aug 12, 2026** as OBS-01 (commit `83a95e1`): route forwards `client-error`/`web-vital` to Sentry via `captureMessage`; see OBS-01 entry in the Resolved section below.

- **File:** `src/app/api/telemetry/route.ts:38` (`console.warn("[telemetry]", parsed.data)`)
- **What's wrong:** Errors go to stdout, not a log drain, not an error tracker. In production, invisible.
- **Fix:** Install Sentry (TOOL-06). Wire `/api/telemetry` to forward to Sentry. Or replace with Sentry's own SDK.
- **Priority:** P1 — 1-2 days.
- **Depends on:** TOOL-06.

**`logger.ts` has no transport**

- **File:** `src/lib/logger.ts` (27-line stub)
- **What's wrong:** Uses Pino (good) but `browser: { asObject: true }` only — no transport configured. Browser logs stay in console, server logs go to stdout.
- **Fix:** Configure Pino transport to ship logs to a log drain / aggregator in production. Or evaluate whether Sentry's breadcrumb capture covers the need.
- **Priority:** P1 (TOOL-05).
- **Depends on:** INFRA-01 (coordinate scope).

**Commit messages are GUIDs**

- **File:** Git history (10 of 11 commits have GUID messages)
- **What's wrong:** Violates `docs/agents/EXECUTION_RULES.md` commit format (`fix: T0-X short description`). Can't `git log --grep="BUG-34"` to find a fix.
- **Fix:** Adopt conventional commits going forward (`fix:`/`feat:`/`chore:` + ticket ID + ≤60 chars). Do not rewrite history (no force-push over shared history).
- **Priority:** P1 — policy change, not code.
- **Depends on:** None.

**CI missing: visual regression, a11y scan, Lighthouse, bundle budget, E2E, RLS tests**

- **File:** `.github/workflows/ci.yml`
- **Fix:** Add to CI:
  - Playwright visual regression tests (INFRA-13)
  - axe-core a11y scan
  - Lighthouse CI with thresholds (PERF-GATE)
  - Bundle-size budget (`@next/bundle-analyzer` + threshold check, TOOL-14)
  - E2E user-flow tests (beyond the 2 minimal specs)
  - RLS automated test suite (TOOL-18, two test accounts against dedicated test schema)
- **Priority:** P1.
- **Depends on:** None (each can land independently).

**CI-01 — `eslint.yml` lints nothing and always looks green** — ✅ **RESOLVED Aug 12, 2026** (workflow deleted; `ci.yml`'s `npm run lint` verified as the real gate — see Resolved section below)

- **File:** `.github/workflows/eslint.yml:26-40`
- **What's wrong:** Installs `eslint@8.10.0` fresh each run and lints with `--config .eslintrc.js` — but the repo is ESLint 9 + flat config (`eslint.config.mjs`) and no `.eslintrc.js`/`.eslintrc.json` exists (verified Aug 10, 2026). The step is wrapped in `continue-on-error: true`, so the job always reports success: a second, parallel ESLint "workflow theater" job showing a checkmark in the PR UI while providing zero signal.
- **Fix:** Delete `eslint.yml` — `ci.yml`'s `npm run lint` is the real gate. If SARIF upload is wanted, add `--format @microsoft/eslint-formatter-sarif` to the existing `ci.yml` lint step against the real config.
- **Priority:** P1 — 0.5 days.
- **Depends on:** None.

**CI-02 — `trivy.yml` is unedited template boilerplate, fails before Trivy runs** — ✅ **RESOLVED Aug 12, 2026** (deleted — decision recorded in `EXECUTION_SPEC.md` §29; see Resolved section below)

- **File:** `.github/workflows/trivy.yml:20-23`
- **What's wrong:** `docker build -t docker.io/my-organization/my-app:${{ github.sha }}` is the literal GitHub placeholder and there is no `Dockerfile` anywhere in the repo (Vercel-style Next.js deployment). Every run fails at the `docker build` step.
- **Fix:** Delete it, or repoint to `trivy fs .` (filesystem/dependency + IaC misconfiguration + secret scanning — no Dockerfile needed, complements `osv-scanner.yml`).
- **Priority:** P1 — 0.5 days.
- **Depends on:** None.

**CI-03 — Two unconfigured, redundant static-analysis platforms (SonarCloud + SonarQube)** — ✅ **RESOLVED Aug 12, 2026** (both deleted; Semgrep kept — see Resolved section below)

- **Files:** `.github/workflows/sonarcloud.yml:57-58`, `.github/workflows/sonarqube.yml:38`
- **What's wrong:** `sonar.projectKey` and `sonar.organization`/`sonar.host.url` are blank in both — the jobs fail or silently no-op on every push, and running both platforms is redundant with each other and with `semgrep.yml` (three static-analysis SaaS integrations total; at most one is needed).
- **Fix:** Keep Semgrep's free OSS tier (already has real rules configured), delete the two Sonar workflow files.
- **Priority:** P1 — 0.5 days.
- **Depends on:** None.
- **Follow-up (needs human):** confirm `SEMGREP_APP_TOKEN`/`SEMGREP_DEPLOYMENT_ID` secrets exist in GitHub repo settings.

**CI-04 — `ci.yml` has no `permissions:` block; first-party Actions not SHA-pinned** — ✅ **RESOLVED Aug 12, 2026** (see Resolved section below)

- **Files:** `.github/workflows/ci.yml` (whole file), all `actions/checkout@v4`/`actions/setup-node@v4` references
- **What's wrong:** `ci.yml` is the only workflow without a `permissions:` key (inherits the repo default `GITHUB_TOKEN` scope); `checkout`/`setup-node` use mutable tags while the third-party actions are correctly SHA-pinned. Compromised-upstream-action attacks under existing tags are a live 2025-2026 attack class (e.g. `tj-actions/changed-files`, CVE-2025-30066).
- **Fix:** Add `permissions: contents: read` at the top of `ci.yml` (elevate per-job where needed); pin `checkout`/`setup-node` to full commit SHAs; consider Dependabot `github-actions` updates to keep pins current.
- **Priority:** P1 — 1 day.
- **Depends on:** None.

---

## P1 — Database (ROOT PATTERN 5 + audit §9.3)

**RLS uses `FOR ALL` instead of 4 separate policies**

- **Files:** 12 `FOR ALL` policies across 3 migration files
- **What's wrong:** `FOR ALL` means customizing per-action (allow INSERT but not DELETE) is impossible without rewriting.
- **Fix:** Split each `FOR ALL` policy into 4 separate policies (SELECT/INSERT/UPDATE/DELETE). New migration only — never edit existing.
- **Priority:** P1 — 1 week.
- **Depends on:** None.

**`auth.uid()` not wrapped in `(select ...)`**

- **Files:** 16 bare `auth.uid()` calls in migrations, 0 wrapped
- **What's wrong:** Postgres can't cache the function call, re-evaluates per row. Performance issue at scale.
- **Fix:** Wrap all `auth.uid()` calls in `(select auth.uid())` in new migration. Or wait for Supabase to fix at the platform level.
- **Priority:** P1 — 1-2 days.
- **Depends on:** None.

---

## P1 — External audit (Aug 8, 2026) triage: PWA, Edge Functions, build config (tickets in `EXECUTION_SPEC.md` §29)

**PWA2-01 — Maskable icon reuses the "any"-purpose asset; manifest fields missing** — OPEN (ticket `PWA2-01`)

- **File:** `public/manifest.json:9-13`
- **What's wrong:** The same `icon-192.png`/`icon-512.png` are declared with both `"purpose": "any"` and `"purpose": "maskable"` — Android adaptive-icon launchers crop full-bleed art (subject must sit in the center ~80% safe zone). Manifest also missing `screenshots`, `shortcuts`, `id`, `categories`, `scope`.
- **Fix:** Generate safe-zone-padded maskable icons at 192/512 (verify with `maskable.app`), keep existing icons as `any`-only, add `screenshots` (one wide + one narrow `form_factor`), `shortcuts` (e.g. "Quick Capture"), `id`, and `scope: "/"`.
- **Priority:** P1 — 1 day.
- **Depends on:** None.

**INFRA-23 — Edge Functions: deprecated imports + cron check-then-insert race** — OPEN (ticket `INFRA-23`)

- **Files:** `supabase/functions/cron_cleanup/index.ts:1-2`, `supabase/functions/cron_recurrence/index.ts:1-2, 96-116`
- **What's wrong:** Both import `serve` from `deno.land/std@0.192.0/http/server.ts` (std is maintenance-mode, deprecated in favor of JSR) and the Supabase client from `esm.sh` (known resolution issues for `@supabase/supabase-js`). `cron_recurrence` does check-then-insert (`maybeSingle()` then insert) with no unique constraint or advisory lock — overlapping invocations (retry, manual trigger) can duplicate a recurring task.
- **Fix:** Use built-in `Deno.serve` + `npm:@supabase/supabase-js@2`; add a partial unique index on `(user_id, title, recurrence) WHERE status = 'active'` in a new migration and treat insert conflict as success instead of the preceding `select`.
- **Priority:** P1 — 1-2 days.
- **Depends on:** None.

**SEC2-02 — Verify Supabase Dashboard security settings against intent before launch** — OPEN (ticket `SEC2-02`, verify-before-launch)

- **File:** `supabase/config.toml` (local CLI config; hosted Dashboard settings must be checked separately)
- **What's wrong / verify:** `minimum_password_length = 6` with no complexity rules (2026 guidance favors an 8-12 length floor + leaked-password checking); `[auth.captcha]` commented out (no bot protection on public signup); `enable_confirmations = false` (email ownership never verified — may be intentional, must be stated). Plus audit §4 rows: Supavisor/transaction-mode pooling, PITR/backup RPO, and Edge Function invocation auth (`verify_jwt = true` default — confirm cron triggers send a valid Authorization header, or cleanup/recurrence silently 401 forever; tie the "did the cron run" smoke check into OBS-01).
- **Fix:** 15-minute Security Advisor + Auth → Settings pass; record an explicit, dated decision for every item.
- **Priority:** P1 — before public launch.
- **Depends on:** None.

**PERF-13 — `removeConsole` strips `console.error` in production too** — OPEN (ticket `PERF-13`)

- **File:** `next.config.ts:31` — `removeConsole: process.env.NODE_ENV === "production"`
- **What's wrong:** Boolean `removeConsole` strips every `console.*` call from client bundles in production, including `console.error` — combined with OBS-01, production client errors have no trace anywhere.
- **Fix:** Change to `removeConsole: { exclude: ["error"] }`; largely moot once OBS-01 lands.
- **Priority:** P1 — 0.25 days.
- **Depends on:** None.

---

## Resolved (move items here as code PRs land)

### ROOT PATTERN 2 — Warm-light theme "broken" (Aug 10, 2026) — false positive, closed

- **Claim (audit July 9):** `globals.css:336-420` overrides `--bg-base` to cream without overriding `--text-*` → white text on cream.
- **Reality:** the warm-light block's TEXT SYSTEM (`globals.css:374-381`: `--text-1: #1A0E00` dark warm brown, `--text-2/3/muted/decorative` alpha variants, `--text-on-accent: #FFFFFF`) has existed since commit `e6fd96b4` (July 5, 2026 — before the audit; `git blame`-verified).
- **Verification (Aug 10, 2026):** live computed styles on `/`, `/do`, `/inbox`, `/think` with `data-theme=warm` + `data-mode=light` all resolve `--text-1` to `#1a0e00` on `--bg-base: #fbf6ee`. Screenshot: `%TEMP%\opencode\warm-light-check.png`.
- **Action taken:** docs corrected (CONTEXT.md matrix + §ROOT PATTERN 2, EXECUTION_SPEC §24.1/§24.2, AGENTS.md §4.2). No code change required.

### BUG-34 — Inbox dismiss error swallowing + inbox routing data loss (both subsets of BUG-38) — Aug 10, 2026
- **Root cause (found by live reproduction, per the ticket's requirement 3):** the real defect was not in the error handling alone — **migration `005_fix_constraints_and_security.sql` had never been applied to the live Supabase project**, so `items_status_check` rejected `'deleted'` (HTTP 400, code 23514) and every trash write silently failed. UI showed "Dismissed" because of the optimistic cache removal.
- **DB fix:** all 8 statements of migration 005 applied to production (Aug 10, 2026, human-approved) via session-pooler `supabase db query --db-url`. `people`/`locations` constraints were already correct.
- **Verified end-to-end:** previously-failing PATCH → 204; live UI dismiss → toast "Dismissed", row `status=deleted`, item present on `/trash` (Playwright). Full suite 144/144.
- **Follow-up recommended (not ticketed):** run production migrations via `supabase db push` or reconcile `supabase_migrations.schema_migrations` after manual application so drift cannot recur.

### BUG-38 — Unchecked Supabase mutations, full pass (Aug 10, 2026)
- **What was actually left to fix:** the July 9 audit's "37 of 71" count and 10-file offender list were stale — incremental BUG-34-era work had already migrated most sites. A line-by-line audit of all 27 mutation-bearing files found exactly **10 genuinely-unchecked sites**, fixed in commit `660f5a3`:
  - `TaskAddPanel.tsx` `handleAddCategory` — `user_settings` update (optimistic category list was committed to state before the DB result was known; now rolls back on failure via `safeMutate`)
  - `CalendarView.tsx` reschedule Undo — items update (now reverts optimistic deadline on failure)
  - `RitualOverlay.tsx` ×7 — triage Undo, estimate change, carry-over Undo, evening reflection insert + update, morning + evening skip (all `safeMutate`; the two try/catch sites were replaced since `try/catch` cannot catch Supabase's normal-resolution `{error}`)
  - `(app)/layout.tsx` server component onboarding auto-complete upsert — checks `error` + `console.error` (server-side; no toast available, so `safeMutate` is not applicable)
- **One intentional exception (reviewed, kept):** `think/page.tsx` daily-note insert stays fire-and-forget because it is a conflict-fallback pair — on any failure it fetches the existing thread via the unique-index `(user_id, title)`; it never claims success (navigates only on a truthy insert result).
- **Verification:** repo-wide sweep `rg '\.(insert|update|delete|upsert|rpc)\(' src` → exactly the 27 audited files, none with an error-unchecked mutation; `npm run build` ✓, tests 144/144 ✓. Related: 8 pre-existing `no-explicit-any` errors in `TaskAddPanel.tsx` (chronoCache, people-list cast, chrono callback params, `Record<string, unknown>` payload) were fixed in the same commit because the lint-staged hook blocks commits touching that file.

### SEC2-01 — Account-deletion rate limit not enforced (Aug 10, 2026)

- **Fix (commit `e895df8`):** `rate-limit.ts` now uses a bucket registry — `checkRateLimit(bucket, key, maxRequests, windowMs)` constructs one `Ratelimit` per endpoint with its own `slidingWindow(maxRequests, windowMs)` and `prefix: "rl:<bucket>"`. Call sites: `account` (3/60 s), `capture` (100/60 s), `people-reorder` (30/60 s). The previous singleton hardcoded 100/min + `rl:capture` for everyone, so account deletion shared capture's limit.
- **Verified:** `rate-limit.test.ts` (7 tests) — 4th account-delete request within a minute rejected; capture counter unaffected by account traffic; window expiry re-allows; fail-closed in production retained; Redis-backed path proven via constructor assertions (per-bucket `slidingWindow(3, "60 s")`, `prefix "rl:account"`, one instance per bucket). Full suite 173/173, build green, lint 0.

### OBS-01 — No production error/performance monitoring (Aug 12, 2026)

- **Fix (commit `83a95e1`):** Sentry (`@sentry/nextjs@10.70.0`) wired end-to-end, DSN-gated. Client init in `src/instrumentation-client.ts` (Next 16 auto-loads it — it was a **live** pipeline to the discarding telemetry route, so it was repurposed, not deleted; manual error listeners removed — the browser SDK auto-captures `window error`/`unhandledrejection`), plus `sentry.server.config.ts` / `sentry.edge.config.ts`; `withSentryConfig(analyze(withSerwist(nextConfig)))`; `NEXT_PUBLIC_SENTRY_DSN` in `env.ts` (`.catch()` pattern) + `.env.example`. `/api/telemetry` forwards (`client-error` → `captureMessage` error level; `web-vital` → info; Zod/400/204 kept). Explicit `Sentry.captureException` in the `account`/`capture`/`people/reorder` catch blocks. CSP `report-uri` derived from the DSN in `src/proxy.ts` (EU ingest host preserved; byte-identical without DSN).
- **Verified:** `telemetry-route.test.ts` 5 tests (both kinds + invalid payload/JSON), `middleware.test.ts` 12 tests (EU/US DSN → security endpoint; absent + present end-to-end), full suite 181/181 sequential, build green ×2, lint-staged 0. Follow-ups: source-map uploads (`SENTRY_AUTH_TOKEN`), account `deleteUser` error-branch capture candidate, sampling/replay tuning after first production week.

### CI-01 — `eslint.yml` workflow theater (Aug 12, 2026)

- **Fix:** `.github/workflows/eslint.yml` deleted — it installed `eslint@8.10.0` fresh each run, lints with `--config .eslintrc.js` (doesn't exist; repo is ESLint 9 + flat `eslint.config.mjs`), wrapped in `continue-on-error: true` (always green, fake checkmark in PR UI).
- **Verified:** `ci.yml` step "Lint" (`npm run lint`) confirmed as the real gate; `rg -l "\.eslintrc"` (excluding `docs/`) → 0 hits; workflow directory now 6 files. SARIF upload decision recorded: not added — `semgrep.yml` + `osv-scanner.yml` already feed the GitHub Security tab.

### CI-02 — `trivy.yml` template boilerplate (Aug 12, 2026)

- **Fix (decision: delete, recorded in `EXECUTION_SPEC.md` §29):** `.github/workflows/trivy.yml` removed. The `docker build` step against a nonexistent `Dockerfile` could never succeed; `trivy fs .` would duplicate `osv-scanner.yml`'s dependency-CVE coverage with its remaining value (secrets, IaC misconfig) already provided by `semgrep.yml` + GitHub native secret scanning; no IaC exists in this repo to scan.
- **Verified:** workflow directory now 5 files (ci, osv-scanner, semgrep, sonarcloud, sonarqube).

### CI-03 — Redundant SonarCloud + SonarQube workflows (Aug 12, 2026)

- **Fix:** `sonarcloud.yml` + `sonarqube.yml` deleted (both had blank `-Dsonar.projectKey=`/`-Dsonar.organization=` — fail/no-op on every push); `semgrep.yml` kept as the single static-analysis platform per the ticket.
- **Verified:** exactly one static-analysis workflow remains; workflow directory now 3 files (ci, osv-scanner, semgrep). Follow-up recorded: human must confirm `SEMGREP_APP_TOKEN`/`SEMGREP_DEPLOYMENT_ID` secrets are set, or decide semgrep's fallback mode.

### CI-04 — CI hardening: permissions + SHA pins (Aug 12, 2026)

- **Fix:** `ci.yml` gained `permissions: contents: read` (no per-job elevation needed); `actions/checkout` → `11d5960a…` and `actions/setup-node` → `49933ea5…` (resolved from official `v4` tags via GitHub API) in `ci.yml` + `semgrep.yml`; `osv-scanner.yml` already compliant.
- **Verified:** `rg "@v[0-9]" .github/workflows` → 0 hits. Dependabot `github-actions` not added — decision: solo repo, manual pin refresh at upgrade time.

---

## Cross-references

- **Audit:** `Presense_Full_Complete_Audit.md` (July 9, 2026, 2135 lines, 14-step audit by GLM-4.6) — the source of truth for what's broken.
- **Ticket backlog:** `docs/plans/EXECUTION_SPEC.md` (1755 lines, 25 sections) — the full ticket history with 23 addenda tracking every known bug, ticket, and conflict resolution. §24 is the audit cross-reference with 8 root patterns and 10 quick wins.
- **Design spec:** `docs/project/DESIGN_SYSTEM.md` — the visual spec (color, type, glass, motion, surfaces). Cross-refs this file for specs that are written but NOT YET implemented (DS-28, DS-29, DS-30, DS-14-transparency) or DONE since the July 9 audit (DS-14-motion, BUG-23, BUG-25/33, BUG-43, CONF-14-UI).
- **Component dictionary:** `docs/project/COMPONENT_MANIFEST.md` — the approved UI primitives list. Cross-refs this file for component-level bugs (DS-30, BUG-36/39, BUG-41 — those three remain open; BUG-31, BUG-43, BUG-25/33, BUG-32, BUG-30, BUG-29 — all RESOLVED Aug 10, 2026, see above).
- **Agent contract:** `docs/agents/EXECUTION_RULES.md` — the 7 iron laws, STOP LIST. STOP LIST item 11 (new unchecked Supabase mutations) and the anti-pattern row ("I'll skip the `error` check") both reference this file.
- **Entry point:** `AGENTS.md` — §1 invariant 7 (every Supabase mutation must check `error`) and §4 (known critical bugs) both reference this file.

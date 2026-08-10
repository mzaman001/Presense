# DOCS_NEEDS_CODE — Doc-Identified Issues Requiring Code Fixes

> **Purpose:** This file is the bridge between docs and code. It lists every issue identified during documentation work (the July 9, 2026 audit + this merger pass) that requires a **code change** to resolve. Documentation-only PRs cannot fix these — they need a code PR with `npm run build && npm test` verification per `docs/agents/EXECUTION_RULES.md`.
>
> **How to use:** Before starting any code PR, read this file to avoid duplicating a known issue. Pick one item, implement it, run build + tests, commit with the ticket ID, then mark it done here by moving it to the "Resolved" section at the bottom.
>
> **Cross-references:** Each item links to its ticket in `docs/plans/EXECUTION_SPEC.md` and its impact assessment in the audit (`Presense_Full_Complete_Audit.md`, July 9, 2026). The audit's 8 root patterns are the prioritization framework — see `docs/plans/EXECUTION_SPEC.md` §24.

---

## P0 — Critical (must fix before next release)

### ROOT PATTERN 1 — Silent Data Loss

**BUG-38 — 37 of 71 Supabase mutations don't check `error`**

- **Files:** `src/app/onboarding/OnboardingWizard.tsx` (11 unchecked at lines 79, 102, 128, 157, 167, 169, 176, 183, 189, 213, +1), `src/app/(app)/think/[id]/page.tsx`, `src/app/(app)/explore/[id]/page.tsx`, `src/app/(app)/explore/page.tsx`, `src/app/(app)/remember/people/[id]/page.tsx`, `src/app/(app)/do/page.tsx`, `src/app/(app)/page.tsx` (Home, 6 mutations), `src/components/features/PomodoroTimer.tsx`, `src/components/features/TaskAddPanel.tsx`, `src/components/features/CaptureModal.tsx`. (`src/app/(app)/inbox/page.tsx` no longer violates — all 4 of its unchecked mutations were fixed as BUG-34, Aug 10, 2026; see Resolved section.)
- **What's wrong:** Supabase-js resolves normally with `{data: null, error: {...}}` on DB errors — does NOT throw. `try/catch` only catches network/JS errors. 37 of 71 mutations don't destructure/check `error`, so the UI shows success (optimistic update + `toast.success`) while the DB write silently failed. A brand-new user's very first onboarding experience could silently fail at any step.
- **Fix:** Build a `mutate()` wrapper in `src/lib/supabase.ts` that checks `error`, reports to error tracker (`/api/telemetry` → Sentry once TOOL-06 lands), shows `toast.error` with real message, returns `{success, data, error}`. Migrate all 37 unchecked call sites to use it. Do NOT hand-add `if (error)` checks 37 times with 37 different toast messages — use the wrapper.
- **Priority:** P0 — single highest-value fix per audit final verdict.
- **Depends on:** None. Can start immediately.
- **Acceptance criteria:** Every Supabase mutation in the app either succeeds visibly or fails visibly — there is no third state (silently do neither). `OnboardingWizard.tsx` specifically is tested end-to-end with a deliberately-broken write to confirm the wizard now surfaces the failure.

**BUG-34 — `dismissInboxItem` data loss (subset of BUG-38)** — ✅ **RESOLVED Aug 10, 2026** — see Resolved section below.

**Inbox routing data loss (subset of BUG-38)** — ✅ **RESOLVED Aug 10, 2026** — see Resolved section below.

### ROOT PATTERN 2 — Warm-Light Theme Broken

**Warm-light theme text overrides missing** — ✅ **RESOLVED Aug 10, 2026 — false positive.** The warm-light block (`globals.css:374-381`) has had dark-warm text overrides (`--text-1: #1A0E00`, etc.) since `e6fd96b4` (July 5, 2026, predating the July 9 audit). Verified live via computed styles across `/`, `/do`, `/inbox`, `/think`. See Resolved section below.

---

## P1 — High (next 1-2 months, polish + consistency)

### ROOT PATTERN 3 — Mobile Viewport + Form Bugs

**7 `h-screen` instances → `h-dvh`**

- **Files:** `src/components/layout/OnboardingBackground.tsx:145,166`, `src/components/layout/Navigation.tsx:72`, `src/app/not-found.tsx:5`, `src/app/onboarding/OnboardingWizard.tsx:235`, `src/app/~offline/page.tsx:7`, `src/app/(auth)/login/page.tsx:61`
- **What's wrong:** `h-screen` (= `100vh`) includes mobile browser chrome space, causing layout jumps when URL bar shows/hides on scroll.
- **Fix:** Replace all 7 `h-screen` with `h-dvh` (dynamic viewport height). For full-height containers that must never be covered, use `h-svh` (smallest viewport height).
- **Priority:** P1 — quick win (<1 day).
- **Depends on:** None.

**BUG-36/39 — Sheet whole-surface drag swallows taps**

- **File:** `src/components/ui/Sheet.tsx:58`
- **What's wrong:** `drag="y"` on whole sheet surface with no `dragListener={false}` or dedicated handle. Framer Motion's drag recognizer competes with nested button taps. Affects 7 consumers: ConfirmModal, AddPersonPanel, SearchModal, TaskAddPanel, CaptureModal, ExploreDrawer, LocationAddPanel.
- **Fix:** Add a dedicated drag handle element at the top of the Sheet. Set `dragListener={false}` on the `m.div` and pass `dragControls` from the handle. Or evaluate Vaul (TOOL-10) as a replacement.
- **Priority:** P1.
- **Depends on:** None. Fix in `Sheet.tsx` once fixes all 7 consumers.

**BUG-41 — Input 13px triggers iOS Safari auto-zoom**

- **File:** `src/components/ui/Input.tsx` (uses `.input` CSS class which inherits `--text-body: 13px`)
- **What's wrong:** iOS Safari auto-zooms on inputs <16px on focus. Every default text input in the app is below that threshold.
- **Fix:** Add to `globals.css`:
  ```css
  @media (max-width: 768px) {
    .input { font-size: 16px !important; }
  }
  ```
  Or set input text specifically to 16px on mobile viewports, distinct from surrounding UI's 13px body text.
- **Priority:** P1 — quick win (<1 day).
- **Depends on:** None.

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

**BUG-43 — Settings native `<select>` + 4 `type="time"`**

- **File:** `src/components/features/SettingsModal.tsx:1417` (`<select>` for Auto-Archive Completed), `:1026,1039,1303,1323` (`type="time"` for Quiet Start/End + Morning Nudge/Evening Shutdown)
- **What's wrong:** Native `<select>` and `type="time"` render browser-controlled UI that cannot be restyled to match the app's design system.
- **Fix:** Migrate `<select>` to `<Dropdown variant="select">`. Once CONF-14 collapses the 4 time fields to 2 (morning + evening ritual time), build a custom time picker on the `Dropdown`/`Popover` portal infrastructure.
- **Priority:** P1 — 1 week.
- **Depends on:** BUG-31 (share Dropdown fix), CONF-14 (for time fields' final count).

**BUG-25/33 — Explore Type field native `<datalist>`**

- **File:** `src/components/features/ExploreDrawer.tsx:258`
- **What's wrong:** Native `<input>` + `<datalist>` renders browser-controlled autocomplete UI.
- **Fix:** Replace with `<Dropdown variant="select">` supporting both preset selection and custom entry.
- **Priority:** P1.
- **Depends on:** DS-04 (use consolidated dropdown primitive).

**BUG-31 — Dropdown no scroll/type-ahead**

- **File:** `src/components/ui/Dropdown.tsx` (the `dropdown-panel` `m.div` in both `chip` and `select` variant render paths)
- **What's wrong:** Floating options panel has no `max-height` + no `overflow-y-auto`. For Timezone field (`Intl.supportedValuesOf("timeZone")` = hundreds of entries), panel grows to full list height. No `onKeyDown` handler → no type-ahead.
- **Fix:** Add `max-height: min(320px, 60vh)` + `overflow-y-auto` + `overscroll-contain` to the `dropdown-panel` class for the `select` variant. Add `onKeyDown` handler for type-ahead (jump-to-option on key press). Do not remove the portal/positioning behavior.
- **Priority:** P1 — 1-2 days.
- **Depends on:** None.

**BUG-32 — Sonner toast theme bound to OS, not app**

- **File:** `src/components/ui/ToastProvider.tsx`
- **What's wrong:** `<Toaster theme="system" ...>` binds Sonner's internal color scheme to OS-level `prefers-color-scheme`, independent of app's manual `data-mode` toggle. OS=dark + app=light = light toast on dark text = unreadable.
- **Fix:** Bind Sonner's `theme` prop to app's actual current color mode (read from the same store/`data-mode` attribute that `AppInitializer`/`theme.ts` manage), not the string literal `"system"`.
- **Priority:** P1 — quick win (<1 day).
- **Depends on:** None.

**BUG-29 — Think "New thread" silently fails**

- **File:** `src/app/(app)/think/page.tsx:126` (handleNewThread)
- **What's wrong:** Inserts a new row into `threads` with `color_accent: "var(--accent)"` — a literal CSS variable reference string written into a data column, not an actual color value. The `if (!error && data)` pattern swallows the error; clicking "New thread" sometimes does nothing.
- **Fix:** Stop writing a CSS variable string as a data value. Either assign an actual resolved color, or don't store a per-thread accent color at all if nothing currently reads it distinctly per-thread (check for dead-column risk). Add `toast.error` treatment on failure.
- **Priority:** P1 — quick win (<1 day).
- **Depends on:** None.

**BUG-30 — Settings autosave loops forever**

- **File:** `src/components/features/SettingsModal.tsx:357-433` (the `watch()`/`useDebounce`/save `useEffect` chain)
- **What's wrong:** Autosave effect is keyed on `debouncedSettings`, derived from `const settings = watch()` — an unscoped, whole-form `watch()` call. React Hook Form's `watch()` returns a new object reference on every render → effect fires repeatedly. Shows "Saving…"/"Saved" forever, including on simply opening Settings with no edits.
- **Fix:** Gate the save effect on an actual-change signal. Use `formState.isDirty` / `dirtyFields`, or deep-compare `debouncedSettings` against the last-successfully-saved snapshot before calling the update.
- **Priority:** P1 — 1-2 days.
- **Depends on:** None.

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

### DS-14 — Reduced motion/transparency NOT implemented

**`prefers-reduced-transparency: reduce` — 0 occurrences**

- **File:** Entire codebase
- **What's wrong:** 0 occurrences of `prefers-reduced-transparency: reduce`. Should swap all `--elev-*-blur` to `blur(0px)` and raise surfaces to opaque colors.
- **Fix:** Add `@media (prefers-reduced-transparency: reduce)` block to `globals.css` that disables all backdrop blur and ambient orb animation, falling back to opaque surface colors.
- **Priority:** P1.
- **Depends on:** None.

**`prefers-reduced-motion: reduce` — only zeroes duration**

- **File:** `src/app/globals.css:775, 1120, 1149-1168`
- **What's wrong:** Only sets `transition-duration: 0.01ms !important` — does NOT remove the `transform` value. A `hover:scale-[1.01]` still scales instantly instead of not scaling. Setting promises "no movement" but delivers "instant movement."
- **Fix:** Remove transform/distance for every hover/interactive animation when reduced-motion is set. For each `:hover` rule with a transform, add a `prefers-reduced-motion: reduce` override that sets `transform: none`.
- **Priority:** P1.
- **Depends on:** None.

### DS-28 — Per-space colors NOT OKLCH-derived

**`--space-*` are hand-picked warm hex, not OKLCH-derived**

- **File:** `src/app/globals.css` (`--space-do`/`-think`/`-remember`/`-explore` definitions)
- **What's wrong:** Current values (`#E5B41E`/`#EB4233`/`#F4A261`/`#A76011`) are hand-picked warm hex, not derived in OKLCH from each theme's `--accent` hue per DS-28 spec. They're too similar and don't sit naturally in every theme.
- **Fix:** In OKLCH, derive each space's color from the theme's `--accent` hue rotated by a fixed offset, with lightness and chroma held roughly constant. Same offsets in every theme — only base accent hue differs.
- **Priority:** P1 — 1 week.
- **Depends on:** DS-02 (token consolidation).

### BUG-23 — No page-to-page transitions

**Missing `template.tsx`**

- **File:** `src/app/(app)/template.tsx` (does not exist)
- **What's wrong:** No page-to-page transition; hard cut feels janky.
- **Fix:** Create `src/app/(app)/template.tsx` with one shared opacity-only fade (`--dur-base`, no y-axis movement) applied uniformly via a single shared transition wrapper for the `(app)` route group.
- **Priority:** P1 — quick win (<1 day).
- **Depends on:** None.

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

**File:** `src/app/onboarding/OnboardingWizard.tsx` (416 lines, 5 steps, 11 unchecked mutations)
- **0 skip on steps 1-4** (only step 5 has "Skip tour")
- **0 resume logic** — closed browser = restart from step 1
- **0 progress indicator** (no 5-dots-at-top)
- **0 keyboard navigation** (Enter to advance, Backspace to go back)

**Fix:**
1. Add Skip option on every step (sensible defaults: name="Friend", struggles=[], day shape=9am-10pm).
2. Add Resume logic — persist current step to `localStorage` (`presense_onboarding_step`). On reload, resume from saved step.
3. Fix 11 unchecked mutations (see BUG-38 above).
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

**5 routes missing custom `error.tsx`**

- **Files:** `src/app/(app)/inbox/error.tsx` (missing), `src/app/(app)/trash/error.tsx` (missing), `src/app/(app)/remember/people/[id]/error.tsx` (missing), `src/app/(app)/think/[id]/error.tsx` (missing), `src/app/(app)/explore/[id]/error.tsx` (missing)
- **Fix:** Add `error.tsx` to each route, using `AppErrorFallback` component (same pattern as existing `error.tsx` files in `do`/`explore`/`think`/`remember`).
- **Priority:** P1.
- **Depends on:** None.

**5 routes missing custom `loading.tsx`**

- **Files:** Same 5 routes as above (missing `loading.tsx`)
- **Fix:** Add `loading.tsx` to each route, using `Skeleton` component matching the content shape.
- **Priority:** P1.
- **Depends on:** None.

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

**0 skip-to-content link (A11Y-03)**

- **File:** `src/app/(app)/layout.tsx` or `src/app/layout.tsx`
- **Fix:** Add a skip-to-content link as the first focusable element: `<a href="#main" className="sr-only focus:not-sr-only ...">Skip to content</a>`. Add `id="main"` to the main content region.
- **Priority:** P1 — quick win (<1 day).
- **Depends on:** None.

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

**`/api/telemetry` is a black hole**

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

---

## Cross-references

- **Audit:** `Presense_Full_Complete_Audit.md` (July 9, 2026, 2135 lines, 14-step audit by GLM-4.6) — the source of truth for what's broken.
- **Ticket backlog:** `docs/plans/EXECUTION_SPEC.md` (1755 lines, 25 sections) — the full ticket history with 23 addenda tracking every known bug, ticket, and conflict resolution. §24 is the audit cross-reference with 8 root patterns and 10 quick wins.
- **Design spec:** `docs/project/DESIGN_SYSTEM.md` — the visual spec (color, type, glass, motion, surfaces). Cross-refs this file for specs that are written but NOT YET implemented (DS-14, DS-28, DS-29, DS-30, BUG-23, BUG-25/33, BUG-43, CONF-14).
- **Component dictionary:** `docs/project/COMPONENT_MANIFEST.md` — the approved UI primitives list. Cross-refs this file for component-level bugs (DS-30, BUG-31, BUG-36/39, BUG-41, BUG-43, BUG-25/33, BUG-32, BUG-30, BUG-29).
- **Agent contract:** `docs/agents/EXECUTION_RULES.md` — the 7 iron laws, STOP LIST. STOP LIST item 11 (new unchecked Supabase mutations) and the anti-pattern row ("I'll skip the `error` check") both reference this file.
- **Entry point:** `AGENTS.md` — §1 invariant 7 (every Supabase mutation must check `error`) and §4 (known critical bugs) both reference this file.

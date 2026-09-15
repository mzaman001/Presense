# UX Quality Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task, phase-by-phase. Do not start Phase 2 or 3 until Phase 1 is merged. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the full set of UX/quality complaints raised directly by the user across the sidebar, Home, Do (task cards + add panel + Focus screen), Think, Settings, the shared Dropdown component, mobile responsiveness, and first-load performance. This plan does NOT touch Explore/People (already removed) and does not revisit already-shipped Locations/Remember work.

**Origin:** the user reviewed screenshots of the live app and gave 16 numbered complaints in one message, then asked for a self-directed plan covering all of them. This plan is that response. Every numbered complaint below maps to at least one concrete task; none are dropped silently.

**Tech Stack:** Next.js 16.3 / React 19 / TypeScript / Tailwind v4 / Framer Motion / @floating-ui/react / Zustand / TanStack Query

**Spec:** No existing spec covers this — this plan is grounded directly in codebase investigation (four parallel research passes, cited inline per task) rather than a prior design doc. Where a design *decision* is needed (not just a bug fix), this plan states a recommended default and flags it as a decision point rather than silently picking one.

---

## Before any of this: rule out a false alarm

The screenshots that triggered this plan show "Explore" still in the sidebar and a working "People" tab in Remember — both of which were removed and independently re-verified three times in the prior session (task review, final whole-branch review, scoped re-review), and confirmed against a fresh `npm run dev` immediately before handoff. This strongly suggests the screenshots came from a **stale dev server process** that was running before the merge landed — Next.js does not reliably hot-reload a deleted route tree. Before starting Phase 1, confirm:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

...and hard-refresh. If Explore/People are *still* present after a clean restart, that is a real regression and takes priority over everything below — stop and investigate that first, don't proceed into this plan on top of a broken merge.

---

## Global Constraints

- **Don't re-litigate already-correct patterns.** `Sheet.tsx` (used by `TaskAddPanel`/`CaptureModal`) already does mobile-bottom-sheet / desktop-centered-dialog correctly — the target is `SettingsModal.tsx`'s divergent, duplicate implementation of the same idea, not `Sheet` itself.
- **Reuse the existing color-picker/dropdown patterns instead of adding a third.** The codebase already has two independent hand-rolled small-color-picker implementations (`think/[id]/page.tsx`'s thread-color popover, `SettingsModal.tsx`'s `CategoryItem` swatches) and one floating-ui-based `Dropdown`. Phase 2/3 work that touches color pickers should consolidate toward one shared component, not add a third variant.
- **Every task must leave `npx tsc --noEmit` clean, `npm run lint` at 0 errors, and `npm test` green.** Same three known-flaky suites as always (`challenger.test.tsx`, `login/actions.test.ts`, `account-route.test.ts`) — verify any failure there in isolation before treating as non-blocking.
- **Don't cite the old performance numbers.** CLAUDE.md's "~1.1MB /login bundle" and "LCP 6.4s" figures are stale — git history shows the login bundle was already reworked down to 287.3 KiB gz (commits `d120480`, `173f0a1`, 2026-09-14) and Sentry tracing was already stripped (`943c73f`, ~115 KiB gz saved). Re-measure before writing any new number into a commit message or this plan's own tasks — see Phase 4.
- **Design decisions this plan makes explicitly** (flag if you'd rather decide differently before Phase 2/3 execution starts):
  - Daily Note threads get a small visual distinguisher (a date-banner treatment) vs. topic threads in Think — not currently true, per investigation.
  - Settings' save-status indicator moves inline/near the edited field instead of only living in the sidebar footer.
  - Category color-swatch touch targets grow from 20×20px to at least 32×32px (still not full 44px WCAG target, but a meaningful step — going to full 44px in an 8-swatch-plus-custom row would require a layout rethink, deferred as a stretch goal, not blocking).

---

## Phase 1 — Real bugs (not taste, actual defects)

These are functionally broken, independent of any redesign preference. Ship first, ship fast, each is its own small task.

### Task 1.1: Fix the Focus/Pomodoro screen's unreachable close button

**Complaint #5.** Root cause, precisely diagnosed by investigation: `PomodoroTimer.tsx:383`'s full-screen overlay is `z-[200]`. Both its close paths (X button `:410-415`, "End session" button `:495-506`) only set `showConfirmEnd = true`, which mounts a `ConfirmModal` — but that modal's underlying `Dialog` (`src/components/ui/dialog.tsx:22,44`) renders at `z-50`, i.e. **underneath** the opaque `z-[200]` Pomodoro backdrop. The confirm dialog exists in the DOM but is invisible and unclickable. There is also no Escape-key handler and no click-outside-to-dismiss anywhere in the file — refreshing the page (which resets `activeTimer` to its initial `null`) is currently the *only* way out, exactly matching the report.

**Files:**
- Modify: `src/components/features/PomodoroTimer.tsx`
- Modify: `src/components/ui/dialog.tsx` (only if the z-index fix is made globally rather than per-instance — see Step 1)

- [ ] **Step 1: Fix the z-index collision.** Two valid approaches — pick whichever fits the existing z-index scale in `globals.css` better (check if one exists; if not, this is a good moment to establish one rather than another magic number):
  - (a) Give `ConfirmModal`'s `Dialog` an optional higher-z-index variant/prop used specifically when opened from inside the Pomodoro overlay, or
  - (b) Lower `PomodoroTimer.tsx:383`'s overlay to a z-index below the shared Dialog system's `z-50` isn't viable (it needs to sit above the rest of the app) — so (a) is the likely correct direction: add a `zIndex` prop to the shared `Dialog`/`ConfirmModal`, default `z-50`, pass something like `z-[250]` from `PomodoroTimer`'s confirm-end call site.
- [ ] **Step 2: Add an Escape-key handler** that opens the same confirm-end flow (not an instant close — ending a running focus session should still confirm, per the existing UX intent) — a `keydown` listener scoped to when the overlay is mounted, cleaned up on unmount.
- [ ] **Step 3: Decide on click-outside behavior.** Recommended: do NOT close on backdrop click for a running timer (accidental dismissal of an active focus session is worse than the current lack of it) — Escape + the (now-fixed) X/End-session buttons are enough. Document this as a deliberate choice in the commit, not an oversight.
- [ ] **Step 4: Manually verify in the browser** — start a focus session, click X, confirm the modal is now visible and clickable, confirm ending it actually clears `activeTimer` and returns to normal UI without a refresh. This is the one task in this whole plan that most needs a real click-through test, not just `tsc`/lint, given how it was missed before.
- [ ] **Step 5: Add a regression test** if one doesn't already exist for this flow (check `src/lib/__tests__/` for existing Pomodoro coverage first) — at minimum, assert the confirm dialog's DOM node has a higher stacking context than the overlay, so a future z-index regression fails a test rather than shipping silently again.

### Task 1.2: Fix Dropdown mispositioning inside animated containers (the "opens in the corner" bug)

**Complaint #10.** Root cause, precisely diagnosed: `Dropdown.tsx:50` calls floating-ui's `autoUpdate` with default options — no `{ animationFrame: true }`. Every `Dropdown` used inside `SettingsModal.tsx` (lines 965, 1040, 1071, 1388, 1409, 1499) sits inside a framer-motion spring-animated container (`SettingsModal.tsx:803-809`, `scale`/`y` transform). If a dropdown is opened while that parent transform animation is still resolving, `useFloating` snapshots a stale/mid-animation reference rect and never corrects it — producing a detached, often top-left-corner-anchored panel.

**Files:**
- Modify: `src/components/ui/Dropdown.tsx`
- Modify: `src/components/features/SettingsModal.tsx` (only if gating interactivity on animation-complete, per Step 2)

- [ ] **Step 1: Add `{ animationFrame: true }` to the `autoUpdate` call** at `Dropdown.tsx:50`, at minimum for a new opt-in prop (e.g. `trackAnimatedAncestor?: boolean`) threaded through from call sites known to live inside an animated container (all `SettingsModal.tsx` usages). Consider making it the default for all `Dropdown` instances if the perf cost (continuous rAF polling while open) is acceptable — floating-ui's own docs note this is the standard fix for "reference inside a transform-animated ancestor," and the cost only applies while a given dropdown is actually open, not globally.
- [ ] **Step 2 (optional, do only if Step 1 alone doesn't fully resolve it in manual testing):** gate `Dropdown` trigger interactivity on the parent modal's `onAnimationComplete` (framer-motion prop, `SettingsModal.tsx:806-808`) so a dropdown literally cannot be opened mid-transition.
- [ ] **Step 3: Manually verify** — open Settings, immediately (before the modal's spring settles) click a Dropdown trigger (e.g. Appearance tab's color mode dropdown), confirm it now opens correctly anchored regardless of timing.
- [ ] **Step 4: Also verify Think's thread-color popover** (`think/[id]/page.tsx:298`) isn't exhibiting the same class of bug — it's a separate hand-rolled implementation (not using `Dropdown`/floating-ui at all, just a plain `absolute` div with manual outside-click handling), so it can't inherit this fix. If it has its own positioning issues, file that as a separate note for Phase 3's color-picker consolidation rather than fixing it twice, differently, here.

### Task 1.3a: Fix the bottom nav's non-existent safe-area padding

**Complaint #2 (new), real bug found during follow-up audit.** `Navigation.tsx:672`'s `BottomNav` uses a class `pb-safe` for iPhone home-indicator clearance — **this class does not exist anywhere in the codebase or Tailwind's defaults** (confirmed via repo-wide grep). `viewport-fit=cover` is correctly set (`layout.tsx:39-43`), meaning the OS extends content under the notch/home-indicator, but nothing actually pads for it — the bar likely sits flush against or under the home indicator on real iPhones today.

**Files:**
- Modify: `src/components/layout/Navigation.tsx`
- Modify: `src/app/globals.css` (if defining `pb-safe` as a reusable utility rather than inlining `env()` directly)

- [ ] Replace `pb-safe` with a real implementation — either a Tailwind v4 arbitrary value (`pb-[env(safe-area-inset-bottom)]`) or a proper `.pb-safe { padding-bottom: env(safe-area-inset-bottom); }` utility in `globals.css` if this pattern is needed elsewhere too (check `MobileDrawer.tsx` and any other fixed-bottom element for the same missing-class bug while in there).

### Task 1.3b: Fix haptics not working on iOS at all

**Complaint #5 (new), real bug directly undercutting the "feel like a native iOS app" goal.** `useHaptics.ts` wraps `navigator.vibrate` — the Web Vibration API, which **Safari/iOS does not implement, at all, in any version**. Every haptic call in this app (`TaskCard.tsx:161,179`, `CaptureModal.tsx`, `SearchModal.tsx`, the Capture FAB's raw `navigator.vibrate([15])` at `Navigation.tsx:680-682`) is currently a silent no-op on iPhone. This is worth fixing before any other iOS-feel work, since it's presented as working today and isn't.

**Files:**
- Modify: `src/hooks/useHaptics.ts`

- [ ] There is no cross-browser way to trigger real haptic feedback from a web page on iOS Safari — this is a platform limitation, not a bug you can code around (iOS only exposes haptics to native apps and to web content indirectly via `<input type="checkbox">`/form elements in some iOS versions, which isn't usable generally). **Recommended fix**: make `useHaptics()` feature-detect (`"vibrate" in navigator`) and no-op cleanly on iOS rather than silently failing — it already probably does this without erroring, so the "fix" here is mainly about not over-promising. If a genuinely native-feeling tactile response matters enough on iOS specifically, the only real option is a visual/motion micro-feedback substitute (a brief scale-bounce on tap, which Framer Motion already handles well elsewhere in this app) rather than actual vibration — note this as the honest tradeoff rather than a silent limitation.
- [ ] Route the Capture FAB's raw inline `navigator.vibrate([15])` (`Navigation.tsx:680-682`) through the shared `useHaptics()` hook instead of calling the browser API directly — consistency, and it becomes covered by the feature-detection fix above.
- [ ] Extend haptic calls to currently-uncovered interactions found in the audit: nav item taps (none today), task swipe-to-*complete* (only delete currently has `haptics.heavy()`, `TaskCard.tsx:161` — completing a task is arguably the more satisfying moment to have a tactile confirmation on Android, and the visual-bounce substitute on iOS per above).

### Task 1.3: Style the orphaned Time Estimate input in TaskAddPanel

**Part of complaint #8.** `TaskAddPanel.tsx:956-973`'s Time Estimate field is a raw, unstyled native `<input type="number">` with no `className` at all — the only field in the entire form with zero styling, so it renders as a browser-default input dropped into an otherwise fully dark-mode-themed form. This is a one-line fix, not a redesign.

**Files:**
- Modify: `src/components/features/TaskAddPanel.tsx`

- [ ] Apply the same input styling class used by the form's other text inputs (check `Title` input's className at `:570-594` for the pattern) to the Time Estimate input, matching border/background/padding/focus-ring treatment.

---

## Phase 2 — Layout, spacing, and information hierarchy (the "atrocious spacing" complaints)

Each task below is scoped to one surface, independently reviewable, ordered roughly by how directly the user named it.

### Task 2.1: Sidebar (`Navigation.tsx`) — consolidate spacing onto real tokens, fix cramped feel

**Complaint #1 (elevated on user follow-up: "atrocious... I want a really well built one").** Investigation found a mix of real design tokens (`text-body-lg`, `text-meta`) and ad-hoc hardcoded pixel values (`h-[80px]` header, `h-[60px]` footer, `pb-[calc(env(safe-area-inset-bottom,24px)+84px)]` bottom clearance, hardcoded `--accent` hex fallbacks at lines 45-46, 396) with no single spacing scale enforced.

**Sourced reference point** (secondary design-analysis sources on Linear/Stripe/Vercel-class dashboard sidebars, not primary-source specs — flagged as such): expanded width convergence around 256px, collapsed 48-64px, label type 14-16px/1.4-1.5 line-height, 200-300ms expand transition. This app's current 248px expanded / 80px collapsed is already close to that range — the "atrocious" complaint is about execution quality (magic-number spacing, hover-only label reveal via width-only transition) more than the sizing being wrong. Fix the execution, don't necessarily resize.

**Files:**
- Modify: `src/components/layout/Navigation.tsx`
- Modify: `src/app/globals.css` (only if new spacing tokens are added — see Step 1)

- [ ] **Step 1: Establish (or confirm existing) spacing scale tokens** in `globals.css` for the values currently hardcoded as raw pixels in this file (header height, footer height, row height, icon tile size). If tokens already exist elsewhere in the design system that these values should have used, use those instead of inventing new ones.
- [ ] **Step 2: Increase row/label breathing room.** Current rows are `h-44px` with `px-2` — this reads as cramped mainly because of tight vertical rhythm between rows and the abrupt `max-w-0 → max-w-[160px]` label reveal (no transition easing consideration beyond width, no fade). Consider: slightly taller rows (48px, matching more common sidebar conventions), a proper `opacity` + `max-width` combined transition for the label reveal rather than width-only (width transitions can look janky), and consistent `gap`-based spacing between icon and label rather than manual margins.
- [ ] **Step 3: Replace hardcoded `--accent` hex fallbacks** (lines 45-46, 396) with the actual CSS custom property references used elsewhere in the app, if a fallback is even still needed (check whether the SSR-fallback problem this was originally working around — `AUDIT-01`'s `getComputedStyle` SSR crash, per this file's own historical comment — still applies, or whether the fix pattern has since been centralized elsewhere).
- [ ] **Step 4: Verify** the collapsed→expanded hover transition still feels responsive (not sluggish) after any duration/easing changes, and that `MobileDrawer.tsx` (a separate component, not touched by this task) isn't accidentally left visually inconsistent with the desktop sidebar's new spacing — note any drift for Task 2.6 (mobile pass) rather than fixing it here.

### Task 2.2: Home dashboard — real visual hierarchy instead of uniform stat tiles

**Complaint #2.** Investigation: every stat block (the 4-tile bento row `:863-945`, the 2-tile pomodoro/tasks row `:947-964`) uses the identical `GlassCard` + `text-2xl font-light` + `text-xs uppercase` pattern regardless of importance, with only the "Focus Now" hero card breaking the pattern. Motion exists only on the Up Next list (staggered `m.div`, `:985-994`); the bento tiles, summary cards, and Week-in-Review chart are fully static.

**Files:**
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: Differentiate the bento row from the pomodoro/tasks row by weight**, not just content — e.g. the bento row (4 small counters: Active Tasks, Day Streak, Open Threads, Locations) could shrink further and go monochrome/secondary, while the pomodoro/tasks summary row (2 cards, more "this week's effort" in nature) gets slightly larger type and an accent treatment, so the page reads top-to-bottom as hero → secondary-but-real stats → minor counters, not four visually identical rows.
- [ ] **Step 2: Extend the existing stagger-in pattern** (already correctly implemented for Up Next, `:985-994`) to the bento tiles and summary cards on initial page load, so the whole dashboard feels considered rather than half-animated.
- [ ] **Step 3: Demote the "Week in Review" header button** (`:480-507`) — currently a bordered button at equal visual weight to the H1 greeting it sits beside. Recommend converting it to a lighter/icon-led secondary action or a tab, not competing directly with the page's primary heading.
- [ ] **Step 4 (stretch, only if time allows without derailing the phase):** the Week-in-Review day-bar chart (`:577-605`) is a hand-built flex/height bar chart with no scale labels or tooltips. A minimal real chart (even a simple SVG sparkline-style bar chart with axis labels) would read considerably less "demo-ish" than unlabeled flex bars — flag as a candidate but don't block this task's completion on it if scope is tight; it can be a follow-up.

### Task 2.3: Task cards (`TaskCard.tsx`) — give bare tasks visual substance

**Complaint #3.** Investigation: `p-4` padding, no `min-height`, category "chip" and Overdue/Today badge are both bare colored text (no pill background/border despite reading as chips), priority dot only shows for priority < 4 (hidden for most default-priority tasks), footer icons are 12-14px. A task with just a title and no deadline/first-step/subtasks renders as one line of bold text and an almost-empty footer.

**Files:**
- Modify: `src/components/features/TaskCard.tsx`

- [ ] **Step 1: Turn the category label and Overdue/Today label into real chips** — small rounded-pill backgrounds with the category/status color at low opacity (matching the token conventions established elsewhere in this codebase, e.g. `--status-*-dim` tokens used for Overdue/Done states in prior phases), not bare colored text. This alone will materially reduce the "ugly, small, cramped" read without touching layout structure.
- [ ] **Step 2: Add a modest `min-height`** so a bare task (title only) doesn't collapse to a single thin line — enough to keep the grid/list visually rhythmic even when optional fields are absent.
- [ ] **Step 3: Reconsider the priority-dot visibility rule.** Hiding it for the (likely most common) default/Low priority means most cards show no priority signal at all. Either give Low priority its own subtle dot color instead of hiding it, or move priority signaling to the chip system from Step 1 so it's not solely dependent on a tiny 8px dot.
- [ ] **Step 4: Increase footer icon sizes modestly** (from the current 12-14px) and confirm the play/focus-start button's tap target is reasonable on touch devices — check what the shared `Button` component's implicit sizing resolves to here and whether it meets a reasonable minimum.
- [ ] **Step 5: Re-run `phase3.test.tsx`'s `R3: TaskCard & Think Detail Page Requirements` suite** (and any other TaskCard-specific test) after these changes — this file already lost one avatar-related test case during the Explore/People removal (Task 6 of that plan), so check current coverage is still meaningful, not accidentally broken by the chip/sizing changes.

### Task 2.4: TaskAddPanel — group fields, fix the popover crowding

**Complaint #8 (remainder, beyond the Time Estimate styling already covered in Task 1.3).** Investigation: 9 field sections in one flat `space-y-6` scroll with no grouping/sectioning; the Due Date/Start Date popover and the Recurrence popover are both fixed at `w-[280px]`, each packing multiple distinct concepts (quick-pick chips + two separate datetime inputs; frequency chips + a conditional day-picker or interval-picker) into a cramped fixed width.

**Files:**
- Modify: `src/components/features/TaskAddPanel.tsx`

- [ ] **Step 1: Group fields into visual sections** — at minimum split into "Core" (Title, Subtasks, Category, Priority) vs. "Scheduling" (Due Date, Start Date, Recurrence, Time Estimate) vs. "Notes", with a subtle divider/heading between groups, so the form reads as a structured flow rather than one undifferentiated scroll.
- [ ] **Step 2: Widen the Due Date/Start Date and Recurrence popovers** beyond the current fixed `280px`, or split "Due Date" and "Start Date" into a clearer two-step flow (quick-pick chips first, then an expandable "custom date/time" section) rather than both datetime inputs visible in a 2-column grid inside a narrow popover at all times.
- [ ] **Step 3: Fix the Subtask row's inconsistent hover-reveal.** Investigation found the delete button has a `row-actions` class implying hover-reveal, but no actual `opacity-0`/hover class is applied in this file's JSX — confirm whether `row-actions` handles this via a shared CSS rule elsewhere (if so, this is a non-issue, just confirm) or whether it's genuinely always-visible and inconsistent with TaskCard's hover-affordance pattern (if so, align it).
- [ ] **Step 4: Verify the sticky bottom action bar** (delete-icon button + full-width Save button, `:1061-1096`) still reads clearly once the form has visual sections above it — confirm no double-border or awkward transition where the last section meets the sticky bar.

### Task 2.5: Think page — visual rhythm, composer alignment, Daily Note distinction

**Complaint #6.** Investigation found: no visual distinction between Daily Note and topic threads; entry cards have a transparent-until-hover left accent border (so resting state is a plain gray box); `entry.starred` field exists in the data model but is never rendered (dead UI hook); delete button padding (`pr-8` on 16px icon in 24px button) risks text crowding; the fixed composer bar uses a different centering strategy (`md:pl-[220px]` hardcoded sidebar-width offset + `mx-auto`) than the page content above it (`mx-auto` alone), risking misalignment; the title input uses a `-ml-2`/`px-2` negative-margin hack for hover-padding, hand-tuned rather than systematic.

**Files:**
- Modify: `src/app/(app)/think/[id]/page.tsx`

- [ ] **Step 1: Add a lightweight Daily Note distinguisher** — recommend a small date-banner/label treatment at the top of the entry list specifically for Daily Note threads (detectable via the thread's existing title pattern or a dedicated field if one exists — check the `Thread` interface at `:41-49` and the data layer for how Daily Notes are already flagged, since Home's "Daily Note" button already routes here per prior work). Don't invent a new data field if one already signals this.
- [ ] **Step 2: Fix the composer/content alignment.** Standardize on ONE centering strategy — either the composer should use the exact same `mx-auto max-w-2xl` as the page content with no extra sidebar-width padding hack, relying on the composer's own fixed positioning relative to the actual layout (not a guessed 220px offset), or both should explicitly share a layout-level constant. Verify visually at both mobile and desktop widths that the composer's input column lines up with the entry cards above it.
- [ ] **Step 3: Either wire up `entry.starred` to something real (a star toggle button, matching the delete button's presence) or remove the unused field/dead layout slot** (the `justify-between` wrapper around a single child at `:409-419`) — don't leave a half-built feature signal in place silently.
- [ ] **Step 4: Give resting-state entry cards a touch more visual presence** — the hover-only left accent border means every entry looks identical until interacted with; consider a subtle always-visible treatment (even just a slightly different resting-state border color, not necessarily the full accent) so the page doesn't read as a stack of undifferentiated boxes.
- [ ] **Step 5: Replace the `-ml-2` negative-margin title-input hack** with a cleaner approach if one is readily available (e.g. matching padding on the wrapping row instead of counter-margining the input) — low priority, only do this if it's not disruptive to the rest of the header's alignment.
- [ ] **Step 6: Confirm the delete button's hit area doesn't crowd entry text** at narrow viewports — increase `pr-8` if needed, or move the delete affordance to a swipe/long-press pattern on mobile if that's more consistent with the rest of the app's mobile patterns (check Inbox/Do's swipe-to-delete pattern first — this app already has one, reuse it rather than inventing a third gesture).

### Task 2.6: Settings — restructure for usability (not a cosmetic pass)

**Complaint #9.** This is the most structurally significant task in Phase 2. Investigation found: flat `space-y-6`/`space-y-8` field lists per tab with minimal sub-grouping; Notifications tab's 5 toggle rows have no grouping by category; Focus tab has one labeled sub-card and one unlabeled one for what's conceptually the same setting group; category color swatches are 20×20px with 6px gaps (well under touch-target guidelines, and keyboard-focus-ring is not visibly styled); category rename is blur-only with no explicit save affordance; the "Add category" row is visually disconnected from the list it adds to; the save-status indicator lives only in the sidebar footer, far from whatever field was just edited; mobile tab nav is a horizontally-scrollable icon row with no scroll-affordance hint.

**Files:**
- Modify: `src/components/features/SettingsModal.tsx`

- [ ] **Step 1: Add sub-section grouping within tabs** where multiple related-but-distinct settings currently sit undifferentiated — start with Notifications (group delivery-method toggles separately from content-type toggles) and Focus (give the "Long Break After" card the same header treatment as "Timer Durations" so it's clearly part of the same group, or merge them into one card).
- [ ] **Step 2: Increase category color-swatch touch targets** from 20×20px to at least 32×32px (per this plan's Global Constraints decision above), add a visible focus ring, and increase the gap between them slightly so adjacent swatches aren't a near-miss-click risk.
- [ ] **Step 3: Give category rename an explicit save affordance** — even a simple checkmark/Enter-to-confirm pattern next to the blur-triggered save, so a user editing a name and then immediately closing the modal has visible confirmation the change landed, not just a toast that may be missed.
- [ ] **Step 4: Move save-status feedback closer to the point of edit** — at minimum, add a brief inline "Saved" indicator near whatever field/section was just touched (matching the Think page's per-action toast pattern already established elsewhere in this app), in addition to or instead of the sidebar-footer-only indicator.
- [ ] **Step 5: Add a scroll-affordance to the mobile tab strip** (a subtle edge gradient fade, matching a pattern likely already used elsewhere for horizontal scroll regions — check `SearchModal.tsx`/other list views for precedent) so users on narrow viewports realize there are more tabs than currently visible.
- [ ] **Step 6: Visually connect the "Add category" row to the list it modifies** — align its border/padding treatment with the per-category rows above it rather than using a distinct style.
- [ ] **Step 7: This task's diff will be large** (a ~1700-line file) — split into sub-commits per tab/section if that keeps review tractable, following this project's established SDD task-sizing convention (one reviewable unit per commit) rather than one giant diff.

### Task 2.6a: Bottom nav visual quality

**New complaint from user follow-up ("bottom nav in mobile is looking so ugly too").** Investigation (`BottomNav()`, `Navigation.tsx:660-741`): flat 95%-opacity solid background, no blur layer at all; icons at `size={20}`/`strokeWidth={1.5}` — thin relative to iOS's ~25pt convention; active-state indicator is a single animated 4×4px dot below the icon — easy to miss at a glance, no pill/underline reinforcement; the center Capture FAB (48×48, breaks out of the bar with a punched-ring border) has no label, orphaned next to 3 labeled siblings.

**Disclosed tradeoff, not silently resolved**: current, web-verified Apple HIG guidance (fetched 2026-09-16) states iOS 26's tab bars now use translucency/blur ("Liquid Glass") as their defining visual signature, not an optional layer — a flat tab bar will read as pre-iOS-26 native, not current native. This sits against the "stay flat, no blur" decision made earlier in this plan. Recommendation: keep the no-blur decision (a cheap `backdrop-blur` on a fixed bottom bar is one of the less expensive places blur could go if reconsidered later, but changing this now reopens a settled decision) — compensate for the lost "native" signal with what's still available without blur: a stronger active-state treatment and correct icon weight, not translucency.

**Files:**
- Modify: `src/components/layout/Navigation.tsx`

- [ ] **Step 1: Strengthen the active-state indicator** beyond the 4×4px dot — an icon fill/weight change (outline→filled, matching the HIG's "convey selection by more than color alone" guidance) reads as considered without needing blur or a pill background that would compete with the FAB.
- [ ] **Step 2: Increase icon size modestly** (from `size={20}` toward something closer to the FAB's own `size={24}`, for visual consistency across the bar — check this doesn't cramp the existing `flex-1` item width at typical phone widths first).
- [ ] **Step 3: Give the Capture FAB a label** (small text below or beside it, matching its siblings) so it doesn't read as orphaned, or deliberately confirm no-label is intentional (a FAB is sometimes correctly unlabeled as a distinct affordance) — pick one on purpose, not by omission.
- [ ] **Step 4: Depends on Task 1.3a** (the `pb-safe` bug) landing first or alongside — don't redesign spacing around a safe-area value that isn't actually being applied yet.

### Task 2.6b: Key user flows — cut unnecessary steps

**New complaint from user follow-up ("user flows can be made better").** Investigation traced three flows precisely; two are already efficient, one has real friction:

- **Focus session start** (TaskCard play button → running timer): already single-tap, `autoStart=true` wired correctly. No change needed.
- **Manual task creation** (Do space → TaskAddPanel): clean 2-tap flow (open, type, Enter). One real gap: the panel's lazy-chunk `preload()` (`do/page.tsx:407-416`) is wired only to `onMouseEnter`/`onFocus` — both desktop-only triggers. Mobile taps always pay the full chunk-load cost that desktop hover pre-warms away.
- **Capture → routed item** (`CaptureModal.tsx`): a *mandatory* two-step flow — type → tap Route → review screen with an editable destination dropdown → tap Confirm & Save — even for an obviously-unambiguous capture (e.g. router returns high confidence). No fast path exists.

**Files:**
- Modify: `src/app/(app)/do/page.tsx` (or wherever the TaskAddPanel lazy-chunk preload is wired)
- Modify: `src/components/features/CaptureModal.tsx`

- [ ] **Step 1: Add `onTouchStart` (or a pointer-down handler) alongside the existing `onMouseEnter`/`onFocus`** for the TaskAddPanel chunk preload, so mobile taps get the same pre-warm benefit desktop hover already gets.
- [ ] **Step 2 (design decision, confirm before building):** add a fast path for high-confidence captures — e.g. if `routeCapture()`'s classifier returns above some confidence threshold, skip straight to a lightweight "Saved to Do ↩ undo" toast instead of the full review screen, reserving the review step for ambiguous/multi-destination results. This is a real behavior change (not just visual), so implement it as its own reviewable task, and confirm the confidence-threshold approach is acceptable before building — the alternative is a one-tap "confirm" default with the review screen only appearing on a deliberate "edit" tap, which is a smaller change with a similar effect. Recommend the second (smaller, less classifier-trust-dependent) option unless there's a strong reason to prefer the first.

### Task 2.7: Mobile responsiveness sweep

**Complaint #12.** Investigation found the picture is more mixed than "entirely unaccounted for": `Navigation.tsx`/`BottomNav`/`MobileDrawer.tsx` and the `Sheet`-based panels (`TaskAddPanel`, `CaptureModal`) already have genuine, correct mobile-specific layouts — not squeezed desktop. The real gaps: `remember/page.tsx` and `trash/page.tsx` have zero responsive classes; the entire calendar feature (`calendar/CalendarTaskChip.tsx`, `CalendarView.tsx`, `MonthView.tsx`, `WeekView.tsx`) has no responsive handling at all; `SettingsModal.tsx` duplicates `Sheet`'s mobile-sizing logic instead of reusing it (functionally fine today, but a maintenance/consistency risk, and its mobile tab-strip has its own issues per Task 2.6).

**Files:**
- Modify: `src/app/(app)/trash/page.tsx`
- Investigate/modify: `src/components/features/calendar/*.tsx`
- Cross-reference: `src/app/(app)/remember/page.tsx` (currently just a redirect — confirm it genuinely needs no responsive work, or if the complaint is actually about `remember/locations/page.tsx`, which this plan does NOT touch per Global Constraints — clarify scope before starting)

- [ ] **Step 1: Add mobile-appropriate layout to `trash/page.tsx`** — check its current list/card rendering and add responsive breakpoints matching patterns used elsewhere (Do/Inbox list views).
- [ ] **Step 2: Add mobile handling to the calendar feature.** This is likely the single biggest real gap found — a full feature area with zero responsive classes. `WeekView`/`MonthView` in particular need a mobile strategy (e.g. collapsing to a single-day or agenda view below a breakpoint, since a 7-column week grid will not work on a phone screen at all). This may need its own design decision (flag for confirmation before implementing: does calendar get a distinct mobile layout, or does it become unavailable/redirect to a list view below a breakpoint?).
- [ ] **Step 3: Manually test on an actual narrow viewport** (browser devtools device emulation at minimum, ideally a real phone) — this plan's other tasks all claim mobile-correctness for the areas they don't touch (Sheet-based panels, nav), but verify that claim rather than re-trusting it blindly, since it came from static code reading, not an actual rendered check.
- [ ] **Step 4 (lower priority, note but don't block on):** consider consolidating `SettingsModal.tsx`'s custom mobile-sizing implementation onto the shared `Sheet` component for consistency — only if Task 2.6's Settings restructuring work doesn't make this awkward; otherwise defer to a future cleanup.

---

## Phase 3 — Polish, motion, and consolidation

Lower urgency than Phase 1/2 — do after the structural/bug work above lands and the app has been re-evaluated against the original 16 points.

### Task 3.1: Consolidate the three color-picker implementations

Per Global Constraints — `think/[id]/page.tsx`'s hand-rolled thread-color popover, `SettingsModal.tsx`'s `CategoryItem` swatch row, and the general-purpose `Dropdown` component are three independent UIs solving overlapping problems. Design and build one shared, floating-ui-positioned, touch-target-correct color-picker component; migrate both existing hand-rolled instances onto it. This directly fixes Think's popover positioning risk (flagged in Task 1.2 Step 4) as a side effect, and gives Settings' swatches (Task 2.6 Step 2) real keyboard/focus support for free instead of a second hand-patch.

### Task 3.2: Broader motion pass

Complaint #11 ("lifeless"). After Phase 2's hierarchy fixes land, do a focused pass extending the stagger/entrance patterns already proven on Home's Up Next list and established motion conventions elsewhere in the app to: Do's task columns, Think's entry list, Settings' tab-switch transition. Explicitly NOT a request to add gratuitous animation everywhere — match the restraint already established in this app's existing motion usage (subtle, purposeful, not decorative).

**Sourced API note** (confirmed via direct fetch of motion.dev's current docs, 2026-09-16): Framer Motion is now published as "Motion" (`motion/react`); current stagger guidance uses `delayChildren: stagger(0.1)` (importing `stagger` from the package) rather than the older `staggerChildren` transition prop. Check whether this repo's existing `framer-motion` dependency/usages are on the older API before writing new stagger code — match whatever the existing Up Next-list pattern already uses for consistency, and only adopt the newer `stagger()` API repo-wide if doing so in one deliberate pass, not mixed piecemeal.

---

## Phase 4 — Performance

**Complaint #15.** Investigation found the "~1.1MB /login" and "LCP 6.4s" figures already cited in CLAUDE.md are stale — real, measured work already landed same-day (2026-09-14/15): login bundle reduced to 287.3 KiB gz, Sentry tracing stripped (~115 KiB gz). The actual highest-leverage remaining work:

### Task 4.1: Get current, real numbers before doing anything else

- [ ] Run `npm run check:budgets` (needs a `next start` on :3000 first) and `ANALYZE=true npm run build` (or `npx cross-env ANALYZE=true next build` — `cross-env` is already a devDependency) to get today's actual bundle composition, not the stale CLAUDE.md figures.
- [ ] Re-measure Core Web Vitals on `/do` (the route CLAUDE.md's stale LCP 6.4s figure was measured on) using a real Lighthouse run, not a guess.
- [ ] Update CLAUDE.md's "Verified state" and "Known weak points" tables with the fresh numbers as part of this task — don't let them drift further out of sync with reality.

### Task 4.2: Convert client-only route pages to server shells with client islands

Investigation found layouts are mostly already correct (8/9 are Server Components) — the real remaining work is the 9 client `page.tsx` files (`do`, `inbox`, home `/`, `remember/locations`, `think`, `think/[id]`, `trash`, `login`, `~offline`). For each, identify what's genuinely interactive (forms, real-time subscriptions, client state) vs. what's static shell/initial data that could render server-side, and split accordingly. This is the highest-leverage remaining performance lever per the project's own prior analysis — do it incrementally, one route at a time, each independently measurable via Task 4.1's tooling, not as one giant risky rewrite.

### Task 4.3: Extend `perf-budgets.json` beyond `/login`

Currently only `/login` has a tracked budget (165 KiB gz). Add entries for `/do`, `/`, `/inbox`, and `/think` at minimum — the routes an authenticated user actually spends time on — using Task 4.1's fresh measurements as the initial baseline, so future regressions get caught automatically instead of only surfacing as a user complaint months later.

---

## Phase 0.5 — Design system formalization (runs alongside Phase 2, informs it)

User decisions locked in for this plan (asked directly, not assumed):
- **Mobile = responsive web/PWA, not a native app.** No React Native, no separate codebase. Phase 2.7's mobile sweep is the mobile work — this doesn't add scope, it raises its bar.
- **Cinematic/sunrise-sunset direction stays flat.** The existing design philosophy (already stated in this codebase's own spec, §4: "calm, personal, sunrise/sunset-toned, executed at an Apple level of craft") is the target — it's not new work, it's under-realized work, which is what Phase 2/3 already targets (hierarchy, spacing, motion). One addition: a subtle, static film-grain **background texture** (cheap `background-image` noise, no blur/gradient/glow, applied at the page/canvas level only — never on cards, modals, or buttons) for atmosphere. This is a small, isolated task, not a reason to reopen the flat-surface decision.

### Task 0.5.1: Add the film-grain background texture

- [ ] Generate or source a small (≤10KB), tileable, low-opacity noise PNG/SVG (a static asset, not a runtime canvas/WebGL effect — those cost CPU/battery for no visual gain here). Apply as a fixed-position `background-image` at the root layout level, `mix-blend-mode: overlay` or similar at very low opacity (2-4%), sitting behind all content. One CSS rule, one static asset — must not appear in any per-component styling, must not affect Lighthouse/CLS/paint metrics measurably (verify against Phase 4's budget tooling once that lands).

### Task 0.5.2: Turn the existing token system into an enforced design system, not just a convention

This app already has a real token system (`globals.css` custom properties: `--accent`, `--surface-*`, `--status-*`, `--text-*`, spacing/shadow tokens) — the complaints in this plan are about *inconsistent application*, not absence of tokens. Formalizing it:

- [ ] Add an ESLint rule (or extend the existing lint config) banning raw hex colors and raw `rgba()` values in `className`/inline `style` across `src/components/**` and `src/app/**` — forces every future PR through the token system instead of another one-off hardcoded value creeping in (exactly the class of bug this whole session's design-overhaul work kept finding and fixing after the fact).
- [ ] Document the spacing scale explicitly (audit what values are actually in use today — `4/8/12/16/24/32px` etc. — and either confirm they already map to a scale or formalize one) in a short `docs/design-tokens.md`, referenced by CLAUDE.md, so "what padding do I use here" has one answer instead of each component inventing its own (per Task 2.1's sidebar findings, Task 2.6's Settings findings — this pattern repeats everywhere).
- [ ] This task should run *before or alongside* Phase 2's per-surface fixes, not after — Phase 2 tasks should consume whatever this task formalizes, not invent values that then need re-auditing.

**Sourcing note**: no new UI library, icon set, or component kit is being introduced by this plan — the existing stack (Tailwind v4, @floating-ui/react, framer-motion, lucide-react, @base-ui/react) is current and adequate for everything scoped here. Introducing a new dependency for this work would cut against the performance goals in Phase 4, not support them.

## Explicit non-scope / deferred

- **Explore/People**: already removed, not revisited.
- **Locations/Remember**: already shipped in a prior phase, not revisited except the one narrow `remember/layout.tsx` fix already merged (dead People tab removal) and the `remember/page.tsx` mobile-scope clarification needed in Task 2.7.
- **A full visual re-skin / new color palette / typography system**: not requested — the complaints are about spacing, hierarchy, sizing, and broken interactions, not "wrong colors." Phase 2/3 work should stay within the existing design token system, not invent a new one.
- **New features**: none of the 16 points ask for new functionality — this plan is entirely about fixing and polishing what exists.

## Self-Review Notes

- **Coverage check against the user's 16 points**: #1 sidebar → Task 2.1. #2 Home lifeless → Task 2.2. #3 task cards → Task 2.3. #4 layout/spacing site-wide → distributed across every Phase 2 task (not one task, since it's not one surface). #5 Focus screen ugly + unclosable → Task 1.1 (bug) + folded into Task 2.3-adjacent polish if any Focus-screen visual work remains after the bug fix, flagged as a gap: **Focus screen's visual design itself (not just the close bug) has no dedicated task above** — add one if a follow-up pass is wanted, this plan only fixes its functional defect. #6 Think page → Task 2.5. #8 TaskAddPanel → Tasks 1.3 + 2.4. #9 Settings → Task 2.6. #10 Dropdown positioning → Task 1.2. #11 lifeless → Task 3.2 (motion) + Task 2.2 (Home hierarchy) together. #12 mobile → Task 2.7. #13 "feels like a demo" → this is the cumulative effect of #1-12, not a separate task. #15 performance → Phase 4.
- **Gap acknowledged**: the Focus/Pomodoro screen's *visual* design (as opposed to its close-button bug) was not separately investigated — Task 1.1 only fixes the functional defect. If the user still finds it "ugly" after that fix, that's a Phase 3 candidate not yet scoped here.
- **Follow-up round (2026-09-16) coverage**: sidebar quality → Task 2.1 (elevated, sourced). Bottom nav ugliness → Task 2.6a (sourced, with the iOS-26-blur tension explicitly disclosed rather than silently decided). User flows → Task 2.6b (2 of 3 flows already fine; Capture's mandatory review screen and mobile's missing touch-preload are the real gaps). Consistency (layout/spacing/sizing/text/fonts/icons/placement) → this is exactly what Task 0.5.2 (design-token enforcement) plus each Phase 2 task's individual spacing fixes are for — there is no single "consistency" task because consistency is the byproduct of Task 0.5.2 landing before/alongside the rest, not a separate deliverable. iOS-app mobile feel → two real bugs found and added (Task 1.3a: `pb-safe` doesn't exist, so safe-area padding is currently absent; Task 1.3b: haptics use an iOS-unsupported API, so they silently don't work on iPhone at all today) plus Task 2.6a/2.7.
- **Sourcing disclosure**: all "current best practice" claims above are dated 2026-09-16 and cite either an official doc (Apple HIG, floating-ui.com, motion.dev — all confirmed via direct fetch where noted) or are explicitly flagged as secondary/directional (the Linear/Vercel sidebar sizing conventions, sourced from design-analysis articles since neither company publishes a public spec for this pattern).

# Phase 2d: Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development if dispatching subagents) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `OnboardingWizard.tsx` per spec §21's Onboarding section — cut from 5 steps to 3, introduce the ritual loop as the app's differentiator (not a feature tour), keep it welcoming with a compact glance at the three kept spaces, and make it visually match the flat/Newsreader/BrandMark treatment already shipped on Sign-in and Home.

**Architecture:** Single-file rewrite of `src/app/onboarding/OnboardingWizard.tsx`. `page.tsx` (auth gate + initial-name fetch) and `layout.tsx` (already-flat `AmbientBackground` no-op + `MotionProvider`) need no changes. The real backend writes (`user_settings` upserts, capture routing via `routeCapture`, the `nudge_time` calculation) are preserved — this is a content/structure/visual rebuild around unchanged data logic, with one field dropped (`primary_struggles`, confirmed to have zero consumers anywhere else in the codebase).

**Tech Stack:** Next.js 16.3 (Client Component), React 19, Framer Motion (`m`, `AnimatePresence` — already in use, kept), Supabase, `BrandMark`, shared `Button` component, `font-heading` (Newsreader).

**Spec:** `docs/superpowers/specs/2026-09-13-design-system-overhaul-design.md` §21 (Onboarding section), §3 (ritual loop as the app's differentiator, Explore/People cut from the long-term IA), §4 (flat surfaces), §6 (Newsreader), §14 (horizon-arc mark).

**Design resolved with the user (this session, not pre-written in the spec):** the spec's "not a full feature tour" instruction was read too literally in an earlier pass and would have cut all feature context, which the user correctly flagged as just moving friction later rather than removing it. Resolved structure: **3 steps** — (1) Welcome + optional name + a compact, single-screen (non-swiping) glance at the three kept spaces (Do/Think/Remember — Explore/People are being cut per §3 and don't belong in a new user's first impression), (2) ritual-loop setup via the wake-time field that already drives real `nudge_time` data, explained as the app's core differentiator, (3) a real first-capture demo that also serves as the completion screen. This drops the old "Struggles" step (confirmed zero consumers of `primary_struggles` anywhere in the codebase — pure vanity data) and the old 5-card swipeable "Tour" screen (replaced by the compact glance in step 1) entirely.

## Global Constraints

- No gradients, glows, or glassmorphism (blur) anywhere. Flat backgrounds + hairline borders + flat shadow tokens only.
- No hardcoded hex colors or bare Tailwind palette classes (`amber-500`, `red-400`, etc.) — use `var(--token)`.
- Buttons use the shared `Button` component (`@/components/ui/button`), not hand-rolled `<button>` elements with raw utility classes — matches every other rebuilt page this phase (Home, Sign-in).
- The horizon-arc `BrandMark` and `font-heading` (Newsreader) appear on this page, matching Sign-in and Home's treatment.
- `text-[var(...)]` bare-value + `text-[length:...]` collision: use `text-[length:var(--text-x)]` when combining a font-size arbitrary value with a color arbitrary value on the same element.
- Name is optional, not a blocking gate — nothing downstream requires `display_name` (Home already falls back to ", you" when unset).
- The real backend writes (`user_settings` upserts for name/`nudge_time`/`timezone`/`onboarding_complete`, the capture-routing insert across `items`/`people`/`locations`/`threads`/`explores`) must all still happen — this is a visual/structural rebuild, not a logic rewrite. `primary_struggles` is the one field explicitly dropped.
- Every task ends in a state where `npm run lint`, `npx tsc --noEmit`, and `npm test` are clean.

## File Structure

- Modify: `src/app/onboarding/OnboardingWizard.tsx` — the entire rebuild.
- No changes to: `src/app/onboarding/page.tsx`, `src/app/onboarding/layout.tsx`, `src/lib/capture-router.ts`, `src/components/layout/AmbientBackground.tsx` (already a confirmed no-op).

## Investigation Notes (read before starting)

- **`AmbientBackground` is already flat** — it was emptied to a no-op in the Foundation phase (`src/components/layout/AmbientBackground.tsx`, kept as a no-op rather than deleted per AGENTS.md §2.5, "prove unreferenced first"). This is a *different* component from the one Sign-in used to use (`OnboardingBackground.tsx`, which was NOT flattened and is still used by nothing after the Sign-in rebuild). No background work needed here.
- **`primary_struggles` has zero consumers.** Grepped the full `src/` tree: only `OnboardingWizard.tsx` (writes it) and `database.types.ts` (the generated type) reference it. Safe to stop writing it; no migration needed since the column itself isn't being dropped (per AGENTS.md's never-drop-columns-silently convention — this plan only stops writing to it, the column stays in the schema untouched).
- **`nudge_time` has 9 real consumers** (`Navigation.tsx`, `SettingsModal.tsx`, `useAppStore.ts`, `AppInitializer.tsx`, and others) — it directly drives the morning ritual nudge. The wake-time step's `nudgeTimeStr` calculation (`wakeTime + 30 minutes`) in the current `handleNext3` is correct, tested-in-production logic and must be preserved exactly, just re-skinned and re-copywritten around.
- **Icon conventions already established elsewhere in the app**: `Do` → `Check`/`CheckCircle2` (nav uses `Check`, Home's bento used `CheckCircle2` — either is fine, this plan uses `CheckCircle2` to match Home), `Remember` → `Brain` (matches `Navigation.tsx`'s nav item), `Think` → `MessageSquare` (matches `Navigation.tsx`). Reuse these exact icons for consistency with the nav the user lands in right after onboarding finishes.
- **`Button` component sizing**: the shared `Button`'s `default` size is `h-10 px-5` — smaller than onboarding's current large, thumb-friendly CTAs (`py-4 text-lg`). Keep the large CTA feel by passing a `className` override for height/padding/font-size on top of the component (its base classes for background/hover/disabled/focus states are what matters for token consistency; `cn()`/tailwind-merge resolves the size-class override correctly since they're the same utility namespace).
- **`capture-router.ts`'s `routeCapture` and its keyword-matching logic are unchanged** — this plan touches none of it. The first-capture step's demo value depends on this working correctly, which it already does (it's live, tested logic already running in production onboarding).

---

### Task 1: Restructure component state and step model (3 steps, not 5)

**Files:**
- Modify: `src/app/onboarding/OnboardingWizard.tsx`

**Interfaces:**
- Consumes: unchanged (`initialName: string` prop).
- Produces: no exported interface change — internal step count changes from 5 to 3.

- [ ] **Step 1: Remove the Struggles step's state and handler**

Delete `const [selectedStruggles, setSelectedStruggles] = useState<string[]>([]);`, the `STRUGGLES` constant array, the `toggleStruggle` function, and `handleNext2`'s body that writes `primary_struggles` — that entire step is cut. Renumber the remaining step logic so the component's internal `step` state runs 1→3, not 1→5. Rename `handleNext1`/`handleNext3`/`handleNext4`/`handleFinish` to reflect the new 3-step model: `handleStep1Next` (was `handleNext1` — saves name, advances to step 2), `handleStep2Next` (was `handleNext3` — saves `nudge_time`/`timezone`, advances to step 3), and fold the capture-save logic (was `handleNext4`) together with the completion logic (was `handleFinish`) into a single `handleStep3Finish` that does both: save the captured item (unchanged insert logic per destination), THEN upsert `onboarding_complete: true`, THEN `router.push("/")`.

- [ ] **Step 2: Remove the Tour step's state**

Delete `const [tourIndex, setTourIndex] = useState(0);` and the `TOUR_CARDS` constant array — the swipeable tour is fully replaced by step 1's compact glance (Task 2 builds this).

- [ ] **Step 3: Keep unchanged**: `name`/`nameError`, `wakeTime`, `captureInput`/`routedItem`, the auto-routing `useEffect`, and the entire body of the capture-insert logic (the `if (item.destination === "Do" || ...) { ... } else if (item.destination.startsWith("Remember")) { ... }` chain) — none of this data-layer logic changes, only which step number triggers it and what happens immediately after (fold in the former `handleFinish` body instead of just `setStep(5)`).

- [ ] **Step 4: Run lint and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: errors are expected at this point since the JSX below still references the old step numbers/handlers — this task's own JSX rewrite happens in Tasks 2-4. Do not attempt to make this task pass gates in isolation; proceed directly to Task 2, then run gates once after Task 4 completes the full rewrite. (If executing via subagent-driven-development instead of inline, fold Tasks 1-4 into a single dispatch — the state/JSX split only makes sense for a controller executing inline task-by-task in one continuous edit.)

---

### Task 2: Build Step 1 — Welcome, optional name, compact space glance

**Files:**
- Modify: `src/app/onboarding/OnboardingWizard.tsx`

**Interfaces:**
- Consumes: `BrandMark` (`@/components/ui/BrandMark`), `Button` (`@/components/ui/button`), `GlassCard` (`@/components/ui/GlassCard`, already flattened by the Home phase — use `variant="list"`, non-hoverable, for the three space tiles since they're informational, not links), `CheckCircle2`/`Brain`/`MessageSquare` from `lucide-react`.
- Produces: step 1's rendered JSX, replacing the current step-1 (`name`) and step-2 (`STRUGGLES`) blocks combined.

This step replaces the current `step === 1` block. Content, in order:

1. `BrandMark` + "Presense" wordmark (same treatment as Sign-in's header: `text-[var(--accent)]` wrapper, `font-heading` on the wordmark).
2. A `font-heading` headline — copy: **"Your external brain, finally somewhere calm."** (or equivalent short, calm framing — this is copywriting judgment within the "calm, meditative, premium" direction locked earlier in this project; keep it to one line, no more than ~8 words).
3. One sub-line explaining the app in a sentence: **"Presense captures what you'd otherwise forget — tasks, thoughts, and things you're keeping track of — and brings it back to you at the right moment."**
4. A compact, three-item, non-interactive glance row (NOT a swipeable carousel) — one `GlassCard` per space, all three visible at once in a `grid grid-cols-1 gap-3 sm:grid-cols-3` (stacks on mobile, row on desktop):
   - **Do** — `CheckCircle2` icon, `text-[var(--accent)]` — "One task at a time. No overwhelm."
   - **Think** — `MessageSquare` icon, `text-[var(--accent)]` — "Ongoing thoughts and a daily note."
   - **Remember** — `Brain` icon, `text-[var(--accent)]` — "What people told you. Where you left things."
5. An optional name input (keep the existing `input` class, existing `name`/`setName`/`nameError` state) with placeholder copy changed from "What should I call you?" to something that reads as optional, e.g. **"Your name (optional)"** — remove the `nameError` blocking behavior: pressing Next with an empty name should proceed (call `handleStep1Next` directly), not show an error. Delete the `if (!name.trim()) { setNameError(...); return; }` guard entirely, and remove the now-unused `nameError` state and its rendered `<p>`.
6. A `Button` (`variant="primary"`, size override via `className` for the large CTA feel — `h-14 text-lg` or similar, matching the current visual weight) — label **"Continue"** (not "Next", since this isn't a numbered sequence being surfaced to the user) — `onClick={handleStep1Next}`.

`handleStep1Next` still upserts `display_name` when non-empty (skip the upsert call entirely when `name.trim()` is empty — don't write an empty string over a real value, and don't fail if the user left it blank), then `setStep(2)`.

- [ ] **Step 1: Write the JSX replacing the current step===1 and step===2 blocks** (per the content list above — use the existing `m.div`/`AnimatePresence` entrance-transition pattern already established for each step, keep it, don't invent new motion primitives)
- [ ] **Step 2: Remove the `nameError` guard and state as described**
- [ ] **Step 3: Verify the file still parses** (a full lint/typecheck pass happens after Task 4 — at this point just confirm no unterminated JSX): Run `npx tsc --noEmit 2>&1 | head -40` and confirm the only errors reference code Tasks 3-4 haven't touched yet (step 2/3 JSX still referencing old step numbers), not step 1 itself.

---

### Task 3: Build Step 2 — Ritual loop setup via wake time

**Files:**
- Modify: `src/app/onboarding/OnboardingWizard.tsx`

**Interfaces:**
- Consumes: `Button`, existing `wakeTime`/`setWakeTime` state, existing `handleStep2Next` (renamed in Task 1) logic (unchanged `nudge_time` calculation).
- Produces: step 2's rendered JSX, replacing the current `step === 3` block.

This is the step spec calls out as introducing "the ritual loop... as the app's core idea." Content:

1. `font-heading` headline: **"Presense works in a loop, not a list."** (or equivalent — the point is naming the mechanic explicitly, not just asking for a time).
2. A short explanation, 2-3 sentences, of the actual loop: plan your day in the morning, review it in the evening — the thing `RitualStatusBadge`/`RitualOverlay` already implement on Home. Example: **"Each morning, Presense helps you plan the day. Each evening, a quick review closes the loop. It only takes a minute, and it's the one habit that makes everything else here work."**
3. The existing wake-time input (`type="time"`, existing `wakeTime`/`setWakeTime` binding, existing styling pattern — this is a real, working input, keep its mechanics exactly), with a label reframed from "I'm usually up by" to something that ties it explicitly to the loop, e.g. **"When should your morning planning nudge arrive?"**
4. `Button` `variant="secondary"` "Back" (`onClick={() => setStep(1)}`) + `Button` `variant="primary"` "Continue" (`onClick={handleStep2Next}`) — same layout pattern as the current back/next button row.

- [ ] **Step 1: Write the JSX replacing the current step===3 block**
- [ ] **Step 2: Verify `handleStep2Next` (renamed from `handleNext3` in Task 1) still computes `nudgeTimeStr` and `timezone` identically and calls `setStep(3)`** — no logic change here, only confirm Task 1's rename didn't drop anything from the function body.

---

### Task 4: Build Step 3 — First capture, folded into completion

**Files:**
- Modify: `src/app/onboarding/OnboardingWizard.tsx`

**Interfaces:**
- Consumes: `Button`, existing `captureInput`/`setCaptureInput`/`routedItem` state and the auto-routing `useEffect` (unchanged), `handleStep3Finish` (Task 1's fold of the old `handleNext4` + `handleFinish`).
- Produces: step 3's rendered JSX, replacing the current `step === 4` AND `step === 5` blocks combined into one.

This step replaces both the old capture step and the old standalone tour/finish step — the demo IS the finish, no separate screen after it.

1. `font-heading` headline: **"Let's try it. What's on your mind right now?"** (keep this — it already tested well as directive, action-oriented copy).
2. The existing `textarea` capture input, the existing `routedItem` live-preview chip ("→ This will go to {destination}") — unchanged mechanics, keep the `AnimatePresence`-wrapped preview exactly as it is.
3. `Button` `variant="secondary"` "Back" (`onClick={() => setStep(2)}`) + `Button` `variant="primary"` "Save & start using Presense" (`onClick={handleStep3Finish}`, `disabled={saving || !captureInput.trim()}`) — replaces the old two-stage "Capture & continue" → separate tour → "Start using Presense" flow with one action.
4. Keep a lightweight skip affordance — a plain text button below the primary CTA, **"Skip and start using Presense"** (`onClick={handleStep3Finish}` but bypassing the capture-save portion — call a version of the finish logic that only does the `onboarding_complete` upsert + redirect, skipping the item-insert since there's no `captureInput` to route). Reuse the existing bottom-of-page "Skip setup →" affordance's intent, but scope it to this step only now that there's no separate final screen — remove the old always-visible bottom "Skip setup" button that sat outside the `AnimatePresence` block (it doesn't fit the "welcoming, not just an exit" framing the user asked for; a skip option belongs at the point where skipping still gets you to a real destination — the finish — not floating over every step).

- [ ] **Step 1: Write the JSX replacing the current step===4 and step===5 blocks**
- [ ] **Step 2: Confirm `handleStep3Finish` (Task 1's fold) does, in order: if `captureInput.trim()` is non-empty, run the existing item-insert chain unchanged; then upsert `user_settings.onboarding_complete = true`; then `router.push("/")`** — verify no step of the original `handleNext4`/`handleFinish` logic was dropped in the fold, just sequenced into one function.
- [ ] **Step 3: Remove the old bottom-of-page always-visible "Skip setup →" button** (the one outside the `AnimatePresence` block, rendered on every step) as described above.

---

### Task 5: Token/component cleanup and final verification

**Files:**
- Modify: `src/app/onboarding/OnboardingWizard.tsx`

**Interfaces:** none — this task is cleanup across the file Tasks 1-4 already rewrote.

- [ ] **Step 1: Fix hardcoded colors**

Grep the file for hardcoded Tailwind palette classes and hex colors: `grep -n "amber-500\|red-400\|red-500\|#[0-9a-fA-F]\{3,6\}" src/app/onboarding/OnboardingWizard.tsx`. By this point Task 2 should already have removed the `amber-500` struggle-selection styling (that whole block was deleted in Task 1/2) and the `red-400` name-error styling (removed in Task 2 along with the `nameError` guard) — this step is a verification pass, not expected to find new work, but fix anything the grep turns up using the existing `--status-danger`/`--accent` tokens as appropriate.

- [ ] **Step 2: Confirm every button in the file uses the shared `Button` component**

Grep for hand-rolled buttons: `grep -n "<button" src/app/onboarding/OnboardingWizard.tsx` — expect zero matches (every interactive button should now be `<Button>` from `@/components/ui/button`). The step-indicator dots (if kept — see Task 2/3/4, this plan didn't specify adding a new progress indicator, so there may be none; if none exist, this grep should be clean already) are not buttons and don't need this treatment.

- [ ] **Step 3: Confirm all three `--color-*`/legacy-token usages are either intentional (matching the rest of the not-yet-redesigned app's convention) or already-current tokens** — this file previously used `--color-text-1`, `--color-background`, `--color-border`, `--color-surface`, `--color-accent` throughout (all live aliases per `globals.css:46-62`, confirmed during the Home phase). No action needed unless Tasks 2-4's new JSX introduced a NEW legacy-token reference where a current one (`--text-1`, `--bg-base`, `--border-default`, `--surface-1`, `--accent`) would be more consistent with Sign-in/Home's newer code — prefer the current-generation tokens in any JSX actually written by this plan (Tasks 2-4), since those are new code, not preserved legacy code.

- [ ] **Step 4: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 lint errors, clean typecheck, all tests pass. Known baseline note: this project has documented pre-existing flaky test suites (timeout-related, pass reliably in isolation) — if the ONLY failure is one of those, rerun once to confirm, don't treat it as a blocker. Any other failure is real.

- [ ] **Step 5: Visual verification**

Start a dev server (in a worktree, use the worktree's own server on a non-default port per this project's established pattern — the shared preview tooling only serves the main checkout, not a worktree path). Navigate to `/onboarding` as an authenticated user with `onboarding_complete: false` (or clear that flag for a test account) and walk through all 3 steps in both light and dark mode. Confirm: BrandMark/Newsreader render correctly, the three-space glance is legible and not cramped on mobile width, the wake-time input still works, the capture demo still routes and saves correctly, "Skip and start using Presense" reaches Home without an item-insert error when the textarea is empty.

- [ ] **Step 6: Commit**

```bash
git add src/app/onboarding/OnboardingWizard.tsx
git commit -m "feat(onboarding): rebuild as a 3-step, ritual-first flow

Cuts from 5 steps to 3 per spec: drops the Struggles step (confirmed
zero consumers of primary_struggles anywhere in the codebase) and the
5-card swipeable Tour (replaced by a compact, single-screen glance at
the three kept spaces in step 1). Reframes the wake-time step around
the ritual loop it actually configures (nudge_time already drives 9
other consumers) instead of presenting it as a bare preference. Folds
the first-capture demo and the completion screen into one step.

Resolves a real tension in the spec's own wording: 'not a full feature
tour' was read, in an earlier pass, as cutting feature context
entirely -- which just moves onboarding friction to Home instead of
removing it. The compact glance keeps new users oriented without
becoming the swipeable tour the spec explicitly ruled out.

Visual shell matches Sign-in and Home: BrandMark, Newsreader
headlines, the shared Button component, flat surfaces throughout
(AmbientBackground was already a no-op from Foundation -- no
background work needed here)."
```

---

## Post-Implementation

After Task 5, do a final read-through of the whole rewritten file (not just the diff) checking specifically:
- No orphaned references to `step === 4` or `step === 5`, `TOUR_CARDS`, `STRUGGLES`, `toggleStruggle`, `selectedStruggles`, `tourIndex`, `nameError`, or the old `handleNext1`/`handleNext2`/`handleNext3`/`handleNext4`/`handleFinish` names survive anywhere in the file.
- The auth-gate/redirect logic in `page.tsx` (untouched) still matches what `OnboardingWizard` expects as props — confirm `initialName` is still the only prop consumed.
- `grep -rn "OnboardingWizard\|onboarding" src/` for any other file referencing internals of this component (e.g. a test file) that this rewrite might have silently broken — if a test file exists for this component and wasn't part of this plan's file list, that's a gap to fix before considering this done, not to discover in CI.

Then proceed to `superpowers:finishing-a-development-branch` for the merge/push decision, following the same gate discipline as Navigation, Home, and Sign-in (tests green → present the 3-option menu → wait for explicit approval).

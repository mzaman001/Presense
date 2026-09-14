# Phase 3b: Think Space Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Think space into design-system compliance and build the spec-mandated shared "stale, gently resurfaced" mechanic. Think's own scope (journaling threads, `stale_prompt` resurfacing, one-tap Daily Notes) is spec-confirmed as "unchanged" — this is a token/color pass plus one real new piece of shared infrastructure, not a restructure.

**Architecture:** Two pages: the thread list (`think/page.tsx`) and the thread detail (`think/[id]/page.tsx`). The detail page is markedly more violation-dense than anything touched so far this phase — it still uses `#2DD4BF` (a pre-terracotta teal accent) pervasively across its submit button, stale-prompt badge, pin-active state, and entry-hover border, plus scattered red/amber/white hardcodes. Both pages also default new threads' `color_accent` to stale hex values. Separately, spec §3 explicitly asks for Think's `stale_prompt` display and Remember/Locations' (not-yet-touched) 30-day staleness check to become "one named, shared pattern, not two bespoke implementations" — this plan builds that shared piece now, with Think as its first consumer; Remember's own future phase adopts it for Locations.

**Tech Stack:** Next.js 16.3, React 19, Framer Motion, Supabase, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-13-design-system-overhaul-design.md` §4 (flat surfaces), §3 ("Think — unchanged in scope"; "Stale, gently resurfaced" unification).

## Global Constraints

- No gradients, glows, or glassmorphism (blur) on any surface, with one named exception ruled on in Task 2 (a monochromatic scroll-fade, not a decorative gradient).
- No hardcoded hex colors, bare Tailwind palette classes, or hardcoded `rgba(255,255,255,...)`/`rgba(0,0,0,...)` values — use `var(--token)`.
- **Exception, not a violation**: `thread.color_accent` (the per-thread accent bar, user-customizable via an existing color-picker UI on the detail page) and the color-picker's own 6-color palette array are legitimate stored/selectable literal values, exactly like Home's weekly-reflection thread color and Avatar's color system established earlier this phase — these are NOT design-system violations and this plan does not touch the palette array or the `color_accent` column's storage format. What this plan DOES fix: the *default* `color_accent` values written at thread-creation time, where they're stale (an old, no-longer-current accent hex), and every place the surrounding UI *chrome* (buttons, badges, borders — not user-chosen per-thread data) hardcodes a color instead of using a token.
- Every task ends in a state where `npm run lint`, `npx tsc --noEmit`, and `npm test` are clean.

## File Structure

- Modify: `src/app/(app)/think/page.tsx` — thread list page.
- Modify: `src/app/(app)/think/[id]/page.tsx` — thread detail page.
- Create: a shared stale-resurface component/hook (exact location decided in Task 3 based on what's found there — likely `src/components/ui/StaleBadge.tsx` or `src/hooks/useStaleResurface.ts`, following whichever existing convention this codebase uses for a single-purpose display component vs. a hook).

## Investigation Notes (read before starting)

- **The thread detail page (`[id]/page.tsx`) still uses the pre-terracotta accent color (`#2DD4BF`, teal) pervasively** — it appears to predate even the Foundation phase's token work. This is the most violation-dense file touched so far in Phase 2-3. Every occurrence needs to become an accent token, not a one-off fix.
- **`thread.color_accent` is a legitimate, user-facing customization feature, not a violation.** The detail page has a real color-picker UI (`isColorPickerOpen` state, a 6-swatch palette: `#FBBF24`/`#F472B6`/`#2DD4BF`/`#A78BFA`/`#60A5FA`/`#F87171`) letting users pick a distinct color per thread. This palette array and the `color_accent` storage are explicitly OUT of scope — do not tokenize or remove them.
- **Two default `color_accent` values ARE stale and need fixing**: `think/page.tsx`'s `handleNewThread` writes `color_accent: "#E5B41E"` — this is the OLD pre-overhaul gold accent (same bug already fixed elsewhere on `main`, e.g. commit `7f4b1c3`). This should become the current accent hex `#d97757`. `handleDailyNote` writes `color_accent: "#FBBF24"` (amber) — this is a *deliberate* distinct default for the "Daily Note" thread type (spec confirms Daily Notes are a named differentiator), consistent with the color-picker feature already establishing that distinct per-thread colors are expected — this one is NOT changed.
- **The Daily Note button's own UI chrome is a separate issue from its stored default color.** `think/page.tsx`'s Daily Note button hardcodes `rgba(251,191,36,0.25)`/`rgba(251,191,36,0.12)`/`#FBBF24`/`rgba(251,191,36,0.2)` for its border/background/text/hover — this is UI chrome (not stored data), and per this whole phase's established pattern (every other one-off accent color has collapsed to the single-accent system: Sign-in, Home, TaskCard), this becomes accent-token-based like the adjacent "New thread" button, matching it visually. The button losing its distinct amber identity is fine — the *stored* Daily Note threads keep their distinct amber `color_accent` in the list regardless, so the "this is special" signal survives in the one place that actually matters (the thread list itself), just not duplicated onto the button that creates it.
- **A `bg-gradient-to-t` on the detail page's fixed bottom input bar is a scroll-fade, not a decorative gradient.** `[id]/page.tsx`: `bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/90 to-transparent` fades a single color (the page's own background) to transparent, purely so content scrolling underneath the sticky input bar fades out rather than hard-clipping. This uses gradient CSS syntax as the only mechanism available for an opacity fade — it introduces no second color, no decoration, no accent. Ruling (Task 2): kept as-is, not a §4 violation — flat-surfaces bans decorative/accent gradients, not a monochromatic functional fade. Documented here so it isn't rediscovered as a false positive mid-task.

---

### Task 1: Fix the thread list page's colors

**Files:**
- Modify: `src/app/(app)/think/page.tsx`

**Interfaces:** none — visual-only changes; `handleNewThread`'s and `handleDailyNote`'s behavior (what gets written to `color_accent`) changes value but not shape.

- [ ] **Step 1: Fix the stale gold default on new threads**

Replace:

```tsx
      .insert({
        user_id: userId,
        title: "Untitled Thread",
        color_accent: "#E5B41E",
        is_pinned: false,
      })
```

with:

```tsx
      .insert({
        user_id: userId,
        title: "Untitled Thread",
        color_accent: "#d97757",
        is_pinned: false,
      })
```

(`handleDailyNote`'s `color_accent: "#FBBF24"` is NOT changed — see investigation notes.)

- [ ] **Step 2: Re-token the Daily Note button's chrome**

Replace:

```tsx
          <Button
            variant="secondary"
            onClick={handleDailyNote}
            className="hidden !border-[rgba(251,191,36,0.25)] !bg-[rgba(251,191,36,0.12)] !text-[#FBBF24] hover:!bg-[rgba(251,191,36,0.2)] sm:flex"
          >
```

with:

```tsx
          <Button
            variant="secondary"
            onClick={handleDailyNote}
            className="hidden !border-[var(--accent-border)] !bg-[var(--accent-dim)] !text-[var(--accent)] hover:!bg-[var(--accent-dim-hover)] sm:flex"
          >
```

(This now matches the adjacent "New thread" button's exact token pattern.)

- [ ] **Step 3: Fix hardcoded white/red rgba values**

Run `grep -n "rgba(255,255,255\|rgba(248,113,113" src/app/(app)/think/page.tsx` to find every instance (expect around 5-6: the "Space" label color, two empty-state backgrounds, and two hover-delete-button backgrounds). For each:
- `rgba(255,255,255,0.35)` → `var(--text-muted)`
- `rgba(255,255,255,0.08)` (border contexts) → `var(--border-subtle)`
- `rgba(255,255,255,0.03)` (background contexts) → `var(--surface-1)`
- `text-red-400` (the hover-delete icon color) → `text-[var(--status-danger)]`
- `rgba(248,113,113,0.15)` (the hover-delete background) → `var(--status-danger)]/15` (Tailwind alpha-suffix syntax on the token, matching the pattern already used in `TaskCard.tsx` from the Do-space phase)

Apply the same token choice consistently everywhere the same literal value appears — don't pick a different token for the same literal in two different spots without a reason.

- [ ] **Step 4: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 errors, clean typecheck, tests pass. Known baseline note: this project has documented pre-existing flaky test suites (timeout-related, pass reliably in isolation) — if the only failure is one of those, rerun once to confirm, don't treat it as a blocker.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/think/page.tsx"
git commit -m "fix(think): replace hardcoded colors with tokens

Fixes the stale #E5B41E (old pre-overhaul gold) default written to
every newly-created thread's color_accent -- same bug class already
fixed elsewhere on main. Re-tokens the Daily Note button's chrome to
match the adjacent New Thread button. Daily Note's own stored default
color_accent (#FBBF24, amber) is deliberately left unchanged: it's a
legitimate distinct-thread-type signal that survives in the list
itself, consistent with the existing per-thread color-picker feature
this phase treats as a customization feature, not a violation."
```

---

### Task 2: Fix the thread detail page's colors

**Files:**
- Modify: `src/app/(app)/think/[id]/page.tsx`

**Interfaces:** none — visual-only changes.

This file is the most violation-dense touched so far this phase. Work through it systematically rather than line-by-line, since the same stale teal accent (`#2DD4BF` / `rgba(45,212,191,...)`) repeats across many unrelated UI elements.

- [ ] **Step 1: Replace every instance of the stale teal accent**

Run `grep -n "2DD4BF\|rgba(45,212,191" src/app/(app)/think/[id]/page.tsx` — expect roughly 8 instances across: the stale-prompt badge (border/background/icon/text), the pin button's active state (background/text), the entry-card hover border, and the submit button (background/text/hover).

For each, replace with the equivalent current-accent token:
- `#2DD4BF` (as a text/icon color) → `var(--accent)`
- `rgba(45,212,191,0.1)` / `rgba(45,212,191,0.15)` (as a background) → `var(--accent-dim)`
- `rgba(45,212,191,0.2)` / `rgba(45,212,191,0.25)` (as a hover background) → `var(--accent-dim-hover)`
- `rgba(45,212,191,0.2)` (as a border) → `var(--accent-border)`

Read each instance's surrounding context before replacing (some are in template literals inside `cn()`, some are plain `className` strings, some are inline `style` objects) — match the existing code's mechanism (className vs. style) rather than converting everything to one form.

- [ ] **Step 2: Replace hardcoded red/danger colors**

Run `grep -n "F87171\|rgba(248,113,113" "src/app/(app)/think/[id]/page.tsx"` — expect instances on the delete-thread button's hover state and the delete-entry button's hover state.

Replace `#F87171` → `var(--status-danger)`, `rgba(248,113,113,0.1)` → `var(--status-danger)]/10` (alpha-suffix syntax, matching the pattern used elsewhere this phase).

- [ ] **Step 3: Replace hardcoded white-rgba hover backgrounds**

Run `grep -n "rgba(255,255,255" "src/app/(app)/think/[id]/page.tsx"` — expect instances on the title input's hover/focus background and the mentions-popover's hover/selected background.

Replace `rgba(255,255,255,0.05)` → `var(--surface-hover)` (the existing token used elsewhere in this codebase for exactly this kind of subtle interactive-hover background — confirm it exists and produces a similar effect before using it; if it doesn't fit, `var(--surface-1)` is the fallback), `rgba(255,255,255,0.08)` (the popover's *selected* row, one shade stronger than hover) → `var(--surface-hover)` also, unless a stronger token exists for "selected" state specifically — check `globals.css` for a `--surface-selected` or similar before assuming `--surface-hover` covers both intensities; if only one token exists, both can reasonably use it since the visual difference was likely marginal anyway.

- [ ] **Step 4: Fix the linked-Explore-item dot color**

Replace:

```tsx
                  <div className="h-2 w-2 rounded-full bg-[#FBBF24]" />
```

with:

```tsx
                  <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
```

(This is decorative UI chrome — a status dot on a linked-resource chip — not stored per-thread data, so it follows the single-accent rule like everything else in this task.)

- [ ] **Step 5: Verify the color-picker palette and `thread.color_accent` usages are untouched**

Run `grep -n "FBBF24\|F472B6\|2DD4BF\|A78BFA\|60A5FA\|F87171" "src/app/(app)/think/[id]/page.tsx"` after Steps 1-4 — the ONLY remaining matches should be inside the color-picker's palette array (`["#FBBF24", "#F472B6", "#2DD4BF", "#A78BFA", "#60A5FA", "#F87171"]`) and the `style={{ backgroundColor: thread.color_accent }}` / `style={{ backgroundColor: c }}` bindings that render the picker itself. If any OTHER match remains outside those two contexts, Steps 1-4 missed something — go back and fix it.

- [ ] **Step 6: Confirm the bottom-bar gradient is left as-is**

No change needed to `bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/90 to-transparent` — see this plan's investigation notes for the ruling (monochromatic scroll-fade, not a decorative gradient). This step exists so the final review has an explicit record this was checked, not overlooked.

- [ ] **Step 7: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 errors, clean typecheck, tests pass (modulo known flaky suites).

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/think/[id]/page.tsx"
git commit -m "fix(think): replace stale teal accent and hardcoded colors

The thread detail page still used #2DD4BF (a pre-terracotta teal
accent) pervasively -- submit button, stale-prompt badge, pin-active
state, entry hover border -- predating even the Foundation phase's
token work. Also fixes hardcoded red/white-rgba/amber literals used as
UI chrome. The color-picker's 6-color palette and thread.color_accent
storage are deliberately untouched -- that's a real per-thread
customization feature, not a design-system violation."
```

---

### Task 3: Build the shared "stale, gently resurfaced" mechanic

**Files:**
- Create: the shared component/hook (exact filename TBD by this task — see Step 1)
- Modify: `src/app/(app)/think/page.tsx` — adopt the new shared piece for its stale-thread display (currently a hand-rolled block, see the `filteredThreads.filter((t) => t.stale_prompt)` section)

**Interfaces:**
- Produces: a reusable piece Remember's future phase can adopt for Locations' 30-day staleness check. Exact shape is this task's own design decision (see below) — no other task in this plan or elsewhere yet depends on its interface, so there's no pre-existing contract to match, only the general shape "something that can be given a staleness signal plus a message and render a consistent visual treatment."

This task is spec-mandated (§3: "Stale, gently resurfaced as one named, shared pattern, not two bespoke implementations... Unify into one mechanic in the design system (one component/hook, two call sites)"), but only ONE of the two call sites (Think) exists in the codebase today — Locations' staleness check hasn't been touched yet and belongs to a future phase. Build this generally enough for a second consumer to adopt later, without speculatively guessing at Locations' exact needs (YAGNI) — Locations' own future phase can extend this component's props if what's built here doesn't quite fit, rather than this task over-designing for an interface it can't yet verify against real code.

- [ ] **Step 1: Decide the component's shape and location**

Look at Think's current stale-thread rendering (`think/page.tsx`'s `filteredThreads.filter((t) => t.stale_prompt)` block, roughly lines 337-395 as of this plan's writing — confirm current line numbers, they may have shifted after Tasks 1-2's edits) to understand what varies per-item (the thread's title, its `stale_prompt` message, its link destination, its accent bar color) versus what's fixed (the "Stale Threads" section header, the card layout, the sparkle icon).

Decide between two shapes:
- **A display component** (e.g. `src/components/ui/StaleBadge.tsx` or similar) that takes a `message: string` prop and renders the consistent visual treatment (the small accent-colored badge/icon/text combination currently inline in the stale-prompt block) — the *data* (whether something is stale, and what the message says) stays computed by each call site (Think's `stale_prompt` column today, Locations' 30-day check later).
- **A hook** (e.g. `src/hooks/useStaleResurface.ts`) that also computes staleness from a timestamp + threshold, for call sites that don't already have a pre-computed message like Think's `stale_prompt` column does.

Given Think already has a pre-computed `stale_prompt` string (not a raw timestamp needing a staleness calculation), and this task's only real, verifiable requirement is Think's own call site, the display-component shape (option A) is the more grounded choice — it doesn't invent a staleness-calculation contract this task has no second example to validate against. Build the display component; do NOT also build a speculative staleness-calculation hook for a Locations use case this task can't see yet.

- [ ] **Step 2: Extract the component**

Create the component with a `message: string` prop (and whatever minimal additional props Think's actual current markup requires — e.g. a `className` passthrough if the existing inline JSX has layout-specific classes that shouldn't be baked into the shared component). Give it a real, descriptive name reflecting its purpose (e.g. `StaleResurfaceBadge`), not a Think-specific name like `ThreadStaleBadge` — the whole point is this isn't Think-specific.

Write the component using only the current design-system tokens (`--accent`, `--accent-dim`, etc.) — it should already be correct by construction since it's extracted from Task 2's already-fixed code, not copied from a pre-fix version.

- [ ] **Step 3: Adopt it in Think's list page**

Replace the current inline stale-badge markup in `think/page.tsx` with the new component, passing `thread.stale_prompt` as the `message` prop. Confirm the rendered output is visually identical to before this task (this is a pure extraction, not a redesign) by comparing the JSX structure before/after — same classes, same layout, just moved into a shared file.

- [ ] **Step 4: Write a test for the new component**

Check `ls src/components/ui/__tests__/ | grep -i stale` first — if this creates a genuinely new component, it needs a genuinely new test file following this codebase's established component-test conventions (check a sibling test like `src/components/ui/__tests__/BrandMark.tsx` or `GlassCard.test.tsx` for the pattern). At minimum: renders the given message, applies accent-family tokens (not hardcoded colors — a regression guard matching this whole phase's recurring theme).

- [ ] **Step 5: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 errors, clean typecheck, tests pass (modulo known flaky suites).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(think): extract the shared stale-resurface component

Spec asks for Think's stale_prompt display and Remember/Locations'
(not yet touched) 30-day staleness check to become one shared
pattern, not two bespoke implementations. Extracts the display
component now, with Think as its first and only current consumer --
Locations adopts it in Remember's future phase rather than this task
guessing at requirements it can't yet verify against real code."
```

---

## Post-Implementation

After Task 3, dispatch a final review covering the full diff across all 3 tasks. In particular check:
- No gradient (except the documented scroll-fade exception), blur, or glow survives anywhere in the two Think pages or the new shared component.
- No hardcoded hex/rgba remains OUTSIDE the color-picker palette array and `thread.color_accent`/`c` style bindings (Task 2 Step 5's grep, re-run against the final state).
- The extracted stale-resurface component is genuinely reusable (no Think-specific naming, no Think-specific data assumptions baked in) — read it fresh and ask "could Locations' future phase adopt this without a rename or a restructure, only new props if needed?"
- Both pages still function correctly: create a thread, create a Daily Note, add an entry, pin/archive/delete a thread, use the color picker, trigger a stale-prompt display if test data allows.

Then proceed to `superpowers:finishing-a-development-branch` for the merge/push decision, following the same gate discipline as the rest of this project.

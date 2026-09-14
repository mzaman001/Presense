# Phase 2c: Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/login` per spec §21's Sign-in section — an entirely new flat shell around the existing auth logic: the horizon-arc mark, Newsreader heading, a flat card, no gradient/blur anywhere on the page, and a re-measured (not assumed) JS bundle size.

**Architecture:** The auth logic (`actions.ts`, magic-link + Google OAuth, rate limiting, Turnstile) is untouched — this is a pure shell rebuild of `page.tsx`. The page currently renders `OnboardingBackground` behind a `backdrop-filter: blur(32px)` card using the old gradient-teardrop `PresenseLogo`; both get replaced. `OnboardingBackground.tsx` itself is left in place (Onboarding, a separate later task, still references it) — sign-in simply stops using it, rather than editing/deleting a component another still-unbuilt task depends on.

**Tech Stack:** Next.js 16.3 (App Router), React 19, Supabase Auth (magic link + Google OAuth), Tailwind v4, `next/font/google` (Newsreader, already loaded by an earlier phase).

**Spec:** `docs/superpowers/specs/2026-09-13-design-system-overhaul-design.md` §21 (Sign-in section), §4 (flat surfaces, no gradient/glow/glassmorphism), §6 (Newsreader), §14 (horizon-arc mark).

## Global Constraints

- No gradients, glows, or glassmorphism (blur) anywhere on this page. Flat backgrounds + hairline borders + flat shadow tokens only.
- No hardcoded hex colors or bare Tailwind palette classes — use `var(--token)`.
- The horizon-arc mark (`BrandMark`) replaces every use of the old gradient-teardrop `PresenseLogo` on this page.
- WCAG AA contrast for all text.
- `text-[var(...)]` bare-value + `text-[length:...]` collision: always use `text-[length:var(--text-x)]` when setting font-size via arbitrary value alongside a `text-[var(--color-x)]` on the same element.
- Every task ends in a state where `npm run lint`, `npx tsc --noEmit`, and `npm test` are clean.

## File Structure

- Modify: `src/app/(auth)/login/page.tsx` — the entire visual rebuild.
- No changes to: `src/app/(auth)/login/actions.ts`, `src/app/(auth)/login/layout.tsx`, `src/app/(auth)/layout.tsx`, `src/components/features/TurnstileWidget.tsx`, `src/components/layout/OnboardingBackground.tsx` (still used by the not-yet-rebuilt Onboarding flow).

## Investigation Notes (read before starting)

- **The spec's "~1.1MB JS" figure for `/login` may be stale.** `src/app/(auth)/login/actions.ts:20-21` carries a `PERF-10a` comment: "run login's auth calls server-side so supabase-js + zod never enter the public-route client bundle (chunk 5967, ~77.8 KiB gz)" — a prior performance pass already addressed part of this. Task 1 re-measures the actual current bundle before any task assumes what (if anything) still needs fixing, rather than trusting an old number.
- **`OnboardingBackground.tsx` is NOT already flat**, despite spec §21's Onboarding section saying the background "stays the static... treatment already shipped in the Foundation-phase fix." Reading the file: only its animation keyframes were removed in Foundation. It still has a radial-gradient base layer, a blurred radial "glow" layer (`filter: blur(60px)`, using the OLD gold/red palette `#E5B41E`/`#EB4233`, not the current terracotta accent), two blurred light-column gradients, a noise texture layer, and a gradient vignette. This is a real, unaddressed §4 violation — confirmed with the user, who chose to replace it with a flat treatment rather than reuse it. **Resolution for this task: sign-in stops using `OnboardingBackground` entirely** — no bespoke background component, the card sits on the page's own default flat surface. `OnboardingBackground.tsx` itself is left unmodified since Onboarding (a separate future task) still uses it and needs its own decision about the same question.
- **`BrandMark`'s `aria-hidden="true"` is fine here, no change needed.** It was flagged during Navigation as needing an escape hatch for contexts where the mark IS the accessible content. On this page the mark always sits directly next to the visible text "Presense" (same as the sidebar's tile pattern) — that adjacent text already carries the accessible name, so `aria-hidden` on the icon itself is correct, not a gap.
- **The card's existing tokens are already flat and don't need replacing** — `--surface-modal`, `--border-strong`, `--shadow-modal` (`globals.css:123,134,245` dark / `:350,361,408` light) are plain solid-color/rgba values, no gradient or blur baked in. The only change needed on the card itself is removing the inline `backdropFilter: "blur(32px)"`.
- **`.input` (globals.css:797-812) is already a flat, token-based style** — no changes needed to the email field itself.
- **The Button component is already flat** (`src/components/ui/button.tsx:7`: "Flat variants only — no gradients, no glow shadows") — the existing `variant="primary"`/`variant="secondary"` usage on this page needs no changes.

---

### Task 1: Measure the current `/login` bundle before changing anything

**Files:**
- No file changes — this task only produces a measurement to ground Task 2's decision.

**Interfaces:** none.

This task exists because the spec's "~1.1MB" figure may already be partly fixed (see investigation notes), and guessing at a fix without a current number risks solving a problem that no longer exists, or missing the real one.

- [ ] **Step 1: Build the app in production mode**

Run: `npm run build`

Expected: succeeds, prints a route table.

- [ ] **Step 2: Measure `/login`'s actual shipped JS**

Run: `npm start` in one terminal (or reuse the project's existing `check:budgets` flow if already wired for this), then in another terminal:

```bash
curl -s http://localhost:3000/login -o /dev/null -w "html: %{size_download} bytes\n"
```

Then use the browser (Playwright, or the project's Browser-pane tooling) to load `http://localhost:3000/login`, open the Network tab equivalent (`read_network_requests` if using the Browser-pane MCP tools), filter to JS, and sum the transferred sizes of every request whose initiator chain includes `/login`. Record the total in your report.

If the project's `npm run check:budgets` script (see `package.json`) already measures per-route JS, prefer running that over manual curl/network-tab work — read `package.json`'s `check:budgets` script definition first to see what it measures and whether `/login` is one of its tracked routes.

- [ ] **Step 3: Report the number**

Write the measured current `/login` JS total (and how you measured it) to your task report. This number is the input Task 2 uses to decide whether any further code-splitting/lazy-loading work is warranted beyond the visual rebuild, or whether the visual rebuild's own import cleanup (Task 2 removes `OnboardingBackground` and `PresenseLogo` from this page's import graph) already resolves it.

- [ ] **Step 4: Commit**

No code changes in this task — nothing to commit. Proceed directly to Task 2 with the measurement in hand.

---

### Task 2: Rebuild `/login`'s visual shell

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `BrandMark` (`import { BrandMark } from "@/components/ui/BrandMark"`, `size?: number`, `className?: string`, already exists from Phase 2 Navigation work), `Button` (`@/components/ui/button`, unchanged), `sendMagicLink`/`startGoogleSignIn` (`./actions`, unchanged), `TurnstileWidget` (`@/components/features/TurnstileWidget`, unchanged), the `font-heading` Tailwind utility (already wired to Newsreader by the Home phase, `globals.css`'s `--font-heading` token).
- Produces: no new exports — this is a leaf page component.

- [ ] **Step 1: Remove the background and old logo**

In `src/app/(auth)/login/page.tsx`, remove the import:

```tsx
import {
  OnboardingBackground,
  PresenseLogo,
} from "@/components/layout/OnboardingBackground";
```

Replace it with:

```tsx
import { BrandMark } from "@/components/ui/BrandMark";
```

- [ ] **Step 2: Replace the page's outer structure**

Replace the return statement's opening structure:

```tsx
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      {/* Atmospheric background */}
      <OnboardingBackground phase={1} />

      {/* Centred glass card */}
      <div
        className="relative z-10 w-full max-w-[400px] rounded-[var(--radius-xl)] p-8"
        style={{
          background: "var(--surface-modal)",
          backdropFilter: "blur(32px)",
          border: "0.5px solid var(--border-strong)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
```

with:

```tsx
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-base)] p-4">
      {/* Centred card — flat, no gradient/blur behind it */}
      <div
        className="w-full max-w-[400px] rounded-[var(--radius-xl)] p-8"
        style={{
          background: "var(--surface-modal)",
          border: "0.5px solid var(--border-strong)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
```

(Note: `relative z-10` and `overflow-hidden` are dropped from the outer div along with the background layer they existed to support — there's no longer a `position: absolute` background element to stack above or clip.)

Update the closing structure at the end of the file to match — the outer `</div>` count stays the same (one wrapping div, one card div), just confirm no stray `</div>` is left over from the removed background element (there wasn't one — `OnboardingBackground` was a self-closing component, not a wrapping one).

- [ ] **Step 3: Replace the logo + wordmark header**

Replace:

```tsx
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2.5">
          <PresenseLogo size={28} />
          <span
            className="text-title-lg font-semibold tracking-tight"
            style={{ color: "var(--text-1)" }}
          >
            Presense
          </span>
        </div>
```

with:

```tsx
        {/* Mark + wordmark */}
        <div className="mb-8 flex items-center gap-2.5 text-[var(--accent)]">
          <BrandMark size={28} />
          <span className="text-title-lg font-heading font-semibold tracking-tight text-[var(--text-1)]">
            Presense
          </span>
        </div>
```

(`BrandMark` renders via `currentColor`, so the wrapping div's `text-[var(--accent)]` colors the mark; the wordmark span overrides its own `color` back to `--text-1` since it shouldn't be accent-colored, matching how the sidebar brand tile already does this.)

- [ ] **Step 4: Apply Newsreader to the "Sign in" heading**

Replace:

```tsx
              <h1
                className="mb-1 text-[22px] font-semibold tracking-tight"
                style={{ color: "var(--text-1)" }}
              >
                Sign in
              </h1>
```

with:

```tsx
              <h1 className="font-heading mb-1 text-[22px] font-semibold tracking-tight text-[var(--text-1)]">
                Sign in
              </h1>
```

- [ ] **Step 5: Fix the hardcoded `#2DD4BF` in the "email sent" state**

Replace:

```tsx
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: "rgba(45,212,191,0.10)",
                border: "0.5px solid rgba(45,212,191,0.25)",
              }}
            >
              <UiIcon
                size={22}
                strokeWidth={1.5}
                className="text-[#2DD4BF]"
                icon={Mail}
              />
            </div>
```

with:

```tsx
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: "var(--status-done-dim)",
                border: "0.5px solid var(--accent-border)",
              }}
            >
              <UiIcon
                size={22}
                strokeWidth={1.5}
                className="text-[var(--status-done)]"
                icon={Mail}
              />
            </div>
```

(`--status-done`/`--status-done-dim` already exist as tokens — `globals.css:190-191` dark / equivalent light block — and read correctly as "success" for a confirmation state; teal had no other meaning on this page, it was just an unconverted leftover color.)

- [ ] **Step 6: Run lint and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Run the full unit suite**

Run: `npm test`
Expected: PASS. Known baseline note: this project has two documented pre-existing flaky test suites (`src/lib/__tests__/challenger.test.tsx` and `src/app/(auth)/login/actions.test.ts`, both timeout-related, both pass reliably in isolation) — if either is the ONLY failure, rerun once to confirm it's the known flake, not a regression, and note it in your report rather than treating it as a blocker. Any OTHER failure is real. `login/actions.test.ts` specifically tests `actions.ts`, which this task does not modify — a failure there deserves extra scrutiny before being dismissed as the known flake.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(auth)/login/page.tsx"
git commit -m "feat(login): rebuild the sign-in shell flat

Replaces the blurred glass card over OnboardingBackground's gradient
glow with a flat card on the page's own background — no gradient, no
blur anywhere on the page now. Swaps the old gradient-teardrop
PresenseLogo for the horizon-arc BrandMark, applies Newsreader to the
heading, and fixes the last hardcoded hex color (#2DD4BF) on the
email-sent confirmation icon. Auth logic (actions.ts) is untouched."
```

---

### Task 3: Act on Task 1's bundle measurement

**Files:** depends on Task 1's finding — see below.

**Interfaces:** none known in advance; determined by what Task 1 measured.

This task's content depends on Task 1's report:

- **If Task 1's measured total is already small** (roughly in line with `PERF-10a`'s ~77.8 KiB figure, not the spec's old ~1.1MB) — the prior perf fix already solved this, and Task 2's own import cleanup (dropping `OnboardingBackground`/`PresenseLogo` from the page, both of which had no heavy dependencies themselves, so this is unlikely to move the number much either way) is sufficient. In this case: **skip implementation**, write a short report confirming the current number and citing Task 1's measurement, and treat this task as complete with no code changes. Do not invent bundle work to justify the task's existence.
- **If Task 1's measured total is still large** (closer to the spec's ~1.1MB figure) — investigate what's actually contributing (a from-scratch audit: check the Network tab's JS requests' initiator chains, or run `next build` with `ANALYZE=true` if the project has `@next/bundle-analyzer` configured — check `package.json`/`next.config.ts` first for whether this exists before assuming it needs installing). Identify the specific heavy import(s) and propose a fix (commonly: a client-only dependency that could be dynamically imported, or a shared layout/provider pulling in more than `/login` needs). Report the finding and the fix as a normal task — write the code, verify the bundle shrinks by re-measuring with the same method Task 1 used, and commit.

**Whichever branch applies:** run `npm run lint && npx tsc --noEmit && npm test` before considering the task done (only if code was changed; skip for the no-op branch since nothing changed to verify).

- [ ] **Step 1: Read Task 1's report and branch accordingly** (see above)
- [ ] **Step 2: If code changes were made, verify the gates and commit**

```bash
git add -A
git commit -m "perf(login): <specific description of what was fixed, filled in by whoever executes this task based on Task 1's finding>"
```

If no code changes were needed, skip the commit — there's nothing to commit, and an empty commit would misrepresent this task as having done work it didn't need to do.

---

## Post-Implementation

After Task 3, dispatch a final review covering the full diff across Tasks 1-3 together (or, if Task 3 made no code changes, Task 2's diff alone — the plan's own scope, not padded to match a template). In particular check:
- No gradient, blur, or glow survives anywhere on `/login`'s rendered output (grep the final `page.tsx` for `gradient|blur|glow`, and confirm `OnboardingBackground` is no longer imported).
- No hardcoded hex colors remain in `page.tsx`.
- The Google OAuth button and magic-link flow still work end-to-end — this requires either a live Supabase-backed manual check (navigate to `/login`, submit an email, confirm no console errors and the "email sent" state renders) or, if credentials aren't available in the review environment, an explicit note that this specific check couldn't be performed and should happen before merge.
- If Task 3 made bundle-size changes, confirm the re-measurement in its report used the same method as Task 1's baseline (an apples-to-oranges comparison — e.g. dev-mode vs. production-mode numbers — would be meaningless).

Then proceed to `superpowers:finishing-a-development-branch` for the merge/push decision, following the same gate discipline as Navigation and Home (tests green → present the 3-option menu → wait for explicit approval).

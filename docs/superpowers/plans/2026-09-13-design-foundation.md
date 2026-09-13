# Design System Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Presense's three-theme, glass/ambient-orb design system with the flat, single-theme (light="sunrise" / dark="sunset"), one-accent foundation from the design spec, and land the first two shadcn/Radix-pattern core components (Button, Dialog) on it.

**Architecture:** This is Phase 1 of a multi-phase rollout (see spec §18). It touches only the shared foundation — CSS custom properties in `globals.css`, the theme normalizer, the ambient-background system, and two core components (`Button`, a new `Dialog`). It does **not** touch page-level bespoke styling in `Navigation.tsx`, `Dropdown.tsx`, `TaskAddPanel.tsx`, etc. — those get their own visual treatment in the Home/Do/Remember/Think plans that follow, once they can build on this foundation. Expect the app to look "re-colored but not yet re-laid-out" after this phase — that's correct, not incomplete.

**Tech Stack:** Next.js 16 / React 19 / Tailwind CSS 4 (`@theme` + CSS custom properties) / `class-variance-authority` / `@radix-ui/react-dialog` (new dependency) / Vitest / `@axe-core/playwright`.

**Spec:** `docs/superpowers/specs/2026-09-13-design-system-overhaul-design.md` (§3 one-accent aliasing rationale below extends §4/§6/§7; §5 component foundation; §10 modals).

## Global Constraints

- Never write a one-off hex value or inline color in a `.tsx` file — every color is a `var(--token)` reference (AGENTS.md §3).
- Touch targets stay ≥44px primary, ≥36px otherwise (AGENTS.md §3 / spec §12).
- `env.ts` must never throw; `MotionProvider` keeps `LazyMotion domMax strict`; RLS/migration invariants in AGENTS.md §2 are unaffected by this plan (no schema changes).
- Every step must leave `npm run build`, `npx tsc --noEmit`, `npm test`, and `npm run lint` green before moving to the next task.
- No gradients, glow, glassmorphism (`backdrop-filter`), or per-space rainbow accents in anything this plan touches — flat surfaces, hairline borders, one accent color, per spec §4/§6.
- Working tree is CRLF (AGENTS.md §4) — if your editor writes LF, run the repo's formatter (`prettier --write`, already wired via lint-staged) before committing so diffs don't turn into whole-file rewrites.

---

## Decisions this plan locks in (not fully spelled out in the spec — stated here so later phases build on the same base)

1. **Per-space identity colors (`--space-do`, `--space-think`, `--space-remember`, `--space-explore`) are aliased to the single accent**, not deleted outright. The spec's "one accent color... never used decoratively" (§4) means the four-hue-per-space system (`docs/project/DESIGN_SYSTEM.md`'s old pillar 2) is retired, but ~10 files read these tokens today (`Navigation.tsx`, `Badge.tsx`, the Home bento tiles, `checkbox.checked`). Aliasing (`--space-do: var(--accent)`) satisfies "one accent" everywhere at once without a breaking, multi-file rename — those call sites get real per-page redesign in their own later plan.
2. **The three-theme system (`warm`/`navy`/`forest`) is retired to one theme**, exactly as spec §4/§6 specify. `normalizeThemeId()` already has a legacy-value fallback pattern (`LEGACY_THEME_MAP`) from a past theme migration — this plan reuses that same pattern rather than inventing a new one: any input, including previously-valid `"navy"`/`"forest"`, normalizes to `"warm"` (kept as the one internal id name to avoid a type-rename touching 4 files; it now means "the one theme," not "the warm one of three").
3. **Headline typeface stays `Inter`-only in this plan.** The spec (§6) explicitly defers the headline serif/display choice to a real side-by-side preview. This plan does not add a second typeface — that's a follow-up task once the choice is made, so Foundation doesn't get blocked on an open design decision.
4. **Dialog migration is proved, not completed.** This plan adds the new `Dialog` primitive and migrates `ConfirmModal` (the smallest, self-contained consumer) to it. `Sheet.tsx` itself is left in place and untouched — per AGENTS.md §2.5, nothing gets deleted without proving it's unreferenced first, and other consumers of `Sheet` aren't part of this plan's scope.

---

### Task 1: Flat, single-theme color tokens in `globals.css`

**Files:**
- Modify: `src/app/globals.css:100-174` (background/orb/surface/border/text/accent/space token block inside `:root`)
- Modify: `src/app/globals.css:369-420` (`:root[data-mode="light"]` overrides)
- Modify: `src/app/globals.css:455-506` (second `:root[data-mode="light"]` accent block — yes, there are two light-mode blocks today; they get merged into one)
- Delete: `src/app/globals.css:508-691` (`:root[data-theme="navy"]`, `:root[data-theme="navy"][data-mode="light"]`, `:root[data-theme="forest"]`, `:root[data-theme="forest"][data-mode="light"]` blocks, in full)
- Test: `src/lib/__tests__/theme.test.ts` (Task 3 updates this — token values aren't unit-testable in jsdom, so this task's own verification is the build + a manual contrast check, see Step 5)

**Interfaces:**
- Produces: every color token consumed by the rest of the app (`--bg-base`, `--surface-1`/`-2`/`-hover`/`-active`, `--border-subtle`/`-default`/`-strong`, `--text-1`/`-2`/`-3`/`-muted`, `--accent`/`-hover`/`-dim`/`-dim-hover`/`-border`, `--text-on-accent`, `--space-do`/`-think`/`-remember`/`-explore`/`-inbox`) — unchanged names, new values, so no consuming `.tsx` file needs to change in this task.

- [ ] **Step 1: Replace the dark-mode (`:root`) token block**

  In `src/app/globals.css`, find the block starting at `/* === BACKGROUND SYSTEM === */` (currently line ~100) and ending just before `/* === STATUS COLOURS === */` (currently line ~176 — the status colors are untouched, they're a separate semantic category from the brand accent). Replace that whole span with:

  ```css
  /* === BACKGROUND SYSTEM — "sunset" (dark) === */
  --bg-base: #17140f;
  --bg-elevated: #1d1913;
  --bg-overlay: rgba(23, 20, 15, 0.85);
  --bg-backdrop: rgba(0, 0, 0, 0.5);

  /* === SURFACE SYSTEM — flat, opacity-stacked, no blur === */
  --surface-1: rgba(255, 255, 255, 0.03);
  --surface-2: rgba(255, 255, 255, 0.05);
  --surface-3: rgba(255, 255, 255, 0.07);
  --surface-hover: rgba(255, 255, 255, 0.06);
  --surface-active: rgba(255, 255, 255, 0.08);
  --surface-sidebar: var(--bg-base);
  --surface-modal: var(--bg-elevated);
  --surface-dropdown: var(--bg-elevated);
  --surface-toast: var(--bg-elevated);
  --surface-input: rgba(255, 255, 255, 0.04);
  --surface-input-focus: rgba(255, 255, 255, 0.06);
  --surface-card: rgba(255, 255, 255, 0.03);
  --surface-card-hover: rgba(255, 255, 255, 0.05);

  /* === BORDER SYSTEM === */
  --border-subtle: rgba(242, 236, 225, 0.08);
  --border-default: rgba(242, 236, 225, 0.12);
  --border-strong: rgba(242, 236, 225, 0.2);
  --border-focus: rgba(217, 119, 87, 0.6);
  --border-input: rgba(242, 236, 225, 0.14);
  --border-input-focus: rgba(217, 119, 87, 0.5);
  --border-card: rgba(242, 236, 225, 0.1);
  --border-card-top: rgba(242, 236, 225, 0.14);

  /* === TEXT SYSTEM === */
  --text-1: #f2ece1;
  --text-2: rgba(242, 236, 225, 0.75);
  --text-3: rgba(242, 236, 225, 0.55);
  --text-muted: rgba(242, 236, 225, 0.5);
  --text-decorative: rgba(242, 236, 225, 0.35);
  --text-on-accent: #17140f;
  --text-on-accent-muted: rgba(23, 20, 15, 0.7);

  /* === ACCENT SYSTEM — one accent, "ember" for dark mode === */
  --accent: #d97757;
  --accent-hot: #e4886a;
  --accent-deep: #a35835;
  --accent-dim: rgba(217, 119, 87, 0.12);
  --accent-dim-hover: rgba(217, 119, 87, 0.18);
  --accent-glow: rgba(217, 119, 87, 0.2);
  --accent-border: rgba(217, 119, 87, 0.35);
  --accent-text: #d97757;

  /* Per-space identity is retired in favor of one accent (spec §4) —
     aliased, not deleted, so existing consumers keep working unchanged
     until each space gets its own redesign pass. */
  --space-do: var(--accent);
  --space-do-dim: var(--accent-dim);
  --space-do-border: var(--accent-border);
  --space-think: var(--accent);
  --space-think-dim: var(--accent-dim);
  --space-think-border: var(--accent-border);
  --space-remember: var(--accent);
  --space-remember-dim: var(--accent-dim);
  --space-remember-border: var(--accent-border);
  --space-explore: var(--accent);
  --space-explore-dim: var(--accent-dim);
  --space-explore-border: var(--accent-border);
  --space-inbox: var(--text-3);
  ```

- [ ] **Step 2: Replace the two light-mode override blocks with one merged block**

  Find `:root[data-mode="light"] { ... }` (currently ~line 369) — it currently has two separate occurrences in the file (one early with backgrounds/surfaces/borders/text, a second later with just accent/space/shadow overrides). Delete the **second** occurrence entirely (currently ~line 455, the one starting right after the `.dropdown-separator` rule) and replace the **first** occurrence's full contents with:

  ```css
  :root[data-mode="light"] {
    /* === BACKGROUND SYSTEM — "sunrise" (light) === */
    --bg-base: #f6f2ec;
    --bg-elevated: #efe8dc;
    --bg-overlay: rgba(246, 242, 236, 0.85);
    --bg-backdrop: rgba(255, 255, 255, 0.5);

    /* === SURFACE SYSTEM === */
    --surface-1: #ffffff;
    --surface-2: #fbf7f0;
    --surface-3: #f6f0e5;
    --surface-hover: #f1ebdf;
    --surface-active: #eae2d2;
    --surface-sidebar: var(--bg-base);
    --surface-modal: var(--bg-elevated);
    --surface-dropdown: var(--bg-elevated);
    --surface-toast: var(--bg-elevated);
    --surface-input: rgba(33, 29, 23, 0.04);
    --surface-input-focus: rgba(33, 29, 23, 0.06);
    --surface-card: #ffffff;
    --surface-card-hover: #fbf7f0;

    /* === BORDER SYSTEM === */
    --border-subtle: rgba(33, 29, 23, 0.08);
    --border-default: rgba(33, 29, 23, 0.14);
    --border-strong: rgba(33, 29, 23, 0.24);
    --border-focus: rgba(156, 74, 46, 0.6);
    --border-input: rgba(33, 29, 23, 0.16);
    --border-input-focus: rgba(156, 74, 46, 0.5);
    --border-card: rgba(33, 29, 23, 0.1);
    --border-card-top: rgba(255, 255, 255, 0.6);

    /* === TEXT SYSTEM === */
    --text-1: #211d17;
    --text-2: rgba(33, 29, 23, 0.72);
    --text-3: rgba(33, 29, 23, 0.55);
    --text-muted: rgba(33, 29, 23, 0.5);
    --text-decorative: rgba(33, 29, 23, 0.35);
    --text-on-accent: #ffffff;
    --text-on-accent-muted: rgba(255, 255, 255, 0.8);

    /* === ACCENT SYSTEM — one accent, "dawn" for light mode ===
       Deeper than the dark-mode accent on purpose: white text on this
       value needs to clear 4.5:1 body-text contrast (verified in Step 5),
       which a brighter terracotta would not. */
    --accent: #9c4a2e;
    --accent-hot: #863e27;
    --accent-deep: #6f3320;
    --accent-dim: rgba(156, 74, 46, 0.08);
    --accent-dim-hover: rgba(156, 74, 46, 0.14);
    --accent-glow: rgba(156, 74, 46, 0.15);
    --accent-border: rgba(156, 74, 46, 0.28);
    --accent-text: #9c4a2e;

    --space-do: var(--accent);
    --space-do-dim: var(--accent-dim);
    --space-do-border: var(--accent-border);
    --space-think: var(--accent);
    --space-think-dim: var(--accent-dim);
    --space-think-border: var(--accent-border);
    --space-remember: var(--accent);
    --space-remember-dim: var(--accent-dim);
    --space-remember-border: var(--accent-border);
    --space-explore: var(--accent);
    --space-explore-dim: var(--accent-dim);
    --space-explore-border: var(--accent-border);
    --space-inbox: var(--text-3);

    /* === SHADOW SYSTEM — flat mode uses shadows only for real elevation
       (dialogs), never for glow === */
    --shadow-card: 0 1px 2px rgba(33, 29, 23, 0.06);
    --shadow-card-hover: 0 2px 8px rgba(33, 29, 23, 0.1);
    --shadow-modal: 0 16px 48px rgba(33, 29, 23, 0.18);
    --shadow-dropdown: 0 4px 16px rgba(33, 29, 23, 0.12);
    --shadow-toast: 0 4px 16px rgba(33, 29, 23, 0.12);
    --shadow-accent-glow: none;
    --shadow-button-primary: none;
    --shadow-button-primary-hover: none;

    /* === TOGGLE === */
    --toggle-track-off: rgba(33, 29, 23, 0.15);
    --toggle-track-on: var(--accent);
    --toggle-thumb: #ffffff;

    /* === SCROLLBAR === */
    --scrollbar-thumb: rgba(33, 29, 23, 0.14);
    --scrollbar-thumb-hover: rgba(33, 29, 23, 0.24);

    --noise-opacity: 0;
    color-scheme: light;
  }
  ```

  Also update the matching dark-mode shadow block inside the main `:root` (the existing `/* === SHADOW SYSTEM === */` section, ~line 272) to remove glow:

  ```css
  /* === SHADOW SYSTEM — flat mode uses shadows only for real elevation
     (dialogs), never for glow === */
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-card-hover: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-modal: 0 16px 48px rgba(0, 0, 0, 0.45);
  --shadow-dropdown: 0 4px 16px rgba(0, 0, 0, 0.35);
  --shadow-toast: 0 4px 16px rgba(0, 0, 0, 0.35);
  --shadow-accent-glow: none;
  --shadow-button-primary: none;
  --shadow-button-primary-hover: none;
  ```

- [ ] **Step 3: Delete the `navy` and `forest` theme blocks**

  Delete these four blocks from `src/app/globals.css` in full (search for the exact selectors — they're contiguous today but don't rely on line numbers after Steps 1–2 shift them):
  - `:root[data-theme="navy"] { ... }`
  - `:root[data-theme="navy"][data-mode="light"] { ... }`
  - `:root[data-theme="forest"] { ... }`
  - `:root[data-theme="forest"][data-mode="light"] { ... }`

- [ ] **Step 4: Run the build to confirm the CSS still compiles**

  Run: `npm run build`
  Expected: build succeeds (Tailwind v4's `@theme` block references these custom properties by name, not value, so removing unused theme blocks and changing values doesn't break compilation — if it fails, the error will name the missing/malformed property).

- [ ] **Step 5: Manual contrast spot-check**

  Run the dev server (`npm run dev`), open `/do` in both light and dark mode (toggle via the Settings appearance tab — still functional, just now only affects light/dark, not a 3-way theme). Confirm by eye: body text is clearly legible against the background in both modes, and accent-colored text (task category pills, active nav state) doesn't look washed out. This is a sanity check, not the final a11y gate — Task 6 runs the automated one.

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/globals.css
  git commit -m "feat: replace 3-theme glass tokens with flat sunrise/sunset foundation"
  ```

---

### Task 2: Remove the ambient orb/glass surface system

**Files:**
- Modify: `src/app/globals.css` (glass component classes and orb/noise system)
- Modify: `src/components/layout/AmbientBackground.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/onboarding/layout.tsx`
- Test: `src/components/layout/__tests__/AmbientBackground.test.tsx` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `AmbientBackground` becomes a no-op component (kept, not deleted, because deleting it would touch two layout files' imports for no behavioral gain right now — it renders `null`). Its removal from the tree entirely is a later cleanup candidate once nothing imports it, per AGENTS.md §2.5.

- [ ] **Step 1: Write the failing test for the no-op behavior**

  Create `src/components/layout/__tests__/AmbientBackground.test.tsx`:

  ```tsx
  import { render } from "@testing-library/react";
  import { describe, expect, test } from "vitest";
  import { AmbientBackground } from "@/components/layout/AmbientBackground";

  describe("AmbientBackground", () => {
    test("renders nothing — the ambient orb/glass system is retired", () => {
      const { container } = render(<AmbientBackground />);
      expect(container).toBeEmptyDOMElement();
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx vitest run src/components/layout/__tests__/AmbientBackground.test.tsx`
  Expected: FAIL — the current implementation renders `.ambient-bg`/`.orb`/`.noise-layer` divs, so `container` is not empty.

- [ ] **Step 3: Replace `AmbientBackground.tsx` with a no-op**

  Replace the full contents of `src/components/layout/AmbientBackground.tsx` with:

  ```tsx
  /**
   * The ambient orb/glass background system is retired (design overhaul
   * spec §4 — flat surfaces, no gradients/glow). Kept as a no-op rather
   * than deleted so `(app)/layout.tsx` and `onboarding/layout.tsx` don't
   * need an import removed in this pass — see AGENTS.md §2.5 ("prove
   * unreferenced first" applies to deleting the component itself, not to
   * emptying its body).
   */
  export function AmbientBackground() {
    return null;
  }
  ```

- [ ] **Step 4: Run the test to verify it passes**

  Run: `npx vitest run src/components/layout/__tests__/AmbientBackground.test.tsx`
  Expected: PASS

- [ ] **Step 5: Remove the orb/glass CSS from `globals.css`**

  Delete these rule blocks entirely from `src/app/globals.css`:
  - `/* === AMBIENT BACKGROUND SYSTEM === */` through the end of `@keyframes orb-breathe` (the `.ambient-bg`, `.orb`, `.orb-1`..`.orb-4`, `@keyframes orb-breathe` rules)
  - `.noise-layer { ... }`
  - `@keyframes orb-pulse`, `@keyframes drift-column`, `@keyframes glow-burst`, `.onboarding-glow-burst` (under the `/* ONBOARDING BACKGROUND KEYFRAMES */` heading)
  - The `.orb { display: none !important; }` rule inside the `@media (prefers-reduced-transparency: reduce)` block (the block itself stays — see Step 6)
  - The noise-image `::before` pseudo-element rules under `/* === GLASS CARD SYSTEM === */` (the block that starts `.glass-card::before, .glass-card-elevated::before, ...`) and the matching `::after` frost-fill block right after it
  - `--glass-noise` and the `--elev-*-frost` / `--elev-*-specular` custom properties (no longer referenced once the `::before`/`::after` rules above are gone)

  Then replace the surface-class definitions so they're flat (no `backdrop-filter`, no specular/frost, no glow shadow) — replace `.glass-panel`, `.glass-card`, `.glass-card-elevated`, `.modal`, `.dropdown-panel`, `[data-sonner-toast]`, `.sidebar`, `.mobile-top-bar`, `.bottom-nav`, `.mobile-drawer` with:

  ```css
  .glass-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    box-shadow: var(--shadow-card);
  }

  @layer components {
    .glass-card {
      background: var(--surface-card);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
      position: relative;
      transition:
        box-shadow var(--transition-base),
        border-color var(--transition-base),
        transform var(--transition-base);
    }

    .glass-card-elevated {
      background: var(--surface-card);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card-hover);
      position: relative;
    }

    .modal {
      background: var(--surface-modal);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-modal);
      position: relative;
    }

    [data-sonner-toast] {
      background: var(--surface-toast);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-toast);
      position: relative;
    }

    .dropdown-panel {
      background: var(--surface-dropdown);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-dropdown);
      position: relative;
      overflow: hidden;
    }

    .sidebar {
      background: var(--surface-sidebar);
      border-right: 1px solid var(--border-subtle);
    }

    .mobile-top-bar {
      background: var(--surface-sidebar);
      border-bottom: 1px solid var(--border-subtle);
      position: relative;
    }

    .bottom-nav {
      background: var(--surface-sidebar);
      position: relative;
    }

    .mobile-drawer {
      background: var(--surface-sidebar);
      position: relative;
      overflow: hidden;
    }
  }
  ```

  This removes every `contain: paint` / `backdrop-filter` pairing that existed purely to make the blur performant — with no blur, there's nothing to isolate, so those declarations go too, not just the blur itself. Leave `[data-sonner-toast][data-type="..."]` border-color overrides and the `.undo-toast::after` drain-bar rule later in the file as-is; they don't reference glass/blur tokens.

- [ ] **Step 6: Simplify the reduced-transparency media query**

  The `@media (prefers-reduced-transparency: reduce)` block exists entirely to fake opacity on top of blur/glass surfaces. With Step 5 done, surfaces are already opaque — delete the whole block (`@media (prefers-reduced-transparency: reduce) { ... }`, including its two nested `color-mix()` override sub-blocks and the `.orb { display: none !important; }` line inside it).

- [ ] **Step 7: Run build, lint, typecheck, and full test suite**

  Run: `npm run build && npm run lint && npx tsc --noEmit && npm test`
  Expected: all four pass. If `npm run lint` flags an unused CSS custom property reference (it won't — Tailwind/ESLint here don't lint CSS), skip; if `tsc` or `test` fail, the likely cause is a `.tsx` file importing something from the deleted CSS keyframe names (none exist — keyframes aren't imported in TS) — re-check Step 5's deletions match exactly what's listed if something breaks.

- [ ] **Step 8: Commit**

  ```bash
  git add src/app/globals.css src/components/layout/AmbientBackground.tsx src/components/layout/__tests__/AmbientBackground.test.tsx
  git commit -m "feat: remove ambient orb/glass surface system for flat design"
  ```

---

### Task 3: Retire the three-theme selector down to one theme

**Files:**
- Modify: `src/lib/theme.ts`
- Modify: `src/lib/__tests__/theme.test.ts`
- Modify: `src/components/features/SettingsModal.tsx:1034-1062` (the "Theme Accent" row in the Appearance tab)
- Modify: `AGENTS.md` (invariant 2)

**Interfaces:**
- Consumes: nothing new.
- Produces: `normalizeThemeId(value: unknown): ThemeId` — same signature, now always returns `"warm"` regardless of input. `ThemeId` type is left as `"warm" | "navy" | "forest"` (not narrowed to a single literal) so `AppInitializer.tsx` and `Navigation.tsx`, which read `document.documentElement.getAttribute("data-theme")` against a lookup keyed by these three ids, don't need a type-level change in this task — they still work because the attribute is always `"warm"` now and the `warm` entry in their lookup tables is what fires.

- [ ] **Step 1: Write the failing tests**

  Replace `src/lib/__tests__/theme.test.ts` in full with:

  ```ts
  import { describe, expect, test } from "vitest";
  import { DEFAULT_THEME_ID, normalizeThemeId } from "@/lib/theme";

  describe("theme migration", () => {
    test("there is one theme now — every input normalizes to warm", () => {
      expect(DEFAULT_THEME_ID).toBe("warm");
      expect(normalizeThemeId(undefined)).toBe("warm");
      expect(normalizeThemeId("")).toBe("warm");
      expect(normalizeThemeId("wahala")).toBe("warm");
      expect(normalizeThemeId("orange")).toBe("warm");
      expect(normalizeThemeId("sunset")).toBe("warm");
    });

    test("previously-valid navy and forest values also normalize to warm", () => {
      expect(normalizeThemeId("navy")).toBe("warm");
      expect(normalizeThemeId("blue")).toBe("warm");
      expect(normalizeThemeId("midnight")).toBe("warm");
      expect(normalizeThemeId("forest")).toBe("warm");
      expect(normalizeThemeId("meadow")).toBe("warm");
    });
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npx vitest run src/lib/__tests__/theme.test.ts`
  Expected: FAIL on the second test (`normalizeThemeId("navy")` currently returns `"navy"`, not `"warm"`).

- [ ] **Step 3: Update `normalizeThemeId`**

  In `src/lib/theme.ts`, replace the `normalizeThemeId` function body:

  ```ts
  /**
   * There is one theme now (design overhaul spec §4/§6 — the warm/navy/
   * forest selector is retired). Every input, including previously-valid
   * theme ids, normalizes to "warm" — the name is kept internally (rather
   * than renaming the type to a single literal) so callers that key a
   * lookup table by ThemeId, like the sidebar's avatar-accent fallback in
   * Navigation.tsx, don't need to change in this pass.
   */
  export function normalizeThemeId(_value: unknown): ThemeId {
    return DEFAULT_THEME_ID;
  }
  ```

  You can leave the `LEGACY_THEME_MAP` constant in place (it's now unused by `normalizeThemeId` but harmless) or delete it — delete it, since an unused exported-looking constant sitting next to the function it used to serve is exactly the kind of stale artifact that misleads the next reader:

  ```ts
  // Delete the LEGACY_THEME_MAP constant and its lookup usage.
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx vitest run src/lib/__tests__/theme.test.ts`
  Expected: PASS

- [ ] **Step 5: Remove the non-functional theme picker from Settings**

  In `src/components/features/SettingsModal.tsx`, replace the "Theme Accent" row (the `<div className="flex items-center justify-between ...">` block containing the three colored circular buttons for `warm`/`navy`/`forest`, roughly lines 1036–1062) — delete it entirely. Leave the "Color Mode" row immediately after it untouched (light/dark/system mode is unaffected by this task). If `normalizeThemeId` was only imported in this file for that row, remove the now-unused import too — check with:

  ```bash
  grep -n "normalizeThemeId" src/components/features/SettingsModal.tsx
  ```

  If no other usage remains in the file, delete the `normalizeThemeId` import line.

- [ ] **Step 6: Update AGENTS.md invariant 2**

  In `AGENTS.md`, find:
  ```
  2. `ThemeId` values are strictly `"warm" | "navy" | "forest"`.
  ```
  Replace with:
  ```
  2. There is one theme (light/dark only, per the 2026-09-13 design overhaul spec) — `normalizeThemeId()` always returns `"warm"` regardless of input. The `ThemeId` type still lists `"navy" | "forest"` for now because a handful of call sites key lookup tables by it; don't add new code that treats them as selectable themes.
  ```

- [ ] **Step 7: Run full verification**

  Run: `npm run build && npm run lint && npx tsc --noEmit && npm test`
  Expected: all pass.

- [ ] **Step 8: Commit**

  ```bash
  git add src/lib/theme.ts src/lib/__tests__/theme.test.ts src/components/features/SettingsModal.tsx AGENTS.md
  git commit -m "feat: retire the 3-theme selector, one theme going forward"
  ```

---

### Task 4: Flat `Button` component

**Files:**
- Modify: `src/components/ui/button.tsx`
- Test: `src/components/ui/__tests__/button.test.tsx` (new)

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`, `cva`/`VariantProps` from `class-variance-authority`, `Button as ButtonPrimitive` from `@base-ui/react/button` (kept — spec §5 says replace Base UI incrementally per-component as pages are rebuilt, not all at once; Button's own primitive swap is out of this task's scope).
- Produces: `Button` and `buttonVariants`, same export names, with `variant` narrowed to `"primary" | "secondary" | "ghost" | "danger"` (the old `"icon"` and `"preset"` variants are dropped — nothing in the codebase outside this file's own default exports must reference them; verified in Step 5) and `size` narrowed to `"default" | "sm" | "icon"`.

- [ ] **Step 1: Write the failing tests**

  Create `src/components/ui/__tests__/button.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, expect, test } from "vitest";
  import { Button } from "@/components/ui/button";

  describe("Button", () => {
    test("renders its label", () => {
      render(<Button>Save</Button>);
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    test("defaults to the primary variant with a flat accent background, no gradient", () => {
      render(<Button>Save</Button>);
      const button = screen.getByRole("button", { name: "Save" });
      expect(button.className).toContain("bg-[var(--accent)]");
      expect(button.className).not.toContain("gradient");
    });

    test("secondary variant is an outline, not filled", () => {
      render(<Button variant="secondary">Cancel</Button>);
      const button = screen.getByRole("button", { name: "Cancel" });
      expect(button.className).toContain("border-[var(--border-default)]");
      expect(button.className).toContain("bg-transparent");
    });

    test("ghost variant has no border and no background", () => {
      render(<Button variant="ghost">Dismiss</Button>);
      const button = screen.getByRole("button", { name: "Dismiss" });
      expect(button.className).toContain("bg-transparent");
      expect(button.className).not.toContain("border-[var(--border-default)]");
    });

    test("danger variant uses the status-danger token, not a hardcoded red", () => {
      render(<Button variant="danger">Delete</Button>);
      const button = screen.getByRole("button", { name: "Delete" });
      expect(button.className).toContain("var(--status-danger)");
    });
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npx vitest run src/components/ui/__tests__/button.test.tsx`
  Expected: FAIL — the current `primary` variant uses a `linear-gradient(...)` background, not `bg-[var(--accent)]`, so the "no gradient" assertion and the flat-background assertion both fail; `ghost` doesn't exist yet as a variant name.

- [ ] **Step 3: Rewrite `button.tsx`**

  Replace the full contents of `src/components/ui/button.tsx`:

  ```tsx
  import { Button as ButtonPrimitive } from "@base-ui/react/button";
  import { cva, type VariantProps } from "class-variance-authority";

  import { cn } from "@/lib/utils";

  /**
   * Flat variants only — no gradients, no glow shadows (design overhaul
   * spec §4). `icon` and `preset` variants from the old glass-era button
   * are retired; call sites needing an icon-only button use `size="icon"`
   * with `variant="ghost"` or `variant="secondary"` instead.
   */
  const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50",
    {
      variants: {
        variant: {
          primary:
            "bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hot)] active:bg-[var(--accent-deep)]",
          secondary:
            "bg-transparent border border-[var(--border-default)] text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] hover:text-[var(--text-1)]",
          ghost:
            "bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
          danger:
            "bg-transparent border border-[var(--status-danger-border)] text-[var(--status-danger)] hover:bg-[var(--status-danger-dim)]",
        },
        size: {
          default: "h-10 px-5 rounded-[var(--radius-md)] text-[var(--text-md)] font-medium gap-2",
          sm: "h-9 px-4 rounded-[var(--radius-md)] text-[var(--text-md)] font-medium gap-2",
          icon: "w-9 h-9 rounded-[var(--radius-md)]",
        },
      },
      defaultVariants: {
        variant: "primary",
        size: "default",
      },
    },
  );

  function Button({
    className,
    variant,
    size,
    ...props
  }: React.ComponentProps<typeof ButtonPrimitive> & VariantProps<typeof buttonVariants>) {
    return (
      <ButtonPrimitive
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }

  export { Button, buttonVariants };
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx vitest run src/components/ui/__tests__/button.test.tsx`
  Expected: PASS

- [ ] **Step 5: Find and fix every call site using a removed variant**

  Run:
  ```bash
  grep -rn 'variant="icon"\|variant="preset"\|variant=\x27icon\x27\|variant=\x27preset\x27' src --include="*.tsx"
  ```
  For each match, change it to `variant="ghost"` if it's a low-emphasis icon-only button (most cases), or `variant="secondary"` if it currently reads as an outlined/bordered control. Read each call site's surrounding JSX before deciding — don't batch-replace blindly.

- [ ] **Step 6: Run full verification**

  Run: `npm run build && npm run lint && npx tsc --noEmit && npm test`
  Expected: all pass. A `tsc` failure naming a `variant="icon"` or `variant="preset"` literal means Step 5 missed a call site — the type system will catch every one since the variant union is now narrower.

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/ui/button.tsx src/components/ui/__tests__/button.test.tsx
  git commit -m "feat: rebuild Button with flat variants, drop gradient/glow"
  ```

  If Step 5 touched other files, stage and commit those in the same commit (one focused change: "Button's variant API changed, and everything that used the old API" is one unit of work, not two).

---

### Task 5: `Dialog` primitive on Radix, migrate `ConfirmModal`

**Files:**
- Create: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/ConfirmModal.tsx`
- Modify: `package.json` (new dependency)
- Test: `src/components/ui/__tests__/dialog.test.tsx` (new)

**Interfaces:**
- Produces: `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` — the standard shadcn Dialog export shape, so later phases that need a dialog (settings, task add/edit, etc.) have a name to import without inventing a second dialog component.
- `DialogContent` renders as a **centered** dialog (spec §10 — centered dialogs are the default pattern, not bottom sheets), with `max-width` and vertical centering handled by the component itself, not by each call site.

- [ ] **Step 1: Install the dependency**

  Run: `npm install @radix-ui/react-dialog`

- [ ] **Step 2: Write the failing test**

  Create `src/components/ui/__tests__/dialog.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, expect, test } from "vitest";
  import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogClose,
  } from "@/components/ui/dialog";

  describe("Dialog", () => {
    test("is not in the document when closed", () => {
      render(
        <Dialog open={false}>
          <DialogContent>
            <DialogTitle>Delete task</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.queryByText("Delete task")).not.toBeInTheDocument();
    });

    test("renders its content when open", () => {
      render(
        <Dialog open>
          <DialogContent>
            <DialogTitle>Delete task</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.getByText("Delete task")).toBeInTheDocument();
      expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    });

    test("DialogClose calls onOpenChange(false)", () => {
      let openState = true;
      const handleOpenChange = (next: boolean) => {
        openState = next;
      };
      render(
        <Dialog open={openState} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogTitle>Delete task</DialogTitle>
            <DialogClose>Cancel</DialogClose>
          </DialogContent>
        </Dialog>,
      );
      fireEvent.click(screen.getByText("Cancel"));
      expect(openState).toBe(false);
    });
  });
  ```

- [ ] **Step 3: Run the test to verify it fails**

  Run: `npx vitest run src/components/ui/__tests__/dialog.test.tsx`
  Expected: FAIL with a module-not-found error for `@/components/ui/dialog`.

- [ ] **Step 4: Create `src/components/ui/dialog.tsx`**

  ```tsx
  "use client";

  import * as DialogPrimitive from "@radix-ui/react-dialog";
  import { X } from "lucide-react";

  import { cn } from "@/lib/utils";
  import { Icon as UiIcon } from "@/components/ui/Icon";

  const Dialog = DialogPrimitive.Root;
  const DialogTrigger = DialogPrimitive.Trigger;
  const DialogPortal = DialogPrimitive.Portal;
  const DialogClose = DialogPrimitive.Close;

  function DialogOverlay({
    className,
    ...props
  }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className={cn(
          "fixed inset-0 z-50 bg-[var(--bg-overlay)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className,
        )}
        {...props}
      />
    );
  }

  function DialogContent({
    className,
    children,
    showClose = true,
    ...props
  }: React.ComponentProps<typeof DialogPrimitive.Content> & {
    showClose?: boolean;
  }) {
    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            "modal fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-6",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className,
          )}
          {...props}
        >
          {children}
          {showClose && (
            <DialogPrimitive.Close
              className="absolute top-4 right-4 rounded-[var(--radius-sm)] p-1.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
              aria-label="Close"
            >
              <UiIcon size={16} icon={X} />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  }

  function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
      <div
        data-slot="dialog-header"
        className={cn("mb-4 flex flex-col gap-1.5", className)}
        {...props}
      />
    );
  }

  function DialogTitle({
    className,
    ...props
  }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
      <DialogPrimitive.Title
        data-slot="dialog-title"
        className={cn("text-[var(--text-title-lg)] font-medium text-[var(--text-1)]", className)}
        {...props}
      />
    );
  }

  function DialogDescription({
    className,
    ...props
  }: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
      <DialogPrimitive.Description
        data-slot="dialog-description"
        className={cn("text-[var(--text-body)] text-[var(--text-2)]", className)}
        {...props}
      />
    );
  }

  export {
    Dialog,
    DialogTrigger,
    DialogPortal,
    DialogClose,
    DialogOverlay,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
  };
  ```

  This reuses the `.modal` CSS class from Task 2 (flat background, border, shadow — no blur), so the dialog's surface treatment stays defined in one place (`globals.css`), not duplicated as inline Tailwind arbitrary values.

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npx vitest run src/components/ui/__tests__/dialog.test.tsx`
  Expected: PASS

- [ ] **Step 6: Migrate `ConfirmModal` to use `Dialog` instead of `Sheet`**

  Replace the full contents of `src/components/ui/ConfirmModal.tsx`:

  ```tsx
  import React from "react";
  import { Loader2 } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
  } from "@/components/ui/dialog";
  import { Icon as UiIcon } from "@/components/ui/Icon";

  interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmDestructive?: boolean;
    inputRequired?: string;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
  }

  export function ConfirmModal({
    isOpen,
    title,
    description,
    confirmLabel,
    confirmDestructive = false,
    inputRequired,
    onConfirm,
    onClose,
  }: ConfirmModalProps) {
    const [inputValue, setInputValue] = React.useState("");
    const [isConfirming, setIsConfirming] = React.useState(false);

    // Reset state when modal opens — intentional sync initialization
    /* eslint-disable react-hooks/set-state-in-effect */
    React.useEffect(() => {
      if (isOpen) {
        setInputValue("");
        setIsConfirming(false);
      }
    }, [isOpen]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const isConfirmDisabled = inputRequired ? inputValue !== inputRequired : false;

    const handleConfirm = async () => {
      if (isConfirmDisabled || isConfirming) return;
      setIsConfirming(true);
      try {
        await onConfirm();
        onClose();
      } catch {
        // Keep modal open on error so user can retry
      } finally {
        setIsConfirming(false);
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && !isConfirming && onClose()}>
        <DialogContent showClose={!isConfirming}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {inputRequired && (
            <div className="mb-6">
              <label className="mb-2 block text-xs font-semibold text-[var(--text-3)]">
                Type <span className="font-bold text-[var(--text-1)]">{inputRequired}</span> to
                confirm
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputRequired}
                disabled={isConfirming}
                className="input"
              />
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isConfirming}>
              Cancel
            </Button>
            <Button
              variant={confirmDestructive ? "danger" : "primary"}
              disabled={isConfirmDisabled || isConfirming}
              onClick={handleConfirm}
              className="inline-flex items-center gap-2"
            >
              {isConfirming && <UiIcon size={14} className="animate-spin" icon={Loader2} />}
              {confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  ```

- [ ] **Step 7: Run the full test suite and confirm no `ConfirmModal` consumer broke**

  Run: `npm test`
  Expected: PASS. `ConfirmModal`'s public props didn't change, so nothing calling it needs edits — this step is verifying that claim, not implementing anything new.

- [ ] **Step 8: Run full verification**

  Run: `npm run build && npm run lint && npx tsc --noEmit`
  Expected: all pass.

- [ ] **Step 9: Manual check — trash a task and confirm the dialog behaves correctly**

  Run the dev server, go to `/do`, delete a task via its row action, and confirm: the dialog appears centered (not as a bottom sheet), Escape closes it, clicking the overlay closes it, and confirming actually deletes the task. This exercises `ConfirmModal` end to end through its real call site.

- [ ] **Step 10: Commit**

  ```bash
  git add package.json package-lock.json src/components/ui/dialog.tsx src/components/ui/__tests__/dialog.test.tsx src/components/ui/ConfirmModal.tsx
  git commit -m "feat: add Radix Dialog primitive, migrate ConfirmModal off Sheet"
  ```

---

### Task 6: Automated accessibility gate on the foundation

**Files:**
- Modify: an existing Playwright a11y spec (find it first — see Step 1)

**Interfaces:**
- Consumes: whatever page-object/fixture pattern the existing a11y spec already uses.
- Produces: nothing new — this task extends existing coverage to confirm the new flat/single-accent tokens didn't regress contrast, rather than adding a parallel test file.

- [ ] **Step 1: Find the existing accessibility test setup**

  Run: `grep -rl "@axe-core/playwright\|injectAxe\|AxeBuilder" --include="*.ts" --include="*.tsx" . -- ':!node_modules'` (or, on Windows, `git ls-files | xargs grep -l "@axe-core/playwright"`) to locate the current spec file(s). Read whichever file(s) it finds in full before continuing.

- [ ] **Step 2: Add (or confirm existing) coverage for `/do`, `/login`, and the ConfirmModal dialog state, in both light and dark mode**

  Using the existing spec's own pattern (don't invent a second pattern), ensure there's a test that: navigates to `/do`, runs the axe scan once with `document.documentElement` in dark mode and once in light mode (however the existing suite toggles mode — likely by setting `data-mode` or clicking the existing Settings control), and asserts zero violations. If a test with this shape already exists, this step is "confirm it still passes," not "write a new one."

- [ ] **Step 3: Run the accessibility suite**

  Run: `npx playwright test <path-to-the-a11y-spec>`
  Expected: PASS in both modes. If it fails on a contrast violation involving `--accent`, `--text-3`, or `--text-muted` against `--bg-base`/`--surface-*`, that's this plan's Task 1 tokens under-shooting AA — go back and darken (light mode) or lighten (dark mode) the failing token by a small amount and re-run, rather than suppressing the check.

- [ ] **Step 4: Commit**

  ```bash
  git add <the spec file, if changed>
  git commit -m "test: confirm flat token foundation meets WCAG AA in both modes"
  ```

  If Step 2 required no changes (coverage already existed and just needed re-running), skip this commit — there's nothing to commit.

---

## Definition of done for this plan

- `npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build` all pass.
- The three-theme selector is gone from Settings; light/dark mode toggle still works.
- No `backdrop-filter`, ambient orb, or gradient/glow remains anywhere `grep -rn "backdrop-filter\|linear-gradient\|orb-" src/app/globals.css` touches, except any gradient inside an SVG data-URI unrelated to surfaces (there shouldn't be any left — verify the grep is clean).
- `Button` and `Dialog` exist on the flat/shadcn pattern and are ready for later-phase pages to adopt.
- The accessibility suite passes in both light and dark mode.
- Nothing outside this plan's file list was touched (Iron Law 1) — `git diff --stat main` (or your working branch's base) should show only the files named in this plan's tasks.

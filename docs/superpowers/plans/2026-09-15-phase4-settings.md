# Phase 4b: Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `SettingsModal.tsx` into design-system compliance and remove a confirmed dead setting. Despite the file's size (1724 lines, 9 tabs), the actual violations are concentrated in a handful of specific spots — this is not a pervasive rewrite like Think's detail page needed, it's a few precise fixes plus one real cleanup.

**Architecture:** One large modal component. The headline finding is that the modal's own outer surface still uses `backdropFilter: blur(48px)` — a genuine, significant §4 violation on the app's single most-used settings surface, predating this whole project's flat-surface work. Everything else is smaller: a few hardcoded rgba/hex colors, and one confirmed-dead setting (`ambient_bg`) that persists to the database and renders a working toggle in the UI but has zero effect anywhere in the app, since `AmbientBackground.tsx` was already neutered to a no-op during the Foundation phase.

**Tech Stack:** Next.js 16.3, React 19, `react-hook-form` + `zod` (settings form validation), Framer Motion, Supabase, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-13-design-system-overhaul-design.md` §4 (flat surfaces), §18 step 4 ("Settings, Trash, Inbox polish last"). The `ambient_bg` removal follows the original project brief's own explicit instruction: "duplicates or useless stuff deleted."

## Global Constraints

- No gradients, glows, or glassmorphism (blur) on any surface, with two named exceptions ruled on below (both already-established patterns from earlier phases, not new judgment calls).
- No hardcoded hex colors or hardcoded `rgba(255,255,255,...)`/`rgba(0,0,0,...)`/`rgba(11,9,20,...)` values — use `var(--token)`. **Exception**: the category-color and avatar-color preset palette arrays (literal hex arrays like `["#F87171", "#FBBF24", ...]`) are legitimate user-selectable palette values, the same class of exception already established for Think's thread color-picker and Remember's Locations color choices this project — do NOT tokenize these arrays themselves, only the UI chrome around them.
- **Exception**: the `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)` custom-color-picker trigger (a rainbow-wheel swatch button that opens a native `<input type="color">`) is a legitimate, widely-recognized UI convention for "pick any custom color" — it's informational, not decorative, the same reasoning already applied to Sign-in's monochromatic scroll-fade and Home's flat accent ring. Not touched by this plan.
- Never silently drop a database column (AGENTS.md convention, already applied to the People/Explore data-preservation decision earlier this project). `ambient_bg`'s removal in this plan is UI/runtime-only — the column stays in the schema untouched.
- Every task ends in a state where `npm run lint`, `npx tsc --noEmit`, and `npm test` are clean.

## File Structure

- Modify: `src/components/features/SettingsModal.tsx` — the entire scope of this plan.
- Modify: `src/lib/schemas.ts` — remove `ambient_bg` from the Zod validation schema.
- Modify: `src/store/useAppStore.ts` — remove the `ambient_bg` field from the settings type.
- No changes to: `src/types/database.types.ts` (generated from the live schema — the column stays; removing it from this file without an actual migration would just make the next `types:generate` run re-add it, and isn't this plan's job), any actual Supabase migration (out of scope — this plan stops writing/reading the field from the app, it does not drop the column).

## Investigation Notes (read before starting)

- **The modal's own `backdropFilter: blur(48px)` (SettingsModal.tsx:826-829) is the single most significant finding in this plan** — a real glassmorphism violation on the app's primary settings surface, predating the Foundation phase's flat-surface work entirely (it's on the outer `<m.div>` wrapping the whole modal, not a decorative sub-element). `--surface-modal` (already used by Sign-in's flattened card) is the direct, already-established replacement token.
- **`ambient_bg` is confirmed dead.** Grepped the full `src/` tree outside `SettingsModal.tsx`: it appears in `schemas.ts` (validation), `useAppStore.ts` (the type), and `database.types.ts` (the generated column type) — but NOTHING reads `userSettings.ambient_bg` to conditionally render anything. `AmbientBackground.tsx` (the component this setting was presumably meant to control) already unconditionally returns `null` regardless of this setting's value, per its own comment: "The ambient orb/glass background system is retired... kept as a no-op." Users can toggle "Show moving gradients in the background" (SettingsModal.tsx:1111, the toggle's own label copy) and observe zero effect — a real, confirmed UX bug, not a hypothetical one.
- **`reduce_motion` is a DIFFERENT, real, functioning setting** — do not confuse it with `ambient_bg` or remove it. `src/lib/theme.ts`'s `applyDocumentTheme` function takes and uses a `reduceMotion` parameter. Keep this setting and its toggle exactly as-is.
- **The avatar-color selection ring at SettingsModal.tsx:970** hardcodes `ring-offset-[rgba(11,9,20,1)]` — a near-black color that assumes dark mode, the inverse of the more common `rgba(255,255,255,...)`-assumes-dark-mode bug pattern already fixed repeatedly elsewhere this project. Same fix shape: replace with a token that resolves correctly in both themes.
- **The color-picker preset palettes (category colors at lines 248-255, avatar/relationship colors at lines 957-962) are NOT violations** — see Global Constraints. Two separate palette arrays exist (category colors: red/amber/green/teal/blue/purple/pink/gray; avatar colors: pink/green/blue/amber/purple/red) — both stay as literal hex arrays.

---

### Task 1: Flatten the modal's own surface

**Files:**
- Modify: `src/components/features/SettingsModal.tsx`

**Interfaces:** none — visual-only change.

- [ ] **Step 1: Replace the backdrop-blur with a flat surface**

Replace:

```tsx
            className="modal relative flex h-[100dvh] min-h-0 w-full max-w-4xl flex-col overflow-hidden md:h-[80vh] md:flex-row md:rounded-2xl"
            style={{
              backdropFilter: "blur(48px)",
              WebkitBackdropFilter: "blur(48px)",
            }}
```

with:

```tsx
            className="modal relative flex h-[100dvh] min-h-0 w-full max-w-4xl flex-col overflow-hidden md:h-[80vh] md:flex-row md:rounded-2xl"
            style={{
              background: "var(--surface-modal)",
              border: "0.5px solid var(--border-strong)",
              boxShadow: "var(--shadow-modal)",
            }}
```

(This matches Sign-in's already-flattened card exactly — same three tokens, same flat treatment, no blur.)

- [ ] **Step 2: Fix the hardcoded white-rgba border on the category-color-row hover state**

Replace:

```tsx
    <div className="group flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[rgba(255,255,255,0.2)]">
```

with:

```tsx
    <div className="group flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--border-strong)]">
```

- [ ] **Step 3: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 errors, clean typecheck, tests pass. Known baseline note: this project has documented pre-existing flaky test suites (timeout-related, pass reliably in isolation) — if the only failure is one of those, rerun once to confirm, don't treat it as a blocker.

- [ ] **Step 4: Commit**

```bash
git add src/components/features/SettingsModal.tsx
git commit -m "fix(settings): flatten the modal's own backdrop-blur surface

SettingsModal's outer container still used backdropFilter: blur(48px)
-- a real glassmorphism violation on the app's primary settings
surface, predating the Foundation phase's flat-surface work entirely.
Replaces it with the same --surface-modal/--border-strong/--shadow-modal
treatment already used by Sign-in's flattened card. Also fixes one
hardcoded white-rgba hover border on the category-color row."
```

---

### Task 2: Fix the remaining hardcoded colors

**Files:**
- Modify: `src/components/features/SettingsModal.tsx`

**Interfaces:** none.

- [ ] **Step 1: Fix the color-swatch active-ring border**

Replace:

```tsx
              style={{
                backgroundColor: preset,
                border: isActive
                  ? `2px solid white`
                  : `1px solid rgba(255,255,255,0.1)`,
                transform: isActive ? "scale(1.2)" : "scale(1)",
                opacity: isActive ? 1 : 0.5,
              }}
```

with:

```tsx
              style={{
                backgroundColor: preset,
                border: isActive
                  ? "2px solid var(--text-1)"
                  : "1px solid var(--border-subtle)",
                transform: isActive ? "scale(1.2)" : "scale(1)",
                opacity: isActive ? 1 : 0.5,
              }}
```

(The active-state ring's job is to be visible against an arbitrary preset swatch color — `--text-1` resolves to near-white in dark mode and near-black in light mode, the same high-contrast-against-either-background property the literal `white` was reaching for, but theme-correct instead of dark-mode-only.)

- [ ] **Step 2: Fix the danger-hover on the category delete button**

Replace:

```tsx
          className="row-actions ml-1 rounded-lg p-1.5 text-[var(--color-text-3)] transition-colors hover:bg-red-400/10 hover:text-red-400"
```

with:

```tsx
          className="row-actions ml-1 rounded-lg p-1.5 text-[var(--color-text-3)] transition-colors hover:bg-[var(--status-danger)]/10 hover:text-[var(--status-danger)]"
```

- [ ] **Step 3: Fix the avatar-color selection ring's hardcoded near-black offset**

Replace:

```tsx
                                className={`h-8 w-8 rounded-full transition-transform ${settings.avatar_color === color ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[rgba(11,9,20,1)]" : "opacity-70 hover:opacity-100"}`}
```

with:

```tsx
                                className={`h-8 w-8 rounded-full transition-transform ${settings.avatar_color === color ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-base)]" : "opacity-70 hover:opacity-100"}`}
```

(`--bg-base` is this project's standard page-background token — the ring-offset's job is to match whatever surface the swatch sits on, which `rgba(11,9,20,1)` was hardcoding as a dark-mode-only approximation of. `ring-white` itself is left as-is deliberately: same reasoning as Step 1, a fixed white ring reads as a universal "selected" indicator against arbitrary swatch colors — verify this visually in Task 3's check rather than assuming; if it reads poorly in light mode, that's a finding for the final review, not a guess to resolve now.)

- [ ] **Step 4: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 errors, clean typecheck, tests pass (modulo known flaky suites).

- [ ] **Step 5: Commit**

```bash
git add src/components/features/SettingsModal.tsx
git commit -m "fix(settings): replace remaining hardcoded colors with tokens

Color-swatch active-ring border, category-delete hover state, and the
avatar-color selection ring's offset color all hardcoded literals that
assumed one specific theme mode. Replaced with tokens that resolve
correctly in both."
```

---

### Task 3: Remove the dead `ambient_bg` setting

**Files:**
- Modify: `src/components/features/SettingsModal.tsx`
- Modify: `src/lib/schemas.ts`
- Modify: `src/store/useAppStore.ts`

**Interfaces:**
- Produces: `SettingsFormValues` (derived from `settingsSchema`) no longer has an `ambient_bg` field. `AUTOSAVE_FIELDS` no longer includes it.

- [ ] **Step 1: Remove the toggle UI**

In `SettingsModal.tsx`, find the "Show moving gradients in the background" toggle block (around line 1111, inside the Appearance tab's JSX — search for `updateSetting("ambient_bg"` to locate it precisely) and remove the entire surrounding `<div>` block (the one matching the pattern of the adjacent `reduce_motion` toggle's own wrapping `<div className="flex items-center justify-between rounded-xl border ...">` block, at roughly line 1123 — remove ONLY the `ambient_bg` block, leave the `reduce_motion` block immediately after it untouched).

- [ ] **Step 2: Remove `ambient_bg` from the component's own state/form wiring**

Remove `"ambient_bg"` from the `AUTOSAVE_FIELDS` array (line 68). Remove `ambient_bg?: boolean;` from the `SettingsState` interface (line 124). Remove the `ambientBgValue = useWatch({ control, name: "ambient_bg" })` line and its corresponding entry in whatever object/payload construction references `ambientBgValue` (search for `ambientBgValue` to find both — there should be exactly the `useWatch` declaration and one usage in a payload-building object).

- [ ] **Step 3: Remove `ambient_bg` from the Zod schema**

In `src/lib/schemas.ts`, remove the line `ambient_bg: z.boolean().optional(),` from `settingsSchema`.

- [ ] **Step 4: Remove `ambient_bg` from the store type**

In `src/store/useAppStore.ts`, remove the `ambient_bg?: boolean;` field from whichever interface declares it (search for `ambient_bg` to find the exact declaration).

- [ ] **Step 5: Verify no other consumer references `ambient_bg`**

Run `grep -rn "ambient_bg\|ambientBg" src/ --include="*.tsx" --include="*.ts"` — after this task's edits, the ONLY remaining matches should be in `src/types/database.types.ts` (the generated column type, deliberately left alone per this plan's Global Constraints — the database column itself is not being dropped). If any other file still references it, that's a real gap this step should have caught — go back and remove that reference too.

- [ ] **Step 6: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 errors, clean typecheck, tests pass (modulo known flaky suites). Pay particular attention to any existing test that references `ambient_bg` or the settings autosave-fields list — if one exists, update its assertions/fixtures to match the removal rather than deleting coverage wholesale.

- [ ] **Step 7: Commit**

```bash
git add src/components/features/SettingsModal.tsx src/lib/schemas.ts src/store/useAppStore.ts
git commit -m "fix(settings): remove the dead ambient_bg toggle

ambient_bg persisted to the database and rendered a working-looking
toggle ('Show moving gradients in the background'), but had zero
effect anywhere in the app -- AmbientBackground.tsx was already
neutered to an unconditional no-op during the Foundation phase, and
nothing else read this field. A toggle that does nothing is exactly
the 'duplicates or useless stuff' the original project brief asked to
remove. The database column itself is untouched (never silently drop
a column) -- this only stops the app from reading/writing/exposing it."
```

---

## Post-Implementation

After Task 3, dispatch a final review covering the full diff across all 3 tasks. In particular check:
- No `backdrop-filter`/`blur(` survives anywhere in the final file (the two named exceptions — the color-picker palette arrays and the conic-gradient custom-color trigger — are not gradient/blur violations and should not be flagged as if they were; confirm the final reviewer understands why, per this plan's own Global Constraints, rather than re-litigating them as new findings).
- No hardcoded `rgba(255,255,255|11,9,20,...)` or bare Tailwind `red-`/`amber-` palette classes remain outside the two named exceptions.
- `ambient_bg` is genuinely gone from every file except the generated `database.types.ts` — re-run the Step 5 grep against the final state, not just trust the task's own claim.
- Visually verify (if a real browser session is feasible in the review environment) that: the modal renders correctly flat in both light and dark mode with no visual regression from the blur removal; the avatar-color ring's white color still reads clearly as a "selected" indicator in light mode against a light-colored swatch, per Task 2 Step 3's explicit "verify, don't assume" note.

Then proceed to `superpowers:finishing-a-development-branch` for the merge/push decision, following the same gate discipline as the rest of this project.

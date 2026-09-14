# Phase 3c: Remember Space Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Locations "what Remember visibly means" (spec §3), fix hardcoded colors on the Locations page, adopt the shared `StaleResurfaceBadge` component for Locations' 30/90-day staleness check (the second of the spec's two intended consumers), and fix a real navigation bug the spec calls out by name (the "Remember" nav link resolving to `/remember/people`).

**Architecture:** Three independent surfaces. (1) The Locations page itself — color/token fixes plus adopting the shared stale-badge component, which needs a small, real extension (an interactive/clickable form) since Locations' "stale — still here?" affordance is a button, not a passive message like Think's. (2) The Remember layout/tab-switcher — reorder so Locations is the default/first tab, add a `/remember` index route so the bare path lands on Locations instead of 404ing, fix legacy tokens. (3) A nav-wide fix: 4 different files hardcode `/remember/people` as the generic "go to Remember" destination (the sidebar nav item, mobile drawer, a keyboard shortcut, and a search-result path) — all become `/remember/locations`, plus one active-state detection special-case that needs its condition updated, not just its target. **People's own pages (`remember/people/page.tsx`, `remember/people/[id]/page.tsx`) are explicitly NOT touched by this plan** — that space is scheduled for removal as its own separate rollout step (§18 step 5, not yet reached), and a full token/color pass on ~1100 lines of soon-to-be-deleted code would be wasted work, matching how this plan's own predecessors (Do's TaskAddPanel) already established the precedent of not doing deep work on adjacent-but-out-of-scope surfaces.

**Tech Stack:** Next.js 16.3, React 19, Framer Motion, TanStack Query, Supabase, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-13-design-system-overhaul-design.md` §3 ("Remember → Locations... gets more visual attention... stops being a buried sub-route"; "stale, gently resurfaced" unification naming Locations' 30-day check as the second consumer), §4 (flat surfaces), §9 (nav's "Remember" link "resolving to `/remember/people` specifically — which no longer exists post-cut" flagged as a known bug), §18 step 5 (People/Explore removal is its own future step, not bundled here).

## Global Constraints

- No gradients, glows, or glassmorphism (blur) on any surface.
- No hardcoded hex colors, bare Tailwind palette classes, or hardcoded `rgba(255,255,255,...)`/`rgba(0,0,0,...)` values — use `var(--token)`.
- **Do not touch `remember/people/page.tsx` or `remember/people/[id]/page.tsx`'s content.** People's pages stay reachable (the tab switcher keeps a People tab) but are out of scope for any visual/token work in this plan — see Architecture note above.
- Every task ends in a state where `npm run lint`, `npx tsc --noEmit`, and `npm test` are clean.

## File Structure

- Modify: `src/app/(app)/remember/locations/page.tsx` — color fixes, adopt `StaleResurfaceBadge`.
- Modify: `src/components/ui/StaleResurfaceBadge.tsx` — add an optional interactive (clickable) form.
- Modify: `src/app/(app)/remember/layout.tsx` — reorder tabs, fix legacy tokens.
- Create: `src/app/(app)/remember/page.tsx` — a redirect to `/remember/locations` (the bare `/remember` route currently has no page and 404s).
- Modify: `src/components/layout/Navigation.tsx`, `src/components/layout/MobileDrawer.tsx`, `src/components/layout/AppContentWrapper.tsx`, `src/components/features/SearchModal.tsx` — fix the `/remember/people` generic-destination bug.
- No changes to: `src/app/(app)/remember/people/page.tsx`, `src/app/(app)/remember/people/[id]/page.tsx`, `src/components/features/AddPersonPanel.tsx`.

## Investigation Notes (read before starting)

- **Locations' staleness UI is exactly the spec's named second consumer for `StaleResurfaceBadge`** — but it's richer than Think's passive display. Two tiers: 30-89 days shows a clickable "Stale · Still here" button (marks the item as touched, resetting the clock); 90+ days shows a passive "Probably moved?" label with no interaction. `StaleResurfaceBadge` currently has no interactive form — Task 1 adds one (an optional `onAction`/`actionLabel` prop pair that, when both are present, renders the badge as a `<button>`; when absent, renders as a `<div>` exactly as today). The 90+ tier uses the existing passive form; the 30-89 tier uses the new interactive form.
- **The bare `/remember` route has no page today** — only `layout.tsx` exists at that level, so `/remember` alone currently 404s (or shows whatever Next.js does for a route with a layout but no page). This is precisely why the nav item had to point at a concrete sub-route (`/remember/people`) in the first place — fixing the nav bug properly means giving `/remember` a real destination, not just retargeting the nav item to another sub-route that will itself eventually need the same fix again when People is cut.
- **Four separate files hardcode the generic "go to Remember" destination as `/remember/people`**, not just the sidebar nav item: `Navigation.tsx:65` (nav item href), `MobileDrawer.tsx:26` (same, mobile), `AppContentWrapper.tsx:62` (the `3` keyboard shortcut), `SearchModal.tsx:130` (a person search-result's path — this one has its own pre-existing comment explaining it's a workaround because `/people` isn't a real route; the underlying bug this plan fixes removes the need for that workaround's target to be `/remember/people` specifically, though the search result still generically routes to the Remember space rather than a specific person's page — that's a separate, deeper issue this plan does not attempt to fix, since it's not a hardcoded-wrong-destination bug, just a coarser-than-ideal one).
- **The active-nav-highlight logic has a special case keyed to the literal string `/remember/people`**, not a pattern — `Navigation.tsx:375-377` and the equivalent in `MobileDrawer.tsx:78` check `item.href === "/remember/people"` specifically to decide whether to highlight "Remember" as active for ANY `/remember/*` sub-route (including when viewing People). If Task 3 only changes the nav item's `href` value without also updating this condition to match the new href, the Remember nav item will stop highlighting as active while a user is on the People tab — a real regression, not a hypothetical one. Fix the condition to check `item.href.startsWith("/remember")` (or equivalent) instead of an exact match against one specific sub-route.
- **`remember/layout.tsx` already has a working People/Locations tab switcher** — the redesign here is reordering (Locations first) and re-tokening (`--color-*` legacy tokens), not building new tab UI from scratch.

---

### Task 1: Extend the shared stale component and adopt it in Locations

**Files:**
- Modify: `src/components/ui/StaleResurfaceBadge.tsx`
- Modify: `src/components/ui/__tests__/StaleResurfaceBadge.test.tsx`
- Modify: `src/app/(app)/remember/locations/page.tsx`

**Interfaces:**
- Consumes: nothing new from outside this task.
- Produces: `StaleResurfaceBadge` gains two new optional props: `onAction?: () => void` and `actionLabel?: string`. When BOTH are provided alongside a truthy `message`, the badge variant renders as a `<button onClick={onAction}>` instead of a `<div>`, with `message` as the button's visible text (replacing the icon+message layout with an icon+actionLabel-as-message layout — Locations' current interactive badge shows the action label itself as the clickable text, e.g. "Stale · Still here", not a separate message plus a separate action). When either prop is missing, behavior is unchanged from today (passive `<div>`). `variant="text"` is unaffected by these new props (it stays purely passive — Locations' interactive case only ever needs the badge variant's visual weight, not the bare-text form).

- [ ] **Step 1: Add the interactive form to `StaleResurfaceBadge`**

Replace the component's props interface and the `variant === "badge"` return block:

```tsx
interface StaleResurfaceBadgeProps {
  /** The staleness message to display (e.g. a stale-prompt string or a computed "hasn't moved in 30 days" note). Falsy values render nothing. */
  message: string | null | undefined;
  /**
   * "badge" (default) is the bordered pill with an accent wash and a Sparkles
   * icon — the representative treatment. "text" is the bare accent-colored
   * text with no border/background/icon, for contexts that already provide
   * their own visual chrome (e.g. a card that already has a border).
   */
  variant?: "badge" | "text";
  className?: string;
  /**
   * When provided together with `onAction`, the "badge" variant renders as
   * an interactive button (e.g. Locations' "mark this still here" affordance)
   * instead of a passive display. Ignored on the "text" variant and ignored
   * unless both `onAction` and `actionLabel` are set.
   */
  onAction?: () => void;
  actionLabel?: string;
}

export function StaleResurfaceBadge({
  message,
  variant = "badge",
  className,
  onAction,
  actionLabel,
}: StaleResurfaceBadgeProps) {
  if (!message) return null;

  if (variant === "text") {
    return (
      <p
        className={cn(
          "text-xs leading-relaxed font-medium text-[var(--accent)]",
          className,
        )}
      >
        {message}
      </p>
    );
  }

  const isInteractive = Boolean(onAction && actionLabel);
  const Wrapper = isInteractive ? "button" : "div";

  return (
    <Wrapper
      type={isInteractive ? "button" : undefined}
      onClick={isInteractive ? onAction : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-dim)] px-3 py-1",
        isInteractive &&
          "transition-colors hover:bg-[var(--accent-dim-hover)]",
        className,
      )}
    >
      <UiIcon className="h-3.5 w-3.5 text-[var(--accent)]" icon={Sparkles} />
      <span className="text-xs font-medium text-[var(--accent)]">
        {isInteractive ? actionLabel : message}
      </span>
    </Wrapper>
  );
}
```

(TypeScript note: `Wrapper` as a dynamically-chosen intrinsic element type — `"button" | "div"` — needs `React.ElementType` typing or a cast to satisfy strict prop-spreading; if `Wrapper` as written above causes a type error on the `type`/`onClick` props being invalid for `"div"`, use two separate return branches instead — one for the button form, one for the div form — rather than fighting a polymorphic-component type. Prefer the simpler, more verbose two-branch form if the polymorphic version causes friction; do not spend more than a few minutes on this before switching approaches.)

- [ ] **Step 2: Add tests for the interactive form**

Add to `src/components/ui/__tests__/StaleResurfaceBadge.test.tsx` (following the existing test file's established patterns): a test confirming that providing both `onAction` and `actionLabel` renders a `<button>` showing `actionLabel`'s text (not `message`'s text) and that clicking it calls `onAction`; a test confirming that omitting either prop still renders the passive `<div>` form with `message`'s text.

- [ ] **Step 3: Fix Locations' hardcoded colors**

Run `grep -n "rgba(255,255,255\|rgba(251,191,36\|rgba(248,113,113\|text-red-400\|#FBBF24" src/app/(app)/remember/locations/page.tsx` — expect the icon-background wash (`rgba(255,255,255,0.05)`), the stale-item border (`rgba(251,191,36,0.25)` and `rgba(251,191,36,0.3)`), the delete-hover color/background (`text-red-400`/`rgba(248,113,113,0.15)`), and the stale-button's text color (`#FBBF24`).

Fix the non-staleness ones directly with tokens:
- `bg-[rgba(255,255,255,0.05)]` → `bg-[var(--surface-1)]`
- `text-red-400` → `text-[var(--status-danger)]`
- `hover:bg-[rgba(248,113,113,0.15)]` → `hover:bg-[var(--status-danger)]/15`

The staleness-specific colors (`rgba(251,191,36,...)`, `#FBBF24` — an amber, distinct from the accent) get replaced in Step 4 by removing the hand-rolled markup entirely (adopting the shared component instead) rather than being individually re-tokened in place.

- [ ] **Step 4: Adopt `StaleResurfaceBadge` for both staleness tiers**

Replace the 90+-day passive state:

```tsx
                        {isVeryStale ? (
                          <span className="text-caption flex items-center gap-1 text-[var(--color-text-3)]">
                            <UiIcon className="h-3 w-3" icon={AlertCircle} />{" "}
                            Probably moved?
                          </span>
                        ) : isStale ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markStillHere(item.id);
                            }}
                            className="text-caption relative z-10 flex items-center gap-1 rounded-full border border-[rgba(251,191,36,0.3)] px-2 py-0.5 text-[#FBBF24] transition-colors hover:text-[var(--color-text-1)]"
                          >
                            Stale · Still here
                          </button>
                        ) : (
```

with:

```tsx
                        {isVeryStale ? (
                          <span className="text-caption flex items-center gap-1 text-[var(--color-text-3)]">
                            <UiIcon className="h-3 w-3" icon={AlertCircle} />{" "}
                            Probably moved?
                          </span>
                        ) : isStale ? (
                          <StaleResurfaceBadge
                            message="Stale"
                            actionLabel="Stale · Still here"
                            onAction={(e) => {
                              e?.stopPropagation?.();
                              markStillHere(item.id);
                            }}
                            className="relative z-10 !px-2 !py-0.5"
                          />
                        ) : (
```

(The `message` prop here is a non-empty placeholder purely to satisfy the "falsy message renders nothing" guard — the actual visible text in interactive mode comes from `actionLabel`, per Step 1's design. If this feels awkward once you're looking at the real component, consider instead: make the guard check `message || actionLabel` truthy rather than `message` alone, so a call site using only the interactive form doesn't need a throwaway `message` string. Use your judgment on whichever reads cleaner — either is acceptable, but pick one and be consistent; don't leave the throwaway-string awkwardness in place if the guard-condition fix is only a one-line change.)

Note: `onAction`'s signature in this call site needs to accept the click event for `stopPropagation` (the card itself has an `onClick` that opens the edit panel — the original code stopped propagation to prevent that). If Step 1's `onAction?: () => void` typing doesn't accept an event parameter, widen it to `onAction?: (e?: React.MouseEvent) => void` in Step 1 instead of working around it here — fix the interface, not the call site, since a click handler needing event access is a completely normal, expected shape for this kind of prop.

Add the import: `import { StaleResurfaceBadge } from "@/components/ui/StaleResurfaceBadge";`

- [ ] **Step 5: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 errors, clean typecheck, tests pass. Known baseline note: this project has documented pre-existing flaky test suites (timeout-related, pass reliably in isolation) — if the only failure is one of those, rerun once to confirm, don't treat it as a blocker.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/StaleResurfaceBadge.tsx src/components/ui/__tests__/StaleResurfaceBadge.test.tsx "src/app/(app)/remember/locations/page.tsx"
git commit -m "feat(remember): adopt the shared stale-resurface badge in Locations

Locations' 30-day staleness check was the spec's own named second
consumer for StaleResurfaceBadge (built during the Think phase) --
this task gives the component an interactive form (an optional
onAction/actionLabel pair) since Locations' staleness affordance is a
clickable 'mark still here' button, not a passive message like
Think's. Also fixes the remaining hardcoded white/red colors on the
Locations page."
```

---

### Task 2: Restructure the Remember layout and fix the nav-wide route bug

**Files:**
- Modify: `src/app/(app)/remember/layout.tsx`
- Create: `src/app/(app)/remember/page.tsx`
- Modify: `src/components/layout/Navigation.tsx`
- Modify: `src/components/layout/MobileDrawer.tsx`
- Modify: `src/components/layout/AppContentWrapper.tsx`
- Modify: `src/components/features/SearchModal.tsx`

**Interfaces:**
- Produces: `/remember` now resolves to a real page (a redirect) instead of 404ing.

- [ ] **Step 1: Create the `/remember` index redirect**

```tsx
// src/app/(app)/remember/page.tsx
import { redirect } from "next/navigation";

export default function RememberIndexPage() {
  redirect("/remember/locations");
}
```

- [ ] **Step 2: Reorder the tab switcher and fix legacy tokens in the layout**

In `src/app/(app)/remember/layout.tsx`, swap the order of the two `<Link>` blocks so Locations renders first, People second — Locations is the space getting "more visual attention... becomes what Remember visibly means" per spec, so it leads.

While reordering, replace the legacy `--color-*` tokens this file uses with current-generation equivalents (this is new/touched code in this task, so it should use the current tokens per this whole phase's established convention of not leaving legacy tokens in freshly-touched code): `var(--color-border)` → `var(--border-default)`, `var(--color-surface)` → `var(--surface-1)`, `var(--color-text-1)` → `var(--text-1)`, `var(--color-text-3)` → `var(--text-3)`. Apply consistently to both tab links and the surrounding container.

- [ ] **Step 3: Fix the nav-wide `/remember/people`-as-generic-destination bug**

In `src/components/layout/Navigation.tsx`:

Replace:
```tsx
  { href: "/remember/people", label: "Remember", icon: Brain },
```
with:
```tsx
  { href: "/remember/locations", label: "Remember", icon: Brain },
```

Replace the active-state special case:
```tsx
            (item.href === "/remember/people"
              ? pathname.startsWith("/remember")
              : pathname.startsWith(`${item.href}/`));
```
with:
```tsx
            (item.href.startsWith("/remember")
              ? pathname.startsWith("/remember")
              : pathname.startsWith(`${item.href}/`));
```

Apply the identical pair of changes to `src/components/layout/MobileDrawer.tsx` (its nav item array and its own copy of the active-state check — read the file first to confirm the exact surrounding syntax matches before pasting, since it may not be byte-identical to Navigation.tsx's version even though the logic is the same).

In `src/components/layout/AppContentWrapper.tsx`, replace `router.push("/remember/people");` (the `3` keyboard shortcut) with `router.push("/remember/locations");`.

In `src/components/features/SearchModal.tsx`, replace `path: "/remember/people",` with `path: "/remember/locations",` — and update the adjacent comment (`// People and Locations live under /remember — the old "/people" and "/locations" paths are not routes, so selecting either of those results navigated to a 404.`) to reflect that this is now pointing at Locations specifically as the generic Remember-space destination, not a leftover 404-avoidance hack — a one-line comment edit, not a functional change beyond the path itself.

- [ ] **Step 4: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 errors, clean typecheck, tests pass (modulo known flaky suites).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/remember/layout.tsx" "src/app/(app)/remember/page.tsx" src/components/layout/Navigation.tsx src/components/layout/MobileDrawer.tsx src/components/layout/AppContentWrapper.tsx src/components/features/SearchModal.tsx
git commit -m "fix(remember): make Locations the default Remember destination

The spec explicitly flags the nav's 'Remember' link resolving to
/remember/people as a bug (People is being cut; that route won't
exist post-cut). Four separate files hardcoded this same generic
'go to Remember' destination: the sidebar nav item, the mobile
drawer, a keyboard shortcut, and a search-result path. All now point
at /remember/locations. Adds a real /remember index route (previously
404ing) that redirects there too, and reorders the tab switcher so
Locations leads -- matching the spec's 'becomes what Remember visibly
means' framing. People's own pages are untouched; that space is cut
in a separate, later rollout step."
```

---

## Post-Implementation

After Task 2, dispatch a final review covering the full diff across both tasks. In particular check:
- No gradient/blur/glow survives anywhere in the touched files.
- No hardcoded hex/rgba remains in Locations or the Remember layout.
- The active-nav-highlight fix actually works for BOTH tabs — visiting `/remember/locations` AND `/remember/people` should both show "Remember" highlighted as the active nav item (this is exactly the kind of thing a task-scoped reviewer reading a diff might not catch without tracing the logic across both `startsWith` branches — reason through it explicitly, or better, verify it live in a browser if a real dev server + authenticated session is feasible in the review environment).
- `StaleResurfaceBadge`'s interactive form doesn't regress Think's existing passive usage (Think's two call sites should be completely unaffected by Task 1's additions, since the new props are optional and default to the old behavior).
- Confirm `remember/people/*` files genuinely have zero diff — this plan's own constraint was not to touch them.

Then proceed to `superpowers:finishing-a-development-branch` for the merge/push decision, following the same gate discipline as the rest of this project.

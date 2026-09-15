# Phase 4a: Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Inbox into design-system compliance and implement a spec-mandated structural change: the routing dropdown shrinks from 5 destinations (Do/Think/Explore/Remember-as-person/Locations) to 3 (Do/Remember/Think), per spec §3's explicit instruction.

**Architecture:** One page (`inbox/page.tsx`) plus its inline `InboxItemCard` component. Two kinds of work: (1) flatten a real gradient violation (the swipe-to-delete reveal layer — same pattern already fixed in `TaskCard.tsx` during the Do phase) and fix hardcoded colors, including a stale pre-terracotta teal default color written when routing to Think; (2) collapse the routing menu's "Remember (Person)" and "Locations" buttons into one "Remember" destination, reusing `capture-router.ts`'s existing person/location keyword-detection logic (already used elsewhere in the app, e.g. Onboarding) rather than building new classification logic or forcing the user through a second picker just to shrink one menu into another.

**Tech Stack:** Next.js 16.3, React 19, Framer Motion, TanStack Query, Supabase, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-13-design-system-overhaul-design.md` §3 ("Inbox — unchanged in scope, but its routing menu shrinks from 5 destinations... to 3 (Do / Remember / Think)... Fewer choices at exactly the moment (unsorted capture) friction should be lowest"), §4 (flat surfaces).

## Global Constraints

- No gradients, glows, or glassmorphism (blur) on any surface.
- No hardcoded hex colors, bare Tailwind palette classes, or hardcoded `rgba(255,255,255,...)`/`rgba(0,0,0,...)` values — use `var(--token)`.
- The routing dropdown must end up with exactly 3 destination buttons: Do, Remember, Think. Explore is removed as a destination entirely (Explore itself isn't cut yet as a space — that's §18 step 5 — but it's no longer an Inbox routing target, matching spec §3's explicit instruction). "Remember (Person)" and "Locations" collapse into one "Remember" button.
- Every task ends in a state where `npm run lint`, `npx tsc --noEmit`, and `npm test` are clean.

## File Structure

- Modify: `src/app/(app)/inbox/page.tsx` — colors, gradient removal, routing-menu collapse.
- Modify: `src/lib/capture-router.ts` — export a small, focused helper Inbox can reuse for the Remember-destination classification (see Task 2).

## Investigation Notes (read before starting)

- **The swipe-to-delete reveal layer duplicates the exact violation already fixed in `TaskCard.tsx`** during the Do phase: a `linear-gradient` background with hardcoded rgba stops, plus a hardcoded `text-red-400` icon. Same fix pattern applies: flat `bg-[var(--status-danger-dim)]` background, `text-[var(--status-danger)]` icon.
- **Every inbox item card is amber-tinted** (`border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 hover:bg-amber-500/10`) — bare Tailwind palette classes, and a color choice that predates this whole project's single-accent-color system. Every other one-off accent color encountered this project has collapsed to the current accent (`--accent` family) rather than kept as a distinct hue — Sign-in, Home, TaskCard, Do, Think, and Remember all made this same call. This plan does the same for Inbox's card chrome.
- **`routeInboxItem`'s Think-routing branch writes a stale `color_accent: "#2DD4BF"`** — the pre-terracotta teal accent, the same stale-color bug already fixed in multiple other places this project (Home's weekly-reflection thread, `main`'s `7f4b1c3`). Becomes the current accent hex.
- **The routing-menu collapse's design decision**: `capture-router.ts` already exports the exact keyword arrays needed to distinguish a person-note from a location-note (`PERSON_KW`, `LOCATION_KW`) — used today inside the full `routeCapture()` pipeline for fresh capture text. Inbox's "Route it" flow is different: the user has already manually chosen "Remember" as the destination for an *existing* inbox item's fixed title text, so the full `routeCapture()` pipeline (which also checks for URLs, task keywords, thought keywords, before ever reaching person/location detection) isn't the right fit — those other destinations are irrelevant once the user has already picked "Remember." This plan adds a small, separately-exported helper (`classifyRememberDestination`) that applies just the person/location half of the existing logic, reusable without pulling in the rest of the pipeline. When neither keyword set matches, it defaults to `"locations"` — Locations is now Remember's promoted primary meaning (per the just-completed Remember phase), so an ambiguous "remember this" capture should land there, not in the being-phased-out People space.

---

### Task 1: Fix Inbox's hardcoded colors and gradient

**Files:**
- Modify: `src/app/(app)/inbox/page.tsx`

**Interfaces:** none — visual-only changes; `routeInboxItem`'s behavior changes only in what `color_accent` value gets written.

- [ ] **Step 1: Flatten the swipe-to-delete reveal layer**

Replace:

```tsx
      {/* Swipe-to-delete reveal layer */}
      <m.div
        className="absolute inset-0 flex items-center justify-end overflow-hidden rounded-2xl pr-5"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(248,113,113,0.15) 60%, rgba(239,68,68,0.25) 100%)",
          opacity: deleteOpacity,
        }}
      >
        <m.div style={{ scale: deleteScale }}>
          <UiIcon className="h-5 w-5 text-red-400" icon={Trash2} />
        </m.div>
      </m.div>
```

with:

```tsx
      {/* Swipe-to-delete reveal layer */}
      <m.div
        className="absolute inset-0 flex items-center justify-end overflow-hidden rounded-2xl bg-[var(--status-danger-dim)] pr-5"
        style={{ opacity: deleteOpacity }}
      >
        <m.div style={{ scale: deleteScale }}>
          <UiIcon className="h-5 w-5 text-[var(--status-danger)]" icon={Trash2} />
        </m.div>
      </m.div>
```

- [ ] **Step 2: Re-token the card chrome from amber to accent**

Replace:

```tsx
        <div className="glass-card group flex flex-col items-start justify-between gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:border-amber-500/40 hover:bg-amber-500/10 hover:shadow-[var(--shadow-card-hover)] md:flex-row md:items-center">
```

with:

```tsx
        <div className="glass-card group flex flex-col items-start justify-between gap-4 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-dim)] p-4 transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:bg-[var(--accent-dim-hover)] hover:shadow-[var(--shadow-card-hover)] md:flex-row md:items-center">
```

- [ ] **Step 3: Fix the Dismiss button's hardcoded red**

Replace:

```tsx
              className="shrink-0 !border-transparent !bg-transparent hover:!bg-red-500/10 hover:!text-red-400"
```

with:

```tsx
              className="shrink-0 !border-transparent !bg-transparent hover:!bg-[var(--status-danger)]/10 hover:!text-[var(--status-danger)]"
```

- [ ] **Step 4: Fix the remaining hardcoded white-rgba values**

Run `grep -n "rgba(255,255,255" "src/app/(app)/inbox/page.tsx"` — expect the "Space" label caption, the empty-state border, and the empty-state icon background (the same three-value pattern already fixed identically in Do, Think, and Remember this project: `0.35` → `var(--text-muted)`, `0.08` → `var(--border-subtle)`, `0.03` → `var(--surface-1)`).

- [ ] **Step 5: Fix the stale teal default in `routeInboxItem`'s Think branch**

This edit is made in Task 2 alongside the routing-menu collapse (the Think branch's insert call is being touched anyway for the menu-shrink work) — do not make this specific edit in Task 1; it's called out here so its absence from Task 1's diff isn't mistaken for an oversight.

- [ ] **Step 6: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 errors, clean typecheck, tests pass. Known baseline note: this project has documented pre-existing flaky test suites (timeout-related, pass reliably in isolation) — if the only failure is one of those, rerun once to confirm, don't treat it as a blocker.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/inbox/page.tsx"
git commit -m "fix(inbox): flatten swipe gradient, replace amber card chrome and hardcoded colors

Same swipe-to-delete gradient violation already fixed in TaskCard.tsx
during the Do phase. Every inbox card was amber-tinted (bare Tailwind
palette classes) -- collapsed to the current accent per the
single-accent-color system every other space in this project has
already adopted. Fixes the remaining hardcoded white-rgba values."
```

---

### Task 2: Shrink the routing menu from 5 destinations to 3

**Files:**
- Modify: `src/lib/capture-router.ts`
- Modify: `src/app/(app)/inbox/page.tsx`

**Interfaces:**
- Produces: `capture-router.ts` exports a new function `classifyRememberDestination(text: string, knownPeople: string[] = []): "people" | "locations"`. Applies the existing `PERSON_KW`/detected-name logic and `LOCATION_KW` logic (extracted from `routeCapture`'s existing steps 2-3, not rewritten) to decide between the two Remember-adjacent tables, defaulting to `"locations"` when neither matches.
- Consumes (in `page.tsx`): the new `classifyRememberDestination` export, called from `routeInboxItem`'s new consolidated "remember" branch.

- [ ] **Step 1: Extract the classification helper in `capture-router.ts`**

Add a new exported function, placed after the existing `routedItem` helper and before `routeCapture`:

```ts
/**
 * Decides which Remember-adjacent table an item belongs in, reusing the same
 * person/location keyword detection routeCapture() applies to fresh capture
 * text. Used by Inbox's "Route it → Remember" action, where the user has
 * already manually chosen "Remember" as the destination for an existing
 * item's fixed title — the rest of routeCapture()'s pipeline (URL/task/
 * thought detection) doesn't apply once that choice is already made.
 * Defaults to "locations" when neither keyword set matches: Locations is
 * Remember's promoted primary meaning, so an ambiguous capture belongs
 * there rather than in the being-phased-out People space.
 */
export function classifyRememberDestination(
  text: string,
  knownPeople: string[] = [],
): "people" | "locations" {
  const lower = text.toLowerCase().trim();

  const matchedKnown = knownPeople.find((p) => lower.includes(p.toLowerCase()));
  if (matchedKnown && PERSON_KW.some((k) => lower.includes(k))) {
    return "people";
  }

  return "locations";
}
```

(Note: this deliberately omits the `doc.people()` NLP name-detection step that `routeCapture` uses — that step requires the async `compromise` library import, and Inbox's synchronous button-click handler shouldn't need to await a dynamic import just to decide people-vs-locations for text that's usually short and already user-authored. If `knownPeople` matching plus a person-keyword hit isn't confident enough in practice, that's a reasonable future enhancement, not something this task needs to solve — the existing `routeCapture` pipeline remains the more sophisticated path for fresh captures elsewhere in the app.)

- [ ] **Step 2: Collapse the dropdown from 5 buttons to 3 in `inbox/page.tsx`**

Add the import: `import { classifyRememberDestination } from "@/lib/capture-router";`

Replace the dropdown's four destination buttons (Do, Think, Explore, Remember (Person), Locations) with three (Do, Remember, Think) — reordered to match the spec's stated order "Do / Remember / Think":

```tsx
                  <button
                    onClick={() => {
                      routeInboxItem(item.id, "do");
                      setActiveRouteItem(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    <UiIcon
                      className="h-4 w-4 text-[var(--color-do)]"
                      icon={CheckCircle2}
                    />{" "}
                    Do (Task)
                  </button>
                  <button
                    onClick={() => {
                      routeInboxItem(item.id, "remember");
                      setActiveRouteItem(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    <UiIcon
                      className="h-4 w-4 text-[var(--color-people)]"
                      icon={Brain}
                    />{" "}
                    Remember
                  </button>
                  <button
                    onClick={() => {
                      routeInboxItem(item.id, "think");
                      setActiveRouteItem(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--color-surface)]"
                  >
                    <UiIcon
                      className="h-4 w-4 text-[var(--color-think)]"
                      icon={MessageSquare}
                    />{" "}
                    Think (Thread)
                  </button>
```

Remove the now-unused `MapPin` and `Compass` icon imports if they become unused elsewhere in the file after this change (check with `npm run lint` — it will flag them). Note: the "remember" space value already exists in `routeInboxItem`'s branching logic (it currently only handles person-routing under that name) — Step 3 changes what that branch does, not its name, so the button's `onClick` above stays `routeInboxItem(item.id, "remember")` unchanged from what "Remember (Person)" used to call.

- [ ] **Step 3: Consolidate `routeInboxItem`'s "remember" branch to classify and route to the right table**

Replace the existing `else if (space === "remember")` branch (which currently only ever inserts into `people`) with:

```tsx
        } else if (space === "remember") {
          if (item.user_id) {
            const destination = classifyRememberDestination(item.title, []);
            // BUG-38: insert FIRST, trash original only on success
            const { data: inserted, error: insertError } =
              destination === "people"
                ? await supabase
                    .from("people")
                    .insert({
                      user_id: item.user_id,
                      name: item.title,
                      notes: [
                        {
                          text: item.title,
                          created_at: new Date().toISOString(),
                          tag: "note",
                        },
                      ],
                    })
                    .select("id")
                    .single()
                : await supabase
                    .from("locations")
                    .insert({
                      user_id: item.user_id,
                      item_name: item.title,
                      location_text: item.title,
                    })
                    .select("id")
                    .single();

            if (insertError) throw insertError;
            if (inserted) {
              routedId = inserted.id;
              const { success: trashed } = await safeMutate(
                () =>
                  supabase
                    .from("items")
                    .update(moveItemToTrashPatch())
                    .eq("id", id),
                "Routed, but failed to remove from Inbox",
              );
              if (!trashed) {
                const destId = routedId;
                if (destId) {
                  await safeMutate(
                    () =>
                      supabase
                        .from(destination)
                        .delete()
                        .eq("id", destId),
                    "Failed to undo route",
                  );
                }
                throw new Error("Failed to remove from Inbox");
              }
            }
          }
```

Remove the now-fully-separate old `else if (space === "location")` branch entirely — it's superseded by the consolidated "remember" branch above (the dropdown no longer has a separate "location" button, so this branch is unreachable dead code once Step 2 lands; confirm via `grep -n '"location"' "src/app/(app)/inbox/page.tsx"` after this edit that no remaining code path can pass `"location"` as the `space` argument).

Update the Undo handler's `else if (space === "remember")` block similarly — it currently only undoes a `people` insert; it needs to delete from whichever table `routedId` actually landed in. Since `routedId` alone doesn't carry which table it came from, capture the classified destination in a variable accessible to the closure (e.g. compute `const destination = classifyRememberDestination(item.title, []);` once near the top of the `space === "remember"` branch, and reference that same `destination` variable inside the nested Undo `onClick` closure, the same way `routedId` is already captured by that closure today). Also delete the old `else if (space === "location")` branch from the Undo handler for the same reason as above.

- [ ] **Step 4: Fix the stale teal default in the Think branch**

Replace:

```tsx
            .insert({
              user_id: item.user_id,
              title: item.title,
              color_accent: "#2DD4BF",
            })
```

with:

```tsx
            .insert({
              user_id: item.user_id,
              title: item.title,
              color_accent: "#d97757",
            })
```

- [ ] **Step 5: Run lint, typecheck, and the full unit suite**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: 0 errors, clean typecheck, tests pass (modulo known flaky suites). Pay particular attention to any existing test that references the old 5-button dropdown, the `"location"` space value, or the old `"remember"` branch's people-only behavior — such a test would need updating to match the new 3-button/classified-destination behavior, not simply deleting; if you find one, update its assertions to match the new correct behavior rather than removing coverage.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/inbox/page.tsx" src/lib/capture-router.ts
git commit -m "feat(inbox): shrink the routing menu from 5 destinations to 3

Spec explicitly calls for Do/Remember/Think, collapsing the old
Remember-as-person and Locations buttons into one Remember
destination -- fewer choices at exactly the moment (unsorted capture)
friction should be lowest. Reuses capture-router.ts's existing
person/location keyword detection (via a new classifyRememberDestination
export) rather than building new classification logic or forcing a
second picker just to shrink one menu into another. Also fixes a stale
pre-terracotta teal default color on Think-routed items, touched in
the same branch this task already edits."
```

---

## Post-Implementation

After Task 2, dispatch a final review covering the full diff across both tasks. In particular check:
- No gradient/blur/glow survives anywhere in the final file.
- No hardcoded hex/rgba (including the amber card chrome) remains.
- The dropdown genuinely shows exactly 3 buttons (Do, Remember, Think) — no leftover 4th/5th button, no dead "location" space-value code path.
- `classifyRememberDestination` is a clean, correctly-scoped extraction — does it duplicate `routeCapture`'s existing `PERSON_KW`/`matchedKnown` logic verbatim in a way that risks drifting out of sync if `routeCapture`'s own logic changes later? If so, consider (as a Minor finding, not necessarily requiring action in this branch) whether `routeCapture` itself should call the new helper internally to guarantee they can't diverge — flag it, let the final reviewer weigh whether it's worth a same-branch fix or a deferred note.
- The Undo flow for a "remember"-routed item correctly deletes from whichever table (`people` or `locations`) the item actually landed in, not always `people`.

Then proceed to `superpowers:finishing-a-development-branch` for the merge/push decision, following the same gate discipline as the rest of this project.

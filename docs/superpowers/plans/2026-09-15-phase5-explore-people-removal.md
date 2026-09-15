# Explore and People Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely remove the Explore and People features from Presense — routes, nav entries, capture/search/settings integration, the cross-cutting "Linked People" mechanism in Do and Think, and the underlying `people`/`explores` database tables — with no data preserved (full removal, confirmed by the user; the spec's export-first default was explicitly declined).

**Architecture:** Work top-down from UI surface to data layer, so that every intermediate commit keeps `tsc`/lint/tests green: remove pages and nav first (Tasks 1-2), then the capture/search/settings integration points that route into those tables (Tasks 3-5), then the cross-cutting Linked People mechanism shared by Do and Think (Task 6), then leftover token/realtime/test cleanup (Task 7), and only last — once no application code references `people`/`explores`/`linked_people_ids`/`people_categories`/`explore_custom_types` — the database migration and generated-types edit (Task 8). Task 8 must run last: dropping columns/tables while earlier tasks' code still references them would break the build for every task in between.

**Tech Stack:** Next.js 16.3 / React 19 / TypeScript / Supabase / Tailwind v4 / Zustand / TanStack Query / Zod

**Spec:** `docs/superpowers/specs/2026-09-13-design-system-overhaul-design.md` §18 step 5 ("Explore and People removal happens as its own step") and §19/20 (open question on existing data — **superseded by explicit user decision below**).

## Global Constraints

- **Full removal, no data preservation.** The user was shown the spec's default recommendation (keep tables + offer CSV/JSON export) and explicitly said "full removal then" after being told the tradeoff (permanent, irreversible data loss for anything saved in People or Explore). Do not build an export feature. Do not add a migration path. Drop the tables.
- **The database migration (Task 8) is a file, not an action.** Never run `apply_migration` or any equivalent tool against a live/remote Supabase project as part of this plan. The migration is committed to `supabase/migrations/` exactly like every prior migration in this repo and applied by the user deliberately (via their normal deploy/CLI flow), matching this project's own documented convention that `types:check`/migrations are "run deliberately," never automatically. If a local/dev Supabase instance is available in the sandbox and running the migration against *that* is necessary to regenerate `database.types.ts` accurately, confirm it is local-only before running it — otherwise hand-edit `database.types.ts` to match the migration's SQL.
- **Task 8 runs last, after Tasks 1-7 land.** No task before Task 8 may leave `tsc` broken by an early types edit.
- **Every task must leave `npx tsc --noEmit` clean, `npm run lint` at 0 errors, and `npm test` green** (the three known-flaky suites — `challenger.test.tsx`, `login/actions.test.ts`, `account-route.test.ts` — are allowed to show timeout flakes in the full run; verify any failure there by rerunning that suite in isolation before treating it as non-blocking).
- **Design-system tokens**: this plan is pure removal, not a re-skin — do not introduce new hardcoded colors or new tokens. Where a token becomes provably unused after removal (e.g. `--color-people`, `--color-explore`), delete it; where a token might still be referenced elsewhere, leave it and note it in the task report rather than guessing.
- **`extractMentions` (`src/lib/utils.ts`) and the generic `@[name](uuid)` mention markup are People-only machinery in this codebase today** — the only things that ever produced that markup are the People-autocomplete popovers in `CaptureModal.tsx` and `think/[id]/page.tsx`. Once both producers are removed (Task 6), the function and its two dedicated test files/blocks are dead and should be removed too. If a task's grep turns up any other consumer not listed in this plan, stop and flag it in the task report rather than deleting shared code out from under an unrelated feature.
- **`AddPersonPanel.tsx`, `ExploreDrawer.tsx`, and `src/app/api/people/reorder/route.ts` are deleted files**, not edited files — remove them outright once nothing imports them.
- Never touch `remember/locations/**`, `remember/layout.tsx`, or any other already-shipped Remember/Locations code from the prior phase — this plan's blast radius is Explore + People + the cross-cutting Linked People mechanism only.

---

### Task 1: Delete Explore/People routes and their dedicated components

**Files:**
- Delete: `src/app/(app)/explore/page.tsx`
- Delete: `src/app/(app)/explore/[id]/page.tsx`
- Delete: `src/app/(app)/explore/layout.tsx`
- Delete: `src/app/(app)/explore/loading.tsx`
- Delete: `src/app/(app)/explore/error.tsx`
- Delete: `src/app/(app)/remember/people/page.tsx`
- Delete: `src/app/(app)/remember/people/[id]/page.tsx`
- Delete: `src/app/(app)/remember/people/layout.tsx`
- Delete: `src/components/features/ExploreDrawer.tsx`
- Delete: `src/components/features/AddPersonPanel.tsx`
- Delete: `src/app/api/people/reorder/route.ts`
- Modify: `src/lib/constants.ts` — remove `RELATIONSHIP_COLORS`
- Modify: `src/lib/schemas.ts` — remove `personSchema`

**Interfaces:**
- Consumes: nothing from other tasks (this is the first task).
- Produces: confirms the full set of route/component files this plan deletes. Later tasks (2-7) must not re-introduce imports of anything deleted here.

- [ ] **Step 1: Delete the route directories and drawer/panel components**

```bash
git rm -r "src/app/(app)/explore"
git rm -r "src/app/(app)/remember/people"
git rm src/components/features/ExploreDrawer.tsx
git rm src/components/features/AddPersonPanel.tsx
git rm src/app/api/people/reorder/route.ts
```

- [ ] **Step 2: Remove `RELATIONSHIP_COLORS` from `src/lib/constants.ts`**

Grep the file for `RELATIONSHIP_COLORS` and delete the exported constant (it was only consumed by the two files just deleted — confirm with `grep -rn "RELATIONSHIP_COLORS" src/` before deleting; if any other file still imports it, leave a note in the task report rather than deleting blind).

- [ ] **Step 3: Remove `personSchema` from `src/lib/schemas.ts`**

Grep for `personSchema` — delete its definition (was only consumed by `AddPersonPanel.tsx`, now deleted). Confirm with `grep -rn "personSchema" src/` first.

- [ ] **Step 4: Verify the build doesn't yet fully typecheck (expected)**

Other files still import the now-deleted components/routes (nav links, `SearchModal.tsx`, `CaptureModal.tsx`, `SettingsModal.tsx`, `capture-router.ts`, `OnboardingWizard.tsx`) — those are fixed in Tasks 2-6. Run `npx tsc --noEmit` and confirm the *only* new errors are `Cannot find module` / missing-file errors pointing at the deleted paths (`/explore`, `/remember/people`, `ExploreDrawer`, `AddPersonPanel`), not anything unrelated. This is expected and will be resolved by the end of Task 6 — do not try to fix those consumer files in this task.

- [ ] **Step 5: Run lint on the files actually changed in this task**

`npx eslint src/lib/constants.ts src/lib/schemas.ts` — must be clean. (Full-repo lint/tsc/test will not be green until Task 6 lands; that's expected and documented in this task's report so the reviewer isn't surprised.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(explore-people-removal): delete Explore/People routes and their dedicated components"
```

---

### Task 2: Remove Explore/People from navigation, keyboard shortcuts, and Inbox's stale copy

**Files:**
- Modify: `src/components/layout/Navigation.tsx`
- Modify: `src/components/layout/MobileDrawer.tsx`
- Modify: `src/components/layout/AppContentWrapper.tsx`
- Modify: `src/app/(app)/inbox/page.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 directly (nav arrays reference `/explore` as a string href, not an import — safe to do independently, but do it after Task 1 so the dangling nav link doesn't 404 mid-branch).
- Produces: no nav entry, drawer entry, or keyboard shortcut points at `/explore` or `/remember/people` anywhere in the app shell.

- [ ] **Step 1: Remove Explore from `Navigation.tsx`**

Two arrays need the `{ href: "/explore", label: "Explore", icon: Compass }` entry removed:
- `Sidebar()`'s `navItems` array (currently line ~67)
- `BottomNav()`'s `mobileNavItems` array (currently line ~671)

After removing both entries, check whether `Compass` (the icon import from `lucide-react`) is still used anywhere else in the file (`grep -n "Compass" src/components/layout/Navigation.tsx`) — if not, remove it from the import list too.

- [ ] **Step 2: Remove Explore from `MobileDrawer.tsx`**

Same `{ href: "/explore", label: "Explore", icon: Compass }` entry in its own `navItems` array (currently line ~28). Same follow-up check on the `Compass` import.

- [ ] **Step 3: Remove the `/explore` keyboard shortcut from `AppContentWrapper.tsx`**

The `handleGlobalKeyDown` switch currently has:
```ts
case "5":
  router.push("/explore");
  break;
```
Delete this case entirely. Do not renumber the other cases (`"1"`–`"4"`, `"6"`) — leaving a gap where `"5"` used to be is fine and avoids gratuitously touching every other shortcut's muscle memory.

- [ ] **Step 4: Clean stale Explore/People references in `src/app/(app)/inbox/page.tsx`**

- Line ~490: the empty-state description reads `"Dump everything here. Process them later by routing them to the Do, Think, or Explore space."` — Explore is no longer a destination (Inbox's routing menu is Do/Remember/Think per the prior Inbox phase). Reword to `"Dump everything here. Process them later by routing them to the Do, Think, or Remember space."`
- Line ~160: `className="h-4 w-4 text-[var(--color-people)]"` — this token is being removed in Task 7 once nothing references it. Replace this usage with the neutral text-muted token already used elsewhere in this file for icon coloring (check the surrounding JSX for the pattern other icons in the same list use, e.g. `var(--text-3)` or `var(--color-text-3)`, and match it) rather than inventing a new one.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
npx eslint src/components/layout/Navigation.tsx src/components/layout/MobileDrawer.tsx src/components/layout/AppContentWrapper.tsx "src/app/(app)/inbox/page.tsx"
git add -A
git commit -m "feat(explore-people-removal): remove Explore/People from nav, shortcuts, and Inbox copy"
```

(Full-repo tsc will still show the Task-1-deletion-driven errors from `SearchModal.tsx`/`CaptureModal.tsx`/etc until Task 6 — that's expected; this step only needs the files this task touched to be individually clean.)

---

### Task 3: Strip Explore/People out of capture routing, the capture modal, and onboarding

**Files:**
- Modify: `src/lib/capture-router.ts`
- Modify: `src/lib/__tests__/capture-router.test.ts`
- Modify: `src/components/features/CaptureModal.tsx`
- Modify: `src/app/api/capture/route.ts`
- Modify: `src/app/onboarding/OnboardingWizard.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: `RoutedItemType` no longer includes `"person_note" | "explore"`; `RoutedItem["destinationId"]` no longer includes `"people" | "explore"`. Tasks 4-6 must not reference these removed union members.

- [ ] **Step 1: Strip `capture-router.ts`**

Remove:
- The `PERSON_KW` array (lines ~33-46) and `EXPLORE_KW` array (lines ~84-98).
- `"person_note"` and `"explore"` from the `RoutedItemType` union (line ~108-109) — becomes `"task" | "location" | "thought" | "unknown"`.
- `"people"` and `"explore"` from `RoutedItem["destinationId"]` (line ~115) — becomes `"do" | "inbox" | "locations" | "think"`.
- The `destination.includes("People")` and `destination === "Explore"` branches in `destinationToId()` (lines ~131, 134).
- The `people:`/`explore:` entries in `destinationIdToLabel()`'s `labels` record (lines ~144, 147).
- Branch 1 "URL → Explore" (lines ~213-228) — the whole `if (urlMatch) { ... }` block. URLs should now fall through to whatever the next matching branch produces (most likely landing in Task/Thought/Unknown depending on content — this is intentional, there's no replacement destination for a bare URL).
- Branch 2 "Person note" (lines ~230-257) — the whole `if (matchedName && PERSON_KW...) { ... }` block, and the `detectedNames`/`matchedKnown`/`matchedName` computation feeding only that branch (verify via grep that `matchedName`/`detectedNames` aren't read anywhere else in the file before deleting them — they aren't, per this plan's investigation, but confirm).
- Branch 6 "Explore keywords" (lines ~456-469) — the whole `if (EXPLORE_KW.some...) { ... }` block.
- The `knownPeople` parameter of `routeCapture()` (line ~168, `knownPeople: string[] = []`) — now unused since branch 2 (the only consumer) is gone. Remove the parameter and update every call site (`CaptureModal.tsx`, `src/app/api/capture/route.ts` — both handled later in this same task) to drop the argument.

Renumber the remaining branch comments (`// 3. Location`, `// 4a. Recurrence...`, `// 4. Task`, `// 5. Thought`, `// 7. Unknown`) to close the gaps left by removing branches 1, 2, and 6 — e.g. Location becomes `// 1. Location`, and so on — so the numbering stays sequential and doesn't reference removed steps.

- [ ] **Step 2: Update `src/lib/__tests__/capture-router.test.ts`**

Remove the test cases asserting person-note routing (`"routes known person + person keyword to Remember"`, `destination === "Remember → People"`) and Explore routing (URL→Explore, `"save this"`, `"interesting"`, `"worth reading"` → Explore) — lines ~79-163 per this plan's investigation, but verify against the current file since Step 1 changes what these tests can even assert against. Update any test call sites that pass a `knownPeople` argument to `routeCapture()` to drop it, matching the new signature.

- [ ] **Step 3: Strip `CaptureModal.tsx`**

Remove:
- The `people` state, `showPopover`/`popoverSearch`/`selectedIndex` state and the `@mention` autocomplete machinery built on top of it: the `useEffect` that fetches `.from("people")` (lines ~138-153), `filteredPeople` memo (~155-159), `handleSelectPerson` (~161-186), the mention-detection branch inside `handleInputChange` (~188-209) and inside `handleKeyDown` (~211-227) — collapse `handleKeyDown` to just its `else` branch (the Enter-to-route/confirm logic), and the "Mentions dropdown overlay" JSX block (~467-487).
- `extractMentions` import and both call sites (`mentions = extractMentions(item.title)` at ~315 and ~366) plus the `linked_people_ids: mentions` field on both the `items` insert (~330) and the `threads` insert (~377) — those inserts should simply stop setting `linked_people_ids` (the field is being dropped from the schema in Task 8; until then, omitting it on insert is fine since the column has no NOT NULL constraint).
- The People insert/update branch (`else if (item.destinationId === "people") { ... }`, ~333-364) and the Explore insert branch (`else if (item.destinationId === "explore") { ... }`, ~380-388) from `handleConfirm`.
- `"Remember → People"` and `"Explore"` entries from `SPACE_COLORS` (~59, 61) and `SPACE_OPTIONS` (~70, 72); `people`/`explore` entries from `ROUTE_SPACE_COLORS` (~78, 80) and `ROUTE_SPACE_OPTIONS` (~88, 90).
- The `item.destinationId === "people"` conditional JSX block rendering the "Person:" input (~564-577).
- The `knownPeopleNames = people.map(...)` line and the `knownPeopleNames` argument passed into `routeCapture()` inside `handleRoute` (~254-257) — `routeCapture()` no longer takes this parameter per Task 3 Step 1.

Leave the Locations destination/branch and its UI entirely untouched — Locations is not in scope for this removal.

- [ ] **Step 4: Update `src/app/api/capture/route.ts`**

Remove the `people` table fetch that builds `knownPeople`/`knownPeopleNames` for `routeCapture()`, and stop passing that argument to `routeCapture()` (matches the new signature from Task 3 Step 1).

- [ ] **Step 5: Update `src/app/onboarding/OnboardingWizard.tsx`**

Remove the branches that insert into `people` (lines ~188-222 per this plan's investigation) and into `explores` (`item.destination === "Explore"`, lines ~259-266) from whatever onboarding capture-confirmation flow they live in. Leave the Do/Think/Locations branches untouched.

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit
npx eslint src/lib/capture-router.ts src/lib/__tests__/capture-router.test.ts src/components/features/CaptureModal.tsx src/app/api/capture/route.ts src/app/onboarding/OnboardingWizard.tsx
npx vitest run src/lib/__tests__/capture-router.test.ts
git add -A
git commit -m "feat(explore-people-removal): strip Explore/People out of capture routing, CaptureModal, and onboarding"
```

---

### Task 4: Remove Explore/People from global search

**Files:**
- Modify: `src/components/features/SearchModal.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1-3 directly (this file's people/explore references are pure Supabase queries + local state, no shared types).
- Produces: `SearchResult["type"]` no longer includes `"person" | "explore"`.

- [ ] **Step 1: Remove person/explore from the result type and query set**

- `SearchResult["type"]` union (line ~32): drop `"person" | "explore"`, leaving `"task" | "thread" | "location"`.
- The `people` and `explores` entries in the `Promise.all([...])` query array (lines ~76-107) and the corresponding destructured names (`tasks, people, threads, explores, locations` → `tasks, threads, locations`).
- The `...(people.data ?? []).map(...)` and `...(explores.data ?? []).map(...)` blocks building `combined` (lines ~122-133, ~141-147).
- Remove the now-unused `Users` and `Compass` icon imports from `lucide-react` if nothing else in the file uses them (grep first).

- [ ] **Step 2: Update the empty-state placeholder copy**

Line ~254: `"Type to search across tasks, people, threads, explores, and locations."` → `"Type to search across tasks, threads, and locations."`

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
npx eslint src/components/features/SearchModal.tsx
git add -A
git commit -m "feat(explore-people-removal): remove Explore/People from global search"
```

---

### Task 5: Remove the Settings "People" tab and Explore/People export queries

**Files:**
- Modify: `src/components/features/SettingsModal.tsx`
- Modify: `src/lib/schemas.ts`
- Modify: `src/store/useAppStore.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1-4.
- Produces: `SettingsState`/`UserSettings` no longer has a `people_categories` field; `settingsSchema` no longer has `people_categories`. Task 8 will separately drop the DB column and `explore_custom_types` (which has no UI consumer at all — confirmed dead in this plan's investigation).

- [ ] **Step 1: Remove the "People" tab from `SettingsModal.tsx`**

- The tab definition `{ id: "people", label: "People", icon: Users }` (line ~98) from the tabs array — check whether `Users` (icon) is still used elsewhere in the file first.
- The tab's content block (~1564-1578), which renders the shared category editor bound to `categoriesKey="people_categories"`.
- Every other `people_categories` reference in this file: the `AUTOSAVE_FIELDS` array entry, the `SettingsState` interface field, any `useWatch`/`watch` declaration for it, and its entry in the payload object built for the Supabase `.update()` call (plus that entry's line in the payload's dependency array) — same removal shape as the `ambient_bg` removal from the prior Settings phase; follow that same pattern here (grep for every occurrence, remove all of them, confirm `grep -n "people_categories" src/components/features/SettingsModal.tsx` returns nothing when done).
- The `people` and `explores` fetches inside the account-data-export feature (lines ~691-711) — remove those two `.from("people")`/`.from("explores")` calls from whatever export payload they're assembled into, along with their contribution to that payload.

- [ ] **Step 2: Remove `people_categories` from `src/lib/schemas.ts`**

Delete `people_categories: z.array(z.string()).optional(),` from `settingsSchema`.

- [ ] **Step 3: Remove `people_categories` from `src/store/useAppStore.ts`**

Delete `people_categories?: string[];` from the `UserSettings` type. Leave `explore_custom_types` in this file untouched for now — it's dropped at the database layer in Task 8, and since this plan found no UI consumer for it anywhere in `src/`, there's no app-code removal needed here; Task 8 will remove it from `useAppStore.ts` and `database.types.ts` together as part of the DB-column drop, to keep "remove a DB-backed field" as one atomic unit for that field specifically. (This is a deliberate exception to "remove app code before DB" — justified because there is no app code referencing `explore_custom_types` to remove.)

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
npx eslint src/components/features/SettingsModal.tsx src/lib/schemas.ts src/store/useAppStore.ts
npx vitest run src/components/features/__tests__/
git add -A
git commit -m "feat(explore-people-removal): remove Settings People tab and Explore/People export queries"
```

---

### Task 6: Remove the cross-cutting "Linked People" mechanism from Do and Think

**Files:**
- Modify: `src/components/features/TaskCard.tsx`
- Modify: `src/components/features/TaskAddPanel.tsx`
- Modify: `src/app/(app)/do/page.tsx`
- Modify: `src/app/(app)/think/[id]/page.tsx`
- Modify: `src/lib/utils.ts`
- Delete: `src/lib/__tests__/mentions.test.tsx`
- Modify: `src/lib/__tests__/challenger.test.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1-5 directly, but this is the task that finally makes the whole branch typecheck clean (Tasks 1-5 left `peopleMap`/`linked_people_ids` consumers dangling only in spirit, not in broken imports — this task removes the last real references to People-shaped data flowing through Do/Think).
- Produces: `linked_people_ids` is no longer read or written anywhere in application code (Task 8 drops the column). `extractMentions` no longer has any callers and is deleted.

This is the largest task in the plan — it removes a feature (task/thread "linked people" tagging) that spans two spaces. The user confirmed this should be removed outright ("No need since i don't think it works anymore for the app"), not preserved in any dormant form.

- [ ] **Step 1: Remove Linked People from `TaskCard.tsx`**

- The `peopleMap` prop from the component's props type (lines ~55, ~66-69).
- The "Linked People Avatars" rendering block (lines ~408-433).
- The `peopleMap` shallow-comparison logic inside the memo's `areEqual` function (lines ~555-573ish) and the `linked_people_ids` reference/shallow-array comparison block (lines ~598-605ish) — grep for `peopleMap` and `linked_people_ids` in this file and remove every remaining hit, then confirm both greps return nothing.

- [ ] **Step 2: Remove Linked People from `TaskAddPanel.tsx`**

- `linkedPeopleIds` state (~108) and `peopleList` state (~109-111) and their use inside `ManualSnapshot` (the `linkedPeopleIds` field, ~72, and its three snapshot-construction sites, ~158, ~318/372, ~404).
- The `.from("people")` fetch that populates `peopleList` (grep for it — not in the excerpt already read, verify the fetch's `useEffect`/query and remove it).
- The `linked_people_ids: linkedPeopleIds` field in the task-save payload (~543).
- The "Linked People" picker UI block (~1011-1053+, the `{peopleList.length > 0 && (...)}` block).

Grep this file afterward for `peopleList`, `linkedPeopleIds`, and `linked_people` — confirm zero hits.

- [ ] **Step 3: Remove `peopleMap` plumbing from `src/app/(app)/do/page.tsx`**

- The `useQuery(["people_minimal"], ...)` fetch (`peopleList`/`fetchPeopleList`, ~194-206) and `useRealtime("people", fetchPeopleList)` (~275).
- The `peopleMap` `useMemo` (~207-216).
- Every `peopleMap={peopleMap}` prop pass-through to `Column`/`TaskCard` (multiple sites, ~140, ~605, ~618, ~675, ~689, ~703, ~717) and the `peopleMap` prop on `Column`'s own props type (~81, ~92-95).

Grep this file afterward for `peopleMap`, `people_minimal`, and `"people"` — confirm zero hits (aside from unrelated substrings, if any — read matches before deciding).

- [ ] **Step 4: Remove the mention/linked-people system from `think/[id]/page.tsx`**

Same shape as `CaptureModal.tsx`'s mention system in Task 3, duplicated in this file for thread entries:
- `people`/`filteredPeople` state and the `fetchPeople()` effect that queries `.from("people")` (~71-94).
- `showPopover`/`popoverSearch`/`selectedIndex` state and the mention-detection logic inside its input-change and `handleKeyDown` handlers (mirrors the pattern already removed from `CaptureModal.tsx` in Task 3 — same shape, different file).
- `getLinkedPeople()` (~148-153) and its two call sites (~317, ~369) plus the `linked_people_ids: linkedPeople` field written into both thread-update payloads (~325, ~376) — those updates should simply stop setting `linked_people_ids`.
- The "Mentions dropdown overlay" JSX rendering `filteredPeople` (~573-580ish).
- The `handleSelectPerson`-equivalent function for inserting `@[name](id)` markup into the entry textarea, if present alongside the state removed above (mirror of `CaptureModal.tsx`'s `handleSelectPerson`).

Grep this file afterward for `people`, `linked_people`, `getLinkedPeople`, and `showPopover` — confirm the only remaining hits (if any) are unrelated (e.g. a `showPopover` used for some other, non-mention popover in the same file — read before deleting anything not confirmed as part of this mechanism).

- [ ] **Step 5: Remove `extractMentions` from `src/lib/utils.ts`**

By this point in the plan, `CaptureModal.tsx` (Task 3) and `think/[id]/page.tsx` (this task, Step 4) are the only two callers, and both have just been removed. Confirm with `grep -rn "extractMentions" src/` that the only remaining hits are the function's own definition and its test files — then delete the function.

- [ ] **Step 6: Delete `src/lib/__tests__/mentions.test.tsx`**

This file tests only `extractMentions`, now deleted.

```bash
git rm src/lib/__tests__/mentions.test.tsx
```

- [ ] **Step 7: Remove the `extractMentions` describe block from `src/lib/__tests__/challenger.test.tsx`**

This file is a known-flaky suite (timeout-related, unrelated to its content) that this session has repeatedly verified passes 8/8 in isolation — do not investigate or "fix" its flakiness as part of this task. Remove only the `describe("1. extractMentions Edge Cases", ...)` block (~124-168) and its `import { extractMentions } from "@/lib/utils";` (line ~6, only if nothing else in the file still uses it — grep to confirm). Leave every other `describe` block in this file untouched.

- [ ] **Step 8: Verify and commit**

```bash
npx tsc --noEmit
npx eslint src/components/features/TaskCard.tsx src/components/features/TaskAddPanel.tsx "src/app/(app)/do/page.tsx" "src/app/(app)/think/[id]/page.tsx" src/lib/utils.ts src/lib/__tests__/challenger.test.tsx
npx vitest run src/lib/__tests__/challenger.test.tsx
npm test
```

At this point the *entire* app-code surface (everything except Task 7's leftover cosmetic cleanup and Task 8's database layer) should be free of People/Explore/linked-people references. `npx tsc --noEmit` should be fully clean (no more of the expected Task-1-through-5 dangling-reference errors) and the full `npm test` run should be green modulo the three known-flaky suites (verify any flake by rerunning that suite in isolation before treating it as non-blocking).

```bash
git add -A
git commit -m "feat(explore-people-removal): remove cross-cutting Linked People mechanism from Do and Think"
```

---

### Task 7: Clean up remaining tokens, realtime wiring, and tests

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/hooks/useRealtime.ts`
- Modify: `tests/realtime.spec.ts`

**Interfaces:**
- Consumes: Task 6's completion — by this point `grep -rn "people\|explore" src/ --include=*.tsx --include=*.ts -i` (excluding this task's own remaining target files, `database.types.ts`, and this plan's own artifacts) should turn up only the items listed below.
- Produces: no leftover dead CSS tokens or realtime channel wiring for tables that no longer exist in the app layer (they're dropped from the database itself in Task 8).

- [ ] **Step 1: Remove dead design tokens from `src/app/globals.css`**

First confirm these are actually unused post-Task-1-through-6 removal: `grep -rn "color-people\|color-explore\|space-remember\b\|space-explore" src/ --include=*.tsx --include=*.ts --include=*.css` (excluding `globals.css` itself). If any file still references one of these tokens, leave that token and note it in the task report instead of breaking that file.

If confirmed unused, remove:
- `--color-people: var(--space-remember);` and `--color-explore: var(--space-explore);` (lines ~60, ~62).
- `--space-remember` / `--space-remember-dim` / `--space-remember-border` and `--space-explore` / `--space-explore-dim` / `--space-explore-border` (lines ~169-174, duplicated in the light-mode block ~402-407) — **but only if nothing outside People/Explore ever reads `--space-remember`/`--space-explore` directly** (as opposed to via `--color-people`/`--color-explore`). Grep specifically for `--space-remember` and `--space-explore` (not just `--color-*`) before removing, since Remember/Locations might reference `--space-remember` directly somewhere this plan's investigation didn't surface.

- [ ] **Step 2: Remove `people`/`explores` from `src/hooks/useRealtime.ts`**

Remove the `people: [["people_minimal"], ["people"], ["dashboard"]],` and `explores: [["explores"], ["dashboard"]],` entries from the channel-invalidation map (lines ~19, ~21).

- [ ] **Step 3: Update `tests/realtime.spec.ts`**

This Playwright test asserts realtime subscription behavior specifically for the `people` channel/topic (`[data-testid="subscriber-people"]`, `peopleJoins`/`peopleLeaves` counts, lines ~46-91). Since the `people` realtime channel no longer exists (Step 2 removed it), this test would now fail or assert against nothing. Remove the people-channel-specific test case(s); leave every other channel's test in this file untouched. If the `[data-testid="subscriber-people"]` element itself was rendered by a component already deleted in an earlier task, this test should already be failing before this step — that's expected, this step is what fixes it.

- [ ] **Step 4: Full-repo sanity sweep**

Run one final repo-wide check before moving to Task 8:

```bash
grep -rni "people\|explore" src/ --include=*.ts --include=*.tsx --include=*.css | grep -v "database.types.ts"
```

Read every remaining hit. Expected survivors at this point: nothing in application code should remain — if something does, it's either (a) a false-positive substring match (e.g. a word containing "peopled" or unrelated "explore" in a comment about something else — read before assuming), or (b) a real miss from an earlier task that needs fixing in *this* task before moving on, since Task 8 assumes app code is already clean. Note anything you leave deliberately (with reasoning) in the task report.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
npm run lint
npm test
git add -A
git commit -m "feat(explore-people-removal): remove dead People/Explore tokens and realtime wiring"
```

---

### Task 8: Database migration — drop `people`/`explores` tables and related columns

**Files:**
- Create: `supabase/migrations/<YYYYMMDDHHMMSS>_drop_people_explore.sql` (use a timestamp later than `20260820000000`, the most recent existing migration — check `ls supabase/migrations/` at execution time for the actual latest and pick a later one, e.g. `20260915000000_drop_people_explore.sql` if nothing newer already exists)
- Modify: `src/types/database.types.ts`
- Modify: `src/store/useAppStore.ts` (remove `explore_custom_types?: string[];`, deferred from Task 5 per that task's Step 3 note)

**Interfaces:**
- Consumes: Task 7's confirmation that no application code references `people`, `explores`, `linked_people_ids`, `people_categories`, or `explore_custom_types` any more.
- Produces: the final, fully-migrated schema. Nothing downstream of this task in this plan.

**This is the one irreversible step in this plan.** Per Global Constraints, this task only *writes* the migration file — it never runs it against any live/remote Supabase project. Follow the file's own header comment convention (see `supabase/migrations/20260731000000_drop_ritual_streak.sql` for the precedent — an `-- Invariant-change-approved-by: user / <date>` comment tag).

- [ ] **Step 1: Write the migration**

```sql
-- Drop the people and explores tables (and everything that exists only to
-- support them) as part of removing the Explore and People features from
-- the app. Confirmed by the user: full removal, no export/migration path
-- for existing data in these tables.
-- Invariant-change-approved-by: user / 2026-09-15

-- 1. Drop the trigger and function that kept items/threads' linked_people_ids
--    in sync with people deletions — meaningless once people is gone.
DROP TRIGGER IF EXISTS trigger_remove_linked_person ON people;
DROP FUNCTION IF EXISTS remove_linked_person();

-- 2. Drop the linked_people_ids columns (and their GIN indexes) from items
--    and threads — the "Linked People" feature is removed from the app.
DROP INDEX IF EXISTS idx_items_linked_people_ids;
DROP INDEX IF EXISTS idx_threads_linked_people_ids;
ALTER TABLE items DROP COLUMN IF EXISTS linked_people_ids;
ALTER TABLE threads DROP COLUMN IF EXISTS linked_people_ids;

-- 3. Drop the now-dead user_settings columns.
ALTER TABLE user_settings DROP COLUMN IF EXISTS people_categories;
ALTER TABLE user_settings DROP COLUMN IF EXISTS explore_custom_types;

-- 4. Drop explores' own FK index before dropping the table (belt and
--    braces — DROP TABLE would take it with the table regardless).
DROP INDEX IF EXISTS idx_explores_linked_thread_id;
DROP INDEX IF EXISTS idx_explores_active;

-- 5. Drop the tables themselves. explores.linked_thread_id -> threads.id
--    and both tables' user_id -> auth.users FKs go with them.
DROP TABLE IF EXISTS explores;
DROP TABLE IF EXISTS people;
```

Before finalizing, re-check `supabase/migrations/` for the exact current set of indexes/constraints on these tables (this plan's investigation found `idx_explores_active`, `idx_explores_linked_thread_id`, `idx_items_linked_people_ids`, `idx_threads_linked_people_ids`, and the RLS-loop migrations that generate per-table policies for `'people'`/`'explores'` — those policies are dropped automatically with their tables, no explicit `DROP POLICY` needed) — adjust the SQL above if the live migration history shows anything this plan's investigation missed.

- [ ] **Step 2: Update `src/types/database.types.ts`**

Remove:
- The full `people` table type definition (Row/Insert/Update, and its Relationships array if present).
- The full `explores` table type definition (Row/Insert/Update, and its `explores_linked_thread_id_fkey` Relationships entry).
- `linked_people_ids` from `items`' and `threads`' Row/Insert/Update shapes (2 tables × 3 shapes = 6 sites).
- `people_categories` and `explore_custom_types` from `user_settings`' Row/Insert/Update shapes (2 fields × 3 shapes = 6 sites).

If Supabase CLI access is available in this environment and pointed at a database that already has this migration applied, prefer running `npm run types:generate` over hand-editing (it's the source of truth for this file's format) — but do not apply the migration to any non-local database just to make generation possible. If CLI generation isn't feasible here, hand-edit carefully to match the existing file's formatting conventions exactly (this file is generated and machine-formatted; an implementer hand-edit that drifts from that formatting will be visible in review).

- [ ] **Step 3: Remove `explore_custom_types` from `src/store/useAppStore.ts`**

Delete `explore_custom_types?: string[];` from the `UserSettings` type (deferred from Task 5, see that task's Step 3 note — this is the point where it finally has no backing column).

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
npm run lint
npm test
git add -A
git commit -m "feat(explore-people-removal): drop people/explores tables and related columns"
```

Report in the task's completion notes: the exact migration filename created, confirmation it was never applied to any live/remote database by this task, and the exact set of `database.types.ts` edits made (hand-edited vs. CLI-generated).

---

## Self-Review Notes

- **Spec coverage**: §18 step 5 (remove Explore/People) is fully covered — nav, routes, capture, search, settings, cross-cutting linked-people, and the database layer. §19/20's open question is resolved by the user's explicit "full removal" decision, documented in Global Constraints, superseding the spec's own default recommendation.
- **Sequencing**: Tasks 1-2 (UI shell) → 3-5 (integration points: capture/search/settings) → 6 (cross-cutting mechanism, the task that actually makes tsc clean again) → 7 (cosmetic/wiring cleanup) → 8 (database, strictly last). This ordering means Tasks 1-5 intentionally leave `tsc` non-clean at the *full-repo* level (documented explicitly in Task 1 Step 4 and Task 2's closing note) — each task's own changed files are still individually lint-clean throughout, and the repo returns to a fully green `tsc`/lint/test state at the end of Task 6, staying green through Tasks 7-8. Flag this to whoever reviews Tasks 1-5 individually so a "full tsc isn't clean yet" observation isn't mistaken for a defect — it's the plan's designed intermediate state, the same way this project has NOT historically left a branch mid-tasks with an intentionally broken build; if this feels risky, an implementer or reviewer is authorized to note it as a ruling in the SDD ledger and proceed, since Task 8's constraint (types drop last) and Task 6's constraint (mechanism removed before its last real consumers) are the two invariants that actually matter, not full-repo greenness at every single intermediate commit.

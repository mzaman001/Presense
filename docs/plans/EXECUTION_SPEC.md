# Presense — Execution Specification

**Document type:** Deterministic ticket backlog for an AI coding agent.
**Author role:** Principal Software Architect / Staff Frontend Engineer / Design Systems Lead / Technical Writer / AI Workflow Architect (synthesis pass).
**Not in scope:** Implementation code, new visual identity, motivational framing.
**In scope:** What must change, why (evidence), what "done" means, and where sources disagree.

## 0. How to use this document

1. Tickets are grouped into phases (`0`–`5`). Phases are sequential; tickets inside a phase may be parallelized unless a "Depends on" field says otherwise.
2. Every ticket has: ID, Title, Priority, Files, Root cause (evidence — file + line where available), Requirement, Acceptance criteria, Depends on, Conflicts.
3. "Requirement" states the end condition, not the implementation. The executing agent chooses implementation details unless a ticket explicitly restricts them.
4. Any ticket referencing a conflict (`CONF-xx`) must not be started until that conflict is resolved by a human decision-maker. Do not silently pick a side.
5. Ticket numbering is stable. Do not renumber. If a ticket is dropped, mark it `WITHDRAWN`, do not reuse the ID.
6. "Done when" criteria must be independently verifiable (a reviewer or a test can check them without reading the implementation).

## 1. Source materials reviewed

| # | Source | Type | Location |
|---|---|---|---|
| 1 | Presense-main repository (full source) | Codebase | `Presense-main/src`, `supabase/`, root docs |
| 2 | `PROJECT.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `ORIGINAL_REQUEST.md`, `CLAUDE.md`, `AGENTS.md`, `plan.md` | Repo documentation | repo root |
| 3 | User bug reports (13 items, verbal + 4 screenshots) | Direct report | this conversation |
| 4 | `presense-audit/` — 13-document design/UX/a11y/mobile/perf audit produced by a separate agent ("Lovable") | Third-party audit | `audit/00`–`audit/21` |
| 5 | Screenshots: Inbox "Route it" dropdown clipped, Do "You're all caught up" empty state, Do Calendar week view, collapsed sidebar with no user row | Visual evidence | 4 uploaded images |

Every ticket below that cites a file path and line number was verified by direct inspection of the repository, not inferred from the audit alone. Where a ticket relies solely on the audit's own claim (not independently re-verified line-by-line in this pass), it is marked `[audit-sourced, not re-verified]`.

**Note (audit July 9, 2026):** Of the files listed in row 2 above, only `ARCHITECTURE.md` (now at `docs/project/`), `DESIGN_SYSTEM.md` (at `docs/project/`), and `AGENTS.md` (root) currently exist in the repository. `PROJECT.md`, `ORIGINAL_REQUEST.md`, `CLAUDE.md`, and `plan.md` were retired during MD-01/MD-02 doc consolidation (see §15.3). They are retained in this table as historical record of the document landscape at audit time, not as currently-relevant files. This document's own §1430 instruction governs: read all such references as historical. The current canonical doc set is: `AGENTS.md` (root, single entry point), `docs/agents/EXECUTION_RULES.md`, `docs/plans/EXECUTION_SPEC.md` (this file), `docs/project/{CONTEXT, DESIGN_SYSTEM, ARCHITECTURE, COMPONENT_MANIFEST, DOCS_NEEDS_CODE}.md`, `GEMINI.md` (root, pointer), `README.md` (root, public).

## 2. Conflict register

These are direct disagreements between sources. Each must be resolved by a human before dependent tickets start. The executing agent must stop and surface the conflict rather than guess.

### CONF-01 — Default theme name

- **Source A (`CLAUDE.md`, repo root):** "THEME SYSTEM: The default theme is Wahala (orange/amber)."
- **Source B (user, this conversation, item 7):** "rename Wahala theme everywhere to something like sunset or something."
- **Source C (audit `10-design-system-spec.md`):** proposes renaming the theme's `data-theme` attribute value to `warm` (a system identifier, not a display name).
- **Conflict:** "Wahala" is both a display name and, per `CLAUDE.md`, treated as a rule ("Currently active theme tokens" are defined under this name). The user wants a *display* rename (e.g., "Sunset"). The audit wants an *internal* rename (`data-theme="warm"`). These are not mutually exclusive but must be decided as two separate values: (a) the internal `data-theme` attribute/enum value used in code and storage, (b) the user-facing label shown in Settings. Tickets `BUG-07` and `DS-03` must not each invent a different pair of values.
- **Resolution required before:** `BUG-06`, `BUG-07`, `DS-03`.
- **Resolution status (audit July 9, 2026): CONFIRMED RESOLVED.** Themes are `warm`/`navy`/`forest` (third name set). `src/lib/theme.ts`'s `LEGACY_THEME_MAP` handles all 3 generations: `wahala`/`orange`/`blue`/`forest` (original) → `sunset`/`midnight`/`meadow` (intermediate) → `warm`/`navy`/`forest` (current). No further rename permitted — see `AGENTS.md` invariant 2 and `docs/agents/EXECUTION_RULES.md` Law 6. The user chose these three names directly, for the specific reason of having one consistent identifier across the database, `localStorage`, and CSS — not a negotiated compromise between competing proposals.

### CONF-02 — Space color values

- **Source A (`DESIGN_SYSTEM.md`, repo root):** Do `#FBBF24` (amber), Think `#2DD4BF` (teal), Remember `#7692FF` (blue/purple), Explore `#A78BFA` (violet) — a cool-toned palette for three of four spaces.
- **Source B (`design_identity.md` pillar 2 / `DESIGN_SYSTEM.md` philosophy):** "Warmth at the centre — Amber, coral, deep orange. Cool colours appear only as secondary accents." Directly contradicted by Source A's Think/Remember/Explore values.
- **Source C (`src/app/globals.css:130–142`, warm-dark theme):** all four `--space-*` tokens resolve to `var(--accent)` (identical amber) — space color distinction does not exist in this theme.
- **Source D (`src/app/(app)/do/page.tsx` Column `accent` props, e.g. `accent="#FBBF24"` for Today, `accent="#2DD4BF"` for Upcoming, `accent="#A78BFA"` for Someday):** the same four hex values from Source A are hardcoded, but assigned to **task-status columns inside one space (Do)**, not to the four spaces. This is a third, incompatible usage of the same color set.
- **Source E (audit `10-design-system-spec.md` §Color):** proposes a new all-warm four-color palette (`#E5B41E`/`#EB4233`/`#F4A261`/`#A76011`) that matches neither Source A nor Source D.
- **Conflict:** there are three different concepts sharing token names — (1) per-space identity color (documented, unused in default theme), (2) per-status color inside Do (hardcoded, actually rendered), (3) the audit's proposed replacement palette. A fix cannot proceed until it is decided whether `--space-*` tokens mean "space identity" or get renamed/merged with the existing per-status Do colors, and whether the resulting palette is warm-only (per identity pillar) or mixed.
- **Resolution required before:** `DS-01`.
- **Resolution status (audit July 9, 2026): CONFIRMED RESOLVED.** `--space-do/-think/-remember/-explore` resolve to 4 distinct warm-family hues (`#E5B41E`, `#EB4233`, `#F4A261`, `#A76011` in default mode; separate darker set for alternate mode). DS-28 (OKLCH derivation) is spec'd in `docs/project/DESIGN_SYSTEM.md` §1.5 but NOT YET implemented — current values are hand-picked warm hex, not OKLCH-derived. See `docs/project/DOCS_NEEDS_CODE.md`.

### CONF-03 — `globals.css` "never touch" rule vs. required rewrite

- **Source A (`CLAUDE.md`):** "`app/globals.css` — all CSS custom properties and theme tokens, touch nothing here unless the task explicitly says so."
- **Source B (audit, all of `10`, `20`, `21`):** requires extensive `globals.css` edits (token dedup, theme attribute rewrite, elevation system, motion tokens, deletion of ~200+ lines).
- **Conflict:** none in substance — `CLAUDE.md`'s rule is a guard against undirected/opportunistic edits by an agent working a narrow ticket, not a prohibition on an explicitly authorized rewrite. This document **is** that explicit authorization for the `globals.css` tickets listed under Phase 1. No action needed, but the executing agent must not extend this authorization to files/sections not named in a ticket.

### CONF-04 — Task deletion semantics across spaces (see `BUG-08`)

- **Source A (`src/components/features/TaskCard.tsx:109`):** swipe-to-delete on a task sets `status: 'archived'` (soft, reversible via a 5-second undo toast, task remains in the `items` table indefinitely under `archived` status, no expiry).
- **Source B (`src/components/features/TaskAddPanel.tsx:130`):** the delete action inside the Edit Task sheet performs `supabase.from('items').delete()` — a hard, permanent, unrecoverable delete on the same `items` table.
- **Source C (`src/app/(app)/explore/trash/page.tsx`):** the `items` table is also queried with `status: 'deleted'` (line 24) as part of a *global-looking* trash view that also reads `explores` and `threads` — implying a `'deleted'` status was intended to exist on `items`, distinct from `'archived'`.
- **Source D (`src/app/(app)/think/[id]/page.tsx:214` vs `:218`):** two different delete code paths in the **same file** — one hard `.delete()`, one soft `update({status: 'deleted', deleted_at})`.
- **Conflict:** there are at least three semantically different states in play for what the user perceives as one action ("delete"): hard delete, soft-archive-no-trash-no-expiry, and soft-delete-with-trash-and-expiry. `BUG-08` requires a single decision on the canonical model before any code changes.
- **Resolution required before:** `BUG-08`, `DS-11`.

### CONF-05 — Sidebar interaction model

- **Source A (current code, `Navigation.tsx:76–85`):** sidebar width is toggled only by an explicit click on a chevron button; there is no hover-driven expand/collapse.
- **Source B (user, item 1):** "I wanted a hover sidebar" — implies hover-to-expand, mouse-leave-to-collapse, without a persistent click-toggle.
- **Conflict:** a pure hover-expand model removes the ability to "pin" the sidebar open, which some users rely on (and which the existing `sidebarState: "full" | "rail"` persisted store value assumes). `BUG-01` needs a decision: (a) hover-only, no pinning, or (b) hover-to-preview when collapsed, click to pin/unpin, matching e.g. VS Code's or Notion's sidebar. This document does not choose; `BUG-01` requirement is written to require an explicit decision output as part of the ticket, not to presume one.

### CONF-06 — Command surface: capture vs. search on Cmd+K

- **Source A (current code):** `Cmd+K` opens `CaptureModal` (`Navigation.tsx` tooltip, `CaptureModal.tsx` keydown handler).
- **Source B (audit `01-ux-audit.md` §Search, `12-interaction-patterns.md` §Search/Command):** industry convention (Linear, Raycast, Notion, GitHub) binds `Cmd+K` to a command palette / search-first surface, and proposes `Cmd+Shift+K` for capture, `Cmd+/` for search.
- **Conflict:** this is a keybinding remap that changes existing muscle memory for current users of the app. Not a defect — a product decision. Flagged, not silently adopted. `DS-08` requires explicit sign-off before remapping `Cmd+K`.

## 3. Priority phases

| Phase | Name | Contains | Gate to start next phase |
|---|---|---|---|
| 0 | Reported defect fixes | `BUG-01`…`BUG-13` | All `BUG-*` tickets pass acceptance criteria |
| 1 | Design system foundation | `DS-01`…`DS-14` | Token surface consolidated, no dual systems remain |
| 2 | Accessibility baseline | `A11Y-01`…`A11Y-09` | WCAG 2.2 AA spot-checks pass on the checklist in §7 |
| 3 | Mobile & interaction consistency | `MOB-01`…`MOB-07`, `INT-01`…`INT-05` | Manual pass on a real iOS + Android device |
| 4 | Performance | `PERF-01`…`PERF-06` | Lighthouse mobile score ≥ target in `PERF-06` |
| 5 | Backend & delivery infrastructure | `INFRA-01`…`INFRA-14` | CI gates in `INFRA-02` are enforced on `main` |

Phase 0 tickets may start immediately and in parallel with each other except where a "Depends on" field says otherwise. Phases 1–5 should not start until Phase 0 is merged, because several Phase 1 tickets (`DS-01`, `DS-11`) directly touch files that Phase 0 tickets also touch (`globals.css`, `TaskCard.tsx`, `TaskAddPanel.tsx`), and merging both concurrently risks silent regressions on the bug fixes.

---

## 4. Phase 0 — Reported defect tickets

### BUG-01 — Sidebar is not a hover sidebar

- **Priority:** Critical
- **Files:** `src/components/layout/Navigation.tsx` (lines 38–86 for the shell, 44–46 for state), `src/store/useAppStore.ts` (lines 53–54, 82–84)
- **Root cause:** `sidebarState` is a two-value enum (`"full" | "rail"`) toggled exclusively by clicking the chevron button at `Navigation.tsx:76–85`. There is no `onMouseEnter`/`onMouseLeave` handler on the `<aside>` element (line 49) that changes `sidebarState`. The sidebar is a click-toggle rail, not a hover sidebar.
- **Conflict:** `CONF-05` — the exact interaction model (pure hover vs. hover-preview-with-pin) must be decided before implementation.
- **Requirement:** Once `CONF-05` is resolved, the sidebar's expand/collapse behavior must match the decided model exactly, including the case where the sidebar is pinned open (if the decision includes pinning) and a page has focus inside a form (hover-collapse must not fire while an input inside the sidebar area has focus, if any exists).
- **Acceptance criteria:**
  1. The resolution of `CONF-05` is recorded in this document (or a linked decision doc) before this ticket is started.
  2. The sidebar's expand/collapse trigger matches the decided model on desktop (`md:` breakpoint and above only — mobile uses `BottomNav`, untouched).
  3. `sidebarState` persistence behavior (survives reload) is explicitly re-specified to match the new model — a pure-hover model has no persisted "expanded" state to restore; a hover-with-pin model persists only the pinned state.
  4. No regression to `BottomNav` (`Navigation.tsx:359–430`), which is unrelated to this ticket.
- **Depends on:** `CONF-05` resolved.

### BUG-02 — Ritual system shows wrong time-of-day state

- **Priority:** Critical
- **Files:** `src/components/layout/Navigation.tsx` (lines 46, 125–174), `src/components/features/RitualOverlay.tsx`
- **Root cause (two independent bugs, both must be fixed):**
  1. `const now = useMemo(() => new Date(), [])` at `Navigation.tsx:46` computes the current time exactly once, at component mount, and never again for the lifetime of the mounted sidebar. On a long-lived tab (the common case for a productivity app left open all day), `now` becomes stale within minutes. The morning/evening/done state machine at lines 125–143 reads `now.getHours()` from this stale value, so a user who opened the app in the morning and leaves the tab open will see the morning-ritual state (`"Plan my day"`) all the way into the evening, or vice versa if they left it open overnight.
  2. Independent of staleness: the state machine's branch order (`Navigation.tsx:132–136`) is `if (morningDone && eveningDone) → all_done; else if (morningDone && hour >= shutdownHour) → evening; else if (morningDone) → done; else → morning` (the `else` default). This means: if the user has **not yet completed the morning ritual**, the button shows `"Plan my day"` (morning state) regardless of what hour it currently is — including at 9 PM. This is a second, independent cause of "morning routine showing up in the evening," separate from the staleness bug.
- **Requirement:**
  1. The current-time value driving ritual state must be recomputed at least on every window focus event and at local-midnight rollover, not only once at mount.
  2. The state machine must have an explicit branch for "current hour is at or after `shutdownHour` AND morning ritual was never completed today" — today this collapses into the generic `morning` branch and is copy-labeled `"Plan my day"`, which is misleading in the evening. Decide and implement the correct label/action for this case (e.g., a distinct "missed morning — do evening review instead" affordance, or "Plan my day (late)"), consistent with how the referenced Sunsama-style ritual pattern (per the user's request to study Sunsama's documentation) handles a skipped morning ritual.
- **Acceptance criteria:**
  1. Leaving the app open across the `shutdownHour` boundary without any interaction updates the sidebar button's icon and label within one focus/refresh cycle, without requiring a manual page reload.
  2. A user who never completes the morning ritual sees a different label/state after `shutdownHour` than before it.
  3. `RitualOverlay.tsx`'s own internal date logic (`todayString`, lines referencing `last_ritual_date`/`last_evening_ritual_date`) is audited for the same "computed once, never refreshed" pattern and fixed if present.
- **Depends on:** none.

### BUG-03 — Dropdown menus render clipped/behind other content

- **Priority:** Critical
- **Files:** `src/app/(app)/inbox/page.tsx` (lines 49–58 for the clipping ancestor, 90–110 for the clipped dropdown), `src/components/ui/Dropdown.tsx` (lines 84–117, 139–176)
- **Root cause:** In `inbox/page.tsx`, the `InboxItemCard`'s outermost wrapper (`m.div`, line 56) is styled `"group relative rounded-2xl overflow-hidden"`. The "Route it" dropdown menu (`.dropdown-panel absolute top-full mt-2 right-0 ...`, line 91) is a descendant of this `overflow-hidden` ancestor. CSS `overflow: hidden` clips any descendant content that visually extends past the ancestor's box, regardless of the descendant's `z-index` — `z-50` on the dropdown does not help because clipping happens before stacking-context compositing. The screenshot evidence (Image 1) shows exactly this: the dropdown panel's top edge is visible just below the "Route it" button and then is cut off. This is a structural CSS bug, not a z-index bug.
- **Confirmed same-pattern risk elsewhere:** `src/components/ui/Dropdown.tsx` renders its own `.dropdown-panel` as a plain absolutely-positioned sibling (not portaled to `document.body`). Any call site that places a `<Dropdown>` inside a container with `overflow: hidden` or `overflow: auto` (e.g., a `GlassCard`, a `Sheet` body, a horizontally-constrained row) will reproduce this bug. Known call sites to re-audit: `src/components/features/TaskAddPanel.tsx`, `src/components/features/AddPersonPanel.tsx`, `src/components/features/LocationAddPanel.tsx`, `src/components/features/ExploreDrawer.tsx` (line 268, its dropdown already sits inside a `max-h-48 overflow-y-auto` container — same defect class).
- **Requirement:** Dropdown/menu surfaces must not be visually clippable by a scrolling or `overflow`-constrained ancestor. This requires either (a) rendering the menu content through a portal to `document.body` (or a dedicated overlay root) with position computed relative to the trigger (standard for Radix/Base UI `Popover`/`Menu` primitives — `src/components/ui/Popover.tsx` and the audit's `13-component-inventory.md` recommendation to migrate `Dropdown` to a portal-backed `Menu` primitive apply here), or (b) removing `overflow: hidden` from every ancestor between a dropdown trigger and the document root and replacing the visual clipping/rounding effect those ancestors relied on with a non-clipping alternative (e.g. `mask-image` or restructured DOM). Option (a) is the only approach that scales past one fix — a per-call-site audit is not a durable fix.
- **Acceptance criteria:**
  1. The Inbox "Route it" dropdown renders fully visible, unclipped, positioned correctly relative to the trigger button, at all five destinations' menu heights, including when the trigger is the last visible row in a scrolled list.
  2. Every other dropdown/menu call site in the codebase (grep for `dropdown-panel`, `<Dropdown`, `<Popover`) is verified against the same defect class and fixed if affected.
  3. Dropdown menus remain interactive with keyboard (arrow keys, `Enter`, `Escape`) after the fix — this ticket must not regress keyboard support.
- **Depends on:** none. Should land before `DS-04` (Menu primitive consolidation) since it may be superseded by it, but should not wait for the full design-system pass given its "Critical" severity.

### BUG-04 — "Add Task" in empty states opens Quick Capture instead of the Add Task sheet

- **Priority:** High
- **Files:** `src/app/(app)/do/page.tsx` (lines 328–331 for the correct behavior, lines 416–419 and 441–444 for the defective behavior)
- **Root cause:** Three separate "Add Task" entry points exist on the Do page. The page-header one (`do/page.tsx:328–331`) correctly calls `setTaskToEdit(null); setIsPanelOpen(true)`, opening the `TaskAddPanel` sheet — this is the correct, intended target. The two empty-state buttons, both labeled "Add Task" and both inside a `"You're all caught up"` `GlassCard` (one in the Today view at lines 416–419, one in the Board/all-columns view at lines 441–444), instead call `useAppStore.getState().setCaptureModalOpen(true)`, opening the global `CaptureModal` (Quick Capture with NLP routing). A user pressing a button labeled identically ("+ Add Task") in three places on the same page gets two different UI surfaces depending on which one they pressed — this is the behavior the user is reporting.
- **Requirement:** All three "Add Task" entry points on the Do page must open the same target surface. Given the button's label and icon are identical to the page-header "Add task" button (which opens `TaskAddPanel`), and given `TaskAddPanel` is the structured, space-scoped creator for a Do task (per the interaction-pattern convention that per-space "+" buttons are space-scoped creators, while Quick Capture/Cmd+K is the ambiguous, NLP-routed entry point — see `12-interaction-patterns.md` §Create in the audit), the two empty-state buttons must be changed to call `setTaskToEdit(null); setIsPanelOpen(true)`, matching the header button.
- **Acceptance criteria:**
  1. Pressing "Add Task" from either empty state opens the `TaskAddPanel` sheet, not `CaptureModal`.
  2. The header "Add task" button's behavior is unchanged.
  3. No other page in the app (`Think`, `Explore`, `Remember`) has the same divergence between its empty-state creator button and its header creator button — audit and fix if found (grep each `page.tsx` for `setCaptureModalOpen` vs. that space's own add-panel state setter).
- **Depends on:** none.

### BUG-05 — Calendar view is structurally broken

- **Priority:** Critical
- **Files:** `src/components/features/calendar/CalendarView.tsx` (line 226), `src/components/features/calendar/WeekView.tsx` (lines 192–198, 205–314)
- **Root cause (four independent defects under one user-visible symptom):**
  1. **Layering/height ("behind the Do space"):** `CalendarView.tsx:226` sets the calendar's root height to `h-[calc(100dvh-180px)] min-h-[600px]` — a hardcoded, unverified `180px` offset guess for "everything above the calendar" (header, view switcher, category pills, contextual tip). This value is not derived from the actual rendered height of those elements. On any layout where the actual chrome above the calendar differs from 180px (different category pill count via `userSettings?.do_categories`, contextual tip shown/hidden, different viewport), the calendar either overflows its intended box (rendering under/behind subsequent page content) or leaves dead space. This is the direct cause of "the calendar is completely broken now, being behind the Do space."
  2. **Header/grid horizontal scroll desync (mobile layout, "lining" and "showing of multiple tasks"):** In `WeekView.tsx`, the day-of-week header row (lines 205–229, no `overflow-x` or `min-width` set) and the all-day row (lines 232–256) are laid out with `flex-1` columns that assume the viewport is wide enough to show 7 columns. The actual time-grid body below them (lines 259–314) is wrapped in a horizontally scrollable container (`overflow-auto`, line 259) whose inner content is forced to `min-w-[800px]` (line 261) so that on any viewport under 800px the grid scrolls horizontally — but the header row above it has no matching `min-w-[800px]` and no scroll synchronization with the grid's `scrollRef`. Below 800px width, scrolling the grid horizontally desyncs the day columns from their headers.
  3. **No keyboard integration:** `WeekView.tsx` has no `onKeyDown` handler anywhere in the file, no `tabIndex` on the hour-slot cells, and no arrow-key navigation between slots or task chips. A user cannot navigate or activate the calendar without a mouse/touch pointer.
  4. **Clicking to add a task uses an unreliable indirect path:** `handleSlotClick` (`WeekView.tsx:192–196`) and `handleAllDayClick` (198–202) do not open `TaskAddPanel` with the clicked date/time as structured field values. Instead they build a natural-language string (e.g. `"on 2026-07-03 at 11:00"`), stuff it into `captureModalPrefill`, and open the global `CaptureModal`, relying on the NLP router (`capture-router.ts`) to correctly re-parse that string back into a date. This is an unnecessary round-trip through an ambiguity-prone text parser for information that was already a precise `Date` object one line earlier — if the parser mis-reads the string, the resulting task gets the wrong date silently. This is very likely the specific behavior the user means by "adding task by clicking on it being broken."
- **Requirement:**
  1. The calendar's root container height must be derived from actual layout (flex/grid sizing against a real ancestor height, e.g. `h-full` inside a properly `h-dvh`/flex-constrained parent), not a magic-number subtraction.
  2. The header row and all-day row must scroll horizontally in lock-step with the time-grid body at all viewport widths, or the calendar must switch to a viewport-appropriate layout (see mobile requirement below) below a defined breakpoint so the desync scenario cannot occur at all.
  3. Below a defined mobile breakpoint, the calendar's default view must be a single-day agenda view, not a horizontally-compressed week view — a new `DayView` component is required (see `MOB-02`; this ticket depends on it for the mobile portion of the fix, or must deliver an equivalent minimal day-agenda fallback if `MOB-02` is not yet available).
  4. Hour-slot cells and task chips must be keyboard-reachable (`tabIndex=0` or native focusable elements) and keyboard-operable (`Enter`/`Space` to open/create, arrow keys to move focus between adjacent slots).
  5. Clicking or activating a calendar slot or all-day cell must open `TaskAddPanel` with the deadline field pre-populated from the already-known `Date` object computed in `handleSlotClick`/`handleAllDayClick`, not route through `CaptureModal`'s NLP text parser.
- **Acceptance criteria:**
  1. On a 1440px desktop viewport, switching between Board and Calendar view via the Do page view switcher never shows the calendar rendering underneath any other page element, at any scroll position.
  2. On a 375px mobile viewport, the calendar defaults to a day-agenda layout; if week view is manually selected, scrolling it horizontally keeps headers aligned with columns at every scroll position.
  3. Every hour slot and every visible task chip can be reached via `Tab` and activated via `Enter`/`Space` without a pointer.
  4. Clicking an empty calendar slot opens `TaskAddPanel` with the correct date and hour already filled in the deadline field, verified against at least one slot in each hour-of-day boundary case (00:00, 23:00, and one slot that spans a DST transition date if applicable to the deployment timezone).
- **Depends on:** `MOB-02` for the mobile day-view portion (may be delivered together).

### BUG-06 — Theme is inconsistent at login (sometimes blue, sometimes default)

- **Priority:** High
- **Files:** `src/app/layout.tsx` (lines 77–82), `src/components/layout/AppInitializer.tsx` (lines 83–90, 106)
- **Root cause:** The root layout's blocking inline script (`layout.tsx:77–82`), which runs on every page load including the unauthenticated login page, reads the theme purely from `localStorage.getItem('presense_theme')`, defaulting to `'orange'` only if that key is entirely absent. `localStorage` is not cleared on sign-out (`SettingsModal.tsx:355, 462` calls `supabase.auth.signOut()` and nothing else related to theme storage) and is not scoped per-account. Consequently: (a) on a shared or previously-used browser, a different user's or session's last-selected theme (e.g. `'blue'` → `theme-navy`) persists into the next login screen regardless of who is logging in; (b) a user who tried a different theme once, then signed out, sees that theme — not the default — every time they return to the login screen, even before authenticating. `AppInitializer.tsx:83` has a related but distinct issue: inside the authenticated app it correctly prefers `userSettings?.theme` (the account's saved preference) over `localStorage`, but the **login page is rendered before this resolution can occur**, so the login screen is permanently dependent on the unscoped `localStorage` fallback described above.
- **Requirement:**
  1. The login page (unauthenticated state) must always render the default theme, not a value read from `localStorage`. `localStorage`'s theme key must not influence any unauthenticated route.
  2. Sign-out must clear the `presense_theme` `localStorage` key (or otherwise ensure it cannot leak a previously-authenticated user's preference to the next session on the same browser), consistent with `CONF-01`'s resolution for what the default theme is named/valued.
  3. Once authenticated, the theme must resolve from the account's stored `user_settings.theme`, falling back to the default only if that field is genuinely unset (e.g., brand-new account, before onboarding completes) — this part of the existing `AppInitializer.tsx` logic is correct and must not be changed by this ticket, only the login-page and sign-out gaps.
- **Acceptance criteria:**
  1. On a browser with `localStorage.presense_theme` set to a non-default value, loading `/login` (signed out) always shows the default theme.
  2. Signing out of an account that had a non-default theme, then loading `/login` again, shows the default theme, not the account's theme.
  3. Signing back into that same account restores its saved non-default theme once the app shell (post-`AppInitializer`) mounts.
  4. This ticket's default value is resolved from `CONF-01`, not invented independently.
- **Depends on:** `CONF-01` resolved.

### BUG-07 — Rename "Wahala" theme and other theme names

- **Priority:** Medium
- **Files:** `CLAUDE.md` (theme-system section), `src/app/layout.tsx` (lines 77–82, string literals `'orange'`/`'blue'`/`'forest'`), `AppInitializer.tsx` (lines 83–90), any Settings UI theme picker labels (`SettingsModal.tsx` — locate theme selection UI), `src/app/globals.css` (theme selector classes `.theme-navy`, `.theme-forest`, `html.light`)
- **Root cause:** No single canonical name currently exists per theme across the codebase. The user-facing name ("Wahala," per `CLAUDE.md`) is undocumented anywhere in the UI copy verified in this pass; the internal enum values are `'orange' | 'blue' | 'forest'`; the CSS class names are `.theme-navy` / `.theme-forest` (no class for `'orange'`, which is the unstyled default `:root`); the audit's proposal uses yet a fourth vocabulary (`data-theme="warm"`, `data-theme="navy"`, `data-theme="forest"`). Four incompatible naming systems for the same four (or fewer) concepts.
- **Requirement:** Establish exactly one internal identifier and one user-facing display name per theme, used consistently across: the `localStorage` value, the `user_settings.theme` column value, the CSS selector/attribute, and the Settings UI label. This ticket depends on `CONF-01` for the specific names chosen (the user proposed "Sunset"-style naming; the audit proposed `data-theme` system identifiers — both inputs must be reconciled into one final table, not implemented as two parallel systems).
- **Acceptance criteria:**
  1. A single table exists (in updated `DESIGN_SYSTEM.md` or equivalent) mapping: internal identifier → CSS selector/attribute value → user-facing display name, for every theme (currently four: default, navy/blue, forest, and light-mode as a `data-mode` variant if `DS-03` also lands — do not conflate mode and theme in this table).
  2. No string literal in the codebase uses a theme name absent from that table.
  3. The Settings UI theme picker shows only the user-facing display names, never the internal identifiers.
  4. Existing user accounts with a previously-saved `user_settings.theme` value are migrated (a stored `'blue'` must continue to resolve to the same visual theme under its new name, not silently reset to default) — this requires either a data migration or a backward-compatible alias map; specify which in the implementation, and record the choice in `plan.md`.
- **Depends on:** `CONF-01` resolved.

### BUG-08 — Inconsistent archive vs. delete rules across spaces

- **Priority:** Critical
- **Files:** `src/components/features/TaskCard.tsx:109` (Do, swipe), `src/components/features/TaskAddPanel.tsx:130` (Do, edit sheet), `src/app/(app)/remember/people/page.tsx:266` and `people/[id]/page.tsx:150` (Remember), `src/app/(app)/think/[id]/page.tsx:214` and `:218` (Think — two different behaviors in the same file), `src/app/(app)/explore/page.tsx:180–195` and `src/components/features/ExploreDrawer.tsx:166–173` (Explore), `src/app/(app)/explore/trash/page.tsx` (the only existing dedicated trash surface), `src/components/features/LocationAddPanel.tsx:84` (Locations)
- **Root cause:** This codebase currently implements at least four distinct, non-interoperable deletion behaviors, not two:
  1. **Hard delete, no trace:** `people` (both delete call sites), `locations` (`LocationAddPanel.tsx:84`) — `supabase.from(table).delete()`, permanent and immediate, no undo, no trash entry.
  2. **Soft "archive," no expiry, no dedicated trash view:** Do tasks via swipe (`TaskCard.tsx:109`, `status: 'archived'`) — reversible only via the 5-second undo toast at the moment of deletion; once that toast is dismissed, the task is not hard-deleted but also is not visible in any "trash" or "archive" browsing surface distinct from the existing `showArchive` toggle on the Do page (which is actually the completed-tasks archive, a different concept reusing the same `archived` status — see note below).
  3. **Hard delete from the same edit surface for the same entity type:** Do tasks via the Edit Task sheet (`TaskAddPanel.tsx:130`) — `supabase.from('items').delete()`, permanent, on the very same `items` table that swipe-delete treats as soft. A task deleted via swipe and a task deleted via the edit sheet are unrecoverable to different degrees despite being the same entity type.
  4. **Soft delete with dedicated trash + restore + permanent-delete-from-trash:** Explore items (`explore/page.tsx`, `ExploreDrawer.tsx`, `explore/trash/page.tsx`) — the only fully-realized implementation of a trash pattern in the app, using `status: 'deleted'` + `deleted_at` timestamp, with a real trash browsing page offering "Restore" and "Delete permanently."
  5. A **fifth, self-contradicting case**: `think/[id]/page.tsx` contains both a hard `.delete()` (line 214) and a soft `update({status: 'deleted', deleted_at})` (line 218) as two different code paths for what a user experiences as the same "delete this" action, depending on which element they interact with (needs on-file disambiguation of which UI trigger reaches which line — both must be identified and reconciled to one behavior).
  6. Additionally, `explore/trash/page.tsx` already queries the `items` table for `status: 'deleted'` (line 24), meaning the intended trash system was designed to include Do tasks — but nothing in `TaskCard.tsx` or `TaskAddPanel.tsx` ever sets an `items` row to `'deleted'`; they use `'archived'` or hard-delete instead, so Do tasks can never actually appear in this trash view despite the view querying for them.
- **Conflict:** `CONF-04`.
- **Requirement:** Once `CONF-04` is resolved (a single canonical model — most likely, given the existing Explore implementation is the most complete: soft-delete with `status: 'deleted'` + `deleted_at`, restorable, permanently purged after a defined retention window, unified across all five entity tables — `items`, `people`, `threads`, `explores`, `locations`), every deletion entry point across every space must implement that one model. The completed-task "archive" concept on the Do page (`showArchive` toggle, `status: 'archived'`) is a **different feature** from trash/deletion (it represents "done," not "removed") and must be kept semantically distinct from whatever status value represents deletion — reusing `'archived'` for both meanings, as the swipe gesture currently does, must stop.
- **Acceptance criteria:**
  1. A single status value (e.g. `'deleted'`) and a single `deleted_at` timestamp convention is used identically across `items`, `people`, `threads`, `explores`, and `locations` for the deletion concept, distinct from any "completed"/"archived-as-done" status.
  2. Every delete-triggering UI element in the app (swipe gestures, edit-sheet delete buttons, list-row delete actions) performs the same soft-delete operation for a given entity type — no two entry points for deleting the same entity type produce different levels of recoverability.
  3. A single global trash surface (or the existing `explore/trash/page.tsx` generalized to all five entity types, per the audit's `M4` recommendation) lists all soft-deleted items across spaces, with restore and permanent-delete actions.
  4. A retention/auto-purge window is defined and enforced (a scheduled job — see `INFRA-09` — permanently deletes rows past the retention window; the existing `supabase/functions/cron_cleanup` Edge Function is the likely home for this and must be audited/extended, not duplicated).
  5. `people` and `locations`, which currently have zero undo capability, gain the same soft-delete/restore/purge behavior as the other three entity types — deleting a person by accident is currently unrecoverable and must not remain so.
- **Depends on:** `CONF-04` resolved. Blocks `DS-11` (interaction-pattern documentation of the canonical delete flow) and `INFRA-09` (retention job).

### BUG-09 — Capture modal is laggy

- **Priority:** High
- **Files:** `src/components/features/CaptureModal.tsx` (lines 200–221, `handleRoute`), `src/app/api/capture/route.ts` (all), `src/lib/capture-router.ts` (lines 1–3, top-level imports)
- **Root cause:** Pressing Enter in the capture composer (`handleRoute`, `CaptureModal.tsx:200–221`) does not call the local, rule-based router directly. It performs an HTTP round trip to `/api/capture`, which sequentially: (1) resolves the authenticated user via `supabase.auth.getUser()`, (2) calls `checkRateLimit` (an additional network call to Upstash Redis per `src/lib/rate-limit.ts`), (3) re-fetches the user's full `people` list from Postgres on every single capture (`route.ts`, the `people` query), and only then (4) runs `routeCapture()` — the actual NLP work — synchronously on the server, using `compromise` (~250 KB) and `chrono-node` (~150 KB), both imported as static top-level imports in `capture-router.ts:1–3` rather than dynamically. Per `CLAUDE.md` and `ARCHITECTURE.md`, this router is explicitly documented as "rule-based," "local," and "zero API costs" — it has no dependency on any external AI service and no reason to require a server round trip at all for the routing preview shown to the user before they confirm. Every keystroke-to-result latency the user experiences is therefore: network RTT + auth check + rate-limit check + a fresh DB query + NLP parse, for a computation that is, by the project's own architecture documentation, meant to run entirely client-side.
- **Requirement:**
  1. The routing **preview** (what the user sees before confirming) must run synchronously in the browser, calling `capture-router.ts` directly against a `people` list already available in client state (already fetched elsewhere via React Query for other features — reuse that cache, do not add a second fetch).
  2. `compromise` and `chrono-node` must be dynamically imported (`import()`) on first use in the client bundle and cached thereafter, not statically imported into the initial bundle, per the audit's `05-performance-audit.md` recommendation — this reduces both initial bundle size and, combined with point 1, removes the network-round-trip latency entirely for the preview step.
  3. The server-side `/api/capture` endpoint (or equivalent) is retained only for the final **save** step (the actual database write), where auth and rate-limiting genuinely belong — not for generating the preview.
  4. If server-side routing is still required for any reason (e.g., to prevent a client from spoofing the routing result before save), the ticket must document that reason explicitly rather than silently keeping the round trip; otherwise remove it from the preview path.
- **Acceptance criteria:**
  1. Typing a capture string and pressing Enter shows the routed preview (destination, extracted fields) with no network request having been made, measurable via a network panel showing zero requests between keypress and preview render.
  2. `compromise` and `chrono-node` do not appear in the initial JS bundle sent for any route other than the one that first triggers capture (verify via bundle analysis).
  3. The final "Save" action still performs server-side validation (`captureSchema`, per `route.ts`) and rate limiting before writing to the database — this ticket must not remove server-side validation, only remove it from the preview path.
  4. Time from keypress-Enter to preview render is measured before and after this change and the after-value is reported in the PR description.
- **Depends on:** none.

### BUG-10 — Sidebar profile icon and name missing

- **Priority:** High
- **Files:** `src/components/layout/Navigation.tsx` (lines 331–354)
- **Root cause:** The user row at the bottom of the sidebar (lines 332–354) is wrapped in `{userSettings?.display_name && (...)}` — the entire avatar + name block renders nothing at all if `display_name` is falsy (`null`, `undefined`, or empty string). There is no fallback avatar (e.g., initials from the account's email, or a generic user icon) for the case where a `user_settings` row exists but `display_name` was never set (a realistic state for any account created before a display-name field existed, or where onboarding was skipped/interrupted). The visible symptom — "the profile icon and name is gone now" — is consistent with a `user_settings` record whose `display_name` is empty for any reason.
- **Requirement:** The user row must render an avatar and identity indicator regardless of whether `display_name` is set, falling back to the account's email/username or a generic placeholder avatar + "Set your name" prompt, so that clicking the row always reaches Settings (already correctly wired at line 333) and the row is never visually empty.
- **Acceptance criteria:**
  1. Loading the sidebar for an account with `display_name` unset shows a non-empty user row (avatar + some identity text), not blank space.
  2. Loading the sidebar for an account with `display_name` set shows the existing correct behavior, unchanged.
  3. The collapsed (rail) sidebar state also shows a non-empty avatar in both cases.
- **Depends on:** none. Should be re-verified after `BUG-01` since the sidebar shell will change.

### BUG-11 — Settings modal cannot scroll while on Think or Explore pages

- **Priority:** High
- **Files:** `src/app/(app)/think/page.tsx` (lines 16, 169, 338), `src/app/(app)/explore/page.tsx` (lines 15, 211, 300), `src/components/layout/LenisProvider.tsx` (entire file), `src/components/features/SettingsModal.tsx` (line 534, scroll container)
- **Root cause:** `LenisProvider` (a smooth-scroll library that takes over native `wheel`/`touch` scroll handling at the document level) is instantiated **only** on the Think and Explore pages (`think/page.tsx:169`, `explore/page.tsx:211`) — no other route in the app (`Do`, `Inbox`, `Remember`, `Home`) mounts it. `LenisProvider`'s `useEffect` (`LenisProvider.tsx`) constructs `new Lenis({...})` with no `wrapper`/`content` scoping option, which means it defaults to intercepting scroll at the `window`/document level for as long as it is mounted. `SettingsModal.tsx:534` has a correctly-configured native scroll container (`"flex-1 relative overflow-y-auto overscroll-contain no-scrollbar"`) — the container itself is not misconfigured. The codebase contains zero occurrences of `data-lenis-prevent` (verified by full-repository search), which is Lenis's standard opt-out attribute for exempting a nested scrollable region (such as a modal) from the document-level scroll hijack. `SettingsModal` is mounted globally, once, in `(app)/layout.tsx` via `DynamicModals` — it is not page-scoped — so it is present in the DOM regardless of route, but its scroll container only fights with Lenis for control of wheel/touch events on the two routes where Lenis happens to also be mounted, which is exactly the "only broken on Think/Explore" symptom reported.
- **Requirement:**
  1. `SettingsModal`'s scroll container (and every other modal/sheet's scroll container app-wide, since this defect class applies to any overlay content shown while Lenis is active) must be exempted from Lenis's document-level scroll capture via the appropriate opt-out mechanism.
  2. Separately, evaluate whether `LenisProvider` should be page-scoped at all — the audit (`05-performance-audit.md`) already flags Lenis as a mobile-jitter and reduced-motion risk and recommends disabling it on mobile and honoring `prefers-reduced-motion`; neither is currently implemented for the two pages that do use it. If Lenis's actual value on Think/Explore cannot be articulated (what layout defect does it solve there that a native scroll container wouldn't), consider removing it entirely rather than exempting every current and future overlay from it one at a time.
- **Acceptance criteria:**
  1. Opening Settings from the Think page and scrolling within the Settings modal scrolls the modal's content, not the page behind it, and does not get stuck/locked.
  2. Same for the Explore page.
  3. Same verification performed for every other overlay that can be open concurrently with Think/Explore mounted (`CaptureModal`, `SearchModal`, any `Sheet`-based panel), since the root cause is not Settings-specific.
  4. `prefers-reduced-motion` is honored by `LenisProvider` if it is retained (currently not checked anywhere in the file).
- **Depends on:** none.

### BUG-12 — Evaluate the Lovable-produced design system audit

- **Priority:** High (informational/gating — see requirement)
- **Files:** N/A (documentation review)
- **Root cause:** N/A — this is an evaluation ticket, not a defect ticket.
- **Requirement:** This document's own research (§1 source review, all 13 audit documents read in full) constitutes the requested evaluation. Findings:
  1. **Overall assessment:** the audit is well-grounded — nearly every claim in `00`–`21` cites a specific file and line number in the actual repository, matches independent re-verification performed for this document (see `BUG-01` through `BUG-11`, all of which the audit also flagged in less specific form), and its comparison benchmarks (Linear, Raycast, Notion, Apple HIG) are reasonable, current, and industry-standard reference points for this class of app. It is not generic filler advice — it is specific and actionable.
  2. **Where it should not be adopted as-is:** `CONF-02` (space color palette proposal directly conflicts with two other in-repo sources and was not reconciled by the audit, which appears not to have read `DESIGN_SYSTEM.md`'s already-published space color values or noticed the Do-page status-color reuse of the same hex values). `CONF-01`/`CONF-06` (the audit proposes naming and keybinding changes as settled recommendations; they are product decisions requiring sign-off, not defects).
  3. **Where it is incomplete relative to this request:** the audit is explicitly scoped to "written audit only... no code changes... no new visual identity" and covers frontend/design/UX/a11y/mobile/performance exclusively. It does not address backend architecture, CI/CD, testing strategy, observability, security posture beyond what's incidentally visible, or delivery infrastructure — all of which the user separately requested (see Phase 5, `INFRA-*`).
  4. **Verdict for downstream use:** the audit's `20-roadmap.md` prioritization (Critical → High → Medium → Low) and `21-file-by-file-recommendations.md` are usable as source material for Phase 1 (`DS-*`) tickets in this document, which is what has been done — but the audit must not be executed directly and verbatim by an agent without passing through this document's conflict resolutions first, because at least one of its concrete proposals (`CONF-02`'s palette) would silently overwrite a documented, if currently-broken, design decision without flagging the disagreement, which is exactly the failure mode this document exists to prevent.
- **Acceptance criteria:** This ticket is closed once the conflict register (§2) reflects the disagreements found between the audit and the rest of the source material, and Phase 1 tickets (`DS-*`) are written to depend on those conflicts' resolutions rather than adopting the audit's proposals unconditionally. Both conditions are satisfied by this document as written.
- **Depends on:** none.

### BUG-13 — Combined plan (this document)

- **Priority:** N/A — meta-ticket
- **Requirement:** Produce a single execution specification combining all user-reported defects, the audit's findings (reconciled against conflicts), and a backend/delivery infrastructure plan, in ticket form, ordered, with no implementation code.
- **Acceptance criteria:** This document, in full, including Phase 1 through Phase 5 below.
- **Depends on:** `BUG-01` through `BUG-12` being documented (done above).

---

## 5. Phase 1 — Design system foundation

Source: audit `10-design-system-spec.md`, `13-component-inventory.md`, `20-roadmap.md` (`C1–C5`, `H1–H8`), `21-file-by-file-recommendations.md`, reconciled against `CONF-02` and `CONF-03`.

### DS-01 — Resolve and implement the space-color / status-color system

- **Priority:** Critical
- **Files:** `src/app/globals.css` (lines 24–27, 130–142, 426–428+ light theme block), `src/app/(app)/do/page.tsx` (Column `accent` props), `DESIGN_SYSTEM.md`
- **Conflict:** `CONF-02` — must be resolved first.
- **Requirement:** Implement whichever single palette decision comes out of `CONF-02`. At minimum, the resolution must state explicitly: (a) whether `--space-*` tokens represent per-space identity (Do/Think/Remember/Explore as four distinct hues) or are retired in favor of the existing per-status Do colors, (b) whether the final palette is warm-only (per the documented identity pillar) or intentionally mixed, (c) the exact hex values, written once, into `DESIGN_SYSTEM.md`, and referenced — not restated — everywhere else.
- **Acceptance criteria:**
  1. `--space-do`, `--space-think`, `--space-remember`, `--space-explore` resolve to visually distinct, non-identical values in the default (warm-dark) theme — the current bug where all four equal `var(--accent)` is gone.
  2. `DESIGN_SYSTEM.md`'s existing (conflicting) space-color table is updated to match the implemented values — no stale documentation left behind.
  3. `do/page.tsx`'s hardcoded per-status `accent` hex values are replaced with token references, and it is explicit in code/comments that these are status colors (Overdue/Today/Upcoming/Someday), not space colors, even if some values happen to coincide.
- **Depends on:** `CONF-02` resolved.

### DS-02 — Delete duplicate token systems in `globals.css`

- **Priority:** Critical
- **Files:** `src/app/globals.css`
- **Root cause:** `[audit-sourced, not re-verified line-by-line, but consistent with independently confirmed evidence in this document]` — `@theme inline`'s calculated radius scale (audit-cited lines 57–63) and `:root`'s fixed-pixel radius scale (audit-cited lines 225–231) both exist and resolve to different pixel values for the same Tailwind class names (e.g., `rounded-lg` and `.dropdown-panel`'s `--radius-md` diverge). A full shadcn OKLCH neutral-color palette exists under `:root`/`.dark` and is unreferenced by any Presense component.
- **Requirement:** Exactly one radius scale, expressed in pixels, feeding both raw CSS variable usage and Tailwind's `@theme inline` mapping. The unused shadcn OKLCH neutral tokens are either deleted or explicitly aliased to the warm token set — not left as dead, conflicting weight in the file.
- **Acceptance criteria:**
  1. `rounded-lg` in JSX and any CSS reference to `var(--radius-lg)` (or equivalent) resolve to the same pixel value everywhere in the app.
  2. `grep` for shadcn OKLCH variable names (`--primary`, `--secondary`, etc. under `:root`/`.dark`) returns zero component usages if the tokens are deleted, or returns only the alias definitions if they are kept and mapped.
- **Depends on:** none. Should land before `DS-03` (theme attribute rewrite touches the same file regions).

### DS-03 — Formalize themes as `data-theme`/`data-mode` attributes

- **Priority:** High
- **Files:** `src/app/globals.css`, `src/app/layout.tsx`, `AppInitializer.tsx`, theme picker UI in `SettingsModal.tsx`
- **Conflict:** `CONF-01` (naming) must be resolved for the attribute values to be chosen.
- **Requirement:** Replace the current mixed `html.light` / `html.theme-navy` / `html.theme-forest` class-based theme switching with a single `data-theme` (identity: default/navy/forest, or whatever `CONF-01` decides) crossed with a single `data-mode` (`dark`/`light`) attribute pair on `<html>`. This is a pure refactor of the selector mechanism — it must not change any resolved color value except where `DS-01`/`BUG-07` explicitly require a value or name change.
- **Acceptance criteria:**
  1. Every theme/mode combination previously reachable via the class-based system is reachable via the new attribute system with identical visual output (screenshot-diff each of the 4x2 = 8 combinations before/after, accounting for intentional changes from `DS-01`/`BUG-07`).
  2. No component or CSS selector references `.theme-navy`, `.theme-forest`, or `html.light` after this ticket.
- **Depends on:** `CONF-01` resolved, `DS-01`, `BUG-06`, `BUG-07`.

### DS-04 — Consolidate glass surface, button, and dropdown/menu component systems

- **Priority:** Critical
- **Files:** `src/components/ui/GlassCard.tsx`, `src/components/ui/button.tsx`, `src/components/ui/Dropdown.tsx`, `src/components/ui/Popover.tsx`, `globals.css` lines with `.glass-card*`, `.glass-panel`, `.btn-*` classes (audit-cited 685-735, 558-571, 829-974)
- **Root cause:** `[audit-sourced]` three parallel glass-surface implementations (`GlassCard.tsx` component, `.glass-card`/`.glass-card-elevated` CSS classes, `.glass-panel` legacy CSS) and two parallel button implementations (Base UI `cva`-based `button.tsx` using unrelated shadcn OKLCH tokens, and hand-written `.btn-primary`/`.btn-secondary`/`.btn-capture`/`.btn-icon`/`.btn-preset`/`.btn-danger` CSS classes using the actual warm tokens) coexist. Only the CSS-class systems currently match the app's visual identity; only the component systems provide accessible ARIA behavior. `BUG-03`'s dropdown-clipping defect is a direct downstream symptom of `Dropdown.tsx` not being built on a portal-backed primitive like `Popover`/`Menu`.
- **Requirement:** One glass-surface primitive (a single component, internally variant-driven for elevation levels), one button component (rewritten to consume warm tokens directly, retiring the CSS-class system), and dropdown/menu functionality consolidated onto a single, portal-backed primitive used everywhere `Dropdown.tsx` or ad-hoc `.dropdown-panel` markup currently appears.
- **Acceptance criteria:**
  1. `grep` for `.glass-card`, `.glass-panel`, `.glass-card-elevated`, `.glass-card-hero`, `.btn-primary`, `.btn-secondary`, `.btn-capture`, `.btn-icon`, `.btn-preset`, `.btn-danger` in `.tsx`/`.jsx` files returns zero results after this ticket.
  2. Every prior visual variant (list/elevated glass cards; primary/secondary/ghost/destructive buttons at every prior size) has a corresponding variant in the new consolidated components, verified against a visual diff of at least one real usage of each prior variant.
  3. `BUG-03` is verified as resolved by this consolidation, or, if `BUG-03` already landed separately, this ticket does not reintroduce the clipping defect.
- **Depends on:** `BUG-03` (may be superseded by or merged with this ticket — coordinate, do not implement the dropdown fix twice).

### DS-05 — Semantic typography scale and elevation/motion token additions

- **Priority:** High
- **Files:** `src/app/globals.css`, `src/lib/animations.ts`
- **Root cause:** `[audit-sourced]` ten-step type scale with no semantic aliases; components hardcode `text-[13px]`/`text-[15px]`/`text-[17px]` inline; no elevation token bundle exists (shadows, blur, border per elevation level are each declared ad hoc per component); no formal motion-duration/easing token set exists, so `animations.ts` and inline component transitions use inconsistent values.
- **Requirement:** Introduce semantic type tokens (`--text-body`, `--text-ui`, `--text-title-sm/md/lg`, `--text-caption`, `--text-display`), elevation bundles (`--elev-flat/raised/floating/overlay-*`), and motion tokens (`--dur-*`, `--ease-*`) as specified in `10-design-system-spec.md`. Existing inline pixel font sizes and ad hoc shadow/blur declarations are migrated to reference these tokens.
- **Acceptance criteria:**
  1. `grep` for `text-\[1[0-9]px\]` (inline pixel font sizes) in component files returns zero results after migration, or only results explicitly justified as one-off decorative exceptions.
  2. Every modal, sheet, dropdown, and card in the app resolves its shadow/blur/border from one of the four elevation bundles, not a bespoke declaration.
  3. `animations.ts`'s duration/easing values are all references to the new motion tokens, not literal numbers.
- **Depends on:** `DS-02`.

### DS-06 — Contrast fixes for `--text-4`/decorative text tokens

- **Priority:** Critical
- **Files:** `src/app/globals.css` (dark-mode `--text-4` declaration, light-mode equivalent), call sites in `TaskCard.tsx`, thread list components, calendar chip components, `Navigation.tsx:194` (the "Cmd+K" hint)
- **Root cause:** `[audit-sourced]` `--text-4` at 35% white alpha over the app's near-black `--surface-1` background computes to roughly 2.6:1 contrast, failing WCAG AA's 4.5:1 minimum for body-weight text; the light-theme equivalent computes to roughly 3.1:1, also failing. This token is used for metadata rows that carry real information (timestamps, secondary labels), not purely decorative text.
- **Requirement:** Raise the alpha value used for any text a user is expected to read to a level that passes 4.5:1 against its actual background, reserving the original low-alpha value only for content marked `aria-hidden` or otherwise explicitly decorative. Rename the token to reflect this distinction if the "decorative-only" and "readable-secondary" cases end up needing different tokens (do not silently keep a token named `--text-4` while changing what it may be used for).
- **Acceptance criteria:**
  1. Every text node currently using the low-contrast token, on every surface it appears on (list rows, calendar chips, sidebar hints), measures at or above 4.5:1 contrast against its rendered background in both dark and light themes.
  2. If a genuinely decorative low-contrast token is retained, no non-`aria-hidden` readable text references it after this ticket (enforce via lint rule or code review checklist item, not just a one-time fix).
- **Depends on:** none — can run in parallel with other Phase 1 tickets.

### DS-07 — Page shell primitives (`PageHeader`, `EmptyState`)

- **Priority:** High
- **Files:** new components; call sites across every `page.tsx` under `src/app/(app)/`
- **Root cause:** `[audit-sourced, partially re-verified]` — `do/page.tsx`'s own empty states, while more developed than a bare string, are hand-rolled per-column with duplicated markup.
- **Requirement:** Introduce one `PageHeader` component (title, description, actions slot) and one `EmptyState` component (illustration/icon, title, description, action), and migrate every space's page header and every empty-list state in the app to use them, replacing bespoke per-page markup.
- **Acceptance criteria:**
  1. Every `page.tsx` under `(app)/` renders its header through `PageHeader`.
  2. Every list-empty condition across Inbox, Do (all four column/view combinations), Think, Explore, Remember renders through `EmptyState` with space-appropriate copy (not a generic default) and, where applicable, an action button wired to that space's correct creator surface (cross-reference `BUG-04`'s requirement that empty-state actions must match header actions).
- **Depends on:** `BUG-04` (do not duplicate the fix for the Do empty-state button target).

### DS-08 — Command surface split (Cmd+K, search, capture)

- **Priority:** Medium
- **Files:** `CaptureModal.tsx`, `SearchModal.tsx`, `Navigation.tsx` keybinding registration
- **Conflict:** `CONF-06` — requires explicit sign-off before remapping `Cmd+K` away from its current capture binding.
- **Requirement:** If and only if `CONF-06` is resolved in favor of the remap, evolve `SearchModal` into a command palette that lists recent commands and search results, bind `Cmd+K` to it, bind capture to `Cmd+Shift+K`, and bind full-text search to `Cmd+/`, per `12-interaction-patterns.md`. If `CONF-06` is resolved in favor of keeping the current binding, this ticket is withdrawn and marked as such, not silently skipped.
- **Acceptance criteria:** (only if implemented) 1. `Cmd+K` opens the command palette, not `CaptureModal`, from every route. 2. `Cmd+Shift+K` opens `CaptureModal` directly. 3. `Cmd+/` opens full-text search directly. 4. A `?` shortcuts overlay lists all three bindings plus every other documented shortcut in `12-interaction-patterns.md`'s table.
- **Depends on:** `CONF-06` resolved.

### DS-09 — Input primitives with accessibility wiring

- **Priority:** High
- **Files:** new `Input`, `Textarea`, `SearchInput` components; call sites in `TaskAddPanel.tsx`, `AddPersonPanel.tsx`, `LocationAddPanel.tsx`, `CaptureModal.tsx`
- **Requirement:** Wrap the existing `.input`/`.input-title`/`.input-search` CSS classes in React components that own label association, `aria-invalid`, and `aria-describedby` wiring for hint/error text, and migrate every form call site to use them instead of raw styled `<input>`/`<textarea>` elements.
- **Acceptance criteria:**
  1. Every form input in the app has a programmatically associated label (verified via an accessibility tree inspection, not just visual proximity).
  2. Every Zod validation error surfaced in a form is linked to its field via `aria-invalid` + `aria-describedby`, not shown only as a toast.
- **Depends on:** `A11Y-06` (form validation surfacing) — coordinate, likely delivered together.

### DS-10 — Badge/Avatar/Kbd/SegmentedControl primitive completion

- **Priority:** Medium
- **Files:** `src/components/ui/Badge.tsx`, `Avatar.tsx`, new `Kbd`, `SegmentedControl` components
- **Requirement:** `Badge` gains named variants for every space and status color (post-`DS-01` palette). `Avatar` requires an `alt`/label and has a defined fallback for a missing image. A `Kbd` component replaces every inline shortcut-hint markup pattern (e.g. `Navigation.tsx:194, 281`). A `SegmentedControl` component replaces the hand-rolled Kanban/Calendar and Board/Today/Calendar view-switcher markup (`do/page.tsx` lines approximately 300-318).
- **Acceptance criteria:**
  1. No inline keyboard-hint markup remains outside the `Kbd` component.
  2. Every Badge usage in the codebase (space tags, status tags) uses a named variant, not an inline `style` prop with a raw color.
- **Depends on:** `DS-01`.

### DS-11 — Document the canonical create/edit/delete interaction contract

- **Priority:** High
- **Files:** `DESIGN_SYSTEM.md` or a new `INTERACTION_PATTERNS.md`
- **Requirement:** Once `BUG-08`/`CONF-04` establish the canonical delete model, and once `BUG-04` establishes the canonical creator-surface rule, write both down as an explicit, enforceable contract (matching the structure of the audit's `12-interaction-patterns.md`) so that future features do not reintroduce the same divergence.
- **Acceptance criteria:** A merged document exists, referenced from `CLAUDE.md`'s "key files to read" list, stating the one allowed pattern each for: object creation entry points, inline vs. sheet editing, delete/undo/confirm behavior, toast conventions, and keyboard shortcuts — each with a single canonical example, not multiple acceptable options.
- **Depends on:** `BUG-08`, `BUG-04`, `CONF-04` resolved.

### DS-12 — Icon stroke-width standardization

- **Priority:** Low
- **Files:** all Lucide icon usages across `src/components`
- **Requirement:** Standardize `strokeWidth={1.5}` for all UI icons, `strokeWidth={2}` only inside filled circular buttons (capture button, primary CTAs) where the thicker stroke is legible against a colored fill, enforced via a wrapper `Icon` component or a lint rule, not manual convention.
- **Acceptance criteria:** `grep` for Lucide icon imports without an explicit `strokeWidth` prop returns only usages that resolve to the standardized default via the wrapper.
- **Depends on:** none.

### DS-13 — Density mode (comfortable/compact)

- **Priority:** Low
- **Files:** `globals.css`, Settings UI
- **Requirement:** `[audit-sourced]` Add a `data-density` attribute with `comfortable`/`compact` values controlling row height and inset spacing for task rows, thread rows, and explore rows, exposed as a Settings toggle, defaulting to `comfortable` on touch input and `compact` on pointer/desktop input.
- **Acceptance criteria:** Toggling the setting visibly changes row height/spacing across Do, Think, and Explore lists without a page reload.
- **Depends on:** `DS-05`.

### DS-14 — Reduced-motion and reduced-transparency correctness pass

- **Priority:** Critical
- **Files:** `globals.css` (hover-transform declarations, e.g. `.glass-card:hover` audit-cited line 709; nav icon hover translate), `AmbientBackground.tsx`
- **Root cause:** `[audit-sourced]` The current global `prefers-reduced-motion` override zeroes `transition-duration` via `!important` but does not remove the underlying `transform` value, so hover-triggered translateY/translateX effects still visually move, just instantaneously, rather than not moving at all. `prefers-reduced-transparency` is not handled anywhere in the codebase (zero occurrences).
- **Requirement:** Reduced-motion handling must remove the transform/distance, not merely shorten its duration, for every hover/interactive animation in the app (cards, nav items, buttons). A `prefers-reduced-transparency` branch must be added that disables backdrop blur and ambient orb animation, falling back to opaque surface colors.
- **Acceptance criteria:**
  1. With `prefers-reduced-motion: reduce` set, no element in the app visibly translates on hover, at any duration, including "instant."
  2. With `prefers-reduced-transparency: reduce` set, all glass/blur surfaces render as opaque solid colors and ambient orbs do not animate.
- **Depends on:** none.

---

## 12. Addendum — second-pass review (updated build + tooling recommendations)

This addendum was produced after a newer build of the repository and two documents of tooling recommendations (apparently authored by a different coding agent referred to in those documents as "opencode") were provided. All claims below were independently re-verified against the new build, not accepted from either source at face value. File/line references in this section refer to the **new** build unless stated otherwise.

### 12.1 — Status of prior Phase 0 tickets against the new build

| Ticket | Status | Verification |
|---|---|---|
| `BUG-01` (hover sidebar) | **Resolved** | `Navigation.tsx:49–54`: `<aside>` now uses `hover:w-[248px] focus-within:w-[248px]` with a `group/sidebar` label-reveal pattern (`labelClass`). This is a pure hover-expand model with no pinning — record this as the retroactive resolution of `CONF-05` (pure hover, no pin), since that is what was shipped. |
| `BUG-02` (ritual stale time) | **Still open** | `Navigation.tsx:38`: `const now = useMemo(() => new Date(), []);` is unchanged from the prior build — the exact same staleness defect. Not fixed by the sidebar rewrite. Keep `BUG-02` open as-is. |
| `BUG-03` (dropdown clipping) | **Resolved** | `Dropdown.tsx` and `Popover.tsx` now render their menu content via `createPortal` (`Dropdown.tsx` lines 102, 160; `Popover.tsx` line 2 import). This satisfies `BUG-03`'s requirement (option (a), portal-based rendering). Close `BUG-03`; `DS-04`'s remaining scope is narrowed to component/token consolidation only, not dropdown positioning. |
| `BUG-06`/`BUG-07` (theme naming/default) | **Partially resolved — see `BUG-15` below** | Theme naming is resolved: `src/lib/theme.ts` establishes `"sunset" | "midnight" | "meadow"` as the single internal vocabulary, with a `LEGACY_THEME_MAP` normalizing old values. This is the retroactive resolution of `CONF-01`: internal identifier and display name are now both `sunset`/`midnight`/`meadow`. However, the underlying defect described in `BUG-06` — an unscoped `localStorage` value overriding the true default — is **not fully fixed**; see `BUG-15`. |
| `BUG-08` (archive/delete inconsistency) | **In progress, not verified complete** | New files `src/lib/item-lifecycle.ts` and `src/lib/__tests__/item-lifecycle.test.ts` exist, suggesting a consolidation effort matching `CONF-04`'s direction has started. This document does not certify `BUG-08` as closed — re-run `BUG-08`'s full acceptance criteria (all five entity tables, all delete entry points) against `item-lifecycle.ts`'s actual coverage before marking it done. |
| `BUG-09` (capture modal lag) | **Not verified in this pass** | `capture-router.ts` and `rate-limit.ts` both changed; not re-profiled in this pass. Re-verify against `BUG-09`'s acceptance criteria (network panel showing zero requests between keypress and preview render) before closing. |
| `BUG-10` (missing profile row) | **Resolved** | `Navigation.tsx:229`: `const displayName = userSettings?.display_name || email || "Presense User";` — a non-empty fallback now always renders. |
| `BUG-11` (Settings scroll on Think/Explore) | **Not verified in this pass** | A new `src/hooks/useBodyScrollLock.ts` exists, which may address this — not re-tested against Lenis interaction in this pass. Re-verify before closing. |

### 12.2 — New defect: sidebar brand icon and profile avatar are not vertically aligned

**BUG-14 — Presense logo and profile avatar misaligned in the sidebar rail**

- **Priority:** Medium
- **Files:** `src/components/layout/Navigation.tsx` (header block lines ~57–66; nav content wrapper line ~76; capture button wrapper line ~65; user row lines 219–224)
- **Root cause:** Three different icon-centering formulas are used for the three icons that should optically line up in the collapsed 80px rail:
  1. **Header brand mark:** wrapped in a row with `px-4` (16px) padding and no fixed icon box — the raw 28×28 SVG sits directly against that padding. Optical center from the rail's left edge: `16 + 14 = 30px`.
  2. **Nav items and the Quick Capture button:** nested two levels deep — an outer wrapper with `px-3` (12px), then each row's own `px-2` (8px), then a fixed `w-10 h-10` (40px) icon box. Optical center: `12 + 8 + 20 = 40px`.
  3. **Profile/account row (bottom):** a single `px-3` (12px) padding directly on the button, with an `Avatar size="sm"` (32px, per `Avatar.tsx:20`, `w-8 h-8`) and no fixed icon box wrapper. Optical center: `12 + 16 = 28px`.
  
  None of the three values (30px, 40px, 28px) match. The user's specific observation — the header logo and the profile avatar look "off" relative to each other — is explained by the 30px-vs-28px gap between those two specifically (a small but perceptible 2px difference given both are the only two icons not living inside the standardized 40px nav icon box), compounded by the fact that neither matches the 40px column the six nav icons and the capture button establish as the rail's actual visual spine.
- **Requirement:** All icons in the collapsed 80px rail — brand mark, capture button icon, each nav item icon, and the profile avatar — must share one optical center line. The nav items' existing 40px-from-edge center is the established spine (six of the rail's icons already use it); the header brand mark and the profile avatar should be restructured to align to that same center, either by adopting the same two-level padding structure or by adjusting each one's own padding/size independently to resolve to the same 40px value.
- **Acceptance criteria:**
  1. In the collapsed (80px) rail state, the horizontal center of the brand mark SVG, the horizontal center of the Quick Capture icon, the horizontal center of every nav item icon, and the horizontal center of the profile avatar are all the same distance from the rail's left edge, measured to within 1px.
  2. The expanded (248px, hover) rail state is re-checked for the same alignment after the fix, since the transition's `labelClass` reveal logic depends on consistent icon positions to avoid the label text jumping.
- **Depends on:** none.

### 12.3 — New defect: default theme still leaks across sessions/accounts

**BUG-15 — "Sunset" is not reliably the first-run theme for every user**

- **Priority:** High
- **Files:** `src/app/layout.tsx` (theme-init inline script, lines ~68–86), `src/components/layout/AppInitializer.tsx` (lines 62–71), `src/components/features/SettingsModal.tsx` (sign-out calls, lines 343, 450)
- **Root cause:** Two of `BUG-06`'s three original requirements are now met (the default value is correctly `'sunset'` when `localStorage` is empty, per `layout.tsx`'s `|| 'sunset'` fallback and `theme.ts`'s `DEFAULT_THEME_ID`), but the core leakage mechanism is unchanged:
  1. `AppInitializer.tsx:64` resolves theme as `userSettings?.theme || localStorage.getItem("presense_theme")` for any authenticated, non-onboarding user. If `userSettings.theme` is falsy at the moment this effect runs — which is a realistic race condition on first load, since `userSettings` is fetched asynchronously and this effect can run before that fetch resolves — the code falls through to `localStorage`, not to `DEFAULT_THEME_ID`. If that browser has *any* prior `presense_theme` value (from a previous account, a previous test session, or even a value written by this same effect on a previous, still-loading render), that stale value is applied and then immediately written back via `localStorage.setItem("presense_theme", theme)` at line 71 — reinforcing the wrong value rather than self-correcting once `userSettings` finishes loading, because the effect's dependency array (`[userSettings?.theme, ...]`) will re-run and overwrite it correctly *only if* `userSettings.theme` is truthy by then; if the DB row genuinely has no theme set yet (e.g., a brand-new account before its first settings save), the wrong localStorage value persists indefinitely.
  2. Signing out (`SettingsModal.tsx:343, 450`, `supabase.auth.signOut()`) still does not clear `presense_theme` (or `presense_color_mode`, `presense_reduce_motion`) from `localStorage`. On a shared or reused browser, the next login screen — governed solely by the root `layout.tsx` inline script, since `AppInitializer` is not mounted on the unauthenticated `(auth)/login` route — reads whatever the previous session left behind, not the default.
  3. **New, related finding — `CONF-07`:** the two theme-rename migrations contradict each other. `20260703000004_rename_theme_values.sql` maps legacy `'blue' → 'midnight'` (a rename intended to preserve the user's preference under a new name) and sets the column default to `'sunset'`. `20260703000005_default_legacy_blue_to_sunset.sql`, applied after it, maps `'blue', 'navy', 'midnight' → 'sunset'` — which does not merely catch stragglers missed by the first migration, it also converts every row that migration `004` had just correctly renamed to `'midnight'` back down to `'sunset'`, and would do the same to any user who explicitly chose "Midnight" as their theme between the two migrations. This is not this ticket's primary defect (the migrations likely ran back-to-back in one deploy with no user-facing window in between), but it must be resolved as a documentation/intent conflict before any further theme-related migration is written, so the same mistake isn't repeated: is `'midnight'` a first-class theme choice or is it, as migration `005` implies, considered equivalent to "not yet migrated"?
- **Requirement:**
  1. `AppInitializer.tsx`'s theme resolution must never fall back to a raw `localStorage` read for an authenticated user when `userSettings` has not yet loaded — it should either wait for `userSettings` to resolve before applying any theme beyond what the blocking inline script already applied, or fall back to `DEFAULT_THEME_ID` (never a `localStorage` value) when `userSettings.theme` is genuinely absent.
  2. Sign-out must clear `presense_theme`, `presense_color_mode`, and `presense_reduce_motion` from `localStorage`, so the next unauthenticated view of `/login` on that browser always renders the true default rather than a leftover preference.
  3. `CONF-07` must be resolved explicitly (is `'midnight'` a normal user-selectable theme, protected from being silently reset — the answer implied by migration `004` — or is it, per migration `005`, still being treated as a "not fully migrated" transitional state): whichever is decided, no future migration may overwrite a value that the *other* decision would consider a deliberate, current user choice.
- **Acceptance criteria:**
  1. A brand-new account, on a browser that has never had `presense_theme` set, sees `'sunset'` immediately, with no flash of another theme.
  2. A brand-new account, on a browser whose `localStorage.presense_theme` is currently `'midnight'` from an unrelated prior session, still sees `'sunset'` (the account's true, unset-in-DB default), not `'midnight'`.
  3. Signing out of any account and reloading `/login` on the same browser always shows `'sunset'`, regardless of what theme that account had selected.
  4. `CONF-07`'s resolution is recorded, and no migration in the repository after this ticket sets a user's `theme` column to a different value than the one they last explicitly chose, except as part of the one documented legacy-value cleanup already performed.
- **Depends on:** `CONF-07` resolved for item 3 of the requirement; independent of `CONF-07` for items 1–2, which should proceed immediately given their "High" severity.

### 12.4 — Phase 6: tooling and dependency adoption

The two pasted documents (and the additional list given directly in this turn) were cross-checked against the actual `package.json`, `globals.css`, and relevant source files in the new build rather than accepted as-is. Findings are organized by verified status. Every ticket below states what was actually found in the repository, not merely what the source document claimed.

**Verification summary:** `: any` usages currently total exactly 60 in non-test `.ts`/`.tsx` files, matching the source document's figure. None of `react-hook-form`, `@hookform/resolvers`, `nuqs`, `cmdk`, `vaul`, `@sentry/nextjs`, `posthog-js`, `plausible-tracker`, `@floating-ui/react`, `@t3-oss/env-nextjs`, `prettier`, `husky`, `lint-staged`, `@tanstack/react-query-devtools`, `pino`, `@vercel/speed-insights`, `@next/bundle-analyzer`, or any Biome package are present in `package.json` — every one of these recommendations describes a genuine gap, not something already handled. The CI workflow's `branches: ain, master]` typo the documents describe as currently broken is **already fixed** in this build (`.github/workflows/ci.yml` correctly reads `branches: [main, master]`) — that specific recommendation is stale and must not be re-applied as a ticket. `src/lib/env.ts` is, as described, a silent-fallback stub that returns empty strings and never throws, including in production — the `@t3-oss/env-nextjs` recommendation is accurate and current. `src/lib/logger.ts` is, as described, a 46-line stub that drops all log output in production except server-side `error`-level lines printed to `console.error` — it ships nowhere. `Dropdown.tsx`/`Popover.tsx` already use `createPortal` (see §12.1) — the documents' claim that Floating UI would fix "the dropdown z-index bug you reported" is now moot for that specific bug (already fixed by a portal, not by Floating UI); Floating UI remains legitimate only as a collision/flip/shift *robustness* upgrade, not a bug fix, and is downgraded in priority accordingly below. `globals.css` contains 61 occurrences of `oklch()`, but all of them are confined to the already-flagged, unused shadcn neutral-color block (`DS-02`); the app's actual warm-theme tokens are hex/rgba as the documents describe — no contradiction, but the OKLCH migration recommendation should be scoped to new/renamed tokens only, per `DS-01`/`BUG-07`'s work, not treated as a separate large migration. The `content-visibility: auto` wiring concern is **confirmed real**: `globals.css:1474` declares `.task-card-wrapper { content-visibility: auto; ... }` but `grep` finds zero JSX usages of the class `task-card-wrapper` anywhere in `src` — the CSS rule is currently inert.

#### Critical / High priority

**TOOL-01 — Typed Supabase client (`database.types.ts`)**

- **Priority:** Critical
- **Verified:** 60 `: any` annotations confirmed present; no generated types file exists in `src/types/`.
- **Requirement:** Generate a Supabase types file and parameterize every `createClient`/`createBrowserClient`/`createServerClient` call in `src/lib/supabase.ts` and `src/lib/supabase-server.ts` with the generated `Database` type. Add a CI or pre-build step that regenerates this file and fails the build if it has drifted from the live schema (a stale generated-types file is worse than no types file, since it produces false confidence), directly addressing this document's own `DEFINITION OF DONE` item 4 concern about drift.
- **Acceptance criteria:**
  1. Every `.from(table)` call in the codebase is typed against the generated schema, not `any`.
  2. The count of `: any` annotations in non-test files drops from 60 to a documented remaining figure, with each remaining occurrence justified in a code comment (e.g., a genuine third-party untyped callback).
  3. A CI step regenerates or diff-checks the types file against the live schema and fails if they disagree.
- **Depends on:** none. Should land early — many later tickets (`BUG-08`'s `item-lifecycle.ts`, `INFRA-10`'s RLS audit) benefit from typed queries while being written.

**TOOL-02 — Replace `env.ts` with validated, fail-fast environment access**

- **Priority:** Critical
- **Verified:** current `env.ts` matches the "silent empty-string fallback" description exactly.
- **Requirement:** Adopt `@t3-oss/env-nextjs` (or an equivalent Zod-based validator), validating all required client and server environment variables once at module load, throwing a clear error at startup if any required variable is missing, rather than deferring to a runtime empty-string failure inside a Supabase call. This directly supersedes the current `env.ts`.
- **Acceptance criteria:**
  1. Removing a required environment variable from the deployment environment causes the application to fail at startup/build with a clear, named error, not at first use inside an unrelated code path.
  2. Every existing consumer of `env.*` (`layout.tsx`, `supabase.ts`, `supabase-server.ts`, `rate-limit.ts`) is updated to the new import.
- **Depends on:** none.

**TOOL-03 — React Hook Form + Zod for all manual-`useState` forms**

- **Priority:** High
- **Verified:** neither `react-hook-form` nor `@hookform/resolvers` present in `package.json`; `TaskAddPanel.tsx`, `AddPersonPanel.tsx`, and `SettingsModal.tsx` were confirmed in the prior audit pass to hold form state via individual `useState` calls per field.
- **Requirement:** Migrate `TaskAddPanel`, `AddPersonPanel`, `LocationAddPanel`, and `SettingsModal`'s account/profile forms to React Hook Form with the existing Zod schemas (`src/lib/schemas.ts`) wired through `@hookform/resolvers/zod`, replacing per-field `useState` and manual validation branches. This should be coordinated with `DS-09` (input primitives) and `A11Y-06` (validation surfacing) — implement together, since RHF's `formState.errors` is the natural source for the `aria-invalid`/`aria-describedby` wiring those tickets require, avoiding duplicate work.
- **Acceptance criteria:**
  1. No form component in the list above holds field values in individual `useState` calls; each uses RHF's `register`/`control`.
  2. Every validation error surfaced by RHF is wired to `aria-invalid`/`aria-describedby` per `A11Y-06`, not implemented twice.
- **Depends on:** coordinate with `DS-09`, `A11Y-06` — do not implement any of the three independently.

**TOOL-04 — `nuqs` for shareable, bookmarkable view/filter state**

- **Priority:** High
- **Verified:** `nuqs` not present; `do/page.tsx`'s view mode (Board/Today/Calendar) and category filter were confirmed in the prior audit pass to live in local component state (also flagged separately as `INT-02`, which asked for persistence to `user_settings` — these are complementary, not conflicting: URL state for the current session's shareable/bookmarkable link, `user_settings` for the cross-device default).
- **Requirement:** Move the Do page's `viewMode`, category filter, and Calendar's week/month toggle to URL query parameters via `nuqs`, so a specific filtered/scoped view is a shareable link and survives the browser back button. This ticket and `INT-02` should be implemented together: URL state takes precedence on load if present, otherwise the persisted `user_settings` default from `INT-02` applies.
- **Acceptance criteria:**
  1. Selecting a non-default view/filter combination changes the URL's query string.
  2. Sharing that URL (or reloading it) reproduces the same view/filter combination.
  3. The browser back button steps through prior view/filter states rather than navigating away from the page.
- **Depends on:** coordinate with `INT-02`.

**TOOL-05 — Structured logging to replace the `logger.ts` stub**

- **Priority:** High — this is the concrete implementation ticket for `INFRA-05`, which was previously written at a requirements level without naming a specific library; use this ticket's finding to close that gap.
- **Verified:** `logger.ts` confirmed to drop all output in production except server-side `error`-level `console.error` calls, with no shipping destination.
- **Requirement:** Replace `logger.ts` with a structured (JSON) logger (e.g., Pino) whose output is actually shipped to a queryable destination in production (log drain, aggregator), satisfying `INFRA-05`'s acceptance criteria. If error tracking (`INFRA-01`) is implemented with a tool that also captures breadcrumbs/context (e.g., Sentry), evaluate whether a separate structured-logging library is still needed for non-error informational logs, or whether the error tracker's context capture covers the need — do not stand up two overlapping systems without a stated reason.
- **Acceptance criteria:** identical to `INFRA-05`'s, plus: this ticket names and justifies the specific library chosen in its PR description.
- **Depends on:** `INFRA-01` (coordinate scope before choosing a second tool).

**TOOL-06 — Error tracking (supersedes/details `INFRA-01`)**

- **Priority:** Critical
- **Verified:** no `@sentry/nextjs` or equivalent in `package.json`; a new `src/instrumentation-client.ts` file exists in this build but was not confirmed to contain error-tracking wiring — audit its actual contents before assuming this is already handled.
- **Requirement:** Same as `INFRA-01`. This ticket exists to record that the newly-added `instrumentation-client.ts` and `WebVitalsReporter.tsx` must be checked first — if they already establish an error-tracking or Web Vitals pipeline, `INFRA-01`/`INFRA-08` should be marked partially complete rather than re-implemented from zero.
- **Acceptance criteria:** `INFRA-01`'s, after first auditing `instrumentation-client.ts` and `WebVitalsReporter.tsx` for existing coverage.
- **Depends on:** none.

**TOOL-07 — Wire `content-visibility: auto` to its intended elements**

- **Priority:** High
- **Verified:** `globals.css:1474`'s `.task-card-wrapper` rule has zero corresponding JSX usages — confirmed inert.
- **Requirement:** Apply the `task-card-wrapper` class (and any sibling wrapper classes declared alongside it in the same CSS rule) to the actual list-item wrapper elements in `TaskCard.tsx` and any other list this rule was intended to cover, or rename/remove the CSS rule if the intended target has since changed.
- **Acceptance criteria:** A long Do-space list (100+ off-screen tasks) shows a measurable rendering-cost reduction (via DevTools Performance/Rendering panel) attributable to `content-visibility: auto` actually applying, verified by confirming the computed style on an off-screen task row shows `content-visibility: auto` taking effect.
- **Depends on:** none.

**TOOL-08 — Upstash Redis production configuration verification**

- **Priority:** High
- **Verified:** `rate-limit.ts`'s current fallback logic only logs a warning when Redis env vars are absent **in development** (`if (process.env.NODE_ENV === "development")`) — in production, if the env vars are absent, `getRateLimit()` silently returns `null` with no warning logged anywhere, meaning a misconfigured production deployment fails open (no rate limiting) with no operational signal.
- **Requirement:** Confirm `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_*` equivalents already supported in the fallback logic) are actually set in the production deployment environment. Separately, change the silent production fallback to emit a warning (via `INFRA-01`'s error tracker, not just `console`) whenever rate limiting is disabled in a production runtime, so a misconfiguration is never silent.
- **Acceptance criteria:**
  1. A production deployment with Redis env vars absent surfaces a visible alert in the error-tracking/monitoring tool from `INFRA-01`, not just a dev-only console warning.
  2. The actual production deployment is confirmed (by checking the hosting platform's environment variable configuration, not just the code) to have these variables set.
- **Depends on:** `INFRA-01`.

#### Medium priority

**TOOL-09 — `cmdk` to replace the hand-rolled `SearchModal`**

- **Priority:** Medium
- **Requirement:** Evaluate replacing `SearchModal`'s custom keyboard-nav/fuzzy-search implementation with `cmdk`, which is confirmed absent from dependencies. This should be sequenced together with `DS-08` (command surface split) if `CONF-06` resolves in favor of the Cmd+K remap — implementing `cmdk` before `DS-08`'s scope is finalized risks rework.
- **Acceptance criteria:** `SearchModal` (or its `DS-08` successor, the command palette) is built on `cmdk`'s primitives for list rendering, filtering, and keyboard navigation, with equivalent or better fuzzy-match quality than the current implementation, verified against a fixed set of test queries.
- **Depends on:** `CONF-06` resolved (or explicitly deferred).

**TOOL-10 — `Vaul` to replace the custom `Sheet` component**

- **Priority:** Medium
- **Requirement:** Evaluate replacing `Sheet.tsx`'s hand-rolled drag-to-dismiss/snap-point logic with `Vaul`. This overlaps with `MOB-04`'s snap-point and drag-handle-isolation requirements — if `Vaul` is adopted, `MOB-04` should be re-scoped to "verify Vaul meets these requirements out of the box" rather than hand-building the same behavior twice.
- **Acceptance criteria:** Every current `Sheet` consumer renders identically (modulo the specific fixes `MOB-04` already required) on `Vaul`, with drag-to-dismiss, snap points, and keyboard-avoidance on mobile all functioning without the custom logic `Sheet.tsx` previously implemented by hand.
- **Depends on:** coordinate with `MOB-04` — do not implement both independently.

**TOOL-11 — Product analytics (PostHog or Plausible)**

- **Priority:** Medium
- **Verified:** neither present.
- **Requirement:** Adopt one product analytics tool. This is a product/cost/privacy decision (self-hosted PostHog vs. a paid Plausible subscription vs. another option) — this document does not choose between them, but requires the decision be made and recorded, consistent with this document's convention of not silently picking product decisions. If session replay or feature flags are wanted (relevant to `INFRA-14`'s incident runbook and to any future `DS-08`/`CONF-06`-style rollout that would benefit from a flag), that favors PostHog; if minimal data collection and no cookie-consent banner are prioritized, that favors Plausible.
- **Acceptance criteria:** A decision is recorded; the chosen tool captures at minimum page views and the primary action events (task created, task completed, capture routed) across all five spaces.
- **Depends on:** none.

**TOOL-12 — React Query DevTools (dev-only)**

- **Priority:** Medium
- **Verified:** absent from dependencies.
- **Requirement:** Add `@tanstack/react-query-devtools`, mounted only when `process.env.NODE_ENV === 'development'`, inside the existing `QueryProvider.tsx`.
- **Acceptance criteria:** The DevTools panel is visible and functional in local development; zero references to the package appear in the production bundle (verify via bundle analysis, coordinating with `TOOL-16` below).
- **Depends on:** none.

**TOOL-13 — Prettier with Tailwind class sorting, plus Husky/lint-staged pre-commit gate**

- **Priority:** Medium
- **Verified:** none of `prettier`, `husky`, `lint-staged` present; `INFRA-02` already requires CI-level enforcement but does not currently specify a pre-commit layer.
- **Requirement:** Add Prettier with `prettier-plugin-tailwindcss`, run once across the full codebase, then add Husky + lint-staged running `eslint --fix`, `tsc --noEmit`, and `prettier --write` on staged files at commit time — a layer in addition to, not instead of, `INFRA-02`'s CI gate.
- **Acceptance criteria:** A commit containing a type error is rejected locally before it can be pushed; the full codebase is reformatted once with no remaining Prettier violations; CI's existing lint/type-check step (`INFRA-02`) continues to pass independently, since the pre-commit hook is a faster local layer, not a replacement for CI.
- **Depends on:** `INFRA-02`.

**TOOL-14 — Bundle analysis**

- **Priority:** Medium
- **Requirement:** Add `@next/bundle-analyzer`, wired via an `ANALYZE=true` build flag, to make bundle composition inspectable on demand. Use it to verify `BUG-09`'s dynamic-import requirement for `compromise`/`chrono-node` actually keeps those libraries out of unrelated route bundles, and to verify `TOOL-12`'s DevTools stay dev-only.
- **Acceptance criteria:** Running `ANALYZE=true npm run build` produces a treemap; `compromise` and `chrono-node` do not appear in any bundle chunk other than the one that lazily loads them per `BUG-09`.
- **Depends on:** `BUG-09` (verification step).

**TOOL-15 — Floating UI for `Popover`/`Dropdown` collision handling**

- **Priority:** Medium (downgraded from the source documents' "High/fixes your z-index bug" framing, since the clipping defect itself is already fixed via `createPortal` — see §12.1)
- **Requirement:** Evaluate migrating `Popover.tsx`'s manual `placement` prop system to Floating UI's `flip`/`shift`/`autoUpdate` middleware, so menus near a viewport edge reposition automatically instead of relying on a developer-specified static placement that may not fit in every case.
- **Acceptance criteria:** A dropdown/popover triggered near the bottom or right edge of the viewport repositions itself to remain fully visible, without a developer having manually specified the correct `placement` value for that specific call site.
- **Depends on:** none.

**TOOL-16 — `@vercel/speed-insights` or equivalent RUM (if hosted on Vercel)**

- **Priority:** Medium — this is a specific implementation option for `INFRA-08`, contingent on hosting platform.
- **Requirement:** If the production deployment target is Vercel, add `@vercel/speed-insights` as the concrete fulfillment of `INFRA-08`'s Web Vitals collection requirement; the newly-added `WebVitalsReporter.tsx` in this build should be audited first to check whether it already sends this data somewhere, to avoid a duplicate reporting pipeline.
- **Acceptance criteria:** `INFRA-08`'s, with the specific tool named and `WebVitalsReporter.tsx`'s existing behavior documented as either superseded or complementary.
- **Depends on:** confirming the hosting platform; audit of `WebVitalsReporter.tsx`.

**TOOL-17 — Database backup retention beyond the platform default**

- **Priority:** Medium
- **Requirement:** Confirm the current Supabase project's backup retention window (plan-dependent) and, if it is short (e.g., a free-tier default), add a scheduled export (e.g., nightly `pg_dump` to object storage) as a supplementary backup layer independent of the hosting platform's own retention policy — do not rely solely on a platform default that may change or may already be insufficient for the amount of user data this app now holds (five entity tables plus the new soft-delete/trash system from `BUG-08`).
- **Acceptance criteria:** A documented, tested restore procedure exists using the supplementary backup, exercised at least once (a restore drill), not merely configured and assumed to work.
- **Depends on:** none. Should be prioritized ahead of `BUG-08`'s trash/retention purge job (`INFRA-09`) going live, since a purge job increases the cost of a backup gap.

**TOOL-18 — RLS automated test suite (details `INFRA-10`)**

- **Priority:** Medium — implementation detail for `INFRA-10`, which previously specified a manual table-by-table checklist; this raises the bar to an automated, repeatable test.
- **Requirement:** Write an automated (Vitest or Playwright-driven) test suite using two test accounts against a dedicated test project/schema, verifying: each account can read/write only its own rows across all five entity tables; cross-account reads/writes are rejected; unauthenticated (anon) access returns nothing. This supersedes `INFRA-10`'s originally-specified manual checklist as the primary verification method, though the manual checklist remains useful as a one-time design review.
- **Acceptance criteria:** The suite runs in CI (per `INFRA-02`) on every PR touching `supabase/migrations/`; it fails if a new migration accidentally weakens or omits an RLS policy.
- **Depends on:** `INFRA-02`, `INFRA-10`.

#### Lower priority / evaluated and not currently recommended

**TOOL-19 — Biome as an ESLint/Prettier replacement**

- **Priority:** Low — recommended to defer, not adopt now.
- **Rationale:** The repository already has a working ESLint configuration wired into CI (`INFRA-02`) and, per `TOOL-13`, is about to adopt Prettier. Replacing both with Biome is a larger migration (rule-parity checking, editor integration changes) for a speed benefit that is not currently a demonstrated bottleneck (no evidence CI lint time is a problem). Revisit only if lint/format CI time becomes a measured pain point after `TOOL-13` ships.

**TOOL-20 — `pnpm` instead of `npm`**

- **Priority:** Low
- **Rationale:** A legitimate improvement (faster installs, stricter phantom-dependency prevention) but a full package-manager migration touches CI caching (`INFRA-02`'s `cache: 'npm'` step), lockfile history, and every contributor's local setup. Given the size of the current active backlog (Phases 0–5 plus this addendum), sequence this after Phase 0–2 are stable, not now.

**TOOL-21 — `text-wrap: balance`/`pretty`, `field-sizing: content`, Speculation Rules API, `light-dark()` CSS function**

- **Priority:** Low, bundle together as one small CSS/HTML polish ticket
- **Rationale:** All four are genuine, low-risk, standards-track browser features appropriate for this codebase. `light-dark()` specifically should be sequenced after `DS-03`'s `data-theme`/`data-mode` attribute rewrite, since introducing it before that consolidation would create a third parallel theming mechanism alongside the class-based and attribute-based systems already being reconciled in `DS-02`/`DS-03` — do not adopt `light-dark()` until `DS-03` is complete, and then use it as the token-writing mechanism for any *new* tokens, not as a retroactive migration of the entire existing token set (which is already large enough of a change via `DS-02`).
- **Acceptance criteria:** `text-wrap: balance` is applied to headings, `text-wrap: pretty` to body paragraphs exceeding two lines; `field-sizing: content` is added as a progressive enhancement alongside the existing `react-textarea-autosize` polyfill (not a replacement, since browser support is not yet universal); a Speculation Rules API `<script type="speculationrules">` prefetch block is added to `layout.tsx` for the primary space routes.
- **Depends on:** `light-dark()` portion depends on `DS-03`.

**TOOL-22 — React Compiler (`reactCompiler: true`)**

- **Priority:** Low
- **Rationale:** Legitimate and low-risk in principle, but should be sequenced after `PERF-01` (the `useCallback` fixes) and `DS-04` (component consolidation) land, since enabling the compiler mid-refactor makes it harder to attribute a performance change to the manual fix versus the compiler's automatic memoization, and the compiler's benefit is best measured against a codebase that has already had its most obvious manual-memoization gaps closed.
- **Depends on:** `PERF-01`, `DS-04`.

**TOOL-23 — MSW, Storybook, Lighthouse CI**

- **Priority:** Low
- **Rationale:** All three are legitimate but are process/tooling investments appropriate for a larger team or a component-library-driven workflow; Storybook in particular is redundant with `INFRA-13`'s visual regression testing for the immediate goal (catching visual drift) without Storybook's authoring overhead. Lighthouse CI specifically should be adopted, but it is already covered by `INFRA-08`'s requirement — do not create a separate ticket; ensure `INFRA-08`'s implementation is Lighthouse CI specifically if that is the chosen tool.
- **Depends on:** none — revisit if/when the team grows or a component-library workflow is explicitly desired.

**TOOL-24 — CI workflow YAML branch-typo fix**

- **Priority:** N/A — **withdrawn, already fixed.** Verified `.github/workflows/ci.yml` already reads `branches: [main, master]` correctly in the current build. No action required. Recorded here only so this recommendation, present in both source documents, is not re-applied by an agent working from those documents directly instead of from this reconciled spec.

### 12.5 — Updated conflict register addition

**CONF-07 — Contradiction between the two theme-legacy-value migrations**

- See `BUG-15` for full detail. Migration `20260703000004_rename_theme_values.sql` treats `'midnight'` as the correct renamed destination for legacy `'blue'` users (a preserved, first-class preference). Migration `20260703000005_default_legacy_blue_to_sunset.sql` treats `'midnight'` as a value to be overwritten back to `'sunset'`, alongside `'blue'`/`'navy'`. A decision is required on whether `'midnight'` is a protected, first-class user choice going forward — this document does not resolve it, per its own rule against silently picking a side in a genuine disagreement between two committed pieces of the codebase.
- **Resolution required before:** any future migration touching the `theme` column, and before `BUG-15` can be marked fully closed.

---

## 13. Addendum 2 — reconciliation with the independently-authored "Master Plan v5"

A third-party planning document (`plan.md`, "Master Plan v5," self-described as an independent audit of an earlier "Claude v3 plan," verified against the same build examined in §12) was supplied. Its claims were spot-checked against the actual repository rather than merged wholesale, consistent with this document's method throughout. Findings below are organized the same way as §12.4: verified-and-adopted, corrected, or flagged as a new conflict.

### 13.1 — A factual correction to the v5 plan itself

**v5's `T1-3`** claims `.github/workflows/ci.yml` still contains the `branches: ain, master]` typo. Directly re-inspecting that exact file in this document's build (`cat -A .github/workflows/ci.yml`) shows `branches: [main, master]` on both the `push` and `pull_request` triggers — correctly formed, no typo. This matches the finding already recorded in §12.4 (`TOOL-24`, withdrawn). The v5 plan's own stated method ("every claim was verified by reading the actual file... verified against the actual July 3 codebase") does not hold for this specific item — it is either based on a stale read or copied forward from an earlier pass without re-checking. This is noted not to discredit the rest of that document (most of its other claims below were independently re-verified and hold up), but as a caution: **`T1-3`/`TOOL-24` must not be re-applied.** No agent should trust a single source's self-reported verification rigor over direct inspection of the file in question, including this document's own claims — re-check line numbers against the current codebase state at implementation time per this document's existing Definition of Done, item 4.

### 13.2 — New defects verified from the v5 plan and adopted

**BUG-16 — Ritual system has two independent, disagreeing implementations**

- **Priority:** Critical
- **Files:** `src/lib/rituals.ts` (the decision engine, lines 59–90+), `src/components/layout/AppInitializer.tsx` (lines 6, 22–59, the only consumer of `rituals.ts`), `src/components/layout/Navigation.tsx` (lines 38, 46, 125–174 in the prior build's numbering — re-locate in current build), `src/components/features/RitualOverlay.tsx`
- **Root cause:** A new, dedicated ritual-decision module, `rituals.ts`, exports a pure function `getRitualDecision()` and is unit-tested (`rituals.test.ts`). It is imported by exactly one consumer: `AppInitializer.tsx`, which uses it to set a single global `activeRitual` value in the app store, presumably read by `RitualOverlay.tsx` to decide which full-screen ritual overlay to show. `Navigation.tsx`'s sidebar button, however, does **not** import or use `rituals.ts` at all (confirmed: `grep` for `getRitualDecision`/`from "@/lib/rituals"` in `Navigation.tsx` returns zero matches) — it computes its own morning/evening/done state inline, independently, using the separately-maintained logic this document's own `BUG-02` already describes (including that ticket's stale-`now` defect, which remains present in this build). The practical consequence: the ritual engine can be fixed in exactly one place (`rituals.ts`, per the fix in the next ticket) and the full-screen overlay will behave correctly, while the sidebar button — the persistent, always-visible surface most likely to be the one the user is looking at when they notice something is wrong — continues running its own older, separately-buggy logic, potentially showing a different ritual state than the overlay would if triggered. Fixing `rituals.ts` alone does not fix the sidebar.
- **Requirement:** There must be exactly one ritual-decision computation in the app. `Navigation.tsx`'s sidebar button must be changed to read the same `activeRitual`/decision state that `AppInitializer.tsx` computes via `rituals.ts` (or to call `getRitualDecision()` directly with the same inputs), and its own separate inline branching logic must be deleted, not maintained in parallel.
- **Acceptance criteria:**
  1. `grep` for a second, independent morning/evening branching implementation outside `rituals.ts` returns zero results.
  2. The sidebar button's label/icon and the full-screen ritual overlay's trigger state always agree, verified across the same set of test-clock scenarios used to test `rituals.ts` directly.
- **Depends on:** `BUG-17` (the `morningDone` fix inside `rituals.ts` itself) should land first or simultaneously, since re-pointing `Navigation.tsx` at a still-buggy `rituals.ts` only relocates the bug rather than fixing it.

**BUG-17 — Evening ritual can fire before the morning ritual for a new user**

- **Priority:** Critical
- **Files:** `src/lib/rituals.ts`, line containing `if (currentMinutes >= shutdownMinutes && !eveningDone)`
- **Root cause:** Confirmed by direct inspection: this condition does not check `morningDone`. A user who completes onboarding at, say, 10 PM — having never gone through morning planning, since it is their first day — will have `getRitualDecision()` return `evening`/`evening_due` on their very first session, before they have ever seen the morning planning flow. This is a more precisely diagnosed variant of what this document's own `BUG-02` described as "morning routine showing up at evening" — `BUG-02` focused on `Navigation.tsx`'s separate, older logic; this ticket is the equivalent, confirmed defect inside the new, otherwise-more-correct `rituals.ts` engine that supersedes it.
- **Requirement:** The evening-trigger condition must require `morningDone` to be true before firing, consistent with the general contract (implied by the existing `manual_evening_planning_for_tomorrow` reason code, which already shows an awareness that evening-time actions should route to next-day morning planning when appropriate) that a user cannot be shown an evening review for a day whose morning planning never happened. When `morningDone` is false at or after `shutdownMinutes`, the function should fall through to a morning-oriented result rather than an evening one — using one of the existing `morning_due`/`morning_window_missed` reason codes, or a new one if neither accurately describes "morning window has already fully passed and it's now evening," which is a distinct case from both existing morning reasons and should probably get its own reason code rather than being silently absorbed into an existing one.
- **Acceptance criteria:**
  1. `getRitualDecision()` given `{ now: <22:00>, lastMorningDate: null, lastEveningDate: null, ... }` returns a `kind: "morning"` result (or `"none"` with a clear reason), never `kind: "evening"`.
  2. The existing `rituals.test.ts` suite is extended with this exact scenario as a regression test.
  3. Once `BUG-16` re-points `Navigation.tsx` and `RitualOverlay.tsx` at this corrected engine, a manual test — create a new account at night — confirms the user sees a morning-planning affordance, not an evening-review affordance.
- **Depends on:** none for the fix itself; `BUG-16` depends on this.

**BUG-18 — Ritual completion does not persist, so the UI does not update**

- **Priority:** High
- **Files:** `src/components/features/RitualOverlay.tsx` (the completion handler for both morning and evening flows)
- **Root cause (to verify against the current build before implementing, since this was reported by the v5 plan against the same build referenced in §12 but not independently re-opened and re-read for this pass):** the ritual overlay's dismissal path is reported to call a local state clear (`setActiveRitual(null)`) without a corresponding write of `last_ritual_date`/`last_evening_ritual_date` to `user_settings` in every completion path. If confirmed, this would mean the ritual can appear to "complete" for the current render but reappear identically on the next page load or focus event, since the persisted date fields — the actual source of truth `morningDone`/`eveningDone` are computed from — were never updated.
- **Requirement:** Every path that dismisses a ritual as "completed" (as opposed to "snoozed" or "dismissed without completing," if such a distinction exists in the UI) must write the corresponding date field to `user_settings` before or as part of clearing `activeRitual`, and must update the local app-store copy of `userSettings` optimistically so the sidebar/Home reflect completion without requiring a full page reload.
- **Acceptance criteria:**
  1. Completing the morning ritual updates `last_ritual_date` in the database to today's date, verified by reloading the page and confirming the ritual does not re-trigger.
  2. The sidebar button and Home page both reflect the completed state immediately after closing the overlay, with no manual refresh.
  3. Same for the evening ritual and `last_evening_ritual_date`.
- **Depends on:** re-verify the root cause against the current build first (this ticket is provisional pending that re-check, per this document's rule of not accepting a claim without direct verification — flagged here because the failure mode described is plausible and specific enough to warrant checking before dismissing).

**BUG-19 — Settings color-mode toggle doesn't visually apply (stale closure)**

- **Priority:** High
- **Files:** `src/components/features/SettingsModal.tsx`, the `updateSetting`/appearance-change handler
- **Root cause (provisional — re-verify against current build before implementing):** the handler that applies a new color mode is reported to call `applyDocumentTheme(normalizeThemeId(settings.theme), ...)` where `settings.theme` is captured from the enclosing closure at the time the handler was defined, rather than from the updated state produced by the same state-setter call — a classic stale-closure bug. If confirmed, selecting "Light" in Settings would not visually change anything, or would apply light mode using a stale/wrong theme value, until some unrelated re-render happened to pick up the correct value.
- **Requirement:** The state update and the side-effecting `applyDocumentTheme` call must both operate on the same, just-computed next-state value (e.g., by computing `next` inside a functional `setState` updater and calling `applyDocumentTheme` with `next`'s fields, not the outer closure's stale fields), for every settings field that triggers an immediate visual theme change (`theme`, `color_mode`, `reduce_motion`).
- **Acceptance criteria:**
  1. Opening Settings and selecting a different color mode changes the visible theme immediately, with no dependency on an unrelated subsequent re-render.
  2. The same is verified for changing the theme identity (`sunset`/`midnight`/`meadow`) and toggling reduced motion — all three should apply instantly and correctly regardless of the order in which they're changed within one Settings session.
- **Depends on:** none.

**BUG-20 — Onboarding's first capture can be saved with the wrong status**

- **Priority:** High
- **Files:** `src/app/onboarding/OnboardingWizard.tsx`, the item-insert call for a captured thought during onboarding
- **Root cause (provisional — re-verify against current build; also cross-check against `BUG-08`'s canonical status model and the new `item-lifecycle.ts` module, since that module may already supersede this exact code path):** the onboarding flow's capture step is reported to insert a row into `items` without setting `status: 'inbox'` for items destined for the Inbox, relying instead on the table's default status (`'active'`, i.e., a Do task) — meaning a new user's very first captured thought, if routed to "Inbox" during onboarding, actually lands in Do instead, silently, on their first-ever interaction with the product. The report also names a `list_id: null` field that may not correspond to an actual column in the current schema (worth confirming against the live schema/generated types from `TOOL-01` once that lands) and should be removed if so, rather than left as a harmless-but-meaningless payload key.
- **Requirement:** The onboarding capture step's insert payload must set `status` explicitly and correctly for whichever destination the onboarding flow says the item is going to, using the same status vocabulary `BUG-08`/`item-lifecycle.ts` establishes as canonical elsewhere in the app — this is a second entry point into the `items` table and must not diverge from the single insert contract the rest of the app uses.
- **Acceptance criteria:**
  1. Completing onboarding and capturing a thought that the wizard itself labels as going to "Inbox" results in that item appearing on `/inbox`, not `/do`, immediately after onboarding finishes.
  2. The insert payload contains no fields absent from the live schema.
  3. This insert path is exercised by the same validation/typing (`TOOL-01`'s generated types) as every other `items` insert in the app, so a future schema change surfaces a compile error here too, not just in the main capture flow.
- **Depends on:** `TOOL-01` (for schema validation), `BUG-08` (for the correct status vocabulary).

**BUG-21 — Login/onboarding ambient background may use hardcoded colors instead of theme tokens**

- **Priority:** Medium
- **Files:** a background/ambient component used behind the login and/or onboarding flow (name and exact location to be confirmed in the current build — the component owning the visual behind `/login`, distinct from the in-app `AmbientBackground.tsx` already referenced elsewhere in this document)
- **Root cause (provisional — re-verify against current build):** if this component sets its gradient/orb colors from hardcoded hex values rather than the theme's CSS custom properties, it would not respect the `sunset`/`midnight`/`meadow` theme system at all, and could explain a residual version of the "wrong-colored background at login" symptom independent of the `localStorage`-leakage mechanism already covered by `BUG-15`. Note that the screenshot evidence available in this conversation's second upload actually shows a correctly warm-toned background behind the login card, which suggests this specific defect, if it exists at all, may already be resolved or may only affect a different screen/scenario — this ticket should begin with re-confirming the defect exists before any code change, not assume it from the v5 plan's description alone.
- **Requirement:** If confirmed, replace hardcoded color values in the affected component with references to the same CSS custom properties (`--accent`, `--orb-1`, `--orb-2`, or equivalent) that the in-app `AmbientBackground.tsx` uses, so the login/onboarding background always matches the current default theme rather than a fixed palette.
- **Acceptance criteria:** Loading `/login` in each of the three themes (forcing the theme via the mechanism `BUG-15`/`DS-03` establish) shows a background whose color palette visibly matches that theme, not a fixed palette independent of theme selection.
- **Depends on:** confirm the defect exists in the current build before starting.

**BUG-22 — Baseline database migration still defaults `theme` to a legacy value**

- **Priority:** Medium
- **Files:** `supabase/migrations/001_baseline.sql` (the original `theme` column definition, reported to set `DEFAULT 'wahala'`), the two newer theme-rename migrations already discussed under `CONF-07`/`BUG-15`
- **Root cause:** if the baseline migration's column default was never altered in-place (migrations are typically append-only, so this is expected and not itself a bug) but no later migration is confirmed to have set the column's live default to `'sunset'` for all schema states, then a database restored from an old backup, or a fresh environment that only partially applies later migrations, could still produce new rows defaulting to `'wahala'`. This is a narrower, more specific residual case than `BUG-15`'s primary mechanism (which is about client-side `localStorage`/`AppInitializer` behavior, not the database column default itself) and should be checked independently: confirm that the **currently active** migration chain (all files in `supabase/migrations/` applied in order, from a completely fresh database) results in a `theme` column whose default is `'sunset'`, not `'wahala'`.
- **Requirement:** If any gap is found, add one additional migration (do not edit `001_baseline.sql` or any already-applied migration in place) that sets the column default correctly and normalizes any existing `'wahala'`-defaulted rows that predate the rename migrations, using the same `LEGACY_THEME_MAP` vocabulary as `theme.ts` so client and server agree.
- **Acceptance criteria:** Provisioning a completely fresh database from the full migration chain and inserting a new `user_settings` row with no explicit `theme` value results in `theme = 'sunset'`.
- **Depends on:** `CONF-07` resolved (to avoid writing a third migration that contradicts the first two).

**BUG-23 — Page-to-page navigation transitions are inconsistent**

- **Priority:** Low
- **Files:** `src/app/(app)/` route group (a shared transition wrapper, `template.tsx`, that this ticket's source claims was previously present and has since been removed)
- **Root cause (provisional — re-verify against current build: confirm no `template.tsx` exists under `src/app/(app)/` and confirm whether any individual pages, e.g. Home, apply their own bespoke enter/exit animation while others apply none):** if confirmed, this produces a visibly inconsistent feel when moving between spaces — one page fades in, another cuts instantly.
- **Requirement:** If confirmed, add one shared, lightweight transition (a short opacity-only fade, deliberately avoiding any Y-axis/layout-shifting motion that could reintroduce a previously-removed defect — the reason this file may have been deleted in the first place should be investigated before reintroducing it, since an agent that doesn't know why prior code was removed risks reintroducing the original problem it solved) applied uniformly to every page in the route group, and remove any page-specific bespoke transition that duplicates it.
- **Acceptance criteria:** Navigating between any two of Home, Inbox, Do, Remember, Think, and Explore produces the same transition timing and style in both directions.
- **Depends on:** investigate why any prior shared-transition file was removed, if one existed, before reintroducing a similar mechanism.

**BUG-24 — Empty-state "Add" buttons remain wrong on spaces other than Do**

- **Priority:** High — this extends `BUG-04`, which this document originally scoped to the Do page only
- **Files:** `src/app/(app)/think/page.tsx`, `src/app/(app)/explore/page.tsx`, `src/app/(app)/remember/people/page.tsx`, `src/app/(app)/remember/locations/page.tsx`, `src/app/(app)/inbox/page.tsx`
- **Root cause:** `BUG-04`'s acceptance criteria already required auditing every space for the same divergence found on the Do page, but did not itself enumerate the other spaces' specific handlers. This ticket makes that enumeration explicit: Think's empty state should open its own new-thread composer, not Quick Capture; Explore's should open its add-drawer; People's and Locations' should open their respective add panels; Inbox's empty state ("Inbox Zero") most likely needs no add button at all, since Inbox's entire purpose is to receive items captured elsewhere — if it has one, it is the one space where opening Quick Capture is actually correct, since Inbox is Quick Capture's natural destination.
- **Requirement:** Same as `BUG-04`, applied explicitly to each of the five files above, with Inbox treated as the documented exception (Quick Capture is correct there) rather than a bug.
- **Acceptance criteria:** For Think, Explore, People, and Locations, the empty-state "Add" action opens the same panel/composer as that space's own header "Add" action. For Inbox, the empty-state's behavior (if any add action exists there at all) is confirmed to intentionally route to Quick Capture and is documented as such in `DS-11`'s interaction contract, not left as an unexplained exception.
- **Depends on:** `BUG-04` (this ticket supersedes its "audit other spaces" clause with concrete per-space direction).

**BUG-25 — Explore's "Type" field renders as an unstyled native `<datalist>`**

- **Priority:** Medium
- **Files:** `src/components/features/ExploreDrawer.tsx`, the Type input field
- **Root cause (provisional — re-verify against current build):** if the Type field is implemented as a plain `<input type="text">` paired with a `<datalist>`, it renders using the browser's native, unstyled autocomplete UI, which does not match the rest of the app's design system (this is a real, common web-platform limitation — `<datalist>` styling is browser-controlled and cannot be reliably restyled with CSS).
- **Requirement:** Replace the native `<input>` + `<datalist>` pairing with the app's own dropdown/combobox primitive (the same one `DS-04`/`TOOL-15` establish as canonical), preserving the ability to select a preset type or enter a custom one.
- **Acceptance criteria:** The Type field's dropdown visually matches the design system's other dropdowns (spacing, elevation, typography), and both selecting a preset and entering a custom value remain possible.
- **Depends on:** `DS-04` (use the consolidated dropdown primitive, not a bespoke one-off).

**BUG-26 — `TaskAddPanel` independently imports `chrono-node` on the client, undermining the bundle-size fix in `BUG-09`**

- **Priority:** High
- **Files:** `src/components/features/TaskAddPanel.tsx` (confirmed: static top-level `import * as chrono from "chrono-node"` and `import "@/lib/chrono-custom"`, plus at least three call sites of `chrono.parse(...)` for inline date extraction while the user types a task title)
- **Root cause:** `BUG-09` addressed `chrono-node`'s bundling and latency cost as it occurs through `capture-router.ts`/`CaptureModal.tsx`. This is a **separate, independently confirmed** static import of the same library, in a different component (`TaskAddPanel.tsx`), for a different feature (inline date extraction while typing a task title in the structured Add/Edit Task sheet, not the Quick Capture flow). Fixing `BUG-09` alone does not remove `chrono-node` from the client's initial/shared bundle if `TaskAddPanel.tsx` is reachable from a commonly-loaded route (it is — the Do page renders it) and imports the library statically. `BUG-09`'s acceptance criterion 2 ("compromise and chrono-node do not appear in the initial JS bundle... verify via bundle analysis") would fail if this second import site is left unaddressed.
- **Requirement:** Apply the same dynamic-import treatment `BUG-09` requires for `capture-router.ts` to this call site as well: lazily import `chrono-node` (and its custom parser registration) on first use inside `TaskAddPanel`, not as a static top-level import.
- **Acceptance criteria:**
  1. `TOOL-14`'s bundle analysis, run after both `BUG-09` and this ticket, shows `chrono-node` absent from the shared/initial bundle chunk, confirmed by inspecting the chunk that loads when only the Do page (not the capture flow) is visited.
  2. `TaskAddPanel`'s inline date-extraction-while-typing feature continues to work identically from the user's perspective, with the dynamic import's latency (if any, on first use per session) not perceptible as a regression — measure and report the first-use delay in the PR description.
- **Depends on:** should be delivered together with `BUG-09`, since both fixes are incomplete without each other for the stated bundle-size goal.

### 13.3 — New conflicts surfaced by the v5 plan

**CONF-08 — Calendar: incremental repair vs. full rewrite**

- **Source A (this document, `BUG-05`):** treats the calendar as a set of four independently fixable defects (height calculation, header/grid scroll desync, missing keyboard support, indirect click-to-create path) to be patched in place, with a new `DayView` component added for mobile.
- **Source B (v5 plan, Tier 3, `T3-1`):** recommends discarding and rewriting `CalendarView`, `WeekView`, and `MonthView` from scratch, citing CSS Grid over flexbox for alignment guarantees, a fixed fresh three-view structure (Day/Week/Month), and named reference apps (Cron/Notion Calendar, Sunsama, Fantastical, Google Calendar).
- **Conflict:** these are different engineering strategies for the same underlying set of defects, not different diagnoses — both sources agree on what is broken. A full rewrite is lower long-term risk if the current implementation's flexbox-based layout is structurally why the header/grid desync (`BUG-05`, root cause 2) exists at all, since a patch to a flexbox layout may not durably prevent recurrence the way a CSS Grid-based rewrite would. An incremental patch is lower short-term risk (smaller, independently-revertible changes) and delivers fixes for the most severe defects sooner. **This document does not choose between them** — this is a scoping/resourcing decision for whoever is prioritizing the backlog, not a technical dispute this document can resolve unilaterally. If a rewrite is chosen, `BUG-05` and `MOB-02` are superseded by `T3-1`'s scope and should be closed as "superseded by calendar rewrite" rather than implemented separately; if incremental repair is chosen, `T3-1` is not adopted and `BUG-05`/`MOB-02` stand as written.
- **Resolution required before:** starting either `BUG-05`/`MOB-02` or a calendar rewrite effort.

**CONF-09 — Scope of the `data-theme`/`data-mode` attribute migration (`DS-03`)**

- **Source A (this document, `DS-03`):** requires replacing the current class-based theme switching (`html.light`, `html.theme-navy`, etc.) with a `data-theme`/`data-mode` attribute pair, describing this as a "pure refactor of the selector mechanism."
- **Source B (v5 plan, Tier 5, item 15):** explicitly lists "`data-theme`/`data-mode` migration" under "DO NOT DO," characterizing it as "bigger than it sounds" and recommending deferral "unless themes multiply."
- **Conflict:** a direct disagreement on whether this refactor is worth doing now, for a three-theme system, versus deferring it until (if ever) more themes are added. This document's `DS-03` was written assuming the class-based system's dual `.theme-navy`/`.theme-forest` vs. the new `sunset`/`midnight`/`meadow` naming (per `BUG-07`) would need reconciling regardless — but the new build's `theme.ts` (confirmed in §12.1) already reconciles the naming at the JS layer via `getThemeClassNames()`/`normalizeThemeId()` while still emitting **class names**, not attributes. This narrows the actual disagreement: the naming problem `DS-03` was partly motivated by is already solved without an attribute migration. What remains genuinely contested is only the class-vs-attribute selector mechanism itself, which is a smaller, more clearly optional piece of `DS-03`'s original scope.
- **Resolution required before:** `DS-03` proceeds. Given the naming problem is independently resolved, the remaining question is narrow: is a class-to-attribute selector migration worth doing now for its own sake (e.g., to support `light-dark()` per `TOOL-21`, which does benefit from `data-mode`/`color-scheme` conventions), or should `DS-03` be withdrawn/deferred per the v5 plan's recommendation? Record the decision before touching `globals.css`'s selector structure.

**CONF-10 — Global unified trash vs. per-space trash**

- **Source A (this document, `BUG-08`, acceptance criterion 3):** requires "a single global trash surface... listing all soft-deleted items across spaces."
- **Source B (v5 plan, Tier 5, item 1):** lists "Global `/trash` route" under "DO NOT DO," stating "over-engineered for a personal app. Per-space trash is fine."
- **Conflict:** this is a direct, substantive disagreement about `BUG-08`'s target architecture, not a naming or sequencing dispute. Both sources agree the *underlying* soft-delete/restore/purge mechanism should be unified and consistent across entity tables (`BUG-08`'s core defect — four incompatible deletion behaviors — is not disputed by the v5 plan, which does not mention it at all in this framing). What is disputed is only the **browsing surface**: one shared `/trash` route across all five entity types, versus a restore affordance embedded in each space (e.g., a "show archived/deleted" filter toggle within Think, within Explore, etc., as Explore's existing `explore/trash/page.tsx` already does for itself alone). A per-space surface is less work and may fit a single-user product's mental model better; a unified surface is more discoverable and avoids a user forgetting which space something was deleted from. **This document does not choose between them.**
- **Resolution required before:** `BUG-08`'s acceptance criterion 3 is implemented. If per-space trash is chosen, `BUG-08`'s criterion 3 should be rewritten to require one consistent trash *pattern* (not necessarily one shared route) replicated identically across every space that needs it, rather than a single shared page.

**CONF-11 — Component-library consolidation target (Base UI vs. shadcn)**

- **Source A (this document, `DS-04`):** requires consolidating the two parallel button/glass-surface systems into one, without naming a specific underlying primitive library.
- **Source B (v5 plan, Tier 5, item 18):** observes both `@base-ui/react` and shadcn are present simultaneously and recommends consolidating to shadcn specifically, noting shadcn uses Base UI internally (so this is not a wholesale library replacement, but a convention/wrapper-layer choice).
- **Conflict:** minor — this narrows `DS-04`'s previously unspecified choice of underlying primitive to a concrete recommendation. Not a hard disagreement, since shadcn-over-Base-UI is compatible with everything `DS-04` already requires; it is recorded here as a conflict only because `DS-04` did not originally specify this and should not silently adopt it without the same explicit sign-off this document requires for other library adoptions in `TOOL-*`. Record shadcn as the concrete choice for `DS-04` unless a reason is given to prefer bare Base UI or another approach.
- **Resolution required before:** `DS-04` implementation begins (low friction to resolve — likely a quick confirmation, not a genuine architectural debate).

### 13.4 — Scope-discipline items adopted from the v5 plan's "DO NOT DO" list

The v5 plan's Tier 5 list (20 items) is, on inspection, a reasonable application of the same 80/20 discipline this document has tried to apply throughout — most of its items describe genuine over-engineering risks for a single/small-team personal-productivity app (vim-mnemonic shortcuts, a global undo stack beyond per-action toasts, 3D/WebGL decorative libraries, a CMS, i18n infrastructure, an enterprise design-token pipeline, Storybook, Million.js alongside the React Compiler). These are adopted into this document as explicit descope notes rather than re-litigated:

1. `DS-08`'s command-palette scope should not grow into vim-style multi-key mnemonics (`g` then `i`/`d`/`r`/`t`/`e`) — single-key or two-key shortcuts only, consistent with `INT-05`'s existing scope.
2. `MOB-05`'s per-action undo toasts are sufficient; no global `Cmd+Z`/`Cmd+Shift+Z` undo stack should be added as a separate ticket.
3. `SettingsModal`'s existing modal presentation is acceptable; a routed `/settings` page is not required and is not a ticket in this document.
4. `DS-13` (density modes) should be reconsidered against this same scope-discipline lens before implementation — re-confirm it is wanted before building it, rather than treating its presence in Phase 1 as settled.
5. `INT-04` (`@`-mention combobox in Think) should remain deferred until Think's actual usage patterns justify it, consistent with `INT-04`'s own "Low" priority already assigned in this document.
6. No animation/3D decorative library (Three.js, GSAP, Rive, Lottie, Atropos, Splitting.js) should be introduced anywhere in this backlog; `DS-05`'s motion tokens and Framer Motion (already in use) are sufficient for every animation requirement named in this document.
7. No CMS, i18n framework, or enterprise design-token pipeline (Style Dictionary/Tokens Studio) should be introduced; `DS-02`'s CSS custom properties are the correct and sufficient token mechanism for this project's current scale.
8. `INFRA-13`'s visual regression testing should not be preceded by adopting Storybook as a prerequisite — screenshot-based testing of real app pages is sufficient, per `INFRA-13`'s own text.
9. Confirm (as part of `DS-04`/`CONF-11`) that `@base-ui/react` and shadcn are not both retained as parallel dependencies once `DS-04` completes — one must be removed.

These nine items are recorded as constraints on the existing ticket set, not new tickets requiring their own acceptance criteria.

### 13.5 — Updated Definition of Done addition

Add to §11: **6.** Any change to `Navigation.tsx`, `RitualOverlay.tsx`, `AppInitializer.tsx`, `theme.ts`, `rituals.ts`, `item-lifecycle.ts`, `proxy.ts`, `MotionProvider`, `RealtimeProvider`, `Sheet.tsx`, or `useBodyScrollLock.ts` must not regress the specific behaviors independently confirmed correct in this pass: the hover-expand sidebar mechanism (`BUG-01`, resolved), the portal-based dropdown rendering (`BUG-03`, resolved), the `sunset`/`midnight`/`meadow` theme vocabulary (`BUG-07`, resolved), and the non-empty sidebar profile row (`BUG-10`, resolved). A PR touching any of these files must state in its description which of these four confirmed-correct behaviors it re-verified.

---

## 14. Addendum 3 — third-pass review (latest build, persisting defects, performance investigation)

This pass reviewed a newer build (five files changed since §12/§13's build: `rituals.ts`, `SettingsModal.tsx`, `Dropdown.tsx`, `OnboardingWizard.tsx`, plus two new governance files, `EXECUTION_RULES.md` and `OPENCODE_PROMPT.md`) and the same `plan.md` already reconciled in §13 (confirmed byte-identical to the copy already reviewed — no new tickets were added to it since §13; only a handful of its Tier 0 items have been executed against the codebase).

### 14.1 — Governance files found in the repository, and a new conflict they create

`EXECUTION_RULES.md` and `OPENCODE_PROMPT.md` are process documents given directly to the coding agent ("opencode") executing `plan.md`, not to this document. They explain why progress has been slow and narrow (one ticket at a time, build+test+commit+stop after each). Two of their rules interact directly with this document's tickets and must be reconciled:

**CONF-12 — `env.ts` must never throw, per the repository's own locked-in rule, directly contradicting `TOOL-02`**

- **Source A (this document, `TOOL-02`):** requires replacing `env.ts` with `@t3-oss/env-nextjs`, whose entire purpose is to validate required environment variables at startup and **fail fast with a thrown error** if one is missing.
- **Source B (`EXECUTION_RULES.md`, Law 6 and the Stop List; `OPENCODE_PROMPT.md`, "Iron rules"):** explicitly lists `env.ts`'s current "return empty string, never throw" behavior under the "DO NOT BREAK" list, and separately lists "a change that makes `env.ts` throw at runtime" as item 4 on the ten-item Stop List — the document's strongest category, reserved for changes an agent must refuse to make even if instructed. Both files state the reason directly: an earlier version of `env.ts` that threw on missing variables previously **crashed the entire production site**, and this is treated as a known, costly incident the team does not want repeated.
- **Conflict:** this is a direct, high-stakes contradiction, not a minor scope question like most of this document's other conflicts. `TOOL-02`'s stated goal (replace a silent-failure stub with fail-fast validation) is sound engineering practice in the abstract, but the specific mechanism it names (`@t3-oss/env-nextjs`, which throws by design at module load when `createEnv()` validation fails) is exactly the failure mode the repository has already been burned by once and has since written a standing rule against reintroducing.
- **Resolution:** `TOOL-02` is **withdrawn as written** and replaced by a narrower requirement: environment variable validation must warn loudly (surfacing to the error-tracking tool from `INFRA-01`/`TOOL-06`, not just `console.error`) when a required variable is missing, without ever throwing an exception that would crash a request or the server process. If `@t3-oss/env-nextjs` is still desired for its type-safety benefits, it must be configured or wrapped so that a validation failure is caught and reported rather than allowed to throw uncaught — this is a valid but non-default configuration of that library and must be explicitly verified to behave this way before adoption, not assumed. Do not implement `TOOL-02` or `T1-5` (the equivalent item in `plan.md`) in their originally-described throwing form. This resolution should be added to `plan.md`'s own `T1-5` ticket as well, since `plan.md` as currently written has the same conflict with its own `EXECUTION_RULES.md` that this document has with itself.
- **No other action item from this document is known to conflict with `EXECUTION_RULES.md`'s Stop List or "DO NOT BREAK" list** — the rest of this document's tickets were cross-checked against both lists and do not touch `proxy.ts`'s CSP header, `MotionProvider`'s `LazyMotion`/`strict` configuration, RLS's `auth.uid()` policies, the service-role key usage in `/api/account`, or propose deleting any file in `src/components/ui/` or any migration file.

### 14.2 — Regression alert: the dropdown-clipping fix (`BUG-03`) has been reverted

This is the most severe finding in this pass and should be treated as the top-priority item in the next work session.

**BUG-27 — `Dropdown.tsx` regressed from portal-based rendering back to clipped absolute positioning; the original Inbox dropdown defect was never fixed at all**

- **Priority:** Critical — this is a confirmed regression of previously-verified-correct code, not merely an unfixed bug.
- **Files:** `src/components/ui/Dropdown.tsx` (entire component), `src/app/(app)/inbox/page.tsx` (line 97)
- **Root cause:** §12.1 of this document confirmed, by direct inspection of the previous build, that `Dropdown.tsx` had been fixed to render its menu content via `createPortal(..., document.body)` with position computed from `getBoundingClientRect()` — the correct fix for `BUG-03`'s ancestor-clipping defect. Direct inspection of the current build shows this is **no longer the case**: `grep` for `createPortal` in `Dropdown.tsx` now returns zero matches. The component has been rewritten to render its menu as a plain `<div className="dropdown-panel absolute top-full left-0 mt-1 z-[220]">` — a static child of the trigger's container again, with only a raised `z-index` (`220`) as its positioning defense. As this document's original `BUG-03` analysis established, `z-index` has no effect on `overflow: hidden` clipping — an ancestor with `overflow: hidden` (as, for example, the `GlassCard`/`Surface` wrappers or any scrollable container `Dropdown` is used inside — confirmed consumers: `SettingsModal.tsx`, `TaskAddPanel.tsx`, `CaptureModal.tsx`, `remember/people/[id]/page.tsx`) will still crop this menu regardless of its z-index. This regression appears traceable to `plan.md`'s own `T0-5` ticket, which diagnosed the Inbox dropdown's clipping as a z-index-ordering problem ("`z-50` is too low... change to `z-[220]`") rather than the actual ancestor-`overflow:hidden` clipping mechanism this document identified — an agent following `T0-5`'s literal instruction, per `EXECUTION_RULES.md`'s Law 1 ("make ONLY the changes described in that ticket"), would have applied a z-index bump and, in doing so to the shared `Dropdown.tsx` component, overwritten the better, already-working portal-based fix that a separate, earlier change had put in place.
- **A second, compounding finding:** `T0-5`'s fix was never actually applied to its own named target. `inbox/page.tsx:97` — the exact file and line `T0-5` names, and the exact dropdown shown in the user's original screenshot evidence — still reads `z-50`, not `z-[220]`, and is not built on the shared `Dropdown.tsx` component at all (it is bespoke inline markup, a plain `.dropdown-panel absolute` div local to that page, still a child of the same `overflow-hidden` ancestor described in the original `BUG-03` writeup). In other words: the one dropdown the user explicitly screenshotted as broken has never been touched by any fix in any build reviewed across this document's three passes, while a different, shared component that had already been correctly fixed has now been broken by a change intended for that untouched file.
- **Requirement:**
  1. Restore portal-based rendering (`createPortal` to `document.body` or an equivalent dedicated overlay root) in `Dropdown.tsx`, with position computed from the trigger's bounding rect, as before — this document's original `BUG-03` requirement stands and should be treated as re-opened, not superseded by the z-index approach.
  2. Apply the same portal-based treatment to `inbox/page.tsx`'s bespoke "Route it" dropdown markup, which has never received any fix — either by migrating it onto the shared, now-corrected `Dropdown.tsx`/`Popover.tsx` component (preferred, since it eliminates a second bespoke implementation) or by giving it its own portal if migrating it is out of scope for this ticket.
  3. `T0-5` in `plan.md` should be corrected or annotated to reflect that a z-index change alone does not and cannot fix this defect class, so a future execution pass does not reach the same incomplete conclusion again.
- **Acceptance criteria:**
  1. `grep` for `createPortal` in `Dropdown.tsx` returns at least one match, and the component's menu content is confirmed (by testing inside a `overflow: hidden` or `overflow: auto` ancestor) to render fully visible, not clipped.
  2. The Inbox "Route it" dropdown, specifically, is tested against the exact scenario in the original screenshot evidence (a card near the bottom of a scrolled list) and confirmed unclipped.
  3. A regression test (Playwright, per `INFRA-13`) is added that opens a dropdown inside a known `overflow: hidden` container and asserts the menu's bounding box is not clipped by its ancestor — so this specific regression class cannot silently reoccur a third time.
- **Depends on:** none. This should be actioned before any further `Dropdown.tsx`-adjacent ticket (`DS-04`, `BUG-25`) to avoid building on top of the regressed version.

### 14.3 — Status corrections for previously-open tickets (verified against the current build)

| Ticket | Prior status | Current status | Evidence |
|---|---|---|---|
| `BUG-17` (evening ritual fires before morning done) | Open (§13) | **Resolved** | `rituals.ts`: the evening-trigger condition now reads `if (currentMinutes >= shutdownMinutes && !eveningDone && morningDone)` — the missing guard is present. |
| `BUG-19` (Settings stale-closure color-mode bug) | Provisional (§13) | **Resolved, correctly** | `SettingsModal.tsx`'s `updateSetting` now writes through a `settingsRef`/functional update, and a dedicated `useEffect` keyed on `[settings.theme, settings.color_mode, settings.reduce_motion, initialLoaded]` applies `applyDocumentTheme` and syncs `localStorage` — this is a clean fix, not a workaround, and matches this document's requirement. |
| `BUG-20` (onboarding capture wrong status) | Provisional (§13) | **Resolved** | `OnboardingWizard.tsx`'s insert payload now sets `status: item.destination === "Inbox" ? "inbox" : "active"`, and the invalid `list_id` field is removed. |
| `BUG-03` (dropdown clipping, `Dropdown.tsx`) | Resolved (§12) | **Regressed — see `BUG-27`** | Portal rendering removed; see §14.2. |
| `BUG-03` (dropdown clipping, `inbox/page.tsx`'s own markup specifically) | Implicitly assumed covered by the `Dropdown.tsx` fix | **Never fixed, confirmed still broken** | `inbox/page.tsx:97` unchanged from every prior build reviewed; still `z-50`, still unportaled, still a child of the same `overflow-hidden` ancestor. See §14.2. |
| `BUG-15` (theme leaks via `localStorage` across sessions/accounts; sign-out doesn't clear it) | High, open (§12.3) | **Confirmed still fully open — user independently re-reports this** | `AppInitializer.tsx` still resolves theme as `userSettings?.theme || localStorage.getItem("presense_theme")`; `SettingsModal.tsx`'s two `signOut()` call sites still have no adjacent `localStorage.removeItem` for `presense_theme`/`presense_color_mode`/`presense_reduce_motion`. Given this is now a twice-reported, user-visible defect on the very first screen of the app, its priority is raised from High to **Critical**. |
| `PERF-01` (`useCallback` on Do page handlers) | Medium, open | **Confirmed still open** | `do/page.tsx`: only `fetchArchived` is wrapped in `useCallback`; `completeTask` and `openEditPanel` — the two handlers passed as props into every rendered `TaskCard` — are still plain functions redefined on every render, still defeating `TaskCard`'s `React.memo`. Given the user's new, explicit "very laggy" report and the Do page being the app's primary, highest-task-count surface, this ticket's priority is raised from Medium to **High**. |
| `BUG-09` / `PERF-02` (dynamic-import `compromise`/`chrono-node` in `capture-router.ts`) | High, open | **Confirmed still open** | `capture-router.ts` lines 1–3 remain static top-level imports. |
| `BUG-26` (duplicate static `chrono-node` import in `TaskAddPanel.tsx`) | High, open | **Confirmed still open** | Lines 9 and 13 unchanged. |
| `TOOL-07` (wire `content-visibility: auto` to actual list rows) | High, open | **Confirmed still open** | `grep` for `task-card-wrapper` across all `.tsx` files still returns zero matches; the CSS rule remains inert. |

### 14.4 — "Laggy and unoptimized" — root-cause investigation and new tickets

The user's report that the app is now "very laggy and unoptimized" is not a vague impression this pass takes on faith — five concrete, independently verifiable contributors were found, three of which are ticket items already open in this document (re-cited above) and two of which are new. Together they plausibly compound into a broadly sluggish feel, especially on the Do page and especially when switching tabs/windows:

1. **Unmemoized list-item callbacks defeating `React.memo` on the Do page** (`PERF-01`, status above) — every task card re-renders on any parent state change, not just changes relevant to that card.
2. **NLP libraries bundled eagerly, and bundled twice** (`BUG-09`/`PERF-02`, `BUG-26`, status above) — `compromise` (~250KB) and `chrono-node` (~150KB) are statically imported in both `capture-router.ts` and `TaskAddPanel.tsx`, meaning this weight is likely present in the initial or near-initial bundle for any session that reaches the Do space, which is the app's default/most-used surface.
3. **`content-visibility: auto` declared but never applied** (`TOOL-07`, status above) — a long task, thread, or explore list pays full layout/paint cost for every row, including off-screen ones, even though the CSS mechanism to avoid this was already written and is simply not wired to any element.
4. **New finding — `PERF-07`: React Query is configured to refetch on every window focus, in an app whose primary freshness mechanism is already realtime subscriptions.** `QueryProvider.tsx` sets `staleTime: 1000 * 60 * 5` (5 minutes) and `refetchOnWindowFocus: true`. This means: for any session older than 5 minutes — a near-certainty in a productivity app people keep open across tab switches all day — returning focus to the tab triggers a refetch of every currently-mounted query simultaneously. This is compounded by the fact that `RealtimeProvider.tsx` (confirmed a legitimate, ref-counted, debounced shared-channel architecture, correctly on the "do not break" list) already handles live freshness for the tables it subscribes to (`items`, `people`, `threads`, `explores`, confirmed via the `useRealtime(...)` call sites in `do/page.tsx`, `(app)/page.tsx`, `think/page.tsx`, `explore/page.tsx`, `remember/*`). Running both a realtime push mechanism and an aggressive focus-triggered pull mechanism for the same data is redundant, and the pull mechanism firing a burst of simultaneous requests at the exact moment a user returns to the tab is a plausible, common source of a felt "lag spike" right when someone alt-tabs back into the app.
    - **Priority:** High
    - **Files:** `src/components/layout/QueryProvider.tsx`
    - **Requirement:** Set `refetchOnWindowFocus: false` for queries on tables that already have an active realtime subscription covering their freshness, consistent with this document's pre-existing `PERF-05` ticket (which described this requirement in general terms; this finding confirms the specific current values and elevates it from a general recommendation to a confirmed, concrete defect). Queries with no corresponding realtime subscription (if any exist) may retain focus-refetch behavior, decided case by case rather than globally.
    - **Acceptance criteria:** Switching away from and back to a browser tab after more than 5 minutes does not trigger a visible loading-skeleton flash or a burst of simultaneous network requests on any view whose underlying table already has a realtime subscription; `PERF-05`'s existing acceptance criteria are satisfied by this same change.
    - **Depends on:** none. Supersedes/completes `PERF-05` — close `PERF-05` once this lands, do not track both separately.
5. **New finding — `PERF-08`: 16 unreduced `backdrop-filter` declarations remain, unaddressed by `PERF-04`.** Re-confirmed at the current build: `grep -c "backdrop-filter" src/app/globals.css` returns 16. `PERF-04`'s requirement (reduce the heaviest blur value, add `contain: paint`, add a no-backdrop-filter fallback) has not been started. Backdrop-filter is one of the more expensive properties a browser compositor can be asked to recompute on scroll/resize/animation, and with 16 declarations spread across glass surfaces that appear throughout the app (sidebar, modals, dropdowns, cards), this is a plausible steady-state contributor to jank distinct from the more acute issues above.
    - **Priority:** raised from Medium to **High**, given the user's explicit performance complaint.
    - No new acceptance criteria beyond `PERF-04`'s existing ones — this entry exists to re-prioritize, not replace, that ticket.

**Recommended immediate sequencing for the performance complaint specifically**, ahead of this document's originally-planned phase ordering: `PERF-01`, `PERF-07`, `BUG-09`+`BUG-26` (deliver together, as `BUG-26`'s ticket already required), `TOOL-07`, then `PERF-08`/`PERF-04`. These five are cheap relative to their likely impact and do not depend on any unresolved conflict in this document — they can start immediately without waiting on `CONF-01` through `CONF-12`.

### 14.5 — Updated Definition of Done addition

Add to §11: **7.** Any ticket touching `Dropdown.tsx` or `inbox/page.tsx`'s routing menu must include, in its PR description, a screenshot or recording of the menu open inside a scrolled/`overflow`-constrained container, given this exact defect class has now regressed once already (`BUG-27`) after being marked resolved. A ticket is not done on this file until that evidence is provided, regardless of what its other acceptance criteria show.

---

## 15. Addendum 4 — fourth-pass audit (build with `docs/` restructure) and the documentation-governance system

This pass reviewed a much larger diff than any prior pass (49 files changed) and a new `docs/` folder the user added by hand. Real, substantial progress was made — more of this document's tickets closed in this pass than in the previous three combined. But a new, structurally important problem was found: **the repository now contains every planning document in two places, several of which have already diverged from each other**, and **a "DO NOT BREAK" invariant was violated without going through this document's conflict process.** Both are addressed here: first the code audit, then the documentation-governance system the user asked for, researched against current (2026) practice for AGENTS.md, Antigravity's specific rule-resolution order, and AI-generated design-system drift.

### 15.1 — Confirmed fixed this pass

| Ticket | Evidence |
|---|---|
| `BUG-27` (Dropdown portal regression) | `createPortal` is back in `Dropdown.tsx` (two call sites), and the Inbox routing menu has been migrated off its old bespoke `.dropdown-panel` markup onto the shared `Popover` component (`inbox/page.tsx` now imports and uses `Popover`). **Re-closed** — but per this document's §14.5 rule, this file's history (fixed → regressed → fixed again) means it should not be considered stable without the regression-guard test that ticket already required; that test has still not been added (no new Playwright spec for this found in the diff). |
| `BUG-15` (theme leaks across sessions via `localStorage`) | `SettingsModal.tsx` now calls `localStorage.removeItem` for all three theme-related keys at both sign-out call sites, before `supabase.auth.signOut()`. `AppInitializer.tsx` was rewritten: it no longer falls back to a raw `localStorage.getItem` read at all for authenticated users — it now waits for `userSettings` to actually load (`isSettingsLoaded` check) and applies a literal default for public routes (`/login`, `/onboarding`) instead of ever consulting `localStorage` on those routes. This is a correct, complete fix — better than this document's original requirement, which only asked for the fallback to stop, not for the loading-state race to be closed as well. |
| `PERF-01` (unmemoized Do-page handlers) | `completeTask` and `openEditPanel` are now both wrapped in `useCallback` in `do/page.tsx`, alongside the already-fixed `fetchArchived`. |
| `PERF-07` (`refetchOnWindowFocus` fighting realtime) | `QueryProvider.tsx` now sets `refetchOnWindowFocus: false`. Close `PERF-05`/`PERF-07` together. |
| `BUG-26` (duplicate static `chrono-node` import in `TaskAddPanel`) | Now dynamically imported and cached in a module-level `chronoCache`, mirroring the pattern used in `capture-router.ts`. |
| `BUG-09`/`PERF-02` (`capture-router.ts` static NLP imports) | `capture-router.ts` now dynamically imports `chrono-node` at the point of use (`const chrono = await import("chrono-node")`) rather than at module top-level. Re-verify `compromise`'s import site the same way before fully closing `BUG-09` — this pass only directly confirmed the `chrono-node` half. |
| `CONF-02` (space-color palette) | Resolved, in code: `--space-do/-think/-remember/-explore` now resolve to four distinct, warm-toned hex values (`#E5B41E`, `#EB4233`, `#F4A261`, `#A76011` in the default mode; a separate darker set for the alternate mode), consistent with the audit's original all-warm proposal and no longer collapsing to a single shared `--accent` value. `DESIGN_SYSTEM.md` should be checked for whether its own documented table was updated to match (`DS-01`'s second acceptance criterion) — not confirmed in this pass. |
| `DS-07` (`PageHeader`, `EmptyState` primitives) | Both components were added and are genuinely imported and used across seven page files (`do`, `inbox`, `think`, `explore`, `remember/people`, `remember/layout`, `(app)/page.tsx`) — this is real adoption, not dead code. |
| `DS-09` (`Input`, `Textarea`, `SearchInput` primitives) | Components created (`Input.tsx`, `Textarea.tsx`, `SearchInput.tsx`). Adoption breadth into `TaskAddPanel`/`AddPersonPanel`/`LocationAddPanel`/`CaptureModal` was not individually re-verified in this pass — check before marking `DS-09` fully closed. |

### 15.2 — New finding: a "DO NOT BREAK" invariant was violated, and the theme name has now churned a third time

**This is the single most important finding of this pass for the user's stated problem** ("it doesn't follow the execution spec much at all... does things itself").

- `EXECUTION_RULES.md` (both the root copy and the `docs/agents/` copy) lists, verbatim, under Law 6 / the "DO NOT BREAK" list: *"The theme names (`sunset`, `midnight`, `meadow` — do NOT revert to `wahala`/`orange`/`blue`/`forest`)."* `OPENCODE_PROMPT.md` repeats the same instruction.
- Direct inspection of this build's `src/lib/theme.ts` shows the internal theme identifiers have been renamed a **third** time in this document's four passes: `wahala`/`orange`/`blue`/`forest` (original) → `sunset`/`midnight`/`meadow` (after `BUG-07`, protected by the rule above) → **`warm`/`navy`/`forest`** (this build). A new migration, `20260704000000_update_theme_names_to_warm.sql`, performs this rename at the database level, correctly preserving backward compatibility (the `CHECK` constraint and `LEGACY_THEME_MAP` both still accept every prior name as a legacy synonym) — the migration itself is competently written. The problem is not the migration's quality; it is that **this rename happened at all**, contradicting an explicit, written, repeatedly-restated project rule, with no corresponding entry in this document's conflict register and no recorded user sign-off.
- This is not a hypothetical risk this document warned about in the abstract — it is the exact failure mode the user is now reporting having observed directly, caught in the act, with a specific rule, a specific violating commit's worth of changes, and a specific mechanism (an agent free to edit `theme.ts` and write a new migration without first checking whether doing so was permitted). This finding should be treated as Exhibit A for why §15.3's documentation-governance redesign is necessary, and specifically why documentation alone — no matter how well-written — cannot be the only enforcement mechanism (see §15.3's research findings on this exact point).
- **Action:** `theme.ts`'s current names (`warm`/`navy`/`forest`) are treated as the new, retroactively-accepted canonical vocabulary for the rest of this document from this point forward — reverting a third time would only compound the churn. But the naming question is now formally closed and must not be reopened without going through §15.3's governance process: any future PR that touches `ThemeId`, `LEGACY_THEME_MAP`, or a `theme`-column migration must cite an explicit, dated approval, or it should be rejected in review regardless of which coding agent or tool produced it.

### 15.3 — The documentation-governance system

The user's request here has three parts: (1) fix the mess of MD files (root-level and `docs/`-level copies of the same files, several already diverged), (2) create one absolute master file that governs how every other doc is read, updated, and kept consistent, and (3) solve the deeper problem that new components/features get invented from scratch instead of following the design system — and asked that this be researched against current, authoritative practice rather than improvised. Findings below are from that research, current as of mid-2026, cross-checked against Antigravity's actual documented rule-resolution behavior (not assumed).

**Research findings, condensed to what is decision-relevant:**

1. **AGENTS.md is now a real, formalized, cross-tool standard**, not a vendor convention. It was formalized as an open specification in August 2025 with OpenAI, Google, Cursor, and Factory as participants, and donated to the Linux Foundation's Agentic AI Foundation in December 2025. As of the most recent figures available, more than 60,000 open-source projects use the format and more than twenty AI coding tools read it natively — including, since Antigravity v1.20.3 (March 2026), Antigravity itself, alongside Cursor and Claude Code. This makes `AGENTS.md` the correct single file to consolidate this project's governance into, rather than maintaining separate `CLAUDE.md`, `.cursorrules`, and Antigravity-specific files with near-duplicate content, which is a documented, named anti-pattern in current guidance on this exact topic.
2. **Antigravity's specific rule-resolution order, confirmed from Antigravity's own documentation and third-party guides, is:** (1) Google's own immutable system rules, (2) `GEMINI.md` at the workspace root — Antigravity-specific, and the **highest priority a project can set**, overriding everything below it, (3) `AGENTS.md` at the workspace root — the cross-tool file, read by Antigravity, Cursor, and Claude Code alike, (4) workspace rule files in a rules subdirectory for supplementary, topic-scoped rules. **This ordering is the direct explanation for part of this project's current mess**: if a `GEMINI.md` exists anywhere in this repository (not confirmed either way in the zip reviewed for this pass — check for one at the root before proceeding) and disagrees with `AGENTS.md` or with this document, `GEMINI.md` silently wins inside Antigravity specifically, while a different tool (Cursor, Claude Code) reading the same repository would follow `AGENTS.md` instead, with no way to tell from either tool's behavior alone that the other file was the reason for a discrepancy.
3. **Antigravity Rules files are capped at 12,000 characters each.** This document (`EXECUTION_SPEC.md`) is roughly ten times that size and must never be pasted into a Rules file directly; it must be linked to, and consulted on demand, not preloaded whole into every agent session. Antigravity supports `@filename` references inside a Rules file specifically for this purpose (relative to the rules file's own location, or absolute).
4. **Documentation-only governance is a documented, named failure mode, not a hypothetical.** Current practitioner research on this exact problem (AI coding agents drifting from a project's design system) found that "context injection fails because it's optional. The AI can always ignore guidance," that teams "report needing to restart sessions to maintain rule-following" with markdown-only guidance, and that simple constraints ("always use Tailwind") are followable while complex ones ("use these 47 spacing values") are not, when delivered as prose alone. The same body of work identifies the fix that actually holds up in practice: **a machine-checkable contract, enforced automatically, not merely described** — a token/component manifest the agent must look up rather than invent from, plus a linter (a fast, cheap automated check, run on every change) that flags any code that doesn't use that manifest. One named implementation runs a small, fast model as a dedicated "design-system-check" reviewer on every changed file specifically because the enforcement needs to be cheap enough to run unconditionally, not something a human has to remember to invoke. This directly explains why this project's existing documentation-heavy approach (`CLAUDE.md`, `DESIGN_SYSTEM.md`, `plan.md`, this document itself) has not stopped the "invents new design on the spot" problem — no amount of additional prose will fully fix this class of problem; it needs a companion enforcement layer, addressed in the new `DS-15`–`DS-18` tickets below.
5. Tailwind-specific research converges on the same point from the CSS side: AI-generated Tailwind reliably drifts toward arbitrary values (`text-[13px]`, `bg-[#123456]`, `mt-[-100px]`) and default-palette colors (`bg-blue-500`) instead of project tokens, unless arbitrary values are structurally disabled (Tailwind v4's `@theme` directive supports `--spacing: initial` followed by an explicit, closed set of allowed steps, which removes the arbitrary-value escape hatch at the config level rather than relying on the model to self-restrict) and an ESLint plugin (`eslint-plugin-tailwindcss`, rules including a no-arbitrary-value rule and a rule restricting class names to those actually defined in the theme) rejects the rest at review time.

**What this means concretely for this project — the new documentation and enforcement structure:**

#### MD-01 — Eliminate all duplicate documentation; one file, one location, per concern

- **Priority:** Critical
- **Files:** every root-level `.md` file and every file under `docs/`
- **Root cause:** confirmed in this pass: `PROJECT.md`, `DESIGN_SYSTEM.md`, `ARCHITECTURE.md`, `ORIGINAL_REQUEST.md`, `plan.md`, `EXECUTION_RULES.md`, and `OPENCODE_PROMPT.md` each exist in two places — repository root and a mirrored path under `docs/` — and four of the seven pairs (`DESIGN_SYSTEM.md`, `plan.md`, `EXECUTION_RULES.md`, `OPENCODE_PROMPT.md`) have already diverged from each other, meaning the two copies now disagree about what the rules even are. No tool or agent has been told which copy is authoritative in a way that is structurally enforced (only `docs/README.md`'s prose says to prefer the `docs/` copies, which nothing prevents an agent from missing or ignoring, especially since the root copies are what most tools conventionally scan for first).
- **Requirement:** Every document must exist in exactly one location. Delete the losing copy of each of the seven duplicated files (keep whichever copy is more current/correct per this document's own findings — for `EXECUTION_RULES.md` and `OPENCODE_PROMPT.md`, the `docs/agents/` versions are more current, per §13.1's independent finding that they correctly prioritize this document over `plan.md`; for `DESIGN_SYSTEM.md` and `plan.md`, diff both copies by hand before choosing, since this document has not independently verified which diverged copy is more correct). The final structure should be: a small number of files at repository root that tools conventionally expect to find there (`AGENTS.md`, `README.md`), and everything else — architecture notes, the design system, the execution spec, the historical request, and any legacy plan — under `/docs`, in exactly one copy each.
- **Acceptance criteria:**
  1. `find . -iname "*.md" | xargs -I{} md5sum {}` (or equivalent) shows no two files with identical or near-identical purpose and different content.
  2. Every `.md` file in the repository is reachable from `AGENTS.md` (directly or transitively) via an explicit reference — no orphaned, undiscoverable doc.
  3. A pre-commit or CI check (see `MD-03`) fails a PR that reintroduces a duplicate.
- **Depends on:** none. This should be the very next thing done, before any further feature work, since every hour spent with two disagreeing copies of the rules in the repository is another hour an agent might read the wrong one.

#### MD-02 — Retire `plan.md` as an independent, competing backlog

- **Priority:** High
- **Root cause:** `plan.md` and this document (`EXECUTION_SPEC.md`) are two independently-evolving backlogs for the same project, and `EXECUTION_RULES.md` already had to write explicit tie-breaking logic ("if `plan.md` and `EXECUTION_SPEC.md` disagree, `EXECUTION_SPEC.md` wins") — the existence of that sentence is itself evidence the two-backlog structure is a source of confusion, not a resolved one. `plan.md` has also not been updated with any new tickets since §13 of this document (confirmed identical byte-for-byte across two separate uploads), while this document has continued to track new findings every pass — `plan.md` is effectively stale but still physically present and still capable of being read by an agent that doesn't know to deprioritize it.
- **Requirement:** Fold any `plan.md` ticket not already represented in this document into this document (a one-time reconciliation pass, checking specifically for anything `plan.md`'s Tier 2–4 items cover that this document's `TOOL-*`/`DS-*` tickets do not), then delete `plan.md` outright rather than keeping it as a "secondary/legacy" reference. A single active backlog is the only structure that fully removes the disagreement risk — keeping a deprecated file "for reference" is exactly how the repository ended up with the divergence problem `MD-01` just fixed.
- **Acceptance criteria:** `plan.md` no longer exists anywhere in the repository; every ticket ID it introduced that had no equivalent in this document has been migrated in with a new `TOOL-*`/`DS-*`/`BUG-*` ID and a note of its origin.
- **Depends on:** `MD-01`.

#### MD-03 — Root `AGENTS.md`: the one file that governs how every other file is read, updated, and kept consistent

- **Priority:** Critical
- **Requirement:** Create a single root-level `AGENTS.md` (already delivered as a starting draft alongside this update — see the accompanying file) that is short enough to comfortably fit inside Antigravity's 12,000-character Rules-file limit, and that does the following and nothing more: (1) states the four or five hard, non-negotiable invariants this project has already been burned by breaking (`env.ts` must never throw; the current theme identifiers, whatever they are now — `warm`/`navy`/`forest` per §15.2 — must not be renamed without a dated, recorded approval; the hover-sidebar/portal-dropdown/realtime-provider/motion-provider patterns already confirmed correct must not be reintroduced-then-broken again), (2) points to exactly one file for the active backlog (this document, at its permanent location post-`MD-01`), exactly one file for the design system (post-consolidation `DESIGN_SYSTEM.md`), and exactly one file for detailed workflow rules (`EXECUTION_RULES.md`, post-consolidation), using `@`-style references rather than inlining their content, (3) gives the one-sentence version of the "before creating any new UI, check the component manifest first" rule that `DS-17` below makes machine-checkable, and (4) explicitly states that if any other `.md` file anywhere in the repository disagrees with `AGENTS.md`, `AGENTS.md` wins — collapsing this document's own multi-file tie-breaking logic into a single, unambiguous root rule. Per the ETH Zurich-adjacent research cited above, do **not** include a prose architecture walkthrough in this file — that content, if wanted at all, belongs in `ARCHITECTURE.md`, referenced, not duplicated.
- **Acceptance criteria:**
  1. `AGENTS.md` is under 12,000 characters.
  2. No content in `AGENTS.md` is copy-pasted from any other file in the repository — every substantive rule beyond the four or five hard invariants is a reference, not a restatement.
  3. A fresh agent session given only `AGENTS.md` and no other prior context can correctly state, without being told: what the current theme names are, where the active backlog lives, where the design system lives, and what it must never do to `env.ts`.
- **Depends on:** `MD-01`, `MD-02`.

#### MD-04 — `GEMINI.md`: either delete it, or make it a one-line pointer, and never let it diverge

- **Priority:** Critical
- **Root cause:** because `GEMINI.md`, if present, has the **highest** priority of any file in Antigravity's own resolution order — above `AGENTS.md` — any content in it that disagrees with `AGENTS.md` wins inside Antigravity while being invisible to every other tool reading the same repository. This is a structurally dangerous file to leave unmanaged given this project's history of documents silently diverging from each other.
- **Requirement:** Check whether a `GEMINI.md` exists anywhere the project's Antigravity workspace can see (including `~/.gemini/GEMINI.md`, the *global*, cross-project location, which several current guides note is easy to create by accident via Antigravity's own "+ Global" UI button and is a documented source of cross-project rule conflicts unrelated to this specific repository). If one exists and contains real rules, either delete it and move any genuinely Antigravity-specific behavior into an `AGENTS.md`-compatible form, or reduce it to a single line: a pointer stating that `AGENTS.md` is authoritative and that this file is deliberately left empty of substantive rules. Never let it carry content that could disagree with `AGENTS.md`.
- **Acceptance criteria:** Either no `GEMINI.md` exists in any location Antigravity would read for this project, or the one that exists contains only the single pointer line described above, verified by direct inspection, not by assumption.
- **Depends on:** none — can and should happen immediately, in parallel with `MD-01`.

#### DS-15 — Lock the Tailwind theme to remove the arbitrary-value escape hatch

- **Priority:** Critical
- **Requirement:** Using Tailwind v4's `@theme` directive, explicitly disable the default open-ended spacing/color scales (`--spacing: initial`, then define only the specific step values this project's design system actually uses) so that arbitrary bracket-syntax values (`mt-[13px]`, `p-[7px]`) are no longer just discouraged but structurally unavailable as a shorter path than using a token. Color tokens should be similarly closed to the project's actual named palette (post-`DS-01`/`DS-02`'s token consolidation) rather than leaving Tailwind's full default color palette (`bg-blue-500`, `bg-sky-400`, etc.) available alongside the project's own tokens, since availability of the default palette is precisely what current research identifies as the mechanism by which AI-generated code drifts toward off-brand colors.
- **Acceptance criteria:** Attempting to use a Tailwind color or spacing utility outside the closed set defined in `@theme` produces no styling effect (since the utility class is never generated), making the drift visually obvious immediately rather than silently shipping.
- **Depends on:** `DS-02` (token consolidation must land first, so there is one settled set of values to lock the theme to).

#### DS-16 — ESLint enforcement of design-token usage

- **Priority:** High
- **Requirement:** Add `eslint-plugin-tailwindcss` (or an equivalent, current plugin) configured to reject arbitrary-value class names and class names not present in the locked theme from `DS-15`, wired into the CI gate already established by `INFRA-02`, so a violation fails the build automatically rather than depending on human review to catch it.
- **Acceptance criteria:** A PR introducing a single `text-[13px]` or `bg-blue-500` anywhere in `.tsx` fails CI.
- **Depends on:** `DS-15`, `INFRA-02`.

#### DS-17 — A machine-readable component manifest ("the dictionary")

- **Priority:** Critical
- **Requirement:** Produce one machine-readable file (JSON or a tightly-structured Markdown table, not free prose) listing every approved UI primitive in this project's design system (`Button`, `GlassCard`/`Surface`, `Dropdown`/`Popover`, `Sheet`, `Input`, `Textarea`, `SearchInput`, `PageHeader`, `EmptyState`, `Badge`, `Avatar`, and every other primitive `DS-04`/`DS-07`/`DS-09`/`DS-10` establish), each with its accepted variants/props and one canonical usage example. This is the "dictionary" current best-practice research describes: the artifact an agent is expected to look up before writing any new UI, rather than a description it is expected to remember. `AGENTS.md` (per `MD-03`) must reference this file directly and state explicitly: if a needed pattern is not in the manifest, the agent must stop and ask before inventing new markup, rather than improvising and moving on.
- **Acceptance criteria:** Every current UI primitive in `src/components/ui/` has an entry in the manifest; the manifest is kept in one location referenced (not duplicated) from `DESIGN_SYSTEM.md` and `AGENTS.md` alike.
- **Depends on:** `DS-04`, `DS-07`, `DS-09`, `DS-10` (the manifest should describe the settled, consolidated component set, not the pre-consolidation one).

#### DS-18 — An automated "design-system-check" pass on every change

- **Priority:** High
- **Requirement:** Following the pattern already proven in current practice (a small, fast model or a deterministic script reviewing only the changed files in a diff against `DS-17`'s manifest and `DS-15`'s locked theme, cheap enough to run on every change without friction), add this as either an Antigravity Skill (`​.agents/skills/design-system-check/SKILL.md`, triggered automatically or via an explicit workflow slash-command run before any UI-touching change is considered finished) or a CI step under `INFRA-02`, whichever integrates more naturally with the tools already in use. This is the enforcement layer that `DS-16`'s linter cannot fully cover on its own (a linter can catch a raw arbitrary value or an off-palette color; it cannot as easily catch "this component reimplements a card from scratch instead of using `GlassCard`," which needs either a review pass with the manifest in hand or a stricter structural rule).
- **Acceptance criteria:** A PR that introduces a hand-rolled equivalent of an existing manifest primitive (e.g., a new bespoke dropdown built from raw `<div>`s instead of the shared `Dropdown`/`Popover` component — the exact class of defect behind `BUG-03`/`BUG-27` in the first place) is flagged before merge, not discovered later by a person.
- **Depends on:** `DS-17`.

### 15.4 — Why documentation restructuring alone will not fully solve this

This document should be honest about a limit of its own recommendations, consistent with the research cited in §15.3: no `.md` file, however well-organized, single-sourced, or short, can *guarantee* a coding agent follows it — "context injection fails because it's optional. The AI can always ignore guidance." `MD-01` through `MD-04` fix the specific, confirmed problem of *disagreeing* instructions (which is unambiguously fixable — a repository either has one copy of a rule or it doesn't), but they cannot by themselves stop a capable, permissive agent from choosing to invent a new pattern anyway, the way `theme.ts` was renamed a third time in violation of an unambiguous, single, undisputed rule this pass. That failure was not caused by conflicting documentation — the rule was clear and existed in only the form that mattered. It was caused by the absence of any mechanism that would have *rejected* the change rather than merely having advised against it. `DS-15` through `DS-18` are this document's attempt at that mechanism for the design-consistency half of the user's complaint specifically; an equivalent mechanism for the broader "don't touch what the rules say not to touch" problem is a CI check (extendable from `INFRA-02`) that diffs a PR against the invariant list in `AGENTS.md` and fails automatically if one of the named protected files or values changed without an accompanying, explicit note in the PR description citing the approval — this is recorded here as a new ticket, `MD-05`, rather than left as a gap.

#### MD-05 — CI check for unauthorized changes to protected invariants

- **Priority:** High
- **Requirement:** Add a CI step that inspects the diff of every PR for changes to a short, explicit list of protected files/values (drawn from `AGENTS.md`'s hard-invariant list per `MD-03`: `env.ts`'s throw behavior, `ThemeId`'s literal values, the hover-sidebar CSS pattern in `Navigation.tsx`, the `createPortal` usage in `Dropdown.tsx`/`Popover.tsx`, `MotionProvider`'s `LazyMotion`/`strict` props, `RealtimeProvider`'s teardown-debounce constant) and fails the build unless the PR description contains an explicit acknowledgment string (e.g., a required `Invariant-change-approved-by:` line) — cheap to implement, and it converts "please don't do this" into "the build won't let you do this silently."
- **Acceptance criteria:** A PR that changes `ThemeId`'s literal union type without the required acknowledgment line in its description fails CI, regardless of which tool or agent authored the change.
- **Depends on:** `MD-03`, `INFRA-02`.

---

## 16. Addendum 5 — fifth-pass audit (29 new reports, screenshots, DB architecture, project hygiene)

This pass reviewed a new build (103 files changed since the last audited build — the largest single diff yet), 17 screenshots of live running spaces/panels, and 29 numbered reports. Findings below are grouped by evidence type, not by the user's original numbering, so similar defects aren't fixed twice under two different tickets. A cross-reference to the original item number is given in each ticket for traceability.

### 16.1 — Real, confirmed progress since the last pass (say this plainly, it's true)

Before the new defects: `TOOL-07` (content-visibility wiring) is fixed — `task-card-wrapper` is now applied to the actual `TaskCard` root. `TOOL-03`/`INFRA-09` (React Hook Form) is adopted in `SettingsModal`. `TOOL-15` (Floating UI) is adopted in `Dropdown.tsx` — it now uses `useFloating` with `flip`/`shift` middleware and a `FloatingPortal`, superseding the plain-portal approach and `BUG-27`'s regression risk at the positioning-library level. `BUG-15` (theme leak) is confirmed still fixed — sign-out clears all three theme `localStorage` keys. Item **#15's premise does not hold against this codebase**: `dismissInboxItem` (both the "×" button and the swipe-to-delete gesture) already calls `moveItemToTrashPatch()` from `item-lifecycle.ts` — dismissed inbox items are already routed to the global trash correctly, with a working undo. If this is still visibly wrong in the running app, it needs a fresh repro (exact steps, exact item) rather than a code fix, because the code path already does what was asked.

### 16.2 — New, code-confirmed defects

**BUG-29 — "New thread" silently fails (item #7)**

- **Priority:** Critical
- **Files:** `src/app/(app)/think/page.tsx`, `handleNewThread` (around line 122)
- **Root cause:** `handleNewThread` inserts a new row into `threads` with `color_accent: "var(--accent)"` — a **literal CSS variable reference string** written into a data column, not an actual color value. If `color_accent` has a format constraint (a `CHECK` constraint expecting a hex string, or any downstream code expecting to consume it as a real color), this insert can fail. Independent of that: the function's error handling is `if (!error && data) { router.push(...) }` — **if `error` is truthy, nothing happens at all**: no toast, no console signal a user could report, nothing. This exactly matches "clicking it does nothing." This is also a violation of this project's own established pattern — every other mutation in the app (dismiss, delete, capture) surfaces a `toast.error(...)` on failure; this one silently swallows it.
- **Requirement:** (1) Stop writing a CSS variable string as a data value — assign an actual resolved color (or, better, don't store a per-thread accent color at all if nothing currently reads it distinctly per-thread; check for dead-column risk here too). (2) Add the same `toast.error` treatment on failure that every other mutation in the app already uses.
- **Acceptance criteria:** Clicking "New thread" either navigates to the new thread's page or shows a visible error toast — never neither.

**BUG-30 — Settings autosave loops "Saving…" / "Saved" forever, including on simply opening Settings (item #23)**

- **Priority:** Critical
- **Files:** `src/components/features/SettingsModal.tsx` (the `watch()`/`useDebounce`/save `useEffect` chain, roughly lines 357–433)
- **Root cause:** The autosave effect is keyed on `debouncedSettings`, which is derived from `const settings = watch();` — an unscoped, whole-form `watch()` call. React Hook Form's `watch()` (used this way, not via `useWatch` with a memoized selector) returns a **new object reference on every render**, regardless of whether any field actually changed. The save effect calls `setUserSettings(debouncedSettings)` on success, which writes to the global Zustand store; anything subscribed to that store re-renders, which can re-render `SettingsModal` itself (it reads `userSettings`/store state elsewhere), which calls `watch()` again, producing another new object reference, which — after the next debounce cycle — is treated as "changed" by the effect's dependency array (objects compare by reference), firing the save effect again, with no actual field having changed. This reproduces exactly as described: it starts as soon as `initialLoaded` flips true (i.e., immediately after opening Settings, before any user edit) and never stops.
- **Requirement:** Gate the save effect on an actual-change signal, not object identity — react-hook-form's own recommended pattern for this is to check `formState.isDirty` / `dirtyFields`, or to deep-compare `debouncedSettings` against the last-successfully-saved snapshot before calling the update, and to reset `isDirty`/the snapshot after a successful save so the next unrelated render doesn't re-trigger it.
- **Acceptance criteria:** Opening Settings and making zero edits never shows more than the initial load — no repeating "Saving…"/"Saved" cycle. Making one edit shows exactly one save cycle, once, ~1 second after the edit (per the existing debounce), then goes idle.

**BUG-31 — Every long-option-list dropdown has no scroll container and no keyboard type-ahead, and can render off-position (items #10, #19, #20)**

- **Priority:** Critical — single root cause, affects every dropdown in the app, not just the ones named
- **Files:** `src/components/ui/Dropdown.tsx` (the `dropdown-panel` `m.div` in both the `chip` and `select` variant render paths)
- **Root cause:** The floating options panel has no `max-height` and no `overflow-y-auto` anywhere in the component. For a short option list (5–10 items) this is invisible; for the Timezone field specifically, `options` is the full `Intl.supportedValuesOf("timeZone")` list — several hundred entries — rendered as several hundred unconstrained `<button>` elements. Floating UI's `shift()`/`flip()` middleware (already correctly adopted, per §16.1) repositions the panel to try to keep it in view, but it cannot shrink an unconstrained-height panel to fit the viewport — for a panel this tall, the achievable "in view" position degenerates toward the top of the screen, which is the specific "appears in the top-left corner" symptom reported for the Color Mode and Timezone dropdowns. This is the same bug as the reported "can't scroll" complaint, not a second, separate one: there is nothing to scroll within, because the panel simply grows instead of scrolling.
- **Additionally confirmed:** no `onKeyDown` handler anywhere in `Dropdown.tsx` — there is no type-ahead-to-jump-to-option behavior, which is standard, expected behavior for any select-like control (native `<select>` has always done this; `Downshift`/Radix `Select`/Base UI `Select` all implement it).
- **Requirement:** (1) Add `max-height: min(320px, 60vh)` (or an equivalent token-based value) plus `overflow-y-auto` and `overscroll-contain` to the `dropdown-panel` class specifically for the `select` variant (the `chip` variant's typically-short option lists may not need this, but should get it too for consistency and future-proofing). (2) Add a keydown handler that buffers recently-typed printable characters for ~500ms and moves the highlighted/selected option to the first match, clearing the buffer after a pause — the standard type-ahead pattern.
- **Acceptance criteria:** The Timezone dropdown opens to a fixed, on-screen, scrollable panel (not growing to full list height), reachable via mouse wheel/touch scroll. Typing "Lon" while the Timezone dropdown is open jumps to "Europe/London" (or the nearest match) without opening a second search box. Every other dropdown in the app (verified: at minimum Color Mode, Density, and any other `Dropdown`/`variant="select"` consumer) is checked against this same fix, since it is a single shared component.

**BUG-32 — Sonner toast text is unreadable in light mode (item #22)**

- **Priority:** High
- **Files:** `src/components/ui/ToastProvider.tsx`
- **Root cause:** `<Toaster theme="system" ...>` binds Sonner's own internal color scheme to the **OS-level** `prefers-color-scheme` media query, completely independent of this app's own manual `data-mode` light/dark toggle (`theme.ts`/`applyDocumentTheme`). If a user's OS preference and their in-app selection disagree (OS set to dark, app manually set to Light, or vice versa), Sonner renders its own toast chrome (background) for one mode while the surrounding app — and this component's own `!text-[var(--text-1)]` override — is styled for the other, producing exactly the reported white-text-on-white (or equivalent) illegibility.
- **Requirement:** Bind Sonner's `theme` prop to the app's actual current color mode (read from the same store/`data-mode` attribute `AppInitializer`/`theme.ts` already manage), not the string literal `"system"`.
- **Acceptance criteria:** With the OS set to dark and the in-app mode manually set to Light (or the reverse), every toast variant (success/error/info) shows fully legible text against its background.

**BUG-33 — Explore's "Save to Explore" panel still uses a native `<input>` + `<datalist>` for Type (items #8, #12, #13)**

- **Priority:** High — this is `BUG-25`/`T0-13`, confirmed still unfixed in this build, now bundled with the user's related, larger request (#12, #13)
- **Files:** `src/components/features/ExploreDrawer.tsx` (lines ~238–258)
- **Root cause:** `Dropdown` is already imported and used elsewhere in this exact file (for linking a thread) — the Type field specifically was never migrated off the native `<input list="preset-explore-types">` + `<datalist>` pairing, which is why it visually doesn't match the rest of the app's dropdowns (native `<datalist>` styling is entirely browser-controlled and cannot be restyled with CSS, a documented platform limitation, not a bug that can be "fixed" by tweaking this markup — it must be replaced).
- **Requirement (also answers item #12, user-creatable types):** Replace the `<input>`+`<datalist>` with a **combobox variant of the existing `Dropdown`** — free-text entry that also shows a filtered list of existing preset/previously-used types, with an explicit "Create '<typed text>'" option when no exact match exists (this is the same pattern already correctly used for Explore's "link a thread" field and for Do's category picker — reuse it, this is not a new pattern, this is `BUG-31`'s type-ahead requirement plus free-entry). New types created this way are simply new distinct string values in the `type` column — no new schema needed, matching how Do's `category` field already works (per `AddTaskPanel`'s "+ Add new category" affordance visible in the screenshots), which is the consistency reference item #12 explicitly asked to check against.
- **Acceptance criteria:** The Type field visually matches every other dropdown/combobox in the app. Typing a type name not in the preset list and confirming creates and immediately selects it, without a page reload, and it persists as an available option for future saves.

### 16.3 — Screenshot-evidenced consistency defects (design system, not logic)

These are visible directly in the ten space/panel screenshots provided and confirm the exact pattern this document's `DESIGN_SYSTEM.md` (delivered in the previous pass) was written to prevent — the fact that they're this widespread despite that document already existing means the document alone hasn't been applied yet, not that it was wrong.

**DS-19 — Sidebar spacing/alignment still off despite the hover mechanism working (item #1)**

- **Priority:** High
- **Evidence:** Screenshot 1 (expanded sidebar). The brand row's icon-to-label gap, the nav items' icon-to-label gap, and the bottom account row's avatar-to-name gap are all visually different distances in the same screenshot — exactly the three-different-padding-formula defect this document's earlier pass (`BUG-14`) diagnosed with exact pixel math for the *collapsed* rail; this confirms the same inconsistency persists in the *expanded* state too, meaning the fix that landed (if any) only addressed one of the two states.
- **Requirement:** Apply `DESIGN_SYSTEM.md`'s existing rule — one shared icon-box formula, used identically by the brand row, every nav item, and the account row, in both collapsed and expanded states — verified in both states, not just one.

**DS-20 — Per-space colors are applied in only two places and don't read as a coherent feature (item #2)**

- **Priority:** Medium — this is a product question as much as a bug; **treat as `CONF-13`, do not just silently implement one option**
- **Verified:** `grep` confirms `--space-*` tokens are consumed in exactly two component files app-wide: `Badge.tsx` and `TaskCard.tsx`. They are not applied to `PageHeader`'s space icon, not to the sidebar's active-item indicator beyond a single shared accent, and not anywhere else — which is exactly why the user can't find where this feature is "supposed" to show up: it barely shows up anywhere, so it reads as arbitrary rather than as a system.
- **Conflict `CONF-13`:** two legitimate paths forward, and this document does not choose: **(a)** commit to the feature fully — apply each space's color to that space's `PageHeader` icon, its sidebar nav icon (in its active state), and its badges everywhere an item is tagged with its origin space (Home feed, global Trash) — so the four colors actually read as a wayfinding system; or **(b)** the user's own instinct in the report ("is this feature actually necessary?") is correct — retire the per-space color concept entirely, keep the single warm `--accent` for all in-space actions, and reserve color-coding only for `--status-*` (which already has clear, established meaning: overdue/today/upcoming/done). Given `--space-*`'s current near-total invisibility, option (b) is the lower-effort, arguably more honest choice unless there's a specific product reason to keep pursuing (a). **This requires the user's decision before any further `DS-01`-adjacent work.**

**DS-21 — Pomodoro launcher icon missing (item #3)**

- **Priority:** High
- **Verified:** `PomodoroTimer.tsx` correctly imports and uses `Play`/`Pause`/`SkipForward`/`Square`/`Timer` from `lucide-react`, and is mounted once, globally, via `DynamicModals.tsx`. The component's own icon usage looks intact from source alone — this means the reported disappearance is most likely either (a) a conditional-render gate around the component or its trigger button that's now false when it used to be true (check `activeTimer`/visibility conditions), or (b) the trigger to *open* the Pomodoro UI (likely a button on `TaskCard`, visible as the small circular play icon in screenshot 3) losing its icon specifically, which is a different file (`TaskCard.tsx`) than the timer overlay itself. **This needs a live-app screenshot of exactly where the missing icon should be** (the floating global timer widget vs. the per-task inline play button) before a fix can be scoped precisely — flagging as unresolved-pending-clarification rather than guessing.

**DS-22 — Task cards are compact/cramped with awkward internal spacing (item #4)**

- **Priority:** High
- **Evidence:** Screenshot 3. The first card ("do ERP problems") has a large empty band between its content and its bottom edge with only a lone play button floating in it; the second and third cards have that same band filled with a timer chip or avatar stack, producing three cards of visibly different internal densities for what should be one consistent template. This reads as a card whose height is being driven by its *tallest sibling's* optional content (time estimate chip, linked-people avatars, subtask progress bar) via a shared grid row height or `align-items: stretch`, rather than each card sizing to its own content with consistent internal padding.
- **Requirement:** `TaskCard`'s internal layout should size to its own content (`align-items: start` if it's a grid/flex child, not `stretch`) with a single consistent padding scale regardless of which optional elements (time chip, avatars, subtask bar) are present — a card with no optional metadata should be visibly shorter than one with three lines of metadata, not padded out to match it.

**DS-23 — People vs. Locations rows use different card treatments and spacing within the same space (item #5)**

- **Priority:** Critical — the user's clearest single example of the cross-cutting consistency problem
- **Evidence:** Screenshots 4 and 5, both `Remember`. People rows (screenshot 5): avatar + name + relationship badge, tight vertical rhythm, a drag-handle on the left. Locations rows (screenshot 4): icon-in-a-box + item name + description line, visibly more vertical padding per row, no drag handle, different left-edge treatment. These are two different list-row templates for what `DESIGN_SYSTEM.md` §6.6 already specifies as "both share one add panel pattern" — the same section should have specified (and now does, see the update below) that they share one **row** template too, varying only the leading glyph (avatar vs. icon) and trailing content (badge vs. timestamp).
- **Requirement:** One shared list-row component (call it `EntityRow` or extend the existing row primitive used for People) taking a leading-element slot (avatar or icon-in-circle, same circle size either way), a title, a subtitle, and a trailing-element slot (badge or timestamp), used by both People and Locations with identical padding/rhythm. This is now the canonical pattern documented in `DESIGN_SYSTEM.md` §6.6 (updated below) — this ticket is that pattern's enforcement.
- **This is also the clearest evidence yet for why `DS-17`/`DS-18` (component manifest + automated design-system check) matter**: this specific divergence is exactly the kind of thing a prose design system doc can state clearly and still have missed in practice, because nothing currently checks a new list-row against the manifest before it ships.

**DS-24 — "Show Archive" control styled differently per space (item #17)**

- **Priority:** Medium
- **Evidence:** Screenshot 3 (Do: a pill-shaped secondary button reading "Show Archive" inline with the view switcher) vs. screenshot 7 (Explore: "Archive" is a tab alongside "Active"/"Trash", not a toggle button at all). These are two different **interaction models** for a conceptually similar "see the stuff I've hidden" affordance, not just two different visual skins of the same control.
- **Requirement:** Decide one canonical model — this document recommends the Explore tab model (Active / Archive / Trash as peer tabs) over the Do toggle-button model, since Think already independently arrived at the same three-tab pattern (screenshot 6: "Active / Archive / Trash") without being asked to — two of three spaces already converged on it independently, which is a strong signal it's the more natural fit; migrate Do's Board/Today/Calendar-adjacent "Show Archive" toggle to a fourth tab (or a consistent per-space tab row separate from the view switcher) to match.

**DS-25 — Only Inbox shows its own space icon inside the page body; every other space omits it (item #18)**

- **Priority:** Medium
- **Evidence:** Screenshot 8 (Inbox: a small inbox-tray icon sits directly next to the "Inbox" page title). Screenshots 3, 4, 6, 7 (Do, Remember, Think, Explore): the page title text appears alone, no icon. This is a direct, visible violation of `DESIGN_SYSTEM.md` §6.1's `PageHeader` spec ("space icon... + page title"), suggesting `PageHeader` was adopted with its icon slot present but only actually populated for Inbox's call site.
- **Requirement:** Pass and render the space icon at every `PageHeader` call site, not just Inbox's — this is a one-line-per-page-fix once identified, not a design decision.

**DS-26 — Sidebar brand mark is a plain colored circle (item #24)**

- **Priority:** Low — a legitimate polish request, not a defect
- **Requirement:** Design (or commission) an actual mark for "Presense" distinct from a flat circle — something that can render legibly at both the 24–28px sidebar scale and favicon scale, using the app's own `--accent` family rather than an arbitrary new color, consistent with `DESIGN_SYSTEM.md` §1's rule that any new color decision routes through the existing token set rather than introducing a one-off.

**DS-27 — Keyboard shortcut hint for Quick Capture needs a deliberate placement decision (item #25)**

- **Priority:** Low
- **Requirement:** Per current pattern-usage across comparable tools, a persistent, subtle `Cmd+K`-style hint (as small `text-caption`-styled text at the trigger's trailing edge, using the already-planned `Kbd` primitive from this document's earlier `DS-10`) is the more discoverable and more consistent choice versus a hover-only tooltip, since a hover tooltip is invisible on touch devices entirely (§8.6's "hover is an enhancement, not a dependency" rule) — use the persistent small-text treatment, not a tooltip, for this specific case.

### 16.4 — Product/decision items (new conflicts — this document does not silently answer these)

**CONF-14 — What are "Quiet Hours," "Evening Shutdown/Morning Nudge," and "Density," and does the app need all three concepts plus Timezone as separate settings? (items #11, #21)**

- **Issue:** The settings screenshots and code both show four distinct time-based concepts (Quiet Start/End, Morning Nudge, Evening Shutdown) whose names don't make their relationship to each other legible, plus a Timezone field and a Density field, none of which are explained in-product. This is a real product-clarity problem, not just a visual one — comparable focus/planning tools (the kind this app is positioned against) typically expose *one* "quiet hours" concept (a do-not-disturb window) and *one* ritual-timing concept (when the morning/evening prompts fire), not four overlapping time fields.
- **This document does not resolve this** — it requires the user's own decision on which concepts are actually wanted, since collapsing or renaming them is a product-scope call, not a bug fix. Recommended next step: write one sentence, in the user's own words, for what each of the four time fields is supposed to control, then check whether any two sentences describe the same thing — the ones that do should merge.
- **Timezone specifically:** likely genuinely needed (it's what lets "Evening Shutdown at 6 PM" mean the correct wall-clock time regardless of where the user is), but it does belong under the same "why do I need to know this exists" scrutiny as #11 — consider auto-detecting it silently from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and only surfacing a manual override for the rare case someone travels, rather than presenting it as a primary, always-visible setting.

**CONF-15 — Capture routing should offer more than Do/Inbox and should let the user correct a wrong guess in place (item #14)**

- **Issue:** current `capture-router.ts` routes to a narrower set of destinations than the five-destination "Route it" menu the Inbox screen itself already offers (Do / Think / Explore / Remember-Person / Locations, per screenshot 2). If Quick Capture's automatic routing only ever resolves to Do or Inbox in practice, that's a gap between the router's actual coverage and the full destination set the rest of the app already supports.
- **Requirement:** Quick Capture's result view must show the routed destination as an editable choice — the same five-option destination picker Inbox's "Route it" menu already uses (reuse it, don't rebuild it) — so a wrong guess is corrected with one click rather than requiring the user to dismiss and manually re-route from Inbox after the fact. This is consistent with this document's existing `INT-03` ticket (surfacing the router's rationale) — implement together.
- **This document does not redesign the NLP rules themselves here** — that's `capture-router.ts`'s existing logic, already covered by `BUG-09`'s performance fix; this ticket is specifically about the destination set and correction affordance being incomplete relative to what the rest of the app already supports.

**CONF-16 — "Save to Explore" panel fields (item #13)** — folded into `BUG-33` above; no separate ticket needed.

### 16.5 — Database architecture (item #26)

This document's method throughout has been to cite current, authoritative sources rather than generic advice — the following is drawn directly from Supabase's own current documentation (RLS guide, RLS performance guide) and cross-checked against `MakerKit`'s production-pattern writeup, not a general "best practices" list.

**INFRA-15 — Wrap `auth.uid()` (and any other per-row function call) in RLS policies with `(select ...)`**

- **Priority:** Critical
- **Root cause / citation:** Supabase's own RLS performance documentation demonstrates that an RLS policy written as `auth.uid() = user_id` re-evaluates `auth.uid()` **once per row scanned**, while rewriting the identical policy as `(select auth.uid()) = user_id` lets Postgres cache the result via a single `initPlan`, since a function's result wrapped this way is treated as row-independent — Supabase's own documented benchmark shows over 100x improvement on large tables from this rewrite alone.
- **Requirement:** Audit every RLS policy across all `supabase/migrations/*.sql` files (26 migration files currently) for a bare `auth.uid()`/`auth.jwt()` call inside a `USING`/`WITH CHECK` clause and rewrite each as `(select auth.uid())`. This is a pure performance migration — it must not change what any policy actually permits, only how cheaply Postgres evaluates it. Write it as a new migration (`ALTER POLICY` per table, or drop-and-recreate each policy with the corrected expression) — never edit an already-applied migration file in place.
- **Acceptance criteria:** `EXPLAIN ANALYZE` on a representative query against the largest table (`items`, given it holds the most rows across the app's five entity types) shows a lower planning/execution cost after the rewrite; the query returns identical row sets before and after (a policy behavior regression test, not just a performance one).

**INFRA-16 — Split any `FOR ALL` RLS policy into four separate SELECT/INSERT/UPDATE/DELETE policies**

- **Priority:** High
- **Citation:** Supabase's own current guidance states plainly not to use `FOR ALL`, splitting into four operation-scoped policies instead, because it lets Postgres's planner optimize index usage per operation rather than evaluating one broader, less-optimizable expression for every query type.
- **Requirement:** Audit the 26 migration files for any `FOR ALL` policy and replace it with four explicit policies. Note Supabase's own documented gotcha here: an `UPDATE` policy requires a corresponding `SELECT` policy to exist, because Postgres must be able to read the pre-update row to evaluate the `USING` clause — verify this pairing exists for every table once split.
- **Acceptance criteria:** No `FOR ALL` remains in any RLS policy; `UPDATE` and `DELETE` policies are confirmed to have a paired `SELECT` policy on the same table.

**INFRA-17 — Add explicit indexes on every column used in an RLS policy, and confirm this table-by-table**

- **Priority:** Critical
- **Citation:** Supabase's own guidance: "make sure you've added indexes on any columns used within the Policies which are not already indexed" — this is listed as the highest-impact of their documented recommendations.
- **Requirement:** For each of the five entity tables (`items`, `people`, `threads`, `explores`, `locations`) plus `user_settings`, confirm a btree index exists on `user_id` (the column virtually every policy in this app filters on) — this is likely already covered by each table's primary key/foreign key setup but must be verified, not assumed, per table.
- **Acceptance criteria:** `\d+ <table>` (or the equivalent Supabase Studio index view) shows an index on `user_id` for every one of the six tables.
- **This ticket subsumes and sharpens `INFRA-10`** (the previously-written, more general RLS completeness audit) — treat `INFRA-15`–`INFRA-17` as `INFRA-10`'s concrete execution plan, not three new, separate audits.

**INFRA-18 — Client-side `.eq('user_id', userId)` alongside RLS, not instead of it**

- **Priority:** Medium
- **Citation:** Supabase's own guidance recommends adding the explicit client-side filter in addition to relying on RLS, because it lets the query planner use the `user_id` index directly rather than only via the policy's implicit filter — a small, low-risk addition with a measurable planner benefit per Supabase's own documented examples.
- **Requirement:** Audit the main list-fetching queries (Do's task list, Think's thread list, Explore's item list, People, Locations) for whether they already include this explicit filter; add it where missing. This does not change the security model (RLS still enforces the boundary regardless) — it's a query-planning optimization only.
- **Acceptance criteria:** Every primary list query in the app includes an explicit `user_id` filter matching the current session's user, verified against `EXPLAIN ANALYZE` output showing index usage rather than a sequential scan.

**INFRA-19 — One settled status/lifecycle vocabulary, documented once, referenced everywhere (extends `BUG-08`)**

- **Priority:** Critical
- **Root cause:** item #26's broader "what is being stored, updated, and managed" concern is best addressed structurally, not just per-table: `item-lifecycle.ts` already exists and is a good start, but this document has not yet verified it is the *only* place that writes a status transition for any of the five entity tables (the `BUG-29`/New-Thread finding above shows at least one insert path bypassing it entirely, writing ad hoc fields directly). A comprehensive schema document — table name, every status value it accepts, what triggers each transition, and which single function in `item-lifecycle.ts` is responsible for writing it — should exist once, in `docs/project/ARCHITECTURE.md` or a new `docs/project/DATA_MODEL.md`, and every insert/update call site across the app should be checked against it.
- **Acceptance criteria:** A table exists (one row per entity table) listing every valid status value and the exact function that transitions to it; `grep`-ing for direct `.update({status: ...})` or `.insert({status: ...})` calls outside `item-lifecycle.ts` returns zero results — every status write goes through the shared module, with no per-page ad hoc status literal.
- **Depends on:** `BUG-08` (already tracked).

### 16.6 — Project and repository hygiene (item #28)

**MD-06 — Repository cleanup pass**

- **Priority:** Medium
- **Requirement:** Following `MD-01`/`MD-02`'s already-established consolidation plan (one copy per doc, `plan.md` retired): audit the working tree and git history for (a) stray build artifacts or IDE-specific folders committed by mistake (check for a `.antigravity`/`.vscode`/similar directory beyond what's genuinely meant to be shared team config), (b) orphaned one-off scripts or debug routes (this document's earlier passes already flagged a `verify-db` style route as a candidate for deletion in past audits — confirm its current status), (c) `.gitignore` completeness (ensure `.env*` variants beyond `.env.example`, `node_modules`, and build output are all excluded — this overlaps with `INFRA-11`'s secrets-scanning ticket, coordinate rather than duplicate), and (d) a consistent branch/commit-message convention going forward, matching whatever `AGENT_RULES.md`/`AGENTS.md` already specify for commit format, applied retroactively as a policy for all future commits (not a history rewrite — do not force-push over shared history).
- **Acceptance criteria:** A single cleanup PR (or, given `EXECUTION_RULES.md`'s "no more than 5 files per ticket" rule, a short, explicitly-scoped sequence of small PRs) removes confirmed-dead files, tightens `.gitignore`, and leaves a short `docs/agents/CLEANUP_LOG.md` noting what was removed and why, so nothing is deleted silently per this document's own "never delete what you don't understand" rule.
- **Depends on:** `MD-01`, `MD-02`.

### 16.7 — Design system doc updates (apply directly to `DESIGN_SYSTEM.md`)

Two corrections to the file already delivered, based on this pass's findings:

1. §6.6 (Remember: People and Locations) should be strengthened from "share one add panel pattern" to explicitly require one shared **list-row** component as well — see `DS-23` above; update that section's text to name the shared row component once it exists.
2. A new short subsection should be added under §6 general rules: **"Show Archive / Trash is always a tab, never a toggle button"** — per `DS-24`'s finding that two of three spaces already converged on the tab pattern independently; this should be written down now so it stops being rediscovered per-space.

---

## 17. Addendum 6 — correction on #15, domain-grounded conflict resolutions, and a full ticket-status sweep

### 17.1 — Correction: #15 is a real, distinct bug — my prior "already fixed" claim was wrong

Direct re-investigation, prompted by the user reporting the item still disappears without landing in trash, found the actual defect. It is not in `moveItemToTrashPatch()` or in which function gets called — both of those are correct. It is here:

**BUG-34 — `dismissInboxItem` never checks the Supabase response for an error, so a failed database update is reported to the user as a success**

- **Priority:** Critical
- **Files:** `src/app/(app)/inbox/page.tsx`, `dismissInboxItem` (and its swipe-gesture caller, `handleDragEnd`, which calls the same function)
- **Root cause, confirmed by direct code reading:** The function's sequence is: (1) synchronously and unconditionally remove the item from the local React Query cache (`queryClient.setQueryData`, filtering it out) — this happens before any network request and is why the row visually disappears from Inbox instantly, every time, regardless of what happens next; (2) `await supabase.from("items").update(moveItemToTrashPatch()).eq("id", id);` — **the resolved value of this call, `{ data, error }`, is never destructured or inspected.** Supabase-js does not throw a JavaScript exception on a database-level error (a rejected RLS check, a constraint violation, anything Postgres itself refuses) — it resolves normally with an `error` object populated and `data: null`. The surrounding `try { ... } catch { ... }` only catches an actual thrown exception (a network failure, a client-side crash) — a populated `error` field on an otherwise-successful HTTP response is not caught by this `catch` block at all. The code proceeds straight to `toast.success("Dismissed", ...)` regardless of whether the row was actually updated.
- **Consequence:** if the underlying update ever fails for any reason — and confirming or ruling out a specific server-side cause requires live Supabase logs, which this static review cannot access — the user sees the item vanish from Inbox, sees a "Dismissed" success toast, and the row's `status` in the database never actually changes to `'deleted'`. It is not in Inbox (removed from the client cache) and not in Trash (its `status` was never written), because the query cache was already told it's gone. This is exactly the symptom reported.
- **Requirement:** (1) Check `error` on every Supabase mutation result in this function (and audit the rest of `inbox/page.tsx` for the same pattern — the routing-to-a-destination code paths reviewed in an earlier pass call `.delete()` directly and should be checked the same way). (2) On a populated `error`, roll back the optimistic cache removal (re-insert the item, exactly as the existing "Undo" handler already knows how to do — reuse that logic rather than writing a second rollback path) and show `toast.error` with the actual error message, not a generic string, so the next occurrence is diagnosable instead of silent. (3) Once error surfacing is in place, reproduce the dismiss action once in the live app and read whatever error message appears — that message will identify the true underlying cause (RLS, a trigger, a constraint) precisely, which this static review cannot determine with certainty from migration files alone.
- **Acceptance criteria:** Dismissing an inbox item either (a) results in the item appearing in `/trash` with a `deleted_at` timestamp, confirmed by actually checking the trash page after dismissing, not just by the absence of an error — or (b) shows a visible, specific error toast and restores the item to the Inbox view. Silently disappearing into neither state is no longer possible.
- **This supersedes the §16.1 note that treated #15 as already correct.** That note is wrong and is retracted by this entry.

- **RESOLVED (Aug 10, 2026)** — full fix, verified end-to-end against live production:
  - **Code:** `dismissInboxItem`'s error check + cache rollback (`a2ce54e`), `safeMutate` adoption (`fd7cb3f`), Undo path (`a3a037e`), and the routing-to-destination branches now check `safeMutate`'s result on the trash-original step, deleting the just-created destination row and throwing on failure so the cache rollback + `toast.error` fire (`a198af9`). `inbox/page.tsx` now has **zero unchecked mutations** (verified site-by-site).
  - **Requirement 3's answer (the real root cause):** reproducing the dismiss live surfaced **HTTP 400 `23514 … violates check constraint "items_status_check"`** — the live database's constraint was the pre-005 version (`'active','done','overdue','archived','inbox'`), i.e. **`supabase/migrations/005_fix_constraints_and_security.sql` was never applied to the live Supabase project** (the direct IPv6 endpoint also being refused hinted at a production DB that had never been migrated via the CLI). The UI showed the item vanish + a "Dismissed" toast only because of the optimistic cache removal; the row stayed `inbox` forever. This also silently broke the routing branches' trash step for the same reason.
  - **DB fix applied live (Aug 10, 2026, human-approved):** migration 005's eight statements run against the production DB via `supabase db query --db-url` (session pooler) — `items`/`explores`/`threads` status checks + the two `user_settings` defaults. `people`/`locations` status checks (migration `20260704120000`) were confirmed already correct live.
  - **Verification:** direct PATCH `{"status":"deleted"}` (the previously-failing call) now returns 204; seeded item dismissed from the live UI (Playwright) → toast "Dismissed", row `status=deleted`, item present on `/trash`. Test artifacts and seeded row removed afterwards. Full suite 144/144.
  - **Remaining recommendation (not ticketed):** migrate production DBs via the CLI (`supabase db push`) or at minimum verify `supabase_migrations.schema_migrations` vs `supabase/migrations/` after any manual application, so drift like this cannot recur undetected.

### 17.2 — Conflict resolutions, grounded in this domain specifically

Every conflict below was researched against this app's own explicit points of reference (Sunsama, since `CLAUDE.md`/`ARCHITECTURE.md` already direct this project to study it specifically for its ritual system) and the closest comparable personal task/productivity tools (Todoist, Things 3), rather than generic software-design opinion. Each resolution states the specific evidence it's based on, not just a preference.

**CONF-06 — Cmd+K: capture vs. command palette → RESOLVED, in favor of the remap**

- **Evidence:** Sunsama — the app this project's own documentation already names as its ritual-system reference — uses Cmd+K/Ctrl+K specifically for a command palette (documented in Sunsama's own help center: "Access sorting via the Command Palette (Cmd K or Ctrl K)"), not for task capture. This is not a generic industry convention argument (Linear, Raycast, Notion were the examples used the first time this conflict was raised) — it's the direct, named domain reference this project has already chosen to model itself after, doing the same thing.
- **Resolution:** Remap `Cmd+K` to a command palette (`DS-08`), move Quick Capture to `Cmd+Shift+K` or an equivalent secondary binding, and add a `?`-triggered shortcuts overlay (`INT-05`) so the remap is discoverable rather than silently breaking existing muscle memory. Implement `DS-08` now — it is no longer blocked.

**CONF-02 / CONF-13 — Per-space colors → RESOLVED, in favor of keeping them, applied consistently everywhere**

- **Evidence:** Every comparable tool in this domain that supports multiple lists/projects colors them consistently and pervasively — the color appears on the project's icon, its row/badge wherever it's referenced from another view, and its sidebar entry, not in one or two isolated spots. The problem this document flagged in the previous pass (`--space-*` tokens used in only two component files, `Badge.tsx` and `TaskCard.tsx`) is not evidence the *concept* is wrong for this domain — every domain comparator does exactly this — it's evidence the *execution* is incomplete.
- **Resolution:** Keep per-space colors. Apply them consistently: each space's `PageHeader` icon (currently rendering without its color, see `DS-25`), the sidebar's active-nav-item state, and every cross-space reference to an item (the global Trash list, Home's summary cards) all use that item's origin-space color. Do this as one pass, not as scattered follow-ups, since a partially-applied color system is what created the "where does this even show up" complaint in the first place.

**CONF-08 — Calendar: patch vs. rewrite → RESOLVED, in favor of a rewrite**

- **Evidence:** Sunsama's core differentiator, and the reason this project's own documentation points to it, is a unified task+calendar view with real time-blocking — the calendar is not a peripheral view in this domain's leading reference point, it is close to the product's center of gravity. A structurally fragile, flexbox-based calendar (the header/grid desync defect already diagnosed in this document's `BUG-05`) is not an acceptable foundation for a surface this central to the domain's own best-in-class example.
- **Resolution:** Proceed with the CSS-Grid-based rewrite already scoped under `CONF-08`'s original text and `BUG-05`/`MOB-02`. Close `BUG-05`/`MOB-02` as "superseded by rewrite" once the rewrite ships, per this document's own existing instruction for that outcome.

**CONF-10 — Global trash vs. per-space trash → RESOLVED, in favor of the global trash already built**

- **Evidence:** this is less a "domain of personal productivity apps" question than a broader platform-convention one, and the broader convention is unambiguous: system-level personal-data apps (Mail, Notes, Photos, Files, across both major desktop/mobile platforms) use exactly one trash per app, never one per folder/project, specifically because a user recalling "I deleted something, where did it go" should only ever have one place to look. A global trash is also simply what already exists and works in this codebase (confirmed built, at `/trash`, in the pass that reviewed this build).
- **Resolution:** Keep and complete the global trash (already the direction `BUG-08`'s tickets were written in) — no change needed here beyond finishing its coverage of all five entity types, which is already tracked.

**CONF-05 / CONF-11 — Base UI vs. shadcn → RESOLVED, in favor of shadcn (no domain research needed — this is a pure tooling decision)**

- **Evidence:** shadcn is the de facto default for exactly this stack (Next.js + Tailwind, React 19) as of 2026, and it is a thin, ownable wrapper around Base UI rather than a competing runtime — adopting it does not mean discarding Base UI, it means not also hand-rolling a second, parallel usage of the same underlying primitives. Direct inspection of this build shows no bare `@base-ui/react` imports outside `src/components/ui/` already — the redundancy this conflict originally worried about does not appear to exist in practice; this conflict can be marked resolved and closed without further action.

**CONF-14 — Settings declutter: Quiet Hours / Morning Nudge / Evening Shutdown / Timezone → RESOLVED, in favor of collapsing to two concepts plus silent timezone detection**

- **Evidence:** Sunsama's own ritual system — again, this project's explicit reference point — has exactly two named time concepts: a morning planning ritual and an end-of-day shutdown review. It does not expose a separate "Quiet Hours" setting distinct from those two; "quiet hours" as a standalone concept is a notification/do-not-disturb feature that, across virtually every current consumer app, is deferred to the operating system's own notification settings rather than reimplemented per-app.
- **Resolution:** Collapse to two settings — morning ritual time, evening ritual time — matching `rituals.ts`'s own two-ritual model exactly (the settings surface should mirror the code's actual mental model, not add a third and fourth axis the code doesn't otherwise reason about). Remove "Quiet Hours" as a distinct in-app setting; if push notifications are ever added, respect the OS-level DND/Focus state rather than building a parallel one. Auto-detect Timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone` and only surface it as an editable field inside an "Advanced" or rarely-visited section, not alongside the primary ritual-time settings.

### 17.3 — The full ticket-status sweep, as requested

This is a direct answer to "did you check everything already in the spec." The honest answer: **every ticket that can be verified by reading source code was re-checked against the current build in this pass; tickets that require manual/runtime testing (most of `A11Y-*`, `MOB-*`'s gesture-feel items, and anything needing a real device or screen reader) cannot be verified this way and are marked accordingly below rather than guessed at.** No ticket was left unexamined — the table states what was found for each one, including "cannot verify statically."

| Ticket | Status | Evidence |
|---|---|---|
| `BUG-01` hover sidebar | **DONE** | Confirmed in prior pass, unchanged. |
| `BUG-02` ritual stale clock | Superseded by `BUG-16`/`BUG-17` (rituals.ts rewrite) | See below. |
| `BUG-03` / `BUG-27` dropdown clipping | **DONE**, now on Floating UI | `Dropdown.tsx` uses `useFloating`+`FloatingPortal`. |
| `BUG-04` / `BUG-24` empty-state button targets | **NOT RE-VERIFIED this pass for Think/Explore/Remember specifically** — flagged, needs a dedicated check next pass | |
| `BUG-05` / `CONF-08` calendar | **NOT DONE** — conflict now resolved (rewrite); work not yet started as of this build | |
| `BUG-06`/`BUG-07` theme naming | **DONE** | `warm`/`navy`/`forest`, confirmed settled per the user's own correction that this was their deliberate choice. |
| `BUG-08` archive/delete unification | **PARTIAL** | `item-lifecycle.ts` exists and is used by most call sites checked (`dismissInboxItem`'s *target* function is correct even though its *error handling* isn't, per `BUG-34`); `BUG-29`'s New Thread insert shows at least one write path that bypasses it entirely. Not yet a guaranteed single path everywhere — `INFRA-19` tracks closing this gap for good. |
| `BUG-09`/`PERF-02` capture-router dynamic import | **DONE** (confirmed two passes ago, not re-diffed this pass — low risk of regression, but not re-confirmed either) | |
| `BUG-10` sidebar profile fallback | **DONE** | |
| `BUG-11` Settings scroll on Think/Explore | **DONE** | `useBodyScrollLock` + Lenis `dataset.overlayOpen` check, confirmed correct two passes ago. |
| `BUG-14`/`DS-19` icon alignment (collapsed + expanded) | **NOT DONE** | Screenshot evidence this pass shows it in the expanded state too. |
| `BUG-15` theme leak via localStorage | **DONE** | |
| `BUG-16`/`BUG-17` ritual split-brain / morningDone guard | **DONE** | `rituals.ts` has the guard; confirm `Navigation.tsx` reads the same source (not re-diffed this exact pass, previously confirmed it did not — needs one more check). |
| `BUG-18` ritual completion persistence | **DONE** | |
| `BUG-19` Settings stale closure | **DONE** | |
| `BUG-20` onboarding capture status | **DONE** | |
| `BUG-21` onboarding background hardcoded colors | **UNVERIFIED** — flagged as needing confirmation before assuming either way | |
| `BUG-22` DB default theme | **DONE** | |
| `BUG-23` page transitions | **UNVERIFIED this pass** | |
| `BUG-25`/`BUG-33` Explore Type native datalist | **NOT DONE**, confirmed again this pass | |
| `BUG-26` TaskAddPanel chrono static import | **DONE** | |
| `BUG-29` New Thread silent failure | **NOT DONE** (new this pass) | |
| `BUG-30` Settings autosave loop | **NOT DONE** (new this pass) | |
| `BUG-31` Dropdown scroll/position/type-ahead | **NOT DONE** (new this pass) | |
| `BUG-32` Sonner theme binding | **NOT DONE** (new this pass) | |
| `BUG-34` Inbox dismiss error swallowing | **DONE** (Aug 10, 2026) | Code fix `a198af9` (+ `a2ce54e`/`fd7cb3f`/`a3a037e`); root cause was migration 005 never applied live → `items_status_check` rejected `'deleted'`; constraint fixed on production; verified end-to-end. See ticket for full write-up. |
| `DS-01` space colors distinct | **DONE** (values) / **PARTIAL** (application breadth — see `CONF-13`'s resolution) | |
| `DS-02` hardcoded hex removal | **NOT DONE — 96 occurrences remain**, more than the prior pass's count, meaning new code is still introducing them faster than old ones are being migrated | |
| `DS-03` raw `<input>` migration | **NOT DONE — 14 remain** | |
| `DS-04` `TextareaAutosize` migration | **NOT DONE — 6 remain** | |
| `DS-05` `SearchInput` adoption | **NOT DONE — 0 adoptions**, component still unused everywhere | |
| `DS-06` icon strokeWidth standardization | **PARTIAL** — 53 of a sample using the correct `1.5`, but `0`, `1.7`, `1.8`, `2`, `2.5`, and conditional values still scattered | |
| `DS-07` `PageHeader`/`EmptyState` adoption | **DONE** (confirmed prior pass) | |
| `DS-08` command palette | **Unblocked as of `CONF-06`'s resolution above — not yet started** | |
| `DS-09` 44px touch targets | **NOT DONE** — no `--touch-target`/equivalent utility found wired into `button.tsx`, `Sheet.tsx`, `TaskCard.tsx`, or `PomodoroTimer.tsx` | |
| `DS-14` reduced-motion/transparency | **NOT RE-VERIFIED this pass** | |
| `DS-15`–`DS-18` (locked Tailwind theme, ESLint enforcement, component manifest, design-system-check) | **NOT DONE** — none of these have concrete evidence of implementation yet (no ESLint Tailwind plugin found in a prior `package.json` check, no `data-density`-style theme lock confirmed) | |
| `MD-01`/`MD-02` doc consolidation | **MOSTLY DONE** — `plan.md` is gone (confirmed, `MD-02` complete); `PROJECT.md` consolidated to one copy; **`ARCHITECTURE.md` still exists in two places** (root and `docs/project/`) — this one file's duplication was missed | |
| `PERF-01` `useCallback` on Do handlers | **DONE** (confirmed two passes ago) | |
| `PERF-03` ambient orb mobile cap / visibility pause | **NOT DONE** | |
| `PERF-04`/`PERF-08` backdrop-filter reduction | **NOT RE-VERIFIED this pass** | |
| `PERF-05`/`PERF-07` `refetchOnWindowFocus` | **DONE** (confirmed two passes ago) | |
| `INFRA-15` wrap `auth.uid()` in `(select ...)` | **NOT DONE — 26 bare `auth.uid()` calls remain, 0 wrapped** | |
| `INFRA-16` split `FOR ALL` policies | **NOT DONE — 12 `FOR ALL` policies remain** | |
| `TOOL-01` typed Supabase client | **NOT RE-VERIFIED this pass** — check for `database.types.ts` next pass | |
| `TOOL-02`/`CONF-12` `@t3-oss/env-nextjs` without throwing | **DONE, and done correctly** | `env.ts` uses `.catch()` per-field with an explicit comment citing this project's own invariant — confirmed non-throwing. |
| `TOOL-03` React Hook Form | **DONE** in `SettingsModal`; **not confirmed in `TaskAddPanel`/`AddPersonPanel`/`LocationAddPanel`** — check next pass | |
| `TOOL-04`/`nuqs` | Package installed; **usage not yet confirmed in `do/page.tsx`'s view-mode state** — check next pass | |
| `TOOL-05` structured logging | **NOT RE-VERIFIED** | |
| `TOOL-06`/`INFRA-01` Sentry | **NOT DONE** — package absent | |
| `TOOL-09` `cmdk` | **NOT DONE** — package absent (relevant once `DS-08` starts) | |
| `TOOL-10` `Vaul` | **NOT DONE** — package absent | |
| `TOOL-11` analytics | **NOT DONE** — neither PostHog nor Plausible package present | |
| `TOOL-12` React Query DevTools | Package installed; **wiring into `QueryProvider.tsx` not re-confirmed this pass** | |
| `TOOL-13` Prettier/Husky/lint-staged | Packages installed; **hook configuration and full-repo formatting pass not confirmed** | |
| `TOOL-15` Floating UI | **DONE** | |
| `A11Y-01` through `A11Y-09` | **Cannot verify statically with confidence** beyond `A11Y-03` (skip link: confirmed absent, **NOT DONE**) and `A11Y-05`-equivalent live-region (confirmed absent via `aria-live` grep, **NOT DONE**). The rest (label correctness, focus trapping quality, actual screen-reader behavior) require manual testing with real assistive technology, which this review cannot substitute for — do not treat their absence from this table as either done or not done; they are simply unverified by this method. | |
| `MOB-01` through `MOB-05` | **Cannot verify gesture feel/touch behavior statically.** `MOB-05` (100dvh everywhere) is **DONE** — verified Aug 10, 2026: `rg 'h-screen\|100vh' src` = 0 hits; all 6 files migrated in commit `8c249b6` (July 7, 2026). The rest require a real device. | |

### 17.4 — Direct answers to the questions asked

**"Are you sure you checked everything already in the spec and marked it properly?"** No claim of exhaustive, 100% coverage should be trusted from any single static-analysis pass, and this document won't pretend otherwise: §17.3 covers every ticket that source-code inspection can settle, and marks each one done / partial / not done / unverifiable-by-this-method, rather than silently skipping the ones that were harder to check. The ones marked "not re-verified this pass" are exactly that — checked in an earlier pass, not re-diffed against this specific build, and called out as such rather than assumed still accurate.

**Questions this document has, for the user:**

1. `BUG-29`'s literal `color_accent: "var(--accent)"` string — is a per-thread accent color actually a feature anyone reads anywhere, or is this a dead field that should simply be dropped from the insert (and possibly the schema) rather than fixed to hold a real color? Worth deciding before writing the fix.
2. For `CONF-14`'s settings collapse: is Quiet Hours/notification-DND something planned for a future push-notification feature, or was it added speculatively? If genuinely planned, it should be deferred until that feature exists rather than exposed now with nothing behind it.
3. For `BUG-34`: once error surfacing is added and the dismiss action is reproduced live, what does the actual Supabase error say? That answer determines whether anything beyond error-handling needs fixing (an RLS gap, a trigger, something this document's static read of the migrations didn't surface).

---

## 18. Addendum 7 — closing the verification gaps from §17.3

Every ticket previously marked "not re-verified this pass" in §17.3 was checked directly against the current build in this pass. Results below; §17.3 should be read together with this table, not replaced by it.

| Ticket | Status | Evidence |
|---|---|---|
| `TOOL-01` typed Supabase client | **DONE** | `src/types/database.types.ts` exists; both `createBrowserClient<Database>` and `createServerClient<Database>` are parameterized with it. |
| `TOOL-04` `nuqs` for Do's view/filter state | **DONE** | `do/page.tsx` uses `useQueryState` for both `filter` (category) and `view` (board/today/calendar), matching `INT-02`'s requirement exactly. |
| `TOOL-12` React Query DevTools | **DONE** | Wired into `QueryProvider.tsx`, `initialIsOpen={false}`. |
| `TOOL-13` Husky/lint-staged | **DONE** (pre-commit hook confirmed present and calling `lint-staged`) | `.husky/pre-commit` exists and runs `npx lint-staged`. |
| `BUG-23` shared page transition (`template.tsx`) | **NOT DONE** | No `template.tsx` under `src/app/(app)/` — still absent. |
| `DS-14` reduced motion | **PARTIAL, and this distinction matters** | The reduced-**transparency** half is done well (`body { --blur-*: none !important }` cascades correctly through every blur token). The reduced-**motion** half is not: the global override at `globals.css` still only sets `transition-duration: 0.01ms !important` — it does not remove the underlying `transform` value, which is the specific defect this ticket was written to fix (an instant transform is still a transform, not the "no movement" the setting promises). Do not close this ticket on the strength of the transparency half alone. |
| `PERF-04`/`PERF-08` backdrop-filter budget | **NOT DONE, and the underlying number moved the wrong way** | `backdrop-filter` occurrences are now 23, up from 16 in the pass this ticket was originally written against. `contain: paint` (the other half of this ticket's requirement) has zero occurrences anywhere in `globals.css`. This ticket should be treated as higher priority than its current placement suggests, given the trend is worsening, not improving, while other work continues to add new glass surfaces without checking this budget first. |
| `BUG-21` onboarding background hardcoded colors | **CONFIRMED — partially hardcoded** | `OnboardingBackground.tsx` correctly uses `var(--accent)`, `var(--bg-base)`, `var(--text-1)`, `var(--surface-modal)`, and `var(--border-strong)` for several elements, but its per-step ambient glow gradients (five steps, each with its own `radial-gradient(...)` using literal hex values like `#E5B41E`, `#EB4233`, `#F0C830`, `#EB6B1E`, `#3B1814`, `#1A0800`) are hardcoded, not tokenized. This does not currently cause a visible bug (onboarding forces the `warm` theme per `BUG-15`'s fix, and the hardcoded hex values happen to already match `warm`'s own palette), but it is fragile and would silently stop matching the theme if onboarding's forced-`warm` behavior is ever relaxed, or if this component is ever reused somewhere theme-aware. Fix priority: Low-Medium, not urgent, but real. |
| `BUG-04`/`BUG-24` empty-state button targets, audited per-space as promised | **Mixed — 1 of 3 checked spaces is correct** | **Remember/People:** correct — its `EmptyState` action opens `setIsPanelOpen(true)` (the Add Person panel), matching its header button. **Think:** still incorrect — its `EmptyState` action calls `setCaptureModalOpen(true)`, the same defect class as the original Do-page bug, never fixed here. **Explore:** same defect, same fix needed. This is now `BUG-35` (below), not a restatement of `BUG-24` — it's that ticket's audit actually completed, two passes late. |
| `INFRA-19` single status-writing path through `item-lifecycle.ts` | **Confirmed a real, widespread gap, not a hypothetical one** | Direct string status literals (`"active"`, `"done"`, `"deleted"`, `"archived"`, etc.) written outside `item-lifecycle.ts` were found in nine files: `(app)/page.tsx`, `explore/[id]/page.tsx`, `explore/page.tsx`, `inbox/page.tsx`, `do/page.tsx`, `PomodoroTimer.tsx`, `SettingsModal.tsx`, `TaskAddPanel.tsx`, `RitualOverlay.tsx`. Not every one of these is necessarily wrong (some may be reads/comparisons, not writes — each needs individual review, which is exactly what this ticket already calls for), but the count confirms this is systemic, and directly explains why an isolated bug like `BUG-29`'s ad hoc `threads` insert could exist unnoticed: there was never a single enforced path to check it against. |
| `MOB-05` `100dvh` migration | **DONE** | Verified Aug 10, 2026 — stale audit claim, same failure mode as root pattern 2: commit `8c249b6` (July 7, 2026) already migrated all six named files (`OnboardingBackground.tsx`, `Navigation.tsx`, `~offline/page.tsx`, `not-found.tsx`, `(auth)/login/page.tsx`, `onboarding/OnboardingWizard.tsx`) to `h-dvh`/`min-h-dvh`. Current-state check: `rg 'h-screen\|100vh' src` = 0 hits, 9 `h-dvh` sites. |

### New ticket from this pass

**BUG-35 — Think and Explore's empty-state "Add" buttons still open Quick Capture instead of their own composer/drawer**

- **Priority:** High
- **Files:** `src/app/(app)/think/page.tsx` (line ~282), `src/app/(app)/explore/page.tsx` (line ~275)
- **Root cause:** Both `EmptyState` components' `action.onClick` call `useAppStore.getState().setCaptureModalOpen(true)`, identical to the original, already-fixed Do-page defect (`BUG-04`) — this is the same bug, in two more places, that `BUG-24`'s audit was supposed to catch and evidently didn't get all the way through.
- **Requirement:** Think's empty state should open its own new-thread creation (the same handler wired to its header's "New thread" button, `handleNewThread` — once `BUG-29`'s fix to that function lands). Explore's empty state should open its "Save to Explore" panel (the same handler its header's "Save item" button uses.
- **Acceptance criteria:** Pressing "Add" from Think's or Explore's empty state opens that space's own creation surface, not `CaptureModal`, matching each space's header button exactly.
- **Depends on:** `BUG-29` (Think's fix specifically should land alongside or after that repair, so the empty-state button doesn't call a still-broken handler).

---

## 19. Documentation self-consistency check

Every governance/reference file delivered in this project (`AGENTS.md`, `GEMINI.md`, `COMPONENT_MANIFEST.md`, `DESIGN_SYSTEM.md`, this document) was re-read together in this pass specifically to check they don't contradict each other or go stale relative to each other. Findings:

1. **`COMPONENT_MANIFEST.md`'s `Dropdown` entry** said "STABLE — DO NOT MODIFY WITHOUT REGRESSION TEST... Portal-based (`createPortal`)" — this is now technically incomplete, not wrong: the component still is portal-based, but via Floating UI's `FloatingPortal`, not a hand-rolled `createPortal` call. The entry's intent (don't touch this without a regression test, because it broke once already) still holds and needs no correction; the implementation detail is updated below for accuracy.
2. **`AGENTS.md`'s hard invariant 3** ("`Dropdown.tsx` and `Popover.tsx` render their menu content via `createPortal`") has the same minor staleness — still true in substance (both are still portal-rendered), technically superseded by Floating UI's own portal mechanism. Updated below.
3. **`DESIGN_SYSTEM.md`'s theme-name references** were checked against `AGENTS.md`'s invariant 2 (`"warm" | "navy" | "forest"`) — consistent, no drift found.
4. **No other contradictions found** between the four governance files and this document as of this pass.

Both `AGENTS.md` and `COMPONENT_MANIFEST.md` have been updated (delivered alongside this document) to say "portal-based (Floating UI's `FloatingPortal`, or an equivalent portal mechanism)" rather than naming `createPortal` specifically, so a future switch of positioning library doesn't make the invariant read as violated when the actual protected behavior (menus aren't clippable) is intact.

---

## 20. Addendum 8 — cleaning the conflict register, new deep research (color, glass, hover), and new confirmed bugs

This pass does four things directly requested: (1) removes stale, confusing entries from the conflict register — some referenced documents that no longer govern this project and one listed an already-shipped feature as "open," which was simply wrong; (2) replaces the space-color and glassmorphism guidance with material grounded in dedicated new research, not the earlier pass's shallower treatment; (3) confirms or refutes each newly reported issue against the actual code, the same way every prior pass has; (4) folds in genuinely new findings the deeper code reading surfaced along the way, including two (`BUG-36`, `DS-30`) that explain several of the reported symptoms at once.

### 20.1 — Conflict register cleanup

The following entries are corrected in place. This is not new information changing the resolution — it is removing confusing, stale, or simply incorrect statements from entries that were already otherwise resolved.

- **`CONF-05` (hover sidebar interaction model):** this conflict is **closed and has been for several passes** — `Navigation.tsx` has shipped a working hover-expand rail since the build reviewed in Addendum 3. Any document still listing this as open or "needing a decision" is stale and should be corrected to **RESOLVED — hover-expand, no pinning, shipped.**
- **`CONF-01` (theme naming):** the resolution stands (`warm`/`navy`/`forest`), but the entry previously framed this as something *this document* resolved through a multi-step negotiation across several passes, when in fact it was always the user's own explicit, direct instruction, stated plainly the first time it came up and again explicitly in this conversation. The entry is corrected to state that plainly: **the user chose these three names directly, for the specific reason of having one consistent identifier across the database, `localStorage`, and CSS — not a negotiated compromise between competing proposals.** Restating this as a resolved "conflict" at all overstates the ambiguity that ever existed here; it is retained in the register only as a record of the naming history (`wahala`/`orange`/`blue`/`forest` → `sunset`/`midnight`/`meadow` → `warm`/`navy`/`forest`) so a future agent understands why `theme.ts`'s `LEGACY_THEME_MAP` has three generations of aliases, not because the name itself is still in question.
- **Any reference in this document's own text to `CLAUDE.md`, `plan.md`, or an "audit" document as a live, currently-governing source:** these were accurate descriptions of the document landscape at the time each was written, in earlier passes of a project whose documentation has since been deliberately consolidated (`MD-01`/`MD-02`, both confirmed done). Every such reference in this document from this point forward should be read as **historical record of how a past confusion arose, not as a currently-relevant file** — `AGENTS.md` is the only entry point, `docs/plans/EXECUTION_SPEC.md` (this file) is the only backlog, `docs/project/DESIGN_SYSTEM.md` is the only design authority. Continuing to cite a retired document's specific old wording as if it still mattered was a real mistake in how prior passes were written, not a matter of interpretation — it added exactly the kind of confusion this whole documentation-governance effort exists to remove, and it stops here.

### 20.2 — Space colors, researched properly this time

The prior resolution (`CONF-02`/`CONF-13`) was directionally right (keep per-space colors, apply them everywhere) but did not solve the actual complaint raised now: **the four colors chosen are too similar to each other, don't feel attributed to their space, and don't sit naturally in all three themes.** That is a color-selection problem, not an application-breadth problem, and it needed its own research pass, which this section provides.

**The mechanism that was missing:** four independently-hand-picked hex values (`#E5B41E`, `#EB4233`, `#F4A261`, `#A76011`) is exactly the anti-pattern current, authoritative color-token guidance (Google's Material 3 color-role system, the New York State Design System's per-theme token remapping, and current design-token literature on primitive→semantic→theme layering) warns against: hardcoded, independently-chosen values do not scale across themes and tend toward the "similar, muddy, no attribution" result reported here, because nothing about how they were chosen guarantees separation from each other or harmony with a given theme's base palette. The fix these sources converge on is to **derive** each space's color from the active theme's own primary hue, not hand-pick four unrelated ones per theme:

1. Work in OKLCH (perceptually uniform — a fixed hue rotation reads as an equally-different color at every lightness/chroma, unlike HSL or raw hex, where the same rotation can look wildly uneven). This project already has OKLCH tokens sitting unused in the dead shadcn palette (`DS-02`) — this is a legitimate, better use for that color space than the one it's currently doing nothing in.
2. Define each space's color as a **fixed hue offset from that theme's own `--accent`**, computed once per theme (not per space independently): e.g., Do = the theme's accent hue exactly (0°), Think = accent hue + 40°, Remember = accent hue + 200° (a genuine complementary-ish contrast, still constrained to a harmonious lightness/chroma band so it doesn't leap to an unrelated color family), Explore = accent hue − 40°. The exact offsets are a design decision to make by eye once the mechanism is in place, not something this document should hand-pick blind — but the mechanism itself (fixed rotation from the theme's own accent, computed the same way for all three themes) is what guarantees every theme gets a set of space colors that are (a) visibly distinct from each other by a consistent, deliberate hue gap, and (b) automatically harmonious with that theme, because they're mathematically derived from it rather than chosen independently three separate times.
3. Keep lightness and chroma roughly constant across the four space colors within one theme (only hue rotates) — this is what makes them read as "a family, four members" rather than "four unrelated colors that happen to be defined in the same file," which is closer to the "no unique attribution feel" complaint.

**DS-28 — Rebuild the per-space color set as theme-derived OKLCH hue rotations, not four independent hex picks**

- **Priority:** High
- **Files:** `src/app/globals.css` (the `--space-*` token definitions, all three theme blocks)
- **Requirement:** Replace the current four independently-chosen hex values per theme with four values computed as fixed OKLCH hue offsets from that theme's own `--accent`, per the mechanism above. Do this for `warm`, `navy`, and `forest` alike, using the same offset angles in all three (only the base accent hue differs per theme, so the *relationship* between the four space colors stays visually consistent across themes even though the actual colors differ). This directly answers the request for an accent set that "doesn't look out of place in any one theme" — it can't look out of place, because it's derived from that theme's own primary color, not picked separately.
- **Acceptance criteria:** In each of the three themes, the four space colors are visibly distinct from one another at a glance (not "similar, hard to tell apart," the reported problem), and each set reads as belonging to its theme (no space color that looks like it wandered in from a different theme's palette). A colorblind-safe check (simulate protanopia/deuteranopia) confirms the four remain distinguishable by more than hue alone if colorblind users are expected to rely on this system — pair with `A11Y-09`'s existing icon-plus-color requirement for exactly this reason.
- **Depends on:** `DS-02` (this is the moment to also finally remove the dead shadcn OKLCH tokens, replacing them with these real, used OKLCH values, rather than leaving both a dead unused OKLCH block and a new live one in the same file).

### 20.3 — Glassmorphism, researched properly this time, against your own reference images

The prior pass's glass section was reasonable as a baseline (barrier layer, blur budget, elevation bundles) but didn't go deep enough, and — correctly identified by the report — the actual implementation still only puts glass on cards/panels/modals, not the fuller set this document's own philosophy claims ("dropdowns, toasts" were named but never actually built that way). This section corrects both the gap in research depth and the gap in what's actually specified as in-scope for glass.

**What your reference images specify, read precisely:**

- Image 1 ("Frosted / Concept"): a single, large-radius card with a strong, even frost — not a faint tint, a genuinely opaque-reading frosted surface — over a busy, colorful background, with a visible **grain/noise texture** layered into the frost itself, and text sitting cleanly on top with no legibility struggle despite the busy background behind it.
- Image 2 (booking card): the same frosted language applied to a full card with an image inset at the top (itself corner-radiused to match the card), stacked content below on the frosted body, and pill-shaped controls (date range, a chevron-expand row) that are themselves subtly glassy, not solid-filled buttons dropped onto a glass card.
- Image 4 (status pills): flat, saturated, glowing pill badges (Success/Pending/Submitted/Failed) — each a distinct hue with a soft outer glow and a matching icon, not glass at all, but establishing that this app's **pills specifically are meant to be a separate, vivid, high-saturation language from the glass cards they sit on**, not a muted extension of the same frosted surface.

This is a coherent, specific aesthetic: **frosted glass as the container language, vivid glowing pills as the status/tag language sitting distinctly on top of it, with a grain texture giving the glass a tactile, non-sterile quality** — closer to what current research calls "Glassmorphism 2.0" (2026's more deliberate, tactile evolution of the 2020-era flat blur) than to Apple's Liquid Glass, which is specular/refractive and reactive to motion rather than textured and grainy. That distinction is worth being explicit about, since it changes concrete implementation choices:

1. **Alpha-channel gradient fills, not flat low-opacity color.** Current 2026 guidance is specific that a flat `background: rgba(0,0,0,0.1)` reads as "washed out" — use a gradient across the card's own surface (a very subtle two-stop gradient in the same hue family as the surface token) so the frost has some internal variation, the way the reference images' cards clearly do (they aren't a flat single tone).
2. **A grain/noise layer, not just blur.** This is the part the prior pass's glass section didn't cover at all, and it's clearly present in your reference. Implement as a small (64×64 or 128×128px), tileable, low-contrast noise PNG or an inline SVG `feTurbulence` filter, applied as a `background-image` layer over the glass surface at very low opacity (roughly 3-6%), blended with `mix-blend-mode: overlay` or `soft-light`. Critically for performance: **generate this once as a static tiled image, do not compute noise per-frame or per-element with an SVG filter applied live to every card** — a single shared, cached background-image reused across every glass surface costs nothing extra to render past the first paint, whereas a live `feTurbulence` filter recalculated per element is exactly the kind of GPU cost this document's own `PERF-04`/`PERF-08` tickets are already trying to bring down, not add to.
3. **A specular-highlight border, not a plain border.** Current guidance is specific that the border shouldn't be a flat single-color line — a very thin (0.5–1px) gradient border that's slightly brighter along the top edge (simulating a light catching the top of a physical glass edge) reads as noticeably more "glass" than a uniform border, for very little extra cost (a `border-image` gradient or a pseudo-element with a linear-gradient mask).
4. **Extend glass to dropdowns and toasts for real, not just claim it.** Both already render through portals (`Dropdown`/`Popover`/`ToastProvider`) — apply the same elevation-bundle-driven glass treatment (barrier layer + blur + specular border + grain) to their surfaces, at the `floating`/`overlay` elevation tier, so the design system's own stated claim becomes true rather than aspirational. This was flagged as inaccurate in the report and the fix is straightforward now that the portal infrastructure (`BUG-03`/`BUG-27`, Floating UI) is already in place — it's a styling gap on top of working plumbing, not a structural one.
5. **Pills stay outside the glass language, deliberately.** Per your reference image 4, pills/badges (status, priority, category) should be their own vivid, saturated, glowing micro-component — not a muted glass chip. This is worth stating explicitly in `DESIGN_SYSTEM.md` as an intentional exception to "everything is glass," because otherwise a future pass could "fix" pills by making them glassy too, which would be wrong per your own reference.

**DS-29 — Implement Glassmorphism 2.0: grain texture, alpha-gradient fills, specular borders, and glass parity for dropdowns/toasts**

- **Priority:** High
- **Files:** `globals.css` (elevation bundles, new grain asset), `Dropdown.tsx`/`Popover.tsx`/`ToastProvider.tsx` (apply the elevation-bundle glass treatment to their surfaces, which currently render solid or near-solid rather than glass)
- **Requirement:** Per the five points above. A single shared grain texture asset, referenced by the elevation bundles, not duplicated. Dropdown/Popover panels and toasts visually match card/modal glass at their appropriate elevation tier.
- **Acceptance criteria:** A dropdown panel and a toast, side by side with a card, read as the same material family (same frost quality, same border treatment, same grain), not two different visual languages under one name. `PERF-04`'s blur budget (max two stacked blur regions) is re-checked once this ships, since adding glass to two more component types is exactly the kind of change that could push the current count (already over-budget per Addendum 6/7's finding of 23 `backdrop-filter` occurrences) higher still — this ticket must not land without `PERF-04` being addressed in the same effort, or the two will fight each other.
- **Depends on:** `PERF-04` (do together, not separately — see above).

### 20.4 — Hover consistency and the "cards enlarge out of bounds, cut border" bug — one root cause, found

**Confirmed by direct comparison: Inbox's card and the Do page's `TaskCard` use two entirely different hover mechanisms.** `TaskCard` lifts on hover via Framer Motion (`whileHover={{ y: -2 }}`). The Inbox card has no lift at all — only a background-color shift (`hover:bg-amber-500/10`). This is exactly the reported inconsistency, confirmed, not inferred.

**The "cut border" bug's likely mechanism, also found:** `GlassCard.tsx`'s base class includes `overflow-hidden`. The Inbox card's own markup explicitly overrides this with `!overflow-visible` — meaning whoever built that one card already hit a clipping problem and patched around it locally, rather than fixing `GlassCard` itself. This is a strong, direct clue: a card that lifts or scales on hover while its own (or a parent's) `overflow-hidden` is still active will have its shadow, glow, or growing edge clipped exactly where the box boundary sits — precisely "enlarge out of bounds and have a cut border."

**DS-30 — One hover system for every hoverable card/row in the app, using lift not scale, with `overflow` fixed at the source**

- **Priority:** Critical — this single ticket, done once, fixes items #5 and #6 together, plus removes the Inbox card's local `!overflow-visible` patch by making it unnecessary everywhere, not just there.
- **Files:** `src/components/ui/GlassCard.tsx` (remove `overflow-hidden` from the variant(s) used for hoverable/clickable cards — reserve it only for variants that genuinely need internal cropping, e.g., an image-thumbnail card), every card/row component currently missing a hover state (`inbox/page.tsx`'s card, and an audit of any other list row in the app for the same gap)
- **Root cause and requirement:** (1) Standardize on a **translateY lift** (`y: -2px` to `y: -3px`, Framer Motion `whileHover`, matching `TaskCard`'s existing value so it isn't itself a third new number) as the one hover motion for every hoverable card/row — never a `scale()`-based hover for cards, specifically because a scale transform grows the element's rendered box past its layout box, which is what triggers clipping inside any `overflow-hidden` ancestor (including a horizontally-scrollable Kanban column, which is exactly the kind of container this app has). A translateY lift does not have this problem — it repositions, it doesn't grow. (2) `GlassCard`'s clipping `overflow-hidden` should not coexist with a lift-on-hover variant; separate the "needs internal cropping" case (an image thumbnail) from the "is a hoverable, liftable surface" case (list rows, task cards) as two different variants if they aren't already, so neither one has to fight the other's requirement.
- **Acceptance criteria:** Every hoverable card/row in every space lifts identically (same distance, same duration, same easing token) on hover, with a matching shadow increase. No hover-lifted card shows a clipped edge, border, or shadow at any point during the hover transition, tested specifically inside a horizontally-scrollable container (Do's Board columns) and inside a vertically-scrollable one (any list). The Inbox card's `!overflow-visible` override is removed because it's no longer needed — the fix is in `GlassCard` itself, not patched per-consumer.
- **Depends on:** none — this is self-contained and should be done before `DS-29` (glass system rework), since both touch `GlassCard`'s core styling and doing the hover fix first avoids redoing it twice.

### 20.5 — New and re-confirmed bugs from this pass's deeper code reading

**BUG-36 — `Sheet`'s whole-surface `drag="y"` likely blocks taps on interactive children, including `TaskAddPanel`'s priority pills**

- **Priority:** Critical
- **Files:** `src/components/ui/Sheet.tsx` (line ~58, `drag="y"` with no `dragListener={false}`/dedicated handle), `src/components/features/TaskAddPanel.tsx` (the priority-pill buttons, confirmed correctly wired to `setValue("priority", ...)` on their own — the pills' own code is not the bug)
- **Root cause:** Direct code reading confirms the priority-pill buttons in `TaskAddPanel` are correctly implemented — each is an `m.button` with a working `onClick` that calls React Hook Form's `setValue`. The bug is not in the pills. It is in the `Sheet` component they live inside: `drag="y"` is applied to the entire sheet surface with no scoping to a dedicated drag handle and no `dragListener={false}`. This is a known Framer Motion interaction hazard — a `drag`-enabled ancestor's gesture recognizer competes with a `whileTap`/`onClick` gesture on a nested interactive child, and depending on pointer timing, the drag recognizer can capture the pointer before the child's own tap is registered, causing the click to silently not fire. This is the same root cause this document's own `MOB-04` ticket already existed to address (it was originally scoped around drag-jitter-while-typing, a narrower symptom of the identical underlying cause), not a new, unrelated defect — this finding sharpens `MOB-04`'s priority and scope rather than replacing it.
- **Requirement:** Scope the drag gesture to a dedicated handle element (a small grabber bar at the top of the sheet, which the reference images and most sheet implementations already show as a visual affordance anyway) using Framer Motion's `dragControls`/`dragListener={false}` pattern, so the rest of the sheet's content — every button, pill, input, and dropdown inside it — receives pointer events normally, with no competing gesture recognizer.
- **Acceptance criteria:** Every priority pill, category pill, and any other button inside `TaskAddPanel` (and every other `Sheet` consumer — `AddPersonPanel`, `LocationAddPanel`, `ExploreDrawer`) registers a click reliably, on both desktop pointer input and a real touch device, tested specifically with a fast/light tap (the exact gesture most likely to be swallowed by a competing drag recognizer). Dragging the sheet to dismiss still works, but only when the drag starts from the dedicated handle.
- **Depends on:** none. This is high-value and self-contained — recommend fixing this one first among this pass's new findings, since it's silently breaking a core input (setting a task's priority) across the app, not a cosmetic issue.

**BUG-37 — Explore's empty-state "Save Item" button still opens Quick Capture (item #3, confirmed unfixed)**

- **Priority:** High
- **Files:** `src/app/(app)/explore/page.tsx` (line ~275)
- **Root cause:** Directly confirmed, matching `BUG-35`'s already-written finding exactly — `onClick={() => useAppStore.getState().setCaptureModalOpen(true)}` on the empty-state action, same defect class as the original Do-page bug, not yet fixed here despite being fixed in other spaces.
- **This is the same ticket as `BUG-35`'s Explore half — not a new, separate one.** Recorded here only to confirm, on direct request, that it remains unfixed as of this exact build; no new ticket ID needed.

**DS-31 — Contact "relationship" chip dropdown's visual style and position, re-investigated**

- **Priority:** High
- **Files:** `src/components/ui/Dropdown.tsx` (`chip` variant), `src/app/(app)/remember/people/[id]/page.tsx`
- **Finding:** the relationship dropdown on the person detail page **does** use the shared `Dropdown` component (`variant="chip"`), with the same Floating UI configuration (`offset`, `flip`, `shift`, `strategy: "fixed"`) already confirmed correct for the `select` variant elsewhere. Static reading does not show an obvious configuration difference that would explain a different visual style or a top-left rendering position — both variants share one `useFloating` call. This means the cause is more likely a **runtime** one this kind of review can't settle from source code alone: most plausibly, the floating panel's portal target ending up nested inside an ancestor with a CSS `transform`/`filter`/`contain` property (which changes the containing block for a `position: fixed` descendant, even one rendered via a portal, if the portal's mount point itself sits inside that ancestor rather than truly at `document.body`). **Before writing a fix, open this exact dropdown in a browser's DevTools, inspect the rendered `dropdown-panel` element's computed `position`/`top`/`left`, and check whether any ancestor between it and `<html>` has a `transform` set** — that single check will confirm or rule out this hypothesis definitively, which static code reading cannot.
- **Acceptance criteria:** Once the runtime cause is confirmed, the relationship chip dropdown opens directly beneath its trigger, scrollable if needed, visually identical to every other `Dropdown` instance in the app.
- **Depends on:** live inspection first, as described — do not guess at a fix before that.

### 20.6 — Pills: one system, not several (extends `DS-10`, informed by your reference image)

Per reference image 4 (Success/Pending/Submitted/Failed pills — vivid, glowing, icon-paired), and the direct report that priority/status/category pills are inconsistent across the app in "design, beauty, hover effect and usage": this is `DS-10`'s original scope, sharpened with a concrete visual target now available. **DS-10 is updated, not superseded:**

- Every pill in the app (task priority, task category, person relationship, capture-routing status, explore type) is the same underlying component with the same anatomy: an icon (or dot, for the lightest-weight cases like priority), a label, a background at roughly 15-20% of the pill's own color, a border at roughly 30-40% of that color, and — new, per the reference — a soft outer glow (`box-shadow` with the same hue, low spread, low opacity) that intensifies slightly on hover/active state, not just a background-opacity shift.
- Pills are explicitly **not** part of the glass system (§20.3's point 5) — they are flat, saturated, and glowing, sitting on top of glass surfaces as a distinct visual layer, matching your reference exactly.
- This is the concrete visual spec `DS-10` was missing; that ticket's acceptance criteria should be read as extended to include "matches the anatomy described here," not just "uses named variants."

### 20.7 — What could not be settled by this pass, stated plainly

Consistent with this document's method throughout: `DS-31`'s exact runtime cause needs a live inspection this review cannot perform. `BUG-21`'s onboarding-background hardcoding was already flagged as low-urgency since it doesn't currently produce a visible defect. Everything else in this addendum was either confirmed by direct code reading or is a design decision (the exact hue-offset angles in `DS-28`) that this document deliberately leaves for visual judgment rather than dictating a specific number with no way to verify it looks right without seeing it rendered.

---

## 21. Addendum 9 — user progress/analytics system (researched), bloat reduction, login/onboarding, and MD-system reinforcement

### 21.1 — A progress/analytics feature, researched against this app's own chosen domain identity

This needed its own research pass because there is a real tension in this exact domain that a generic "add analytics" search would miss: **Sunsama — the app this project has explicitly modeled its ritual system on — deliberately ships with no gamification at all.** Its own reviews describe this as a stated design position, not an omission: no streaks, no achievement badges, no leaderboards, positioned in direct contrast to Todoist's "Karma" points and TickTick's streak grids, which exist in the same market and are popular, but represent a different, more gamified philosophy. What Sunsama does instead is completed-task/time-tracking summaries, time-distribution graphs, and a structured weekly review ritual — reflective, quiet, pattern-revealing, not celebratory or score-based.

This matters directly: if Presense builds a Todoist/TickTick-style streaks-and-badges system, it would contradict the calm, intentional identity this project has already chosen (the same identity `CONF-14` invoked to simplify the settings' ritual-timing fields). This document does not silently pick one direction — it resolves this explicitly, using the same domain-fit reasoning already established:

**CONF-17 — Progress/analytics feature: reflective (Sunsama-style) vs. gamified (Todoist/TickTick-style) → RESOLVED, in favor of reflective**

- **Resolution:** Build a **Weekly Review** surface (not a constant, ambient gamification layer) showing: tasks completed vs. planned, a simple time/completion-pattern view (which days were most productive, which categories consumed the most time — data this app's `Pomodoro`/task-completion timestamps already produce), and a short reflection prompt, mirroring Sunsama's own weekly review and the general "four core areas" dashboard structure (vision/goals, habits, review/reflection, and a small, capped set of metrics — 5-10 at most, per current guidance's own explicit warning against metric overload). **No streaks, no points, no badges, no leaderboard, no celebratory confetti-style animation on completion** — these are the specific gamification mechanics Sunsama's own positioning explicitly avoids, and adopting them here would be a tonal contradiction with a domain choice this project has already made deliberately, not accidentally.

**New feature spec: `FEAT-01` — Weekly Review / progress surface**

- **Priority:** Medium (this is new scope, not a bug — sequence after Phase 0/1 stabilize, not before)
- **Requirement:** A new view (reachable from Home, not a permanent sidebar item — this is a periodic ritual, not a constantly-checked dashboard, consistent with how the existing morning/evening rituals are surfaced) showing, capped at a small, fixed set of metrics: tasks completed this week vs. last week, a simple day-of-week completion pattern (which days tasks actually got done, using data already captured via `item-lifecycle.ts`'s completion timestamps — no new tracking infrastructure needed for this part), total focus/Pomodoro time if the existing `PomodoroTimer` session data is retained, and one short free-text reflection field the user can optionally fill in, persisted per week. No new gamification mechanics of any kind.
- **Data requirement:** Audit whether task-completion timestamps and Pomodoro session durations are currently retained anywhere queryable (a completed task's `completed_at`, if it exists, or whether completion is only reflected in `status` with no timestamp) — if the timestamp isn't currently stored, that's a small, additive schema change (one nullable column), not a redesign.
- **Acceptance criteria:** The weekly review surface shows accurate, real data pulled from existing task-completion and (if available) focus-session records; it introduces no streak counters, achievement mechanics, or celebratory animations; a user can dismiss/skip a week without any guilt-inducing UI (no "you broke your streak" messaging of any kind, since there is no streak).
- **Depends on:** none structurally, but should not start before Phase 0 critical bugs are closed, given it's new scope, not a fix.

### 21.2 — Bloat reduction (items #17, #18, #19)

**`INFRA-20` — Settings surface audit for bloat, beyond the already-resolved `CONF-14`**

- **Priority:** Medium
- **Requirement:** `CONF-14` already collapsed the ritual-timing fields. Extend the same scrutiny to every other Settings section: for each toggle/field currently present, write one sentence stating what it controls and confirm at least one other comparable app in this domain (Sunsama, Todoist, Things) exposes an equivalent — if nothing comparable exists anywhere in the domain and the field isn't load-bearing for a feature this app specifically has, it's a bloat candidate for removal or folding into a sensible default rather than a user-facing toggle. This is the same audit method `CONF-14` already used, applied to the rest of the Settings surface systematically rather than just the fields already flagged.
- **Acceptance criteria:** A short table exists (in `docs/project/ARCHITECTURE.md` or a new short doc) listing every Settings field, what it does, and why it's there — any field that can't get a one-sentence justification is removed.

**`INFRA-21` — Dead code and unused-export sweep**

- **Priority:** Low-Medium
- **Requirement:** Run a dead-export/dead-file detector (e.g., `knip`, already noted as a legitimate low-priority tool in an earlier pass of this document) across the codebase and remove genuinely unused exports, components, and files — following this document's own "never delete what you don't understand, grep first" rule throughout, same as every other deletion in this backlog.
- **Acceptance criteria:** `knip` (or equivalent) run produces a report; each flagged item is either removed (with a grep confirming zero usages) or explicitly kept with a one-line reason in the same PR.

**`INFRA-22` — Database bloat audit**

- **Priority:** Medium
- **Requirement:** Beyond the RLS/index work already tracked (`INFRA-15`–`17`), audit the schema itself for columns that are no longer read anywhere in the app (candidates surfaced already in this document's history: the `threads.color_accent` field `BUG-29` found being written a nonsensical value into — worth confirming whether anything actually reads it before deciding whether to fix its value or remove the column entirely), and for tables/columns that accumulated during earlier passes' fixes (e.g., confirm the legacy theme-name migration chain hasn't left orphaned check-constraint clutter beyond what's needed going forward). This is the same "does every stored thing earn its place" question applied to the database that `INFRA-20` applies to Settings and `INFRA-21` applies to code.
- **Acceptance criteria:** A short data-dictionary note (extending `INFRA-19`'s planned `DATA_MODEL.md`) records, for every column, whether it's actively read; any confirmed-dead column is removed via a new migration (never edited in place), following this document's standing migration rules.

### 21.3 — Login and onboarding, made more beautiful (item #13)

- **Priority:** Medium
- **Requirement:** Per `DESIGN_SYSTEM.md` §6.10's existing note that the login screen is already the app's best current example of glass done right (a single focal glass card over a simple, uncluttered ambient background) — use `DS-29`'s Glassmorphism 2.0 treatment (grain, alpha-gradient fill, specular border) on this exact card first, since it's the highest-visibility single surface in the app and the one already closest to correct. Onboarding's per-step ambient glow (currently the hardcoded-color surface flagged in `BUG-21`) should both be tokenized (per that ticket) and receive the same upgraded glass/grain treatment on its own content card, so the two surfaces feel like one continuous, polished entry experience rather than two different eras of the same design system.
- **Stability/responsiveness requirement (explicitly asked for alongside "beautiful"):** confirm the login card's layout holds correctly at the narrowest supported viewport (per `DESIGN_SYSTEM.md` §8.7's "start at 360–375px" rule). `MOB-05`'s `100dvh` prerequisite is satisfied — the login route was migrated in `8c249b6` (verified Aug 10, 2026, zero `h-screen`/`100vh` in src) — so the remaining requirement is only the visual reflow check, not the viewport-height bug fix that Addendum 7 believed was missing.
- **Acceptance criteria:** Login and onboarding visually share one upgraded glass treatment; both hold their layout correctly from 360px up; neither shows a `100vh`-related jump when a mobile browser's chrome shows/hides.
- **Depends on:** `DS-29`, `MOB-05` (the login/onboarding files specifically), `BUG-21`.

### 21.4 — Reinforcing the MD-system's self-consistency (item #12)

This document's existing structure already does most of what was asked (`AGENTS.md` as the single entry point; `MD-05`'s CI check rejecting unauthorized changes to protected invariants without an explicit acknowledgment). Two additions make the "self-updating, cross-referencing, but not randomly editable" property more concrete:

- Every governance file (`AGENTS.md`, `docs/project/DESIGN_SYSTEM.md`, `docs/project/COMPONENT_MANIFEST.md`, this document) should carry a one-line `Last reconciled against build: <date/commit>` marker at its top, updated only as part of an explicit reconciliation pass (like this one), so staleness is visible at a glance rather than silently assumed — this directly addresses "are these files actually up to date" without requiring a full re-read to find out.
- `MD-05`'s CI check (already specified) is the actual "not randomly editable" enforcement mechanism — a protected-invariant change without the required acknowledgment line fails the build. This is what makes "self-updating but protected" concrete rather than aspirational: the files can and should be updated (that's what every one of these addenda has been doing), but a change to a named hard invariant specifically requires an explicit, attributable decision, checked by CI, not by hoping an agent remembers to ask first.

---

## 22. Addendum 10 — the long-view systemic sweep, primary-source design research, and reference-image synthesis

This addendum does what was specifically asked: instead of treating each reported item in isolation, every confirmed bug from prior passes was used as a **pattern** to search the rest of the codebase for siblings, and design guidance was pulled from primary, authoritative sources (Vercel's own official interface guidelines) rather than secondary trend commentary, plus a direct synthesis of the six reference images and the two named reference apps supplied.

### 22.1 — Long-view pattern sweep: three bugs, each found once, are actually systemic

**BUG-38 — The unchecked-Supabase-error pattern (`BUG-34`'s root cause) is not isolated to Inbox — it is the dominant pattern across the entire codebase** — ✅ **RESOLVED Aug 10, 2026**

- **Priority:** Critical — this was the single highest-value finding from this pass
- **Evidence:** A direct search for every `await supabase.from(...)` mutation call in the app found roughly 35 call sites with no destructured `{ error }` check, spanning `PomodoroTimer.tsx`, `TaskAddPanel.tsx`, `(app)/page.tsx` (Home), `think/[id]/page.tsx`, `explore/[id]/page.tsx`, `explore/page.tsx`, `inbox/page.tsx` (the routing-delete calls, a *second* unchecked path in the same file `BUG-34` already flagged one instance in), `do/page.tsx`, and — most concerning — **nearly the entire `OnboardingWizard.tsx` flow**: its `user_settings` upserts, its `items`/`people`/`locations`/`threads`/`explores` inserts during the capture-triage step, and its relationship-note update all lack error checking. This means a brand-new user's very first experience of the app could silently fail at any step of onboarding — a person added during onboarding might never actually save, a captured item might never actually insert — with the wizard proceeding to the next step as if it had, because nothing checks whether it did.
- **Requirement:** This is not 35 individual bug fixes — it should be treated as one systemic pass: introduce a single small wrapper/helper (e.g., a `mutate()` utility around `supabase.from(...).<op>()` that checks `error`, reports it to the error tracker (`INFRA-01`/`TOOL-06`, once adopted) and to the user via `toast.error`, and returns a clear success/failure boolean) and migrate every one of these call sites to it, rather than hand-adding an `if (error)` check 35 times with 35 slightly different toast messages. This directly extends `AGENTS.md`'s new invariant 7 (added last pass) from a rule an agent should follow in new code to a retroactive cleanup of existing code.
- **Acceptance criteria:** Every Supabase mutation in the app either succeeds visibly or fails visibly — there is no third state (silently do neither). `OnboardingWizard.tsx` specifically is tested end-to-end with a deliberately-broken write (e.g., temporarily revoke a permission) to confirm the wizard now surfaces the failure instead of sailing through it.
- **Depends on:** none — this can start immediately and is independent of every open conflict.
- **Resolution notes (Aug 10, 2026):** Full pass completed. **All 27 mutation-bearing files audited line-by-line.** The audit's 37/71 and 10-file offender lists were stale — incremental BUG-34-era work had already migrated most sites (OnboardingWizard 10/10, think/[id], explore/[id]+/page, do/page, Home, PomodoroTimer, CaptureModal, SettingsModal, TaskCard, ExploreDrawer, AddPersonPanel, LocationAddPanel, remember/* , trash pages, reorder route were all already checked). **The 10 genuinely-unchecked sites found and fixed in commit `660f5a3`:** `TaskAddPanel.tsx` `handleAddCategory` (user_settings update), `CalendarView.tsx` reschedule Undo, `RitualOverlay.tsx` ×7 (triage Undo, estimate change, carry-over Undo, evening reflection insert + update, morning + evening skip), `(app)/layout.tsx` server-side onboarding auto-complete upsert (server: checks `error`, `console.error` — no toast available). One intentional exception, reviewed and documented: `think/page.tsx` daily-note insert stays fire-and-forget because it is a conflict-fallback pair with a unique-index fetch — it never claims success in UI (navigates only on truthy insert result). Final repo-wide sweep (`rg '\.(insert|update|delete|upsert|rpc)\(' src` → 27 files, all audited; no file with a mutation lacks an error check) confirms zero violations remain. Tests 144/144, build ✓. Related: pre-existing `no-explicit-any` errors in `TaskAddPanel.tsx` were fixed in the same commit because the lint-staged hook blocks commits touching that file.

**BUG-39 — `Sheet`'s whole-surface drag gesture (`BUG-36`) affects seven components, not one**

- **Priority:** Critical
- **Evidence:** Every consumer of the shared `Sheet` component was enumerated: `ConfirmModal`, `AddPersonPanel`, `SearchModal`, `TaskAddPanel`, `CaptureModal`, `ExploreDrawer`, `LocationAddPanel`. Since the drag-gesture conflict is in `Sheet.tsx` itself, every interactive control inside all seven of these — not just `TaskAddPanel`'s priority pills — is a candidate for the same silently-swallowed-tap problem: `ConfirmModal`'s Delete/Cancel buttons, `AddPersonPanel`'s relationship and avatar-color pickers, `ExploreDrawer`'s type field, `CaptureModal`'s destination picker.
- **Requirement:** Fixing `Sheet.tsx` once (per `BUG-36`'s already-specified fix — a dedicated drag handle, `dragListener={false}`) fixes all seven at once, since the defect lives in the shared component, not in each consumer. No consumer-level changes are needed.
- **Acceptance criteria:** After the `Sheet.tsx` fix, every interactive control in all seven listed consumers is spot-checked with a fast/light tap on a real touch device, not just `TaskAddPanel`'s pills.

**BUG-40 — Locations has no `EmptyState` at all; Think and Explore have the wrong target; only People is correct — the empty-state defect class is present in four different forms across five spaces**

- **Priority:** High
- **Evidence:** Direct inspection of all five spaces' empty-list handling: **People** — correct, uses `EmptyState` with the right target. **Do** — correct (fixed earlier). **Think, Explore** — use `EmptyState` but with the wrong `onClick` target (`BUG-35`, already tracked). **Locations** — does not use the shared `EmptyState` component at all; it hand-rolls a bare "No locations here" text block, the exact anti-pattern `DS-07` was written to eliminate.
- **Requirement:** Migrate Locations' empty state onto the shared `EmptyState` component, wired to its own "Log item" panel — this is a new instance of `DS-07`'s original requirement, not yet applied to this one file, rather than a new pattern to invent.
- **Acceptance criteria:** All five spaces (Do, Inbox, Think, Explore, People, Locations — six, including Inbox's documented Quick-Capture exception) use `EmptyState` with the correct target, verified individually, not assumed from one or two checked examples.

### 22.2 — Primary-source design research: Vercel's official interface guidelines, checked against this codebase directly

Rather than general "top design systems" commentary, this pass used Vercel's own official, primary-source interface guidelines document (`vercel.com/design/guidelines` — a checklist written for engineers, not a mood board) and checked several of its specific, testable rules directly against Presense's code. Two produced confirmed, previously-unreported defects:

**BUG-41 — Text inputs are 13px, below the 16px threshold that prevents iOS Safari from auto-zooming on focus**

- **Priority:** High
- **Files:** `src/components/ui/Input.tsx` (and by extension `Textarea`/`SearchInput`, which likely share the same base sizing — verify each)
- **Root cause:** `Input.tsx`'s default variant resolves to the `.input` CSS class, which inherits `--text-body: 13px`. Vercel's own guideline states this plainly: `<input>` font size must be ≥16px on mobile, or iOS Safari will zoom the viewport in when the field receives focus — a well-documented, specific mobile browser behavior, not a general aesthetic opinion. Every default text input in this app is below that threshold.
- **Requirement:** Either set input text specifically to 16px on mobile viewports (a `text-base` override scoped to inputs, distinct from the surrounding UI's 13px body text, which can stay smaller outside of input fields) or add the alternative fix Vercel's own guideline names — a `maximum-scale=1` viewport meta tag — noting that the first approach is generally preferable since it doesn't disable pinch-zoom for the rest of the app, which is itself an accessibility feature worth preserving.
- **Acceptance criteria:** Tapping into any text field on an actual iPhone (not a desktop emulator, which does not reproduce this behavior) does not trigger a viewport zoom.

**BUG-42 — No unsaved-changes warning anywhere in the app**

- **Priority:** Medium
- **Files:** `TaskAddPanel.tsx`, `AddPersonPanel.tsx`, `LocationAddPanel.tsx`, and any other form that can hold meaningful unsaved input
- **Root cause:** Confirmed zero occurrences of `beforeunload` or any unsaved-changes guard anywhere in the codebase. Vercel's guideline is explicit: "warn before navigation when data could be lost."
- **Requirement:** For each of the listed forms, track a dirty/unsaved state (React Hook Form's own `formState.isDirty`, already available where RHF is adopted) and prompt before closing the sheet/navigating away if it's true.
- **Acceptance criteria:** Typing into a task's notes field and attempting to close the sheet without saving prompts a confirmation; saving or explicitly discarding proceeds without a second prompt.
- **✅ CLOSED Aug 10, 2026** — commit `3e555a0` (`fix: BUG-42 unsaved-changes guard`). `useUnsavedGuard(isDirty)` hook (`src/hooks/useUnsavedGuard.ts`) registers `beforeunload` only while dirty. All four panels guard every close path (X, backdrop, Escape, drag): TaskAddPanel (RHF `isDirty` + manual snapshot of 9 non-RHF fields), AddPersonPanel (baseline compare of all 4 fields + `color`), LocationAddPanel (baseline compare of both fields), ExploreDrawer (baseline compare of title/url/note/type/tags/linkedThreadId, add + edit modes). **Implementation note:** RHF's destructured `formState.isDirty` is non-reactive for unwatched fields and `setValue()` never marks dirty without `shouldDirty: true` — both traps found during testing (probes) and fixed via baseline-snapshot comparison (`JSON.stringify` diff at close vs baseline captured at open, `watch`-subscribed) and `shouldDirty: true` on TaskAddPanel's 10 user-driven `setValue` sites. Verified: `rg 'beforeunload' src` → hook only; `rg 'showUnsavedWarning' src` → 4 panels; 23 new tests in `phase4.test.tsx` R5 block + `useUnsavedGuard.test.tsx` (5 tests), suite 167/167, build green. Scoped out by decision: SettingsModal 1s-autosave debounce window (separate ticket), CaptureModal, in-app Next.js client navigation (documented limitation — `beforeunload` covers browser unload only).

**Other Vercel-guideline items checked and confirmed already correct, stated plainly so they aren't redone unnecessarily:** `TaskAddPanel`'s Save button already shows a loading indicator and disables during submission (`isSubmitting || !isValid`) — this specific guideline item is already satisfied, no ticket needed.

### 22.3 — Reference-image and reference-app synthesis

Six images and two named reference apps (How We Feel, and the "Exoplan"/calendar-app-style images already partially reflected in earlier passes) were reviewed together, not as isolated mood-board pieces, to extract patterns applicable to Presense specifically:

1. **The frosted sidebar/menu (reference image showing Feed/Stats/Messages/Setting/Profile)** is a clean, direct example of `DS-29`'s Glassmorphism 2.0 language applied to exactly the kind of compact vertical menu Presense's own sidebar is — soft, even frost, generous corner radius, icon+label rows with even vertical rhythm, no visual noise beyond the frost itself. This is a good concrete reference for **the sidebar specifically** once `DS-29` lands — the sidebar's own background could adopt this same frosted-over-photo/gradient treatment rather than a flatter dark fill, consistent with pillar 1 ("atmosphere over flatness").
2. **The iOS-style mode picker (Do Not Disturb / "For an hour" / "For Today" / "Until This Weekend" / "Until Goals Met")** is a strong, concrete reference for how Presense's own quick-toggle affordances should look — a small glass card, a row of icon-only mode buttons at the top, then a simple list of duration/preset options below with a checkmark on the active one. This is a better visual model for `Dropdown`'s **select variant specifically** than the current implementation — worth revisiting once `BUG-31`'s scroll/type-ahead fix lands, as a follow-up visual polish pass on that same component.
3. **The timeline/schedule app ("Exoplan")** with color-coded task blocks and a circular progress ring is directly relevant to `FEAT-01`'s Weekly Review surface (§21.1) — a compact circular "percent of week planned/completed" indicator, similar to this reference's top-right ring, is a good concrete shape for that feature's at-a-glance summary, again without adopting any streak/gamification mechanic, consistent with `CONF-17`'s resolution — the ring communicates completion, not a score or a chain to protect.
4. **The calendar app screenshots (month view with per-day colored line indicators; day view with left-border-accent colored event blocks and avatar stacks)** is directly relevant to `CONF-08`'s planned calendar rewrite — specifically, the pattern of a **left-border accent color plus avatar stack on an event block**, rather than a fully-filled colored block, is worth adopting for Presense's own calendar task chips once that rewrite starts: it reads as calmer and more legible at a glance than a solid color fill, and pairs naturally with `DS-28`'s new space-color system (the border color communicates space/category without needing to tint the entire block).
5. **The "Your month at a glance / Path progress 97%" check-in card** is a clear, directly-relevant reference for `FEAT-01`'s weekly review card specifically — a soft photographic/gradient background, one clear progress bar, one clear call-to-action ("Let's Go" equivalent) — this maps well onto a "Week in Review" entry point already visible in Presense's own Home screenshot from an earlier pass, which currently is just a plain button; this reference suggests giving that specific entry point its own small preview card treatment rather than a bare button, once `FEAT-01` is built.
6. **How We Feel**, per the app's own documented flow (a Medium UX case-study's direct wireframe breakdown of its daily check-in) and its broader, widely-observed design reputation: a small number of screens, one primary action per screen, color used as the primary carrier of meaning rather than as decoration on top of an otherwise neutral UI, and an onboarding/check-in flow that stays inside a strict, disciplined visual system (the case study specifically notes its designer had to work hard to stay disciplined within a constrained palette, which sharpened the hierarchy rather than loosening it). The lesson for Presense is not "add mood-tracking" — it's the **discipline** itself: resist the urge to add a decorative icon, an extra color, or an extra card treatment to a screen unless it's actually carrying meaning, which is the same discipline this document's own `DS-15`/`DS-17` (locked Tailwind theme, component manifest) already exist to enforce structurally, and is worth citing explicitly as the design *rationale* behind those two tickets, not just a process requirement.

**DS-32 — Adopt reference-informed refinements: frosted sidebar treatment, mode-picker-style select dropdown, and left-border-accent calendar chips**

- **Priority:** Medium (visual polish, sequenced after the structural fixes it depends on)
- **Requirement:** (1) Once `DS-29` ships, apply its frosted/grain treatment to the sidebar's own background, per reference image 1. (2) Once `BUG-31` ships, revisit `Dropdown`'s `select` variant's visual treatment toward the mode-picker reference (icon-row header where applicable, checkmark-on-active-row list). (3) Once `CONF-08`'s calendar rewrite starts, use left-border-accent + avatar-stack task chips rather than fully-filled color blocks, pairing naturally with `DS-28`'s new derived space colors.
- **Depends on:** `DS-29`, `BUG-31`, `CONF-08` (each sub-item depends on its own prerequisite — this ticket does not gate any of them, it's the follow-up polish once each lands).

### 22.4 — Settings field audit, executed (not just described) — completing `INFRA-20`

Every field currently in `SettingsModal.tsx` was enumerated directly: Sign Out, Display Name, Timezone, Delete Account, Color Mode, Density, Reduce Motion, Quiet Start, Morning Nudge, Evening Shutdown, Auto-Archive Completed (plus Theme selection and Export Data, present elsewhere in the same component). Per `CONF-14`'s already-settled resolution, Quiet Start and the Morning Nudge/Evening Shutdown pair collapse to two fields (morning and evening ritual time only); Timezone becomes auto-detected-with-advanced-override rather than a primary field. Of the remainder: **Density** was already flagged in the original 20-item skip list (from an early pass of this document) as a "Linear needs this, Presense doesn't" candidate for removal — this audit confirms that recommendation should actually be acted on now, not just noted, since it has sat un-actioned since it was first suggested; **Auto-Archive Completed** is a genuinely useful, load-bearing preference (it changes real behavior, matches a real pattern in comparable tools) and should stay. This is the concrete output `INFRA-20` asked for — a per-field verdict, not a method description.

### 22.5 — What this pass could not settle

`FEAT-01`'s underlying data availability (whether task-completion timestamps are actually retained in a queryable form) still needs a direct schema check before implementation starts — flagged in §21.1, not yet resolved here. Everything else in this addendum was either confirmed by direct code reading or is design guidance drawn from a stated, named source, per the standard this document has held throughout.

---

## 23. Addendum 11 — final gap check: two items were tracked as evidence but never became their own fix tickets

This addendum exists because a direct re-grep of this document against the original 29-item list found two items that were cited as *supporting evidence* for other tickets but never got their own concrete fix ticket — a real gap, not a restatement. Both are added now. Everything else in the original 29-item list, and every item repeated across the four follow-up messages, was re-checked line by line against this document's current content; the full item-by-item confirmation is in the reply accompanying this update, not duplicated here.

**BUG-43 — Settings still has one native `<select>` and four native `type="time"` inputs, never given their own migration ticket (item #9)**

- **Priority:** High
- **Files:** `src/components/features/SettingsModal.tsx` — `<select>` for Auto-Archive Completed (line ~1417), `type="time"` inputs at lines ~1026, ~1039, ~1303, ~1323 (Quiet Start, Quiet End, Morning Nudge, Evening Shutdown)
- **Root cause:** These were found and cited as evidence while investigating `BUG-31` (the Dropdown scroll/position bug) and while resolving `CONF-14` (collapsing the ritual-time fields), but neither of those tickets actually required migrating these specific native elements — `BUG-31` only fixed the shared `Dropdown` component itself, and `CONF-14` only said *which* time concepts survive, not what component the surviving two should use. The native elements were never actually put on anyone's list to fix.
- **Requirement:** (1) Auto-Archive Completed's native `<select>` becomes a `<Dropdown variant="select">`, consistent with the app-wide rule that native `<select>` is never used. (2) Once `CONF-14` collapses the four time fields to two (morning ritual time, evening ritual time), both use a custom time-picker built on the same `Dropdown`/`Popover` portal infrastructure — not a native `<input type="time">`, which renders the browser's own picker UI and cannot be restyled to match this app's design system, the same platform limitation that already justified replacing `<datalist>` in `BUG-25`/`BUG-33`.
- **Acceptance criteria:** Zero occurrences of `<select` or `type="time"` remain in `SettingsModal.tsx`; both are visually and behaviorally consistent with every other dropdown in the app, including `BUG-31`'s scroll/type-ahead fix.
- **Depends on:** `CONF-14` (for the time fields' final count), `BUG-31` (share its fix, don't reimplement).

**BUG-44 — People, Explore, and Think list cards have no pointer-accessible delete affordance — swipe-only, or none at all (item #16)**

- **Priority:** High
- **Files:** `src/app/(app)/remember/people/page.tsx`, `src/app/(app)/explore/page.tsx` (both: swipe-to-reveal-delete exists, confirmed via a `Trash2` icon revealed by a drag gesture — but there is no equivalent affordance for a mouse/trackpad/keyboard user, who cannot perform a touch swipe at all), `src/app/(app)/think/page.tsx` (no delete affordance found on the list card itself at all — only reachable, if at all, from inside a thread's own detail page)
- **Root cause:** This app's own design system (§8.5, already written) requires every gesture-driven interaction to have a pointer/keyboard equivalent producing the identical result — swipe-to-delete alone violates that rule for every desktop user of People and Explore, and Think doesn't even have the swipe version.
- **Requirement:** Add a small, hover-revealed (desktop) / always-swipeable (touch) delete icon to every list row across People, Explore, and Think, positioned at the row's trailing edge with enough spacing from any other inline action (avatar, chevron, timestamp) that it can't be mis-tapped — per the original request's own phrasing, "optimal placement... does not overlap with other elements." Every delete action, regardless of entry point (icon click, swipe, or from inside a detail view), routes through the same `ConfirmModal` and the same `item-lifecycle.ts` soft-delete function (`BUG-08`'s already-established single-path rule) — no space gets its own bespoke confirm-or-not behavior.
- **Acceptance criteria:** A mouse-only user (no touchscreen) can delete a row in every one of People, Explore, Think, Do, and Locations without needing a swipe gesture. Every deletion, from every entry point, shows the same confirmation dialog and produces the same soft-delete/undo/trash behavior.
- **Depends on:** `BUG-08` (shared delete path).

---

## 24. Addendum 12 — audit July 9, 2026 unified findings cross-reference

This addendum exists to cross-reference the July 9, 2026 complete audit (`Presense_Full_Complete_Audit.md`, 2135 lines, 14-step audit by GLM-4.6) against this document's ticket history. The audit consolidates this document's open tickets into 8 root patterns and a 46-item P0/P1/P2 roadmap with 10 quick wins. The audit's findings are consistent with this document's §17.3 ticket sweep — no contradictions, only consolidation.

### 24.1 — The 8 root patterns (audit framing, mapped to this document's tickets)

| Root pattern | Audit name | This document's tickets | Status |
|---|---|---|---|
| 1 | Silent Data Loss (Critical, trust-breaking) | BUG-38 + 37/71 unchecked mutations (BUG-34 closed Aug 10, 2026) | **CLOSED Aug 10, 2026** — BUG-38 full pass landed in `660f5a3`; zero unchecked mutation sites remain (see ticket for the 10 fixed sites + 1 documented intentional exception) |
| 2 | Theme System Has a Broken Mode (Critical, unreadable) | warm-light `globals.css:336-420` missing `--text-*` overrides | **CLOSED Aug 10, 2026 — false positive.** Warm-light block has had dark-warm text overrides (`globals.css:374-381`) since `e6fd96b4` (July 5, pre-audit); verified live via computed styles on `/`, `/do`, `/inbox`, `/think`. Audit examined a stale state. |
| 3 | Mobile Viewport + Form Interaction Bugs (High) | ~~7 `h-screen`~~ (MOB-05 — **CLOSED Aug 10, 2026**, fixed in `8c249b6`), ~~BUG-36/39 Sheet drag~~ (~~**CLOSED Aug 10, 2026**, fixed in `ad79e81`~~), ~~BUG-41 input 13px~~ (~~**CLOSED Aug 10, 2026**, fixed in `globals.css:1366-1375`~~) | **CLOSED Aug 10, 2026** — all three verified fixed; see §24.7 sweep record |
| 4 | Design System Fragmentation (High, polish erosion) | 99 hardcoded hex (DS-02), 6 hover magnitudes (DS-30), 44 raw `<input>` (DS-03), 6 `type="time"` + 1 `<select>` + 1 `<datalist>` (BUG-43/25/33), 3 dashed-border tokens | Open — P1 |
| 5 | Settings + Schema Bloat (Medium, calm-identity erosion) | 9 unused notification booleans, 4 redundant time fields (CONF-14 decided, NOT implemented), Density (INFRA-20), 4 dead tables, 2 dead columns, `ritual_streak` contradicts CONF-17, `ollama_*` dead plumbing | Open — P1 |
| 6 | Missing Industry-Standard Flows (Strategic, competitive gap) | No calendar, no native apps, no AI, no semantic search, no command palette (DS-08), no weekly review (FEAT-01), no recurring task UI, no snooze UI, no linked-people UI, no bulk actions, no drag-between-spaces, no password reset, no magic link resend | Open — P2 |
| 7 | Incomplete Error Boundaries + Loading States (Medium) | 5 routes missing `error.tsx`, 5 missing `loading.tsx`, `ModalErrorBoundary` missing from 5 Sheet-based modals, 0 `aria-live`, ~~0 `beforeunload` (BUG-42)~~ (**CLOSED Aug 10, 2026** — `3e555a0`, see ticket), 0 skip-to-content (A11Y-03) | Open — P1 |
| 8 | CI/CD Has Minimum Viable Gates (Medium, shipping safety) | No visual regression, no a11y scan, no Lighthouse, no bundle budget, no error tracking (TOOL-06), no E2E user-flow tests, no RLS automated test suite (TOOL-18), commit messages are GUIDs | Open — P1 |

### 24.2 — The 10 quick wins (audit §11(b), <1 day each)

1. ~~Replace 7 `h-screen` with `h-dvh` (MOB-05)~~ — **DONE** — verified fixed in commit `8c249b6` (July 7, 2026); zero `h-screen`/`100vh` in src (checked Aug 10, 2026)
2. ~~Fix Sonner `theme="system"` → bind to `data-mode` (BUG-32)~~ — **DONE** — ToastProvider binds `theme` to `data-mode` via MutationObserver (verified Aug 10, 2026)
3. ~~Set input font-size 16px on mobile (BUG-41)~~ — **DONE** — `globals.css:1366-1375` "T5-3: iOS input zoom fix" 16px floor on mobile (verified Aug 10, 2026)
4. ~~Add skip-to-content link (A11Y-03)~~ — **DONE** — `(app)/layout.tsx` (verified Aug 10, 2026)
5. ~~Fix `dismissInboxItem` error check (BUG-34)~~ — **DONE (Aug 10, 2026)**, incl. live-DB constraint fix (migration 005 was never applied to production)
6. ~~Fix Think "New thread" to show toast on error (BUG-29)~~ — **DONE** — `think/page.tsx` `handleNewThread` toasts on error (verified Aug 10, 2026)
7. Add Pomodoro launcher to sidebar header (DS-21)
8. Replace brand mark with proper SVG (DS-26)
9. ~~Fix warm-light theme text overrides (Root Pattern 2)~~ — **DONE (verified Aug 10, 2026)** — was a false positive: overrides exist since `e6fd96b4` (July 5)
10. Remove `ritual_streak` column (new migration)

### 24.3 — Ticket status reconciliation (audit July 9, 2026 vs this document's §17.3)

**Resolved tickets confirmed by audit:** BUG-01 (hover sidebar), BUG-03 (dropdown portal, re-fixed after regression), BUG-06/07 (themes = warm/navy/forest), BUG-10 (profile row fallback), BUG-15 (theme leaks via localStorage), BUG-26 (chrono duplicate import), BUG-27 (dropdown portal regression re-fixed), PERF-01 (unmemoized Do-page handlers), PERF-07 (refetchOnWindowFocus), TOOL-07 (content-visibility wiring), TOOL-03 (React Hook Form in SettingsModal), TOOL-15 (Floating UI adopted in Dropdown/Popover). **Resolved since the audit:** BUG-34 (inbox dismiss — Aug 10, 2026, see ticket; root cause was migration 005 never applied live), BUG-38 (unchecked mutations — Aug 10, 2026, full pass, see ticket), BUG-42 (unsaved-changes guards — Aug 10, 2026, `3e555a0`, see ticket). **Resolved since the audit, verified in code Aug 10, 2026 (see §24.7 sweep record):** MOB-05, BUG-41, BUG-36/39, BUG-32, BUG-29, BUG-35/37, BUG-40, BUG-23, BUG-25/33, BUG-43, BUG-30, BUG-31, DS-14, A11Y-03, ROOT PATTERN 7 error/loading files.

**Open tickets confirmed by audit:** BUG-02 (ritual stale time — audit does not explicitly confirm, may still be open), BUG-08 (archive/delete inconsistency — in progress via item-lifecycle.ts, not fully verified), BUG-09 (capture modal lag — partially resolved, dynamic imports applied), BUG-11 (Settings scroll on Think/Explore — not verified), BUG-44 (no pointer delete — open). ROOT PATTERN 4 (hardcoded hex — 136 in `.tsx` as of Aug 10, 2026, was 99 at audit), DS-30 (translateY lift — partially violated, 6 hover magnitudes still present). ROOT PATTERN 7 partial: `ModalErrorBoundary` missing from AddPersonPanel, LocationAddPanel, ExploreDrawer, TaskAddPanel, PomodoroTimer. DS-28 (OKLCH — spec only). DS-29 (Glassmorphism 2.0 — spec only). FEAT-01 (Weekly Review — not started).

### 24.4 — New audit findings not previously tracked in this document

The audit introduces the **ROOT PATTERN** framing as a consolidation tool. This document's ticket structure (BUG-*/DS-*/A11Y-*/MOB-*/INT-*/PERF-*/INFRA-*/TOOL-*/MD-*/CONF-*) is preserved; the root patterns are a cross-reference layer, not a replacement. No new ticket IDs are introduced by the audit — every audit finding maps to an existing ticket.

### 24.5 — The single most important fix (audit final verdict)

Per the audit's final verdict: **"Build the `mutate()` wrapper and migrate all 37 unchecked Supabase mutations."** This was the data-integrity weakness that made the app untrustworthy for daily use. **DONE Aug 10, 2026** — BUG-38 landed (commit `660f5a3`): the `safeMutate()` wrapper already existed and the remaining 10 unchecked sites were migrated to it; every mutation in the app now succeeds visibly or fails visibly. See `docs/project/DOCS_NEEDS_CODE.md` for the migration record.

### 24.6 — The single most important decision (audit final verdict)

Per the audit's final verdict: **"What is Presense's competitive positioning?"** Three options:
1. **"Open-source Sunsama"** — pursue calendar integration, native apps, weekly review (FEAT-01). Compete on calm + open-source.
2. **"Personal second-brain"** — pursue semantic search, AI features, linked-note graph. Compete on knowledge management.
3. **"Solo dev's personal tool, shared publicly"** — accept current scope, focus on data integrity + design polish, don't pursue strategic features. Honest positioning.

Each path implies a different roadmap. Pick one before pursuing Strategic-tier items (P2).

### 24.7 — Verification sweep: audit tickets already fixed in code but still documented as open (Aug 10, 2026)

Same failure mode as root patterns 1 & 2: the July-9 audit and later passes examined states that no longer exist. A read-only sweep verified each ticket against current code with command evidence. **No code was changed for any row below.**

| Ticket | Audit claim | Current state (verified Aug 10, 2026) | Evidence |
|---|---|---|---|
| MOB-05 (100dvh) | 6 files still `h-screen` | **Fixed** | Commit `8c249b6` (July 7); `rg 'h-screen\|100vh' src` = 0 hits, 9 `h-dvh`/`min-h-dvh` sites |
| BUG-41 (input 13px) | iOS auto-zoom | **Fixed** | `globals.css:1366-1375` "T5-3: iOS input zoom fix" — `max(16px, var(--text-body-lg))` floor on mobile |
| BUG-36/39 (Sheet drag) | `drag="y"` swallows taps, 7 consumers | **Fixed** | `Sheet.tsx:59-61` — dedicated drag handle + `dragListener={false}` (commit `ad79e81`) |
| BUG-32 (Sonner theme) | `theme="system"` | **Fixed** | `ToastProvider.tsx` binds `theme` to `data-mode` + MutationObserver |
| BUG-29 (new-thread fail) | silent fail | **Fixed** | `think/page.tsx:148-151` `toast.error` on insert error; `color_accent` real hex `#E5B41E` (audit's §17.4 open question answered) |
| BUG-35/37 (empty-state buttons) | open CaptureModal | **Fixed** | Zero `setCaptureModalOpen` in `think/page.tsx`/`explore/page.tsx`; both use `handleNewThread` |
| BUG-40 (Locations empty state) | hand-rolled `<h3>` | **Fixed** | `locations/page.tsx:123` uses `EmptyState` |
| BUG-23 (page transitions) | no `template.tsx` | **Fixed** | `src/app/(app)/template.tsx` exists |
| BUG-25/33 + BUG-43 (datalist/select/time) | 6 native `type="time"` + 1 `<select>` + 1 `<datalist>` | **Fixed** | `rg '<datalist\|<select\|type="time"' src` = 0 hits |
| BUG-30 (autosave loop) | loops forever | **Fixed** | `SettingsModal.tsx:425-429` `lastSavedSettingsRef` guard + `useDebounce(settings, 1000)` |
| BUG-31 (dropdown type-ahead) | no scroll/type-ahead | **Fixed** | `Dropdown.tsx:43-121` key-buffer type-ahead |
| DS-14 (reduced motion) | transform not stripped | **Fixed** | `globals.css:1131-1146` strips `hover:scale`/`hover:-translate`/etc. (`transform: none !important`) |
| A11Y-03 (skip link) | absent | **Fixed** | `(app)/layout.tsx` sr-only skip-to-content link |
| ROOT PATTERN 7 (error/loading) | 5 routes missing `error.tsx`/`loading.tsx` | **Fixed** | 5 `error.tsx` + 5 `loading.tsx` at `(app)`, `do`, `explore`, `remember`, `think` — leaf routes (`inbox`, `trash`, `[id]` pages) now inherit |

**Still open after the sweep:** ROOT PATTERN 4 (136 hardcoded hex in `.tsx`, was 99), DS-30 (6 hover magnitudes), ROOT PATTERN 7 partial (`ModalErrorBoundary` only in CaptureModal/SearchModal/SettingsModal), BUG-02/08/09/11 (unverified — audit itself was unsure), DS-28/29, FEAT-01, ROOT PATTERN 5/6/8. (BUG-42 was open at sweep time and **closed later the same day** — `3e555a0`, see ticket.)

---

## 25. Meta-finding — documentation overhead (audit W12)

The audit flags this document itself as **W12: "Documentation overhead exceeds personal-project scope — 8 governance files + 1684-line EXECUTION_SPEC.md + 349-line DESIGN_SYSTEM.md. No comparable OSS personal project (Anytype, Reor, Amplenote) has this much process."**

This is an acknowledged trade-off: the governance system exists because the project has experienced repeated regressions (env.ts throwing, dropdown portal removed, theme renamed 3 times, BUG-34 silent data loss). The audit's own §S7 lists "Hard-invariant governance prevents regression" as a genuine differentiator: "More rigorous than any comparable OSS project."

**Recommendation:** Trimming governance should only happen AFTER P0/P1 tickets land and the app is stable. Do not trim this document pre-emptively. The 8 root patterns and 10 quick wins in §24 are the prioritization framework — work through those first, then consider governance reduction once the app is trustworthy for daily use.

The current doc count is 10 md files (post-MD-01/MD-02 consolidation, with `docs/project/DOCS_NEEDS_CODE.md` added as the bridge between docs and code). The audit's "8 governance files" count refers to the pre-`DOCS_NEEDS_CODE.md` state. The new file is intentionally small and focused — it does not add governance overhead, it routes code-fix needs to a single discoverable location.

---

## 26. Addendum 13 — measured performance baseline (Aug 8, 2026 audit)

First-ever measured baseline for PERF-* work. Prior tickets were confirmed open/closed by code reading; none of them had measured numbers behind them. This pass recorded them. All measurements: local prod build (`next build --webpack`), `next start` on localhost, no external traffic. Lighthouse: headless Edge via `CHROME_PATH`; `--preset=perf` (run 1) and `--preset=experimental` (run 2). Interaction trace: Playwright Chromium at 390×844, 3x DPR, CPU throttle 4x, 150ms latency / 1.6Mbps down / 800Kbps up; longtasks via injected `PerformanceObserver`.

**Caveat, stated plainly:** every route is auth-gated by the middleware, so the only publically measurable route is `/login` (all unauthenticated paths serve the same 17-script chunk set — verified identical for `/`, `/do`, `/onboarding`). The Do page — the surface behind the "very laggy" report — cannot be Lighthouse'd or traced without an account. This confirms the RUM gap in Root Pattern 8: the Do page is exactly the route needing real-user monitoring because synthetic access is auth-blocked.

### 26.1 — Lighthouse mobile, `/login`

| Metric | Run 1 (perf preset) | Run 2 (experimental) | Good threshold |
|---|---|---|---|
| Performance score | 89 | 87 | ≥ 90 |
| FCP | 2.1 s | 1.2 s | ≤ 1.8 s |
| LCP | **2.1 s** | 3.8 s | ≤ 2.5 s |
| CLS | 0 | 0 | ≤ 0.1 |
| TBT | **360 ms** | 150 ms | ≤ 200 ms |
| TTI | 4.0 s | 3.9 s | — |
| TTFB | 20 ms | 20 ms | — |

Run-to-run spread (LCP 2.1↔3.8s, TBT 150↔360ms) is itself a finding: numbers are not stable, and any future fix must beat this variance or be reverted per §26.5.

`unused-javascript` scores 0: **~115 KiB wasted** on login alone (60.3 KiB chunk 5967, 28.0 KiB 5838, 26.5 KiB 4bd1). `long-tasks` audit: 3 long tasks. `mainthread-work-breakdown` total 1.1–1.2 s.

### 26.2 — Bundle (webpack + bundle analyzer)

Public route initial JS: **17 scripts, 923.1 KiB parsed / 272.9 KiB gzipped — 27% over the 200 KiB gz budget** (Root Pattern 8: no enforced budget in CI).

Largest client chunks:

| Chunk | Parsed | Gzip | Attribution |
|---|---|---|---|
| 2923 | 337.1 KiB | 130.0 KiB | `compromise` (NLP) |
| 5967 | 281.5 KiB | 77.8 KiB | `@supabase` (~113 KiB) + `zod/v4` (~70 KiB) + sonner, postgREST/storage/realtime |
| 5838 | 221.8 KiB | 60.4 KiB | Next app-router internals |
| 4bd1 | 195.2 KiB | 61.3 KiB | next/compiled react-dom |
| framework | 185.3 KiB | 58.4 KiB | Next framework |
| 9746 | 162.1 KiB | 38.0 KiB | `chrono-node` |
| main | 134.2 KiB | 39.2 KiB | Next client router |

**`BUG-09` / `PERF-02` closes on measurement.** `compromise` (capture-router.ts:102) and `chrono-node` (capture-router.ts:256, TaskAddPanel.tsx:23) are both dynamic imports, and neither chunk (2923, 9746) appears in the public route's initial 17-script set — the lazy split works at the chunk level, not just in source. Residual (future, not a defect): `compromise`'s 337 KiB parsed chunk is still monolithic.

### 26.3 — Interaction trace (Playwright, CPU 4x)

- Commit 62 ms; networkidle 919–1110 ms; LCP paint at 376 ms.
- **Longtasks during load: 101 ms @ 231 ms; 226 ms @ 341 ms; 163 ms @ 659 ms.** 490 ms of main-thread blocking inside a sub-second load; the 226 ms bloat at t≈341 ms is a 200 ms+ starvation window on a 4x-emulated mid-tier phone.
- Fill-email interaction: 425 ms wall-clock, no new longtasks attributed to it.
- No longtasks after 919 ms → the tab reaches steady-state idle; the felt "lag" is load-phase main-thread starvation plus the unmeasured Do page — not steady-state background work.

### 26.4 — New tickets recorded by this pass

**PERF-09 — Enforce a bundle budget in CI on the public route.** `ANALYZE=true next build --webpack` already produces reports; nothing fails a PR on them. Baseline 272.9 KiB gz vs 200 KiB GA budget. Acceptance: CI gate fails PRs that push any production route over its budgeted number; threshold = current baseline, tool choice deferred. Priority: Medium.

**PERF-10 — Decide whether login's 115 KiB of unused JS is shared fixed-cost or auth-only weight.** The 115 KiB sits in the three largest shared chunks (5967/5838/4bd1) that login downloads; if auth-gated features are the only consumers, split 5967 (supabase+zod bundle, 77.8 KiB gz) further so login doesn't download the full client SDK. Acceptance: public-route initial gz ≤ 220 KiB without adding requests elsewhere. Technique-agnostic; blocked on a measurement path for authed routes.

**PERF-11 — Hold TBT ≤ 200 ms / LCP ≤ 2.5 s on the public route.** TBT measured 360 ms; LCP straddles the line. This ticket is the ledger that judges any future fix against §26.5 instrumentation — no unmeasured wins, no "neutral" keeps.

**INFRA-NEW (candidate BUG ticket) — `npm run build`'s `prebuild` gate is broken on a clean tree.** `types:check` fails identically at HEAD: live Supabase schema dropped `ritual_streak` (CONF-17), committed database.types.ts still has it; regeneration removes exactly 3 lines, diff is otherwise empty, zero code references `ritual_streak`. Any fresh checkout can't `npm run build`. This pass deliberately did NOT commit the regenerated file (not my ticket); flagged here for a human. Priority: High (CI/build red).

**NOTED (not ticketed) — auth-blocked measurement.** Measuring the Do page requires either a seeded test account (Turbo/Playwright flow, TOOL-18 territory) or a RUM layer (Root Pattern 8). Reader of the next PERF ticket shall pick one, not both.

### 26.5 — The ledger (kept + reverted attempts), started with this pass

| Idea | Baseline → Result | Verdict | Why |
|---|---|---|---|
| — | none — baseline pass only | — | no fix attempted yet |
| PERF-10a: login auth via server actions + supabase-free RealtimeStatusContext | Login initial JS gz: 272.9 → 186.9 KiB (analyzer, polyfills excluded; manual gz incl. polyfills 311.9 → 225.3) · Lighthouse perf 89→95, TBT 360→190 ms, unused JS 115→53 KiB · scripts 17→16 · chunk 5967 gone from login, app-only 5041 (68.8 KiB) remains | KEPT (0b73f2b) | ≥31% bundle cut on the only measurable route; authed chunk set unchanged; magic-link traced working; well outside run variance |
| PERF-10b: move app-only providers (Tooltip, NuqsAdapter, ConnectionStatus, UpdatePrompt) from root layout to `(app)/layout.tsx` | Login initial JS gz: 186.9 → 164.2 KiB (analyzer, polyfills excluded; manual incl. polyfills 225.3 → 202.7) · scripts 16→13 · nuqs/Tooltip/ConnectionStatus chunk gone from login entirely · Lighthouse perf 94, TBT 222 ms, LCP 1.94 s · `unused-javascript` now flags only framework chunks (5838 app-router 47%, 4bd1 react-dom 43% — not app-reclaimable) with metricSavings FCP/LCP = 0 ms | KEPT (4e08da9) | −22.7 KiB (−12%) on the measurable route with zero app-level waste left; first Lighthouse run (88/314 ms) was cold-server variance, second run confirms parity with PERF-10a |
| PERF-11: "eliminate the 226 ms @ 341 ms load longtask" — closed as framework fixed-cost, no code change | CDP trace + Lighthouse attribution: the baseline's 226 ms @ 341 ms task WAS chunk 5967 (supabase+zod eval) — already removed from login by PERF-10a (early evals now 105–159 ms, none >200 ms pre-LCP). Remaining >200 ms task = chunk 5838 (Next app-router internals, 227 KiB raw / 60.4 KiB gz, pure framework verified by probe), evaluates 209–241 ms @ ~1.7–3.0 s, Lighthouse metricSavings FCP/LCP = 0 ms. TBT on HEAD: 196/258 ms vs §26.1 baseline 150/360 ms — inside the baseline's own run-to-run spread | CLOSED (ledger only, human-approved) | Target longtask already gone via PERF-10a; only remaining >200 ms task is Next internals with zero metric savings — surgery (splitChunks) would add a request, risk router runtime ordering, and not reduce main-thread work |
| PERF-09: CI bundle-budget gate (PERF-09) — `scripts/check-budgets.mjs` + `perf-budgets.json`, wired into `.github/workflows/ci.yml`; Lighthouse gate delivered as `perf-lh-budget.json` + `lighthouse-authed.mjs --budget` | Gate method: fetch each budgeted route's HTML from the prod server, take its `<script src>` set (the §26.2-authoritative initial JS), gzipSync each built file from disk, compare vs budget. Measured baseline on the gate's own method: `/login` 164.3 KiB gz excl. polyfills, 13 scripts, 38.7 KiB polyfills (matches ledger 164.2). Budget set at baseline + margin = 165 KiB. Verified: deliberate 160 KiB budget FAILS (exit 1), baseline PASSES (exit 0) | KEPT (da6dc33, Aug 9 2026) | only public route is /login (src/proxy.ts gates everything else); budget is defined against webpack builds only (turbopack chunks differently — CI gates with `ANALYZE=true next build --webpack`); Lighthouse gate kept opt-in because perf metrics need real Supabase creds and run-to-run variance (LCP ±45%, TBT ±58%) would make a hard CI gate flaky |
| PERF-12 fix 1: read session from cookies (`getSession()`) in `(app)/layout.tsx` instead of a second `getUser()` auth-server round trip | File-probe attribution (temp instrumentation, reverted): TTFB was 100% network-latency — `getUser` ~310 ms + `user_settings` ~610 ms serial, SSR render only ~60 ms (probe log: createClient 1-13 ms, getSession 3-22 ms, user_settings 300-360 ms after fix). **TTFB 0.92 → 0.62 s warm (curl, deterministic); Lighthouse TTFB 1010/1470 → 690/760 ms, FCP 2.3/2.8 → 2.0/2.1 s, LCP 8.1/7.6 → 7.3/7.3 s, TBT 470/510 flat, perf 46/50 → 50/51** | KEPT (c611f4e, Aug 10 2026) | safety: the proxy already validated the session via `getUser()` on every request before the layout runs, so trusting the cookie session in the layout adds no new trust boundary (a forged cookie fails proxy validation → /login); RLS untouched. LCP/TBT deltas are inside §26.1 run variance; TTFB/FCP gains are deterministic and outside it |
| PERF-12 fix 2: lazy-load `TaskAddPanel` + `CalendarView` on `/do` (`next/dynamic`, `ssr: false, loading: null`, same pattern as DynamicModals) | Initial script set (turbopack build, HTML `<script src>` method): **33 → 28 scripts, 541.7 → 489.6 KiB gz on `/do` (deterministic, −52.1 KiB ≈ −10%)**; webpack analyzer confirmed both are self-contained entrypoints (TaskAddPanel+react-hook-form ~19.9 KiB gz, calendar.mjs+date-fns ~28.4 KiB gz). Lighthouse 2 runs: perf 53/55 (was 50/51), LCP 6.7/6.4 s (was 7.3/7.3), TBT 440/450 ms (was 470/520), FCP/TTFB flat | KEPT (235a234, Aug 10 2026) | panels are closed-by-default dialog / third segmented view — zero SSR/hydration cost when unused; behavior verified via throwaway Playwright run (Add-task dialog + Calendar view both load on demand); script/gz reduction is deterministic and well outside variance; LCP/TBT directionally better, still inside variance |
| PERF-12 task 4: cut remaining `user_settings` SSR round trip + shared chunk 0cau6ws9nif22 | **Option A (approved): no code change — closed with attribution.** TTFB split (temp probe header, reverted): proxy `getUser()` 293–366 ms (mean ~323) + layout `user_settings` ~300–360 ms + render ~60 ms = 0.61–0.63 s warm (both architectural: per-request token-revocation security boundary + SSR onboarding gating). Shared chunk 0cau6ws9nif22 (233 KB raw / ~64 KiB gz, 1.43 s eval, ALL `(app)` routes): post-task-3 webpack shell = 16 chunks / 168.5 KiB gz (supabase 68.8 + framer-motion 21.7 + nuqs 6.7 + RealtimeProvider 4.3 + app shell ~59) — invariant-required providers + supabase, turbopack merging not app-configurable, no page-specific literals in chunk | CLOSED attribution (no code, Aug 10 2026) | both remaining costs are deliberate design (security boundary + SSR gating) or framework chunking; option B (TTL cache + client reconcile) analyzed but rejected for staleness complexity vs ~300 ms gain; plan + evidence in `tasks/plan.md`, §28 |

The next perf fix must be re-measured exactly as §26.1 (same command, route, throttling), one change at a time. Revert if within run variance (here: LCP swing ≈ ±45%, TBT swing ≈ ±58%), revert if a test goes red, and record it whether kept or reverted — this table is the place where dead perf ideas stay dead.

---

## 27. Addendum 14 — approved execution plan for measured perf work (Aug 8, 2026)

Approved by human Aug 8, 2026. Sequential phases grounded in the §26 baseline. One ticket per session per `docs/agents/EXECUTION_RULES.md` (build + test + commit + stop). Each phase re-measures with the §26.1 instrumentation exactly; inside-variance or red-test results are reverted and recorded in the §26.5 ledger.

**Locked decisions:** (1) INFRA-21 resolved by committing the regenerated `database.types.ts`; (2) authed-route measurement via seeded test account + Playwright flow (TOOL-18 territory); (3) plan persisted here, not `tasks/plan.md` (that filename is stale debris per AGENTS.md).

### Task list

| # | Ticket | Title | Acceptance criteria (measurable) | Depends on |
|---|---|---|---|---|
| 1 | INFRA-21 | Regenerate `database.types.ts` to match live DB | `npm run types:check` passes on clean tree; diff = `ritual_streak` removal only; zero code references (grep) | — | ✅ DONE |
| 2 | TOOL-18 | Seed test account + Playwright auth flow | Playwright test logs in and `/do` HTML contains `app/(app)/do/page-*.js` chunk; repeatable session-enabled Lighthouse run succeeds | 1 | ✅ DONE |
| 3 | PERF-10a | Split supabase+zod chunk (5967, 77.8 KiB gz) off public route | Public-route initial gz ≤ 220 KiB; authed chunk count unchanged; login flow traced working | 2 | ✅ DONE |
| 4 | PERF-10b | Reclaim measured-unused 115 KiB (5967/5838/4bd1) on login | `unused-javascript` no longer scores 0; initial gz target met | 3 | ✅ DONE |
| — | **Checkpoint A** | Re-measure §26.1; ledger update; human review before Phase 4 | numbers recorded in ledger; keep/revert verdicts per rule | 4 | ✅ DONE |
| 5 | PERF-11 | Eliminate the 226 ms @341 ms load longtask | TBT ≤ 200 ms on §26.1 instrumentation; no >200 ms longtask in trace | Checkpoint A | ✅ DONE (framework fixed-cost) |
| 6 | PERF-09 | CI bundle-budget + Lighthouse gate | Deliberately over-budget change fails CI; baseline builds pass | 5 | ✅ DONE |

**Deferred by measurement, not by preference:** `PERF-04`/`PERF-08` backdrop-filter — the §26 trace shows no steady-state jank (idle by ~919 ms); revisit when `DS-04` glass consolidation touches those surfaces, or if a future RUM trace implicates them.

**Status — Task 1 (INFRA-21) DONE, committed `b0a5196` (Aug 8, 2026):** regenerated `database.types.ts` via `npm run types:generate`; diff = exactly the 3 `ritual_streak` removals (column dropped in live DB); zero code references (grep); `npm run build` (incl. prebuild `types:check` gate) and `npm test` (144) pass.

**Status — Task 2 (TOOL-18) DONE, committed `a787421` (Aug 8, 2026):**
- `scripts/seed-test-user.mjs` — idempotent: upserts `perf-test@presense.app` (confirmed email, fixed test password, `user_settings.onboarding_complete=true`), signs in via password grant (works server-side even though the UI is magic-link/Google-only), prints the `@supabase/ssr` session cookie (`sb-<ref>-auth-token` = `base64-` + base64url(JSON session), single chunk, 2.6 KiB) for injection.
- `tests/authed-do.spec.ts` — injects the cookie, asserts `/do` returns 200, stays on `/do` (not bounced to `/login`), and loads the real `src_app_(app)_do_page_tsx`/`app/(app)/do/page-*` chunk with no login chunk. Passes.
- `scripts/lighthouse-authed.mjs` — `node scripts/lighthouse-authed.mjs [url]` = seed + cookie-inject + Lighthouse (mobile perf preset) + summary. Windows-safe (npx CLI chokes on inline JSON; uses `--extra-headers=<file>`).
- **First-ever authed `/do` baseline (mobile perf preset, prod server, Aug 8): perf 29/33, LCP 13.4–14.4 s, TBT 2.63–2.85 s, FCP 2.3–2.7 s, TTFB 1.1–1.5 s, CLS 0.013, unused-javascript ~93 KiB.** This is the real user-facing page the §26 login baseline (perf 89) could never see; subsequent authed measurements use this as the reference, instrumented identically.
- Note: full-suite `npm test` showed one flaky fail (`challenger.test.tsx` linked_people) that passes in isolation — unrelated to this change, flagged for a human.

**Status — Task 3 (PERF-10a) DONE, committed `0b73f2b` (Aug 9, 2026):**
- Login's magic-link/Google calls moved to server actions (`src/app/(auth)/login/actions.ts` via `supabase-server`) so `@supabase/supabase-js` + `zod` never enter the public-route client bundle; `RealtimeStatusContext` extracted to supabase-free `src/components/providers/realtime-status.tsx` so root-layout `ConnectionStatus` doesn't drag the client in either. Law 7 respected: 2 changed + 2 new files, no `@supabase/ssr` provider wiring touched.
- **Measured (identical analyzer method to §26.2, polyfills excluded in both): login initial JS gz 272.9 → 186.9 KiB (−31.5%); ≤ 220 KiB target met; 17 → 16 scripts; chunk 5967 gone from login, app-only 5041 (68.8 KiB) remains.** Manual gzip incl. polyfills: 311.9 → 225.3 KiB (same −28%).
- Lighthouse login: perf 89 → 95, TBT 360 → 190 ms, unused JS 115 → 53 KiB. Authed `/do` chunk set unchanged (authed-do test green); magic-link traced through the server action (`tests/login-trace.spec.ts`). `npm test` 144/144, `npm run build` green. Ledger: §26.5.
- Note: `RealtimeProvider.tsx` lint error surfaced during commit (eslint-disable for `channelsRef` displaced by the extraction) — fixed with a re-applied disable comment; the `err` unused warning is pre-existing (present at HEAD).

**Status — Task 4 (PERF-10b) DONE, committed `4e08da9` (Aug 9, 2026):**
- Moved app-only providers from root layout into `(app)/layout.tsx`: `TooltipProvider`, `NuqsAdapter` (only `(app)/do` + CalendarView use `useQueryState`), `ConnectionStatus`, `UpdatePrompt`. Root layout keeps `ToastProvider` (onboarding, which is outside `(app)`, uses sonner) and `WebVitalsReporter` (global observability; it's the login-route telemetry source). 2 files, no `@supabase/ssr` wiring, no invariant touched — same technique family as PERF-10a ("auth-only client on public routes").
- **Measured (same method as §26.2/PERF-10a, polyfills excluded): login initial JS gz 186.9 → 164.2 KiB (−12%); scripts 16 → 13; the nuqs/Tooltip/ConnectionStatus/UpdatePrompt chunk is gone from login's script set entirely.** Manual gzip incl. polyfills: 225.3 → 202.7 KiB.
- Lighthouse login (2 runs; first was cold-server variance): perf 88→94, TBT 314→222 ms, LCP 2.29→1.94 s, `unused-javascript` scores 0.5 (was 0 at §26 baseline) and now flags only framework chunks — 5838 (Next app-router internals, 47% wasted) and 4bd1 (react-dom, 43% wasted) — with metricSavings FCP/LCP = 0 ms: nothing left to reclaim at app level.
- Authed `/do` chunk set unchanged (`authed-do.spec.ts` + `login-trace.spec.ts` pass); `npm test` 144/144; `npm run build` + lint green. Ledger: §26.5.

**Status — Checkpoint A DONE (Aug 9, 2026), §26.1 re-measured on HEAD (`4e08da9`), 2 perf-preset runs:** perf 95/93 (baseline 89/87) · FCP 1.9/1.9 s · LCP 1.9/1.9 s (baseline 2.1/3.8) · TBT 196/258 ms (baseline 360/150) · TTI 3.3/3.4 s · CLS 0 · TTFB 30/25 ms · `unused-javascript` 0.5 (only framework chunks, 0 ms metric savings) · mainthread-work 1.29 s (baseline 1.1–1.2 s) · long-tasks: 3, at 171–176 ms @ ~1.39 s, 241–296 ms @ ~3.0 s, 55–62 ms @ ~3.3 s (baseline: 101/226/163 ms @ 231/341/659 ms). The §26 baseline's 226 ms @ 341 ms longtask is gone from the load path — the remaining ~3.0 s longtask fires after LCP and is the largest. Phase-3 targets (login gz ≤ 220 KiB, unused-javascript off zero) both hold on HEAD.

**Status — Task 5 (PERF-11) DONE — closed as framework fixed-cost, no code change (Aug 9, 2026, human-approved):**
- **Attribution:** CDP trace (`scripts/trace-longtasks.mjs`, §26.3 instrumentation) + Lighthouse `long-tasks` audit + V8 probe of chunk 5838. The §26.1 baseline's `226 ms @ 341 ms` load longtask was chunk 5967 (supabase+zod, 281 KiB parsed) evaluating in the early load path — PERF-10a removed 5967 from login, so that task no longer exists (early evals now 105–159 ms, none >200 ms before LCP).
- **The remaining >200 ms task is pure framework:** chunk 5838 = Next.js app-router internals (router-reducer, prefetch, flight data; 227 KiB raw / 60.4 KiB gz — probe found zero app symbols inside). It evaluates 209–241 ms @ ~1.7–3.0 s (post-LCP window); Lighthouse `mainthread-work-breakdown` shows Script Evaluation 478 ms + Script Parsing 77 ms of a 1.29 s total, and `unused-javascript` metricSavings for both flagged chunks is FCP/LCP = 0 ms.
- **Measured on HEAD:** TBT 196/258 ms vs §26.1 baseline 150/360 ms — inside the baseline's own run-to-run spread (LCP ±45%, TBT ±58%). The ≤ 200 ms line is crossed on good runs; the framework chunk cannot be removed at app level, and splitChunks surgery would add a request + risk router chunk ordering without reducing total main-thread work. Per §26.5 (revert if within variance) and human approval, no code change was made.
- Ledger: §26.5 (CLOSED row). Tools: `scripts/trace-longtasks.mjs` (trace + longtask list; profile helpers removed as debug-only).

**Notes:** Task 6 (PERF-09) is next: CI bundle-budget + Lighthouse gate. Requires checking for existing CI files at execution; if none exist, deliver scripts + budget config and defer the runner.

**Status — Task 6 (PERF-09) DONE, committed `da6dc33` (Aug 9, 2026):**
- **CI existed** (`.github/workflows/ci.yml`: lint → `tsc --noEmit` → `vitest run` → `npm run build` with placeholder supabase env), so the runner was wired, not deferred. Added a **Bundle budget gate (PERF-09)** step: `ANALYZE=true npx next build --webpack` (budget is defined against webpack builds — turbopack chunks differently), `next start -p 3000`, poll `/login` until it serves 200, then `node scripts/check-budgets.mjs --base http://localhost:3000`. Placeholder supabase env verified locally: the proxy's `getUser()` fails harmlessly and `/login` still serves 200 with the full script set.
- **`scripts/check-budgets.mjs` + `perf-budgets.json`:** fetches each budgeted route's HTML, extracts its `<script src>` set (the §26.2-authoritative per-route initial JS), gzips each built chunk from disk (`zlib.gzipSync` — matches the analyzer's gzipSize within 0.1%), sums excl. the polyfills chunk, and fails (exit 1) on any route over budget. **Verified both ways: deliberate 160 KiB budget FAILS, baseline budget 165 KiB PASSES** — exit codes 0/1 confirmed. Baseline on the gate's own method: `/login` **164.3 KiB gz / 13 scripts / 38.7 KiB polyfills** — matches the ledger's 164.2.
- **Only `/login` is budgeted** — `src/proxy.ts` gates every other route to `/login` (checked at execution). Any future public route must be added to `perf-budgets.json` deliberately.
- **Lighthouse gate delivered as opt-in, not CI-wired:** `perf-lh-budget.json` (LCP/FCP ≤ 2.5 s, TBT ≤ 200 ms, CLS ≤ 0.1, script ≤ 220 KiB — the §26.4 PERF-11/PERF-10a targets) + `--budget <file>` flag on `scripts/lighthouse-authed.mjs` (appends Lighthouse's `--budget-path`). Not wired into CI because Lighthouse needs real Supabase credentials + a seeded session for the authed route, and §26.1 run variance (LCP ±45%, TBT ±58%) would make a hard CI gate flaky.
- `npm test` 144/144 green, `npm run build` green. **Flagged (not fixed, per EXECUTION_RULES): `npm run lint` fails at HEAD with 80 pre-existing errors** (react-hooks `set-state-in-effect` + `no-explicit-any` across ~25 files) — untouched by this ticket; candidate for a new ticket.

---

## 28. Addendum 15 — approved execution plan for authed /do perf work (Aug 10, 2026)

Approved by human Aug 10, 2026. Same discipline as §27: one ticket at a time per `docs/agents/EXECUTION_RULES.md`, measure with identical §26.1 instrumentation (authed variant: `scripts/lighthouse-authed.mjs`, seeded test account from TOOL-18), one change at a time, ledger §26.5, revert if within run variance (LCP ±45%, TBT ±58%) or tests go red.

**PERF-12 — Cut authed `/do` transfer + main-thread cost.** The §27 plan measured only the public login route; the real user-facing page has never been optimized. Baseline (Aug 8, TOOL-18, pre-PERF-10a/b): **perf 29/33, LCP 13.4–14.4 s, TBT 2.63–2.85 s, FCP 2.3–2.7 s, TTFB 1.1–1.5 s, CLS 0.013, unused-javascript ~93 KiB.** `/do` initial JS per PERF-09 analyzer: 23 scripts, 232.8 KiB gz (chunk 5041 = 68.8 KiB supabase client, plus 21 app chunks). Priority: High (worst user-facing page). Acceptance: perf ≥ 70, LCP ≤ 4 s, TBT ≤ 1 s on the same authed flow; if a target is unreachable at app level, close with attribution like PERF-11 did.

### Task list

| # | Title | Acceptance criteria (measurable) | Depends on |
|---|---|---|---|
| 1 | Re-measure `/do` on HEAD (post PERF-10a/b) | 2 perf-preset runs recorded; compare vs Aug 8 baseline; first fix chosen from attribution | — | ✅ DONE |
| 2 | First fix (chosen after task-1 analysis) | measured improvement outside §26.1 run variance; tests green; ledger updated | 1 | ✅ DONE (c611f4e) |

**Notes:** The Aug 8 baseline predates PERF-10a/b (login-bundle changes), but `authed-do.spec.ts` asserts the `/do` chunk set unchanged — task 1 confirms empirically. RUM-vs-seeded-account was settled by TOOL-18 (seeded account; §26.4 NOTED).

**Status — Task 1 (re-measure) DONE (Aug 10, 2026), HEAD `bf576d3`:** authed `/do`, 2 perf-preset runs: **perf 46/50 (baseline 29/33), LCP 8.1/7.6 s (baseline 13.4/14.4), TBT 470/510 ms (baseline 2.63/2.85 s), FCP 2.3/2.8 s (baseline 2.3/2.7), TTFB 1010/1470 ms (baseline 1.1/1.5 s), CLS 0** — the pre-PERF-10a/b baseline has already improved (TBT −80%, LCP −45%) via the login-bundle work, but LCP is still 3× the 2.5 s target and perf is far below 70. Attribution (run 2): mainthread-work 5.9 s total (Other 2.1 s + Script Evaluation 1.8 s + Rendering 1.16 s + Style & Layout 0.88 s); bootup `/do` 3.24 s + chunk 0cau6ws9nif22 1.43 s; long-tasks: 202 ms @ 5.9 s, 186 ms @ 2.0 s, 166 ms @ 3.4 s; unused-javascript 94 KiB (chunk 0_1d-o051iw6y = 127 KiB transfer). **Root cause of the 1 s TTFB pinned by temp file-probe instrumentation (reverted): all of it is two serial Supabase round trips in `(app)/layout.tsx` (`getUser` ~310 ms + `user_settings` ~610 ms); SSR render is only ~60 ms.** (Debug note: the earlier server restart kept a stale process alive — kill by port owner, not command-line match, on this machine.)

**Status — Task 2 (first fix) DONE, committed `c611f4e` (Aug 10, 2026):** `(app)/layout.tsx` now reads the session via `getSession()` (cookie-local, 0-3 ms) instead of repeating the `getUser()` auth-server round trip — the proxy already validated the session on this same request, so no new trust boundary (forged cookie → proxy getUser fails → /login; RLS untouched). **Measured: TTFB 0.92 → 0.62 s warm (curl, deterministic); Lighthouse TTFB 1010/1470 → 690/760 ms, FCP 2.3/2.8 → 2.0/2.1 s, LCP 8.1/7.6 → 7.3/7.3 s, TBT 470/510 ms flat, perf 46/50 → 50/51.** TTFB/FCP gains are outside variance and kept; LCP/TBT deltas are inside §26.1 variance and the remaining LCP gap is the ~4.6 s of post-hydration main-thread work (chunk eval + hydration), not TTFB. `npm test` 144/144, build green. Ledger: §26.5. Next fix candidates (task 3, not yet ticketed): cut the ~600 ms `user_settings` server call (cache or client-side), then the hydration/main-thread cost (lazy-load TaskAddPanel/CalendarView per the DynamicModals pattern; 23 scripts / 232.8 KiB gz on /do).

**Status — Task 3 (lazy-load TaskAddPanel + CalendarView) DONE, committed `235a234` (Aug 10, 2026):** `do/page.tsx` now imports both via `next/dynamic` with `ssr: false, loading: () => null` — identical pattern to `DynamicModals.tsx` — since the add-task panel is a closed dialog by default and the calendar is one of three segmented views, neither participates in initial render or hydration. Webpack analyzer chunk map of the pre-change build confirmed both are self-contained entrypoints (`1518-e…js` TaskAddPanel +1 mod 8.7 KiB, react-hook-form `3465-…` 11.2 KiB; `9255-…` calendar.mjs 15.5 KiB + date-fns `5902/2275` 12.9 KiB) — all now moved to on-demand fetch/eval. **Measured (turbopack build, same HTML-script-set method): 33 → 28 scripts, 541.7 → 489.6 KiB gz initial (`/do`, deterministic); Lighthouse 2 runs: perf 53/55 (was 50/51), LCP 6.7/6.4 s (was 7.3/7.3), TBT 440/450 ms (was 470/520), FCP 2.0/2.0 s flat, TTFB 640/660 ms (was 690/760).** LCP/TBT directionally better but still inside §26.1 variance — the script/gz reduction is the hard, deterministic evidence (≈ −52 KiB gz, −15% of the initial transfer). Functionality verified with a throwaway Playwright run (deleted after): Add-task dialog opens on demand and Calendar view switches on demand. `npm test` 144/144, build green. Ledger: §26.5. Remaining gap: main-thread work (~4.4 s) is now mostly hydration of the 28 remaining scripts (supabase 68.8 KiB, framer-motion, nuqs, react-hook-form shared deps) — next candidates (task 4, not yet ticketed): cut the ~600 ms `user_settings` server call (cache or client-side), then re-check chunk 0cau6ws9nif22 (1.43 s eval) and any remaining heavy page-level imports.

**Status — Task 4 (remaining TTFB + shared-chunk audit) DONE via attribution, plan approved with Option A (human, Aug 10 2026):** plan in `tasks/plan.md` + `tasks/todo.md`; Gate 1 chose **Option A: leave `user_settings` as-is**. Evidence produced:
- **TTFB split (temp probe header on `src/proxy.ts`, reverted):** proxy `getUser()` **293–366 ms** (mean ~323, 4 samples, response header `x-probe-getuser-ms`) + layout `user_settings` ~300–360 ms (fix-1 probe) + SSR render ~60 ms ≈ warm total 0.61–0.63 s (curl). Both remaining round trips are architectural: middleware `getUser()` is the per-request token-revocation security boundary (changing it to cookie-local decode is a security decision, explicitly NOT approved), and the layout `user_settings` fetch is SSR onboarding gating (redirect logic cannot move client-side without flash/redirect-loop regression; latency-bound, cannot trim columns). **Verdict: TTFB work closed with attribution** — 0.62 s is already 2.4× better than the Aug-8 baseline 1.47 s and the remaining cost is the price of the security + onboarding design.
- **Shared chunk `0cau6ws9nif22` (233 KB raw / ~64 KiB gz, ~1.43 s eval, on EVERY `(app)` route — `/`, `/inbox`, `/explore`, `/do` verified):** post-task-3 webpack analyzer map shows the equivalent shell = 16 chunks / 168.5 KiB gz (was 23 / 232.8 pre-task-3): supabase realtime client 68.8 KiB + framer-motion 21.7 KiB (MotionProvider invariant) + nuqs 6.7 KiB (NuqsAdapter in layout) + RealtimeProvider 4.3 KiB (invariant) + shared app shell ~59 KiB. Turbopack merges these into one big chunk; merging is not app-configurable (manual webpack splitChunks does not apply to turbopack builds) and no page-specific literals found in the chunk (probe). **Verdict: closed with attribution** — shell is invariant-required providers + supabase; no app-level lever without provider-wiring changes (Law 7), which are not warranted for ~1.4 s of eval shared across all routes.
- `npm test` 144/144 (no code change in this task). Ledger: §26.5.

**VERDICT — PERF-12 CLOSED with attribution (human-approved, Aug 10 2026):** acceptance targets were perf ≥ 70, LCP ≤ 4 s, TBT ≤ 1 s. Final measured state on authed `/do` (2 Lighthouse runs): **perf 53/55, LCP 6.7/6.4 s, TBT 440/450 ms, FCP 2.0/2.0 s, TTFB 640/660 ms; warm curl TTFB 0.61–0.63 s; initial scripts 28 / 489.6 KiB gz (turbopack) and 16 chunks / 168.5 KiB gz (webpack).** vs the Aug-8 baseline: **LCP −52%, TBT −83%, TTFB −58%, perf 29 → 55, initial bundle −31%.** TBT target met; LCP and perf targets not met — remaining cost attributed (task 4) to (a) middleware `getUser()` token-revocation security check (~323 ms, deliberate), (b) SSR onboarding gating round trip (~300 ms, deliberate), (c) framework/hydration cost of the invariant-required shell (supabase 68.8 KiB + framer-motion 21.7 KiB per MotionProvider invariant + nuqs + RealtimeProvider + ~59 KiB app shell; turbopack chunking not app-configurable). No further app-level lever exists without security/provider-wiring changes (Law 7) or a rendering-strategy change; per PERF-11 precedent, the ticket closes with attribution. Suggested follow-up (not ticketed): /do rendering-strategy study (e.g. server components for the task list). Final gate: `npm test` 144/144, build green.

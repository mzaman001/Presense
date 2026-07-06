# Presense — Execution Specification

> **IMPORTANT — File migration notice (July 5, 2026):** This document is the ONLY active backlog. References to `plan.md`, `CLAUDE.md`, `EXECUTION_RULES.md` (root), `OPENCODE_PROMPT.md`, `PROJECT.md`, `DESIGN_SYSTEM.md` (root), or `design_identity.md` throughout this document are HISTORICAL — those files have been superseded by the current file structure documented in `AGENTS.md` at the repo root. When this document says "record in plan.md" or "see CLAUDE.md," substitute the current file: backlog items go here, design rules go in `docs/project/DESIGN_SYSTEM.md`, agent workflow goes in `docs/agents/EXECUTION_RULES.md`, component inventory goes in `docs/project/COMPONENT_MANIFEST.md`, project context goes in `docs/project/CONTEXT.md`. Do not look for the old files — they are in `docs/archive/` if kept at all.

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

## 2. Conflict register

These are direct disagreements between sources. Each must be resolved by a human before dependent tickets start. The executing agent must stop and surface the conflict rather than guess.

### CONF-01 — Default theme name
**Status:** DONE

- **Source A (`CLAUDE.md`, repo root):** "THEME SYSTEM: The default theme is Wahala (orange/amber)."
- **Source B (user, this conversation, item 7):** "rename Wahala theme everywhere to something like sunset or something."
- **Source C (audit `10-design-system-spec.md`):** proposes renaming the theme's `data-theme` attribute value to `warm` (a system identifier, not a display name).
- **Conflict:** "Wahala" is both a display name and, per `CLAUDE.md`, treated as a rule ("Currently active theme tokens" are defined under this name). The user wants a *display* rename (e.g., "Sunset"). The audit wants an *internal* rename (`data-theme="warm"`). These are not mutually exclusive but must be decided as two separate values: (a) the internal `data-theme` attribute/enum value used in code and storage, (b) the user-facing label shown in Settings. Tickets `BUG-07` and `DS-03` must not each invent a different pair of values.
- **Resolution required before:** `BUG-06`, `BUG-07`, `DS-03`.

### CONF-02 — Space color values
**Status:** DONE

- **Source A (`DESIGN_SYSTEM.md`, repo root):** Do `#FBBF24` (amber), Think `#2DD4BF` (teal), Remember `#7692FF` (blue/purple), Explore `#A78BFA` (violet) — a cool-toned palette for three of four spaces.
- **Source B (`design_identity.md` pillar 2 / `DESIGN_SYSTEM.md` philosophy):** "Warmth at the centre — Amber, coral, deep orange. Cool colours appear only as secondary accents." Directly contradicted by Source A's Think/Remember/Explore values.
- **Source C (`src/app/globals.css:130–142`, warm-dark theme):** all four `--space-*` tokens resolve to `var(--accent)` (identical amber) — space color distinction does not exist in this theme.
- **Source D (`src/app/(app)/do/page.tsx` Column `accent` props, e.g. `accent="#FBBF24"` for Today, `accent="#2DD4BF"` for Upcoming, `accent="#A78BFA"` for Someday):** the same four hex values from Source A are hardcoded, but assigned to **task-status columns inside one space (Do)**, not to the four spaces. This is a third, incompatible usage of the same color set.
- **Source E (audit `10-design-system-spec.md` §Color):** proposes a new all-warm four-color palette (`#E5B41E`/`#EB4233`/`#F4A261`/`#A76011`) that matches neither Source A nor Source D.
- **Conflict:** there are three different concepts sharing token names — (1) per-space identity color (documented, unused in default theme), (2) per-status color inside Do (hardcoded, actually rendered), (3) the audit's proposed replacement palette. A fix cannot proceed until it is decided whether `--space-*` tokens mean "space identity" or get renamed/merged with the existing per-status Do colors, and whether the resulting palette is warm-only (per identity pillar) or mixed.
- **Resolution required before:** `DS-01`.

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
**Status:** DONE

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
**Status:** DONE

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

### BUG-03 — Dropdown clipping issues
**Status:** DONE
**Priority:** 3 (Blocks core workflows)
**Files:** `src/app/(app)/inbox/page.tsx`, `src/app/(app)/page.tsx`, `src/components/ui/Dropdown.tsx`, `src/components/features/ExploreDrawer.tsx`
**Root cause:** `overflow: hidden` on parent containers clipping absolute positioned menus.
**Requirement:** Menus must render via a portal to escape overflow clipping.
**Acceptance criteria:**
- The Inbox "Route it" dropdown renders fully visible over adjacent cards.
- Every other dropdown/menu call site in the codebase is verified against the same defect class and fixed if affected.
- Dropdown menus remain interactive with keyboard (arrow keys, Enter, Escape) after the fix — this ticket must not regress keyboard support.
- **Depends on:** none. Should land before `DS-04` (Menu primitive consolidation) since it may be superseded by it, but should not wait for the full design-system pass given its "Critical" severity.

### BUG-04 — "Add Task" button doesn't autofocus title input
**Status:** DONE
**Priority:** 4 (Friction point)
**Files:** `src/components/features/TaskAddPanel.tsx`, `src/hooks/useDialogFocus.ts`
**Root cause:** `useDialogFocus` manually overrides focus after 350ms to the first focusable element (the close button), ignoring the `autoFocus` attribute on the title input.
**Requirement:** Opening the "Add Task" panel must instantly focus the title input.
**Acceptance criteria:**
- Clicking "Add Task" opens the panel and immediately focuses the title input.
- Using the `Cmd/Ctrl + K` shortcut opens the panel and focuses the input.
- Using the native mobile bottom bar action focuses the input.

### BUG-05 — Calendar view is structurally broken
**Status:** WITHDRAWN (Superseded by calendar rewrite T3-1 per user resolution of CONF-08)

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
**Status:** DONE

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
**Status:** DONE

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
**Status:** DONE

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
**Status:** DONE

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
**Status:** DONE

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
**Status:** DONE

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
**Status:** DONE

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
**Status:** DONE

- **Priority:** Critical
- **Files:** `src/app/globals.css`
- **Root cause:** `[audit-sourced, not re-verified line-by-line, but consistent with independently confirmed evidence in this document]` — `@theme inline`'s calculated radius scale (audit-cited lines 57–63) and `:root`'s fixed-pixel radius scale (audit-cited lines 225–231) both exist and resolve to different pixel values for the same Tailwind class names (e.g., `rounded-lg` and `.dropdown-panel`'s `--radius-md` diverge). A full shadcn OKLCH neutral-color palette exists under `:root`/`.dark` and is unreferenced by any Presense component.
- **Requirement:** Exactly one radius scale, expressed in pixels, feeding both raw CSS variable usage and Tailwind's `@theme inline` mapping. The unused shadcn OKLCH neutral tokens are either deleted or explicitly aliased to the warm token set — not left as dead, conflicting weight in the file.
- **Acceptance criteria:**
  1. `rounded-lg` in JSX and any CSS reference to `var(--radius-lg)` (or equivalent) resolve to the same pixel value everywhere in the app.
  2. `grep` for shadcn OKLCH variable names (`--primary`, `--secondary`, etc. under `:root`/`.dark`) returns zero component usages if the tokens are deleted, or returns only the alias definitions if they are kept and mapped.
- **Depends on:** none. Should land before `DS-03` (theme attribute rewrite touches the same file regions).

### DS-03 — Formalize themes as `data-theme`/`data-mode` attributes
**Status:** DONE

- **Priority:** High
- **Files:** `src/app/globals.css`, `src/app/layout.tsx`, `AppInitializer.tsx`, theme picker UI in `SettingsModal.tsx`
- **Conflict:** `CONF-01` (naming) must be resolved for the attribute values to be chosen.
- **Requirement:** Replace the current mixed `html.light` / `html.theme-navy` / `html.theme-forest` class-based theme switching with a single `data-theme` (identity: default/navy/forest, or whatever `CONF-01` decides) crossed with a single `data-mode` (`dark`/`light`) attribute pair on `<html>`. This is a pure refactor of the selector mechanism — it must not change any resolved color value except where `DS-01`/`BUG-07` explicitly require a value or name change.
- **Acceptance criteria:**
  1. Every theme/mode combination previously reachable via the class-based system is reachable via the new attribute system with identical visual output (screenshot-diff each of the 4x2 = 8 combinations before/after, accounting for intentional changes from `DS-01`/`BUG-07`).
  2. No component or CSS selector references `.theme-navy`, `.theme-forest`, or `html.light` after this ticket.
- **Depends on:** `CONF-01` resolved, `DS-01`, `BUG-06`, `BUG-07`.

### DS-04 — Consolidate glass surface, button, and dropdown/menu component systems
**Status:** DONE

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
**Status:** DONE

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
**Status:** DONE

- **Priority:** Critical
- **Files:** `src/app/globals.css`, `src/components/ui/PageHeader.tsx`
- **Root cause:** `[audit-sourced]` `--text-4` at 35% white alpha failed WCAG AA's 4.5:1 minimum for body-weight text.
- **Requirement:** Raise the alpha value used for any text a user is expected to read to a level that passes 4.5:1 against its actual background, reserving the original low-alpha value only for content marked `aria-hidden` or otherwise explicitly decorative.
- **Acceptance criteria:**
  1. Every text node currently using the low-contrast token measures at or above 4.5:1 contrast against its rendered background in both dark and light themes.
  2. If a genuinely decorative low-contrast token is retained, no non-`aria-hidden` readable text references it after this ticket. Verified by removing `text-[var(--text-decorative)]` from `PageHeader.tsx`.
- **Depends on:** none.

### DS-07 — Page shell primitives (`PageHeader`, `EmptyState`)
**Status:** DONE

- **Priority:** High
- **Files:** new components; call sites across every `page.tsx` under `src/app/(app)/`
- **Root cause:** `[audit-sourced, partially re-verified]` — `do/page.tsx`'s own empty states, while more developed than a bare string, are hand-rolled per-column with duplicated markup.
- **Requirement:** Introduce one `PageHeader` component (title, description, actions slot) and one `EmptyState` component (illustration/icon, title, description, action), and migrate every space's page header and every empty-list state in the app to use them, replacing bespoke per-page markup.
- **Acceptance criteria:**
  1. Every `page.tsx` under `(app)/` renders its header through `PageHeader`.
  2. Every list-empty condition across Inbox, Do (all four column/view combinations), Think, Explore, Remember renders through `EmptyState` with space-appropriate copy (not a generic default) and, where applicable, an action button wired to that space's correct creator surface (cross-reference `BUG-04`'s requirement that empty-state actions must match header actions).
- **Depends on:** `BUG-04` (do not duplicate the fix for the Do empty-state button target).

### DS-08 — Command surface split (Cmd+K, search, capture)
**Status:** WITHDRAWN (User elected to keep current Cmd+K capture binding per CONF-06)

- **Priority:** Medium
- **Files:** `CaptureModal.tsx`, `SearchModal.tsx`, `Navigation.tsx` keybinding registration
- **Conflict:** `CONF-06` — requires explicit sign-off before remapping `Cmd+K` away from its current capture binding.
- **Requirement:** If and only if `CONF-06` is resolved in favor of the remap, evolve `SearchModal` into a command palette that lists recent commands and search results, bind `Cmd+K` to it, bind capture to `Cmd+Shift+K`, and bind full-text search to `Cmd+/`, per `12-interaction-patterns.md`. If `CONF-06` is resolved in favor of keeping the current binding, this ticket is withdrawn and marked as such, not silently skipped.
- **Acceptance criteria:** (only if implemented) 1. `Cmd+K` opens the command palette, not `CaptureModal`, from every route. 2. `Cmd+Shift+K` opens `CaptureModal` directly. 3. `Cmd+/` opens full-text search directly. 4. A `?` shortcuts overlay lists all three bindings plus every other documented shortcut in `12-interaction-patterns.md`'s table.
- **Depends on:** `CONF-06` resolved.

### DS-09 — Input primitives with accessibility wiring
**Status:** DONE

- **Priority:** High
- **Files:** new `Input`, `Textarea`, `SearchInput` components; call sites in `TaskAddPanel.tsx`, `AddPersonPanel.tsx`, `LocationAddPanel.tsx`, `CaptureModal.tsx`
- **Requirement:** Wrap the existing `.input`/`.input-title`/`.input-search` CSS classes in React components that own label association, `aria-invalid`, and `aria-describedby` wiring for hint/error text, and migrate every form call site to use them instead of raw styled `<input>`/`<textarea>` elements.
- **Acceptance criteria:**
  1. Every form input in the app has a programmatically associated label (verified via an accessibility tree inspection, not just visual proximity).
  2. Every Zod validation error surfaced in a form is linked to its field via `aria-invalid` + `aria-describedby`, not shown only as a toast.
- **Depends on:** `A11Y-06` (form validation surfacing) — coordinate, likely delivered together.

### DS-10 — Badge/Avatar/Kbd/SegmentedControl primitive completion
**Status:** DONE

- **Priority:** Medium
- **Files:** `src/components/ui/Badge.tsx`, `Avatar.tsx`, new `Kbd`, `SegmentedControl` components
- **Requirement:** `Badge` gains named variants for every space and status color (post-`DS-01` palette). `Avatar` requires an `alt`/label and has a defined fallback for a missing image. A `Kbd` component replaces every inline shortcut-hint markup pattern (e.g. `Navigation.tsx:194, 281`). A `SegmentedControl` component replaces the hand-rolled Kanban/Calendar and Board/Today/Calendar view-switcher markup (`do/page.tsx` lines approximately 300-318).
- **Acceptance criteria:**
  1. No inline keyboard-hint markup remains outside the `Kbd` component. (Verified)
  2. Every Badge usage in the codebase (space tags, status tags) uses a named variant, not an inline `style` prop with a raw color. (Verified)
- **Depends on:** `DS-01`.

### DS-11 — Document the canonical create/edit/delete interaction contract
**Status:** DONE

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
| `BUG-08` (archive/delete inconsistency) | **Resolved** | Verified that `item-lifecycle.ts`'s `moveItemToTrashPatch()` is used across all delete entry points for `items`, `threads`, `explores`, `people`, and `locations`. Soft delete (`status: 'deleted'`) and the `explore/trash/page.tsx` view handle all 5 entities. The 30-day auto-purge is enforced via the `cron_cleanup` Edge Function. |
| `BUG-09` (capture modal lag) | **Resolved** | `capture-router.ts` and `rate-limit.ts` both changed; re-profiled in this pass. Zero network requests between keypress and preview render, and `compromise`/`chrono-node` are dynamically imported. |
| `BUG-10` (missing profile row) | **Resolved** | `Navigation.tsx:229`: `const displayName = userSettings?.display_name || email || "Presense User";` — a non-empty fallback now always renders. |
| `BUG-11` (Settings scroll on Think/Explore) | **Resolved** | Verified that `SettingsModal.tsx` now applies `data-lenis-prevent` to its scroll container, successfully exempting it from the Lenis document-level scroll hijack on the Think/Explore routes. |

### 12.2 — New defect: sidebar brand icon and profile avatar are not vertically aligned

**BUG-14 — Presense logo and profile avatar misaligned in the sidebar rail**
**Status:** DONE

- **Priority:** Medium
- **Files:** `src/components/layout/Navigation.tsx`
- **Root cause:** [Previously] Three different icon-centering formulas were used.
- **Requirement:** All icons must share one optical center line (40px).
- **Acceptance criteria:** Verified that `px-5` and `iconClass` are used correctly for header and profile row, yielding exactly a 40px center, matching the nav items.
- **Depends on:** none.

### 12.3 — New defect: default theme still leaks across sessions/accounts

**BUG-15 — "Sunset" is not reliably the first-run theme for every user**
**Status:** DONE

- **Priority:** High
- **Files:** `src/app/layout.tsx` (theme-init inline script, lines ~68–86), `src/components/layout/AppInitializer.tsx` (lines 62–71), `src/components/features/SettingsModal.tsx` (sign-out calls, lines 343, 450)
- **Root cause:** Two of `BUG-06`'s three original requirements are now met (the default value is correctly `'sunset'` when `localStorage` is empty, per `layout.tsx`'s `|| 'sunset'` fallback and `theme.ts`'s `DEFAULT_THEME_ID`), but the core leakage mechanism is unchanged:
  1. `AppInitializer.tsx:64` resolves theme as `userSettings?.theme || localStorage.getItem("presense_theme")` for any authenticated, non-onboarding user. If `userSettings.theme` is falsy at the moment this effect runs — which is a realistic race condition on first load, since `userSettings` is fetched asynchronously and this effect can run before that fetch resolves — the code falls through to `localStorage`, not to `DEFAULT_THEME_ID`. If that browser has *any* prior `presense_theme` value (from a previous account, a previous test session, or even a value written by this same effect on a previous, still-loading render), that stale value is applied and then immediately written back via `localStorage.setItem("presense_theme", theme)` at line 71 — reinforcing the wrong value rather than self-correcting once `userSettings` finishes loading, because the effect's dependency array (`[userSettings?.theme, ...]`) will re-run and overwrite it correctly *only if* `userSettings.theme` is truthy by then; if the DB row genuinely has no theme set yet (e.g., a brand-new account before its first settings save), the wrong localStorage value persists indefinitely.
  2. Signing out (`SettingsModal.tsx:343, 450`, `supabase.auth.signOut()`) still does not clear `presense_theme`, `presense_color_mode`, and `presense_reduce_motion` from `localStorage`. On a shared or reused browser, the next login screen — governed solely by the root `layout.tsx` inline script, since `AppInitializer` is not mounted on the unauthenticated `(auth)/login` route — reads whatever the previous session left behind, not the default.
  3. **New, related finding — `CONF-07`:** the two theme-rename migrations contradict each other. `20260703000004_rename_theme_values.sql` maps legacy `'blue' → 'midnight'` (a rename intended to preserve the user's preference under a new name) and sets the column default to `'sunset'`. `20260703000005_default_legacy_blue_to_sunset.sql`, applied after it, maps `'blue', 'navy', 'midnight' → 'sunset'` — which does not merely catch stragglers missed by the first migration, it also converts every row that migration `004` had just correctly renamed to `'midnight'` back down to `'sunset'`, and would do the same to any user who explicitly chose "Midnight" as their theme between the two migrations. This is not this ticket's primary defect (the migrations likely ran back-to-back in one deploy with no user-facing window in between), but it must be resolved as a documentation/intent conflict before any further theme-related migration is written, so the same mistake isn't repeated: is `'midnight'` a first-class theme choice or is it, as migration `005` implies, considered equivalent to "not yet migrated"?
- **Requirement:**
  1. `AppInitializer.tsx`'s theme resolution must never fall back to a raw `localStorage` read for an authenticated user when `userSettings` has not yet loaded — it should either wait for `userSettings` to resolve before applying any theme beyond what the blocking inline script already applied, or fall back to `DEFAULT_THEME_ID` (never a `localStorage` value) when `userSettings.theme` is genuinely absent.
  2. Sign-out must clear `presense_theme`, `presense_color_mode`, and `presense_reduce_motion` from `localStorage`, so the next unauthenticated view of `/login` on that browser always renders the true default rather than a leftover preference.
  3. `CONF-07` must be resolved explicitly (is `'midnight'` a normal user-selectable theme, protected from being silently reset — the answer implied by migration `004` — or is it, per migration `005`, still being treated as a "not fully migrated" transitional state): **Resolved**: The later migration `20260704000000_update_theme_names_to_warm.sql` definitively resolved this by normalizing all legacy values into the three canonical choices: `'warm'`, `'navy'`, and `'forest'`. Future migrations must respect these three as deliberate, user-chosen values and not overwrite them.
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
**Status:** DONE

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
| `PERF-01` (`useCallback` on Do page handlers) | Medium, open | **Status:** DONE | `do/page.tsx`: only `fetchArchived` is wrapped in `useCallback`; `completeTask` and `openEditPanel` — the two handlers passed as props into every rendered `TaskCard` — are still plain functions redefined on every render, still defeating `TaskCard`'s `React.memo`. Given the user's new, explicit "very laggy" report and the Do page being the app's primary, highest-task-count surface, this ticket's priority is raised from Medium to **High**. |
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

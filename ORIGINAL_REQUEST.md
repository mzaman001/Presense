# Original User Request

## Initial Request — 2026-06-21T22:01:26+05:30

# Teamwork Project Prompt — Draft

> Status: Launched

Implement Phase 3 (UI Polish & Settings Cleanup) from the `presense_ux_research_report.md` artifact to fix the UI design, clean up the settings toggles, and streamline the Explore taxonomy.

Working directory: .
Integrity mode: demo

## Requirements

### R1. Explore Taxonomy Overhaul
Remove confusing custom "Types" and overlapping "Tags" from `ExploreDrawer.tsx`. Lock down a fixed list of system Types (e.g. Link, Note, Book) with standardized `lucide-react` icons to ensure visual continuity. Ensure all tags and categories are fully searchable in the `SearchModal`.

### R2. Settings Declutter & Layout Fixes
In `SettingsModal.tsx`, remove unnecessary and confusing toggles (e.g., "Routing Confidence", "NLP for dates", "people briefing reminder"). Re-layout the Focus tab so that "Auto start break" is grouped logically with the timer durations rather than sitting awkwardly in the middle. Ensure that clicking the profile button in the bottom left of the Sidebar reliably opens the Settings modal to the Profile tab.

### R3. Task Card UI Polish & Think Space Lag
Fix the visual bugs in `TaskCard.tsx`: clean up the border clipping and fix the overlapping person icons so they don't look ugly or messed up, referencing premium standards like Things 3. Investigate and fix the jarring page transition/lag when opening a single thread in the Think space (`src/app/(app)/think/[id]/page.tsx`). 

## Acceptance Criteria

### Verification (Agent-as-Judge Auditing)
- [ ] The `ExploreDrawer` no longer allows creating custom types; it only uses a fixed list of system types with visually consistent `lucide-react` icons.
- [ ] "Routing Confidence" and "NLP for dates" have been completely removed from the `SettingsModal`.
- [ ] The "Auto start break" toggle in settings is grouped directly with timer durations, not between unrelated break settings.
- [ ] Clicking the profile button in the sidebar opens the settings directly to the Profile tab.
- [ ] `TaskCard` icons no longer overlap aggressively or break out of their container borders.
- [ ] Opening a single thread in the Think space feels smooth, utilizing a prefetch or optimized layout transition instead of a full jarring remount.

---
*Next: when approved → delegate via invoke_subagent (see Delegation Protocol)*

## Follow-up — 2026-06-27T12:56:25Z

<USER_REQUEST>
# Teamwork Project Prompt — Phase 4

> Status: Launched

Implement Phase 4 (Sunsama Rituals & UI Polish) based on the approved spec. Object cross-linking has been deferred to Phase 4.5 to prioritize architecture stability.

Working directory: .
Integrity mode: demo

## Pre-requisite: Realtime Hook Fix
Before building the ritual, fix the `useRealtime` hook. It currently does a full refetch on every write and suppresses updates for 2.5s. Since the ritual overlay fires a burst of writes (snoozes, triage), debounce the hook properly so updates don't cause lag or redundant refetches.

## Requirements

### R1. Sunsama Daily Planning & Evening Review Ritual
Implement the full-screen ritual flow directly in `src/app/(app)/layout.tsx` via a new global component (`src/components/features/RitualOverlay.tsx`), controlled by `useAppStore` state (`activeRitual: 'morning' | 'evening' | null`).

**Database Updates (Table: `user_settings`)**
- Add `last_ritual_date` (date) to track if the morning ritual was completed today.
- Add `shutdown_time` (string/time, default `18:00`) for the evening review trigger.
- Add `daily_capacity_minutes` (int, default `240`) for workload estimation.

**Triggers**
1. **Auto Morning**: In `AppInitializer.tsx`, if `now()` > `nudge_time` and `last_ritual_date` != today, trigger `'morning'`.
2. **Auto Evening**: Trigger `'evening'` if `now()` > `shutdown_time`.
3. **Manual**: Add a "Plan my day" button in `Navigation.tsx` (Sidebar) to manually trigger `'morning'`.

**Morning Flow Components**
- **Step 1: Triage (`MorningPlan.tsx`)**: Query tasks where status is `inbox` or `overdue`. Present full-width, one at a time/stack. Actions: "Do today", "Push to backlog" (leave status as-is), "Snooze". Cannot skip if items exist.
- **Step 2: Commit (`MorningCommit.tsx`)**: List selected "today" tasks. Add per-task minute estimates (default 25m/1 Pomodoro). Create a `<WorkloadBar />` component—if sum > `daily_capacity_minutes`, show a soft overcommitment warning banner (do not block).
- **Step 3: Done**: Write `last_ritual_date = today` to DB, close overlay, land on Home page.

**Evening Flow Component**
- **Evening Review (`EveningReview.tsx`)**: Query items completed today + session_logs for focus minutes. Show 3 panels: completed list, total focus minutes, incomplete carry-over list (bump deadline by 1 day for incomplete items with deadlines). Include a free-text "daily highlight" field that appends to today's Daily Note thread.

### R2. Fluid Swipe Mechanics & Auto-growing Textareas
- Apply the full-width Framer Motion swipe-to-delete mechanics (currently in `TaskCard.tsx`) to all list items across the app (Inbox items, Explore links, People CRM).
- Replace static text inputs for notes and task descriptions with `react-textarea-autosize` so they grow naturally as the user types.

## Acceptance Criteria
- [ ] `useRealtime` is debounced and handles burst writes without 2.5s lockouts.
- [ ] SQL migrations exist for the 3 new `user_settings` columns.
- [ ] Ritual overlay interrupts the UI appropriately and can be triggered manually from the sidebar.
- [ ] Triage flow safely snoozes, commits, or backlogs items. Workload Bar accurately tallies estimates.
- [ ] Evening Review successfully tallies completed Pomodoros and carries over deadlines.
- [ ] All lists support swipe-to-delete and `react-textarea-autosize` replaces rigid textareas.
</USER_REQUEST>

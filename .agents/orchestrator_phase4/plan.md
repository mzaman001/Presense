# Phase 4 Build & Verification Plan

## Dual Track Overview

The project is split into two tracks running in parallel:
1. **E2E Testing Track**: Designs and implements a test suite matching the requirements of Phase 4. Creates and verifies tests in `src/lib/__tests__/phase4.test.tsx` and writes `TEST_READY.md`.
2. **Implementation Track**: Implements the realtime hook fix, database migrations, Sunsama Morning/Evening Rituals, fluid swipe mechanics, and auto-growing textareas.

---

## 1. E2E Testing Track Plan (Opaque-box, requirement-driven)

### Tier 1 - Feature Coverage (>=5 per feature)
- [ ] **useRealtime Debouncing**: Verify `useRealtime` debounces postgres_changes update calls during burst events, reducing redundant refetches.
- [ ] **Ritual Trigger Logic**: Verify that auto-morning triggers on `now() > nudge_time` and `last_ritual_date != today`, auto-evening triggers on `now() > shutdown_time`, and manual morning trigger is possible.
- [ ] **Morning Triage Flow**: Verify `MorningPlan` loads inbox/overdue tasks stack and supports "Do today", "Push to backlog", and "Snooze" actions.
- [ ] **Morning Commit Flow**: Verify `MorningCommit` shows workload estimate inputs and Warning Banner when total minutes exceed capacity.
- [ ] **Evening Review Flow**: Verify `EveningReview` tallies completed tasks/focus minutes, handles incomplete carry-over deadlines (+1 day), and appends highlight notes.
- [ ] **Swipe-to-Delete lists**: Verify Framer Motion swipe-to-delete mechanics on Inbox, Explore, and People lists.
- [ ] **Auto-growing textareas**: Verify textarea components replace static textareas with `react-textarea-autosize`.

### Tier 2 - Boundary & Corner Cases
- [ ] Overcommitment limit bounds (exactly at `daily_capacity_minutes`, exactly 1 below, and 1 above).
- [ ] Empty state triage (no inbox or overdue tasks - what does Morning Triage show?).
- [ ] Overdue task with existing deadline: check that carry-over logic handles overdue and pushes deadline correctly.
- [ ] Burst write counts (e.g. 10 rapid updates in `useRealtime` should fire only 1 debounced refetch).

### Tier 3 - Cross-Feature Combinations
- [ ] Completing morning ritual writes `last_ritual_date` to DB, closes overlay, and updates the home view immediately.
- [ ] Evening Review carry-over task update reflects in the database and active task views.

### Tier 4 - Real-World Application Scenarios
- [ ] Complete morning ritual -> do some tasks -> trigger evening review -> verify focus time log and carry-over.

---

## 2. Implementation Track Plan

### Milestone 1: Pre-requisite: Realtime Hook Fix
- **Scope**: Fix `src/hooks/useRealtime.ts` to debounce updates and eliminate the 2.5s suppression lockout.
- **Verification**: Run `npm test src/lib/__tests__/phase4.test.tsx` (realtime tests).

### Milestone 2: Database updates (user_settings table)
- **Scope**: Create SQL migration file `supabase/migrations/010_phase4_user_settings.sql` adding `last_ritual_date`, `shutdown_time` (default '18:00'), and `daily_capacity_minutes` (default 240).
- **Verification**: Verify migrations apply without syntax errors.

### Milestone 3: Sunsama Ritual Overlay
- **Scope**: Build `src/components/features/RitualOverlay.tsx` (Morning triage, Morning commit, Done state, and Evening review) integrated with `src/app/(app)/layout.tsx`.
- **Scope**: Update `AppInitializer.tsx` for auto triggers.
- **Scope**: Update `Navigation.tsx` for manual morning trigger.
- **Verification**: Run build and layout tests.

### Milestone 4: Swipe-to-Delete and Textarea Auto-size
- **Scope**: Implement Framer Motion swipe-to-delete on Inbox, Explore, and People CRM list components.
- **Scope**: Integrate `react-textarea-autosize` for all notes and task descriptions.
- **Verification**: Component and E2E tests.

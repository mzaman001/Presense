# Synthesis Report: Phase 4 Requirements & Architecture

## Consensus
We compiled the findings and designs from Explorer 1 and Explorer 2. Both agree on the key elements required to implement the Phase 4 Sunsama Rituals & UI Polish.

### 1. Realtime Hook Fix (`src/hooks/useRealtime.ts`)
- **Problem**: The current hook uses a global `lastMutationAt` check in the app store, locking out all Postgres change events for 2.5s after any mutation.
- **Solution**: Remove the global 2.5s lockout. Replace it with a debounced update trigger (150ms to 400ms debounce using the existing `use-debounce` package) on the postgres changes subscription, and a per-table local mutation tracking map (`lastMutations: { [table: string]: number }`) with a reduced lockout window of 500ms specific to that table. This resolves lag and ensures burst writes (e.g. rapid triaging) are consolidated into a single refetch without lockout.

### 2. SQL Migration (`supabase/migrations/010_sunsama_rituals.sql`)
- **Add to `user_settings`**:
  * `last_ritual_date` (date)
  * `shutdown_time` (time/string, default '18:00') - use SQL type `time DEFAULT '18:00:00'` to match other time settings (like `nudge_time`).
  * `daily_capacity_minutes` (int, default 240)
- **Add to `items`**:
  * `time_estimate` (int, default 0) to store estimated task duration in minutes.

### 3. Zustand App Store (`src/store/useAppStore.ts`)
- Update `UserSettings` type definition.
- Add `activeRitual` state: `'morning' | 'evening' | null`
- Add action `setActiveRitual: (ritual: 'morning' | 'evening' | null) => void`
- Update `lastMutations` and `markMutation` to work on a per-table basis.

### 4. Sunsama Ritual Overlay & UI Flow
- **Overlay Layout (`src/components/features/RitualOverlay.tsx`)**:
  - Full-screen takeover, controlled by `activeRitual` state from the store.
  - Dynamically mounted in the global `src/app/(app)/layout.tsx` so that it overlay-interrupts the entire app.
- **Morning Flow**:
  - **Step 1: Triage (`MorningPlan.tsx`)**: Queries tasks with status `inbox` or `overdue`. Displays them in a stack/list. Actions: "Do today" (updates status to `active` and deadline to today), "Push to backlog" (leaves status as `active` or updates to backlog/remove deadline), "Snooze" (updates `snoozed_until` or bumps deadline). Users cannot skip if items exist.
  - **Step 2: Commit (`MorningCommit.tsx`)**: Lists today's committed tasks. Users edit minute estimates. Renders a `<WorkloadBar />` component that calculates the sum of estimates against `daily_capacity_minutes`. Displays a soft overcommitment warning banner if sum > daily_capacity_minutes.
  - **Step 3: Done**: Updates `last_ritual_date = today` in the DB and local state, closes the overlay, and redirects to the Home page.
- **Evening Flow (`EveningReview.tsx`)**:
  - Displays completed tasks today and focus minutes (queried from `session_logs`).
  - Displays incomplete tasks. Provides action to carry them over (bumps deadline by 1 day).
  - Displays a text highlight reflection box which appends the reflection as a text block to today's Daily Note thread.
  - Done action updates `last_ritual_date = today` (or a separate indicator) and closes the overlay.
- **Triggers**:
  - **Auto Morning Trigger**: In `AppInitializer.tsx`, checks on load/tick: if `now() > nudge_time` and `last_ritual_date != today`, set `activeRitual = 'morning'`.
  - **Auto Evening Trigger**: In `AppInitializer.tsx`, if `now() > shutdown_time` and evening ritual hasn't been completed yet today, set `activeRitual = 'evening'`.
  - **Manual Trigger**: Sidebar `Navigation.tsx` button "Plan my day" triggers `activeRitual = 'morning'` (or evening if late).

### 5. UI Polish
- **Swipe-to-delete**:
  - Copy Framer Motion drag gestures from `TaskCard.tsx` to Inbox items, Explore saved items, and People contacts.
  - Ensure gesture isolation on People list: vertical sorting is bound to the `GripVertical` handle, and horizontal drag is bound to the inner card wrapper, avoiding conflict between `dnd-kit` and Framer Motion.
- **Auto-growing Textareas**:
  - Add `react-textarea-autosize` to `package.json` dependencies.
  - Replace static `<textarea>` elements in notes/tasks with `<TextareaAutosize>` to expand automatically.

## Gaps & Unresolved Details
- Need to make sure `react-textarea-autosize` is installed using npm.
- Details of daily note thread: The evening flow appends the reflection text box to today's Daily Note thread. We must check how daily note threads are queried/created in the app. Let's direct the worker to investigate this.

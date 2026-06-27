# Phase 4 Technical Analysis: Sunsama Rituals & UI Polish

This report outlines the codebase references, files, and implementation details for Phase 4 requirements, mapping them to React Testing Library and Vitest integration test strategies.

---

## 1. `useRealtime` Hook Debouncing

### Codebase References
- **File Path**: `src/hooks/useRealtime.ts`
- **Component/Hook Name**: `useRealtime`

### Current Implementation & Issue Analysis
- **Current Behavior**:
  - Sets up a Supabase Postgres Changes subscription: `supabase.channel(...) .on('postgres_changes', ...)` for a given table.
  - When an event occurs, it reads `lastMutationAt` from the Zustand store.
  - If `Date.now() - lastMutationAt < 2500` (within 2.5 seconds of a local mutation), it rejects/ignores the update (echo suppression).
  - If outside 2.5s, it immediately calls the `onUpdate` callback.
- **The Issue**:
  - During burst writes (such as completing or planning multiple tasks in Sunsama triage), multiple events fire. The 2.5s window acts as a complete blackout lockout, but if events arrive outside that window or right at the boundary, it triggers a full refetch on **every** single write, causing redundant network traffic and UI lag.
  - It lacks proper debouncing (grouping multiple updates into a single delayed refetch).

### Planned Fix & State Interactions
- **Zustand State**: Reads `lastMutationAt` and calls `markMutation()`.
- **Implementation**:
  - Introduce a debounced refetch scheduler. Replace the immediate callback invocation with a debounced callback (e.g., using a custom debounce or `setTimeout` wrapper) of 150-300ms.
  - This ensures that if 10 writes happen in a burst, the hook waits for the burst to settle, executing only a single refetch.

### Vitest & React Testing Library (RTL) Interaction Map
- **Mocks**:
  - Mock `@/lib/supabase` to return a mock channel with subscription trigger controls.
  - Mock `useAppStore` state `lastMutationAt`.
- **Querying DOM/Actions**:
  - Render a test component calling `useRealtime("items", mockOnUpdate)`.
  - Simulate Supabase channel events in rapid succession.
- **Verification**:
  - Use `vi.useFakeTimers()` to advance time.
  - Assert that `mockOnUpdate` is called exactly once after the debounce window.
  - Assert that events within the local mutation lockout window (2.5s) are skipped, but subsequent settle-events trigger correctly.

---

## 2. Sunsama Morning & Evening Rituals

### Codebase References
- **Zustand Store**: `src/store/useAppStore.ts`
- **Global Layout Integration**: `src/app/(app)/layout.tsx`
- **Overlay Controller**: `src/components/features/RitualOverlay.tsx`
- **Morning Step 1 (Triage)**: `src/components/features/MorningPlan.tsx`
- **Morning Step 2 (Commit)**: `src/components/features/MorningCommit.tsx`
- **Evening Review Step**: `src/components/features/EveningReview.tsx`
- **Automatic Triggers**: `src/components/layout/AppInitializer.tsx`
- **Manual Trigger**: `src/components/layout/Navigation.tsx` (Sidebar)

### State Changes & Supabase Queries
- **Zustand Store Changes**:
  - Add `activeRitual: 'morning' | 'evening' | null`
  - Add `setActiveRitual: (ritual: 'morning' | 'evening' | null) => void`
  - Expand `UserSettings` with:
    - `last_ritual_date: string` (e.g. "2026-06-27")
    - `shutdown_time: string` (default: "18:00")
    - `daily_capacity_minutes: number` (default: 240)
- **Supabase Queries & Mutations**:
  - **Triage Query**: `supabase.from("items").select("*").in("status", ["inbox", "overdue"])`
  - **Triage Actions**:
    - *Do Today*: `supabase.from("items").update({ status: "active", deadline: todayISO }).eq("id", id)`
    - *Push to Backlog*: Keep status as-is (active) or remove deadline.
    - *Snooze*: `supabase.from("items").update({ snoozed_until: futureISO }).eq("id", id)`
  - **Done Action**: `supabase.from("user_settings").update({ last_ritual_date: todayStr }).eq("user_id", userId)`
  - **Evening Review Queries**:
    - Completed Tasks: `supabase.from("items").select("*").eq("status", "completed").gte("updated_at", todayStart)`
    - Pomodoros: `supabase.from("session_logs").select("*").eq("type", "work").gte("created_at", todayStart)`
  - **Evening Incomplete Carry-over**: `supabase.from("items").update({ deadline: tomorrowISO }).eq("id", id)`
  - **Daily Highlight**: Appends notes/entries to the current date's Daily Note thread in the `threads` table.

### Triggers Flow
1. **Auto Morning**: `AppInitializer.tsx` checks if `now()` > `nudge_time` and `userSettings.last_ritual_date !== todayDateString`. Calls `setActiveRitual('morning')`.
2. **Auto Evening**: A background time checker in `AppInitializer.tsx` fires `setActiveRitual('evening')` when `now()` > `userSettings.shutdown_time`.
3. **Manual**: "Plan my day" button in Sidebar (`Navigation.tsx`) sets `activeRitual = 'morning'`.

### DOM & RTL Interaction Map
- **Ritual Overlay Intercept**:
  - Verify that the overlay is present in the DOM when `activeRitual` is set.
  - Query via test ID: `data-testid="ritual-overlay"` or role `"dialog"`.
- **Morning Triage Step (`MorningPlan.tsx`)**:
  - Stack list: Shows one card at a time.
  - Actions: Buttons with text `"Do today"`, `"Backlog"`, `"Snooze"`.
  - Verification: Check that buttons update item state and pop the stack. Ensure the "Next" button is disabled until all triage items are processed.
- **Morning Commit Step (`MorningCommit.tsx` & `<WorkloadBar />`)**:
  - Estimate Inputs: `role="spinbutton"` or class `estimate-input` (inputs for Pomodoros/minutes).
  - Workload Capacity Display: Bar indicating `total / capacity`.
  - Overcommitment Banner: Query by text `"You are overcommitted"` or similar warning banner class.
- **Evening Review Step (`EveningReview.tsx`)**:
  - Focus Tally: Query by text containing focus minutes.
  - Carry-over Tasks: Checkboxes or list items allowing deadline bumps.
  - Highlight Textarea: `<textarea placeholder="What was your daily highlight?" />`.

---

## 3. Fluid Swipe-to-Delete Mechanics

### Codebase References
- **Reference Implementation**: `src/components/features/TaskCard.tsx` (uses Framer Motion dragging, `SWIPE_DELETE_THRESHOLD = -80`)
- **Inbox Target**: `src/app/(app)/inbox/page.tsx`
- **Explore Target**: `src/app/(app)/explore/page.tsx`
- **People Target**: `src/app/(app)/remember/people/page.tsx`

### Implementation & Gesture Details
- Wrap each item container in a Framer Motion `motion.div` with:
  - `drag="x"`
  - `dragConstraints={{ left: -120, right: 0 }}`
  - `onDragEnd` handler invoking removal on threshold breach (`offset.x < -80`).
- **Database & Query Updates**:
  - **Inbox Swipe**: Triggers `supabase.from("items").update({ status: "deleted" })`. Optimistically removes from cache key `["inbox-tasks"]`.
  - **Explore Swipe**: Triggers `supabase.from("explores").update({ status: "deleted" })`. Optimistically updates `items` local state/cache.
  - **People Swipe**: Triggers `supabase.from("people").delete()`. Optimistically updates `people` local state.
- **Zustand / Query**: Calls `markMutation()` on drag delete success and displays a Undo Toast.

### DOM & RTL Interaction Map
- **Querying elements**:
  - List items should have unique test IDs, e.g., `data-testid="inbox-item-{id}"`, `data-testid="explore-item-{id}"`, `data-testid="person-item-{id}"`.
  - Reveal layer should render a trash icon with a class name or test ID: `data-testid="swipe-trash-icon"`.
- **Testing Gestures in RTL**:
  - Use `fireEvent` to simulate drag gestures:
    ```typescript
    const card = screen.getByTestId("inbox-item-123");
    fireEvent.dragStart(card);
    fireEvent.drag(card, { delta: { x: -100 } });
    fireEvent.dragEnd(card);
    ```
  - Verify that the card is removed from the DOM, toast is displayed, and Supabase client query is executed.

---

## 4. Auto-growing Textareas

### Codebase References
- **Task Add/Edit Panel**: `src/components/features/TaskAddPanel.tsx` (Notes field at line 709)
- **Explore Drawer**: `src/components/features/ExploreDrawer.tsx` (Why saving field at line 257)
- **Add Person Panel**: `src/components/features/AddPersonPanel.tsx` (First Note field at line 202)
- **Think Thread Page**: `src/app/(app)/think/[id]/page.tsx` (Thought editor field at line 324)

### Implementation Details
- Replace the rigid HTML `<textarea>` tag with `TextareaAutosize` from `react-textarea-autosize`.
- Example Before:
  ```tsx
  <textarea
    placeholder="Additional context or details"
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
    className="input"
  />
  ```
- Example After:
  ```tsx
  import TextareaAutosize from 'react-textarea-autosize';
  
  <TextareaAutosize
    placeholder="Additional context or details"
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
    className="input resize-none"
    minRows={2}
  />
  ```

### DOM & RTL Interaction Map
- **Querying**:
  - Query by placeholder, e.g. `screen.getByPlaceholderText("Continue the thought...")`.
  - Role: `screen.getByRole("textbox")`.
- **Testing**:
  - Verify `resize-none` classes are added to prevent manual handles.
  - Simulate typing longer text to verify that value updates and height changes (Vitest tests can spy on component layout or mock `react-textarea-autosize` to assert parameters are passed correctly).

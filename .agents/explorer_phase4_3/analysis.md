# Phase 4 Analysis: Sunsama Rituals & UI Polish

This report presents the analysis and proposed implementation specifications for **Phase 4: Sunsama Rituals & UI Polish**.

---

## 1. Observation (Exact Files & Lines)

### A. Postgres Changes Lockout in `useRealtime.ts`
- **File**: `src/hooks/useRealtime.ts`
- **Current Code (Lines 23-36)**:
```typescript
        (payload) => {
          // Check if we mutated locally within the last 2.5 seconds.
          // If so, ignore this event as it's likely an echo of our own mutation,
          // which prevents the UI from flickering back to an old state before the fetch completes.
          const lastMutationAt = useAppStore.getState().lastMutationAt;
          if (Date.now() - lastMutationAt < 2500) {
            logger.info(`[Realtime] Ignoring echo on ${table} due to recent local mutation`);
            return;
          }

          logger.info(`[Realtime] Update on ${table}:`, payload);
          onUpdateRef.current();
        }
```

### B. User Settings & SQL Migrations
- **Directory**: `supabase/migrations/`
- **Current State**: Migrations end at `009_rename_category_rpc.sql`.
- **Database Schema**: The `user_settings` table is defined in `001_baseline.sql:103-140`. It lacks ritual columns (`last_ritual_date`, `shutdown_time`, `daily_capacity_minutes`). Additionally, the `items` table (defined in `001_baseline.sql:7-30` and amended by `007_time_spent.sql`) lacks a field for task duration estimates (`time_estimate_minutes`).

### C. Sunsama Ritual Triggering & Navigation
- **File**: `src/components/layout/AppInitializer.tsx`
- **Current State**: Handles theme, color mode, and motion settings from `userSettings`. It has no ritual tracking or triggers.
- **File**: `src/components/layout/Navigation.tsx`
- **Current State**: Renders `Sidebar` and `BottomNav` with fixed `navItems`. No button exists to manually launch a daily ritual.
- **File**: `src/store/useAppStore.ts`
- **Current State**: Lacks properties for `activeRitual`, user settings ritual fields, or transition actions.

### D. List Cards & Swipe-to-Delete
- **TaskCard Swipe Reference (Lines 180-200)**:
  - Uses `dragX = useMotionValue(0)` and `useTransform(dragX, [0, SWIPE_DELETE_THRESHOLD], [0, 1])` to show the underlying red trash layer.
  - The card itself uses `drag="x" dragConstraints={{ left: -120, right: 0 }}`.
  - In `handleDragEnd`, it checks `info.offset.x < SWIPE_DELETE_THRESHOLD` to trigger local state and query cache changes, updates database status, and spawns a `sonner` toast with an undo action.
- **Lists Needing Swipe-to-Delete**:
  1. **Inbox**: `src/app/(app)/inbox/page.tsx:243-294` (Currently uses static `motion.div` with a dismiss button `dismissInboxItem`).
  2. **Explore**: `src/app/(app)/explore/page.tsx:152-190` (Uses static `motion.div` and `GlassCard`).
  3. **People**: `src/app/(app)/remember/people/page.tsx:71-96` (`SortablePersonRow` uses `@dnd-kit/sortable` vertical dragging) and `page.tsx:183-211` (Today's Briefings).

### E. Notes/Tasks Textareas
- **Textareas to replace**:
  1. `src/components/features/TaskAddPanel.tsx:709-714` (Task creation details)
  2. `src/components/features/ExploreDrawer.tsx:257-263` (Explore notes)
  3. `src/app/(app)/explore/[id]/page.tsx:305-311` (Explore notes edit)
  4. `src/app/(app)/think/[id]/page.tsx:324-332` (Think space new entry box)
  5. `src/components/features/AddPersonPanel.tsx:202-207` (Person note)
  6. `src/app/onboarding/OnboardingWizard.tsx:327-333` (Onboarding capture)

---

## 2. Logic Chain

### A. useRealtime Lockout Removal & Debouncing
- **Reasoning**: The 2.5-second lockout is a global throttle. If the local user clicks a task checkbox, `lastMutationAt` updates. If another user edits a completely different record (or table) within those 2.5 seconds, that update is dropped by the client.
- **Conclusion**: We should remove `lastMutationAt` checks entirely and instead debounce the `onUpdate` trigger (e.g. by 200ms). When a database change is received, we schedule the query refetch to run after a small delay. If more updates flow in during that delay, we clear and reschedule the timer. By the time the refetch is executed, the database write has long finished, ensuring the client receives the committed version without missing other concurrent changes or hammering the network with rapid duplicate fetches.

### B. SQL Migrations & Database Design
- **Reasoning**: We need to track the user's last ritual date, daily shutdown target time, and their daily capacity limit.
  - `last_ritual_date`: Should be of SQL type `date` to avoid time zone drift issues.
  - `shutdown_time`: Should be of SQL type `time` (defaulting to `'17:00:00'`) as it is a time of day.
  - `daily_capacity_minutes`: Needs to represent minutes (integer), e.g. `300` for 5 hours.
  - `time_estimate_minutes` on `items` table: In order to compare tasks planned for today against `daily_capacity_minutes`, each task needs to have an estimated duration. We must add `time_estimate_minutes` as an integer column on the `items` table.

### C. Zustand State & Ritual Flow
- **Reasoning**: A daily ritual consists of steps that overlay the application.
  - State machine: `activeRitual` can be `'morning-plan' | 'morning-commit' | 'evening-review' | null`.
  - Actions `startRitual(type)`, `nextRitualStep()`, `prevRitualStep()`, and `closeRitual()` allow linear step transition.
  - Dynamic Loading: Since the ritual UI features heavy components (drag-and-drop lists, textareas, charts), we should dynamically import `RitualOverlay` in `DynamicModals.tsx` with `ssr: false` to reduce initial loading bundle sizes.

### D. Swipe-to-Delete Integration
- **Reasoning**: On mobile devices, swipe gestures are the standard pattern for cleaning up cards.
  - In `InboxPage` and `ExplorePage`, list elements are ideal for horizontal swipe-to-delete.
  - In `PeoplePage` (`SortablePersonRow`), the row is vertically sortable using `@dnd-kit/sortable`. However, because the drag listeners are explicitly bound only to the `GripVertical` handle, the rest of the card is free to receive horizontal swipe gestures via Framer Motion without event collision.

### E. Auto-growing Textareas
- **Reasoning**: Long task details or journal entries look squeezed inside fixed-height scrollable textareas.
  - `react-textarea-autosize` must be added to `package.json` and used to replace `<textarea>` tags with `<TextareaAutosize minRows={...} maxRows={...} />`.

---

## 3. Caveats
- **Test Failures**: Running `npm run test` reveals that the `phase3.test.tsx` file fails because `@testing-library/dom` is not found, although it is declared in devDependencies. This environment setup issue must be resolved by running a clean install (`npm install`) on the target machine.
- **Multi-device Sync**: If the user completes the morning ritual on a mobile device, the database updates `last_ritual_date`. Thanks to the realtime subscription, the desktop client will receive this update, load it into Zustand, and automatically prevent the morning ritual from triggering again.

---

## 4. Conclusion & Proposed Implementation Details

### A. Proposed `useRealtime.ts` Debouncing Fix
```typescript
import { logger } from "@/lib/logger";
import { useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase";

export function useRealtime(table: string, onUpdate: () => void, delay = 200) {
  const onUpdateRef = useRef(onUpdate);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel(`realtime_${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => {
          logger.info(`[Realtime] Event on ${table}:`, payload);
          
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
          
          timerRef.current = setTimeout(() => {
            logger.info(`[Realtime] Executing debounced onUpdate for ${table}`);
            onUpdateRef.current();
          }, delay);
        }
      )
      .subscribe();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [table, supabase, delay]);
}
```

### B. Proposed SQL Migration (`supabase/migrations/010_sunsama_ritual_settings.sql`)
```sql
-- Migration 010: Add Sunsama Ritual Settings and Task Estimates
-- Add ritual configuration columns to user_settings table
ALTER TABLE public.user_settings 
  ADD COLUMN IF NOT EXISTS last_ritual_date date,
  ADD COLUMN IF NOT EXISTS shutdown_time time DEFAULT '17:00:00',
  ADD COLUMN IF NOT EXISTS daily_capacity_minutes integer DEFAULT 300;

-- Add time estimate column to items table
ALTER TABLE public.items 
  ADD COLUMN IF NOT EXISTS time_estimate_minutes integer DEFAULT 0;
```

### C. Zustand State Updates (`src/store/useAppStore.ts`)
1. **Extend `UserSettings` Interface**:
```typescript
export interface UserSettings {
  // ... existing fields ...
  last_ritual_date?: string;
  shutdown_time?: string;
  daily_capacity_minutes?: number;
  [key: string]: unknown;
}
```
2. **Extend `AppState` and Actions**:
```typescript
interface AppState {
  // ... existing fields ...
  activeRitual: 'morning-plan' | 'morning-commit' | 'evening-review' | null;
  startRitual: (type: 'morning' | 'evening') => void;
  nextRitualStep: () => void;
  prevRitualStep: () => void;
  closeRitual: () => void;
}
```
3. **Store Slice Implementation**:
```typescript
export const useAppStore = create<AppState>((set) => ({
  // ... existing ...
  activeRitual: null,
  startRitual: (type) => set({ 
    activeRitual: type === 'morning' ? 'morning-plan' : 'evening-review' 
  }),
  nextRitualStep: () => set((state) => {
    if (state.activeRitual === 'morning-plan') return { activeRitual: 'morning-commit' };
    return { activeRitual: null };
  }),
  prevRitualStep: () => set((state) => {
    if (state.activeRitual === 'morning-commit') return { activeRitual: 'morning-plan' };
    return { activeRitual: null };
  }),
  closeRitual: () => set({ activeRitual: null }),
}));
```

### D. Sunsama Ritual Step Components

#### 1. Layout Integration (`src/components/layout/DynamicModals.tsx`)
```typescript
const RitualOverlay = dynamic(
  () => import("@/components/features/RitualOverlay").then(m => ({ default: m.RitualOverlay })),
  { ssr: false, loading: () => null }
);

export function DynamicModals() {
  return (
    <>
      {/* existing modals */}
      <RitualOverlay />
    </>
  );
}
```

#### 2. Main Overlay (`src/components/features/RitualOverlay.tsx`)
This component acts as the layout wrapper:
- Uses a fixed, full-screen backdrop (`z-50 bg-black/80 backdrop-blur-md`).
- Renders progress steps: "Triage" $\rightarrow$ "Commit" (for morning) or "Review & Reflection" (for evening).
- Renders:
  - `<MorningPlan />` if `activeRitual === 'morning-plan'`
  - `<MorningCommit />` if `activeRitual === 'morning-commit'`
  - `<EveningReview />` if `activeRitual === 'evening-review'`

#### 3. Step 1: Triage (`src/components/features/MorningPlan.tsx`)
- Fetches all items with `status === 'inbox'` and overdue items.
- Displays them in a left panel list with options to:
  - Add to Today's Plan (updates `status` to `'active'` and `deadline` to today).
  - Snooze (updates `snoozed_until` / `deadline`).
  - Delete/Archive.
- Right panel shows today's scheduled tasks.
- Navigation buttons: "Close" and "Next: Commit".

#### 4. Step 2: Commit (`src/components/features/MorningCommit.tsx`)
- Fetches tasks scheduled for today.
- Displays an estimate selector (e.g. `30m`, `1h`, `2h` inputs mapped to updating `time_estimate_minutes` in Supabase).
- Sums up total minutes and compares to `daily_capacity_minutes`.
- Shows a warning message if the sum exceeds the capacity.
- Navigation buttons: "Back" and "Commit & Done".

#### 5. Step 3: Done Action
Triggered by the morning ritual's commit action:
1. Calls Supabase to update `last_ritual_date` to today's date (`YYYY-MM-DD` in local time).
2. Updates `userSettings` in the Zustand store.
3. Spawns `toast.success("Plan committed! Have a focused day.")`.
4. Closes the overlay.

#### 6. Step 4: Evening Review (`src/components/features/EveningReview.tsx`)
- Shows completed tasks from today (visual checklist celebration).
- Shows uncompleted tasks with options to:
  - Reschedule for tomorrow/custom date.
  - Move back to Inbox/Backlog.
- Reflection textarea:
  - User logs their daily reflection.
  - Upon clicking "Complete Review", the reflection is saved as a new entry in a special "Daily Reflection Journal" thread in the Think Space (threads database table), `localStorage.setItem('presense_last_evening_review', todayDate)` is set, and the overlay closes.

### E. Auto-Triggering Setup (`src/components/layout/AppInitializer.tsx`)
Add two effects:
1. **Morning Trigger**:
```typescript
useEffect(() => {
  if (!userSettings || Object.keys(userSettings).length === 0) return;
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (userSettings.last_ritual_date !== todayStr) {
    const isOnboarding = window.location.pathname.startsWith('/onboarding');
    if (!isOnboarding) {
      useAppStore.getState().startRitual('morning');
    }
  }
}, [userSettings?.last_ritual_date]);
```
2. **Evening Trigger**:
```typescript
useEffect(() => {
  if (!userSettings || Object.keys(userSettings).length === 0) return;
  const shutdownStr = userSettings.shutdown_time || '17:00:00';
  const [shHour, shMin] = shutdownStr.split(':').map(Number);
  
  const checkShutdown = () => {
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const shutdownTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), shHour, shMin, 0);
    
    if (now >= shutdownTime) {
      const lastEvening = localStorage.getItem('presense_last_evening_review');
      if (lastEvening !== todayStr) {
        const isOnboarding = window.location.pathname.startsWith('/onboarding');
        if (!isOnboarding) {
          useAppStore.getState().startRitual('evening');
        }
      }
    }
  };

  checkShutdown();
  const interval = setInterval(checkShutdown, 60000);
  return () => clearInterval(interval);
}, [userSettings?.shutdown_time]);
```

### F. Manual Sidebar Button (`src/components/layout/Navigation.tsx`)
Include a "Daily Ritual" navigation option in the bottom section of `Sidebar`:
```typescript
const now = new Date();
const currentHour = now.getHours();
const triggerLabel = currentHour < 16 ? "Plan Day" : "Evening Shutdown";
const triggerType = currentHour < 16 ? "morning" : "evening";
// Render button in bottom navigation rows using Lucide Sparkles icon
```

### G. Swipe-to-Delete Component Design
Create a modular wrapper component or extract list items to components (e.g. `InboxCard.tsx` and `ExploreCard.tsx`).
- Back reveal layer styles:
```typescript
<motion.div
  className="absolute inset-0 flex items-center justify-end pr-5 rounded-2xl overflow-hidden pointer-events-none"
  style={{
    background: "linear-gradient(90deg, transparent 0%, rgba(248,113,113,0.15) 60%, rgba(239,68,68,0.25) 100%)",
    opacity: deleteOpacity,
  }}
>
  <motion.div style={{ scale: deleteScale }}>
    <Trash2 className="w-5 h-5 text-red-400" />
  </motion.div>
</motion.div>
```
- Draggable container on card:
```typescript
<motion.div
  drag="x"
  dragConstraints={{ left: -120, right: 0 }}
  dragElastic={{ left: 0.15, right: 0 }}
  onDragEnd={handleDragEnd}
  style={{ x: dragX }}
>
```
- In `PeoplePage` / `SortablePersonRow`, place the `drag="x"` container inside the sortable row wrapper but *outside* the link. Since DND-kit handles click and vertical drag specifically on the `GripVertical` handle, horizontal drag gesture is handled smoothly by Framer Motion on the rest of the card without conflict.

### H. Auto-Growing Textareas
Add `"react-textarea-autosize": "^8.5.3"` to `package.json` dependencies.
Replace raw `<textarea className="input" ... />` elements with:
```typescript
import TextareaAutosize from 'react-textarea-autosize';

<TextareaAutosize
  className="input resize-none"
  minRows={3}
  maxRows={10}
  // existing attributes...
/>
```

---

## 5. Verification Method

1. **Database Migration Verification**:
   - Run the migration on Supabase: `npx supabase db push` or execute the queries in the SQL editor.
   - Run `npx supabase db lint` (if available) to ensure syntactical correctness.
2. **Component Integration**:
   - Launch the dev server: `npm run dev`.
   - Verify the "Daily Ritual" sidebar button appears and changes label between "Plan Day" (morning) and "Evening Shutdown" (evening) dynamically.
   - Verify clicking the sidebar button opens the full-screen overlay backdrop.
3. **Trigger Logic Verification**:
   - Simulate a morning trigger: Edit local storage or database `last_ritual_date` to yesterday's date, refresh, and verify the Morning Triage step loads automatically.
   - Simulate an evening trigger: Change `shutdown_time` to 1 minute in the future, wait, and verify the Evening Review overlay auto-triggers.
4. **Gesture Verification**:
   - Test swipe-to-delete cards in Inbox, Explore, and People pages on mobile simulation mode. Verify that:
     - Dragging left reveals the red trash icon.
     - Releasing past the threshold triggers deletion, showing a Sonner Toast.
     - Clicking "Undo" restores the item locally and in the database.
     - On the People list, verify vertical re-ordering using the grip handle still works and does not trigger horizontal swipe deletion.
5. **Textarea Verification**:
   - Verify typing long entries in Task creation notes, Explore notes, and Journal entries expands the text box height smoothly up to the `maxRows` threshold without showing scrollbars.

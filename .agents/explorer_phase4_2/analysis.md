# Phase 4 Analysis: Sunsama Rituals & UI Polish

## Observation

### 1. File Path & Code Analysis of `src/hooks/useRealtime.ts`
In `src/hooks/useRealtime.ts`, lines 24–31 enforce a 2.5-second lockout window on Postgres changes following a local mutation:
```typescript
          const lastMutationAt = useAppStore.getState().lastMutationAt;
          if (Date.now() - lastMutationAt < 2500) {
            logger.info(`[Realtime] Ignoring echo on ${table} due to recent local mutation`);
            return;
          }
```
This blocks all remote updates for any user who recently saved a change, resulting in missed concurrent edits from other users.

### 2. SQL Migration Layout (`supabase/migrations/`)
The table `public.user_settings` was created in `001_baseline.sql` (lines 103–142). It currently lacks Sunsama ritual settings. 
The database table `public.items` (which maps to the "Do" Space tasks, defined in `001_baseline.sql` lines 7–30) contains `time_spent_minutes` (renamed in `007_time_spent.sql`), but does not have a column for estimating task durations, which is necessary to track daily planned time.

### 3. Zustand Store (`src/store/useAppStore.ts`)
The Zustand app store (`src/store/useAppStore.ts`) currently has fields for generic settings (`userSettings`), active timer state, and a `lastMutationAt` timestamp (lines 51–60, 73–82). It lacks states and actions for orchestrating Sunsama rituals.

### 4. UI Layout & Navigation
- **Sidebar & Bottom Nav**: `src/components/layout/Navigation.tsx` renders sidebar links (`navItems`) and action buttons like "Quick Capture" (lines 94–110) and "Settings" (lines 203–226). It contains no triggers for daily rituals.
- **App Initialization**: `src/components/layout/AppInitializer.tsx` applies theme, mode, and motion settings from `userSettings` on mount (lines 15–45). It contains no scheduling check to automatically launch daily rituals.
- **Dynamic Modals**: `src/components/layout/DynamicModals.tsx` dynamically loads large modals (`CaptureModal`, `SearchModal`, `SettingsModal`, `PomodoroTimer`) client-side to save bundle size (lines 7–36).

### 5. UI Polish Components
- **Inbox Cards**: Renders items inside `src/app/(app)/inbox/page.tsx` using `motion.div` transition cards (lines 243–293), but lacks drag handlers or swipe-to-delete actions.
- **Explore Cards**: Renders saved links and notes inside `src/app/(app)/explore/page.tsx` using static `GlassCard` wrapper items inside a `motion.div` list (lines 151–190). Deletions are only possible by opening the edit drawer.
- **People List Cards**: Renders sorting lists inside `src/app/(app)/remember/people/page.tsx` using `@dnd-kit/sortable` inside a `SortablePersonRow` wrapper (lines 49–98), which only supports vertical ordering via `GripVertical`.
- **Textarea Inputs**: Textareas for notes and tasks in `TaskAddPanel.tsx` (line 709), `ExploreDrawer.tsx` (line 257), `AddPersonPanel.tsx` (line 202), and other views are standard HTML `<textarea>` tags with fixed height, requiring manual scrollbars.

---

## Logic Chain

### 1. `useRealtime.ts` Debouncing without Lockout
Instead of locking out *all* events, we can use a debounced callback to delay the execution of the refetch `onUpdate`. 
- **Step 1**: When Supabase broadcasts a `postgres_changes` event (whether it's our own echo or another user's change), the event handler fires.
- **Step 2**: The handler calls a debounced update function (e.g. 400ms delay).
- **Step 3**: This 400ms delay gives the local mutation write transaction ample time to commit and index in the DB.
- **Step 4**: When the debounced function fires, it triggers a clean refetch. Because the write is fully completed, the query returns the latest state, matching the optimistic UI state, which prevents UI flickering/rollback.
- **Step 5**: If multiple database updates (echoes or concurrent changes) arrive in rapid succession, the debounce coalesces them into a single refetch, minimizing unnecessary network traffic.

### 2. SQL Migration Design
To support Sunsama rituals, we need to track:
1. `last_ritual_date`: To know if the user has already planned today.
2. `shutdown_time`: To identify when the work day ends and trigger the Evening Review.
3. `daily_capacity_minutes`: To calculate the daily work budget limit.
We also need a task-level column `estimated_minutes` on `items` so the planning step can compute total planned minutes against the `daily_capacity_minutes` limit.

### 3. Sunsama Ritual State & Components
To drive the multi-step full-screen overlay:
- The Zustand store must track `activeRitual` ('morning' | 'evening' | null) and `ritualStep` (1, 2, or 3).
- Placing the `RitualOverlay` inside `DynamicModals.tsx` ensures it is dynamically loaded only when needed and rendered at the root of the app.
- **Morning Planning Flow**:
  - *Triage Component*: Shows Inbox/Backlog items on the left and Today's items on the right. Sums `estimated_minutes` of Today's tasks. If the sum exceeds `daily_capacity_minutes`, a warning is shown.
  - *Commit Component*: Allows sorting Today's tasks using `@dnd-kit/sortable` (matching the People sorting design) and prompts the user to enter a "focus of the day".
  - *Done Action*: Saves the daily focus and updates `last_ritual_date` to today's date in Supabase before closing.
- **Evening Review Flow**:
  - *Reflect Component*: Shows completed tasks and aggregates hours spent.
  - *Reschedule Component*: Shows incomplete tasks and provides quick buttons to Snooze, Move to Tomorrow, or return to Backlog.
  - *Done Action*: Sets `last_evening_review_date` to today in `localStorage` and closes the overlay.
- **Auto Triggering**: `AppInitializer.tsx` checks if `last_ritual_date` !== today. If so, and it is before `shutdown_time`, it launches Morning Planning. If past `shutdown_time` and `last_evening_review_date` !== today, it launches Evening Review.
- **Manual Triggering**: A sidebar button manually starts the ritual appropriate for the current time.

### 4. UI Polish Implementation
- **Swipe-to-delete**:
  - We can extract the drag properties and reveal layer from `TaskCard.tsx` and implement them in the Inbox, Explore, and People cards.
  - In `SortablePersonRow`, because vertical sorting is bound to the `GripVertical` handle, attaching Framer Motion `drag="x"` to the card body lets horizontal swipes delete the person, while vertical drags sort them.
  - The deletion handler will optimistically update the react-query cache, trigger the database delete, and show a `sonner` toast with an "Undo" action.
- **Auto-growing textareas**:
  - Standard HTML textareas do not grow dynamically. Proposing `"react-textarea-autosize"` as a dependency. Replacing `<textarea>` with `<TextareaAutosize minRows={3} className="input resize-none" />` resolves the usability constraint and matches professional design patterns.

---

## Caveats

1. **Vitest Execution Failure**: A test run of `npm run test` failed with `Error: Cannot find module '@testing-library/dom'`. This indicates that the local development dependencies are either not fully installed or misconfigured. This does not impact the design phase but should be resolved by the implementation agent running `npm install`.
2. **Local Storage for Evening Review**: Since the migration requests adding `last_ritual_date` (which tracks morning planning) but no counterpart for the evening, we assume tracking the evening review completion in `localStorage` is sufficient. Alternatively, a future migration could add `last_evening_review_date` to the database.

---

## Conclusion

The implementation of Phase 4 requires changes in five key areas:
1. Replacing the lockout check in `useRealtime.ts` with a 400ms debounced callback.
2. Creating a new SQL migration (`010_sunsama_rituals.sql`) to add settings to `user_settings` and `estimated_minutes` to `items`.
3. Adding ritual state (active, step, focus) and transitions to `useAppStore.ts`.
4. Creating the new Sunsama components (`RitualOverlay`, `MorningPlan`, `MorningCommit`, `EveningReview`) and wiring triggers in `AppInitializer.tsx` and `Navigation.tsx`.
5. Rewriting cards in Inbox, Explore, and People lists to support swipe-to-delete with undo, and swapping notes textareas with `react-textarea-autosize`.

---

## Technical Design & Proposals

### 1. Proposed Code: `src/hooks/useRealtime.ts`
```typescript
import { logger } from "@/lib/logger";
import { useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { useDebouncedCallback } from "use-debounce";

export function useRealtime(table: string, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const supabase = useMemo(() => createClient(), []);

  // Coalesce rapid updates and delay execution to allow local DB writes to commit/index
  const debouncedUpdate = useDebouncedCallback(() => {
    logger.info(`[Realtime] Triggering debounced update for ${table}`);
    onUpdateRef.current();
  }, 400);

  useEffect(() => {
    const channel = supabase
      .channel(`realtime_${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => {
          logger.info(`[Realtime] Postgres change detected on ${table}:`, payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, supabase, debouncedUpdate]);
}
```

### 2. Proposed Migration: `supabase/migrations/010_sunsama_rituals.sql`
```sql
-- Add Sunsama Daily Rituals and Task Estimation Configuration
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS last_ritual_date DATE,
  ADD COLUMN IF NOT EXISTS shutdown_time TIME DEFAULT '17:00:00',
  ADD COLUMN IF NOT EXISTS daily_capacity_minutes INTEGER DEFAULT 300;

-- Add estimated_minutes to items for tracking daily planned limits
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT 30;
```

### 3. Proposed Zustand Additions: `src/store/useAppStore.ts`
```typescript
// Interface updates
export interface UserSettings {
  // Existing fields...
  last_ritual_date?: string | null;
  shutdown_time?: string;
  daily_capacity_minutes?: number;
}

interface AppState {
  // Existing state...
  activeRitual: 'morning' | 'evening' | null;
  ritualStep: number;
  ritualFocus: string;
  startRitual: (type: 'morning' | 'evening') => void;
  setRitualStep: (step: number) => void;
  setRitualFocus: (focus: string) => void;
  nextRitualStep: () => void;
  prevRitualStep: () => void;
  endRitual: () => void;
}

// Store creator updates
export const useAppStore = create<AppState>((set) => ({
  // Existing state...
  activeRitual: null,
  ritualStep: 1,
  ritualFocus: "",
  startRitual: (type) => set({ activeRitual: type, ritualStep: 1, ritualFocus: "" }),
  setRitualStep: (step) => set({ ritualStep: step }),
  setRitualFocus: (focus) => set({ ritualFocus: focus }),
  nextRitualStep: () => set((state) => ({ ritualStep: state.ritualStep + 1 })),
  prevRitualStep: () => set((state) => ({ ritualStep: Math.max(1, state.ritualStep - 1) })),
  endRitual: () => set({ activeRitual: null, ritualStep: 1, ritualFocus: "" }),
}));
```

### 4. Proposed Component Structure: Sunsama Daily Rituals

#### `src/components/features/RitualOverlay.tsx`
Orchestrator Overlay rendered at layout root (loaded dynamically in `DynamicModals.tsx`):
```typescript
import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { MorningPlan } from "./MorningPlan";
import { MorningCommit } from "./MorningCommit";
import { EveningReview } from "./EveningReview";
import { Sparkles, CheckCircle2, X } from "lucide-react";

export function RitualOverlay() {
  const { activeRitual, ritualStep, prevRitualStep, nextRitualStep, endRitual } = useAppStore();

  if (!activeRitual) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-background)]/95 backdrop-blur-md flex flex-col text-[var(--color-text-1)]">
      {/* Header */}
      <header className="h-[60px] border-b border-[var(--border-subtle)] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--accent)] animate-pulse" />
          <h2 className="font-semibold text-lg">
            {activeRitual === 'morning' ? "Morning Planning" : "Evening Review"}
          </h2>
        </div>
        <div className="text-xs text-[var(--text-3)] font-medium bg-[var(--surface-card)] px-3 py-1 rounded-full border border-[var(--color-border)]">
          Step {ritualStep} of 3
        </div>
        <button onClick={endRitual} className="btn-icon">
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        <div className="w-full max-w-5xl flex-1 flex flex-col">
          {activeRitual === 'morning' && ritualStep === 1 && <MorningPlan />}
          {activeRitual === 'morning' && ritualStep === 2 && <MorningCommit />}
          {activeRitual === 'morning' && ritualStep === 3 && <MorningDone />}
          {activeRitual === 'evening' && <EveningReview step={ritualStep} />}
        </div>
      </main>

      {/* Footer Nav */}
      <footer className="h-[70px] border-t border-[var(--border-subtle)] flex items-center justify-between px-6 shrink-0">
        {ritualStep > 1 && ritualStep < 3 ? (
          <button onClick={prevRitualStep} className="btn-secondary">Back</button>
        ) : <div />}
        
        {ritualStep < 3 ? (
          <button onClick={nextRitualStep} className="btn-primary px-8">Next Step</button>
        ) : <div />}
      </footer>
    </div>
  );
}

// Step 3 screen for Morning Plan
function MorningDone() {
  const { endRitual, userSettings, updateUserSetting } = useAppStore();
  const handleStartDay = async () => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    // Save to Supabase...
    updateUserSetting("last_ritual_date", todayStr);
    endRitual();
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center max-w-md mx-auto space-y-6">
      <div className="w-16 h-16 rounded-full bg-[var(--accent-dim)] flex items-center justify-center border border-[var(--accent-border)]">
        <CheckCircle2 className="w-8 h-8 text-[var(--accent)]" />
      </div>
      <h3 className="text-2xl font-semibold">Your day is planned!</h3>
      <p className="text-sm text-[var(--text-3)] leading-relaxed">
        You have designed a sustainable focus for today. Trust your plan, limit distractions, and focus on one task at a time.
      </p>
      <button onClick={handleStartDay} className="btn-primary w-full py-3.5 text-base">Let's Go</button>
    </div>
  );
}
```

### 5. Swipe-To-Delete Isolation inside `SortablePersonRow`
We isolate horizontal swipe-to-delete from vertical sorting in `src/app/(app)/remember/people/page.tsx` by keeping the drag handle listener on the vertical bar, and using Framer Motion's `drag="x"` on the main content row:
```typescript
function SortablePersonRow({ person, formatMeeting, onDelete }: { person: Person, formatMeeting: (d: string) => string, onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: person.id });
  const dragX = useMotionValue(0);
  const deleteOpacity = useTransform(dragX, [0, -80], [0, 1]);
  const deleteScale = useTransform(dragX, [0, -80], [0.7, 1]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -80) {
      animate(dragX, -300, { duration: 0.25 });
      onDelete(person.id);
    } else {
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50 z-50")}>
      <GlassCard className="p-0 hover:scale-[1.005] transition-transform overflow-hidden flex items-stretch relative">
        {/* Vertical Grip (DND Handle) */}
        <div {...attributes} {...listeners} className="w-8 flex items-center justify-center bg-[var(--color-surface)] border-r border-[var(--color-border)] cursor-grab active:cursor-grabbing hover:bg-[var(--color-surface)] transition-colors z-20">
          <GripVertical className="w-4 h-4 text-[var(--color-text-3)]" />
        </div>

        {/* Swipe Delete Background (Framer Motion) */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-end pr-5 bg-red-500/10 border-red-500/20 z-0"
          style={{ opacity: deleteOpacity }}
        >
          <motion.div style={{ scale: deleteScale }}>
            <Trash2 className="w-5 h-5 text-red-400" />
          </motion.div>
        </motion.div>

        {/* Draggable Card Body (Framer Motion) */}
        <motion.div
          drag="x"
          dragConstraints={{ left: -120, right: 0 }}
          dragElastic={{ left: 0.15, right: 0 }}
          onDragEnd={handleDragEnd}
          style={{ x: dragX }}
          className="flex-1 relative bg-[var(--color-background)] z-10"
        >
          <Link href={`/remember/people/${person.id}`} className="block p-4">
            {/* Person Name & Initials details... */}
          </Link>
        </motion.div>
      </GlassCard>
    </div>
  );
}
```

---

## Verification Method

### 1. Database Setup Verification
Apply the migration using the local database tool or CLI:
```powershell
# Run the migration
./scripts/run_migrations.ps1
```
Verify the columns exist by checking the local database schema via `psql` or the Supabase Studio dashboard:
- Confirm `user_settings` table contains `last_ritual_date`, `shutdown_time`, and `daily_capacity_minutes`.
- Confirm `items` table contains `estimated_minutes`.

### 2. Automatic Trigger Verification
Temporarily update the user settings locally or via query:
- Set `last_ritual_date = NULL` or yesterday's date.
- Set `shutdown_time = '17:00:00'`.
- Launch the application:
  - If current local hour < 17: Confirm that `Morning Planning` modal automatically pops up.
  - If current local hour >= 17: Confirm that `Evening Review` modal automatically pops up.
- Trigger completion of the ritual and verify `last_ritual_date` is written to the database as the current date.

### 3. Swipe-to-delete & Undo Verification
- In the Inbox space, swipe a card left past the -80px threshold. Confirm it slides out and disappears.
- A toast notification should appear at the bottom: "Dismissed". Click "Undo". Confirm the card returns to the viewport list in its exact previous state.
- In the Remember space, verify that dragging the horizontal card body deletes the person, while dragging the left vertical grip handle reorders them vertically.

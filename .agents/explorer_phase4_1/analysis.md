# Handoff Report: Phase 4 Sunsama Rituals & UI Polish Analysis

## Observation

We analyzed the current codebase and observed the following:

1. **Realtime Subscription Lockout (`src/hooks/useRealtime.ts`):**
   Lines 27–31 of `src/hooks/useRealtime.ts` show that a global 2.5s echo lockout is implemented using `lastMutationAt` from the Zustand store:
   ```typescript
   const lastMutationAt = useAppStore.getState().lastMutationAt;
   if (Date.now() - lastMutationAt < 2500) {
     logger.info(`[Realtime] Ignoring echo on ${table} due to recent local mutation`);
     return;
   }
   ```
   This global lockout prevents real-time updates for *all* tables when any local mutation happens, and 2.5s is an excessively long lockout duration.

2. **Zustand App Store State (`src/store/useAppStore.ts`):**
   `useAppStore.ts` contains `userSettings` and `lastMutationAt` / `markMutation` but lacks fields to track the active ritual state, user settings for rituals (`last_ritual_date`, `shutdown_time`, `daily_capacity_minutes`), or per-table mutation timestamps.

3. **Database Schema (`supabase/migrations/`):**
   Existing migrations end at `009_rename_category_rpc.sql`. The `user_settings` table currently does not include columns for tracking the last completed ritual date, user shutdown time, or daily capacity. Furthermore, the `items` table (representing tasks) has no field for storing estimated task duration (e.g., `time_estimate`).

4. **Swipe-to-Delete Reference (`src/components/features/TaskCard.tsx`):**
   Lines 56–59, 79–153, and 193–202 in `TaskCard.tsx` implement a successful horizontal swipe gesture using Framer Motion (`drag="x"`, `useMotionValue`, `useTransform`, and `onDragEnd` animations) which triggers task archiving.

5. **List Components to Polish:**
   - **Inbox:** `src/app/(app)/inbox/page.tsx` renders inbox item list cards but without swipe-to-delete.
   - **Explore:** `src/app/(app)/explore/page.tsx` renders saved items but lacks swipe gestures.
   - **People:** `src/app/(app)/remember/people/page.tsx` uses `dnd-kit`'s `SortableContext` for vertical reordering of contacts, which can cause gesture conflicts if horizontal swipe-to-delete is applied to the same wrapper.

6. **Textareas in Codebase:**
   Six files contain standard HTML `<textarea>` elements:
   - `src/app/(app)/explore/[id]/page.tsx` (line 305)
   - `src/app/(app)/think/[id]/page.tsx` (line 324)
   - `src/app/onboarding/OnboardingWizard.tsx` (line 327)
   - `src/components/features/AddPersonPanel.tsx` (line 202)
   - `src/components/features/ExploreDrawer.tsx` (line 257)
   - `src/components/features/TaskAddPanel.tsx` (line 709)
   
   Currently, `package.json` does not include `react-textarea-autosize`.

---

## Logic Chain

Based on these observations, we reasoned about the required implementations:

1. **Optimized Realtime Debouncing:**
   - Instead of a global 2.5s lockout, we should reduce the lockout to `500ms` and make it **per-table** by tracking a map of `{ [table: string]: number }` in the Zustand store.
   - We will implement a `150ms` trailing-edge debounce on the `onUpdate` callback inside `useRealtime.ts` (using `setTimeout` internally or using the `use-debounce` package) to prevent rapid consecutive query invalidations.

2. **SQL Migration (`supabase/migrations/010_sunsama_rituals.sql`):**
   - Add `last_ritual_date` (date type, which handles calendar dates without timezone offsets) to `user_settings`.
   - Add `shutdown_time` (time type, default `'18:00:00'`) to `user_settings`.
   - Add `daily_capacity_minutes` (integer, default `300`) to `user_settings`.
   - Add `time_estimate` (integer, default `0`) to the `items` table so that commitments can be budgeted.

3. **Zustand Store Extensions:**
   - Update `UserSettings` interface in `src/store/useAppStore.ts` with the new optional fields.
   - Add `activeRitual: 'morning' | 'evening' | null` and `setActiveRitual: (ritual: 'morning' | 'evening' | null) => void`.
   - Extend `markMutation` to accept a table parameter: `markMutation: (table: string) => void`, updating a `lastMutationsByTable` record.

4. **Sunsama Ritual Components:**
   - Create `RitualOverlay.tsx` as a full-screen wizard. When `activeRitual` is active, it renders step components.
   - **Step 1: Triage (`MorningPlan.tsx`):** Renders Inbox items. Allows quick routing or archiving before starting planning.
   - **Step 2: Commit (`MorningCommit.tsx`):** Lists today's active tasks, aggregates their `time_estimate`, compares it with `daily_capacity_minutes`, and renders a progress bar. Warns users if they exceed capacity, offering direct "reschedule to tomorrow" actions.
   - **Step 3: Done Action:** Clicking "Start Day" updates `last_ritual_date` in database & Zustand, triggers a success toast, and closes the overlay.
   - **Step 4: Evening Review (`EveningReview.tsx`):** Reviews completed tasks (to celebrate) and incomplete tasks (to reschedule/backlog). Clicking "Shut Down" saves `last_ritual_date` and transitions the app state.
   - **Triggers:**
     - *Auto:* `AppInitializer.tsx` will run a check. If `last_ritual_date !== today`, trigger morning ritual if hour is between 4 AM and 12 PM, or evening ritual if hour is past `shutdown_time`.
     - *Manual:* Sidebar `Navigation.tsx` will include a `Daily Ritual` item with a `Sparkles` icon, opening the morning ritual (if before 2 PM) or evening ritual (if after 2 PM).

5. **UI Polish & Swipe-to-Delete:**
   - Apply Framer Motion swipe-to-delete wrapper inside `InboxPage`, `ExplorePage`, and `PeoplePage`.
   - For `PeoplePage` (which has a `dnd-kit` Sortable wrapper), avoid gesture conflict by confining `dnd-kit`'s listeners strictly to the `GripVertical` handle and applying Framer Motion's `drag="x"` to the *inner* card component. This isolates vertical sorting from horizontal swiping.
   - For auto-growing textareas: add `react-textarea-autosize` to `dependencies` in `package.json` and replace standard `<textarea>` elements with `<TextareaAutosize className="... resize-none" minRows={3} />`.

---

## Caveats

1. **Time Estimates:** Tasks currently have no `time_estimate` column. We assume adding `time_estimate` to the `items` table in the migration is acceptable and preferred.
2. **Database Version:** Since local time zone shifts can affect date comparisons, we assume comparing local dates formatted as `YYYY-MM-DD` (`new Date().toLocaleDateString('en-CA')`) with the database `date` type is the most robust approach to avoid timezone-edge bugs.
3. **Libraries:** We assume that adding the small, popular `react-textarea-autosize` library to `package.json` is acceptable.

---

## Conclusion & Proposed Designs

Here are the precise proposed designs and code structures:

### 1. `src/hooks/useRealtime.ts` Proposed Fix

Remove the 2.5s lockout and replace it with per-table tracking and a 150ms debounce:

```typescript
import { logger } from "@/lib/logger";
import { useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";

export function useRealtime(table: string, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const debouncedUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logger.info(`[Realtime] Triggering debounced update for ${table}`);
        onUpdateRef.current();
      }, 150);
    };

    const channel = supabase
      .channel(`realtime_${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => {
          // Check if we mutated this specific table locally within the last 500ms
          const lastMutations = useAppStore.getState().lastMutations;
          const lastMutationAt = lastMutations[table] || 0;
          
          if (Date.now() - lastMutationAt < 500) {
            logger.info(`[Realtime] Ignoring echo on ${table} due to recent local mutation`);
            return;
          }

          logger.info(`[Realtime] Update on ${table}:`, payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [table, supabase]);
}
```

### 2. Proposed SQL Migration (`supabase/migrations/010_sunsama_rituals.sql`)

```sql
-- Add Sunsama Ritual settings to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS last_ritual_date date,
ADD COLUMN IF NOT EXISTS shutdown_time time DEFAULT '18:00:00',
ADD COLUMN IF NOT EXISTS daily_capacity_minutes int DEFAULT 300;

-- Add time estimate to items (tasks) table
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS time_estimate int DEFAULT 0;
```

### 3. Zustand State (`src/store/useAppStore.ts`)

Modify `UserSettings` and `AppState` interfaces and update the store:

```typescript
export interface UserSettings {
  // ... existing settings ...
  last_ritual_date?: string;
  shutdown_time?: string;
  daily_capacity_minutes?: number;
  [key: string]: unknown;
}

export type RitualType = 'morning' | 'evening' | null;

interface AppState {
  // ... existing state ...
  activeRitual: RitualType;
  setActiveRitual: (ritual: RitualType) => void;
  lastMutations: Record<string, number>;
  markMutation: (table: string) => void;
  // ...
}

export const useAppStore = create<AppState>((set) => ({
  // ... existing values ...
  activeRitual: null,
  setActiveRitual: (ritual) => set({ activeRitual: ritual }),
  lastMutations: {},
  markMutation: (table) => set((state) => ({
    lastMutations: { ...state.lastMutations, [table]: Date.now() }
  })),
  // ...
}));
```

### 4. Sunsama Ritual components

#### `src/components/features/RitualOverlay.tsx`
```typescript
"use client";

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { MorningPlan } from './MorningPlan';
import { MorningCommit } from './MorningCommit';
import { EveningReview } from './EveningReview';
import { X } from 'lucide-react';

export function RitualOverlay() {
  const { activeRitual, setActiveRitual } = useAppStore();
  const [step, setStep] = useState(1);

  if (!activeRitual) return null;

  const handleClose = () => {
    setActiveRitual(null);
    setStep(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-8 animate-in fade-in duration-300">
      <button 
        onClick={handleClose} 
        className="absolute top-4 right-4 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] p-2 rounded-full hover:bg-white/5 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="w-full max-w-4xl h-[90vh] flex flex-col bg-[var(--color-background)] border border-[var(--border-subtle)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        {activeRitual === 'morning' ? (
          <>
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--color-surface)]">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-1)] text-amber-400">Morning Planning</h2>
                <p className="text-xs text-[var(--color-text-3)]">Step {step} of 2</p>
              </div>
              <div className="flex gap-1.5">
                <span className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-amber-400' : 'bg-[var(--border-strong)]'}`} />
                <span className={`w-2 h-2 rounded-full ${step === 2 ? 'bg-amber-400' : 'bg-[var(--border-strong)]'}`} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {step === 1 ? (
                <MorningPlan onNext={() => setStep(2)} />
              ) : (
                <MorningCommit onBack={() => setStep(1)} onComplete={handleClose} />
              )}
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--color-surface)]">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-1)] text-indigo-400">Evening Shutdown</h2>
                <p className="text-xs text-[var(--color-text-3)]">Reflecting on the day</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <EveningReview onComplete={handleClose} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

#### `src/components/features/MorningPlan.tsx` (Step 1: Triage)
Lists inbox items so they can be processed into active tasks (`Do`) or dismissed:
```typescript
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase';
import { Loader2, ArrowRight, FolderInput, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function MorningPlan({ onNext }: { onNext: () => void }) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: inboxItems = [], isLoading } = useQuery({
    queryKey: ['inbox-tasks-ritual'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'inbox')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const moveToToday = async (id: string) => {
    const today = new Date().toLocaleDateString('en-CA');
    await supabase.from('items').update({ status: 'active', deadline: today }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['inbox-tasks-ritual'] });
    toast.success('Moved task to today');
  };

  const dismissItem = async (id: string) => {
    await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['inbox-tasks-ritual'] });
    toast.success('Inbox item dismissed');
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h3 className="text-2xl font-semibold text-[var(--color-text-1)]">Clear Your Inbox</h3>
        <p className="text-sm text-[var(--color-text-3)]">
          Process unorganized items into today's list or dismiss them.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto max-w-xl mx-auto w-full space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--color-text-3)]" /></div>
        ) : inboxItems.length === 0 ? (
          <div className="text-center py-16 text-sm text-[var(--color-text-3)] border border-dashed border-[var(--border-subtle)] rounded-2xl">
            🎉 Inbox is empty! Ready to schedule commitments.
          </div>
        ) : (
          <div className="space-y-2">
            {inboxItems.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center p-4 bg-[var(--color-surface)] border border-[var(--border-subtle)] rounded-2xl">
                <span className="text-sm font-medium text-[var(--color-text-1)]">{item.title}</span>
                <div className="flex gap-2">
                  <button onClick={() => moveToToday(item.id)} className="btn-secondary !text-xs !py-1 px-3 flex items-center gap-1.5">
                    <FolderInput className="w-3.5 h-3.5" /> Do Today
                  </button>
                  <button onClick={() => dismissItem(item.id)} className="btn-danger !text-xs !py-1 px-3 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-[var(--border-subtle)] flex justify-end">
        <button onClick={onNext} className="btn-primary flex items-center gap-2">
          Next: Commit to Today <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

#### `src/components/features/MorningCommit.tsx` (Step 2: Commit)
Compares tasks with capacity limit, allowing the user to budget time:
```typescript
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export function MorningCommit({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { userSettings, updateUserSetting, markMutation } = useAppStore();

  const capacity = userSettings.daily_capacity_minutes || 300;

  const { data: todayTasks = [], isLoading } = useQuery({
    queryKey: ['today-tasks-ritual'],
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA');
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'active')
        .eq('deadline', today);
      if (error) throw error;
      return data || [];
    }
  });

  const totalMinutes = todayTasks.reduce((sum: number, t: any) => sum + (t.time_estimate || 0), 0);

  const formatHours = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return hrs > 0 ? `${hrs}h ${m}m` : `${m}m`;
  };

  const rescheduleToTomorrow = async (id: string) => {
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');
    await supabase.from('items').update({ deadline: tomorrow }).eq('id', id);
    markMutation('items');
    queryClient.invalidateQueries({ queryKey: ['today-tasks-ritual'] });
    toast.success('Rescheduled task to tomorrow');
  };

  const handleStartDay = async () => {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_settings').update({ last_ritual_date: todayStr }).eq('user_id', user.id);
        updateUserSetting('last_ritual_date', todayStr);
      }
      toast.success("Morning Ritual complete! Let's start the day.");
      onComplete();
    } catch (e: any) {
      toast.error("Failed to complete morning planning", { description: e.message });
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h3 className="text-2xl font-semibold text-[var(--color-text-1)]">Your Commitments</h3>
        <p className="text-sm text-[var(--color-text-3)]">Ensure your workday budget is realistic.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto max-w-xl mx-auto w-full space-y-6">
        <div className="bg-[var(--color-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-[var(--color-text-2)]">Total Estimated: {formatHours(totalMinutes)}</span>
            <span className={totalMinutes > capacity ? 'text-red-400' : 'text-green-400'}>Capacity: {formatHours(capacity)}</span>
          </div>
          <div className="w-full h-3 rounded-full bg-[var(--border-subtle)] overflow-hidden">
            <div className={`h-full transition-all duration-500 ${totalMinutes > capacity ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${Math.min((totalMinutes / capacity) * 100, 100)}%` }} />
          </div>
          {totalMinutes > capacity && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Overloaded! Reschedule tasks to stay within limits.</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--color-text-3)]" /></div>
          ) : todayTasks.length === 0 ? (
            <div className="text-center py-10 text-sm text-[var(--color-text-3)]">No tasks committed for today.</div>
          ) : (
            todayTasks.map((task: any) => (
              <div key={task.id} className="flex justify-between items-center p-4 bg-[var(--color-surface)] border border-[var(--border-subtle)] rounded-2xl">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-1)]">{task.title}</p>
                  <p className="text-xs text-[var(--color-text-3)]">Estimate: {formatHours(task.time_estimate || 0)}</p>
                </div>
                <button onClick={() => rescheduleToTomorrow(task.id)} className="btn-secondary !text-xs !py-1 px-3">Reschedule</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-[var(--border-subtle)] flex justify-between">
        <button onClick={onBack} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={handleStartDay} className="btn-primary">Start Day</button>
      </div>
    </div>
  );
}
```

#### `src/components/features/EveningReview.tsx` (Step 4: Evening Review)
```typescript
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { Loader2, Moon, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export function EveningReview({ onComplete }: { onComplete: () => void }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { updateUserSetting } = useAppStore();
  const [reflection, setReflection] = useState('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['evening-tasks-ritual'],
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA');
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('deadline', today);
      if (error) throw error;
      return data || [];
    }
  });

  const completedTasks = tasks.filter((t: any) => t.status === 'done');
  const pendingTasks = tasks.filter((t: any) => t.status === 'active');

  const rescheduleToTomorrow = async (id: string) => {
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');
    await supabase.from('items').update({ deadline: tomorrow }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['evening-tasks-ritual'] });
    toast.success('Moved to tomorrow');
  };

  const handleShutdown = async () => {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_settings').update({ last_ritual_date: todayStr }).eq('user_id', user.id);
        updateUserSetting('last_ritual_date', todayStr);
      }
      toast.success("Evening shutdown complete! Have a restful evening.");
      onComplete();
    } catch (e: any) {
      toast.error("Failed to shutdown", { description: e.message });
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <Moon className="w-8 h-8 text-indigo-400 mx-auto" />
        <h3 className="text-2xl font-semibold text-[var(--color-text-1)]">Evening Shutdown</h3>
        <p className="text-sm text-[var(--color-text-3)]">Celebrate today's progress and tie up loose ends.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto max-w-xl mx-auto w-full space-y-6">
        {/* Completed Celebration */}
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 text-center">
          <p className="text-lg font-semibold text-green-400">You completed {completedTasks.length} tasks today!</p>
          <p className="text-xs text-[var(--color-text-3)] mt-1">Consistency is key. Well done.</p>
        </div>

        {/* Pending tasks */}
        {pendingTasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[var(--color-text-3)] uppercase tracking-wider">Uncompleted Tasks</h4>
            {pendingTasks.map((task: any) => (
              <div key={task.id} className="flex justify-between items-center p-3 bg-[var(--color-surface)] border border-[var(--border-subtle)] rounded-xl">
                <span className="text-sm font-medium text-[var(--color-text-1)]">{task.title}</span>
                <button onClick={() => rescheduleToTomorrow(task.id)} className="btn-secondary !text-xs !py-1 px-3 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Tomorrow
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Daily reflection */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[var(--color-text-3)] uppercase tracking-wider">Daily Reflection</h4>
          <textarea
            placeholder="Write a brief line about how today went..."
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            className="input w-full min-h-[80px]"
          />
        </div>
      </div>

      <div className="pt-6 border-t border-[var(--border-subtle)] flex justify-end">
        <button onClick={handleShutdown} className="btn-primary">Shut Down</button>
      </div>
    </div>
  );
}
```

### 5. Auto & Manual Triggers

#### Auto Triggers: `src/components/layout/AppInitializer.tsx`
Add a `useEffect` hook:
```typescript
  useEffect(() => {
    if (!userSettings || Object.keys(userSettings).length === 0) return;

    const todayStr = new Date().toLocaleDateString('en-CA');
    const lastRitual = userSettings.last_ritual_date;
    const activeRitual = useAppStore.getState().activeRitual;

    if (lastRitual === todayStr || activeRitual) return;

    const now = new Date();
    const currentHour = now.getHours();

    // Morning Nudge: 4 AM - 12 PM
    if (currentHour >= 4 && currentHour < 12) {
      useAppStore.getState().setActiveRitual('morning');
    }
    // Evening Nudge: past shutdown_time
    else {
      const shutdownStr = userSettings.shutdown_time || '18:00:00';
      const [shHour, shMin] = shutdownStr.split(':').map(Number);
      if (currentHour > shHour || (currentHour === shHour && now.getMinutes() >= shMin)) {
        useAppStore.getState().setActiveRitual('evening');
      }
    }
  }, [userSettings?.last_ritual_date, userSettings?.shutdown_time]);
```

#### Manual Trigger: `src/components/layout/Navigation.tsx` (Sidebar)
Add a button in the bottom section of the sidebar:
```typescript
        {/* Daily Ritual */}
        <div 
          className="relative w-full"
          onMouseEnter={() => setHoveredItem("rituals")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={() => {
              const now = new Date();
              const hour = now.getHours();
              const defaultRitual = hour < 14 ? 'morning' : 'evening';
              useAppStore.getState().setActiveRitual(defaultRitual);
            }}
            className={cn(
              "flex items-center h-[36px] transition-all relative group",
              isSidebarCollapsed ? "w-10 h-10 mx-auto justify-center rounded-full" : "w-full rounded-[var(--radius-sm)] px-3 gap-3",
              "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
            )}
          >
            <div className="flex items-center justify-center shrink-0">
              <Sparkles size={18} strokeWidth={1.5} className="group-hover:text-[var(--text-2)] transition-colors" />
            </div>
            {!isSidebarCollapsed && (
              <span className="text-[13px] font-medium leading-none whitespace-nowrap overflow-hidden text-ellipsis">Daily Ritual</span>
            )}
          </button>
          {isSidebarCollapsed && <NavTooltip label="Daily Ritual" show={hoveredItem === "rituals"} />}
        </div>
```

---

## UI Polish

### Swipe-to-Delete Implementation

#### Inbox: `src/app/(app)/inbox/page.tsx`
Add a Framer Motion reveal layer and wrap each card:
```typescript
const SWIPE_DELETE_THRESHOLD = -80;

// Inside mapping function:
const dragX = useMotionValue(0);
const deleteOpacity = useTransform(dragX, [0, SWIPE_DELETE_THRESHOLD], [0, 1]);
const deleteScale = useTransform(dragX, [0, SWIPE_DELETE_THRESHOLD], [0.7, 1]);

const handleDragEnd = async (_: any, info: any) => {
  if (info.offset.x < SWIPE_DELETE_THRESHOLD) {
    animate(dragX, -300, { duration: 0.25 });
    await dismissInboxItem(item.id);
  } else {
    animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
  }
};
```
Wrap the item in:
```typescript
<motion.div className="relative group">
  <motion.div
    className="absolute inset-0 flex items-center justify-end pr-5 rounded-2xl overflow-hidden"
    style={{
      background: "linear-gradient(90deg, transparent 0%, rgba(248,113,113,0.15) 60%, rgba(239,68,68,0.25) 100%)",
      opacity: deleteOpacity,
    }}
  >
    <motion.div style={{ scale: deleteScale }}>
      <Trash2 className="w-5 h-5 text-red-400" />
    </motion.div>
  </motion.div>
  
  <motion.div
    drag="x"
    dragConstraints={{ left: -120, right: 0 }}
    dragElastic={{ left: 0.15, right: 0 }}
    onDragEnd={handleDragEnd}
    style={{ x: dragX }}
    className="relative bg-[var(--color-background)]"
  >
    {/* Current Inbox Card JSX */}
  </motion.div>
</motion.div>
```

#### People Page: `src/app/(app)/remember/people/page.tsx`
To prevent conflict with `dnd-kit`'s vertical sorting, we must:
1. Make sure only the `GripVertical` icon holds the `{...attributes} {...listeners}`.
2. Apply Framer Motion's `drag="x"` only on the sibling `Link` / inner card wrapper, leaving the outer `Sortable` node ref unmodified.

Inside `SortablePersonRow`:
```typescript
const dragX = useMotionValue(0);
const deleteOpacity = useTransform(dragX, [0, -80], [0, 1]);
const deleteScale = useTransform(dragX, [0, -80], [0.7, 1]);

const handleDragEnd = async (_: any, info: any) => {
  if (info.offset.x < -80) {
    animate(dragX, -300, { duration: 0.25 });
    // Execute delete call:
    await supabase.from("people").delete().eq("id", person.id);
    fetchPeople();
    toast.success(`${person.name} removed from contacts`);
  } else {
    animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
  }
};
```
Structure layout:
```typescript
return (
  <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50 z-50")}>
    <GlassCard className="p-0 hover:scale-[1.005] transition-transform overflow-hidden flex items-stretch relative">
      
      {/* Swipe reveal layer */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-5 rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(248,113,113,0.15) 60%, rgba(239,68,68,0.25) 100%)",
          opacity: deleteOpacity,
        }}
      >
        <motion.div style={{ scale: deleteScale }}>
          <Trash2 className="w-5 h-5 text-red-400" />
        </motion.div>
      </motion.div>

      {/* Grip handle remains fixed on the left */}
      <div {...attributes} {...listeners} className="w-8 flex items-center justify-center bg-[var(--color-surface)] border-r border-[var(--color-border)] cursor-grab active:cursor-grabbing hover:bg-[var(--color-surface)] transition-colors z-10">
        <GripVertical className="w-4 h-4 text-[var(--color-text-3)]" />
      </div>

      {/* Swipeable details portion */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className="flex-1 bg-[var(--color-background)] z-10"
      >
        <Link href={`/remember/people/${person.id}`} className="block p-4">
          {/* Card info */}
        </Link>
      </motion.div>
    </GlassCard>
  </div>
);
```

---

## Verification Method

### 1. Verification Commands
Run the baseline build and test suites to verify that the project is in a clean state:
- `npm run lint` (or `npx eslint`)
- `npm run test` (or `npx vitest run`)

### 2. Manual Verification Checklist
1. **Schema Check:** Inspect the database schema using Supabase Studio or by checking table contents to verify `last_ritual_date`, `shutdown_time`, `daily_capacity_minutes`, and `time_estimate` exist.
2. **Auto Trigger Nudges:** Change the local machine time (e.g. to 9 AM or 8 PM) and open the app. Verify that the planning or shutdown overlay launches automatically.
3. **Manual Trigger:** Click the 'Daily Ritual' button in the sidebar. Verify that it opens the morning ritual if it's currently daytime, or evening ritual if it's nighttime.
4. **Capacity Validation:** In the Morning Commit step, add several tasks until the total estimated duration exceeds `daily_capacity_minutes`. Check that the progress bar turns red and displays a warning prompt.
5. **Swipe Gestures:** Swipe left on an Inbox, Explore, or People list card. Verify that the red background reveal layer renders smoothly and that pulling past the threshold deletes/archives the card with an option to undo.
6. **Autosize Textareas:** Enter multiline text into notes/tasks textareas. Verify that they grow/shrink dynamically without scrollbars.

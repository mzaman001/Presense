# PHASE 2: CORE UX HARDENING - EXPLORER ANALYSIS & FIX PROPOSAL

This report outlines the findings and proposed code changes for Phase 2 (Core UX Hardening) of Presense. It is written as a read-only investigation report to be consumed by implementer agents.

---

## 1. NORMALIZE UTF-8 CHARACTERS

We scanned the codebase for files containing garbled ANSI characters (arising from incorrect file encoding or copying text saved in Windows-1252/ANSI format). 

Below is the complete list of files, the exact line numbers, the garbled strings, and their correct UTF-8 replacements.

### Character Mapping Table
| Garbled ANSI | UTF-8 Target | Description |
|---|---|---|
| `â†’` | `→` | Right Arrow |
| `Â·` | `·` | Middle Dot |
| `â–¾` | `▼` | Downward Triangle (Dropdown Chevron) |
| `â†»` | `⇆` | Recurrence Exchange / Swap |
| `Ã—` | `×` | Close / Cancel Cross |
| `â†‘` | `↑` | Up Arrow |
| `â†“` | `↓` | Down Arrow |
| `âš ï¸` | `⚠️` | Warning Emoji |
| `â€”` | `—` | Em Dash |

### Affected Files and Exact Replacements

#### 1. `src/components/features/CaptureModal.tsx`
* **Line 273 & 280 & 298 & 311:**
  * *Before:* `<span className="text-[var(--color-text-3)]">Â·</span>`
  * *After:* `<span className="text-[var(--color-text-3)]">·</span>`
* **Line 284:**
  * *Before:* `{item.deadline ? formatCaptureDeadline(item.deadline) : "No deadline"} â–¾`
  * *After:* `{item.deadline ? formatCaptureDeadline(item.deadline) : "No deadline"} ▼`
* **Line 296 & 309:**
  * *Before:* `destination === "Remember â†’ People"` and `destination === "Remember â†’ Locations"`
  * *After:* `destination === "Remember → People"` and `destination === "Remember → Locations"`
* **Line 340:**
  * *Before:* `Smart routing via keyword detection â€” 100% free, no AI API`
  * *After:* `Smart routing via keyword detection — 100% free, no AI API`

#### 2. `src/components/features/PomodoroTimer.tsx`
* **Line 191 & 238:**
  * *Before:* `// Restore from localStorage on mount â€” intentional sync initialization`
  * *After:* `// Restore from localStorage on mount — intentional sync initialization`
* **Line 214:**
  * *Before:* `// Phase change â†’ reset timer â€” intentional sync initialization`
  * *After:* `// Phase change → reset timer — intentional sync initialization`

#### 3. `src/components/features/SearchModal.tsx`
* **Line 185:**
  * *Before:* `kbd className="...">â†‘</kbd><kbd className="...">â†“</kbd>`
  * *After:* `kbd className="...">↑</kbd><kbd className="...">↓</kbd>`

#### 4. `src/components/features/SettingsModal.tsx`
* **Line 388:**
  * *Before:* `// Sign out â€” user data deleted, account auth record requires server-side cleanup`
  * *After:* `// Sign out — user data deleted, account auth record requires server-side cleanup`
* **Line 841:**
  * *Before:* `toast.success('Connected â€” model: ${modelName}');`
  * *After:* `toast.success('Connected — model: ${modelName}');`

#### 5. `src/components/features/TaskAddPanel.tsx`
* **Line 218:**
  * *Before:* `// e.g. "tomorrow" + "at 9pm" â†’ "tomorrow at 9pm" â†’ single correct result`
  * *After:* `// e.g. "tomorrow" + "at 9pm" → "tomorrow at 9pm" → single correct result`

#### 6. `src/components/features/TaskCard.tsx`
* **Line 216:**
  * *Before:* `â†’ {task.first_step}`
  * *After:* `→ {task.first_step}`
* **Line 222:**
  * *Before:* `â†» {formatRRule(task.recurrence)}`
  * *After:* `⇆ {formatRRule(task.recurrence)}`
* **Line 291:**
  * *Before:* `Ã—`
  * *After:* `×`

#### 7. `src/components/layout/OnboardingBackground.tsx`
* **Lines 48, 64, 82, 108, 119, 148, 165:**
  * *Before:* Comments/text containing `â€”`
  * *After:* Comments/text containing `—`

#### 8. `src/components/ui/AppErrorFallback.tsx`
* **Line 22:**
  * *Before:* `<div className="mb-4 text-4xl">âš ï¸ </div>`
  * *After:* `<div className="mb-4 text-4xl">⚠️</div>`

#### 9. `src/components/ui/ConfirmModal.tsx`
* **Line 30:**
  * *Before:* `// Reset state when modal opens â€” intentional sync initialization`
  * *After:* `// Reset state when modal opens — intentional sync initialization`

#### 10. `src/components/ui/Dropdown.tsx`
* **Line 137:**
  * *Before:* `{isPlaceholder ? placeholder : selectedOption.label} â–¾`
  * *After:* `{isPlaceholder ? placeholder : selectedOption.label} ▼`

#### 11. `src/components/ui/LoadingSpinner.tsx`
* **Line 104:**
  * *Before:* `* Inline button spinner â€” replaces icon inside buttons during async ops.`
  * *After:* `* Inline button spinner — replaces icon inside buttons during async ops.`

---

## 2. REMOVE `e.stopPropagation()` FROM DROPDOWNS

Using `e.stopPropagation()` breaks normal event propagation, which interferes with modern layout features (like global analytics, accessibility layers, key-handling focus frameworks, and click-outside portals).

Instead, we refactor these dropdowns to use **React refs** to detect clicks outside the dropdown container. When a click occurs, if the ref container does not contain the click target, we safely close the dropdown. Clicks are allowed to bubble normally.

### Refactoring Specifications

#### 1. `src/components/features/ExploreDrawer.tsx`
Add refs for the type dropdown and thread dropdown, and rewrite the outside click listener to check them.

```tsx
// 1. Add these imports at the top
import React, { useState, useEffect, useRef } from "react";

// 2. Inside the ExploreDrawer component body:
const typeDropdownRef = useRef<HTMLDivElement>(null);
const threadDropdownRef = useRef<HTMLDivElement>(null);

// 3. Replace the useEffect for document click (lines 79-83):
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
      setIsTypeDropdownOpen(false);
    }
    if (threadDropdownRef.current && !threadDropdownRef.current.contains(target)) {
      setIsThreadDropdownOpen(false);
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

// 4. Update the Type Dropdown container and button:
// Line 236: Add ref to wrapper div and remove e.stopPropagation() from button onClick
<div className="relative" ref={typeDropdownRef}>
  <button 
    type="button"
    onClick={() => { setIsTypeDropdownOpen(!isTypeDropdownOpen); setIsThreadDropdownOpen(false); }}
    className="w-full flex items-center justify-between bg-[var(--surface-card)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-1)] hover:border-[var(--accent)] transition-colors"
  >
    <span className="capitalize">{isCustomType ? (customTypeInput || "Custom") : type}</span>
    <ChevronDown className="w-4 h-4 text-[var(--color-text-3)]" />
  </button>
  {/* Dropdown panel */}
  ...
</div>

// 5. Update the Thread Dropdown container and button:
// Line 332: Add ref to wrapper div and remove e.stopPropagation() from button onClick
<div className="relative" ref={threadDropdownRef}>
  <button 
    type="button"
    onClick={() => { setIsThreadDropdownOpen(!isThreadDropdownOpen); setIsTypeDropdownOpen(false); }}
    className="w-full flex items-center justify-between bg-[var(--surface-card)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-1)] hover:border-[var(--accent)] transition-colors"
  >
    <span className="truncate pr-4">
      {linkedThreadId ? threads.find(t => t.id === linkedThreadId)?.title || "Unknown Thread" : "-- No Thread Linked --"}
    </span>
    <ChevronDown className="w-4 h-4 text-[var(--color-text-3)] shrink-0" />
  </button>
  {/* Dropdown panel */}
  ...
</div>
```

#### 2. `src/app/(app)/inbox/page.tsx`
Add a ref that dynamically tracks the active routing dropdown container. When a click falls outside it, close it. Clicks bubble normally.

```tsx
// 1. Add useRef to imports
import React, { useState, useMemo, useEffect, useRef } from "react";

// 2. Inside the InboxPage component body:
const activeDropdownRef = useRef<HTMLDivElement>(null);

// 3. Add outside click detection:
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      activeRouteItem &&
      activeDropdownRef.current &&
      !activeDropdownRef.current.contains(event.target as Node)
    ) {
      setActiveRouteItem(null);
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, [activeRouteItem]);

// 4. Update the Route dropdown wrapper (line 198):
// Assign the ref if this item is currently active, and remove e.stopPropagation() from the toggle button and the options panel.
<div 
  className="relative flex-1 md:flex-none" 
  ref={activeRouteItem === item.id ? activeDropdownRef : null}
>
  <button 
    onClick={() => { setActiveRouteItem(activeRouteItem === item.id ? null : item.id); }}
    className="btn-secondary w-full"
  >
    <FolderInput className="w-3.5 h-3.5" />
    Route it
  </button>
  {activeRouteItem === item.id && (
    // Note: Removed onClick={e => e.stopPropagation()} from the panel div
    <div className="dropdown-panel absolute top-full mt-2 right-0 w-48 p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
      <button onClick={() => routeInboxItem(item.id, 'do')} className="...">...</button>
      ...
    </div>
  )}
</div>
```

#### 3. `src/components/ui/Dropdown.tsx`
In `Dropdown.tsx`, a click-outside ref and handler `containerRef` are already implemented, which checks whether clicks are inside the container before closing. Thus, `e.stopPropagation()` is redundant and can be safely removed.

```tsx
// 1. Remove e.stopPropagation() from the Chip toggle button onClick (line 126):
// Before:
<button
  onClick={(e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  }}
// After:
<button
  onClick={() => {
    setIsOpen(!isOpen);
  }}

// 2. Remove e.stopPropagation() from the option buttons onClick (line 161):
// Before:
<button
  key={optValue}
  onClick={(e) => {
    e.stopPropagation();
    onChange(optValue);
    setIsOpen(false);
  }}
// After:
<button
  key={optValue}
  onClick={() => {
    onChange(optValue);
    setIsOpen(false);
  }}
```

---

## 3. FIX REACT.MEMO COMPARATOR IN `TaskCard.tsx`

`JSON.stringify` on objects containing complex nested structures is extremely slow and causes frame drops during rapid state transitions. We replace it with:
1. A shallow comparison of primitive fields (`id`, `title`, `status`, `category`, `priority`, `deadline`, `first_step`, `recurrence`, `time_spent_minutes`, `snoozed_until`).
2. A shallow comparison of the array fields (`linked_people_ids` and `subtasks`) to ensure correct rendering without full JSON stringification.

### Proposed Code for React.memo Comparator

Replace lines 314-318 in `src/components/features/TaskCard.tsx` with:

```typescript
}, (prevProps, nextProps) => {
  // 1. Check simple properties passed directly to the card
  if (prevProps.completing !== nextProps.completing) return false;

  // 2. Shallow check peopleMap if references changed
  if (prevProps.peopleMap !== nextProps.peopleMap) {
    if (!prevProps.peopleMap || !nextProps.peopleMap) return false;
    const prevKeys = Object.keys(prevProps.peopleMap);
    const nextKeys = Object.keys(nextProps.peopleMap);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of prevKeys) {
      const p = prevProps.peopleMap[key];
      const n = nextProps.peopleMap[key];
      if (!p || !n || p.name !== n.name || p.initials !== n.initials || p.color !== n.color) {
        return false;
      }
    }
  }

  // 3. Shallow check task fields
  const prevTask = prevProps.task;
  const nextTask = nextProps.task;

  if (!prevTask || !nextTask) return prevTask === nextTask;

  // Primitive comparisons
  if (
    prevTask.id !== nextTask.id ||
    prevTask.title !== nextTask.title ||
    prevTask.status !== nextTask.status ||
    prevTask.category !== nextTask.category ||
    prevTask.priority !== nextTask.priority ||
    prevTask.deadline !== nextTask.deadline ||
    prevTask.first_step !== nextTask.first_step ||
    prevTask.recurrence !== nextTask.recurrence ||
    prevTask.time_spent_minutes !== nextTask.time_spent_minutes ||
    prevTask.snoozed_until !== nextTask.snoozed_until
  ) {
    return false;
  }

  // Reference/Shallow-array comparison of linked_people_ids
  const prevPeople = prevTask.linked_people_ids;
  const nextPeople = nextTask.linked_people_ids;
  if (prevPeople !== nextPeople) {
    if (!prevPeople || !nextPeople) return false;
    if (prevPeople.length !== nextPeople.length) return false;
    for (let i = 0; i < prevPeople.length; i++) {
      if (prevPeople[i] !== nextPeople[i]) return false;
    }
  }

  // Reference/Shallow-array comparison of subtasks
  const prevSub = prevTask.subtasks;
  const nextSub = nextTask.subtasks;
  if (prevSub !== nextSub) {
    if (!prevSub || !nextSub) return false;
    if (prevSub.length !== nextSub.length) return false;
    for (let i = 0; i < prevSub.length; i++) {
      if (
        prevSub[i].completed !== nextSub[i].completed ||
        prevSub[i].text !== nextSub[i].text
      ) {
        return false;
      }
    }
  }

  return true;
});
```

---

## 4. IMPLEMENT OPTIMISTIC UI UPDATES WITH ROLLBACKS

Optimistic UI updates give the user immediate feedback while the network mutations run in the background. If a mutation fails, we must restore the queries `["tasks"]` and `["dashboard"]` to their previous states.

### Implementation Guidelines

Below are the detailed code modifications for each of the four requested action areas.

#### 1. Swipe-to-Delete in `src/components/features/TaskCard.tsx`
Add `useQueryClient` import and use optimistic update and rollback logic inside `handleDragEnd`.

```typescript
// 1. Add import:
import { useQueryClient } from "@tanstack/react-query";

// 2. Add queryClient retrieval at the top of the TaskCard component:
const queryClient = useQueryClient();

// 3. Update handleDragEnd (lines 74-104):
const handleDragEnd = async (_: any, info: any) => {
  if (info.offset.x < SWIPE_DELETE_THRESHOLD) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([10]);
    }
    
    // Animate out card locally
    animate(dragX, -300, { duration: 0.25 });
    setDeleted(true);
    
    // Save current caches for possible rollback
    const previousTasks = queryClient.getQueryData<any[]>(["tasks"]);
    const previousDashboard = queryClient.getQueryData<any>(["dashboard"]);

    // Optimistically update ["tasks"]
    queryClient.setQueryData<any[]>(["tasks"], old => old?.filter(t => t.id !== task.id) ?? []);

    // Optimistically update ["dashboard"]
    queryClient.setQueryData<any>(["dashboard"], old => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks?.filter((t: any) => t.id !== task.id) ?? []
      };
    });

    try {
      const { error } = await supabase.from("items").update({ status: "archived" }).eq("id", task.id);
      if (error) throw error;

      markMutation();
      fetchTasks();
      
      toast.success("Task archived", {
        action: {
          label: "Undo",
          onClick: async () => {
            const currentTasks = queryClient.getQueryData<any[]>(["tasks"]);
            const currentDashboard = queryClient.getQueryData<any>(["dashboard"]);

            // Optimistic restore
            queryClient.setQueryData<any[]>(["tasks"], old => [...(old ?? []), task]);
            queryClient.setQueryData<any>(["dashboard"], old => {
              if (!old) return old;
              return {
                ...old,
                tasks: [...(old.tasks ?? []), task]
              };
            });

            try {
              const { error: undoError } = await supabase.from("items").update({ status: "active" }).eq("id", task.id);
              if (undoError) throw undoError;
              fetchTasks();
            } catch {
              // Rollback undo
              queryClient.setQueryData(["tasks"], currentTasks);
              queryClient.setQueryData(["dashboard"], currentDashboard);
              toast.error("Failed to restore task");
            }
          }
        }
      });
    } catch (error) {
      // Rollback on failure
      queryClient.setQueryData(["tasks"], previousTasks);
      queryClient.setQueryData(["dashboard"], previousDashboard);
      
      animate(dragX, 0, { duration: 0.3 });
      setDeleted(false);
      toast.error("Failed to delete task");
    }
  } else {
    animate(dragX, 0, { type: "spring", stiffness: 400, damping: 30 });
  }
};
```

#### 2. Delete Button in `src/components/features/TaskAddPanel.tsx` (`confirmDelete`)
Add `useQueryClient` import and use optimistic update and rollback logic inside `confirmDelete`.

```typescript
// 1. Add import:
import { useQueryClient } from "@tanstack/react-query";

// 2. Add queryClient retrieval at the top of the TaskAddPanel component:
const queryClient = useQueryClient();

// 3. Update confirmDelete (lines 103-119):
const confirmDelete = async () => {
  if (!taskToEdit) return;

  // Save current caches for possible rollback
  const previousTasks = queryClient.getQueryData<any[]>(["tasks"]);
  const previousDashboard = queryClient.getQueryData<any>(["dashboard"]);

  // Optimistically remove from ["tasks"]
  queryClient.setQueryData<any[]>(["tasks"], old => old?.filter(t => t.id !== taskToEdit.id) ?? []);

  // Optimistically remove from ["dashboard"]
  queryClient.setQueryData<any>(["dashboard"], old => {
    if (!old) return old;
    return {
      ...old,
      tasks: old.tasks?.filter((t: any) => t.id !== taskToEdit.id) ?? []
    };
  });

  try {
    useAppStore.getState().markMutation();
    const supabase = createClient();
    const { error } = await supabase.from("items").delete().eq("id", taskToEdit.id);
    if (error) throw error;
    
    toast.success("Task deleted");
    if (onTaskAdded) onTaskAdded();
    onClose();
  } catch (err: unknown) {
    // Rollback on failure
    queryClient.setQueryData(["tasks"], previousTasks);
    queryClient.setQueryData(["dashboard"], previousDashboard);

    const message = err instanceof Error ? err.message : "Failed to delete task";
    toast.error("Failed to delete task", { description: message });
  } finally {
    setDeleteTaskConfirm(false);
  }
};
```

#### 3. Clock Cancel (Un-snooze) Button in `src/components/features/TaskCard.tsx`
Update the cancel button in the snoozed section of `TaskCard.tsx` to handle optimistic badge clearing and rollback on DB errors.

```typescript
// Update the Clock cancel button onClick handler (lines 281-293):
<button
  onClick={async (e) => {
    e.stopPropagation();
    
    const previousTasks = queryClient.getQueryData<any[]>(["tasks"]);
    const previousDashboard = queryClient.getQueryData<any>(["dashboard"]);

    // Optimistically set task.snoozed_until = null in ["tasks"]
    queryClient.setQueryData<any[]>(["tasks"], old => 
      old?.map(t => t.id === task.id ? { ...t, snoozed_until: null } : t) ?? []
    );

    // Optimistically set task.snoozed_until = null in ["dashboard"]
    queryClient.setQueryData<any>(["dashboard"], old => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks?.map((t: any) => t.id === task.id ? { ...t, snoozed_until: null } : t) ?? []
      };
    });

    try {
      markMutation();
      const { error } = await supabase.from('items').update({ snoozed_until: null }).eq('id', task.id);
      if (error) throw error;
      fetchTasks();
    } catch {
      // Rollback on failure
      queryClient.setQueryData(["tasks"], previousTasks);
      queryClient.setQueryData(["dashboard"], previousDashboard);
      toast.error("Failed to cancel snooze");
    }
  }}
  className="ml-1"
  style={{ color: "var(--text-3)" }}
>
  ×
</button>
```

#### 4. Snooze Button on Home Focus Hero in `src/app/(app)/page.tsx`
Update the snooze button onClick handler to store rollback variables, update both `["dashboard"]` and `["tasks"]` caches, catch error rollbacks, and handle optimistic undos correctly.

```typescript
// Update the snooze button onClick handler (lines 304-333):
<button 
  onClick={async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const snoozedTask = primaryTask;
    
    // Save current states for rollback
    const previousDashboard = queryClient.getQueryData(['dashboard']);
    const previousTasks = queryClient.getQueryData(['tasks']);
    
    // Optimistic UI updates
    queryClient.setQueryData(['dashboard'], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks.filter((t: any) => t.id !== snoozedTask.id)
      };
    });
    queryClient.setQueryData(['tasks'], (old: any[] | undefined) => 
      old?.filter(t => t.id !== snoozedTask.id) ?? []
    );
    
    try {
      useAppStore.getState().markMutation();
      const { error } = await supabase.from("items").update({ snoozed_until: tomorrow.toISOString() }).eq("id", snoozedTask.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      toast.success("Snoozed until tomorrow", {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: async () => {
            const currentDashboard = queryClient.getQueryData(['dashboard']);
            const currentTasks = queryClient.getQueryData(['tasks']);
            
            // Optimistic restore (put task back)
            queryClient.setQueryData(['dashboard'], (old: any) => {
              if (!old) return old;
              return {
                ...old,
                tasks: [...old.tasks, { ...snoozedTask, snoozed_until: null }]
              };
            });
            queryClient.setQueryData(['tasks'], (old: any[] | undefined) => 
              old ? [...old, { ...snoozedTask, snoozed_until: null }] : []
            );
            
            try {
              useAppStore.getState().markMutation();
              const { error: undoError } = await supabase.from("items").update({ snoozed_until: null }).eq("id", snoozedTask.id);
              if (undoError) throw undoError;
              
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              toast.success("Snooze reversed");
            } catch {
              // Rollback undo
              queryClient.setQueryData(['dashboard'], currentDashboard);
              queryClient.setQueryData(['tasks'], currentTasks);
              toast.error("Failed to undo snooze");
            }
          }
        }
      });
    } catch (error) {
      // Rollback snooze
      queryClient.setQueryData(['dashboard'], previousDashboard);
      queryClient.setQueryData(['tasks'], previousTasks);
      toast.error("Failed to snooze task");
    }
  }}
  className="mt-4 text-xs text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors underline decoration-dashed underline-offset-4"
>
  Snooze until tomorrow
</button>
```

# Think Space Analysis: Entry Rendering, Mentions, Cross-Linking, and Transition Polish

This document provides a read-only investigation and design analysis for Phase 5 of the Presense project, specifically focusing on the Think Space page (`src/app/(app)/think/[id]/page.tsx`), the mentions popover UI, database structure, and preserving performance optimizations.

---

## 1. Thread Entry Rendering & Thought Creation

### Entry Rendering
In `src/app/(app)/think/[id]/page.tsx` (lines 290-320), the thread entries are stored as a local state array:
- State definition: `thread.entries` (where each entry has shape `{ text: string; created_at: string; starred?: boolean }`).
- Renders elements inside a `<div className="space-y-6">` with Framer Motion `<AnimatePresence mode="popLayout">` wrapping the cards.
- Each entry maps to a `<motion.div>` using a unique key compound of `entry.created_at` and the map index:
  ```tsx
  {(thread.entries || []).map((entry, i) => (
    <motion.div
      key={`${entry.created_at}-${i}`}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <GlassCard className="p-5 border-l-2 border-l-transparent hover:border-l-[#2DD4BF] transition-all group relative">
        <p className="text-[15px] text-[var(--color-text-1)] leading-relaxed whitespace-pre-wrap pr-8">{entry.text}</p>
        <div className="flex items-center justify-between mt-3">
          <p className="text-[11px] text-[var(--color-text-3)]">
            {new Date(entry.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        <button 
          onClick={() => setDeleteEntryIndex(i)}
          className="absolute top-4 right-4 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-[rgba(248,113,113,0.1)] text-[var(--color-text-3)] hover:text-[#F87171]"
          title="Delete entry"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </GlassCard>
    </motion.div>
  ))}
  ```

### Adding New Thoughts
New thoughts are captured in a form containing a `<TextareaAutosize />` component (lines 325-338) that binds to state `newEntry`:
- Form submission triggers `handleAddEntry` (lines 135-161):
  ```typescript
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.trim() || !thread) return;
    setSaving(true);
    
    try {
      const entry = { text: newEntry.trim(), created_at: new Date().toISOString() };
      const updatedEntries = [...(thread.entries || []), entry];
      
      const { error } = await supabase.from("threads").update({ 
        entries: updatedEntries,
        last_updated: new Date().toISOString(),
        stale_prompt: null // Clear stale prompt if they revisit
      }).eq("id", thread.id);

      if (error) throw error;
      
      setThread({ ...thread, entries: updatedEntries, stale_prompt: null });
      setNewEntry("");
      toast.success("Added to thread");
    } catch (error: any) {
      logger.error("Think error:", error);
      toast.error("Failed to save thought", { description: error.message });
    } finally {
      setSaving(false);
    }
  };
  ```

---

## 2. Implementing MentionPopover inside the Think Editor

### Reusable MentionPopover Component Design
We recommend building a reusable component in `src/components/ui/MentionPopover.tsx`. Since we are in `CODE_ONLY` mode, we should place the file in the designated components directory.

```tsx
// src/components/ui/MentionPopover.tsx
import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface MentionPerson {
  id: string;
  name: string;
  initials?: string;
  color?: string;
}

interface MentionPopoverProps {
  isOpen: boolean;
  searchQuery: string;
  people: MentionPerson[];
  focusedIndex: number;
  onSelect: (person: MentionPerson) => void;
  className?: string;
}

export function MentionPopover({
  isOpen,
  searchQuery,
  people,
  focusedIndex,
  onSelect,
  className,
}: MentionPopoverProps) {
  const filtered = useMemo(() => {
    return people.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [people, searchQuery]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute bottom-full left-0 mb-2 w-full max-h-48 overflow-y-auto bg-[#111111] border border-[var(--color-border)] rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 [color-scheme:dark]",
        className
      )}
    >
      <div className="px-2 py-1 text-[10px] font-semibold text-[var(--color-text-3)] uppercase tracking-wider">
        Mention Person
      </div>
      {filtered.map((person, idx) => (
        <button
          key={person.id}
          type="button"
          onClick={() => onSelect(person)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors w-full",
            idx === focusedIndex
              ? "bg-[rgba(45,212,191,0.15)] text-[#2DD4BF]"
              : "hover:bg-[rgba(255,255,255,0.05)] text-[var(--color-text-1)]"
          )}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-[var(--color-background)]"
            style={{ backgroundColor: person.color || "#E5B41E" }}
          >
            {person.initials || person.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-medium text-[var(--color-text-1)]">{person.name}</span>
        </button>
      ))}
    </div>
  );
}
```

### Editor Integration Logic
To integrate this inside the Think editor, the following steps are required:
1. **Define Refs**: 
   A `useRef<HTMLTextAreaElement>(null)` should be linked to the `<TextareaAutosize>` component so we can get/set selection bounds and re-focus after selection.
2. **Fetch People list on Mount**:
   Fetch `id, name, initials, color` from the `people` table.
3. **Trigger Detection**:
   On textarea `onChange`, compute the caret position. Find the last `@` symbol before the cursor. If it is preceded by a space (or is at index 0) and is not followed by any spaces, trigger the popover state:
   - `mentionOpen = true`
   - `mentionSearch = textBetweenAtAndCaret`
   - `mentionTriggerIndex = indexOfAt`
4. **Keyboard Interception**:
   Inside `onKeyDown` of the textarea, if `mentionOpen` is active, hijack key events:
   - `ArrowDown` & `ArrowUp`: Increment/decrement list active focused index.
   - `Enter` & `Tab`: Call select handler.
   - `Escape`: Close popover.
5. **Selection Replacements**:
   Replace `@nameQuery` with the markdown syntax `@[Person Name](UUID) ` and restore cursor focus right after the closing parenthesis.

---

## 3. Parsing, Extracting, and Database Persisting for `linked_people`

### Syntax Contract
- Structured format: `@[Person Name](UUID)` (e.g. `@[Adebayo Wahala](9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d)`)
- This format allows the text content to remain human-readable (with markdown rendering or simple stripping) while providing a robust identifier (UUID) for database linkage.

### Extraction Implementation
We can use a regular expression to extract the UUIDs:
```typescript
export function extractLinkedPeople(text: string): string[] {
  const regex = /@\[[^\]]+\]\(([a-f0-9-]{36})\)/g;
  const matches = [...text.matchAll(regex)];
  return Array.from(new Set(matches.map(m => m[1])));
}
```

### Supabase Schema Migration
A new migration `supabase/migrations/011_add_linked_people.sql` must add the `linked_people` UUID array column to both `items` and `threads` tables:
```sql
-- supabase/migrations/011_add_linked_people.sql
ALTER TABLE items ADD COLUMN IF NOT EXISTS linked_people uuid[] DEFAULT '{}';
ALTER TABLE threads ADD COLUMN IF NOT EXISTS linked_people uuid[] DEFAULT '{}';
```

### Persisting to Supabase

#### In Think Space (`src/app/(app)/think/[id]/page.tsx`):
To prevent stale relationships when entries are modified or deleted, we should re-extract the complete set of linked people from **all remaining entries** in the thread whenever a thought is added or deleted:

1. **Adding an Entry**:
   ```typescript
   const entry = { text: newEntry.trim(), created_at: new Date().toISOString() };
   const updatedEntries = [...(thread.entries || []), entry];
   
   // Extract all mentions from all entries
   const allMentions = new Set<string>();
   updatedEntries.forEach(e => {
     const matches = [...e.text.matchAll(/@\[[^\]]+\]\(([a-f0-9-]{36})\)/g)];
     matches.forEach(m => allMentions.add(m[1]));
   });
   const updatedLinkedPeople = Array.from(allMentions);

   const { error } = await supabase.from("threads").update({ 
     entries: updatedEntries,
     last_updated: new Date().toISOString(),
     stale_prompt: null,
     linked_people: updatedLinkedPeople
   }).eq("id", thread.id);
   ```

2. **Deleting an Entry**:
   ```typescript
   const updatedEntries = thread.entries.filter((_, i) => i !== deleteEntryIndex);
   
   // Re-extract from remaining entries
   const allMentions = new Set<string>();
   updatedEntries.forEach(e => {
     const matches = [...e.text.matchAll(/@\[[^\]]+\]\(([a-f0-9-]{36})\)/g)];
     matches.forEach(m => allMentions.add(m[1]));
   });
   const updatedLinkedPeople = Array.from(allMentions);

   const { error } = await supabase.from("threads").update({ 
     entries: updatedEntries,
     linked_people: updatedLinkedPeople 
   }).eq("id", thread.id);
   ```

#### In Capture Modal (`src/components/features/CaptureModal.tsx`):
When a user captures a task or thought containing a mention, extract the UUID array and insert it on creation:
- **Do / Inbox Space**:
  ```typescript
  const extracted = extractLinkedPeople(item.title);
  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    title: item.title,
    // ... other columns
    linked_people: extracted
  });
  ```
- **Think Space**:
  ```typescript
  const extracted = extractLinkedPeople(item.title);
  const { error } = await supabase.from("threads").insert({
    user_id: user.id,
    title: item.title.slice(0, 60),
    entries: [{ text: item.title, created_at: new Date().toISOString(), starred: false }],
    linked_people: extracted
  });
  ```

---

## 4. Phase 4 Transition/Lag Fix Safeguards

During Phase 3 & 4, transition lag between `/think` list view and `/think/[id]` detail view was optimized by introducing **Zustand-based cache prefetching** and **disabling stagger animation delays**. We must ensure this mechanism is not altered or broken:

1. **Zustand Caching**:
   - In `/think/page.tsx`, when clicking a thread link, `setPrefetchedThread(thread.id, thread)` is triggered on click:
     ```tsx
     <Link href={`/think/${thread.id}`} onClick={() => setPrefetchedThread(thread.id, thread)}>
     ```
   - In `[id]/page.tsx`, the thread component initializes state from the pre-warmed Zustand state to bypass blank screen flashes and full loading states:
     ```typescript
     const prefetchedThreads = useAppStore(s => s.prefetchedThreads);
     const prefetched = prefetchedThreads[id] as Thread | undefined;
     const [thread, setThread] = useState<Thread | null>(prefetched || null);
     const [loading, setLoading] = useState(!prefetched);
     ```
   *Action*: Maintain this exact initialization. When we add the `linked_people` state or column, make sure to add it to the mock models or local interfaces without disturbing the prefetch state hydrator.

2. **Animation Polish**:
   - Stagger delays have been disabled to allow fast entry rendering.
   - Do NOT add `staggerChildren` or long delay parameters inside the entry animations container. Keep the transition duration fast: `transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}`.

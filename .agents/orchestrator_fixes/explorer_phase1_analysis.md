# Phase 1 Analysis: State Reliability Fixes

This report outlines the technical analysis and detailed fix proposals for Phase 1 (State Reliability) issues in the Presense codebase.

---

## 1. Inbox Triage and Space-Routing Logic Refactoring

### Location of Code
- File: `src/app/(app)/inbox/page.tsx`
- Relevant section: `routeInboxItem` function (lines 54-124) and routing dropdown UI (lines 206-221).

### Identified Issues
1. **Hard Deletions on Route**: When routing items from the Inbox to other spaces (Remember/People, Think/Threads, Explore), the codebase deletes the source items table row:
   ```typescript
   await supabase.from('items').delete().eq('id', id);
   ```
   This is destructive because it deletes all associated task metadata (e.g. description, subtasks, recurrence, custom priority, etc.).
2. **Race-Prone Undo Action**: Currently, the "Undo" action queries the target table (e.g. `people` or `explores`) by title and user ID, sorted by `created_at` descending, to find and delete the row:
   ```typescript
   const { data: people } = await supabase.from('people').select('id').eq('user_id', user.id).eq('name', item.title).order('created_at', { ascending: false }).limit(1);
   ```
   If two items have the same title or another row is created concurrently, the wrong row could be deleted on Undo. Also, the inbox item is re-inserted as a new row using a simple insert with only basic fields:
   ```typescript
   await supabase.from('items').insert({ id, user_id: item.user_id, title: item.title, status: 'inbox' });
   ```
   This loses all original task properties.
3. **Missing Locations Route**: The "Locations" space is not present in the routing dropdown in the UI, and there is no database routing logic defined for locations.

---

### Fix Proposal: Soft-Deletions & Targeted Undo

#### Step 1: Soft-Deletions / State Transitions
Instead of `.delete()`, update the item's status to `'deleted'`. The `status` check constraint in `items` table allows `'deleted'`. On Undo, simply update the item's status back to `'inbox'`. This preserves all metadata.

#### Step 2: Exact Target Row Deletion on Undo
Capture the inserted row's `id` from the target table (`people`, `explores`, `threads`, `locations`) immediately upon insertion using `.select('id').single()`. Keep this `id` in a local variable `routedId` scoped to the specific execution of the `routeInboxItem` callback. Use this exact `id` in the Undo operation to delete only the created row.

#### Step 3: Add Locations Routing
1. Import the `MapPin` icon from `lucide-react` in `inbox/page.tsx`.
2. Add a new option to the routing dropdown UI.
3. When routing to Locations, update the inbox item status to `'deleted'` and insert a new row into the `locations` table:
   ```typescript
   {
     user_id: user.id,
     item_name: item.title,
     location_text: item.title
   }
   ```
4. Capture the generated location `id` and delete it from `locations` on Undo.

---

### Detailed Code Changes: `src/app/(app)/inbox/page.tsx`

#### Imports Diff
```typescript
// Before:
import { Inbox, Loader2, FolderInput, CheckCircle2, MessageSquare, Compass, Brain, X } from "lucide-react";

// After:
import { Inbox, Loader2, FolderInput, CheckCircle2, MessageSquare, Compass, Brain, X, MapPin } from "lucide-react";
```

#### `routeInboxItem` Implementation Diff
```typescript
  const routeInboxItem = async (id: string, space: string) => {
    if (!space) return;

    const item = inboxItems.find(i => i.id === id);
    if (!item) return;

    setSlidingOut(id);
    setActiveRouteItem(null);

    setTimeout(async () => {
      // Optimistically remove from cache after animation starts
      queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], old => old?.filter(i => i.id !== id) ?? []);

      try {
        let routedId: string | null = null;

        if (space === 'do') {
          await supabase.from('items').update({ status: 'active' }).eq('id', id);
        } else if (space === 'remember') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
            const { data: inserted, error: insertError } = await supabase.from('people').insert({
              user_id: user.id,
              name: item.title,
              notes: [{ text: item.title, created_at: new Date().toISOString(), tag: "note" }]
            }).select('id').single();
            
            if (insertError) throw insertError;
            if (inserted) {
              routedId = inserted.id;
            }
          }
        } else if (space === 'explore') {
          await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
          const { data: inserted, error: insertError } = await supabase.from('explores').insert({
            user_id: item.user_id,
            title: item.title,
            type: 'other',
            status: 'active'
          }).select('id').single();
          
          if (insertError) throw insertError;
          if (inserted) {
            routedId = inserted.id;
          }
        } else if (space === 'think') {
          await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
          const { data: inserted, error: insertError } = await supabase.from('threads').insert({
            user_id: item.user_id,
            title: item.title,
            status: 'active',
            color_accent: '#2DD4BF'
          }).select('id').single();
          
          if (insertError) throw insertError;
          if (inserted) {
            routedId = inserted.id;
          }
        } else if (space === 'location') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
            const { data: inserted, error: insertError } = await supabase.from('locations').insert({
              user_id: user.id,
              item_name: item.title,
              location_text: item.title
            }).select('id').single();
            
            if (insertError) throw insertError;
            if (inserted) {
              routedId = inserted.id;
            }
          }
        }

        toast.success(`Routed to ${space}`, {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                // Reverse the operation
                if (space === 'do') {
                  await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
                } else if (space === 'remember') {
                  if (routedId) {
                    await supabase.from('people').delete().eq('id', routedId);
                  }
                  await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
                } else if (space === 'explore') {
                  if (routedId) {
                    await supabase.from('explores').delete().eq('id', routedId);
                  }
                  await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
                } else if (space === 'think') {
                  if (routedId) {
                    await supabase.from('threads').delete().eq('id', routedId);
                  }
                  await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
                } else if (space === 'location') {
                  if (routedId) {
                    await supabase.from('locations').delete().eq('id', routedId);
                  }
                  await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
                }
                // Restore to cache
                queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], old => [item, ...(old ?? [])]);
                toast.success("Restored to inbox");
              } catch {
                toast.error("Failed to undo");
                refetch();
              }
            }
          }
        });
      } catch (e) {
        // Restore to cache on error
        queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], old => [item, ...(old ?? [])]);
        toast.error('Failed to route item');
      } finally {
        setSlidingOut(null);
      }
    }, 280);
  };
```

#### Dropdown UI Diff
```typescript
                    {activeRouteItem === item.id && (
                      <div className="dropdown-panel absolute top-full mt-2 right-0 w-48 p-1 z-50 animate-in fade-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
                        <button onClick={() => routeInboxItem(item.id, 'do')} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-do)]" /> Do (Task)
                        </button>
                        <button onClick={() => routeInboxItem(item.id, 'think')} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-[var(--color-think)]" /> Think (Thread)
                        </button>
                        <button onClick={() => routeInboxItem(item.id, 'explore')} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <Compass className="w-4 h-4 text-[var(--color-explore)]" /> Explore (Saved)
                        </button>
                        <button onClick={() => routeInboxItem(item.id, 'remember')} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <Brain className="w-4 h-4 text-[var(--color-people)]" /> Remember (Person)
                        </button>
                        <button onClick={() => routeInboxItem(item.id, 'location')} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[var(--color-people)]" /> Locations
                        </button>
                      </div>
                    )}
```

---

## 2. Consolidating Category Save Operations

### Location of Code
- File: `src/components/features/SettingsModal.tsx`
- Relevant section: `handleRename` inside `CategoryItem` (lines 75-103).

### Identified Issues
1. **Orphan Records due to Debounce vs. Immediate Updates**:
   When renaming a category, the modal:
   - Updates local state using `updateSetting`. This queues a debounced update (1000ms delay) to the `user_settings` table.
   - Updates the target table (`items` or `people`) **immediately** using non-debounced API calls.
   If the user closes the modal or refreshes the page within 1 second, the `user_settings` categories array update is lost, but the `items`/`people` update has succeeded. The items/people now have the new category, but `user_settings` still has the old category, resulting in orphans.
2. **Missing `people_categories` Column in database**:
   The frontend references `people_categories` on `user_settings`. However, the baseline SQL migrations never define a `people_categories` column on the `user_settings` table. (Only `do_categories` and `explore_custom_types` are present in `001_baseline.sql`). This will cause database update operations to fail when modifying relationship categories.

---

### Fix Proposal: Atomic Transaction via Postgres SQL RPC

#### Step 1: Add Missing `people_categories` Column
A new migration (e.g. `008_add_people_categories.sql`) should be added to ensure the database has the `people_categories` column:
```sql
ALTER TABLE public.user_settings 
  ADD COLUMN IF NOT EXISTS people_categories text[] 
  DEFAULT ARRAY['friend', 'family', 'professor', 'colleague', 'teammate', 'other'];
```

#### Step 2: Implement Postgres SQL RPC Function
Propose a Postgres SQL function named `rename_category` that executes both updates inside a single transaction. This ensures that either both succeed or both fail.

#### SQL Definition of `rename_category` RPC
Create a migration file (e.g., `009_rename_category_rpc.sql`) with the following definition:
```sql
CREATE OR REPLACE FUNCTION public.rename_category(
  p_categories_key text,
  p_colors_key text,
  p_old_category text,
  p_new_category text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate categories_key and execute atomic updates
  IF p_categories_key = 'do_categories' THEN
    -- Update settings categories array and rename key in do_category_colors jsonb
    UPDATE public.user_settings
    SET 
      do_categories = array_replace(do_categories, p_old_category, p_new_category),
      do_category_colors = CASE 
        WHEN do_category_colors ? p_old_category THEN 
          (do_category_colors - p_old_category) || jsonb_build_object(p_new_category, do_category_colors->p_old_category)
        ELSE 
          do_category_colors 
      END
    WHERE user_id = v_user_id;

    -- Update tasks/items table
    UPDATE public.items
    SET category = p_new_category
    WHERE user_id = v_user_id 
      AND category ILIKE p_old_category;

  ELSIF p_categories_key = 'people_categories' THEN
    -- Update settings categories array and rename key in relationship_colors jsonb
    UPDATE public.user_settings
    SET 
      people_categories = array_replace(people_categories, p_old_category, p_new_category),
      relationship_colors = CASE 
        WHEN relationship_colors ? p_old_category THEN 
          (relationship_colors - p_old_category) || jsonb_build_object(p_new_category, relationship_colors->p_old_category)
        ELSE 
          relationship_colors 
      END
    WHERE user_id = v_user_id;

    -- Update people table (relationship column)
    UPDATE public.people
    SET relationship = p_new_category
    WHERE user_id = v_user_id 
      AND relationship ILIKE p_old_category;
      
  ELSE
    RAISE EXCEPTION 'Invalid categories key: %', p_categories_key;
  END IF;
END;
$$;
```

#### Step 3: Refactor React UI to Call the RPC
Modify `handleRename` in `src/components/features/SettingsModal.tsx` to:
1. Invoke the RPC via `supabase.rpc('rename_category', { ... })`.
2. Upon success, update the local settings state (`setSettings`) and store settings (`setUserSettings`) synchronously.
3. This ensures local state is in sync with the DB immediately, and the subsequent debounced save (which saves the entire `user_settings` object after 1s) will send the matching updated values, preventing any overwrite or race conditions.

#### Refactored `handleRename` inside `CategoryItem`
```typescript
  const handleRename = async () => {
    const trimmed = editName.trim().toLowerCase();
    if (trimmed && trimmed !== cat && !cats.includes(trimmed)) {
      const newCats = cats.map(c => c === cat ? trimmed : c);
      
      try {
        // 1. Invoke Postgres SQL RPC to atomically rename category across tables
        const { error } = await supabase.rpc('rename_category', {
          p_categories_key: categoriesKey,
          p_colors_key: colorsKey,
          p_old_category: cat,
          p_new_category: trimmed
        });
        
        if (error) throw error;

        // 2. Synchronously update local modal state
        setSettings((prev: SettingsState) => {
          const next = { ...prev };
          next[categoriesKey] = newCats;
          if (colors[cat]) {
            const newColors = { ...colors };
            newColors[trimmed] = newColors[cat];
            delete newColors[cat];
            next[colorsKey] = newColors;
          }
          return next;
        });

        // 3. Synchronously update global AppStore state
        const currentStoreSettings = useAppStore.getState().userSettings;
        const updatedStoreSettings = {
          ...currentStoreSettings,
          [categoriesKey]: newCats,
        };
        if (colors[cat]) {
          const newColors = { ...colors };
          newColors[trimmed] = newColors[cat];
          delete newColors[cat];
          updatedStoreSettings[colorsKey] = newColors;
        }
        useAppStore.getState().setUserSettings(updatedStoreSettings);

        toast.success(`Renamed category to ${trimmed}`);
      } catch (err: any) {
        toast.error("Failed to rename category", { description: err.message });
        setEditName(cat);
      }
    } else {
      setEditName(cat);
    }
  };
```
*Note: Make sure that `setSettings` is passed down or accessible in `CategoryItem`. In the current definition of `CategoryItem`, it receives `updateSetting`. We should change `CategoryItem` parameters to also receive `setSettings` (so it can update the local state object directly) or update `updateSetting` to handle batch updates.*
An alternative is to extend `updateSetting` or modify the parameters of `CategoryItem` to receive `setSettings` directly:
```typescript
function CategoryItem({ cat, initialColor, cats, colors, categoriesKey, colorsKey, updateSetting, setSettings, supabase }: {
  cat: string;
  initialColor: string;
  cats: string[];
  colors: Record<string, string>;
  categoriesKey: string;
  colorsKey: string;
  updateSetting: (key: string, value: unknown) => void;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
  supabase: ReturnType<typeof createClient>;
}) {
  ...
```
This is a straightforward change in the parent `CategoryManager` component render:
```typescript
{cats.map(cat => (
  <CategoryItem 
    key={cat} 
    cat={cat} 
    initialColor={colors[cat]} 
    cats={cats} 
    colors={colors} 
    categoriesKey={categoriesKey} 
    colorsKey={colorsKey} 
    updateSetting={updateSetting} 
    setSettings={setSettings} // Pass down setSettings
    supabase={supabase} 
  />
))}
```
And propagate `setSettings` from `SettingsModal` down to `CategoryManager`.

# Handoff Report - Milestone B1: Exploration

## 1. Observation

We directly observed and verified the implementation of `useRealtime` hook, TanStack Query client configuration, state store (`useAppStore`), and Supabase client initialization in the codebase.

### A. `useRealtime` Implementation
- **File Path**: `src/hooks/useRealtime.ts`
- **Key Lines**:
  - Subscription Initialization (Lines 8-15):
    ```typescript
    export function useRealtime(table: string, onUpdate: () => void) {
      const onUpdateRef = useRef(onUpdate);

      useEffect(() => {
        onUpdateRef.current = onUpdate;
      }, [onUpdate]);

      const supabase = useMemo(() => createClient(), []);
    ```
  - Debounce Logic (Lines 18-21):
    ```typescript
    const debouncedUpdate = useDebouncedCallback(() => {
      logger.info(`[Realtime] Triggering debounced update for ${table}`);
      onUpdateRef.current();
    }, 200);
    ```
  - Lockout/Echo Guard and Subscription Effect (Lines 33-62):
    ```typescript
    useEffect(() => {
      if (!isVisible) return;
      
      // Create a generic subscription for INSERT, UPDATE, DELETE on the specified table
      const channel = supabase
        .channel(`realtime_${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: table },
          (payload) => {
            // Check if we mutated locally within the last 500ms for this specific table.
            // If so, ignore this event as it's likely an echo of our own mutation.
            const lastMutations = useAppStore.getState().lastMutations || {};
            const lastMutationAt = Math.max(lastMutations[table] || 0, lastMutations['_global'] || 0);
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
      };
    }, [table, supabase, debouncedUpdate, isVisible]);
    ```

### B. Usages of `useRealtime`
We queried the project source code recursively to identify usages of the `useRealtime` hook. The exact lines of imports and hook instantiations across all pages and tests are:
1. **`src/app/(app)/do/page.tsx`**:
   - Line 13: `import { useRealtime } from "@/hooks/useRealtime";`
   - Line 191: `useRealtime("items", fetchTasks);`
   - Line 192: `useRealtime("people", fetchPeopleList);`
2. **`src/app/(app)/explore/page.tsx`**:
   - Line 10: `import { useRealtime } from "@/hooks/useRealtime";`
   - Line 168: `useRealtime("explores", fetchItems);`
3. **`src/app/(app)/inbox/page.tsx`**:
   - Line 8: `import { useRealtime } from "@/hooks/useRealtime";`
   - Line 165: `useRealtime("items", refetch);`
4. **`src/app/(app)/remember/locations/page.tsx`**:
   - Line 9: `import { useRealtime } from "@/hooks/useRealtime";`
   - Line 57: `useRealtime("locations", fetchItems);`
5. **`src/app/(app)/remember/people/[id]/page.tsx`**:
   - Line 11: `import { useRealtime } from "@/hooks/useRealtime";`
   - Line 102: `useRealtime("people", fetchPerson);`
   - Line 103: `useRealtime("items", fetchPerson);`
6. **`src/app/(app)/remember/people/page.tsx`**:
   - Line 10: `import { useRealtime } from "@/hooks/useRealtime";`
   - Line 250: `useRealtime("people", fetchPeople);`
7. **`src/app/(app)/think/[id]/page.tsx`**:
   - Line 12: `import { useRealtime } from "@/hooks/useRealtime";`
   - Line 168: `useRealtime("threads", fetchThread);`
   - Line 169: `useRealtime("explores", fetchThread);`
8. **`src/app/(app)/think/page.tsx`**:
   - Line 10: `import { useRealtime } from "@/hooks/useRealtime";`
   - Line 64: `useRealtime("threads", fetchThreads);`
9. **`src/app/(app)/page.tsx` (Dashboard)**:
   - Line 12: `import { useRealtime } from "@/hooks/useRealtime";`
   - Line 232: `useRealtime("items", refreshData);`
   - Line 233: `useRealtime("people", refreshData);`
   - Line 234: `useRealtime("threads", refreshData);`
   - Line 235: `useRealtime("explores", refreshData);`
10. **`src/lib/__tests__/phase4.test.tsx`** (Unit and integration tests for useRealtime)

### C. TanStack Query Client Configuration
- **Provider File Path**: `src/components/layout/QueryProvider.tsx`
- **Key Lines**:
  - Provider Definition (Lines 6-24):
    ```typescript
    export default function QueryProvider({ children }: { children: React.ReactNode }) {
      const [queryClient] = useState(
        () =>
          new QueryClient({
            defaultOptions: {
              queries: {
                staleTime: 1000 * 60 * 5, // 5 minutes
                refetchOnWindowFocus: true,
              },
            },
          })
      );

      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    }
    ```
- **App Layout Integration**:
  - File Path: `src/app/(app)/layout.tsx`
  - Instantiated as (Lines 39-50):
    ```typescript
    <MotionProvider>
      <QueryProvider>
        <AmbientBackground />
        ...
        <AppContentWrapper>
          {children}
        </AppContentWrapper>
        <BottomNav />
      </QueryProvider>
    </MotionProvider>
    ```

### D. `useAppStore` Mutation State and Echo Guard Handler
- **File Path**: `src/store/useAppStore.ts`
- **Key Lines**:
  - Store Interface (Lines 64-65):
    ```typescript
    lastMutations: Record<string, number>;
    markMutation: (table?: string) => void;
    ```
  - Store Implementation (Lines 91-97):
    ```typescript
    lastMutations: {},
    markMutation: (table) => set((state) => {
      const now = Date.now();
      return {
        lastMutations: { ...state.lastMutations, [table || '_global']: now },
      };
    }),
    ```

### E. Supabase Client Initializations
- **Browser-side client initialization**:
  - File Path: `src/lib/supabase.ts`
  - Key Lines (Lines 3-8):
    ```typescript
    export function createClient() {
      return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    ```
- **Server-side client initialization**:
  - File Path: `src/lib/supabase-server.ts`
  - Key Lines (Lines 4-27):
    ```typescript
    export async function createClient() {
      const cookieStore = await cookies();

      return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // setAll called from a Server Component — safe to ignore
              }
            },
          },
        }
      );
    }
    ```

---

## 2. Logic Chain

1. From `src/hooks/useRealtime.ts`, we know that Postgres realtime events for a table `X` trigger the `onUpdate` callback unless there was a local mutation registered for table `X` or `_global` in the last `500ms`.
2. From `src/store/useAppStore.ts`, we see that local mutations register their timestamps using `markMutation("tableName")`.
3. In `src/app/(app)/do/page.tsx` and `src/app/(app)/inbox/page.tsx`, data fetching is managed using TanStack Query via `useQuery` (e.g. key `["tasks"]` in do page and `["inbox-tasks"]` in inbox page).
4. When a Postgres change is broadcasted on the `items` table, the realtime hook triggers `fetchTasks` (refetch) or `refetch` for the inbox, updating the query cache.
5. In other pages like `src/app/(app)/explore/page.tsx`, `src/app/(app)/remember/people/page.tsx`, and `src/app/(app)/think/page.tsx`, data loading does not use TanStack Query; they fetch directly using the supabase client inside a local `fetch...` callback, updating component state.
6. The `useRealtime` hook works seamlessly with both patterns (React Query refetch callbacks and direct Supabase state update callbacks).

---

## 3. Caveats

- We did not verify the Supabase realtime connection live in a browser session, as this is a read-only investigation.
- We assumed standard local development network credentials are set in environment variables (`.env` and `.env.local` exist).
- Tests in `src/lib/__tests__/phase4.test.tsx` mock the supabase database responses and timers to simulate debouncing and lockouts. A local execution of test runner was not performed due to terminal approval timeouts.

---

## 4. Conclusion

The real-time synchronization architecture in the application consists of three main parts:
1. **Supabase Realtime**: Broadcasts postgres changes for specific tables (`items`, `people`, `explores`, `locations`, `threads`).
2. **`useRealtime` Hook with Echo Guard**: Locks out incoming updates for `500ms` following a local mutation of the corresponding table (or a global mutation) to prevent layout shifts or double-queries from self-echoes. It debounces multiple rapid-fire updates to a single call using a `200ms` window.
3. **Data Refresh Integration**: Depending on the page, the refresh callback either triggers a TanStack Query refetch (Dashboard/Do/Inbox) or a standard local component state fetch via supabase client (Explore/Remember/Think).

---

## 5. Verification Method

To verify the integration, run the automated vitest test suite targeting Phase 4 features:
```powershell
npx vitest run src/lib/__tests__/phase4.test.tsx
```
These tests specifically mock the Supabase channel subscription, the `useAppStore` mutations state, mock the timers, and check that:
- Debouncing triggers `onUpdate` exactly once on rapid burst changes.
- Lockout (echo guard) correctly ignores changes within `500ms` on the same table, but allows them on different tables.
- Subscription cleanup is handled on component unmount.

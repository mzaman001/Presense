## 2026-06-29T08:54:36Z
You are a Worker agent. Your working directory is: C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_b2

Implement Milestone B2 (Centralized RealtimeProvider):
1. Create a client component `RealtimeProvider` in `src/components/providers/RealtimeProvider.tsx`.
2. This provider must:
   - Provide a React Context (`RealtimeContext`) exposing a `subscribe` function: `subscribe: (table: string, callback: (payload: any) => void) => () => void`.
   - Maintain a registry of active subscriptions per table (using refs to avoid re-renders) including:
     - `refCount`: number of active listeners for the table.
     - `callbacks`: set of registered callbacks for the table.
     - `channel`: the Supabase realtime channel instance.
   - When a component subscribes to a table:
     - If it's the first subscriber (`refCount === 0`), create the Supabase channel for that table using the client-side Supabase client (`createClient` from `@/lib/supabase`), register the listener for `postgres_changes`, and call `subscribe()`.
     - When updates are received, notify all registered callbacks.
     - If it is a subsequent subscriber, simply return the unsubscribe cleanup function, incrementing `refCount` and adding the callback.
   - When unsubscribing:
     - Decrement the `refCount`.
     - If `refCount` reaches 0, unsubscribe and remove the channel using `supabase.removeChannel`.
   - Do NOT tear down channels or unsubscribe on page visibility changes. Let Supabase manage its own reconnections.
3. Export a custom hook `useRealtimeContext` to consume this context.
4. Wrap the app's components inside `src/app/(app)/layout.tsx` with `<RealtimeProvider>` as a child of `<QueryProvider>`.
5. Run the build or typechecks (`npm run build` or `npx tsc --noEmit` if configured in package.json) to ensure everything compiles correctly.
6. Verify layout matches. Do not write dummy implementations.
7. Write your handoff report to `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_b2\handoff.md`.

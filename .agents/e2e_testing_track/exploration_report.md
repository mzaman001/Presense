# Supabase Realtime Subscription & Playwright E2E Test Exploration Report

This report presents findings from analyzing the Presense project layout, Supabase realtime subscriptions, local running configurations, and design recommendations for Playwright E2E testing.

---

## 1. Project Layout & Current Supabase Realtime Subscriptions

### Current Implementation: `src/hooks/useRealtime.ts`
The hook `useRealtime(table: string, onUpdate: () => void)` coordinates realtime database updates for specific tables:
- **Client Instantiation**: Obtains a browser Supabase client via `createClient()` from `@/lib/supabase` on each mount.
- **WebSocket Channel Subscription**: Creates a dedicated Postgres changes subscription channel for each hook call:
  ```typescript
  const channel = supabase
    .channel(`realtime_${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, (payload) => { ... })
    .subscribe();
  ```
- **Debounced Updates**: Utilizes a `useDebouncedCallback` with a 200ms delay to merge rapid successive update triggers.
- **Echo Guard / Mutation lockout**: Checks the local Zustand store state (`useAppStore.getState().lastMutations`). If the current table or `_global` was mutated locally within the last 500ms, the incoming Postgres event is ignored.
- **Liveness on Tab Visibility**: Subscribes to the `visibilitychange` event. When `document.visibilityState !== 'visible'` (i.e. tab is hidden), it early-returns from the subscription `useEffect`, which automatically runs cleanup (`supabase.removeChannel(channel)`), disconnecting the channel. It re-subscribes once the tab is visible again.

### Current Shortcomings (for Phase 2 goals)
1. **Multiple Channels**: Multiple components subscribing to the same table (e.g. dashboard subscribing to `"items"`, `"people"`, etc. simultaneously) will open multiple WebSocket channels/listeners for the same table.
2. **Tab Visibility Tearing**: Switching tabs (visibility hidden) currently tears down the channel (`removeChannel`) and rebuilds it (`subscribe`) when returning. This causes unnecessary websocket connection/subscription thrashing.

---

## 2. Page Components and Routes Utilizing Realtime Subscriptions

Realtime subscriptions are widely utilized throughout the application to refresh lists when data changes:

| Target Table | Consumer Page Component File Path | Callback Action / Query Refetched |
| :--- | :--- | :--- |
| **items** | `src/app/(app)/page.tsx` (Dashboard) | `refreshData` (re-queries dashboard statistics) |
| **people** | `src/app/(app)/page.tsx` (Dashboard) | `refreshData` |
| **threads** | `src/app/(app)/page.tsx` (Dashboard) | `refreshData` |
| **explores** | `src/app/(app)/page.tsx` (Dashboard) | `refreshData` |
| **items** | `src/app/(app)/do/page.tsx` (Tasks) | `fetchTasks` (invalidates `["tasks"]` query) |
| **people** | `src/app/(app)/do/page.tsx` (Tasks) | `fetchPeopleList` (invalidates `["people_minimal"]`) |
| **explores** | `src/app/(app)/explore/page.tsx` (Explore) | `fetchItems` |
| **items** | `src/app/(app)/inbox/page.tsx` (Inbox) | `refetch` (invalidates `["inbox-tasks"]`) |
| **locations** | `src/app/(app)/remember/locations/page.tsx` | `fetchItems` |
| **people** | `src/app/(app)/remember/people/page.tsx` | `fetchPeople` |
| **people** | `src/app/(app)/remember/people/[id]/page.tsx` | `fetchPerson` |
| **items** | `src/app/(app)/remember/people/[id]/page.tsx` | `fetchPerson` |
| **threads** | `src/app/(app)/think/page.tsx` (Threads) | `fetchThreads` |
| **threads** | `src/app/(app)/think/[id]/page.tsx` (Thread Detail) | `fetchThread` |
| **explores** | `src/app/(app)/think/[id]/page.tsx` (Thread Detail) | `fetchThread` |

---

## 3. Local Run Config & Mocking Capabilities

- **Development Command**: `npm run dev` executes `next dev` to start the local Next.js server.
- **Environment Configuration**: Next.js loads env files automatically.
  - `.env` and `.env.local` are present in the project root.
  - They configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to connect directly to the remote hosted Supabase project instance (`mhfzmgrrtruxuiscvbhm.supabase.co`).
- **Mocking**: No local mock server or local Supabase emulator (Docker) is pre-configured. Database testing in Vitest is achieved by stubbing queries and auth via Jest-like mocks (`vi.mock("@/lib/supabase")`). E2E testing will run against the real Next.js application, which communicates with the remote Supabase API.

---

## 4. Setting up a Test Route for E2E Realtime Verification

To test the consolidated subscriptions reliably without having to bypass auth flow or manage interactive magic-links, we should introduce a dedicated E2E test page.

### Layout Placement
- Create a test page component at `src/app/test-realtime/page.tsx`.
- **Reasoning**: Placing this route directly in `src/app/` (and not inside the `(app)` folder group) ensures it is **not** subject to the authenticated layout (`src/app/(app)/layout.tsx`), which redirects unauthenticated sessions to `/login` and requires a completed onboarding state.

### Middleware Modification
To allow the Playwright test agent to access `/test-realtime` without an active session, modify `src/middleware.ts` to add the test route to the bypassed routes:
```typescript
const isAuthRoute = request.nextUrl.pathname.toLowerCase().startsWith('/login') ||
                    request.nextUrl.pathname.toLowerCase().startsWith('/auth') ||
                    request.nextUrl.pathname.toLowerCase().startsWith('/test-realtime');
```

### Proposed Test Page Component (`src/app/test-realtime/page.tsx`)
```tsx
"use client";

import React, { useState } from "react";
import QueryProvider from "@/components/layout/QueryProvider";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { useRealtime } from "@/hooks/useRealtime";

function TestSubscriber({ table, label }: { table: string; label: string }) {
  const [updates, setUpdates] = useState(0);
  useRealtime(table, () => {
    setUpdates((prev) => prev + 1);
  });

  return (
    <div data-testid={`subscriber-${label}`} className="p-4 border rounded">
      <h3>Subscriber {label} ({table})</h3>
      <p>Received Updates: <span data-testid={`updates-${label}`}>{updates}</span></p>
    </div>
  );
}

export default function TestRealtimePage() {
  return (
    <QueryProvider>
      <RealtimeProvider>
        <div className="p-8 space-y-4">
          <h1 className="text-xl font-bold">Realtime Subscription Test Sandbox</h1>
          <div className="flex gap-4">
            <TestSubscriber table="items" label="A" />
            <TestSubscriber table="items" label="B" />
            <TestSubscriber table="people" label="C" />
          </div>
        </div>
      </RealtimeProvider>
    </QueryProvider>
  );
}
```

---

## 5. Playwright E2E Test Design (`tests/realtime.spec.ts`)

To verify subscription multiplexing and tab visibility persistence, the Playwright test will spy on WebSocket frames directly.

### Intercepting Phoenix/Supabase WebSocket Protocols
Supabase Realtime communicates over a standard WebSocket channel.
1. When a channel is subscribed to, the client sends a Phoenix join frame:
   `{"topic":"realtime:realtime_<table_name>","event":"phx_join",...}`
2. When unsubscribed/cleaned up, it sends:
   `{"topic":"realtime:realtime_<table_name>","event":"phx_leave",...}`

By listening to WebSocket events in Playwright, we can assert on these frames without wrapping internal javascript code.

### Draft Implementation of `tests/realtime.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Supabase Realtime Channel Consolidation & Visibility Persistence', () => {
  test('should reuse single channel for identical tables and preserve channel on visibility change', async ({ page }) => {
    let joinCount = 0;
    let leaveCount = 0;

    // Monitor WebSocket connections and frames
    page.on('websocket', (ws) => {
      ws.on('framesent', (frame) => {
        try {
          const payload = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString();
          const message = JSON.parse(payload);
          
          // Count joins specifically for the 'items' table channel
          if (message.event === 'phx_join' && message.topic.includes('items')) {
            joinCount++;
          }
          // Count leaves specifically for the 'items' table channel
          if (message.event === 'phx_leave' && message.topic.includes('items')) {
            leaveCount++;
          }
        } catch (e) {
          // Ignore invalid JSON frames (e.g. heartbeat ping/pongs)
        }
      });
    });

    // 1. Navigate to the test route (middleware must bypass auth for /test-realtime)
    await page.goto('/test-realtime');

    // 2. Wait for test subscribers to mount
    await expect(page.locator('[data-testid="subscriber-A"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscriber-B"]')).toBeVisible();
    
    // Give subscription events a moment to compile/send
    await page.waitForTimeout(1000);

    // 3. ASSERTION: Only ONE channel subscription request ('phx_join') was made for 'items'
    // Subscriber A and B both listen to 'items', but they must share a single subscription.
    expect(joinCount).toBe(1);

    // 4. Trigger Page Hidden State (Mocking visibility API)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(1000);

    // ASSERTION: The channel is NOT torn down (no 'phx_leave' frame is sent)
    expect(leaveCount).toBe(0);

    // 5. Trigger Page Visible State (Mocking visibility API back to active)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(1000);

    // ASSERTION: No new reconnect/subscription cycle was triggered (joinCount remains 1)
    expect(joinCount).toBe(1);
    expect(leaveCount).toBe(0);
  });
});
```

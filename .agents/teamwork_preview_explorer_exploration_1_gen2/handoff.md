# Handoff Report

## 1. Observation
- **`useRealtime` implementation**: `src/hooks/useRealtime.ts` (lines 33-61) uses a direct Supabase subscription per call, returning early on visibility change:
  ```typescript
  if (!isVisible) return;
  const channel = supabase.channel(`realtime_${table}`).on(...).subscribe();
  return () => { supabase.removeChannel(channel); };
  ```
- **Usage of `useRealtime`**: PowerShell search for `useRealtime` returned usage in:
  - `src\app\(app)\page.tsx` (lines 232-235)
  - `src\app\(app)\do\page.tsx` (lines 191-192)
  - `src\app\(app)\explore\page.tsx` (line 168)
  - `src\app\(app)\inbox\page.tsx` (line 165)
  - `src\app\(app)\remember\locations\page.tsx` (line 57)
  - `src\app\(app)\remember\people\page.tsx` (line 250)
  - `src\app\(app)\remember\people\[id]\page.tsx` (lines 102-103)
  - `src\app\(app)\think\page.tsx` (line 64)
  - `src\app\(app)\think\[id]\page.tsx` (lines 168-169)
- **Local environment configuration**:
  - `package.json` contains `"dev": "next dev"`.
  - `.env` and `.env.local` contain `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointing to a remote instance (`mhfzmgrrtruxuiscvbhm.supabase.co`).
- **Auth middleware**: `src/middleware.ts` intercepts matching routes and redirects unauthenticated users to `/login`.
- **E2E Test File**: In `PROJECT.md` (lines 7, 12, 31), the E2E test file is designated as `tests/realtime.spec.ts`.

## 2. Logic Chain
- In the existing implementation, two components using `useRealtime` for the same table create two distinct WebSocket subscriptions (`phx_join` frames).
- Page visibility change to `hidden` triggers hook cleanup, causing a channel tear-down (`phx_leave` frame) followed by a re-subscribe (`phx_join` frame) upon returning.
- Under the proposed `RealtimeProvider` architecture, the connection should be consolidated (multiplexed) and persist through visibility changes.
- To test this in Playwright without requiring complex authentication or magic-link handling, a public test route can be created at `src/app/test-realtime/page.tsx` (outside the protected `(app)` folder).
- To prevent Next.js middleware from redirecting Playwright's browser to `/login`, `/test-realtime` should be added to the auth-exclusion routes in `src/middleware.ts`.
- In `tests/realtime.spec.ts`, Playwright can observe raw WebSocket traffic via `page.on('websocket', ws => { ws.on('framesent', frame => { ... }) })` to spy on Phoenix's `phx_join` and `phx_leave` frame events.
- By matching the frame topics (e.g. `items` table) and counting events, we can verify that only a single channel is joined even when multiple components subscribe, and that toggling `document.visibilityState` (via `page.evaluate()`) does not trigger any leaving or joining frames.

## 3. Caveats
- Playwright dependencies (`@playwright/test`) are not currently listed in `package.json` and must be added to enable execution of `tests/realtime.spec.ts`.
- We assume testing is executed against a dev server connected to the remote Supabase API configured in `.env.local`.

## 4. Conclusion
- Subscription consolidation and tab-visibility persistence can be cleanly verified using a public test route (`/test-realtime`) combined with Playwright's WebSocket frame interception APIs (`page.on('websocket')`) to assert on the number of Phoenix join/leave protocol messages.

## 5. Verification Method
- Inspect the full design report at `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\e2e_testing_track\exploration_report.md`.
- Ensure `src/middleware.ts` has been modified to bypass `/test-realtime` and that the test page `src/app/test-realtime/page.tsx` exists.

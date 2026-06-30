# Scope: Playwright E2E Realtime Subscription Testing Track

## Architecture
- **Test Runner**: Playwright (`@playwright/test`)
- **Target App**: Next.js app running at `http://localhost:3000` (started via `npm run dev`)
- **Supabase Mocking/Observation**: WebSockets intercepted via Playwright Page WebSocket API (`page.on('websocket', ...)`).
- **Client Realtime Connection**: Centralized `RealtimeProvider` and custom `useRealtime` hook communicating via a single WebSockets channel per table.
- **Verification Sandboxing**: A dedicated test page component at `src/app/test-realtime/page.tsx` bypassed in auth middleware.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Test Infra Setup | Install `@playwright/test` and initialize Playwright configuration | None | PLANNED |
| 2 | Test Route & Middleware Setup | Create `/test-realtime` route and modify `src/middleware.ts` to allow bypass | None | PLANNED |
| 3 | Realtime Test Cases Design | Write Playwright tests in `tests/realtime.spec.ts` mocking/observing WS connections | M1, M2 | PLANNED |
| 4 | Suite Verification | Run E2E tests, verify it handles single-channel deduplication and visibility change persistence, publish `TEST_READY.md` | M3 | PLANNED |

## Interface Contracts
### Playwright Test Runner ↔ App WebSockets
- The test suite intercepts all WebSocket creations via `page.on('websocket', ws => { ... })`.
- Frame payloads matching Supabase's Realtime protocol (e.g., Phoenix channels join messages `phx_join` for PostgreSQL replication changes on specific tables) are tracked and counted.
- Visibility APIs are triggered via `page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true }))` and dispatching `visibilitychange` events.

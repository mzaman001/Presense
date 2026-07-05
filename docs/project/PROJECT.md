# Project: Presense Phase 2 (Realtime Channels & TanStack Query Integration)

## Architecture
- **State management**: Zustand (`src/store/useAppStore.ts`) manages mutation timestamps via `lastMutations`. Centralized provider state tracks active channel subscriptions.
- **Realtime system**: Supabase Realtime channel subscriptions consolidated into a single `RealtimeProvider`.
- **Query management**: TanStack Query (`@tanstack/react-query`) handles local state caches. Mutations trigger cache invalidation via `queryClient.invalidateQueries`.
- **Verification**: Playwright (`tests/realtime.spec.ts`) verifies single channel subscription behavior and liveness during tab visibility changes.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Testing Suite | Create Playwright test suite `tests/realtime.spec.ts` & publish `TEST_READY.md` | None | IN_PROGRESS (Conv: pending_e2e) |
| 2 | Codebase Exploration | Analyze existing realtime hook usages, store, and TanStack query setup | None | DONE |
| 3 | Centralized RealtimeProvider | Implement `RealtimeProvider` component wrapping Layout | M2 | DONE |
| 4 | useRealtime Hook Refactor | Refactor `useRealtime` hook to consume the provider and invalidate queries | M3 | DONE |
| 5 | Echo Guard Hoisting | Hoist mutation marking/echo guard into `RealtimeProvider` | M3, M4 | DONE |
| 6 | E2E Verification & Hardening | Validate implementation against tests and perform adversarial hardening | M1, M5 | IN_PROGRESS (Conv: pending_impl) |

## Interface Contracts
### RealtimeProvider ↔ useRealtime
- Provider provides a pub/sub or event-based registry or React context allowing `useRealtime` hooks to subscribe to table update events.
- Central channel is reused if multiple components request the same table.

### useRealtime hook ↔ TanStack Query
- Hook does not fetch data directly. It calls `queryClient.invalidateQueries` when a PostgreSQL change event is received for the subscribed table.

## Code Layout
- `src/hooks/useRealtime.ts`: Realtime subscription hook
- `src/components/providers/RealtimeProvider.tsx`: Centralized Realtime subscription provider
- `src/store/useAppStore.ts`: App store containing mutation flags
- `tests/realtime.spec.ts`: Playwright test suite for realtime behavior

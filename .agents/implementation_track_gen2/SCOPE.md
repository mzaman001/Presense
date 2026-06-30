# Scope: Phase 2 Implementation (Gen 2)

## Architecture
- Centralized `RealtimeProvider` wraps Layout to manage table subscriptions once.
- Event registry / PubSub to dispatch PostgreSQL change events to subscribers.
- `useRealtime` hook refactored to consume the provider's pub/sub and invalidate TanStack Query caches.
- App state store `useAppStore` mutations (echo guard logic) hoisted into the central provider.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| B1 | Exploration | Explore existing useRealtime, Supabase setups, and TanStack query client usage | None | DONE |
| B2 | Centralized RealtimeProvider | Implement centralized RealtimeProvider subscribing once per table, ensuring channels are not torn down on visibility changes | B1 | DONE |
| B3 | useRealtime Hook Refactor | Refactor useRealtime to consume the provider and invalidate query caches. Preserve optimistic updates and deduplicate events | B2 | DONE |
| B4 | Echo Guard Hoisting | Hoist mutation marking (echo guard) logic into RealtimeProvider | B3 | DONE |
| B5 | E2E Verification & Hardening | Wait for E2E Testing Track to publish TEST_READY.md. Run tests and iterate via Explorer->Worker->Reviewer->Challenger->Auditor loop | B4 | IN_PROGRESS |

## Interface Contracts
### RealtimeProvider ↔ useRealtime
- `RealtimeProvider` registers listeners and exposes table subscribe/unsubscribe methods via React Context or a central event registry.
- Multiple active `useRealtime` hooks subscribing to the same table share the single Supabase Realtime channel for that table.
- Visibility changes do not trigger channel teardown.

### useRealtime ↔ TanStack Query Client
- `useRealtime` receives change events for its table, checks if the event should be processed (e.g., echo guard check), and calls `queryClient.invalidateQueries` for the table queries.

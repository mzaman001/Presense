# Original User Request

## Initial Request — 2026-06-29T14:01:25+05:30

Implement Phase 2 of the Presense roadmap: Consolidate Realtime channels and data fetching using a centralized RealtimeProvider and TanStack Query invalidation.

Working directory: C:\Users\muhdz\.gemini\antigravity\scratch\presense

## Requirements

### R1. Centralized RealtimeProvider
Implement a single `RealtimeProvider` component that subscribes to relevant Supabase tables once. Avoid tearing down and rebuilding channels on visibility changes; let Supabase handle its own reconnections.

### R2. TanStack Query Integration
Refactor the `useRealtime` hook to consume the provider and trigger `queryClient.invalidateQueries` rather than imperative fetch callbacks. Ensure that optimistic updates are preserved and deduped.

### R3. Echo Guard Centralization
Hoist the `useAppStore.markMutation` logic (echo guard) into the central provider so that it is centralized across all table subscriptions.

### R4. Programmatic Verification (Playwright)
Create a Playwright test suite (`tests/realtime.spec.ts`) that programmatically verifies the realtime behavior. The test must mock or observe the WebSocket connections to assert that only one subscription is made per table, and that visibility changes (mocked via page visibility API) do not cause a disconnect/reconnect cycle.

## Acceptance Criteria

### Reliability & Verification
- [ ] Playwright test successfully asserts that only a single WebSocket channel is created for a given table, even when multiple components subscribe to it.
- [ ] Playwright test successfully asserts that tab visibility changes do NOT result in a channel teardown and rebuild.
- [ ] Playwright test passes locally.
- [ ] Mutations trigger query invalidations instead of redundant explicit fetches, eliminating race conditions on list views.

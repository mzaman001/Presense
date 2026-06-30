# Plan - Presense Phase 2 Implementation

Consolidated realtime channels and TanStack Query data invalidation.

## Roadmap & Milestone Plan

### Track A: E2E Testing Track
- **Milestone A1: Realtime Playwright Test Infrastructure and Scenarios**
  - Implement Playwright test suite `tests/realtime.spec.ts`.
  - Assert that only a single WebSocket channel is created for a given table, even when multiple components subscribe to it.
  - Assert that tab visibility changes (mocked via page visibility API) do not cause a channel teardown and rebuild.
  - Publish `TEST_READY.md` containing test instructions and feature list.

### Track B: Implementation Track
- **Milestone B1: Exploratory Analysis of Realtime & TanStack Query Usages**
  - Locate all files importing/using `useRealtime` or directly establishing Supabase channel subscriptions.
  - Locate TanStack Query client initialization and usage.
- **Milestone B2: Centralized RealtimeProvider**
  - Implement a single `RealtimeProvider` component.
  - Handle central subscriptions once per table.
  - Do not tear down channels on tab visibility change.
- **Milestone B3: useRealtime Hook Refactor & Query Invalidation**
  - Refactor `useRealtime` to consume the provider state/events.
  - Trigger `queryClient.invalidateQueries` instead of imperative fetch callbacks.
  - Preserve and deduplicate optimistic updates.
- **Milestone B4: Echo Guard Centralization**
  - Hoist `useAppStore.markMutation` logic into the central provider.
- **Milestone B5: E2E Verification & Adversarial Hardening**
  - Run Playwright test suite, fix any issues until 100% pass.
  - Spawn Challengers to verify correctness under stress.
  - Spawn Forensic Auditor to verify integrity and authentic implementation.

## Iteration Controls
- Maximum iterations: 32
- Succession threshold: 16 spawns

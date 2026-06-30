# Plan: E2E Playwright Realtime Test Suite Implementation

## Objective
Design and implement a Playwright test suite in `tests/realtime.spec.ts` that programmatically verifies the realtime deduplication and connection liveness behavior during tab visibility changes.

## Phase-by-Phase Plan

### Milestone 1: Test Infra Setup
1. Spawn a `teamwork_preview_worker` to:
   - Install `@playwright/test` as a devDependency.
   - Run `npx playwright install chromium` to install browser dependencies.
   - Create a standard Playwright configuration file (`playwright.config.ts`) targeting `http://localhost:3000`.
   - Verify Playwright is working by running a dummy test.

### Milestone 2: Test Route & Middleware Setup
1. Spawn a `teamwork_preview_worker` to:
   - Modify `src/middleware.ts` to bypass `/test-realtime` route from authentication checks.
   - Create `src/app/test-realtime/page.tsx` that renders a sandbox mounting multiple subscribers to the `items` and `people` tables using the `RealtimeProvider` and `useRealtime` hook.
   - Build/run the Next.js app to make sure this page compiles and renders correctly.

### Milestone 3: Realtime Test Cases Design
1. Spawn a `teamwork_preview_worker` to:
   - Write the test suite in `tests/realtime.spec.ts`.
   - The test must spy on WebSocket frames sent by the application using Playwright's `page.on('websocket')` API.
   - Specifically, monitor for `phx_join` and `phx_leave` events to verify that:
     1. Only 1 connection channel is created per table when multiple components are mounted.
     2. Hiding the page (using mocked page visibility state API) does NOT trigger a disconnect (`phx_leave`) or a reconnect (`phx_join`).
     3. Changing the page visibility back to visible does not trigger duplicate subscriptions.
   - Provide a clear CLI command to run this test suite.

### Milestone 4: Suite Verification & Publish
1. Spawn a `teamwork_preview_worker` (or challenger/auditor) to:
   - Launch the local Next.js dev server.
   - Run the E2E test suite against the running server.
   - Ensure the tests pass.
   - Publish `TEST_READY.md` to the project root with documentation on how to run tests, and a summary of feature/boundary/combination cases.
   - Stop the local dev server.

## 2026-06-29T19:20:34Z
Your working directory is: C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_playwright_e2e_implementation
Your task is to:
1. Verify if `@playwright/test` and browsers are installed. If they are not completely installed, run:
   - `npm install`
   - `npx playwright install chromium`
2. Add auth-check bypass for `/test-` routes in `src/middleware.ts` around lines 55-60.
3. Create a test page `src/app/test-realtime/page.tsx` that:
   - Imports `QueryClient`, `QueryClientProvider` from `@tanstack/react-query`.
   - Imports `RealtimeProvider` from `@/components/providers/RealtimeProvider`.
   - Imports `useRealtime` from `@/hooks/useRealtime`.
   - Renders two components subscribing to the "items" table, and one subscribing to the "people" table using `useRealtime`.
   - Each subscriber should render its status in an element with a distinct `data-testid` (e.g. `subscriber-items-1`, `subscriber-items-2`, `subscriber-people`).
4. Create the E2E test file `tests/realtime.spec.ts`. The test must:
   - Listen to page websocket `framesent` events.
   - Parse payloads to track Phoenix channel join events (`phx_join`) and leave events (`phx_leave`).
   - Go to `/test-realtime`.
   - Verify that exactly one `phx_join` is sent for the `items` topic, and exactly one for `people`.
   - Mock page visibility changes to 'hidden' and then 'visible' using `page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true }); document.dispatchEvent(new Event('visibilitychange')); })` (and similar for 'visible').
   - Assert that changing visibility to 'hidden' does not trigger any channel teardown (no `phx_leave` or channel remove), and returning to 'visible' does not trigger a new subscription join (no new `phx_join`).
5. Run the test suite:
   - First run the dev server or use playwright's webServer configuration to run the test:
     `npx playwright test tests/realtime.spec.ts`
6. Verify both `tests/sanity.spec.ts` and `tests/realtime.spec.ts` pass successfully.
7. Write a detailed handoff.md reporting all commands run, file changes, and test results.
8. Report completion to me via send_message.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

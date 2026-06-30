## 2026-06-29T13:50:22Z
Objective: Set up the test route, modify middleware, and write the E2E Playwright test suite.

Tasks:
1. Modify `src/middleware.ts` to bypass authentication for `/test-realtime` route. Change `isAuthRoute` variable to include startsWith('/test-realtime').
2. Create the file `src/app/test-realtime/page.tsx`. It must render the test sandbox component with a QueryProvider, RealtimeProvider, and multiple components subscribing to "items" and "people" tables to verify channel consolidation. Use the exact code layout from our exploration report findings:
   - Mount two subscribers for "items" ("A" and "B").
   - Mount one subscriber for "people" ("C").
3. Create the file `tests/realtime.spec.ts`. It must programmatically verify the realtime behavior. Specifically:
   - Intercept WebSocket frames sent by the application using page.on('websocket') API.
   - Assert that only one WebSocket channel subscription ('phx_join') is created/subscribed for a given table (e.g. "items"), even when multiple components (A and B) subscribe to it.
   - Mock page visibility changes via page.evaluate(Object.defineProperty(document, 'visibilityState', ...)) and dispatching visibilitychange event.
   - Assert that page visibility changes to hidden and back to visible do not cause a disconnect/reconnect cycle (the channel should not be torn down and rebuilt, i.e., phx_leave count remains 0 and phx_join count remains 1).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT
hardcode test results, create dummy/facade implementations, or
circumvent the intended task. A Forensic Auditor will independently
verify your work. Integrity violations WILL be detected and your
work WILL be rejected.

Please write a handoff.md in your working directory C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_milestones_2_3_1 outlining:
- The exact changes made to src/middleware.ts.
- The content of src/app/test-realtime/page.tsx.
- The content of tests/realtime.spec.ts.
When complete, send a message to your parent C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\e2e_testing_track (Conversation ID: 333c7cf4-86ff-4b71-a3b2-41554e653221) with a summary.

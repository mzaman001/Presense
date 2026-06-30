## 2026-06-29T13:58:00Z

**Context**: Designing the E2E Playwright test suite in `tests/realtime.spec.ts` for Presense Phase 2.
**Objective**:
1. Create/write `tests/realtime.spec.ts`. It must:
   - Load the page `/test-realtime`.
   - Mock/observe WebSocket connections using Playwright's `page.on('websocket', ...)` API.
   - Track sent frames on the WebSocket to count the number of `phx_join` or `join` topic requests.
   - Assert that only one WebSocket channel is created/subscribed for a given table, even when multiple components subscribe to it (e.g. for `items` table, we have `ItemsSubscriber1` and `ItemsSubscriber2` on the `/test-realtime` page, so only one join frame should be sent).
   - Assert that visibility changes (mocked by changing `document.visibilityState` to `'hidden'` and dispatching `'visibilitychange'` event) do not cause a disconnect/reconnect cycle (the channel should not be closed, and no new join frames should be sent).
2. Execute the test suite using `npx playwright test tests/realtime.spec.ts` to confirm that the tests run successfully (we expect them to FAIL on the current codebase, which is correct because the provider and refactored hook are not implemented yet).
3. Document the tests, execution instructions, and expected failure mode in `handoff.md` in your working directory: C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_test_design.
4. Report completion to the E2E Testing Track Orchestrator (Conversation ID: fa07cea5-473a-4f12-808f-9f39f76a0d50) by calling send_message.

**MANDATORY INTEGRITY WARNING**:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

**Working Directory**: C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_test_design
**Identity**: You are a worker agent responsible for designing and implementing the E2E Playwright test suite.

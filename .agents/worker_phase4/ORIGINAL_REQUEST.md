## 2026-06-27T13:08:46Z
Implement Phase 4 (Sunsama Rituals & UI Polish) requirements as described in the user request.
- Read Synthesis Report at C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\sub_orch_impl\synthesis.md
- Implement realtime hook fix in src/hooks/useRealtime.ts and useAppStore.ts
- SQL migration adding user_settings fields and items field
- Sunsama morning/evening rituals
- UI Polish
- Verification (npm run lint, npm test)
- Document changes in handoff.md
- Send message to caller 19470d71-dc26-4430-a82f-491132d550a9.

## 2026-06-27T18:39:16Z
Implement a comprehensive E2E/integration test suite for all Phase 4 requirements in src/lib/__tests__/phase4.test.tsx.
Refer to src/lib/__tests__/phase3.test.tsx for testing patterns and mock helper functions (like mockSupabaseQuery).

First, create a simple stub file for any new Sunsama components so that the test file compiles correctly:
- C:\Users\muhdz\.gemini\antigravity\scratch\presense\src\components\features\RitualOverlay.tsx
  This stub should export a placeholder `RitualOverlay` component rendering a div with `data-testid="ritual-overlay"`.

The test file `src/lib/__tests__/phase4.test.tsx` must cover:
1. `useRealtime` Hook debouncing (burst writes handling, avoiding redundant refetches/lockouts).
2. Sunsama morning/evening rituals (morning triage stack, commit flow workload bar, evening review Pomodoros tally & carrying over deadlines, manual/auto triggers).
3. Fluid swipe-to-delete mechanics on Inbox, Explore, and People lists.
4. Auto-growing textareas (react-textarea-autosize integration in TaskAddPanel, ExploreDrawer, AddPersonPanel, and ThreadDetailPage).

Follow the 4-tier test case structure:
- Tier 1: Happy-path/feature coverage tests (at least 5 per requirement).
- Tier 2: Boundary & corner cases (at least 5 per requirement).
- Tier 3: Cross-feature combinations.
- Tier 4: Real-world workload scenarios.

Since some features are not fully implemented by the parallel implementation track, you should write assertions that expect the planned UI elements and behaviors (e.g. elements with specific roles, text contents, or test IDs). The tests will run and fail as expected (TDD style) or pass if the stub/mocks satisfy them. Ensure the test file compiles perfectly with Vitest.

Run the tests using vitest to verify that they compile and run (it is fine if some fail on assertions due to incomplete implementation, but they must NOT fail on compile/syntax errors). Document the command and output.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

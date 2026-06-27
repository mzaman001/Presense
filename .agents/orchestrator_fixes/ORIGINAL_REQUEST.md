# Original User Request

## 2026-06-21T17:44:32Z

You are the teamwork_preview_orchestrator for the Presense project fixes.
Your working directory is: C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\orchestrator_fixes
The project workspace directory is: C:\Users\muhdz\.gemini\antigravity\scratch\presense
The original request is located at: C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\ORIGINAL_REQUEST.md

Your mission is to implement the UX/UI and backend fixes outlined in the newly generated C:\Users\muhdz\.gemini\antigravity\scratch\presense\presense_ux_research_report.md to resolve the 18 specific issues in the Presense app codebase.

Specifically:
1. Execute Phase 1: State Reliability
- Refactor the triage and space-routing logic. Instead of executing direct row deletions (`supabase.from('items').delete()`) when routing an item from the Inbox to another space, implement soft-deletions or state transitions.
- Consolidate category save operations in the Settings Modal to prevent DB sync race conditions.
2. Execute Phase 2: Core UX Hardening
- Fix all UI/UX bugs identified in Phase 2 of the report:
  1. Normalize UTF-8 characters (replace `â†’` with `→` or `lucide-react` icons).
  2. Replace custom `e.stopPropagation()` dropdowns with robust primitives (like Radix UI or Headless UI) in `ExploreDrawer` and `Inbox`.
  3. Fix the `JSON.stringify` performance bottleneck inside `TaskCard.tsx`'s `React.memo` by using a shallow comparison.
  4. Implement Optimistic UI updates for Task Snoozing and Task Deletions to eliminate the 5-second latency.

Do NOT implement Phase 3.

## 2026-06-21T15:14:07Z

You are teamwork_preview_worker. Your mission is to fix the remaining issues identified by the Victory Auditor in the retry phase:

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Here are the specific fixes you must execute:
1. Normalize UTF-8 characters:
   - In `src/components/features/CaptureModal.tsx`, replace all occurrences of `â†’` with `→` on lines 36, 39, 47, 48, 145, 180, 296, 309. Ensure the destination checks match the normalized `'Remember → People'` and `'Remember → Locations'` returned by `capture-router.ts`.
   - In `src/app/(app)/do/page.tsx`, replace `â€”` with `—` on line 196, and replace `â€¢` with `•` on line 366.
2. Invalidate React Query Cache on Settings Modal batch deletions:
   - In `src/components/features/SettingsModal.tsx`, import `useQueryClient` from `@tanstack/react-query`.
   - Get the `queryClient` instance inside the component.
   - In `handleClearCompleted`, call `queryClient.invalidateQueries({ queryKey: ["tasks"] })` and `queryClient.invalidateQueries({ queryKey: ["dashboard"] })` upon successful deletion.
   - In `handleClearStaleLocations`, call `queryClient.invalidateQueries({ queryKey: ["locations"] })` (and any other query key that might cache locations) upon successful deletion.

Finally, run `npm run build` and `npm run test` (or equivalent test commands) to verify everything compiles and passes tests. Include build and test output in your handoff.

Write your handoff report to `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\orchestrator_fixes\worker_handoff_retry.md`.
Deliver your handoff report and notify me when complete.

## 2026-06-21T15:17:45Z

You are teamwork_preview_auditor. Your mission is to audit the integrity of the implemented Phase 1 and Phase 2 fixes in the Presense project.

Verify the following:
1. Inspect the codebase (e.g. `src/components/features/CaptureModal.tsx`, `src/app/(app)/do/page.tsx`, `src/components/features/SettingsModal.tsx`) to ensure no Windows-1252 corrupted sequences remain.
2. Verify that there are no hardcoded test results, dummy/facade implementations, or bypassed checks.
3. Check that the build compiles and tests pass.
4. Verify that `SettingsModal.tsx` successfully imports and calls `queryClient.invalidateQueries` inside batch deletion handlers (`handleClearCompleted` and `handleClearStaleLocations`).

Write your audit report to `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\orchestrator_fixes\auditor_report.md`.
Deliver your handoff report and notify me when complete.

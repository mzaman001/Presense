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

## 2026-06-21T12:20:41Z

You are teamwork_preview_worker. Your mission is to implement all Phase 1 and Phase 2 fixes for the Presense project.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read the analysis and fix proposals written by the explorers:
- Phase 1 Analysis: `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\orchestrator_fixes\explorer_phase1_analysis.md`
- Phase 2 Analysis: `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\orchestrator_fixes\explorer_phase2_analysis.md`

Your tasks:
1. Database Migrations:
   - Create `supabase/migrations/008_add_people_categories.sql` to add `people_categories` to `user_settings`.
   - Create `supabase/migrations/009_rename_category_rpc.sql` to add the `rename_category` RPC.
   - Run these migrations. You can execute them by running `npx supabase db query --linked` with the SQL files or by adapting `scripts/run_migrations.ps1`. Ensure they execute successfully on the database.
2. Refactor Triage and Space-Routing (Phase 1):
   - Edit `src/app/(app)/inbox/page.tsx` as proposed:
     - Implement soft-deletions using update `status: 'deleted'`.
     - Capture target row IDs using `.select('id').single()` and delete by ID on Undo.
     - Add Locations routing to the dropdown UI using the MapPin icon, and implement database routing/Undo logic for Locations.
3. Consolidate Settings Category Renaming (Phase 1):
   - Edit `src/components/features/SettingsModal.tsx` to use the `rename_category` RPC function on rename and synchronize state immediately.
4. Normalize UTF-8 Characters (Phase 2):
   - Scan and replace garbled characters in the listed files (like `CaptureModal.tsx`, `PomodoroTimer.tsx`, `SearchModal.tsx`, `SettingsModal.tsx`, `TaskAddPanel.tsx`, `TaskCard.tsx`, `Dropdown.tsx`, `AppErrorFallback.tsx`, `LoadingSpinner.tsx`, etc.).
5. Drop custom `e.stopPropagation()` in dropdowns (Phase 2):
   - Refactor dropdowns in `ExploreDrawer.tsx`, `inbox/page.tsx`, and `Dropdown.tsx` to use React refs for click-outside check.
6. Fix `JSON.stringify` Performance Bottleneck (Phase 2):
   - In `TaskCard.tsx`'s custom `React.memo` comparator, replace `JSON.stringify` with a shallow field check.
7. Optimistic UI Updates (Phase 2):
   - Implement optimistic updates for task deletion and task snoozing/unsnoozing in `TaskCard.tsx`, `inbox/page.tsx`, `TaskAddPanel.tsx`, and `page.tsx` using React Query's `queryClient`.

Finally, run `npm run build` and `npm run test` (or equivalent test commands) to verify everything compiles and passes tests. Include build and test output in your handoff.

Write your handoff report to `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\orchestrator_fixes\worker_handoff.md`.
Deliver your handoff report and notify me when complete.

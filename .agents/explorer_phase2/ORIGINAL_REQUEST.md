## 2026-06-21T12:17:02Z
You are teamwork_preview_explorer. Your mission is to analyze the codebase for Phase 2 (Core UX Hardening) issues and write a detailed fix proposal.

Specifically:
1. Normalize UTF-8 Characters:
   - Identify all files containing garbled ANSI characters (e.g. `â†’`, `Â·`, `â—¾`, `â†»`, `Ã—`, `â–¾`) and show exactly what UTF-8 replacements they should have (e.g. `→`, `·`, `▪`, `⇆`, `×`, `▼`, or Lucide react icons).
2. Remove `e.stopPropagation()` from dropdowns:
   - Examine `src/components/features/ExploreDrawer.tsx` (lines 79-83, 239, 335), `src/app/(app)/inbox/page.tsx` (lines 200, 207) and `src/components/ui/Dropdown.tsx` (lines 127, 162).
   - Propose how to refactor these dropdowns to use React refs for click-outside check so that clicks bubble normally without needing `e.stopPropagation()`. Write the exact code additions for these components.
3. Fix React.memo comparator:
   - Examine `src/components/features/TaskCard.tsx` (lines 314-318). Replace the custom `JSON.stringify(prevProps.task) === JSON.stringify(nextProps.task)` comparison with a shallow check of critical primitive fields and reference/shallow-array checks for arrays (`subtasks` and `linked_people_ids`). Write the exact React.memo comparator.
4. Implement Optimistic UI Updates:
   - Identify how task deletion (swipe-to-delete in `TaskCard.tsx` and delete button in `TaskAddPanel.tsx`'s `confirmDelete` function) and task snoozing/unsnoozing (clock cancel button in `TaskCard.tsx` and snooze button on the Home Focus Hero in `src/app/(app)/page.tsx`) can be optimistically updated using React Query's `queryClient.setQueryData`.
   - Show how the queries `["tasks"]` and `["dashboard"]` should be updated immediately before the Supabase mutation is triggered, and how they should be rolled back to their original states if the Supabase call fails.

Write your analysis and detailed fix proposal to `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\orchestrator_fixes\explorer_phase2_analysis.md`.
Deliver your handoff report and notify me when complete.

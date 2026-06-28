## 2026-06-28T06:16:06Z
You are the Implementation Worker for Phase 5.
Your task is to implement Next.js Edge Auth Middleware and the database migrations and UI changes for Mentions/Cross-Linking.

Deliverables:
1. Database Migration:
   - Create `supabase/migrations/011_add_linked_people.sql` to add `linked_people uuid[] DEFAULT '{}'` to `items` and `threads` tables.
   - Add GIN indexes on both tables for the `linked_people` column to ensure fast querying:
     ```sql
     CREATE INDEX IF NOT EXISTS idx_items_linked_people ON items USING gin (linked_people);
     CREATE INDEX IF NOT EXISTS idx_threads_linked_people ON threads USING gin (linked_people);
     ```
2. Edge Auth Middleware:
   - Create `src/middleware.ts`. You can copy the code from `src/proxy.ts` (created by the testing worker) directly into it.
   - Ensure the matcher configuration covers all routes except static assets, images, etc.
3. Mentions UI inside CaptureModal:
   - In `src/components/features/CaptureModal.tsx`, fetch contacts from the `people` table (`id`, `name`) when the modal is mounted.
   - Detect typing `@` in the input field. Position a dropdown absolute overlay directly below the input field.
   - Implement keyboard navigation (ArrowUp, ArrowDown to navigate, Enter/Tab to select, Escape to close) overriding default inputs when the dropdown is active.
   - Selecting a contact must insert `@[Person Name](uuid)` at the cursor.
   - In `handleConfirm()`, extract mentions from `item.title` using `extractMentions` from `@/lib/utils` and include `linked_people` (uuid[]) in the `items` and `threads` table insert payloads.
4. Mentions UI inside Think Thread Detail page:
   - In `src/app/(app)/think/[id]/page.tsx`, fetch contacts from the `people` table.
   - Detect typing `@` in the `<TextareaAutosize />` text field. Position a dropdown absolute overlay directly above/below the input area.
   - Implement keyboard navigation (ArrowUp, ArrowDown to navigate, Enter/Tab to select, Escape to close) overriding default textarea/form behavior.
   - In `handleAddEntry()` and `handleDeleteEntry()`, extract mentions from all entries and update the `linked_people` (uuid[]) column on the thread table.
5. Verification:
   - Run the unit/integration tests: `npx vitest run src/lib/__tests__/middleware.test.ts src/lib/__tests__/mentions.test.tsx`
   - Make sure all tests compile and pass successfully.

Your working directory is `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_implementation_phase5`. Write a handoff report when complete.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

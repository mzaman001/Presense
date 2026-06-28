# Handoff Report — Mentions Parsing and UI Popover Behavior Verification (Phase 5)

## 1. Observation

During the review of the mentions parsing and UI popover behavior, the following codebase details were analyzed:

- **Mentions Extraction Implementation** (`src/lib/utils.ts` lines 35-43):
  ```typescript
  export function extractMentions(text: string): string[] {
    const regex = /@\[[^\]]+\]\(([^)]+)\)/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }
  ```

- **Database Column Typing** (`supabase/migrations/011_add_linked_people.sql` lines 2-3):
  ```sql
  ALTER TABLE items ADD COLUMN IF NOT EXISTS linked_people uuid[] DEFAULT '{}';
  ALTER TABLE threads ADD COLUMN IF NOT EXISTS linked_people uuid[] DEFAULT '{}';
  ```

- **CaptureModal Save Handler** (`src/components/features/CaptureModal.tsx` lines 220-283):
  For both `items` (destination "Do" / "Inbox") and `threads` (destination "Think"), `extractMentions(item.title)` is called, and the resulting array is saved as `linked_people` in the insert statement:
  ```typescript
  // For Do / Inbox
  const mentions = extractMentions(item.title);
  const { error } = await supabase.from("items").insert({
    ...,
    linked_people: mentions,
  });

  // For Think
  const mentions = extractMentions(item.title);
  const { error } = await supabase.from("threads").insert({
    ...,
    linked_people: mentions,
  });
  ```

- **Think Space Entry Mutation Handler** (`src/app/(app)/think/[id]/page.tsx` lines 113-116, 230-285):
  - Adding entry aggregates mentions using `getLinkedPeople(updatedEntries)`:
    ```typescript
    const getLinkedPeople = (entriesList: ThreadEntry[]) => {
      const allMentions = entriesList.flatMap(e => extractMentions(e.text || ""));
      return Array.from(new Set(allMentions));
    };
    ```
  - Both `handleAddEntry` and `handleDeleteEntry` update `threads` in the database with the return value of `getLinkedPeople`:
    ```typescript
    const updatedEntries = [...(thread.entries || []), entry];
    const linkedPeople = getLinkedPeople(updatedEntries);
    const { error } = await supabase.from("threads").update({ 
      entries: updatedEntries,
      ...,
      linked_people: linkedPeople
    }).eq("id", thread.id);
    ```

- **Test Suite** (`src/lib/__tests__/challenger.test.tsx`):
  We authored a test suite verifying edge cases for `extractMentions`, `CaptureModal` integration, and `ThreadDetailPage` entry insertion/deletion logic.

---

## 2. Logic Chain

1. **ExtractMentions Behavior**:
   - For standard formats `@[Name](uuid)`, the regex extracts the identifier `uuid` successfully.
   - For special characters within brackets/parentheses, such as `@[Dr. Watson / Chief](uuid-watson.1/2)`, the character class `[^\]]+` matches the display name, and `([^)]+)` matches the identifier successfully because they don't contain boundary brackets or parentheses.
   - However, for nested bracket structures like `@[Alice [nested]](uuid)`, the regex stops matching at the first closing bracket `]`, preventing `](uuid)` from matching.
   - For nested mentions like `@[Alice @[Bob](uuid-bob)](uuid-alice)`, the first closing bracket matching Bob's mention halts the pattern, causing `extractMentions` to return only Bob's UUID `["uuid-bob"]` and completely drop Alice's UUID.
   - For empty strings or text with only `@`, the regex does not match and returns `[]` successfully.
   - For large numbers of mentions, the `/g` global modifier executes the loop for all matching instances, scaling linearly.

2. **CaptureModal & Database Insert**:
   - `CaptureModal` triggers the `@` popover when typing `@` at the start of a word or sentence.
   - Selecting a person inserts the mention formatted as `@[Name](UUID)` into the text input.
   - Confirmation calls `extractMentions(item.title)` and writes the returned array directly to the database column `linked_people` in the `items` and `threads` tables.
   - **Crucial Link**: Because the database column `linked_people` is typed as `uuid[]` in Supabase (`supabase/migrations/011_add_linked_people.sql`), PostgreSQL strictly validates that every element is a valid UUID format. If a user manually edits the mention text to contain a non-UUID ID (e.g. `@[Sarah](custom-id)`), `extractMentions` passes `["custom-id"]` directly to the insert query. PostgreSQL throws a `22P02` syntax error, crashing the write operation and preventing the item/thread from being saved.

3. **Think Space Updates**:
   - When adding a thread entry on the Think Space detail page, the text is appended, and all entries are flattened via `getLinkedPeople`.
   - When deleting an entry, the target entry is filtered out, and the remaining entries are flattened via `getLinkedPeople`.
   - `getLinkedPeople` de-duplicates entries using `new Set` and saves the resulting unique UUID array to the database `linked_people` column.
   - This ensures the aggregated unique list of mentions is kept in sync with the database record of the thread.

---

## 3. Caveats

- We did not verify database-level performance impact of GIN indexes on `linked_people` under extremely high concurrency or million-row transaction scale.
- Supabase client mock behavior is assumed to be representative of real Supabase client interaction behavior.

---

## 4. Conclusion

The Mentions parsing and UI popover behavior is functionally complete and correctly maps user selections to `linked_people` fields in both `items` and `threads` database tables. Furthermore, Think Space page entry additions and deletions correctly aggregate unique mentions and update the database.

However, the system is highly vulnerable to **database transaction crashes** if a user manually inputs a non-UUID mention ID or edits an AI-extracted mention, as PostgreSQL strictly rejects invalid UUID values for the `uuid[]` type column. Additionally, nested brackets inside display names or nested mention tags cause parsing failures.

---

## 5. Verification Method

- **Test suite execution**:
  To execute the verification suite, run the following command in the workspace:
  ```bash
  npx vitest run src/lib/__tests__/challenger.test.tsx
  ```
- **Files to Inspect**:
  - `src/lib/utils.ts` (Mentions extraction logic)
  - `src/lib/__tests__/challenger.test.tsx` (Phase 5 Challenger tests)
  - `src/components/features/CaptureModal.tsx` (Save mapping)
  - `src/app/(app)/think/[id]/page.tsx` (Think Space additions/deletions aggregation)

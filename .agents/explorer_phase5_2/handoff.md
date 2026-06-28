# Handoff Report - CaptureModal & Mentions Exploration

## 1. Observation
We observed the following files and code snippets in the workspace:

- **CaptureModal Input & Save (in `src/components/features/CaptureModal.tsx`):**
  - Line 228: Input binding: `<input ... value={input} onChange={(e) => setInput(e.target.value)} ... />`
  - Lines 89–106: `handleRoute()` sends text to `/api/capture`.
  - Lines 122–200: `handleConfirm()` saves items to Supabase tables.
    - Lines 133–143 (Do/Inbox items):
      ```typescript
      const { error } = await supabase.from("items").insert({
        user_id: user.id,
        title: item.title,
        ...
      });
      ```
    - Lines 164–170 (Think threads):
      ```typescript
      const { error } = await supabase.from("threads").insert({
        user_id: user.id,
        title: item.title.slice(0, 60),
        entries: [{ text: item.title, created_at: new Date().toISOString(), starred: false }],
      });
      ```

- **People Querying:**
  - In `src/app/(app)/remember/people/page.tsx` (Line 238):
    ```typescript
    const { data, error } = await supabase.from("people").select("*").order("sort_order", { ascending: true, nullsFirst: false });
    ```
  - In `src/app/api/capture/route.ts` (Lines 26–29):
    ```typescript
    const { data: people } = await supabase
      .from('people')
      .select('name')
      .eq('user_id', user.id);
    ```
  - No central Zustand store or React query hooks exist for fetching people.

- **Mentions Design Specification (in `.agents/orchestrator_phase5/PROJECT.md`):**
  - Database Columns (Lines 24–25):
    - `items.linked_people : uuid[] DEFAULT '{}'`
    - `threads.linked_people : uuid[] DEFAULT '{}'`
  - Mentions Schema (Line 28):
    - `Text: "hello @[Person Name](uuid) world" ➔ extracted array [uuid] to db.`

---

## 2. Logic Chain
1. **People Fetching**: Because there is no existing people store or custom react hook, the `MentionPopover` needs to execute its own direct query using the browser Supabase client to fetch the user's list of contacts (`supabase.from("people").select("id, name")`). To minimize database overhead, this query should run once when `CaptureModal` is opened/mounted.
2. **Mention Popover Triggering**: Tracking the cursor position (`selectionStart`) and checking the substring leading up to the cursor allows detecting if the user is typing a mention (e.g. text starts with `@` and does not contain spaces). If active, we render an absolute overlay positioned below the text input inside the modal.
3. **Keyboard Handling**: Overriding keyboard events (ArrowUp, ArrowDown, Enter, Escape) on the `<input>` element when `isMentioning` is true is required to navigate and select options without submitting the form or closing the modal.
4. **Inserting Mentions**: Selecting a person inserts the string format `@[Person Name](uuid)` into the text at the correct index, allowing both human-readable identification of the person and simple regex extraction of the UUID.
5. **UUID Parsing & Storage**: The UUIDs can be extracted using regex `/@\[[^\]]+\]\(([a-fA-F0-9-]{36})\)/gi`. The extraction helper can run in `handleConfirm()` for `CaptureModal.tsx` and in `handleAddEntry()` for `think/[id]/page.tsx`, and the array of UUIDs must be saved to the `linked_people` column in `items` or `threads`.

---

## 3. Caveats
- We did not examine how the UI in the `Do` task cards or `Think` entry list will format and render the Markdown-style mention tag `@[Person Name](uuid)`. It is assumed that the UI implementation step will handle rendering these as custom highlighted links or badges, or that a utility component will be introduced.

---

## 4. Conclusion
The implementation of the CaptureModal Mentions feature requires adding local mention tracking states to `CaptureModal.tsx`, fetching contacts from `people` on modal mount, building a keyboard-interactive popup absolute-positioned below the input field, formatting selected mentions as `@[Person Name](uuid)`, and extracting UUIDs via regex to save into the `linked_people` column on `items` and `threads` tables.

---

## 5. Verification Method
- **Manual verification**: 
  - Open CaptureModal, type `@` followed by a name query. Confirm the popup shows matching contacts.
  - Use keyboard Arrow keys to navigate and Enter to select. Confirm the mention is replaced by `@[Name](uuid)`.
  - Confirm the capture, then query the database `items` or `threads` table to verify the `linked_people` column is populated with the selected UUID.
- **Automated verification**:
  - Run the Vitest testing suite using `npx vitest` or similar test scripts in `src/lib/__tests__/` to run the project unit and integration tests.

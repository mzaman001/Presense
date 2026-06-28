# Phase 5 CaptureModal & Mentions Exploration Analysis

## 1. CaptureModal: Input Capture, Task Parsing, and Item Saving

### Input Capture
`src/components/features/CaptureModal.tsx` renders a modal dialog containing a text input field (line 228) bound to the local React state `input`:
```tsx
<input
  autoFocus
  type="text"
  placeholder='Capture anything... "Remind me to...", "Keys are in...", "Riyaz said..."'
  className="..."
  value={input}
  onChange={(e) => setInput(e.target.value)}
  disabled={!!routedItems || isRouting}
  onKeyDown={(e) => { if (e.key === "Enter" && !routedItems) handleRoute(); }}
/>
```
- Typing is captured in real-time.
- Pressing `Enter` triggers `handleRoute()`, which starts the routing process.

### Task Parsing (Auto-Routing)
When the user submits the input:
1. `handleRoute()` makes an HTTP `POST` request to `/api/capture` containing the input string and user settings:
   ```typescript
   const res = await fetch("/api/capture", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ text: input, settings: userSettings }),
   });
   ```
2. The route handler `src/app/api/capture/route.ts` queries the Supabase `people` table to get a list of known people:
   ```typescript
   const { data: people } = await supabase
     .from('people')
     .select('name')
     .eq('user_id', user.id);
   const knownPeople = people?.map((p) => p.name) ?? [];
   ```
3. It passes the input text and known people to `routeCapture()` in `src/lib/capture-router.ts`:
   ```typescript
   const items = routeCapture(text, knownPeople, settings || {});
   ```
4. `routeCapture` uses rule-based NLP (e.g., `compromise` and custom `chrono-node` patterns) to split the input into segments and categorize them into destinations (`Do`, `Think`, `Remember → People`, `Remember → Locations`, `Explore`, `Inbox`).
5. The result is returned as an array of `RoutedItem` objects, which populate `routedItems` in `CaptureModal.tsx` for user review.

### Saving Items
Once the user confirms the parsed items, `handleConfirm()` executes. It iterates over `routedItems` and performs insertions into the database based on `item.destination`:
- **Do** / **Inbox**: Inserts into the `items` table.
  ```typescript
  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    title: item.title,
    first_step: extras.first_step || null,
    ifthen_trigger: extras.ifthen_trigger
      ? `When ${extras.ifthen_trigger}, I will ${extras.first_step || "do this"}`
      : null,
    deadline: item.deadline ? new Date(item.deadline).toISOString() : null,
    recurrence: (item as RoutedItem & { recurrence?: string }).recurrence ?? null,
    status: item.destination === "Inbox" ? "inbox" : "active",
  });
  ```
- **Remember → People**: Queries `people` to find if the person already exists. If yes, it appends a new note to the `notes` JSONB array column; if not, it inserts a new person record.
- **Think**: Inserts a new thread into the `threads` table with the entry text inside the `entries` JSONB array column.
- **Explore**: Inserts into the `explores` table.
- **Remember → Locations**: Inserts into the `locations` table.

---

## 2. Searching and Querying People in the App

Currently, the application does not have a global state store (like Zustand) or a custom React hook specifically dedicated to querying or managing the list of people. Instead:
- **Component-Level Queries**:
  In `src/app/(app)/remember/people/page.tsx`, people are fetched directly via the Supabase client:
  ```typescript
  const fetchPeople = useCallback(async () => {
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (error) setFetchError(error.message);
    setPeople(data ?? []);
    setLoading(false);
  }, [supabase]);
  ```
- **Realtime Synchronization**:
  A generic realtime hook `useRealtime("people", fetchPeople)` in `src/hooks/useRealtime.ts` is used to re-execute `fetchPeople()` whenever Postgres changes occur in the `people` table.
- **Server Route Queries**:
  In `/api/capture/route.ts`, a quick server-side lookup queries only the `name` column of the `people` table to provide the `capture-router` with names for name-based classification.

---

## 3. Implementing the MentionPopover triggered by typing `@`

To support typing `@` to search and select people, we can build a `MentionPopover` inside `CaptureModal.tsx`.

### State Management
Add the following states to `CaptureModal.tsx`:
```typescript
const [peopleList, setPeopleList] = useState<{ id: string; name: string }[]>([]);
const [isMentioning, setIsMentioning] = useState(false);
const [mentionQuery, setMentionQuery] = useState("");
const [mentionIndex, setMentionIndex] = useState(-1); // Index of the '@' char
const [highlightedIndex, setHighlightedIndex] = useState(0);
```

### Loading People
Fetch all people once when the modal is opened, caching them in `peopleList`:
```typescript
useEffect(() => {
  if (isCaptureModalOpen) {
    const loadPeople = async () => {
      const { data } = await supabase.from("people").select("id, name");
      if (data) setPeopleList(data);
    };
    loadPeople();
  }
}, [isCaptureModalOpen, supabase]);
```

### Trigger Detection
Listen to input changes inside `onChange`:
```typescript
const handleInputChange = (val: string, selectionStart: number) => {
  setInput(val);

  // Check the text prior to the cursor to see if we are currently inside a mention
  const textBeforeCursor = val.substring(0, selectionStart);
  const lastAtSymbolIdx = textBeforeCursor.lastIndexOf("@");

  if (lastAtSymbolIdx !== -1) {
    const textAfterAt = textBeforeCursor.substring(lastAtSymbolIdx + 1);
    // Mentions end on a space or another trigger character
    if (!textAfterAt.includes(" ")) {
      setIsMentioning(true);
      setMentionQuery(textAfterAt.toLowerCase());
      setMentionIndex(lastAtSymbolIdx);
      setHighlightedIndex(0);
      return;
    }
  }
  setIsMentioning(false);
};
```

### Filtered List of Matches
```typescript
const filteredPeople = useMemo(() => {
  return peopleList.filter((p) => p.name.toLowerCase().includes(mentionQuery));
}, [peopleList, mentionQuery]);
```

### Keyboard Interactions
Intercept standard cursor keys on the `<input>` element when `isMentioning` is active:
```typescript
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (isMentioning) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredPeople.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredPeople.length) % filteredPeople.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredPeople[highlightedIndex]) {
        selectPerson(filteredPeople[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsMentioning(false);
    }
  } else if (e.key === "Enter" && !routedItems) {
    handleRoute();
  }
};
```

### Selection Handler
Replace the `@query` text with the formatted markdown mention:
```typescript
const selectPerson = (person: { id: string; name: string }) => {
  const selectionStart = inputRef.current?.selectionStart ?? input.length;
  
  const beforeMention = input.substring(0, mentionIndex);
  const mentionText = `@[${person.name}](${person.id})`;
  const afterMention = input.substring(selectionStart);
  
  const nextVal = `${beforeMention}${mentionText} ${afterMention}`;
  setInput(nextVal);
  setIsMentioning(false);
  
  // Refocus input and set cursor position after the inserted mention
  setTimeout(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      const newCursorPos = beforeMention.length + mentionText.length + 1;
      inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  }, 0);
};
```

### Layout positioning
The popover list should render directly below the input row inside the modal. The parent container has class `modal` (relative), so we can absolute-position the dropdown container:
```tsx
{isMentioning && filteredPeople.length > 0 && (
  <div className="absolute z-[100] left-5 right-5 mt-1 max-h-48 overflow-y-auto border border-[var(--color-border)] bg-[#111111] shadow-2xl rounded-xl p-2 [color-scheme:dark]">
    {filteredPeople.map((person, idx) => (
      <div
        key={person.id}
        onClick={() => selectPerson(person)}
        className={cn(
          "px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors",
          idx === highlightedIndex ? "bg-[var(--color-accent)] text-black font-semibold" : "text-[var(--color-text-1)] hover:bg-[var(--color-surface)]"
        )}
      >
        {person.name}
      </div>
    ))}
  </div>
)}
```

---

## 4. Parsing and Saving the `linked_people` UUID Array

### Mentions Schema
Mentions in input text will be formatted as: `@[Person Name](uuid)`.
To save database space and query cleanly without syncing entire texts, we parse this string, extract the UUIDs, and write them into the new `linked_people` (`uuid[]`) array column.

### Helper: Extracting UUIDs
Define a helper function to extract all UUIDs matching the mention syntax:
```typescript
export function extractLinkedPeople(text: string): string[] {
  if (!text) return [];
  // Regex matches @[Name](uuid) and captures the UUID (group 2)
  const matches = [...text.matchAll(/@\[[^\]]+\]\(([a-f0-9-]{36})\)/gi)];
  return matches.map((m) => m[1]);
}
```

### Database Target Fields & Logic

#### 1. Saving from `CaptureModal.tsx`
Inside `handleConfirm()`, extract the UUIDs before writing to the database:
- **Tasks (`items` table)**:
  Extract mentions from `item.title` and include them in the `insert` query:
  ```typescript
  const linkedPeople = extractLinkedPeople(item.title);
  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    title: item.title,
    // ... other fields
    linked_people: linkedPeople, // Save the uuid[]
  });
  ```
- **Threads (`threads` table)**:
  Extract mentions from the initial thread text (`item.title`) and save:
  ```typescript
  const linkedPeople = extractLinkedPeople(item.title);
  const { error } = await supabase.from("threads").insert({
    user_id: user.id,
    title: item.title.slice(0, 60),
    entries: [{ text: item.title, created_at: new Date().toISOString(), starred: false }],
    linked_people: linkedPeople, // Save the uuid[]
  });
  ```

#### 2. Saving from the Think Editor (`src/app/(app)/think/[id]/page.tsx`)
In the Thread Detail view, when the user appends a new entry to the thread:
1. Extract any mentioned UUIDs from the new entry text.
2. Read the thread's existing `linked_people` UUID array.
3. Merge the new UUIDs with the existing ones (ensuring duplicates are removed).
4. Update the thread in the database.

Example implementation in `handleAddEntry` inside `[id]/page.tsx`:
```typescript
const newEntryLinkedPeople = extractLinkedPeople(newEntry.trim());
const currentLinkedPeople = thread.linked_people || [];
// Merge and deduplicate
const updatedLinkedPeople = Array.from(new Set([...currentLinkedPeople, ...newEntryLinkedPeople]));

const { error } = await supabase.from("threads").update({
  entries: updatedEntries,
  last_updated: new Date().toISOString(),
  linked_people: updatedLinkedPeople,
}).eq("id", thread.id);
```

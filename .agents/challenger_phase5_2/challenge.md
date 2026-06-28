# Challenge Report — Mentions Parsing and UI Popover Behavior

## Challenge Summary

**Overall risk assessment**: HIGH

This report documents the empirical review and stress-testing of the Mentions parsing utility (`extractMentions`), UI popover behavior in `CaptureModal` and `ThreadDetailPage`, and database mapping to the `linked_people` array in Supabase.

While the primary happy paths for autocomplete, selection, and insertion work correctly, several critical edge cases and architectural assumptions present failure modes, including database-level insert failures due to invalid UUID formats in user-edited mentions.

---

## Challenges

### [High] Challenge 1: Database Write Failure via Invalid UUID Mentions
- **Assumption challenged**: Mentions parsed from input strings are assumed to always contain valid UUIDs, or the database operations are assumed to degrade gracefully if a non-UUID string is passed.
- **Attack scenario**: 
  - A user types a manual mention like `@[John Doe](custom-john)` or edits an AI-extracted mention in the CaptureModal text input to change the UUID to a friendly string (e.g. `@[Alice](alice-uuid)`).
  - `extractMentions` parses and returns `["custom-john"]` or `["alice-uuid"]`.
  - The application attempts to insert or update the record in the `items` or `threads` table with `linked_people: ["custom-john"]`.
  - Since the `linked_people` column in both tables is typed as `uuid[]`, PostgreSQL throws a `22P02: invalid input syntax for type uuid` database error.
  - The entire database transaction/insert fails, and the user receives a "Failed to save capture" toast.
- **Blast radius**: High. Users can experience random capture or thread saving failures if they type/edit mentions manually, leading to data loss in that session.
- **Mitigation**: Update `extractMentions` (or validate its outputs before database calls) using a regex or validator function that ensures each extracted string matches the UUID format (8-4-4-4-12 hexadecimal structure) before adding it to the `linked_people` array. Filter out non-UUID matches:
  ```typescript
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validUUIDs = mentions.filter(id => UUID_REGEX.test(id));
  ```

### [Medium] Challenge 2: Parsing Failure on Nested Brackets
- **Assumption challenged**: The regex `/ @\[ [^\]]+ \] \(([^)]+)\) /g` assumes that display names and mention contexts never contain nested brackets.
- **Attack scenario**:
  1. **Nested brackets in display name**: A user enters `@[Alice [nested]](uuid-alice)`. The regex `[^\]]+` stops matching at the first closing bracket `]`, failing to match `](uuid-alice)` completely. It extracts `[]` (nothing).
  2. **Nested mentions**: A user pastes or structures text like `@[Alice @[Bob](uuid-bob)](uuid-alice)`. The regex stops at Bob's closing bracket, extracting `["uuid-bob"]` but completely discarding Alice's outer mention `uuid-alice`.
- **Blast radius**: Medium. Incorrect or missing associations for complex names/hierarchical mentions.
- **Mitigation**: Implement a parser that handles nested delimiters (such as using a stack to find matching pairs of brackets and parentheses) rather than relying purely on a simple regular expression.

### [Low] Challenge 3: UI Popover Search Disruption via Spaces
- **Assumption challenged**: Users only type single words or search queries without spaces when looking up people via the `@` popover.
- **Attack scenario**:
  - A user types `@Alice Smith` in the input field.
  - As soon as the user presses the Space key after `@Alice`, the check `!search.includes(" ")` evaluates to false, immediately closing the popover UI.
  - The user cannot type a multi-word search query to filter down to a specific person with a common name prefix unless they interact with the popover before hitting space.
- **Blast radius**: Low. Degraded user experience in teams with multiple members sharing first names.
- **Mitigation**: Support space characters within the popover query but restrict search completion until selection, or limit searches to the last N characters after the `@` symbol.

---

## Stress Test Results

| Scenario | Expected Behavior | Actual/Predicted Behavior | Pass/Fail |
|---|---|---|---|
| **Empty string input** | Return `[]` | Returns `[]` | **PASS** |
| **Text with only `@`** | Return `[]` | Returns `[]` | **PASS** |
| **Special characters in brackets** | `@[Dr. Watson / Chief](uuid)` -> `["uuid"]` | Returns `["uuid"]` | **PASS** |
| **Special characters in UUID** | `@[Alice](uuid/1)`, `@[Bob](uuid.2)` -> `["uuid/1", "uuid.2"]` | Returns `["uuid/1", "uuid.2"]` | **PASS** |
| **Large number of mentions (120)** | Parse and return all 120 UUIDs | Returns all 120 UUIDs | **PASS** |
| **Nested brackets in name** | `@[Alice [nested]](uuid)` -> `["uuid"]` | Returns `[]` | **FAIL** |
| **Nested mentions** | `@[Alice @[Bob](uuid-bob)](uuid-alice)` -> `["uuid-alice", "uuid-bob"]` | Returns `["uuid-bob"]` | **FAIL** |
| **Type "@" inside input** | Render popover with people | Renders popover with people | **PASS** |
| **Select person from popover** | Insert mention string `@[Name](UUID)` | Inserts `@[Name](UUID)` | **PASS** |
| **Confirm save in CaptureModal** | Insert into `items`/`threads` with `linked_people` array | Inserts with correct `linked_people` array | **PASS** |
| **Add thread entry (Think)** | Update thread, merge new mentions, save as unique array | Updates unique aggregated array in DB | **PASS** |
| **Delete thread entry (Think)** | Update thread, remove deleted mentions, save as unique array | Updates unique aggregated array in DB | **PASS** |

---

## Unchallenged Areas

- **Supabase Realtime Synchronization Latency**: The actual delay of Supabase realtime channel updates for multi-user scenarios was not tested under high network load due to testing in a mock database environment.

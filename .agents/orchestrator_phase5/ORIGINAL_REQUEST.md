# Original User Request

## 2026-06-28T11:35:52Z

Implement Next.js Edge Auth Middleware to protect application routes, and build a blazing-fast Cross-Linking & Mentions feature utilizing a PostgreSQL UUID array schema to avoid realtime sync bloat.

### Requirements

#### R1. Edge Auth Middleware
Create a `middleware.ts` file using `@supabase/ssr` that protects all `/(app)` routes. Unauthenticated users should be instantly redirected to `/login`, and authenticated users attempting to access `/login` should be redirected to `/`.

#### R2. Database Migration for UUID Arrays
Create a Supabase migration to add `linked_people` (array of UUIDs) to the `items` and `threads` tables. This avoids the overhead of junction tables while allowing fast querying.

#### R3. Mention UI and Parsing
Implement a `MentionPopover` that triggers when typing `@` inside the `CaptureModal` and `Think` editors. When a person is selected, it should insert a visual tag. Upon saving, extract these tags into the `linked_people` UUID array in the database.

### Acceptance Criteria

#### Security (Middleware)
- [ ] Programmatic script or test proves that unauthenticated requests to `/` yield a 307 redirect to `/login`.
- [ ] Programmatic script or test proves that authenticated requests to `/login` yield a 307 redirect to `/`.

#### Cross-Linking (Database & UI)
- [ ] `supabase db lint` passes, and a script verifies that `linked_people` column exists as `UUID[]` on both `items` and `threads` tables.
- [ ] The Mention UI can successfully insert a linked UUID array payload when capturing a test task.

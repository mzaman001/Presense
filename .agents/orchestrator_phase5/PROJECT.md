# Project: Presense Phase 5 (Edge Auth & UUID Cross-Linking)

## Architecture
- **Authentication**: Next.js Edge Auth Middleware protecting `/(app)` routes. Unauthenticated redirects to `/login`, authenticated attempting `/login` redirects to `/`.
- **Database schemas**: Supabase tables `items` and `threads` with new column `linked_people` (uuid[]).
- **UI & Layout**: `MentionPopover` triggers on `@` keypress in `CaptureModal` and `Think` editors (`src/app/(app)/think/[id]/page.tsx` and `src/components/features/CaptureModal.tsx`).
- **Interactions**: Extracts `@` mentions and saves them as UUIDs in `linked_people` database array.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E and Security Testing Infrastructure | Design E2E test plan & setup mock/assertion environment | None | DONE |
| 2 | Edge Auth Middleware | Create `middleware.ts` with route protection using `@supabase/ssr` | None | DONE |
| 3 | Database Migration | Add `linked_people` (uuid[]) to `items` and `threads` tables | None | DONE |
| 4 | Mention UI & Parsing | Add `MentionPopover` and extraction logic in `CaptureModal` and `Think` editors | M3 | DONE |
| 5 | Dual Track Final Verification | Pass E2E test suite & perform forensic integrity audit | M1, M2, M3, M4 | DONE |

## Interface Contracts
### Middleware Redirects
- `/` or `/do` or `/think` or other `/(app)` routes (unauthenticated) ➔ 307 Redirect to `/login`
- `/login` (authenticated) ➔ 307 Redirect to `/`

### Database Columns
- `items.linked_people` : uuid[] DEFAULT '{}'
- `threads.linked_people` : uuid[] DEFAULT '{}'

### Mentions Schema
- Text: `"hello @[Person Name](uuid) world"` ➔ extracted array `[uuid]` to db.

## Code Layout
- `src/middleware.ts` (new)
- `supabase/migrations/011_add_linked_people.sql` (new)
- `src/components/features/CaptureModal.tsx` (edit)
- `src/app/(app)/think/[id]/page.tsx` (edit)

# Phase 5 E2E Testing Track - Ready for Execution

This document details the test suite verifying Next.js Edge Auth Middleware (Proxy) routing, database migrations, and Mentions extraction UI logic.

## Test Runner Command

To run the test suite:

```bash
npm run test
```

To run only the newly created Phase 5 tests:

```bash
# Run middleware test
npx vitest run src/lib/__tests__/middleware.test.ts

# Run mentions test
npx vitest run src/lib/__tests__/mentions.test.tsx
```

---

## E2E Testing Track Tiers

Our testing architecture is structured into four distinct verification tiers to ensure comprehensive validation from core logic up to real-world integration.

### Tier 1: Feature Coverage
Focuses on the verification of individual features, components, and unit functions in isolation.
- **Auth Middleware Redirects**: Validates that unauthenticated requests to `/` or protected routes are correctly redirected to `/login` with a `307` temporary redirect, and that authenticated requests accessing `/login` are redirected to `/`.
- **Mentions Parsing**: Validates that the `extractMentions` helper successfully parses text for mentions formatted as `@[Person Name](uuid)` and returns the list of UUIDs.

### Tier 2: Boundary
Focuses on validation of input limits, empty states, and invalid/malformed request scenarios.
- **Parsing Edge Cases**: Validates `extractMentions` behavior when dealing with no mentions, malformed formats (e.g. missing brackets or parentheses), multiple consecutive mentions, or names with special characters (e.g., hyphens, periods).
- **Middleware Path Routing Boundaries**: Validates that middleware respects route configurations (like matcher boundaries) and handles edge-case paths correctly.

### Tier 3: Cross-Feature
Tests integrations and data/state flow across different features of the application.
- **Mentions Popover Interaction**: Verifies that user interaction in the input field (typing `@`) queries/triggers rendering of the popover selection list, and clicking a person inserts the mention metadata into the input field value.
- **Supabase Authentication State Integration**: Verifies that the Edge Auth Middleware correctly interacts with `@supabase/ssr`'s `createServerClient` context to retrieve session tokens from cookies.

### Tier 4: Real-World
Simulates user behavior in end-to-end scenarios, including state transitions and database synchronization.
- **E2E Auth & Mentions Flow**: Validates the end-to-end journey of a user: logging in, redirected from `/login` to `/` (authenticated), opening a capture modal or input field, typing a message with `@` mention to pull up team members, selecting a teammate, saving the note, and ensuring database tables (like `people` or `items`) reflect the mentions mapping.

## 2026-06-28T11:40:48Z

You are the E2E Testing Track Worker for Phase 5.
Your task is to write and configure the test suite verifying Next.js Edge Auth Middleware routing, database migrations, and Mentions extraction UI logic.

Instructions:
1. Create a test file `src/lib/__tests__/middleware.test.ts` (using Vitest) that tests the redirect behavior of our middleware. Mock `NextRequest`, `NextResponse`, and `@supabase/ssr`'s `createServerClient`.
   - Test that unauthenticated requests to `/` or protected paths yield a 307 redirect to `/login`.
   - Test that authenticated requests to `/login` yield a 307 redirect to `/` or `/do`.
2. Create a test file `src/lib/__tests__/mentions.test.tsx` (using Vitest and React Testing Library) to test the mentions popover trigger and parsing:
   - Test a utility function `extractMentions(text: string): string[]` that matches `@[Person Name](uuid)` and returns the UUID array.
   - Test that typing `@` in an input field renders the popover list of people.
3. Write a `TEST_READY.md` file at the project root `C:\Users\muhdz\.gemini\antigravity\scratch\presense\TEST_READY.md` containing the test runner command (`npm run test`) and a summary of the test tiers (Tier 1: Feature Coverage, Tier 2: Boundary, Tier 3: Cross-Feature, Tier 4: Real-World) as described in the E2E Testing Track.
4. Run `npm run test` to verify that the tests are recognized and executed by Vitest. Note that the implementation does not exist yet, so the tests might fail (or mock tests might pass if you mock them, but the objective is to have the tests ready to be run against the implementation).
Your working directory is `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_testing_phase5`. Write a handoff report when complete.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

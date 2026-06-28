## 2026-06-28T06:37:31Z
You are the Robustness Fix Worker for Phase 5.
Your task is to implement the following robustness improvements:

1. **UUID Validation in Mentions Extraction**:
   - In `src/lib/utils.ts`, update `extractMentions(text: string): string[]` to validate that each extracted ID is a valid UUID before adding it to the returned matches array.
   - Use this regex for UUID validation: `/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/`.
   - This prevents database crashes (PostgreSQL syntax error 22P02) if a user types or edits a custom non-UUID mention ID.
2. **Middleware Robustness**:
   - In `src/middleware.ts`, wrap the `supabase.auth.getUser()` invocation and subsequent redirection checks in a try-catch block.
   - In case of an unexpected exception inside the middleware, catch it, log it, and default to returning the original response or redirecting the user to `/login` to ensure the application does not hard crash (HTTP 500).
   - Make the auth route check case-insensitive by checking `request.nextUrl.pathname.toLowerCase().startsWith('/login')` or similar.
3. **Verify**:
   - Run the Vitest test runner: `npx vitest run src/lib/__tests__/middleware.test.ts src/lib/__tests__/mentions.test.tsx`
   - Run the production build command: `npm run build`
   - Ensure all tests pass and there are no compilation errors.

Your working directory is `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_robustness_phase5`. Write a handoff report when complete.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

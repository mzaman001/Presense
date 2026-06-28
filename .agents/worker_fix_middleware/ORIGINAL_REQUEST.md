## 2026-06-28T12:00:15Z
You are the Implementation Worker (Fix Track) for Phase 5.
Your task is to fix a critical session cookie-loss bug in `src/middleware.ts` identified by the reviewer.

Instructions:
1. Edit `src/middleware.ts` to ensure that cookies are copied from `supabaseResponse` to the new `NextResponse.redirect` object before returning it on redirects.
   - For both the unauthenticated redirect (to `/login`) and authenticated redirect (to `/`), retrieve all cookies from `supabaseResponse.cookies.getAll()` and set them on the redirect response object.
2. Ensure that `src/middleware.ts` still exports both `middleware` and `proxy` functions.
3. Run the Vitest test runner command to verify that all middleware and mentions tests pass:
   ```bash
   npx vitest run src/lib/__tests__/middleware.test.ts src/lib/__tests__/mentions.test.tsx
   ```
4. Verify that `npm run build` completes successfully without any compilation errors.
Your working directory is `C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_fix_middleware`. Write a handoff report when complete.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

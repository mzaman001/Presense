## 2026-06-22T02:38:37Z
You are 'worker_fix_tests_retry'. Your working directory is C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_fix_tests_retry.
Your task is to fix the test suite compilation and assertion errors:

1. **Missing Dependency**:
   - Install the missing dependency `@testing-library/dom` by running:
     `npm install --save-dev @testing-library/dom`
   - Verify that it is correctly added to `package.json` under `devDependencies`.

2. **Test Logic Fixes**:
   - In `src/lib/__tests__/phase3.test.tsx`:
     - Around line 285, change the expected class name check for avatars from:
       `expect(avatar).toHaveClass("border-[var(--color-bg-elevated)]");`
       to:
       `expect(avatar).toHaveClass("border-[var(--color-background)]");`
     - Around line 304, change the prefetched threads mock from setting the window property:
       `(window as any).prefetchedThreads = [prefetchedThread];`
       to setting the Zustand store state:
       `useAppStore.setState({ prefetchedThreads: { [prefetchedThread.id]: prefetchedThread } });`
     - Around line 344, change the color picker test assertion from:
       `const colorButton = screen.getByRole("button", { name: "" });`
       `expect(colorButton).toBeInTheDocument();`
       to:
       `const colorButton = container.querySelector("button[style*='background-color']");`
       `expect(colorButton).toBeInTheDocument();`

3. **Verify Tests**:
   - Run the Vitest test command to verify that all tests compile and pass successfully:
     `npm test src/lib/__tests__/phase3.test.tsx`
   - Capture the output and verify that it reports 100% tests passing.

4. **Handoff**:
   - Create a handoff report at C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_fix_tests_retry\handoff.md with verification results.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. Do not hardcode test results, create dummy/facade implementations, or circumvent the intended task. Integrity violations will be detected by a Forensic Auditor.

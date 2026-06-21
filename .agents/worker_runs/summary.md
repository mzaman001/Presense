# Diagnostic Results Summary

This document summarizes the diagnostics run on `C:\Users\muhdz\.gemini\antigravity\scratch\presense` on June 21, 2026.

## Command Status Matrix

| Diagnostic Check | Command | Exit Code | Result | Error Count | Warning/Vulnerability Count |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Static Analysis** | `npm run lint` | `1` | Failed | 80 errors | 33 warnings |
| **TypeScript** | `npx tsc --noEmit` | `0` | Success | 0 errors | 0 warnings |
| **Security Audit** | `npm audit` | `1` | Failed | 0 high/critical | 2 moderate vulnerabilities |
| **Test Runner** | `npm run test` | `0` | Success | 0 failures | 0 warnings (28 tests passed) |

---

## Key Findings & Main Issues

### 1. Static Analysis (ESLint)
* **Total Problems:** 113 issues (80 errors, 33 warnings).
* **Main Violations:**
  * **React Hook Effects (`react-hooks/set-state-in-effect`):** Numerous errors across UI components and pages where state variables are updated synchronously inside a `useEffect` callback block. This causes performance-degrading cascading renders. Affected files include:
    * `src/app/(app)/do/page.tsx`
    * `src/app/(app)/explore/[id]/page.tsx`
    * `src/app/(app)/explore/page.tsx`
    * `src/app/(app)/explore/trash/page.tsx`
    * `src/app/(app)/remember/locations/page.tsx`
    * `src/app/(app)/remember/people/[id]/page.tsx`
    * `src/app/(app)/remember/people/page.tsx`
    * `src/app/(app)/think/[id]/page.tsx`
    * `src/app/(auth)/login/page.tsx`
    * `src/app/onboarding/OnboardingWizard.tsx`
    * `src/components/features/AddPersonPanel.tsx`
    * `src/components/features/ExploreDrawer.tsx`
    * `src/components/features/LocationAddPanel.tsx`
    * `src/components/features/SearchModal.tsx`
    * `src/components/layout/AmbientBackground.tsx`
    * `src/components/ui/ContextualTip.tsx`
  * **TypeScript Explicit Any (`@typescript-eslint/no-explicit-any`):** Many errors due to usage of `any` types.
  * **Component Purity (`react-hooks/purity`):** Impure function call `Date.now()` within the render phase of `timeAgo` function in `src/app/(app)/explore/page.tsx`.
  * **Require Imports (`@typescript-eslint/no-require-imports`):** CommonJS `require()` syntax used in setup/admin scripts under `scripts/`.
  * **Unescaped Quotes (`react/no-unescaped-entities`):** Unescaped `'` and `"` quotes in component files.
  * **Unused Variables (`@typescript-eslint/no-unused-vars`):** Various unused imports and variables across files.

### 2. TypeScript Compilation Check
* No type errors found. The compilation passes successfully.

### 3. Security Audit
* ** postcss < 8.5.10:** Moderate severity XSS vulnerability via unescaped `</style>` in CSS Stringify Output.
* **next:** Dependent on vulnerable versions of `postcss`.
* **Remediation:** Fix is available via `npm audit fix --force`, which would install `next@9.3.3` (which is a breaking change for Next.js 16). Alternatively, update postcss to >= 8.5.10 if compatible.

### 4. Tests
* **Files:** 1 test file (`src/lib/__tests__/capture-router.test.ts`)
* **Tests:** 28 tests passed successfully.

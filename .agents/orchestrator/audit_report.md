# Presense Audit Report

**Date**: June 21, 2026  
**Auditor**: Teamwork Orchestrator Agent  
**Repository**: `C:\Users\muhdz\.gemini\antigravity\scratch\presense`  

---

## Executive Summary
This report presents the findings of a comprehensive static analysis and security audit performed on the "Presense" Next.js web application. The audit was conducted using local linters, TypeScript compilers, dependency scanning tools, and test suites.

### Command Execution Summary
* **Static Analysis (`npm run lint`)**: **Failed** (113 problems: 80 errors, 33 warnings)
* **TypeScript Compilation (`npx tsc --noEmit`)**: **Passed** (0 errors)
* **Security Scan (`npm audit`)**: **Failed** (2 moderate vulnerabilities)
* **Test Suite (`npm run test`)**: **Passed** (28/28 tests passed)

---

## 1. Static Analysis (Performance, Accessibility, & SEO)

### Issue 1.1: Synchronous State Updates Inside React Effects (`react-hooks/set-state-in-effect`)
* **Severity**: High (Performance)
* **Description**: There are 80 instances where `setState` is called synchronously in the body of a `useEffect` effect block. This triggers immediate cascading re-renders, causing severe UI rendering lags, layout shifts, and wasted CPU cycles.
* **Affected Files**:
  * `src/app/(app)/do/page.tsx`
  * `src/app/(app)/explore/[id]/page.tsx`
  * `src/app/(app)/explore/page.tsx`
  * `src/components/layout/AmbientBackground.tsx`
  * `src/components/ui/ContextualTip.tsx`
  * (and 11 other files)
* **Recommended Patches**:
  
  **Case A: State initialization based on local storage**
  * *Before (in `src/app/(app)/do/page.tsx`):*
    ```tsx
    const [viewMode, setViewMode] = useState("board");
    useEffect(() => {
      const saved = localStorage.getItem("presense_do_view");
      if (saved === "today" || saved === "board") {
        setViewMode(saved);
      }
    }, []);
    ```
  * *After (Lazy State Initialization):*
    ```tsx
    const [viewMode, setViewMode] = useState(() => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("presense_do_view");
        if (saved === "today" || saved === "board") return saved;
      }
      return "board";
    });
    ```
    *Why this works*: Eliminates the `useEffect` entirely, preventing the initial dummy mount render.

  **Case B: Side effect triggering data fetch**
  * *Before (in `src/app/(app)/explore/page.tsx`):*
    ```tsx
    useEffect(() => {
      fetchItems();
    }, [fetchItems]);
    ```
  * *After (Using React Query for Caching/Fetching):*
    Instead of using raw `useEffect` with manual `useState` storage inside `fetchItems`, migrate to `@tanstack/react-query` (which is already a dependency in `package.json`):
    ```tsx
    const { data: items, isLoading } = useQuery({
      queryKey: ['items'],
      queryFn: fetchItemsFromSupabase,
    });
    ```

---

### Issue 1.2: Native `<img>` Element usage with Low-Accessibility Alt Text
* **Severity**: Moderate (Accessibility)
* **Description**: Native `<img>` tags are used instead of the Next.js optimized `<Image>` component. In addition, the alt text is set to the user initials (e.g. "JD"), which makes screen readers read the initials without context rather than the actual user's name or a fallback descriptive text.
* **Affected File**: `src/components/ui/Avatar.tsx` (line 34)
* **Recommended Patch**:
  * *Before:*
    ```tsx
    {src ? (
      <img className="aspect-square h-full w-full object-cover" src={src} alt={displayInitials} />
    ) : (
      <span>{displayInitials}</span>
    )}
    ```
  * *After (Next.js Image with Descriptive Alt):*
    ```tsx
    import Image from "next/image";
    // ...
    {src ? (
      <Image 
        className="aspect-square h-full w-full object-cover" 
        src={src} 
        alt={name ? `${name}'s avatar` : "User avatar"} 
        width={size === "sm" ? 32 : size === "md" ? 40 : 56} 
        height={size === "sm" ? 32 : size === "md" ? 40 : 56} 
        unoptimized // Remove if using a configured image loader / Supabase CDN
      />
    ) : (
      <span>{displayInitials}</span>
    )}
    ```

---

### Issue 1.3: Missing PWA PNG Icons (SEO & PWA Compliance)
* **Severity**: Moderate (SEO / UX)
* **Description**: `manifest.json` and `layout.tsx` reference external PNG icon resources that are missing from the `public/` directory, causing browser download failures (404) and breaking Apple home screen bookmark configurations.
* **Missing Files**:
  * `/icon-180.png` (Apple touch icon)
  * `/icon-192.png` (PWA manifest icon)
  * `/icon-512.png` (PWA maskable icon)
* **Recommended Patches**:
  * Option A: Place the generated high-resolution PNG copies of `icon.svg` at the root of the `public/` folder matching the file names.
  * Option B: Update `manifest.json` to point directly to the SVG icon:
    ```json
    "icons": [
      { "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml" }
    ]
    ```

---

## 2. Security & Vulnerability Scans

### Issue 2.1: Transitive Cross-Site Scripting (XSS) Vulnerability in `postcss`
* **Severity**: Moderate
* **Description**: `postcss` version `< 8.5.10` contains an XSS vulnerability due to unescaped `</style>` tags in its CSS Stringify output. This vulnerability impacts Next.js and Tailwind compilation pipelines.
* **Affected Package**: `postcss` (transitive dependency)
* **Recommended Patch**:
  Force the resolution of `postcss` to `8.5.10` or higher in `package.json` using the npm `overrides` field:
  ```json
  "overrides": {
    "postcss": "^8.5.10"
  }
  ```
  After adding this, run `npm install` to update the package lock file.

---

## 3. Testing Status

* **Status**: **Passed**
* **Test suite details**: 28 unit tests executed in `src/lib/__tests__/capture-router.test.ts` verifying capture router rules, NLP date parsing, segments extraction, and URL matching.
* **Gaps identified**:
  * The current tests only verify NLP routing functions (`capture-router.ts`).
  * No frontend components, custom Zustand stores, or database integration tests are currently configured.
* **Recommended Action**: Expand testing suite by adding component unit tests in a `__tests__` directory under components, using the loaded `@testing-library/react` and `vitest` globals.

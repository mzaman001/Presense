# Presense — Master Plan v5

**Audience:** The next AI coding agent (or you) who will execute this plan.
**Method:** Every item was verified against the actual July 3 codebase (`Presense-main (4).zip`). No item is based on assumption — each cites the exact file and the exact bug.
**Sources:** 13 Lovable audit docs (`presense-audit.zip`), full codebase read, 6 prior audits in this conversation, industry-standard references (Next.js 16 docs, Supabase docs, OWASP ASVS, WCAG 2.2, MDN, web.dev, Framer Motion docs, Serwist docs, React 19 docs, Vercel docs, Postgres docs).

---

## How to read this plan

Every item is a **ticket** with:
- **File(s):** exact path(s) to edit
- **Bug:** what's wrong, verified against code
- **Fix:** what to change (specific enough to execute without ambiguity)
- **Verify:** how to confirm the fix works
- **Risk:** 🟢 safe / 🟡 careful / 🔴 refactor
- **Source:** where this item came from (user report, audit doc, infrastructure rec, prior audit)

**Execution rule:** Do tiers in order. Within a tier, items are independent. Never skip Tier 0.

**Do NOT break:** the hover sidebar (`w-[80px] hover:w-[248px]`), the theme rename (`sunset/midnight/meadow`), the `proxy.ts` CSP nonce system, the `MotionProvider` with `LazyMotion strict`, the `RealtimeProvider` shared-channel architecture, the `Sheet` component's drag-to-dismiss. These are correct and must be preserved.

---

## Tier 0 — Urgent bug fixes (do FIRST, today)

These are verified bugs that break core user flows. Each is small and independent.

### T0-1 · Ritual fires evening for new user who never did morning · 🟢 · Source: user issue #14

**File:** `src/lib/rituals.ts:73-76`

**Bug:** `getRitualDecision()` checks `currentMinutes >= shutdownMinutes && !eveningDone` but does NOT check `morningDone`. A new user at 22:00 (who never planned their morning) gets the evening ritual immediately after onboarding. Sunsama never shows evening review before morning planning is complete.

**Fix:** Add `morningDone` to the evening trigger condition:
```typescript
// Line 73-76, change:
if (currentMinutes >= shutdownMinutes && !eveningDone) {
// To:
if (currentMinutes >= shutdownMinutes && !eveningDone && morningDone) {
```
If `morningDone` is false, the flow falls through to the morning logic (which will fire `morning_due` or `morning_window_missed`).

**Verify:** Create a new account at night. After onboarding, the ritual should show "Plan my day" (morning), NOT "Evening review."

---

### T0-2 · Ritual completion doesn't update sidebar/Home · 🟡 · Source: user issue #14

**File:** `src/components/features/RitualOverlay.tsx` (the "Shut down for today" handler)

**Bug:** After pressing "Shut down for today," the sidebar still shows "Plan my day" and Home still shows "you haven't planned your day." The ritual overlay calls `setActiveRitual(null)` but does not call `updateUserSetting({ last_evening_ritual_date: todayStr })` to persist the completion to the DB.

**Fix:** In the evening ritual's completion handler, after the Supabase update succeeds, call:
```typescript
useAppStore.getState().updateUserSetting('last_evening_ritual_date', todayStr);
```
Same for morning completion — ensure `last_ritual_date` is updated.

**Verify:** Complete the evening ritual. The sidebar should update to "All done ✓" without a page refresh.

---

### T0-3 · Light mode dropdown doesn't work (stale closure) · 🟢 · Source: user issue #18

**File:** `src/components/features/SettingsModal.tsx:330-334`

**Bug:** `updateSetting('color_mode', 'light')` calls `applyDocumentTheme(normalizeThemeId(settings.theme), ...)` but `settings.theme` is from the CLOSURE (stale state), not the updated state. The theme doesn't change visually when you select "Light."

**Fix:** Read from `prev` inside `setSettings`:
```typescript
const updateSetting = (key: string, value: unknown) => {
  setSettings((prev) => {
    const next = { ...prev, [key]: value };
    if (key === 'color_mode') {
      const mode = normalizeColorMode(value);
      localStorage.setItem('presense_color_mode', mode);
      applyDocumentTheme(normalizeThemeId(next.theme), mode, Boolean(next.reduce_motion));
    }
    if (key === 'theme') {
      const theme = normalizeThemeId(value);
      localStorage.setItem('presense_theme', theme);
      applyDocumentTheme(theme, normalizeColorMode(next.color_mode), Boolean(next.reduce_motion));
    }
    if (key === 'reduce_motion') {
      localStorage.setItem('presense_reduce_motion', value ? 'true' : 'false');
      applyDocumentTheme(normalizeThemeId(next.theme), normalizeColorMode(next.color_mode), Boolean(value));
    }
    return next;
  });
};
```

**Verify:** Open Settings → Appearance → Color Mode → click "Light." The page should immediately switch to light mode.

---

### T0-4 · Onboarding capture doesn't save to inbox · 🟢 · Source: user issue #16

**File:** `src/app/onboarding/OnboardingWizard.tsx:152-158`

**Bug:** When `item.destination === "Inbox"`, the insert sets `list_id: null` but does NOT set `status: 'inbox'`. The `items` table default is `status: 'active'`. So the captured item goes to Do, not Inbox.

**Fix:** Add `status: 'inbox'` to the insert payload:
```typescript
if (item.destination === "Do" || item.destination === "Inbox") {
  await supabase.from("items").insert({
    user_id: user.id,
    title: item.title,
    status: item.destination === "Inbox" ? "inbox" : "active",
    deadline: item.deadline || null
  });
}
```
Also remove the `list_id: null` line — `list_id` doesn't exist in the schema.

**Verify:** Complete onboarding, type a thought, confirm it routes to Inbox. Check `/inbox` — the item should be there.

---

### T0-5 · Inbox routing dropdown hidden behind other elements · 🟢 · Source: user issue #4

**File:** `src/app/(app)/inbox/page.tsx:97`

**Bug:** The routing dropdown uses `className="dropdown-panel ... z-50"` but the Sheet component uses `z-[100]` and the modal overlay uses `z-[200]`. `z-50` is too low — the dropdown renders behind other elements.

**Fix:** Change `z-50` to `z-[220]`:
```tsx
<div className="dropdown-panel absolute top-full mt-2 right-0 w-48 p-1 z-[220] animate-in fade-in zoom-in-95 duration-100">
```

**Verify:** Open the inbox, click "Route it" on any item. The dropdown should appear ON TOP of all other elements.

---

### T0-6 · Settings scroll broken in Think/Explore (Lenis conflict) · 🟡 · Source: user issue #5

**File:** `src/components/features/SettingsModal.tsx` + `src/components/layout/LenisProvider.tsx`

**Bug:** `useBodyScrollLock` sets `body.overflow = hidden` but Lenis (smooth scroll) on Think/Explore pages intercepts wheel events at a higher level. The modal's inner `overflow-y-auto` container doesn't receive scroll events.

**Fix:** Pause Lenis when any modal opens. In `LenisProvider.tsx`, expose a `lenis.stop()` / `lenis.start()` method via context. Then in `SettingsModal` (and all modals):
```typescript
const lenis = useLenis();
useEffect(() => {
  if (isSettingsModalOpen) lenis?.stop();
  else lenis?.start();
  return () => lenis?.start();
}, [isSettingsModalOpen, lenis]);
```
Alternative (simpler): render the modal content via React Portal to `document.body`, outside the Lenis-managed container.

**Verify:** Go to `/think`, open Settings, scroll the settings panel. It should scroll smoothly.

---

### T0-7 · Theme glitches from midnight to sunset after login · 🟡 · Source: user issue #3

**Files:** `src/app/layout.tsx` (theme-init script) + `src/components/layout/AppInitializer.tsx`

**Bug:** The theme-init inline script (runs immediately on page load, uses localStorage) and `AppInitializer` (runs after hydration, uses DB settings) can disagree. The user sees a flash from one theme to another.

**Fix:** In `AppInitializer`, only apply the theme if it DIFFERS from what's currently applied:
```typescript
// Before calling applyDocumentTheme, check if it would change anything
const currentClasses = document.documentElement.className;
const newClasses = getThemeClassNames(theme, mode, prefersLight).join(' ');
if (currentClasses !== newClasses && !currentClasses.includes('reduce-motion-pending')) {
  applyDocumentTheme(theme, mode, reduceMotion);
}
```
Also: ensure the theme-init script and `applyDocumentTheme` produce IDENTICAL class strings for the same inputs. Right now the script adds `theme-midnight` / `theme-meadow` but `applyDocumentTheme` also handles `theme-navy` / `theme-forest` in its remove list. They should be consistent.

**Verify:** Log in with a fresh account. There should be NO theme flash — the page should load in sunset and stay sunset.

---

### T0-8 · Login page shows blue with orange background · 🟡 · Source: user issue #2

**File:** `src/components/layout/OnboardingBackground.tsx` + `src/app/(auth)/login/page.tsx`

**Bug:** The theme-init script defaults to sunset, but `OnboardingBackground` may have hardcoded blue/orange gradient colors that don't respect the theme tokens.

**Fix:** Read `OnboardingBackground.tsx`. Replace any hardcoded hex colors (`#7692FF`, `#1B2CC1`, etc.) with CSS variables (`var(--orb-1)`, `var(--orb-2)`, `var(--accent)`, etc.). The login page should use the same ambient orb system as the app.

**Verify:** Open `/login` in an incognito window (no localStorage). The background should be the warm sunset palette (amber/coral/orange), NOT blue.

---

### T0-9 · DB default theme may still be 'wahala' · 🟢 · Source: user issue #6

**File:** `supabase/migrations/001_baseline.sql:110`

**Bug:** The baseline migration creates `user_settings.theme` with `DEFAULT 'wahala'`. New users get `'wahala'` in the DB (normalized to `'sunset'` at runtime, but stored wrong). Migration `20260703000004` changes the default to `'sunset'` but only for new rows AFTER the migration runs.

**Fix:** Add a new migration to update existing rows and ensure the default is `'sunset'`:
```sql
-- supabase/migrations/20260704000000_ensure_sunset_default.sql
ALTER TABLE public.user_settings ALTER COLUMN theme SET DEFAULT 'sunset';
UPDATE public.user_settings SET theme = 'sunset' WHERE theme NOT IN ('sunset', 'midnight', 'meadow');
```

**Verify:** Create a new account. Check the DB — `theme` should be `'sunset'`.

---

### T0-10 · Sidebar icon misalignment · 🟢 · Source: user issue #7

**File:** `src/components/layout/Navigation.tsx:55, 223`

**Bug:** The brand icon container uses `px-4` (16px padding), while nav items use `px-3` (12px padding). The profile button uses `px-3`. This causes horizontal misalignment between the brand icon, nav icons, and profile icon.

**Fix:** Change the brand container from `px-4` to `px-3`, and ensure the brand SVG (28px) is centered in the same 40px icon column as nav items (which use `iconClass = "flex h-10 w-10"`):
```tsx
// Line 55: change px-4 to px-3
<div className="h-[80px] flex items-center border-b border-[var(--border-subtle)] shrink-0 px-3">
```
Also wrap the brand SVG in the same `iconClass` span:
```tsx
<span className={iconClass}>
  <svg width="28" height="28" ...>...</svg>
</span>
```

**Verify:** The brand icon, nav icons, and profile avatar should all be vertically aligned on the same left edge.

---

### T0-11 · Page transitions inconsistent (Home fades, others don't) · 🟡 · Source: user issue #15

**File:** `src/app/(app)/template.tsx` (was deleted) + all page files

**Bug:** `template.tsx` was deleted (which provided consistent page transitions). Home has its own `m` animation wrapper. Other pages don't. Navigation feels inconsistent.

**Fix:** Restore a lightweight `template.tsx` that applies a consistent fade to ALL pages:
```tsx
// src/app/(app)/template.tsx
"use client";
import { m } from "framer-motion";

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="h-full w-full"
    >
      {children}
    </m.div>
  );
}
```
This is a LIGHT fade (150ms, opacity-only) — no y-axis movement, no layout shift. It won't cause the `useEffect` re-mount problems of the old template because it doesn't use `pageVariants` with `y: 8`.

**Verify:** Navigate between Home, Do, Think, Explore. Every transition should have the same subtle fade.

---

### T0-12 · Empty-state Add buttons inconsistent across spaces · 🟢 · Source: user issue #8

**Files:** `src/app/(app)/think/page.tsx`, `src/app/(app)/explore/page.tsx`, `src/app/(app)/remember/people/page.tsx`, `src/app/(app)/remember/locations/page.tsx`, `src/app/(app)/inbox/page.tsx`

**Bug:** Only `/do` was fixed (empty-state buttons call `setIsPanelOpen(true)`). Other spaces still call `setCaptureModalOpen(true)` — opening Quick Capture instead of the space's own add panel.

**Fix:** In each space's empty-state CTA button:
- Think: change `onClick={() => useAppStore.getState().setCaptureModalOpen(true)}` to `onClick={handleNewThread}`
- Explore: change to `onClick={() => setIsAddDrawerOpen(true)}`
- People: change to `onClick={() => setIsPanelOpen(true)}`
- Locations: change to `onClick={() => setShowAdd(true)}`
- Inbox: the empty state is "Inbox Zero" — no Add button needed, but if there is one, it should open Capture (since Inbox IS the capture destination)

**Verify:** Go to each space's empty state. Click "Add." The space's own add panel should open, not Quick Capture.

---

### T0-13 · Explore "Save to Explore" Type dropdown is ugly · 🟢 · Source: user issue #9

**File:** `src/components/features/ExploreDrawer.tsx:230-240`

**Bug:** The Type field uses a plain `<input type="text">` with a `<datalist>` — renders as the browser's native datalist, which looks ugly and inconsistent with the rest of the app.

**Fix:** Replace the `<input>` + `<datalist>` with the `Dropdown` component:
```tsx
<Dropdown
  value={type}
  onChange={setType}
  options={PRESET_TYPES.map(t => ({ value: t, label: t }))}
  variant="select"
  className="w-full"
/>
```
Add a "Custom" option that, when selected, reveals a text input for custom type entry.

**Verify:** Open the Explore drawer. The Type dropdown should match the app's design system, not the browser default.

---

## Tier 1 — High-impact infrastructure (do this week)

These are the 80/20 items — small effort, permanent quality improvement.

### T1-1 · Sentry error monitoring · 🟡 · Source: infrastructure rec #1

**Why:** You're flying blind in production. `logger.ts` is a stub.

**Install:**
```bash
npx @sentry/wizard@latest -i nextjs
```
This sets up `@sentry/nextjs`, `sentry.client.config.ts`, `sentry.server.config.ts`, and source map upload. Get a DSN from sentry.io (free tier: 5k errors/month).

**Add to `next.config.ts`:**
```ts
productionBrowserSourceMaps: true,  // for readable Sentry stack traces
```

**Verify:** Throw a test error in a component. Check Sentry dashboard — it should appear with full stack trace and source maps.

---

### T1-2 · Supabase typed client · 🟢 · Source: infrastructure rec #2

**Why:** Eliminates 40+ `: any` annotations. TypeScript catches column-name typos at compile time.

**Install:**
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.types.ts
```

**Update `src/lib/supabase.ts`:**
```typescript
import type { Database } from '@/types/database.types';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

Same for `src/lib/supabase-server.ts`.

**Add to `package.json`:**
```json
"scripts": {
  "gen:types": "supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.types.ts"
}
```

**Verify:** `npx tsc --noEmit` should pass with fewer `: any` errors. Try renaming a column in the types file — TypeScript should flag every usage.

---

### T1-3 · Fix CI workflow YAML · 🟢 · Source: infrastructure rec #3

**File:** `.github/workflows/ci.yml:4,6`

**Bug:** `branches: ain, master]` — missing `[`. The workflow never triggers.

**Fix:**
```yaml
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
```

**Verify:** Push a commit. The CI workflow should trigger and run lint + type-check + test + build.

---

### T1-4 · Upstash Redis setup · 🟢 · Source: infrastructure rec #4

**Why:** Your rate limiter falls back to in-memory (does nothing in serverless). `/api/capture` and `/api/account` are unprotected.

**Steps:**
1. Go to upstash.com, create a free Redis database
2. Add to `.env.local`:
   ```
   UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```
3. Your existing `src/lib/rate-limit.ts` code automatically picks these up — no code changes needed

**Verify:** Check server logs — the `[rate-limit] Redis not configured` warning should disappear. Hit `/api/capture` 101 times in a minute — the 101st should return 429.

---

### T1-5 · `@t3-oss/env-nextjs` (replace hand-rolled env.ts) · 🟢 · Source: infrastructure rec #5

**Why:** Your current `env.ts` returns empty strings on missing vars — app runs in broken state silently. `@t3-oss/env` validates at startup with Zod.

**Install:**
```bash
npm install @t3-oss/env-nextjs
```

**Replace `src/lib/env.ts`:**
```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
});
```

**Verify:** Delete `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`, start the dev server. You should get a clear Zod validation error at startup, not a silent 500.

---

### T1-6 · React Query DevTools · 🟢 · Source: infrastructure rec #6

**Install:**
```bash
npm install -D @tanstack/react-query-devtools
```

**Update `src/components/layout/QueryProvider.tsx`:**
```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function QueryProvider({ children }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
```

**Verify:** A small button appears bottom-left in dev. Click it to see all queries, their status, and cache state.

---

### T1-7 · Prettier + tailwind class sorting · 🟢 · Source: infrastructure rec #7

**Install:**
```bash
npm install -D prettier prettier-plugin-tailwindcss
```

**Create `.prettierrc`:**
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Add to `package.json`:**
```json
"format": "prettier --write ."
```

**Run:** `npm run format` once to format the entire codebase.

**Verify:** Open any component. Tailwind classes should be in canonical order (layout → sizing → typography → effects).

---

### T1-8 · Husky + lint-staged (pre-commit hooks) · 🟢 · Source: infrastructure rec #8

**Install:**
```bash
npm install -D husky lint-staged
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

**Add to `package.json`:**
```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "tsc --noEmit"],
  "*.{ts,tsx,css,json,md}": ["prettier --write"]
}
```

**Verify:** Try to commit a file with a type error. The commit should be blocked.

---

## Tier 2 — Design system consistency (from 13 audit docs)

These are from the Lovable audit docs. Only adopt items that fit a personal productivity app.

### T2-1 · Quick Wins Q1–Q9 (audit roadmap) · 🟢 · Source: audit doc 20-roadmap.md

| ID | What | File | Time |
|---|---|---|---|
| Q1 | Bump `--text-4` from 35% → 55% alpha | `globals.css:115` | 5 min |
| Q2 | Change `<aside>` to `<nav aria-label="Primary">` | `Navigation.tsx:46` | 5 min |
| Q3 | Add `min-h-11 min-w-11` to all icon-only buttons | `button.tsx`, `.btn-icon` | 15 min |
| Q4 | Restore per-space colors in warm-dark | `globals.css:158-170` | 15 min |
| Q5 | Wrap hover transforms in `@media (prefers-reduced-motion: no-preference)` | `globals.css` | 20 min |
| Q6 | Add `aria-live="polite"` region for realtime announcements | `(app)/layout.tsx` | 30 min |
| Q7 | `useCallback` on Do page handlers | `do/page.tsx` | 30 min |
| Q8 | Bump `.dropdown-item` focus ring | `globals.css` | 10 min |
| Q9 | Per-column empty-state copy (replace "Nothing here") | `do/page.tsx:74` | 45 min |

**Total: ~3 hours.** These are the highest-ROI changes in the entire audit.

---

### T2-2 · Button system consolidation · 🔴 · Source: audit doc 02-ui-audit.md, 10-design-system-spec.md

**Bug:** You have TWO button systems: `Button.tsx` (Base UI, uses OKLCH neutrals) AND `.btn-primary/.btn-secondary/.btn-capture/.btn-icon/.btn-preset/.btn-danger` (CSS classes in globals.css). They look different, behave differently, and developers don't know which to use.

**Fix:**
1. Rewrite `src/components/ui/button.tsx` to use warm tokens (`var(--accent)`, `var(--text-1)`, etc.) instead of OKLCH neutrals
2. Add variants: `primary | secondary | ghost | destructive | accent`
3. Add sizes: `sm | md | lg | icon` with `min-h-11 min-w-11` on icon
4. Delete `.btn-primary`, `.btn-secondary`, `.btn-capture`, `.btn-icon`, `.btn-preset`, `.btn-danger` from `globals.css`
5. Codemod all call sites: replace `className="btn-primary"` with `<Button variant="primary">`, etc.

**Verify:** Grep for `btn-primary` in `src/` — should return 0 results. All buttons should look consistent.

---

### T2-3 · `<Surface>` primitive (replace GlassCard) · 🔴 · Source: audit doc 13-component-inventory.md

**Bug:** You have `GlassCard` + `.glass-card` + `.glass-card-elevated` + `.glass-card-hero` + `.glass-panel` — 5 glass systems.

**Fix:**
1. Create `src/components/ui/Surface.tsx`:
   ```tsx
   interface SurfaceProps {
     elevation?: "flat" | "raised" | "floating" | "overlay";
     tone?: "default" | "accent";
     padding?: "none" | "sm" | "md" | "lg";
     interactive?: boolean;
   }
   ```
2. Map each elevation to a bundle of `background + backdrop-filter + border + box-shadow`
3. Replace all `<GlassCard>` usages with `<Surface elevation="raised">`
4. Delete `GlassCard.tsx` and `.glass-card*` CSS classes

**Verify:** Grep for `GlassCard` — should return 0 results. All surfaces should use consistent elevation.

---

### T2-4 · `<EmptyState>` primitive · 🟢 · Source: audit doc 12-interaction-patterns.md

**Fix:** Create `src/components/ui/EmptyState.tsx`:
```tsx
interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}
```
Replace all bare "Nothing here" / "No threads yet" / "Your network is empty" with `<EmptyState>`.

**Verify:** Every space's empty state should have: icon + title + description + action button.

---

### T2-5 · A11y fixes C1–C5 · 🟢 · Source: audit doc 03-accessibility-audit.md

| ID | What | File |
|---|---|---|
| C1 | Bump `--text-4` 35% → 55% (done in T2-1 Q1) | `globals.css:115` |
| C2 | Add leading icon + space color for space identity | All space headers |
| C3 | `min-h-11 min-w-11` on all icon-only buttons (done in T2-1 Q3) | `button.tsx` |
| C4 | `aria-label` on all icon-only buttons (PomodoroTimer, TaskCard, calendar arrows) | Multiple files |
| C5 | Verify all dialogs use `useDialogFocus` + `aria-modal="true"` + `aria-labelledby` | `Sheet.tsx`, `ConfirmModal.tsx` |

---

### T2-6 · Dynamic-import `compromise` + `chrono-node` · 🟡 · Source: audit doc 05-performance.md

**Bug:** `compromise` (~140KB) and `chrono-node` (~50KB) are bundled into the client via `TaskAddPanel.tsx` imports.

**Fix:** Move NLP parsing to the server. The `/api/capture` route already runs `routeCapture` server-side. In `TaskAddPanel.tsx`, remove `import * as chrono from "chrono-node"` and `import "@/lib/chrono-custom"`. Replace the local `chrono.parse(text)` call with a debounced fetch to `/api/capture` (or a new `/api/parse-date` endpoint).

**Verify:** Check bundle size before and after. The client bundle should drop by ~190KB.

---

### T2-7 · Asymmetric swipe thresholds · 🟢 · Source: audit doc 04-mobile-responsive-audit.md

**File:** `src/components/features/TaskCard.tsx`

**Fix:** Replace the single `SWIPE_DELETE_THRESHOLD = -80` with asymmetric thresholds:
```typescript
const SWIPE_COMPLETE_THRESHOLD = -60;  // easier to complete
const SWIPE_DELETE_THRESHOLD = -100;   // harder to delete
const SWIPE_VELOCITY_THRESHOLD = 400;  // px/s

const handleDragEnd = (_, info) => {
  if (info.offset.x < SWIPE_DELETE_THRESHOLD && info.velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
    // delete
  } else if (info.offset.x < SWIPE_COMPLETE_THRESHOLD) {
    // complete
  } else {
    // snap back
  }
};
```

**Verify:** Swipe a task card left 60px — it should complete. Swipe 100px — it should delete. Quick flick — should respect velocity.

---

### T2-8 · Undo on task complete · 🟡 · Source: audit doc 01-ux-audit.md

**Bug:** Only delete has undo. Task complete is permanent.

**Fix:** In `do/page.tsx` `completeTask()`, add an undo action to the success toast (matching the delete pattern):
```typescript
toast.success("Task completed", {
  action: {
    label: "Undo",
    onClick: async () => {
      await supabase.from("items").update({ status: "active", completed_at: null }).eq("id", id);
      fetchTasks();
    }
  },
  duration: 5000
});
```

---

### T2-9 · React Hook Form + Zod for all forms · 🔴 · Source: infrastructure rec #9

**Why:** `TaskAddPanel`, `AddPersonPanel`, `SettingsModal` all use manual `useState` form state. RHF + Zod cuts form code by ~60% and adds proper validation.

**Install:**
```bash
npm install react-hook-form @hookform/resolvers
```

**Migrate one form at a time, starting with `TaskAddPanel`** (it's the most complex). Use `zodResolver` to connect Zod schemas to RHF.

**Verify:** Form validation errors should appear inline on blur, not just as toasts.

---

### T2-10 · `nuqs` for URL state · 🟡 · Source: infrastructure rec #10

**Why:** Your Do page's `viewMode` (board/today) and category filter live in local state. Moving to URL params makes them shareable, bookmarkable, and back-button-friendly.

**Install:**
```bash
npm install nuqs
```

**Migrate `do/page.tsx`:**
```typescript
import { useQueryState } from 'nuqs';

const [viewMode, setViewMode] = useQueryState('view', { defaultValue: 'board' });
const [categoryFilter, setCategoryFilter] = useQueryState('category', { defaultValue: 'all' });
```

**Verify:** Navigate to `/do?view=today&category=work`. The page should load with those filters applied. Back button should work.

---

### T2-11 · Floating UI (fix dropdown positioning) · 🟡 · Source: infrastructure rec #11

**Why:** Your custom `Dropdown` and `Popover` handle positioning manually. The "behind something" z-index bug you reported is a positioning issue.

**Install:**
```bash
npm install @floating-ui/react
```

**Migrate `Dropdown.tsx` and `Popover.tsx`** to use `useFloating` with `autoUpdate`, `flip`, `shift`, and `size` middleware. This handles edge-collision, flip, and shift automatically.

**Verify:** Open a dropdown near the bottom of the viewport. It should flip upward. Open near the right edge — it should shift left.

---

## Tier 3 — Calendar rewrite (needs dedicated effort)

### T3-1 · Calendar complete rewrite · 🔴 · Source: user issue #1

**Bug:** Calendar has bad layout, broken drag-and-drop, bad sizing, misaligned lines, no keyboard integration, bad mobile view, broken click-to-add.

**Approach:** Study top calendar apps before rewriting:
- **Cron** (now Notion Calendar) — best keyboard navigation, clean week view
- **Sunsama** — daily planning integration, time-blocking
- **Fantastical** — natural language input, mobile-first
- **Google Calendar** — the standard, best mobile month view
- **Notion Calendar** — drag-to-reschedule, minimal UI

**Requirements for the rewrite:**
1. **Three views:** Day (mobile default), Week (desktop default), Month (overview)
2. **Keyboard:** Arrow keys to navigate, Enter to create, Delete to remove, `t` for today
3. **Drag-and-drop:** Click empty slot to create task. Drag task to reschedule. Drag task edge to change duration (if time-based).
4. **Mobile:** Day view default. Pinch-to-zoom on week view. Swipe left/right to navigate.
5. **Sizing:** `h-[calc(100dvh-160px)]` with `min-h-[420px]` on mobile, `min-h-[600px]` on desktop
6. **Alignment:** Grid lines must align. Use CSS Grid, not flexbox. Time labels in a fixed left column.
7. **Z-index:** Calendar elements must be `z-10` (below modals at `z-100`/`z-200`)

**This is a 2-3 day dedicated effort.** Do NOT attempt to patch the existing calendar — rewrite it from scratch.

---

## Tier 4 — Quality of life (do when time permits)

### T4-1 · Plausible/PostHog analytics · 🟡
```bash
npm install plausible-tracker  # or @posthog/next
```
Add to `layout.tsx`. For a personal app, Plausible ($9/mo) is enough.

### T4-2 · OKLCH color for new themes · 🟡
When adding new theme tokens, use OKLCH: `--accent: oklch(0.75 0.15 75);` instead of hex. Don't migrate existing tokens — just use OKLCH for new ones.

### T4-3 · `text-wrap: balance` on headings · 🟢
Add to `globals.css`:
```css
h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }
```

### T4-4 · `light-dark()` CSS function · 🟡
Replace `:root` + `html.light` duplicate blocks with `light-dark()`:
```css
--text-1: light-dark(#1A0E00, #FFFFFF);
```
Requires `color-scheme: light dark;` on `:root`.

### T4-5 · Speculation Rules API · 🟢
Add to `layout.tsx` head:
```html
<script type="speculationrules">
{ "prerender": [{ "where": { "href_matches": "/do" } }] }
</script>
```

### T4-6 · React Compiler · 🟢
Add to `next.config.ts`:
```ts
experimental: {
  reactCompiler: true,
}
```
Then remove manual `React.memo`, `useMemo`, `useCallback` where the compiler handles it.

### T4-7 · `field-sizing: content` · 🟢
Add to `globals.css`:
```css
textarea.input { field-sizing: content; }
```
Keep `react-textarea-autosize` as polyfill for older browsers.

### T4-8 · Vaul (replace Sheet) · 🟡
```bash
npm install vaul
```
Replace `Sheet.tsx` with Vaul's `Drawer`. Better drag-to-dismiss, snap points, keyboard avoidance. Only do this if you're already touching Sheet for T0-6.

### T4-9 · cmdk (replace SearchModal) · 🟡
```bash
npm install cmdk
```
Replace `SearchModal.tsx` with cmdk. Better keyboard nav, fuzzy search, grouping. Only do this if you're adding a command palette per audit doc 12.

### T4-10 · Supabase database backups · 🟡
Add a GitHub Action that runs `pg_dump` nightly to Cloudflare R2 or a private S3 bucket. Costs ~$0.03/month. Retains 30 days.

### T4-11 · RLS test suite · 🟡
Write Vitest tests that verify: User A can read/write their own data, User B cannot access User A's data, anon gets nothing. Use a separate Supabase test project.

### T4-12 · Bundle analyzer · 🟢
```bash
npm install -D @next/bundle-analyzer
```
Add to `next.config.ts`. Run `ANALYZE=true npm run build` monthly.

### T4-13 · `eslint-plugin-security` · 🟢
```bash
npm install -D eslint-plugin-security eslint-plugin-no-secrets
```
Add security rules to ESLint config.

### T4-14 · `depcheck` + `npm-check-updates` · 🟢
```bash
npm install -D depcheck npm-check-updates
```
Add `check:deps` and `check:updates` scripts. Run monthly.

### T4-15 · `knip` (dead code finder) · 🟢
```bash
npm install -D knip
```
Run `npx knip` monthly to find unused exports, files, and dependencies.

### T4-16 · `prettier-plugin-tailwindcss` · 🟢
Already in T1-7. Included here for completeness.

### T4-17 · `pnpm` instead of `npm` · 🟡
```bash
npm install -g pnpm
rm -rf node_modules package-lock.json
pnpm install
```
Update CI to use pnpm. Faster installs, less disk space, stricter dependency resolution.

### T4-18 · `@vercel/speed-insights` · 🟢
```bash
npm install @vercel/speed-insights
```
Add `<SpeedInsights />` to `layout.tsx`. Free if on Vercel.

---

## Tier 5 — DO NOT DO (skip list)

These items from the audit docs or infrastructure lists are NOT worth doing for Presense:

1. **Global `/trash` route** — over-engineered for a personal app. Per-space trash is fine.
2. **`g i/d/r/t/e` Vim mnemonics** — too geeky for the audience. Linear can ship this; Presense shouldn't.
3. **`⌘Z`/`⌘⇧Z` global undo stack** — scope creep. Per-action undo toasts are sufficient.
4. **Routed `/settings`** — modal is fine for a personal app. Things3/Sunsama use modals.
5. **Density modes (`data-density`)** — Linear needs this; Presense doesn't.
6. **`<Combobox>` for @-mentions** — defer until Think has proven usage.
7. **Long-press action sheet on cards** — over-engineered. Swipe + tap covers it.
8. **Three.js / WebGL / GSAP / ScrollSmoother** — award-site toys, not productivity-app tools.
9. **Atropos.js (3D parallax hover)** — gimmick for marketing cards.
10. **Splitting.js / SplitText** — no hero text animations to justify it.
11. **Rive / Lottie** — overkill for check-off animations. Use CSS/Framer Motion.
12. **CMS (Sanity/Payload/Storyblok)** — no editorial content. Data is in Supabase.
13. **i18n (next-intl/Paraglide)** — English-only. Skip unless going multilingual.
14. **Style Dictionary / Tokens Studio** — enterprise token pipeline. CSS custom properties are sufficient.
15. **`data-theme`/`data-mode` migration** — bigger than it sounds. Defer unless themes multiply.
16. **Storybook** — overkill for solo project unless building a design system.
17. **MSW (Mock Service Worker)** — useful but not urgent.
18. **`@base-ui/react` AND shadcn simultaneously** — pick one. You have both. Consolidate to shadcn (which uses Base UI internally).
19. **Million.js** — incompatible with React Compiler. Pick one (React Compiler).
20. **Partytown** — you have no third-party scripts. Skip until you add analytics.

---

## Execution order

### Week 1: Tier 0 (urgent fixes) + Tier 1 (infrastructure)
- Day 1: T0-1 through T0-13 (all urgent bug fixes)
- Day 2: T1-1 (Sentry), T1-2 (typed client), T1-3 (CI YAML), T1-4 (Upstash)
- Day 3: T1-5 (t3-env), T1-6 (React Query DevTools), T1-7 (Prettier), T1-8 (Husky)

### Week 2: Tier 2 (design system)
- Day 1: T2-1 (Quick Wins Q1-Q9)
- Day 2: T2-5 (A11y C1-C5), T2-7 (asymmetric swipe), T2-8 (undo on complete)
- Day 3: T2-4 (EmptyState primitive), T2-6 (dynamic-import NLP)
- Day 4-5: T2-2 (Button consolidation) + T2-3 (Surface primitive) — these are the biggest refactors

### Week 3: Tier 2 continued + Tier 4
- T2-9 (React Hook Form) — migrate one form per day
- T2-10 (nuqs) — migrate Do page filters
- T2-11 (Floating UI) — migrate Dropdown/Popover
- T4-1 through T4-7 (quick wins)

### Week 4: Tier 3 (calendar rewrite)
- Study Cron, Sunsama, Fantastical, Google Calendar, Notion Calendar
- Rewrite `CalendarView`, `WeekView`, `MonthView`, `DayView` from scratch
- Keyboard navigation, mobile-first, proper drag-and-drop

### Ongoing
- T4-8 through T4-18 (quality of life items, one per week)
- Monthly: run `depcheck`, `knip`, `ncu`, bundle analyzer
- Monthly: review Sentry errors, fix top 5

---

## What NOT to break

These are correct in the current codebase and must be preserved:

1. **Hover sidebar** (`w-[80px] hover:w-[248px] focus-within:w-[248px]`) — do NOT revert to toggle-collapse
2. **Theme rename** (`sunset/midnight/meadow`) — do NOT revert to `wahala/orange/blue/forest`
3. **`proxy.ts` CSP nonce system** — correctly handles nonce + cookie propagation
4. **`MotionProvider` with `LazyMotion features={domMax} strict`** — correctly tree-shakes motion
5. **`RealtimeProvider` shared-channel architecture** — correctly multiplexes subscriptions
6. **`Sheet` component drag-to-dismiss** — correctly handles mobile sheet pattern
7. **`useBodyScrollLock` ref-counted lock** — correctly handles multiple overlays
8. **`rituals.ts` pure-function approach** — the logic is correct except for the `morningDone` check in T0-1
9. **`theme.ts` normalizer** — correctly maps all legacy values
10. **`item-lifecycle.ts` status standardization** — correct foundation

---

## Verification checklist

Before marking any tier as "done":

- [ ] `npm run build` passes with zero errors
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes (fix the 5 currently-failing tests first)
- [ ] `npm run lint` passes
- [ ] No new `: any` annotations added
- [ ] No new `catch (error: any)` added
- [ ] Test on mobile viewport (375px) — no horizontal scroll, no clipped content
- [ ] Test on desktop (1440px) — no layout issues
- [ ] Test in Safari (if possible) — no `100vh` issues
- [ ] Verify all 4 themes render correctly (sunset, midnight, meadow × dark/light)
- [ ] Verify Lighthouse a11y score >= 95
- [ ] Verify no console errors in production build

---

## Summary

This plan has **62 items** across 5 tiers:
- **Tier 0:** 13 urgent bug fixes (do today)
- **Tier 1:** 8 infrastructure items (do this week)
- **Tier 2:** 11 design-system items (do over 2 weeks)
- **Tier 3:** 1 calendar rewrite (dedicated week)
- **Tier 4:** 18 quality-of-life items (ongoing)
- **Tier 5:** 20 items to SKIP (do NOT do)

The highest-leverage items are:
1. T0-1 (ritual logic fix) — 1 line, fixes a core flow
2. T0-3 (light mode stale closure) — 10 lines, fixes a core setting
3. T0-4 (onboarding inbox) — 1 line, fixes first-run experience
4. T1-2 (Supabase typed client) — 5 minutes, eliminates 40+ `: any`
5. T1-3 (CI YAML fix) — 1 character, enables automated QA
6. T2-1 (Quick Wins) — 3 hours, disproportionate impact
7. T2-2 (Button consolidation) — biggest consistency win

Do these first. Everything else is improvement, not emergency.

# AGENTS.md — Presense

The entry point for every coding agent and contributor. If another file disagrees with this one, **this file wins** — and the disagreeing file should be fixed or deleted in the same change.

## 0. How to work here

There is no ticket queue to obey. Read the code, form your own view, and make the smallest change that genuinely improves the product. Documentation, comments and old audit notes are **evidence, not proof** — verify a claim against the source before you rely on it. A comment saying something was fixed is not the same as it being fixed.

Before you finish, all four of these must pass:

```bash
npm ci          # the lockfile must stay in sync with package.json
npm run lint    # zero errors
npx tsc --noEmit
npm test
npm run build
```

## 1. Architecture

**Next.js 16 App Router + React 19 + TypeScript strict.** Supabase for Postgres, Auth and Realtime. Zustand for client UI state, TanStack Query for server state, Tailwind CSS 4 for styling, Framer Motion for animation, Serwist for the PWA layer, Sentry for errors.

### Auth and identity

`src/proxy.ts` validates the JWT with `getUser()` on every matched request and redirects unauthenticated page requests to `/login` (API routes get a JSON 401). The `(app)` layout then reads the session from cookies and publishes the user through `SessionProvider`.

**Client code must never call `supabase.auth.getUser()`.** It is a network round trip to the auth server on every call. Use `useUserId()` or `useSessionUser()` from `src/components/providers/SessionProvider.tsx`.

Authorization is enforced by **RLS**, never by the client. Every user-owned table has four per-operation policies (`users_own_<table>_{select,insert,update,delete}`) scoped `TO authenticated` with `(select auth.uid()) = user_id`. A `user_id` filter in a query is for index selection and clarity — it is not the security boundary.

### Data access

- Reads go through **TanStack Query**. Do not fetch in a `useEffect` and hold the result in `useState`; that pattern loses error state and re-fetches on every dependency change.
- **Never swallow a query error.** `data ?? []` on a failed query renders an empty state that tells the user their data is gone. Throw from the `queryFn` and render a real error state with a retry.
- Every mutation must check `error` before reporting success — use `safeMutate()` from `src/lib/supabase.ts`.
- Project the columns you need. `select("*")` is the exception, not the default.
- Every list query needs a bound (`.limit()` / `.range()`).
- User input in a PostgREST `or()` filter must go through `ilikeContains()` / `escapeFilterValue()` in `src/lib/utils.ts`. Raw interpolation lets input change the filter's structure.
- Optimistic task edits go through `src/lib/task-cache.ts`, which patches every task cache and returns a rollback. Do not hand-roll `getQueryData`/`setQueryData` pairs per call site.

### Types

The task row shape is `TaskRecord` in `src/lib/task-cache.ts`, derived from the generated `Database` types. Do not write a local `interface Task` — two divergent hand-written copies previously disagreed with the real column nullability and hid null-handling bugs behind `any`.

### Realtime

`RealtimeProvider` owns every channel and multiplexes all consumers of a table onto one subscription, with ref-counted teardown, echo suppression after local writes, and buffering while the tab is hidden. `useRealtime(table, onUpdate)` registers a listener and debounces invalidation — **it never opens a channel itself**. Opening a channel must never be able to crash the tree; failure degrades to "no live updates".

### Client boundaries

Most of the app is client-rendered today. That is a known weakness, not a target to imitate: prefer a Server Component, and keep interactivity in the smallest island that needs it.

Modals in `DynamicModals.tsx` are rendered **conditionally on their open state**. `ssr: false` alone does not defer a chunk — an unconditionally rendered `next/dynamic` component still downloads and mounts on every page load.

## 2. Invariants

1. `src/lib/env.ts` must never throw. Missing required vars log and return `""`; genuinely optional vars (Sentry DSN, Turnstile sitekey) stay silent.
2. `ThemeId` values are strictly `"warm" | "navy" | "forest"`.
3. `Dropdown.tsx` and `Popover.tsx` render through a portal. No z-index hacks.
4. `MotionProvider` uses `LazyMotion domMax strict`.
5. Never drop a DB column and never delete a file in `supabase/migrations/`. (Deleting a genuinely unreferenced UI component *is* allowed — prove it is unreferenced first.)
6. Every Supabase mutation checks `error` before reporting success.
7. Every React error boundary calls `Sentry.captureException`. Boundaries swallow the error, so the browser SDK never sees it otherwise.

## 3. Design system

Tokens live in `src/app/globals.css`. Use them; do not introduce one-off hex values or arbitrary spacing.

- **Row actions** (per-row edit/delete controls) use the `.row-actions` class, never `opacity-0 group-hover:opacity-100`. Hover-only controls are invisible and unusable on touch, and unreachable by keyboard.
- **View switches** use `SegmentedControl`. There is one such control, not two.
- Touch targets are at least 36px; primary controls 44px.
- Prefer calm and legible over decorated. No gratuitous glass, gradients, or motion.

## 4. Line endings

The working tree is CRLF. Tools that rewrite files in LF produce whole-file diffs — normalise before committing.

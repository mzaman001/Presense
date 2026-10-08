# AGENTS.md — Presense

The entry point for every coding agent and contributor. If another file disagrees with this one, **this file wins** — and the disagreeing file should be fixed or deleted in the same change.

## 0. How to work here

There is no ticket queue to obey. Read the code, form your own view, and make the smallest change that genuinely improves the product. Documentation, comments and old audit notes are **evidence, not proof** — verify a claim against the source before you rely on it. A comment saying something was fixed is not the same as it being fixed.

Before you finish, all of these must pass (CI runs each of them on every PR):

```bash
npm ci          # the lockfile must stay in sync with package.json
npm run lint    # zero errors
npx tsc --noEmit
npm test
npm run build
npx playwright test                                  # Axe + contrast; signed-in tests need the seed (CLAUDE.md)
npx -y deno check supabase/functions/*/index.ts      # Edge Functions, if you touched supabase/functions
```

`CLAUDE.md` has the other commands (bundle budgets, interaction smoothness, types) and the current measured state.

## 1. Architecture

**Next.js 16 App Router + React 19 + TypeScript strict.** Supabase for Postgres, Auth and Realtime. Zustand for client UI state, TanStack Query for server state, Tailwind CSS 4 for styling, Framer Motion for animation, Serwist for the PWA layer, Sentry for errors.

### Auth and identity

`src/proxy.ts` verifies the access token with `getClaims()` (locally, against the project's public key; no auth-server round trip) on every matched request and redirects unauthenticated page requests to `/login` (API routes get a JSON 401). The `(app)` layout then reads the session from cookies and publishes the user through `SessionProvider`.

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

Much of the app is still client-rendered. That is a known weakness, not a target to imitate: prefer a Server Component, and keep interactivity in the smallest island that needs it. The Do list already renders on the server in the user's saved timezone (`do/page.tsx`); anything date-dependent there must go through `src/lib/zoned-date.ts` so server and client agree (see CLAUDE.md, *Timezone*).

Modals in `DynamicModals.tsx` are rendered **conditionally on their open state**. `ssr: false` alone does not defer a chunk — an unconditionally rendered `next/dynamic` component still downloads and mounts on every page load.

## 2. Invariants

1. `src/lib/env.ts` must never throw. Missing required vars log and return `""`; genuinely optional vars (Sentry DSN) stay silent.
2. There is one theme (light/dark only, per the 2026-09-13 design overhaul spec) — `normalizeThemeId()` always returns `"warm"` regardless of input. The `ThemeId` type still lists `"navy" | "forest"` for now because a handful of call sites key lookup tables by it; don't add new code that treats them as selectable themes.
3. `Dropdown.tsx` and `Popover.tsx` render through a portal. No z-index hacks.
4. `MotionProvider` uses `LazyMotion domMax strict`.
5. Never drop a DB column, and never edit or delete a migration once production has run it: a change is always a new migration. History starts at `supabase/migrations/20261009000000_baseline.sql`, a verified copy of production's schema; the migrations before it are kept, unrun, in `supabase/migrations_archive/`. Never squash again without proving the result rebuilds production (fresh `supabase db reset`, then diff `supabase db dump --schema public` against production's). (Deleting a genuinely unreferenced UI component *is* allowed — prove it is unreferenced first.)
6. Every Supabase mutation checks `error` before reporting success.
7. Every React error boundary reports to Sentry. Boundaries swallow the error, so the browser SDK never sees it otherwise. Client code uses `captureException` from `@/lib/sentry-client` (the lazy client); importing `@sentry/nextjs` statically in client code adds ~36 KiB gz to every page (PERF-09). Server code (route handlers, server pages) may import `@sentry/nextjs`.

## 3. Design system

Tokens live in `src/app/globals.css`. Use them; do not introduce one-off hex values or arbitrary spacing.

- **Row actions** (per-row edit/delete controls) use the `.row-actions` class, never `opacity-0 group-hover:opacity-100`. Hover-only controls are invisible and unusable on touch, and unreachable by keyboard.
- **View switches** use `SegmentedControl`. There is one such control, not two.
- Touch targets are 44px on touch screens: small visual controls get the hit area from `.tap-target` / `.chip` (`@media (pointer: coarse)`), not by growing visually.
- Prefer calm and legible over decorated. No gratuitous glass, gradients, or motion.
- **Sunrise / sunset.** Light mode is "sunrise" (warm cream, apricot light overhead); dark mode is "sunset" (plum dusk, ember light on the horizon). The sanctioned gradients are `.atmosphere` (rendered once by `AmbientBackground` from the `--atmos-*` tokens: static, no filter, no animation) the short scroll fade under the mobile dock, and the first-light / last-light wash at the top of the ritual panel (from the same `--atmos-*` tokens). Don't add others.
- **Type.** Page titles (`.text-page-title`, `.text-page-greeting`, `PageHeader`) are Newsreader; everything else is Inter. Nothing a user must read is below `--text-caption` (11px). Size text with the `--text-*` tokens (the `length:` arbitrary-value form), never raw pixel sizes.
- **Colour.** Tailwind's palette is switched off (`--color-*: initial`), so `text-white`, `bg-red-500`, `bg-black/50` compile to *nothing*. Use tokens, or the semantic utilities `text-danger` / `text-success` / `text-warning` / `text-info` / `text-on-accent` / `bg-overlay`. Never `rgba(255,255,255,…)`: it disappears in light mode.
- **Motion.** House curve is `--ease-out`; exits run faster than entrances; framer springs are critically damped (`damping ≥ 2·√stiffness`) so nothing overshoots. `MotionProvider` honours both the OS setting and the in-app Reduce motion toggle. Use `transition` / `transition-[…]`, never `transition-all`.
- **Ensō, the motion signature.** The hand-painted ensō (`Enso` in `components/ui/Enso.tsx`) is Presense's one piece of character motion: ink drawn in a single brush stroke, then the dot (the present moment) lands, then it rests. It appears where a moment earns it: signing in, finishing a task (the checkbox closes into the ensō and the title is crossed out with a brush line), an empty day on Do, the focus "Nice start" screen, and as the spinner while something loads. It draws once and never loops (except as a spinner), uses only CSS (`.enso-draw`, a conic mask on `--enso-p`), and shows finished under Reduce motion. Don't add other decorative motion; when a moment deserves one, reach for this. The logo (`BrandMark`, the favicons and the app icons) is the same brush, still: ink in the text colour with an `--accent` sun. Small sizes use the one-stroke brush; the home screen icons in `public/` use the bristled one. Every icon file in `public/` (favicons, Apple touch icon, manifest PNGs) is rendered by `scripts/generate-icons.mjs`; rerun it rather than editing them. The brush shapes are generated by `scripts/generate-enso.mjs`; regenerate rather than hand-edit `enso-brush-ink.ts` / `enso-brush-small.ts` (two files so the logo never pulls in the bristled one), and remeasure the dot position in `Enso.tsx` if the shape changes.
- **Controls.** One page header (`PageHeader`), one view switch (`SegmentedControl`), one filter/toggle chip (`.chip` + `aria-pressed`), one switch (`.toggle-track` button with `role="switch"` + `aria-checked`).
- **Panels & menus.** Edit/add surfaces use `Sheet` (portalled to `document.body`; actions go in its `footer` prop, tied to the form with `form="…"`). Selects use `Dropdown`, popovers `Popover`: both position with `transform: false` because framer-motion owns the panel's transform. Floating UI that handles Escape calls `preventDefault()` so the enclosing sheet or dialog stays open. Field labels use `.field-label` (sentence case); `.text-label` is for section eyebrows only.
- **Settings** is grouped lists: `SettingsGroup` → `SettingRow` (label, description, control; `stack` for wide controls) in `SettingsModal.tsx`. One save indicator, in the header.
- **Haptics** go through `useHaptics()`: short single pulses; only `error` repeats.
- **Feedback.** `sonner` toasts are the only in-app feedback. A reversible write (trash, complete, route, snooze) shows a past-tense success toast with Undo ("Task moved to trash"). A failure shows `friendlyError(err)` from `src/lib/friendly-error.ts`, never raw database wording or a silent no-op.
- **Deleting.** Deleting something the user made is a soft delete through `src/lib/item-lifecycle.ts` (the only code that writes `status`), recoverable from `/trash` for 30 days. Anything permanent (Trash's "Delete forever", "Clear stale places", deleting the account) asks first through `ConfirmModal` and says it can't be undone. Status meanings: `docs/architecture/status-lifecycle-vocabulary.md`.
- **Keyboard.** App-wide shortcuts live only in `AppContentWrapper`'s handler, and are inert while the user is typing. A component listens for keys only while it's open (Escape, its own lists). Dialogs and sheets trap and restore focus through `useDialogFocus`.
- **Mobile shell.** Bottom navigation is a floating dock (`.dock`, tabs flagged `bottom` in `nav-config.ts`, split evenly around a centred Capture). The top bar follows the large-title pattern: its title only fades in once the page's own title has scrolled away.

## 4. Line endings

The working tree is CRLF. Tools that rewrite files in LF produce whole-file diffs — normalise before committing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

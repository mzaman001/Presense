# Presense — current state

There is no ticket queue. Work is chosen by reading the code and judging what most improves the product; see [`AGENTS.md`](../AGENTS.md).

Last full pass: **2026-09-13**.

## Done in that pass

- `npm ci` fixed — the lockfile was out of sync with `package.json`, so CI and any clean install failed outright.
- `npm run lint` taken from 48 errors to 0, and scoped to `src scripts`.
- `prebuild` hook removed — it ran a Supabase type-drift check that broke every build without CLI access.
- 47 client-side `supabase.auth.getUser()` round trips replaced with a server-provided `SessionProvider`.
- Realtime unified on `RealtimeProvider`; the duplicate standalone subscription path in `useRealtime` removed, and channel setup made non-fatal.
- Error boundaries (`global-error.tsx`, `AppErrorFallback`) now report to Sentry — previously every caught crash was invisible.
- Modal chunks genuinely deferred; hover-only row actions made usable on touch; search results for People/Locations fixed (they pointed at routes that do not exist).
- Dead code removed: `/explore/trash` (unreachable duplicate), `BorderBeam`, `BentoGrid`, `card`, `progress`, `tabs`, Lenis, and the `shadcn` CLI as a runtime dependency (−196 packages).

## Open, in rough priority order

1. **Move pages to Server Components.** Every `(app)` page is `"use client"`. This drives the bundle size, the spinners and the memory profile.
2. **Re-measure Core Web Vitals.** The numbers on record are from 2026-08-09 and predate this work.
3. **Split the oversized components** — `SettingsModal` (75 KB), `RitualOverlay` (60 KB), `TaskAddPanel` (47 KB), `Navigation` (31 KB), home `page.tsx` (54 KB). Split along real responsibility seams, not line count.
4. **Human action — secrets.** `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in Vercel (source maps are unreadable without them); `CRON_SECRET` in Supabase Edge Function secrets.
5. **Supabase advisors:** enable leaked-password protection; set `search_path` on `public.pgrst_watch`; move `pg_trgm` out of `public`; confirm `rename_category` should stay `SECURITY DEFINER` and callable by `authenticated`.
6. **Trim the docs tree** — see the deletion list in the handover notes.

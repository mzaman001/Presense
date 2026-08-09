# Implementation Plan: PERF-12 task 4 — remaining TTFB + main-thread cost on authed routes

> **Status: COMPLETE (Aug 10, 2026).** Gate 1 chose Option A (leave `user_settings`). Task 4.1 attribution produced the TTFB split (proxy getUser 293–366 ms / layout settings ~300 ms / render ~60 ms) and chunk verdict (shared invariant-required shell). Task 4.2 closed TTFB work with attribution (doc-only). Task 4.3 closed with attribution (no app-level lever). Evidence committed to `docs/plans/EXECUTION_SPEC.md` §28 + §26.5. Remaining for the human: PERF-12 extend-vs-close decision (TBT met; LCP 6.4 s / perf 53–55 short of targets).

## Overview

PERF-12 fixes 1 (getSession, `c611f4e`) and 2 (lazy TaskAddPanel/CalendarView, `235a234`) are done. Remaining measured gap on authed `/do`: **TTFB 0.62 s warm** (Lighthouse 640/660 ms) and **LCP 6.4–6.7 s** with ~4.4 s of main-thread work. This plan breaks down the two remaining cost centers into small, gated tasks:

1. **~300 ms layout `user_settings` round trip** — the last big server-latency item in TTFB.
2. **Shared chunk `0cau6ws9nif22` (233 KB raw, ~64 KiB gz, ~1.43 s eval)** — present in the initial script set of EVERY `(app)` route (`/`, `/inbox`, `/explore`, `/do` verified), i.e. app-shell code that cannot be lazy-loaded per-route.

Because both items are shared/security-adjacent infrastructure, the plan is measure-first with **two explicit human decision gates**; option "close with attribution" (PERF-11 precedent) is always on the table.

## Architecture Decisions (with evidence)

- **TTFB attribution (measured this session):** warm TTFB 0.62 s ≈ proxy `getUser()` (~300 ms auth-server round trip, `src/proxy.ts:99-101`, runs in middleware before every request) + layout `user_settings` (~300 ms, `(app)/layout.tsx:42-46`) + SSR render (~60 ms, probed in fix 1). Both DB/auth round trips are serial and latency-bound (Supabase RTT ~150 ms each leg).
- **Proxy `getUser()` is the security boundary** — it verifies token revocation server-side per request. Replacing it with cookie-local `getSession()` (as done in the layout) would accept revoked sessions until JWT expiry. **Default: DO NOT change.** Any proposal to touch it needs explicit human sign-off (security decision).
- **The layout `user_settings` fetch cannot be trimmed by columns** — onboarding gating (`onboarding_complete`, redirect logic at layout.tsx:48-66) is SSR-critical and one round trip regardless of selected columns. The full row also seeds `AppInitializer` (`initialSettings`, store seed). It is latency-bound, not size-bound.
- **Theme first paint is already effect-based** (`AppInitializer.tsx:63-83` applies `applyDocumentTheme` in a post-hydration `useEffect`; SSR settings only seed the store). So a client-side reconcile (React Query already exists with 5-min `staleTime`, `QueryProvider.tsx`) can correct a stale SSR seed without a visible theme regression — this is what makes a TTL-cache option viable.
- **Turbopack is the default prod build** (measured script sets are turbopack chunks). Manual `webpack.config` `splitChunks` does NOT apply to turbopack builds, so "split chunk 0cau6ws9nif22" via config is **not an app lever**. The only app-level levers are import restructuring (barrel decoupling, moving heavy modules out of the layout entry). Whether that applies depends on the module map from Task 4.1.
- **Law 7 (stop-and-ask):** any option that touches layout/provider wiring or exceeds 3 files needs human approval — built into the gates below.
- All perf changes must be re-measured identically to §26.1 (2 authed Lighthouse runs + deterministic HTML script-set method) and recorded in §26.5, kept only if outside variance or deterministic, reverted otherwise.

## Task List

### Phase 1: Attribution (no code changes)

- [ ] **Task 4.1: Re-attribute remaining TTFB + map chunk 0cau6ws9nif22** (XS, read-only + temp probes, all reverted)
  - Probe (temp, reverted) the exact split: middleware `getUser()` vs layout `user_settings` vs render on warm server.
  - Rebuild `ANALYZE=true npx next build --webpack` and map the shared shell modules (reuse `map-do-chunks.cjs`); determine whether 0cau6ws9nif22 is lib-merge (framer-motion/date-fns etc. — not app-reclaimable) or app code with a barrel-import culprit (reclaimable).
  - Record evidence table in §28 (no commit of code; doc-only note or commit if desired).
  - **Acceptance:** measured split table (proxy / layout / render, ms) + chunk module map with verdict (reclaimable vs framework-chunking) + recomputed per-route script-set total.

### Gate 1 (human): choose TTFB option
- **A. Leave `user_settings` as-is** — close TTFB work with attribution (remaining ~300 ms is the price of SSR onboarding gating; TTFB 0.62 s is already 2.4× better than baseline 1.47 s).
- **B. Server TTL cache** (`unstable_cache` keyed by user, `revalidate: 2–5 s`) + client reconcile via React Query so a stale SSR seed self-corrects ~300 ms after mount. Files: `src/lib/` new cache helper, `(app)/layout.tsx`, `AppInitializer.tsx` (or a small settings query hook), possibly `useAppStore` — **3–5 files, layout/provider-adjacent → requires Law 7 approval**. Risk: settings save (SettingsModal writes client-side, no invalidation channel) shows stale theme/values for ≤TTL on immediate reload; mitigated by client reconcile + short TTL.
- **C. Move onboarding gating + settings entirely client-side** — REJECTED by default: onboarding redirect becomes post-hydration (flash/redirect-loop UX regression) and loses SSR gating; listed for completeness only.

### Phase 2: Execute chosen TTFB option

- [ ] **Task 4.2: Implement TTFB option** (S–M per gate: A = doc-only close; B = 3–5 files)
  - A: record verdict in §26.5 + §28, no code.
  - B: cache helper + layout wiring + client reconcile; verify settings-save → reload correctness manually.
  - **Acceptance:** warm curl TTFB ≤ 0.35 s (from 0.62) for B; settings change reflects on reload within ~1 s (manual check); onboarding redirect flow unchanged (seeded test account + fresh account check); `npm test` 144/144; build green.
  - **Verification:** 2 authed Lighthouse runs A/B; ledger §26.5 row; §28 status.

### Phase 3: Main-thread chunk

- [ ] **Task 4.3: Address shared chunk 0cau6ws9nif22 based on 4.1 mapping** (S)
  - If module map shows a heavy barrel-import pulled into layout scope: decouple it (move to page-level or direct imports), re-measure.
  - If lib-merge/framework chunking: **close with attribution** (like PERF-11) — chunking is not an app lever under turbopack.
  - **Acceptance:** either script-set gz reduced on all (app) routes with 2×Lighthouse parity-or-better, or a documented close-with-attribution verdict.
  - **Verification:** 2 authed Lighthouse runs on `/do` + script-set totals; ledger §26.5; §28 status.

### Checkpoint: PERF-12 close-out
- [ ] All tasks' acceptance criteria met or closed with attribution
- [ ] `npm test` 144/144, `npm run build` green
- [ ] Ledger §26.5 has rows for every attempt (kept or reverted)
- [ ] §28 status paragraphs updated
- [ ] Final PERF-12 verdict vs acceptance (perf ≥ 70, LCP ≤ 4 s, TBT ≤ 1 s) — likely: TBT target met (440/450 ms), LCP and perf still short → decide extend-vs-close with human
- [ ] Review with human before proceeding to any further work

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TTL cache shows stale theme/settings after save on immediate reload | Med (UX complaint) | Short TTL (2–5 s) + client reconcile via existing React Query (5-min staleTime already in place); manual verification in 4.2 |
| Touching layout/provider wiring breaks onboarding redirect gating | High (redirect loop regression) | Keep server-side gating logic untouched in option B; regression-check onboarding in 4.2 acceptance |
| Chunk surgery attempt breaks shared shell across all routes | High | Measure-first (4.1 mapping); default to close-with-attribution (PERF-11 precedent); turbopack chunking is not app-configurable |
| Proxy getUser → getSession would weaken session revocation | High (security) | Explicit non-goal; any change needs separate human security sign-off |
| LCP/perf targets (≤4 s / ≥70) unreachable at app level | Med | Attribution-first approach; PERF-12 may close like PERF-11 with evidence (LCP 13.4 → 6.4 s = −52% already, deterministic bundle cuts) |

## Open Questions (for Gate 1 + Checkpoint)
1. **TTFB option: A (leave) or B (TTL cache + client reconcile)?** B is the only real lever for the last ~300 ms but is Law 7-adjacent and adds staleness complexity. Recommendation: **A** unless TTFB < 0.5 s is a hard goal — the remaining cost is bounded and B's risk/benefit is marginal.
2. Is the 1.43 s shared-chunk eval acceptable if mapping shows it's lib-merge (framework chunking)? (Recommendation: yes — close with attribution.)
3. If PERF-12 close-out shows LCP ~6.4 s with only framework/main-thread cost left, is that acceptable for closing PERF-12 with attribution, or should a follow-up ticket (e.g., client-side rendering strategy for /do) be opened? (Recommendation: close PERF-12, open follow-up ticket.)

# Task List — OBS-01 Sentry error/performance sink

Status legend: [ ] pending · [~] in progress · [x] done

## Phase 1: Foundation
- [x] Task 1: DONE — `@sentry/nextjs@10.70.0` installed; `src/instrumentation-client.ts` REPURPOSED (not dead — Next 16 auto-loads it, proven in `.next` bundle): Sentry.init (DSN-gated) + `onRouterTransitionStart` export, manual error listeners removed (SDK auto-captures); `src/sentry.server.config.ts` + `src/sentry.edge.config.ts` (DSN-gated); `withSentryConfig(analyze(withSerwist(nextConfig)), { silent: !CI })`; `NEXT_PUBLIC_SENTRY_DSN` in env.ts (`.catch`) + `.env.example` placeholder + `.env.local` real DSN (EU ingest)
  - Gate: build green — passed TWICE (turbopack + withSentryConfig compose fine; no fallback needed); no "ACTION REQUIRED" after hook added
  - Verify: `npm test` baseline pending (runs at Task 5)

## Checkpoint: SDK foundation
- [x] Build green (turbopack) ×2, tsc clean, no DSN → no crash (all init DSN-gated)

## Phase 2: Capture wiring
- [x] Task 2: DONE — telemetry route forwards: `client-error` → `captureMessage(level "error")`, `web-vital` → `captureMessage(level "info")` with context extras; Zod/400/204 kept; `telemetry-route.test.ts` 5/5 (mocked `@sentry/nextjs`; both kinds + invalid payload/json)
- [x] Task 3: DONE — `Sentry.captureException(error)` added to catch blocks in `account`, `capture`, `people/reorder` routes; `auth/callback` has no try/catch (Supabase returns errors, doesn't throw) → skipped per plan; full suite 176/176 (16 files) green after edits
- [x] Task 4: DONE — `cspReportUri(dsn)` exported from `src/proxy.ts` (regex parse; preserves EU `ingest.de.sentry.io` host); `buildCspHeader` appends `report-uri https://o<org>.ingest.<host>/api/<proj>/security/?sentry_key=<key>` when DSN set, byte-identical otherwise; `middleware.test.ts` 12/12 — helper unit cases (EU/US/invalid) + absent/present e2e via lazy-getter env mock (repo convention from account-route.test.ts; naive factory captured env at import-hoist time → swapped to getters)

## Checkpoint: capture wiring
- [x] Focused tests green (telemetry 5/5, middleware 12/12); full suite 181/181 sequential; build green

## Phase 3: Full verification + close-out
- [x] Task 5: DONE — full suite 181/181 sequential (`challenger.test.tsx` flaky only under file-parallelism; passes standalone ×2 — pre-existing, noted as follow-up), build exit 0, lint-staged 0; committed `83a95e1` `fix: OBS-01 Sentry wired - telemetry forwards, API 500s captured, CSP report-uri, DSN-gated` (15 files)
- [x] Task 6: DONE — EXECUTION_SPEC §29 OBS-01 → ✅ CLOSED (TOOL-06 satisfied; TOOL-05 unchanged w/ decision; follow-ups listed); DOCS_NEEDS_CODE OBS-01 → RESOLVED + entry in Resolved; CONTEXT.md stack row/sentinels/comments/tree; README Error Tracking row; audit §3/§5/§7 DONE annotations (commit pending)

## Checkpoint: OBS-01 complete
- [ ] `rg "OBS-01" docs` → closed-status only; no doc claims telemetry is a black hole (run after docs commit)
- [ ] Push both commits after human review; follow-ups recorded (source maps, account deleteUser branch, sampling/replay tuning, challenger flake)

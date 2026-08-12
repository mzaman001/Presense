# Implementation Plan: OBS-01 — Wire a real production error/performance sink

> **✅ COMPLETE Aug 12, 2026 — commit `83a95e1` (`fix: OBS-01 Sentry wired — telemetry forwards, API 500s captured, CSP report-uri, DSN-gated`).**
> Deltas from this plan, recorded at execution: (1) plan-mode's "`instrumentation-client.ts` is imported nowhere / dead" claim was **wrong** — Next 16 auto-loads it as client instrumentation (proven present in the `.next` client bundle), so the file was **repurposed** as the client init site (per current SDK v10 docs naming) instead of deleted; (2) SDK v10 naming is `instrumentation-client.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts` — no `sentry.client.config.ts`; (3) Turbopack + `withSentryConfig` compose cleanly, so the documented fallback to `@sentry/browser`+`@sentry/node` was **not** needed; (4) all init files `release` from `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` fallback `"development"`. Full suite 181/181 sequential; `npm run build` green ×2; lint-staged 0 errors.

## Overview

`EXECUTION_SPEC` §29 `OBS-01` (Critical for release): no layer ships error/telemetry data anywhere durable. Verified in plan mode: `/api/telemetry` Zod-validates then `console.warn`s and returns 204 (data discarded); `logger.ts` is Pino with no transport; `package.json` has no Sentry. **Bonus finding:** `src/instrumentation-client.ts` (window `error`/`unhandledrejection` handlers → `/api/telemetry`) is **imported nowhere** — grep across `src` returns zero references — so client errors have never been captured at all. `WebVitalsReporter.tsx` (root layout) does POST web vitals to `/api/telemetry`, which then discards them. Plan: adopt **Sentry** (the sink named by `BUG-38`'s `safeMutate()` "report to Sentry once TOOL-06 lands" contract and by `TOOL-06`/`OBS-01`), wire the telemetry endpoint + API-route catch blocks + client to it, DSN-gated so the app never crashes or breaks when the DSN is absent (invariant #1 culture).

## Architecture Decisions

- **Sentry via `@sentry/nextjs` (primary), not a hand-rolled pipeline.** One SDK wires client + server + edge, auto-instruments App Router route handlers (unhandled throws are captured without per-route code), and the ticket + `TOOL-06` both name it. **Documented fallback:** if `withSentryConfig` breaks the Turbopack build (Sentry's webpack-plugin lineage + Next 16 + Serwist's config wrapper — the highest-risk integration point), switch to `@sentry/browser` + `@sentry/node` with manual `Sentry.init` in a small `src/lib/sentry.ts`; every capture site below already calls the SDK explicitly, so the fallback changes only the init/wiring, not the call sites. Vercel Log Drains rejected: no grouping/alerting, and the BUG-38 contract literally says "Sentry".
- **DSN-gated, never-throwing:** `NEXT_PUBLIC_SENTRY_DSN` goes in `env.ts`'s client block with the same `.catch(() => logAndReturnEmpty(...))` pattern (invariant #1). When absent, `Sentry.init` no-ops and capture calls are safe no-ops. No DSN = exactly today's behavior, plus nothing crashes.
- **`/api/telemetry` stays the intake point and forwards:** keeps the existing Zod schema + 204 contract (WebVitalsReporter and any future beacons keep working); `client-error` → `captureMessage(level: "error", context)`, `web-vital` → `captureMessage(level: "info")` (Sentry's own web-vitals capture in the browser SDK may duplicate some vitals — accepted, noted; dedupe later if noisy).
- **API routes: explicit `captureException` in existing try/catch blocks.** Our routes swallow errors (`catch { logger.error(...); return 500 }`), so automatic instrumentation alone won't see them. The 4 try/catch routes get one line each: `account`, `capture`, `people/reorder`, and `auth/callback` if it has a catch (checked at execution).
- **Client wiring replaces the dead file:** create `sentry.client.config.ts` (SDK convention, auto-injected by `withSentryConfig`) and **delete `src/instrumentation-client.ts`** — it is dead code (zero references; not under `ui/`, not a migration, safe per invariant #6) and its job is superseded by the browser SDK's automatic `window error`/`unhandledrejection` capture. CONTEXT.md lists it — update CONTEXT.
- **CSP `report-uri` (audit §5):** in `src/proxy.ts`, when the DSN is set, derive the Sentry security-endpoint URL from it (`https://o<org>.ingest.sentry.io/api/<project>/security/?sentry_key=<key>`) and append `report-uri` to `buildCspHeader`'s output; absent DSN → no directive (proxy stays deterministic).
- **`logger.ts` (TOOL-05) deliberately unchanged:** Pino stays for local/structured server logs; OBS-01 does not add a log-drain transport. Decision recorded in the OBS-01 close-out: Sentry captures errors/context; a separate log-drain is `TOOL-05`'s scope, to be evaluated against Sentry breadcrumbs (per TOOL-05's own "do not stand up two overlapping systems" requirement).
- **Release tag:** pass `release: <git sha>` (reuse the `revision` pattern from `next.config.ts`) + `environment: process.env.NODE_ENU` in init files so events group by deploy.

## Task List

### Phase 1: Foundation — SDK install + init

- [ ] **Task 1: Install `@sentry/nextjs`, create init files, wrap config, env plumbing** (M, ~5 files)
  - **Description:** `npm i @sentry/nextjs`. Create `sentry.client.config.ts` and `sentry.server.config.ts` (DSN-gated `Sentry.init`, `release` from git sha, `environment`); wrap `next.config.ts` with `withSentryConfig` (`withSentryConfig(analyze(withSerwist(nextConfig)))`). Add `NEXT_PUBLIC_SENTRY_DSN` to `env.ts` client block with the `.catch` pattern and to `.env.example`. Delete dead `src/instrumentation-client.ts`.
  - **Acceptance criteria:**
    - [ ] `npm run build` (Turbopack) green with the SDK wrapped in config — the riskiest step, verified first; if it breaks, execute the documented fallback (`@sentry/browser` + `@sentry/node`, manual `src/lib/sentry.ts` init) and record why in the PR
    - [ ] `npx tsc --noEmit` clean; env.ts still never throws with no DSN set
    - [ ] `rg "instrumentation-client" src` → 0 hits (file deleted)
  - **Verification:**
    - [ ] `npm run build`; `npx tsc --noEmit`; `npm test` (baseline suite unchanged)
    - [ ] Manual: start dev with no DSN → app loads, zero console errors from Sentry
  - **Dependencies:** None
  - **Files likely touched:** `package.json` + lockfile, `sentry.client.config.ts` (new), `sentry.server.config.ts` (new), `next.config.ts`, `src/lib/env.ts`, `.env.example`, deleted `src/instrumentation-client.ts`
  - **Estimated scope:** Medium (5-7 files incl. lockfile)

### Checkpoint: SDK foundation
- [ ] Build green (turbopack), tsc clean, full suite still green, no DSN → no crash

### Phase 2: Capture wiring

- [ ] **Task 2: `/api/telemetry` forwards to Sentry instead of `console.warn`** (S, 2 files)
  - **Description:** Replace `console.warn("[telemetry]", parsed.data)` with per-kind capture: `client-error` → `Sentry.captureMessage(message, { level: "error" })` with stack/source/path in `contexts`; `web-vital` → `Sentry.captureMessage(name, { level: "info" })` with value/rating/path. Keep Zod validation, 400s, and 204. New test `src/app/api/__tests__/telemetry-route.test.ts`: mock `@sentry/nextjs`; assert `captureMessage` called with `level: "error"` for a `client-error` payload and `level: "info"` for a `web-vital` payload; 400 on invalid payload; 204 with no DSN still works (capture no-ops).
  - **Acceptance criteria:**
    - [ ] No `console.warn` remains in `telemetry/route.ts` (`rg "console.warn.*telemetry"` → 0)
    - [ ] Both payload kinds reach `Sentry.captureMessage` with correct levels (tested); invalid payloads still 400; valid → 204
  - **Verification:**
    - [ ] `npx vitest run src/app/api/__tests__/telemetry-route.test.ts`; `npx tsc --noEmit`
  - **Dependencies:** Task 1
  - **Files likely touched:** `src/app/api/telemetry/route.ts`, `src/app/api/__tests__/telemetry-route.test.ts` (new)
  - **Estimated scope:** Small (2 files)

- [ ] **Task 3: `captureException` in the API-route catch blocks** (S, 4-5 files)
  - **Description:** Add `Sentry.captureException(error)` alongside `logger.error(...)` in the catch blocks of `account/route.ts`, `capture/route.ts`, `people/reorder/route.ts`, and `auth/callback/route.ts` (if it has a try/catch). No response-shape changes. Existing route tests (e.g. `account-route.test.ts`) must stay green — if a test file mocks the route module, add `@sentry/nextjs` to the mock list as needed.
  - **Acceptance criteria:**
    - [ ] Every `catch (error) { logger.error` block in the 4 routes also calls `Sentry.captureException` (`rg -c "captureException" src/app/api` → ≥ 4)
    - [ ] All existing API-route tests pass unchanged in behavior
  - **Verification:**
    - [ ] `npx vitest run src/app/api` (or the routes' test files); `npm run build`
  - **Dependencies:** Task 1
  - **Files likely touched:** `src/app/api/{account,capture,people/reorder}/route.ts`, `src/app/auth/callback/route.ts`, possibly one test file
  - **Estimated scope:** Small (4-5 files)

- [ ] **Task 4: CSP `report-uri` → Sentry security endpoint when DSN set** (XS-S, 1 file)
  - **Description:** In `src/proxy.ts`, parse `NEXT_PUBLIC_SENTRY_DSN` (`https://<key>@o<org>.ingest.sentry.io/<project>`) into the Sentry security-report endpoint URL; when present, append `report-uri <url>` (and keep the directive list otherwise unchanged); when absent, the CSP string is byte-identical to today.
  - **Acceptance criteria:**
    - [ ] With DSN set, `buildCspHeader` output contains `report-uri` pointing at the derived ingest URL; without DSN, output identical to current
    - [ ] CSP tests (if any exist for proxy) pass; otherwise covered by unit test on `buildCspHeader` if it's exported — if not exported, verify via a focused test that imports proxy's helper after exporting it
  - **Verification:**
    - [ ] `npx vitest run src/proxy` (or proxy test file); `npx tsc --noEmit`
  - **Dependencies:** Task 1
  - **Files likely touched:** `src/proxy.ts` (+ its test if one exists)
  - **Estimated scope:** XS-S (1-2 files)

### Checkpoint: capture wiring
- [ ] Focused tests green; tsc clean; build green

### Phase 3: Full verification + close-out

- [ ] **Task 5: Full suite + build + commit** (XS, 0 files)
  - **Description:** Full `npm test`, `npm run build`, lint on staged files, then commit `fix: OBS-01 Sentry wired — telemetry forwards, API 500s captured, CSP report-uri, DSN-gated`. Human reviews before push.
  - **Acceptance criteria:**
    - [ ] `npm test` green (173+ new), `npm run build` exit 0, lint 0 errors on touched files
  - **Verification:** as above
  - **Dependencies:** Tasks 2-4
  - **Estimated scope:** XS

- [ ] **Task 6: Docs close-out** (S, 4-5 files)
  - **Description:** `EXECUTION_SPEC.md` §29 `OBS-01` → ✅ CLOSED (commit + evidence; note `TOOL-06`/`INFRA-01` error-tracking requirement satisfied by this ticket, `TOOL-05` unchanged with the recorded decision). `DOCS_NEEDS_CODE.md`: move `OBS-01` to Resolved; mark the pre-existing "/api/telemetry is a black hole" entry Resolved; leave the `logger.ts` entry open (TOOL-05) with a cross-note. `CONTEXT.md`: telemetry/logger/error-handler rows + ROOT PATTERN 7's "black hole" bullet; delete the `instrumentation-client.ts` row (file removed). `README.md`: replace the "Logging — stub" line. Audit doc §7 item 2 → DONE annotation.
  - **Acceptance criteria:**
    - [ ] `rg "OBS-01" docs` → closed-status references only; no doc claims telemetry is a black hole
  - **Verification:** grep across `docs/`
  - **Dependencies:** Task 5
  - **Files likely touched:** `docs/plans/EXECUTION_SPEC.md`, `docs/project/DOCS_NEEDS_CODE.md`, `docs/project/CONTEXT.md`, `README.md`, `docs/audits/2026-08-08-EXTERNAL-AUDIT.md`
  - **Estimated scope:** Small (5 files)

### Checkpoint: OBS-01 complete
- [ ] All tasks done; commit + docs commit pushed after human review
- [ ] Remaining follow-ups recorded, not done here: Sentry source-map upload, Sentry release dashboard wiring, `TOOL-05` log-drain decision

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `withSentryConfig` breaks the Turbopack build (Sentry webpack-plugin lineage, double-wrapped config with Serwist, Next 16) | High — blocks everything | Task 1 gates on a green `npm run build` immediately after install; documented fallback to `@sentry/browser` + `@sentry/node` with identical call sites |
| No DSN available (Sentry account/credentials) | Med — code lands inert | DSN-gated design: everything ships and no-ops safely; human adds the DSN to Vercel env + local `.env` later; nothing crashes either way |
| SDK bundle cost on the measured login route (PERF-09 budget gate at 165 KiB gz) | Med | `@sentry/nextjs` client only ships when `NEXT_PUBLIC_SENTRY_DSN` is set at build time (SDK behavior); budget gate in CI will catch a breach — if it does, lazy-init via dynamic import and re-measure per §26.1 |
| Double-reporting (manual telemetry beacons + SDK auto-capture) | Low | `client-error` beacons stop existing once the dead file is deleted; web-vitals duplication (beacon + SDK) accepted and noted |
| `removeConsole` (PERF-13, open) strips `console.*` in prod — Sentry unaffected | Low | Sentry captures programmatically, not via console; no dependency |
| CI `npm run lint` catches pre-existing errors in files I touch (lint-staged blocks commits) | Med | Same as previous tickets: fix or targeted-disable with justification, keep 0 errors on staged files |

## Open Questions

- **Sentry account/DSN:** I will not create a Sentry account. The code is DSN-gated; whoever owns deployment adds `NEXT_PUBLIC_SENTRY_DSN` to Vercel + `.env`. If the human has a DSN ready, provide it before Task 5's verification so the manual check ("error appears in tracker") can be real; otherwise the unit tests + code review stand in, matching SEC2-01's precedent.
- **`@sentry/nextjs` vs fallback:** decided in Architecture Decisions (primary + documented fallback) — no separate approval needed unless the human objects.

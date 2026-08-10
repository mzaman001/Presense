# Task List — SEC2-01 rate limiter parameterization

Status legend: [ ] pending · [~] in progress · [x] done

## Phase 1: Implementation
- [x] Task 1: Parameterize `rate-limit.ts` — bucket registry (`Map<string, Ratelimit>`), `slidingWindow(maxRequests, windowMs)` + `prefix: "rl:<bucket>"` per bucket; signature `checkRateLimit(bucket, key, maxRequests, windowMs)`; in-memory key `${bucket}:${key}`; one dev-warn. Call sites: account `("account", user.id, 3, 60_000)`, capture `("capture", user.id, 100, 60_000)`, people/reorder `("people-reorder", user.id, 30, 60_000)`
  - Note: v2 `slidingWindow` rejects bare-number windows — formatted as `Duration` string (`"60 s"`)
  - Verify: `npx tsc --noEmit` clean + focused vitest green + `npm run build` ✓

## Checkpoint: implementation compiles
- [x] `npx tsc --noEmit` clean; existing rate-limit/account tests green

## Phase 2: Regression tests
- [x] Task 2: Extend `rate-limit.test.ts` (7 tests) — in-memory: 4th account request in 60s rejected / capture unaffected / expiry re-allows / fail-closed in prod; Redis-path (mocked): per-bucket constructor args (`slidingWindow(3, "60 s")`, `prefix "rl:account"`), one instance per bucket; lazy-init kept

## Checkpoint: focused tests green
- [x] `npx vitest run src/lib/__tests__/rate-limit.test.ts` green (7/7); lint 0 errors on all 5 touched files

## Phase 3: Full verification + close-out
- [x] Task 3: `npm test` 173/173, `npm run build` exit 0; commit `e895df8` `fix: SEC2-01 rate limiter parameterized per bucket — account-delete 3/min enforced`
- [x] Task 4: Docs close-out — EXECUTION_SPEC §29 SEC2-01 → ✅ CLOSED (commit + evidence); DOCS_NEEDS_CODE moved to Resolved; audit §7 item 1 + §4 table row annotated DONE (commit `bc30065`)

## Checkpoint: SEC2-01 complete
- [x] `rg "SEC2-01"` docs → closed-status/historical references only
- [ ] Push after human review (`e895df8`, `bc30065`)

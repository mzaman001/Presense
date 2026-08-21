# Presense Execution Spec (Active)

**Backlog Status:** Pruned Aug 21, 2026. **Closed history archived at:** `docs/audits/archive/EXECUTION_SPEC-archive-aug21.md`.

## 0. The Rule

This is the only active backlog. Ticket IDs: `BUG-*`, `DS-*`, `A11Y-*`, `MOB-*`, `INT-*`, `PERF-*`, `INFRA-*`, `TOOL-*`, `MD-*`, `CONF-*`, `SEC2-*`, `SEC3-*`, `AUDIT-*`. **One ticket at a time. Build + Test + Commit + Stop.**

## 1. High Priority — Unblocked

**SEC2-03 — Magic-link rate limiting + account-enumeration closure [High].**
- **Problem:** `sendMagicLink` in `login/actions.ts` returns raw `error.message` (enumeration) and has no rate limit.
- **Requirement:** Apply `checkRateLimit("magic-link", email + "|" + ip, max, windowMs)` using the existing `rate-limit.ts` helper. Return a **generic** "if an account exists, a link was sent" response for all cases.
- **Acceptance:** Known/unknown emails return identical success text; 4+ requests in window are rejected; build/tests green.
- **Status:** ⬜ **OPEN** (Frozen Aug 21 during governance reset).

**TOOL-11 — Sentry source maps and releases [Medium].**
- **Problem:** Build logs show "No auth token provided. Will not create release." Sentry issues are minified.
- **Requirement:** Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` to Vercel secrets (Production).
- **Status:** ⬜ **OPEN** (Awaiting human secret configuration).

**SEC3-02 — `CRON_SECRET` runtime secret [Medium-High].**
- **Problem:** Cron functions run in passthrough because `CRON_SECRET` is unset in Supabase Dashboard.
- **Requirement:** Add `CRON_SECRET` (value from INFRA-25 notes) to Supabase Edge Function Secrets.
- **Status:** ⬜ **OPEN** (Human action required).

## 2. Performance & Debt

**PERF-14 — Zustand selector reads [High].**
- **Problem:** Whole-store subscriptions (`useAppStore()`) cause unnecessary re-renders.
- **Requirement:** Sweep all components and replace with selector reads: `useAppStore(state => state.property)`.
- **Status:** ⬜ **OPEN**.

**PERF-15 — Bundle splitting & Dynamic Imports [Medium].**
- **Problem:** Large initial bundle size.
- **Requirement:** Identify large components (Charts, complex Modals) and use `next/dynamic` with `ssr: false` where appropriate.
- **Status:** ⬜ **OPEN**.

**INFRA-24 — Dependabot Vulnerability Triage [Medium].**
- **Problem:** 35 vulnerabilities reported in §31 audit.
- **Requirement:** Merge/update the 10 open dependabot PRs; prioritize `next`, `hono`, `nanoid`, `undici`.
- **Status:** ⬜ **OPEN** (Scheduled for Phase 5 of Governance Reset).

## 3. Design & UI (Frozen for v1)

**DS-16 — Sidebar rail redesign [P1].**
- **Requirement:** Anchored brand/account tiles, 32px uniform icons, 12-16px spacing rhythm, muted inactive states.
- **Status:** ⬜ **OPEN** (Design confirmed, implementation frozen for v1).

**DS-29 — Glassmorphism 2.0 [P2].**
- **Requirement:** Uplift login + onboarding to the new glass design language.
- **Status:** ⬜ **OPEN** (Frozen).

## 4. Governance & Cleanup

**MD-01 — Contradictory Doc Cleanup [High].**
- **Requirement:** Archive `plan.md`, `todo.md`, and `design.md` as they contradict AGENTS.md.
- **Status:** ⬜ **OPEN** (Phase 3 of Governance Reset).

**CI-02 — Lint Error Floor [High].**
- **Requirement:** Maintain 0 errors; current baseline has 54 pre-existing errors (mostly `setState-in-effect` and `missing-dependency`).
- **Status:** ⬜ **OPEN**.

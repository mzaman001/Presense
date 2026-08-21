# Presense v1: Feature Freeze (Aug 21, 2026)

The Presense app is now in a **Feature Freeze** period leading to the v1 launch.

## 1. Goal
Stabilize the codebase, close critical security/performance gaps, and launch the first public version (v1).

## 2. Scope of v1 (The "Must-Haves")
Only the following items are permitted before the v1 tag:
- **Security:** SEC2-03 (Magic-link rate limit) and secret wiring (TOOL-11, SEC3-02).
- **Performance:** PERF-14 (Zustand selectors) and INFRA-24 (Dependency updates).
- **Stability:** Maintenance of the "0 lint errors" and "green tests" baseline.
- **Docs:** Final v1 release notes.

## 3. Out of Scope (Frozen for v2)
- Sidebar rail redesign (DS-16).
- Glassmorphism 2.0 (DS-29).
- Any new features or audits.

## 4. Release Checklist
- [ ] SEC2-03 implemented and verified.
- [ ] All 35 dependabot vulnerabilities triaged/closed.
- [ ] Sentry and Supabase secrets verified in production.
- [ ] `npm run build` and `npm test` pass on a clean `main`.
- [ ] Governance Reset invariants confirmed in `AGENTS.md`.

*Current Active Queue: `docs/QUEUE.md`*

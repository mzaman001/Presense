# Abandoned / Frozen Work (Aug 21, 2026)

This document records work that was mid-flight or planned but abandoned/frozen during the Governance Reset to reduce convolution.

## Frozen for v1

- **SEC2-03 (Magic-link rate limit):** Approved, but frozen during reset. Remains the highest priority post-reset security item.
- **DS-16 (Sidebar redesign):** Design confirmed but implementation frozen to prioritize v1 stability.
- **DS-29 (Glassmorphism 2.0):** Login/onboarding uplift frozen.
- **Sidebar redesign proposals:** `SIDEBAR-REDESIGN-PROPOSAL.md`, `SIDEBAR-DS16-SPEC.md`, `SIDEBAR-DS18-SPEC.md` — frozen.

## Abandoned / Fixed Upstream

- **TOOL-20/21/22 (Local fixes):** Triage found these were largely superseded by the 91 upstream commits. Reconciled only the unmerged substance (TOOL-20 refactor).
- **tasks/plan.md + todo.md:** Contradictory source-of-truth files. Replaced by `docs/QUEUE.md`.
- **docs/project/design.md:** Untracked local debris.

## Blocked

- **OBS-02 (Sentry Wiring):** Awaiting 3 GitHub secrets (`SENTRY_AUTH_TOKEN`, `ORG`, `PROJECT`).
- **SEC3-02 (Supabase Secret):** Awaiting `CRON_SECRET` configuration in Supabase Dashboard.

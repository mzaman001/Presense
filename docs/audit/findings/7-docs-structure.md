# Audit findings: 7-docs-structure

2026-10-08, `main` at `9228e61`. Method:
- read every doc an agent or reader is pointed at (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, README, `.env.example`, `docs/QUEUE.md`, `docs/agents/*`, `docs/project/*`, `docs/architecture/*`, `docs/plans/*`), and checked their claims against the code;
- checked every repo path the docs mention, to find links to files that no longer exist;
- listed the deployed Edge Functions;
- triaged the open code-scanning alerts after slice 6 made Semgrep work;
- checked the root of the repo for stray files.

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 4 |
| P3 | 6 |

**What's solid** (checked, nothing to do):
- **README:** it matches the product: capture, plan, start, the four spaces. Its screenshots exist for both themes, and its keyboard table matches `AppContentWrapper`.
- **`GEMINI.md`:** a pointer to `AGENTS.md`, as it should be.
- **`AGENTS.md`:** most of it holds. `safeMutate`, `ilikeContains` and `escapeFilterValue`, `useUserId` and `useSessionUser`, `task-cache.ts`, the portalled `Dropdown` and `Popover`, and `LazyMotion … strict` all exist as described. There are no `opacity-0 group-hover` row actions and no `transition-all`.
- **Research docs and the dated plans and specs** (`docs/superpowers/*`, `docs/research/*`): dated records of decisions; they don't claim to describe the code as it is now.
- **Code scanning:** the six Next.js alerts closed after #96. Open: the four Semgrep alerts below, and osv #82 (`braces`, dev-only, known).
- **`.sentryclirc`** contains `token=env:SENTRY_AUTH_TOKEN`, an env reference, not a secret.

---

### [P2] Four docs claim authority over the code but describe an app that no longer exists
- **Where:** `docs/agents/EXECUTION_RULES.md`, `docs/project/COMPONENT_MANIFEST.md`, `docs/project/INTERACTION_PATTERNS.md`, `docs/agents/PROGRESS_LOG.md`.
- **Evidence:**
  - **`EXECUTION_RULES.md`** opens "This file is the contract … you MUST follow every rule", next to `AGENTS.md`, which says it wins.
  - **`COMPONENT_MANIFEST.md`** says "stop and ask before building something new". It lists `GlassCard` bugs, `AddPersonPanel` and `ExploreDrawer`, and points to `EXECUTION_SPEC.md` and `DOCS_NEEDS_CODE.md`, neither of which exists.
  - **`INTERACTION_PATTERNS.md`** calls itself "the canonical, enforceable contract … when the code disagrees … the code is wrong". Its rules are built around the Explore and People spaces, which were removed.
  - **`PROGRESS_LOG.md`** ends with "Tickets ready to work", for People panels.
- **Impact:** an agent told to follow these "fixes" the code toward a design that was deliberately removed, or stops to ask about rules nobody holds. `AGENTS.md` §0 calls docs "evidence, not proof", but these four say the opposite of it.
- **Fix:**
  - Delete `EXECUTION_RULES.md` and `PROGRESS_LOG.md`; git history keeps them.
  - Fold anything still true from the other two into `AGENTS.md` §3 (most of it already is: `Sheet`, `Dropdown`, the `.chip` and `.toggle-track` controls, `PageHeader`). Then delete them.
- **Confidence:** confirmed (read against code).

### [P2] `docs/project/ARCHITECTURE.md` describes the July 2026 app
- **Evidence:** it says "verified July 9, 2026". It describes:
  - a glassmorphic UI, Lenis, `compromise.js`, `@serwist/next`;
  - People and Explore routes;
  - `/api/capture` (removed in slice 1) and a `prebuild` type check (removed);
  - "144 tests" (there are 942 now) and 2 Edge Functions (there are 4);
  - `CONTEXT.md` (doesn't exist).
- **Impact:** it's the doc a newcomer would open first, and nearly every specific in it is wrong.
- **Fix:** replace it with a short current one, checked against the code: routes, the data flow (outbox → Supabase → Realtime → TanStack Query), the server-rendered Do list, the four Edge Functions and their crons, the PWA and push design, and where the tests are. Link to `AGENTS.md` for the rules, rather than repeating them.
- **Confidence:** confirmed.

### [P2] `AGENTS.md`, the file that wins every conflict, is wrong in a few places
- **Evidence:**
  - **Auth:** it says `proxy.ts` validates with `getUser()`; it uses `getClaims()` (local verification).
  - **Checks:** "all four of these must pass" lists five commands. It also leaves out the Playwright suite and `deno check`, which CI now runs.
  - **Rendering:** "Most of the app is client-rendered" — the Do list renders on the server since #75.
  - **Invariant 7:** it says error boundaries call `Sentry.captureException`, but client code must use `@/lib/sentry-client` (static `@sentry/nextjs` in client code cost `/login` ~36 KiB, PERF-09). Following the invariant as written breaks the bundle budget.
  - **Touch targets:** "at least 36px" — chips and icon buttons are 44px on touch screens since #91.
- **Impact:** agents follow this file first, so each error is repeated in the next change.
- **Fix:** correct those five points. Add the CI checks and "client code reports through `@/lib/sentry-client`".
- **Confidence:** confirmed.

### [P2] "Run it yourself" in the README doesn't produce a working copy
- **Evidence:**
  - It says Node 20+ (now `>=22` in `engines`).
  - Its cron step says "schedule them in the Supabase dashboard". The schedule is actually in a migration that reads three Vault secrets (`project_url`, `anon_key`, `cron_secret`) and needs the `CRON_SECRET` function secret.
  - It leaves out `push_reminders` and its VAPID secrets.
  - `db push` runs migrations 001–009, which don't match what production ran (slice 1, deferred), so a fresh project may not end up with the same schema.
  - `.env.example` still describes email templates (Google is the only sign-in) and says the service-role key is used only by `/api/account`.
- **Impact:** a self-hoster gets an app whose reminders and recurring tasks never run, with no error.
- **Fix:**
  - Node 22.
  - List the Edge Functions with their secrets and the three Vault entries, or link to a short "Deploying" section in the new `ARCHITECTURE.md`.
  - Flag the migration baseline as known (until the squash session).
  - Update the `.env.example` comments.
- **Confidence:** confirmed (read). A fresh `db push` wasn't run.

### [P3] Smaller items
- **`docs/QUEUE.md`** is a "current state" from 2026-09-13. Its open list is now mostly done or obsolete, and `AGENTS.md` already says how work is chosen. Delete it.
- **`docs/project/DESIGN_SYSTEM.md`** says it can be deleted once the overhaul tokens land in `globals.css`. They have. Delete it.
- **`docs/plans/SECURITY_PERFORMANCE_AUDIT.md`** (August) describes `explores` and `people` tables and a `rename_category` function that are gone. It's history, not a plan. Either delete it, or move it with the other finished records under `docs/archive/` and add a dated banner.
- **`docs/architecture/status-lifecycle-vocabulary.md`:**
  - It says a cron "nudges overdues"; nothing pushes about an overdue task.
  - It says trash is "always reversible for 30 days", but inbox routing now removes the original row (#88, by design: it was never a deletion).
  - It points to the missing `EXECUTION_SPEC.md`.

  Fix those three lines; the rest matches `item-lifecycle.ts`.
- **`CLAUDE.md`:**
  - It asks for `cleanup_trash` to be deleted in the dashboard; it's already gone (deployed: `cron_cleanup`, `cron_recurrence`, `push_reminders`, `push_test`).
  - Its "Verified state (2026-10-04)" table shows 853 tests and 33 lint warnings; it's 942 and 32 now.
- **Semgrep alerts:**
  - #95–#97 (`detect-non-literal-regexp`, `capture-router.ts:206, 384, 396`) are false positives. The patterns come from fixed keyword lists, and `words()` escapes them. Lines 384 and 396 build the same split regex twice from `matchedLocKw`; build it once, escaped, which also clears the alert.
  - #94 (`path-join-resolve-traversal`, a test reading fixed function names) is a false positive. Dismiss it with that reason.
- **`.sentryclirc`** only sets `token=env:SENTRY_AUTH_TOKEN`. sentry-cli and `withSentryConfig` already read `SENTRY_AUTH_TOKEN` from the environment, so the file adds nothing. Delete it.

---

## Coverage

Read against the code:
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, README, `.env.example`;
- `docs/QUEUE.md`, `docs/agents/*`, `docs/project/*`, `docs/architecture/*`, `docs/plans/*`;
- every file path these docs mention (checked to exist);
- the root-level files.

Skimmed only, as dated records: `docs/superpowers/plans|specs/*` (17 files) and `docs/research/*` (2).

Not reviewed: `LICENSE` (MIT, standard) and the `docs/assets/*.webp` screenshots (they exist and the README uses them; they weren't compared with the current UI).

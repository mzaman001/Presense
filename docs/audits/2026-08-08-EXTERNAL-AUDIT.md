# Presense — External Audit & Release-Readiness Review

**Date:** August 8, 2026
**Author:** Claude (Anthropic), acting as external reviewer
**Status:** Supplementary. This is **not** a replacement for `docs/plans/EXECUTION_SPEC.md` or `docs/project/DOCS_NEEDS_CODE.md` — those remain the canonical backlog per `AGENTS.md`. This document (a) verifies a sample of the July 9, 2026 audit's findings are still live in the codebase as of today, (b) adds findings that audit did not cover — mostly CI/CD hygiene, Supabase-specific security/performance deltas, and observability — verified directly against the files on disk, and (c) grounds recommendations in external, dated, multi-source industry practice for August 2026 rather than a single opinion. A human should triage the items below into `EXECUTION_SPEC.md` with proper ticket IDs; the IDs used here (`SEC2-*`, `OBS-*`, `CI-*`, `PWA2-*`) are provisional and chosen only to avoid colliding with the existing `BUG-*`/`DS-*`/`INFRA-*` numbering.

> **TRIAGED Aug 10, 2026** — all §1 findings are now tickets in `EXECUTION_SPEC.md` §29 (Addendum 16), bridged into `docs/project/DOCS_NEEDS_CODE.md`. Provisional-ID resolution: `PERF-07` → duplicate of existing `INFRA-15` (+ `INFRA-17` covers its index check) — **no new ticket**; `INFRA-15` → `INFRA-23`; `PERF-08` → `PERF-13`. Two §7 ship-blockers are now **stale — do not re-fix**: item 3 (BUG-38) and item 4 (warm-light theme, a false positive) were both closed Aug 10, 2026 (see `EXECUTION_SPEC.md` §24.3/§24.7); §6's "BUG-38 remains unresolved" is likewise superseded (commit `660f5a3`).

**Method:** Every finding below was verified by directly reading the file and line in question on August 8, 2026 — not inferred from the existing docs. Every external best-practice claim is backed by at least two independent, dated sources (listed in §9); where sources disagreed, that's noted rather than silently resolved.

---

## 0. Where this project already stands

Read in order: `README.md`, `AGENTS.md`, `docs/plans/EXECUTION_SPEC.md` (1755 lines), `docs/project/DOCS_NEEDS_CODE.md`. This is an unusually well-instrumented codebase for its stage — it already has a dated internal audit (July 9, 2026) with 8 root-cause patterns, ticket IDs, file:line evidence, conflict resolution records, and an agent contract (`docs/agents/EXECUTION_RULES.md`) that enforces one-ticket-at-a-time changes with build+test verification. That audit's P0/P1/P2 triage is sound and should stay the spine of the release plan. Nothing below contradicts it. The gaps this document fills are the ones a documentation-focused audit pass is structurally unlikely to catch: CI pipeline correctness, third-party service configuration, and points where "looks done" and "is done" diverge (e.g., an endpoint that exists and returns 204 but ships no data anywhere).

---

## 1. New, code-verified findings (not in the existing backlog)

These are concrete, file:line-cited, independently reproducible from the repository as it stands today.

### SEC2-01 — Account-deletion rate limit is not actually enforced in production [Critical]

- **Files:** `src/lib/rate-limit.ts:26-34`, `src/app/api/account/route.ts:19`, `src/app/api/capture/route.ts:16`
- **What's wrong:** `checkRateLimit(key, maxRequests, windowMs)` accepts per-call limits, but `getRateLimit()` builds **one module-level singleton** `Ratelimit` instance hardcoded to `Ratelimit.slidingWindow(100, "60 s")` with `prefix: "rl:capture"` — both values taken from the capture endpoint's needs, not parameterized. `account/route.ts:19` calls `checkRateLimit(user.id, 3, 60_000)` intending 3 requests/minute for the destructive delete-account action, but in the Redis-backed production path, that call hits the *same* limiter instance and the *same* key prefix as `/api/capture`. The `3` and `60_000` arguments are silently ignored whenever Redis is configured — only the never-configured in-memory dev fallback actually honors them (`rate-limit.ts:52-66`). Net effect: in production, account deletion is rate-limited to 100/min (and shares its counter with capture traffic) instead of the intended 3/min.
- **Fix:** Parameterize the `Ratelimit` construction (or use a `Map<string, Ratelimit>` keyed by a caller-supplied bucket name) so each call site's limit and prefix are actually respected. Add a regression test asserting the account-delete route rejects a 4th request within a minute.
- **Why it matters now:** this is exactly the kind of "compiles, looks right, silently wrong" bug flagged as the dominant failure mode in AI-assisted Supabase/Next.js codebases in 2026 — it passed review because the call site looks correct in isolation.

### OBS-01 — No production error/performance monitoring is actually wired up [Critical for release]

- **Files:** `src/app/api/telemetry/route.ts:26-33`, `src/lib/logger.ts:1-24`, `package.json` (no `@sentry/*`, no log-drain client of any kind in `dependencies`)
- **What's wrong:** Three layers all look complete but none of them ship data anywhere durable:
  1. `useReportWebVitals`/client-error handlers (implied by the schema in `telemetry/route.ts`) POST to `/api/telemetry`, which validates the payload with Zod and then does `console.warn("[telemetry]", parsed.data)` and returns `204`. That's it — the data is discarded. On Vercel, `console.warn` inside a serverless function reaches the function's ephemeral log stream, which is not searchable, not alertable, and rotates out quickly unless a log drain is separately configured (it is not, per `package.json`).
  2. `logger.ts` wraps Pino with no transport configured beyond default stdout — same fate.
  3. `README.md` already says this out loud: *"Logging — Structured logging (currently a stub — transport not configured)."* This finding formalizes that line into a release blocker: **there is currently no way to learn that something broke in production except a user reporting it.** Given `AGENTS.md` invariant #1 explicitly requires env failures to "report to the error tracker" instead of crashing, and `BUG-38`'s fix plan (`DOCS_NEEDS_CODE.md`) explicitly says the `mutate()` wrapper should report to "Sentry once TOOL-06 lands" — the whole silent-failure mitigation strategy for `BUG-38` currently has no downstream sink to report to.
- **Fix:** Pick one (don't build a custom pipeline): **Sentry** (`@sentry/nextjs`) is the standard 2026 choice for a Next.js App Router project — one init call wires client + server + edge runtime error capture, source maps, and release tracking; or, for a lighter footprint, Vercel's own **Log Drains + Speed Insights + Web Analytics** if the app is Vercel-hosted (near-zero setup, less powerful grouping/alerting than Sentry). Either way, `telemetry/route.ts` needs to actually forward to it instead of `console.warn`.
- **Priority:** This should gate "release-ready," not follow it — you cannot safely ship the `BUG-38` silent-data-loss fixes without somewhere for the errors to go.
- **✅ RESOLVED Aug 12, 2026** (commit `83a95e1`, `fix: OBS-01 Sentry wired — telemetry forwards, API 500s captured, CSP report-uri, DSN-gated`): Sentry (`@sentry/nextjs@10.70.0`) chosen per the `TOOL-06`/`BUG-38` contract. Client init in `src/instrumentation-client.ts` (Next 16 auto-loads it — this audit's own §1 "global error handlers" file was live, not dead; repurposed, manual listeners replaced by the browser SDK's automatic capture, `onRouterTransitionStart` export added) + `sentry.server.config.ts` + `sentry.edge.config.ts`, all DSN-gated (absent DSN = no-op, never throws). `telemetry/route.ts` forwards instead of discarding (`client-error` → `captureMessage` error level, `web-vital` → info level; Zod/400/204 contract kept). Explicit `Sentry.captureException` added to the `account`/`capture`/`people/reorder` catch blocks (our routes swallow errors, so automatic instrumentation alone would miss them). CSP `report-uri` derived from the DSN in `proxy.ts` (§5). Verification: full suite 181/181 sequential, Turbopack build green ×2, lint-staged 0.

### CI-01 — `eslint.yml` lints nothing meaningful and always looks green [High]

- **File:** `.github/workflows/eslint.yml:26-40`
- **What's wrong:** This workflow installs `eslint@8.10.0` fresh on every run and lints with `--config .eslintrc.js`. The repository's actual lint setup is ESLint **9** (`package.json` devDependency `"eslint": "^9"`) using the **flat config** file `eslint.config.mjs` (visible at repo root) — ESLint 8's `.eslintrc.js` convention was retired in this project. `.eslintrc.js` does not exist in this repo, so `npx eslint . --config .eslintrc.js` fails to even locate a config, and the step is wrapped in `continue-on-error: true`, so the job reports success regardless. This is a second, parallel ESLint workflow (the real one is `ci.yml`'s `npm run lint` step) that provides zero signal, silently, forever, while a checkmark sits in the PR UI implying otherwise. This is close to the "workflow theater" pattern security auditors flag as worse than no CI at all, because it manufactures false confidence.
- **Fix:** Delete `eslint.yml` — `ci.yml` already runs `npm run lint` against the real config. If SARIF upload to the GitHub Security tab is the actual goal, add `--format @microsoft/eslint-formatter-sarif` to the *existing* `ci.yml` lint step using the project's real ESLint 9 + flat config, not a second, independently-versioned install.
- **✅ DONE Aug 12, 2026:** `eslint.yml` deleted; `ci.yml`'s `npm run lint` confirmed as the real gate; `rg "\.eslintrc"` outside `docs/` → 0 hits; SARIF upload not added (decision: `semgrep.yml` + `osv-scanner.yml` already feed the GitHub Security tab).

### CI-02 — `trivy.yml` is unedited template boilerplate that cannot succeed [Medium — wasted signal, not a live risk]

- **File:** `.github/workflows/trivy.yml:20-23`
- **What's wrong:** `docker build -t docker.io/my-organization/my-app:${{ github.sha }} .` — `my-organization/my-app` is the literal GitHub-provided placeholder, and there is no `Dockerfile` anywhere in this repository (this is a Vercel-style Next.js deployment, not a container deployment — confirmed by the absence of any `Dockerfile`, `docker-compose.yml`, or container references elsewhere in the repo). Every run of this workflow fails at the `docker build` step before Trivy ever runs.
- **Fix:** Either delete it, or repoint it at what actually matters for this stack: `trivy fs .` (filesystem/dependency + IaC misconfiguration scan) instead of `trivy image`, which needs no Dockerfile and directly complements `osv-scanner.yml` (which already covers dependency CVEs) by adding secret-scanning and misconfiguration checks Trivy does that OSV-Scanner doesn't.
- **✅ DONE Aug 12, 2026 (decision: delete):** `trivy.yml` removed; recorded rationale — cannot ever succeed (no `Dockerfile`), `trivy fs .` would duplicate `osv-scanner.yml` dependency coverage, remaining value already provided by `semgrep.yml` + native secret scanning, and no IaC to scan; consistent with this audit's own "3 real checks > 7 decorative ones".

### CI-03 — Two unconfigured, redundant static-analysis platforms [Low-Medium]

- **Files:** `.github/workflows/sonarcloud.yml:57-58`, `.github/workflows/sonarqube.yml:38`
- **What's wrong:** Both `-Dsonar.projectKey=` and `-Dsonar.organization=`/`-Dsonar.host.url=` are blank in both files — both workflows run and fail (or silently no-op depending on the action's handling of missing config) on every push to `main`. Running both SonarCloud (SaaS) and SonarQube (self-hosted/CE) side-by-side is also redundant — they solve the same problem. Combined with `semgrep.yml` (a third static-analysis tool, but that one requires `SEMGREP_APP_TOKEN`/`SEMGREP_DEPLOYMENT_ID` secrets that may or may not be set) this repo is carrying **three** static-analysis SaaS integrations, at most one of which needs to exist for a solo/small-team open-source project.
- **Fix:** Pick one static-analysis platform (Semgrep's free OSS tier is the lowest-friction of the three and already has real rules configured via `semgrep-action`), configure it, delete the other two workflow files. Fewer, working CI jobs beat more, decorative ones — every red/skipped check trains contributors to ignore CI status.
- **✅ DONE Aug 12, 2026:** both Sonar workflows deleted (blank keys confirmed); `semgrep.yml` kept as the single static-analysis platform. Follow-up recorded: verify `SEMGREP_APP_TOKEN`/`SEMGREP_DEPLOYMENT_ID` secrets are set, or semgrep will fail on every push.

### CI-04 — No top-level `permissions:` block on `ci.yml`; Actions not pinned to commit SHA [Medium]

- **Files:** `.github/workflows/ci.yml` (whole file), all workflows' `actions/checkout@v4`/`actions/setup-node@v4` references
- **What's wrong:** `ci.yml` has no `permissions:` key, so it inherits the repository's default `GITHUB_TOKEN` scope — commonly read/write on `contents` and other scopes unless the org/repo default was explicitly hardened. GitHub's own security guidance (and every independent 2026 CI-hardening source consulted for this audit — see §9) is unanimous: every workflow should declare `permissions: contents: read` at the top and elevate per-job only where needed, and third-party actions should be pinned to a full commit SHA, not a mutable tag like `@v4`, because a compromised upstream action under an existing tag is a live, exploited attack class in 2025-2026 (`tj-actions/changed-files`, CVE-2025-30066, being the canonical example cited across sources). This repo already does SHA-pinning correctly for the reusable OSV-Scanner/Semgrep/SonarCloud/Trivy actions (good — that's ahead of most repos) but not for the first-party `actions/checkout`/`actions/setup-node` calls, which is a smaller but real gap, and `ci.yml` is missing the `permissions:` block entirely while every other workflow in this repo has one.
- **Fix:** Add `permissions: contents: read` to `ci.yml`. Consider Dependabot's `github-actions` ecosystem update type, which can keep SHA pins current automatically once adopted.
- **✅ DONE Aug 12, 2026:** `permissions: contents: read` added to `ci.yml` (only workflow missing it); `checkout` → `11d5960a…`, `setup-node` → `49933ea5…`, `codeql-action/upload-sarif` → `c3400c2f…` SHA-pinned (resolved from official tags via GitHub API); `rg "@v[0-9]" .github/workflows` → 0 hits. Dependabot `github-actions` not added — decision recorded: solo repo, manual pin refresh at upgrade time; revisit if the workflow set grows.

### PWA2-01 — Maskable icon reuses the "any"-purpose asset; several install-quality manifest fields are missing [Medium]

- **File:** `public/manifest.json:9-13`
- **What's wrong:** The same `icon-192.png`/`icon-512.png` files are declared with both `"purpose": "any"` and `"purpose": "maskable"`. A maskable icon needs its subject confined to the center ~80% "safe zone" (a circle at 40% radius, per the W3C spec) because Android adaptive-icon launchers crop the full square into a circle, squircle, or rounded-rectangle depending on OEM launcher — reusing a full-bleed icon for `maskable` means the logo will be visibly cropped on most Android home screens, not a cosmetic nitpick. Separately, the manifest is missing fields that materially change the install experience in Chromium-based browsers in 2026: `screenshots` (enables the richer, app-store-style install dialog instead of the minimal one), `shortcuts` (jump-list quick actions, e.g. "Quick Capture", fits this app's Cmd+K-first identity well), `id` (stabilizes app identity across manifest edits/updates), `categories`, and `scope`.
- **Fix:** Generate a dedicated maskable icon (padded to the safe zone — `maskable.app` is the standard verification tool cited across sources) at 192 and 512px, keep the existing icons as `"purpose": "any"` only, and add `screenshots` (at least one `form_factor: "wide"` and one `"narrow"`), `shortcuts`, `id`, and `scope: "/"` to the manifest.

### PERF-07 — RLS policies call `auth.uid()` unwrapped; will degrade as row counts grow [Medium-High, compounding]

- **Files:** every `CREATE POLICY ... USING (auth.uid() = user_id)` across `supabase/migrations/*.sql`, most recently re-affirmed in `20260703000001_rls_to_authenticated.sql`
- **What's wrong:** This is Supabase's own, official, most-cited RLS performance guidance (see §9) and it is not applied anywhere in this schema: calling `auth.uid()` directly in a policy forces Postgres to re-invoke the function **once per row scanned**, whereas wrapping it as `(select auth.uid())` lets the planner treat it as a stable `initPlan` and cache the result once per statement. Supabase's own docs report >100x improvement on large tables from this single change; multiple independent practitioner write-ups from 2025-2026 confirm the same order of magnitude. For a "second brain" app whose whole premise is that users pour years of tasks/notes/people/threads into it, `items`/`threads`/`people` are exactly the tables that will eventually be large enough for this to matter, and it costs nothing to fix now versus a painful migration later.
- **Fix:** New migration (never edit an existing one, per `AGENTS.md` invariant #6) that drops and recreates each `users_own_*` policy with `(select auth.uid()) = user_id` in both `USING` and `WITH CHECK`. Pair with the existing indexes already implied by `user_id` foreign keys — verify each of the 10 policy-bearing tables actually has a btree index on `user_id` (not just a FK constraint, which does not automatically create one on the referencing side in Postgres).

### INFRA-15 — Edge Functions use a deprecated import source and have a cron race condition [Low-Medium]

- **Files:** `supabase/functions/cron_cleanup/index.ts:1-2`, `supabase/functions/cron_recurrence/index.ts:1-2, 96-116`
- **What's wrong:** Both functions import `serve` from `https://deno.land/std@0.192.0/http/server.ts` and the Supabase client from `esm.sh`. `deno.land/std` has been in maintenance-mode/deprecated-in-favor-of-JSR for some time, and Supabase's current Edge Function examples use `npm:@supabase/supabase-js@2` specifiers (npm compatibility in Deno is now considered more reliable than `esm.sh` CDN resolution for this specific package, which has previously had `esm.sh` resolution issues reported by Supabase support). Separately, `cron_recurrence/index.ts` does a check-then-insert (`select ... maybeSingle()` at line ~96, then `insert` if nothing found) with no unique constraint or advisory lock backing it — if the scheduled trigger ever overlaps (retry after timeout, manual trigger during a scheduled run, etc.), two concurrent invocations can both pass the "does not exist" check before either inserts, producing a duplicate recurring task.
- **Fix:** Bump both functions to `npm:@supabase/supabase-js@2` and the current Deno std (or drop the std import entirely and use `Deno.serve`, which is built in and removes the dependency altogether — this is now the recommended pattern). For the race condition: add a partial unique index on `(user_id, title, recurrence) WHERE status = 'active'` and let the `insert` fail-and-swallow on conflict instead of relying on a preceding `select`, which is the standard fix for check-then-insert races.

### SEC2-02 — Auth hardening gaps to verify against the live Supabase project dashboard [Medium, verify-before-launch]

- **File:** `supabase/config.toml` (local CLI config — **note:** this file governs `supabase start` locally; it does not necessarily mirror the hosted project's Dashboard settings, which is why this is framed as "verify," not "fix")
- **What's configured locally that's worth confirming matches (or doesn't need to match) production intent:**
  - `minimum_password_length = 6`, `password_requirements = ""` — no complexity/length floor beyond 6 characters. Current guidance (NIST 800-63B-style, which most 2026 sources still point to) favors **length over complexity rules** but does recommend a higher floor than 6 for a consumer product handling personal data — 8 is a reasonable minimum, 10-12 preferred, paired with breach-list checking (Supabase supports HaveIBeenPwned-backed leaked-password protection as a toggle) rather than forced symbol/number rules.
  - `[auth.captcha]` is commented out entirely — no bot protection on signup/login. For a public-signup app this is worth turning on (hCaptcha or Turnstile, both natively supported) before the sign-up flow is exposed at a public URL.
  - `[auth.email] enable_confirmations = false` — new accounts are usable without verifying email ownership. This may be an intentional low-friction-onboarding choice (worth stating explicitly if so), but it does mean password-reset and "this is your data" guarantees are weaker than they look, since nothing confirms the signup email is actually reachable by the signer-upper.
- **Action:** Not a code fix — a 15-minute pass through the Supabase Dashboard's **Security Advisor** (a free, built-in linter that flags exactly this class of issue — RLS-disabled tables, missing indexes on policy columns, `SECURITY DEFINER` views, mutable search paths) plus the **Auth → Settings** page, before the public launch, to confirm the hosted project's actual settings (not just this local file) match intent.

### PERF-08 — `removeConsole` strips `console.error` in production too [Low]

- **File:** `next.config.ts:31` — `compiler: { removeConsole: process.env.NODE_ENV === "production" }`
- **What's wrong:** Next's `removeConsole` compiler option, used with a boolean, strips **every** `console.*` call from client bundles in production, including `console.error`. Combined with `OBS-01` (no real error tracker), this means production client-side errors currently have *no* visible trace anywhere — not in the browser console (stripped), not in a tracker (not wired up).
- **Fix:** Once `OBS-01` lands, this stops mattering much (errors go to the tracker instead). Until then, change to `removeConsole: { exclude: ['error'] }` so at least local debugging via a user's browser console remains possible.

---

## 2. Design system & "AI slop" avoidance — external framing

The user asked specifically to minimize "AI slop." As of mid-2026 this has become a named, well-documented pattern across multiple independent design-industry sources (see §9), not just a vibe. The consistent list of tells across sources: **default-to-dark-mode, glassmorphism applied indiscriminately, purple/violet gradient "orb" backgrounds, one large Lucide/Heroicon centered above a heading, hover states that visibly do nothing, uniform fade-in-on-everything with no orchestrated hierarchy, and buttons that snap instead of ease.**

**Where Presense is already ahead of the pattern, on the evidence in this repo:**
- The palette is a deliberate warm amber/coral family, explicitly *not* the generic indigo/violet AI-tool default — `README.md`'s "Warmth at the centre" pillar and the four distinct per-space hues are a real point of view, not a default.
- Per-space color derivation from OKLCH (`docs/project/DESIGN_SYSTEM.md` §1.5, spec'd though not yet implemented per `CONF-02`'s resolution note) is a more considered approach than picking arbitrary hex values.
- Typography is a deliberate Inter + JetBrains Mono system (though `DOCS_NEEDS_CODE.md` correctly flags the leftover `Geist` font load as dead weight to remove).
- `MotionConfig reducedMotion="user"` + `LazyMotion features={domMax} strict` (per `AGENTS.md` invariant #5) shows real attention to both accessibility and bundle cost — most AI-assisted builds skip both.

**Where the existing internal audit's own findings double as AI-slop tells, worth flagging under this specific lens rather than just as bugs:**
- `DS-30` (6 different, inconsistent hover magnitudes, several of them `hover:scale-*` with no visible lift) is close to "hover states that do nothing" from a user's perspective — a hover effect three users describe differently isn't a coherent design language yet.
- Glassmorphism is explicitly named as the single most over-applied 2026 AI-tool signature across sources. `README.md`'s own pillar 3 already gets this right in principle — *"glass is a tool for hierarchy, not decoration on every element"* — the risk is in execution drift, not intent. Worth a dedicated pass (post-`DS-01`) auditing every `GlassCard`/glass-surface usage against "does this actually need depth here, or is it decoration."
- 99 hardcoded hex values (`DOCS_NEEDS_CODE.md`) work against the "cohesive, committed palette via CSS variables" principle multiple sources name as the single highest-leverage anti-slop move — not just a theming bug, a taste-consistency bug.

**One genuinely new recommendation from this pass:** several 2026 sources converge on *"one well-orchestrated page load with staggered reveals beats scattered micro-interactions"* as the actual differentiator between "feels premium" and "feels like a template." Presense's onboarding wizard and the Home dashboard's first load are the two highest-leverage places to invest a single, deliberately choreographed stagger sequence (Framer Motion's `staggerChildren`/`delayChildren` on the container, not per-component ad-hoc fades) rather than distributing small fades everywhere. Check whether this already exists before building new — if `OnboardingWizard.tsx`/Home's initial mount lacks this, it's a cheap, high-visual-return addition once `DS-30`'s hover consolidation lands (they touch adjacent motion tokens).

---

## 3. Mobile UI — cross-check against current standards

The existing audit's `MOB-*`/mobile findings (h-screen→h-dvh, Sheet drag swallowing taps, 13px input auto-zoom) are all still correct and still present as of this pass, and all three map directly onto external, dated 2026 guidance, not just internal taste:
- **`h-dvh` over `h-screen`:** this is now the default recommendation everywhere mobile viewport correctness is discussed for 2026 — `100vh` including browser-chrome space is treated as a solved, well-known footgun at this point, not an edge case.
- **44×44 CSS px touch targets:** WCAG 2.2 Success Criterion 2.5.8 sets a **24×24px legal minimum** at AA, but every practitioner source consulted recommends **44×44** as the real-world target, citing touch-accuracy research showing ~3x higher mis-tap rates below that size. Worth an explicit sweep of icon-only buttons (nav rail collapsed state, Sheet close buttons, dropdown trigger icons) against 44×44, not just the items already in `BUG-41`/`DS-30`.
- **16px input font-size floor on mobile:** correctly identified in `BUG-41` — iOS Safari's auto-zoom-on-focus-below-16px behavior is unchanged and still the standard reason cited for this rule in 2026 sources.

**Net-new for this pass:** the PWA manifest gaps in `PWA2-01` are also a mobile-UI finding, not just a PWA one — the maskable-icon crop is a mobile home-screen-icon quality bug a user will see on the very first day of using the installed app, before they've opened a single screen.

---

## 4. Supabase-specific deep dive

Beyond `PERF-07` and `INFRA-15` above, cross-checked against multiple current (2026) "Supabase to production" checklists (§9), all converging on the same short list:

| Item | Status in this repo | Source consensus |
|---|---|---|
| RLS enabled on every public table | ✅ Appears correct — every table referenced in `20260703000001_rls_to_authenticated.sql` has a policy; recommend one explicit pass through the Dashboard's Security Advisor to confirm no table was missed by a later migration | Universal — #1 item on every checklist consulted |
| RLS scoped to `authenticated` role, not `public` | ✅ Done correctly (`20260703000001_rls_to_authenticated.sql`) | Recommended by 3+ sources |
| `auth.uid()` wrapped in `select` for caching | ❌ Not done anywhere — see `PERF-07` | Supabase's own docs + 5 independent sources |
| Service-role key never reaches the client | ✅ Verified — only used server-side in `api/account/route.ts` and the two Edge Functions, sourced from `env.SUPABASE_SERVICE_ROLE_KEY` (server-only per `env.ts`'s `server:` block) | Universal |
| Connection pooling (Supavisor / transaction mode) for serverless | ⚠️ Not verifiable from this repo (project-level Dashboard/connection-string setting, not code) — flag as a verify-before-launch item, since Next.js API routes on Vercel are exactly the serverless workload this matters for | Universal |
| Point-in-time recovery / backup RPO configured | ⚠️ Not verifiable from this repo — Dashboard/billing-plan setting, flag as verify-before-launch | Universal |
| Rate limiting on public/auth endpoints | ⚠️ Partial — `/api/capture` and `/api/account` have it (with the `SEC2-01` bug); Supabase Auth's own built-in rate limits (`[auth.rate_limit]` in `config.toml`) look reasonable as configured locally, but again should be confirmed against the hosted project | Universal — **SEC2-01 fixed Aug 10, 2026 (commit `e895df8`)**; remaining ⚠️ items (hosted-project confirmation) folded into `SEC2-02` |
| CAPTCHA on signup | ❌ Not configured (`[auth.captcha]` commented out) | Recommended by 2+ sources for public-signup apps |
| Edge Functions verify JWT / are not accidentally public | ⚠️ Both `cron_cleanup` and `cron_recurrence` use the service-role key internally (correct for a cron-triggered function) but neither this repo nor `config.toml` shows how they're invoked (pg_cron + `net.http_post` with a bearer token, or Supabase's Dashboard-scheduled functions). No `[functions.*]` overrides exist in `config.toml`, meaning both default to `verify_jwt = true` — confirm whatever triggers them (cron job, GitHub Action, etc.) actually sends a valid Authorization header, or the scheduled cleanup/recurrence jobs will silently 401 and never run, which would be a slow, quiet reintroduction of exactly the unbounded-trash-growth and missed-recurring-task problems these functions exist to prevent | Not covered elsewhere in this repo's docs — recommend adding an explicit smoke-test/monitoring check that these two functions actually ran successfully each day, tying back into `OBS-01` |

---

## 5. Frontend & backend performance — what's already right, what's left

**Already solid, confirmed by direct inspection (worth stating explicitly so nobody "fixes" something that isn't broken):**
- `next.config.ts`: `optimizePackageImports` correctly lists the heavy libraries actually in use (`lucide-react`, `framer-motion`, `date-fns`, `@dnd-kit/*`, `compromise`, `lenis`, `@base-ui/react`) — this is exactly the Next.js-recommended lever for tree-shaking large icon/animation/date libraries and it's configured correctly.
- `images: { formats: ["image/avif", "image/webp"] }` — correct, modern format priority.
- `@next/bundle-analyzer` wired via an `ANALYZE=true` env flag — good practice, though worth a one-time check that it still produces a report under Turbopack (Next 16's default dev/build engine per this project's `turbopack: {}` config) — bundle-analyzer's webpack-plugin lineage has had rough edges under Turbopack in some 16.x point releases; a 5-minute `ANALYZE=true npm run build` smoke test resolves the uncertainty either way.
- `LazyMotion features={domMax} strict` for Framer Motion — this is the correct, documented pattern to avoid shipping Framer Motion's full feature set to every page; `strict` mode additionally throws if a raw `motion.*` import sneaks in instead of `m.*`, which actively prevents the bundle-size regression from recurring.
- CSP with a per-request nonce and `strict-dynamic` (`proxy.ts`) — this is a stronger CSP than most production Next.js apps ship; good foundation.

**Gaps, beyond `PERF-07`/`PERF-08` above:**
- No `report-uri`/`report-to` directive on the CSP in `proxy.ts` — worth adding once `OBS-01` exists, so real-world CSP violations (a surprisingly common source of "why did this third-party script silently break" reports) surface somewhere instead of only in individual users' browser DevTools. **DONE Aug 12, 2026** — `report-uri` derived from the Sentry DSN in `proxy.ts` (part of OBS-01, commit `83a95e1`; EU ingest host preserved; absent DSN → directive omitted).
- The existing `PERF-01`…`PERF-06` tickets (per `README.md`'s phase table) presumably already cover route-level code-splitting/Lighthouse targets — this pass did not re-derive those; treat the current Core Web Vitals bar for 2026 as **LCP ≤ 2.5s, INP ≤ 200ms, CLS < 0.1, all three at p75 of real users**, not lab data alone (Google's CrUX-based field-data standard, unanimous across sources). If `PERF-06`'s "Lighthouse mobile score ≥ target" doesn't already reference INP specifically (it superseded FID as the interactivity metric back in March 2024 and is the most commonly *failed* metric industry-wide in 2026 per multiple sources), make sure it does — Lighthouse's lab-only TBT proxy is not the same signal as field INP.

---

## 6. Stability & correctness — confirmation, not new discovery

`BUG-38` (37/71 unchecked Supabase mutation errors) is the correct top-priority stability item and remains unresolved as of this pass (spot-checked `src/app/(app)/inbox/page.tsx` — the `dismissInboxItem` pattern described in `DOCS_NEEDS_CODE.md` matches the current code). The one addition this pass makes: **`BUG-38`'s planned fix (a `mutate()` wrapper reporting to "Sentry once TOOL-06 lands") is currently blocked on `OBS-01`.** Sequence these together — build the observability sink first (or simultaneously), or the error-check fix will have nowhere to report to and will degrade back into `console.error` calls nobody watches, which is a milder version of the exact problem being fixed.

> **Update Aug 10, 2026:** BUG-38 has since been **closed** (commit `660f5a3` — full pass, zero error-unchecked mutation sites remain). The OBS-01 sequencing point above is preserved, folded into the `OBS-01` ticket in `EXECUTION_SPEC.md` §29.

---

## 7. Release-readiness checklist (condensed, ordered)

Treat this as a punch list layered on top of the existing Phase 0-5 structure in `EXECUTION_SPEC.md`, not a replacement for it.

**Ship-blockers (do before any public/production launch):**
1. ~~Fix `SEC2-01` (rate-limit parameterization) — destructive endpoint currently under-protected.~~ **DONE Aug 10, 2026** (commit `e895df8`) — per-bucket limiters; account-delete enforced at 3/min.
2. ~~Stand up `OBS-01` (Sentry or equivalent) — currently zero production visibility.~~ **DONE Aug 12, 2026** (commit `83a95e1`) — Sentry wired end-to-end: telemetry forwards, API-route catch blocks capture, CSP `report-uri`; the `BUG-38` `safeMutate()` and `AGENTS.md` invariant #1 "report to the tracker" contracts now have a live sink.
3. ~~Finish `BUG-38` migration (silent data loss) — now that #2 gives it somewhere to report.~~ **SUPERSEDED Aug 10, 2026** — BUG-38 closed (commit `660f5a3`); the sequencing point stands for future work: its `safeMutate()` reporting contract is the reason OBS-01 is Critical-for-release.
4. ~~Fix `ROOT PATTERN 2` (warm-light theme unreadable text) — one of your three theme×mode combinations is currently broken for any user who picks it.~~ **SUPERSEDED Aug 10, 2026** — closed as a false positive (text overrides exist since `e6fd96b4`; verified live).
5. Verify Supabase Dashboard settings against `SEC2-02` (password floor, CAPTCHA, email confirmation, Security Advisor pass) and the Supavisor/PITR items in §4 — these are the "5-minute Dashboard click" items that are easy to forget precisely because they're not code.
6. Confirm Edge Function invocation auth (last row of §4 table) — silent cron failure is worse than a loud one.

**Pre-launch polish (1-2 weeks, matches existing Phase 1-3 scope):**
7. `PERF-07` (RLS `(select auth.uid())` wrapping) — cheap now, expensive to retrofit under load later.
8. `MOB-*`/`DS-30`/`BUG-41` mobile + hover consistency items — already scoped in the existing backlog, just re-affirming priority.
9. `PWA2-01` (maskable icon + manifest completeness) — cheap, high-visible-quality win for the "installable PWA" pitch in the README.
10. CI cleanup: `CI-01`…`CI-04` — none of these are urgent in the security sense, but a red/fake-green CI suite actively erodes contributor trust in the "8 CI workflows" the README advertises as a feature; better to run 3 real checks than 7 decorative ones.

**Post-launch roadmap sanity check (P2, no action needed now):** the existing README's P2 list (calendar integration, command palette, weekly review, native apps, AI features) is a reasonable, non-bloated roadmap for a personal "second brain" category in 2026 — resist the temptation to add more surface area before the P0/P1 list above is clear. The `ollama_enabled` dead-plumbing decision (ship local-LLM enrichment or remove the columns, per `DOCS_NEEDS_CODE.md`) is the one item worth deciding early, since it blocks the "AI features" P2 line and currently exists in three places (schema, store, types) without a UI, which is its own small instance of the "looks done, isn't" pattern this document keeps surfacing.

---

## 8. What this pass deliberately did not re-litigate

The existing `CONF-01`…`CONF-06` conflict resolutions, the `COMPONENT_MANIFEST.md` primitive list, and the full `DS-*`/`A11Y-*`/`MOB-*`/`INT-*` ticket bodies were read but not second-guessed — they're well-reasoned, evidence-cited, and already match external best practice where this pass cross-checked them (e.g., the portal-based dropdown fix in `BUG-03` is exactly what Floating UI/Radix-style primitives solve, and the repo has already partially migrated to Floating UI per `README.md`'s tech table). Re-deriving them here would just be restating `EXECUTION_SPEC.md` with extra steps, which `AGENTS.md` §2 explicitly asks contributors not to do.

---

## 9. Sources consulted (August 2026, multiple independent per topic)

- Next.js production checklist — nextjs.org/docs/app/guides/production-checklist (official, updated Mar 10 2026)
- Next.js 16 performance guides — c-sharpcorner.com, javascriptdoctor.blog, dharmsy.com, nirajiitr.com (cross-checked, consistent on Server-Components-first, caching, bundle discipline)
- Supabase RLS official troubleshooting guide — supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices; Supabase GitHub Discussion #14576; Supabase AI-prompt RLS doc
- Supabase RLS/production checklists — designrevision.com, unicoconnect.com, ubserve.com (AI-built-app-specific risk framing incl. CVE-2025-48757), zeriflow.com, frontendtechlead.com
- RLS performance practitioner write-ups — AntStack (Medium), RapidDev, SupaExplorer — all independently confirming the `(select auth.uid())` initPlan-caching pattern
- GitHub Actions security — GitHub's own 2026 security roadmap discussion, Wiz.io hardening guide, Corgea checklist, StepSecurity SHA-pinning guide, Arctiq "Top 10 Pitfalls," Secure-Pipelines definitive guide, GitHub Enterprise "secure use" docs — unanimous on SHA-pinning + least-privilege `permissions:` + OIDC over static secrets
- PWA/manifest — mobileviewer.github.io PWA testing checklist, digitalapplied.com PWA performance guide, logofoundry.app icon safe-zone guide, imagcon.app icon reference, usetoolsuite.com favicon/PWA guide, photoprism GitHub issue #5691 (real-world maskable-icon bug report, same defect class)
- "AI slop" design — lindsaymarsh.substack.com, vibecodekit.dev, Towards AI (Medium), builtin.com, mindstudio.ai, 925studios.co — independently converging on the same tell-list (dark-default, glassmorphism-everywhere, purple gradients, generic icon-in-circle, inert hover states, uniform fades)
- Core Web Vitals / WCAG 2.2 — albiorixtech.com, tekrevol.com, senorit.de, digitalapplied.com (CrUX May 2026 pass-rate data), koanthic.com, webhelpagency.com, codeminer.co, webability.io (WCAG 2.5.8 target-size specifics) — unanimous on LCP≤2.5s/INP≤200ms/CLS<0.1 at p75 as the current bar, INP as the hardest-to-pass metric industry-wide in 2026

All dated sources were checked against the actual current date (August 8, 2026) before being treated as current guidance; none of the above are pre-2025 unless explicitly noted as a stable, unchanged standard (e.g., WCAG 2.2's target-size criterion).

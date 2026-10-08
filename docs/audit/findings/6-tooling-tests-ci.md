# Audit findings: 6-tooling-tests-ci

2026-10-08, `main` at `c2421e1`. Method:
- read every workflow, config and script in the slice;
- read the latest CI, Semgrep and OSV runs and the code-scanning analyses through the GitHub API;
- `npm audit`;
- ran the whole Playwright suite against `next start`, then `tests/authed-do.spec.ts` on its own;
- type-checked `tests/` by hand, since tsconfig excludes it.

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 1 |
| P2 | 4 |
| P3 | 5 |

**What's solid** (checked, nothing to do):
- **CI:** lint, type check, tests, build and the bundle budget run on every PR. `ci` is a required check, actions are pinned to commit SHAs, and the token is `contents: read`.
- **CodeQL** (GitHub default setup) runs 87 rules on JS/TS and has 0 open alerts.
- **OSV** scans the lockfile on every PR and on `main`.
- **Pre-commit:** lint-staged runs ESLint, Prettier and a full `tsc`.
- **Playwright** uses full Chromium (`channel: "chromium"`). The Axe and contrast tests pass:
  - login: Axe scan, plus AA contrast in dark and light;
  - `/do` contrast;
  - the Trash `ConfirmModal`;
  - onboarding on phone and desktop.
- **`tests/`** type-checks cleanly when checked by hand.
- **`lighthouse-authed.mjs`** stops only the browsers it started (it matches its own `Temp\lighthouse.*` profiles).
- **`seed-test-user.mjs`** only touches the test account.

---

### [P1] Next.js 16.3.6 has six published advisories; 16.3.8 is patched
- **Where:** `package.json` (`next`), plus `eslint-config-next` and `@next/bundle-analyzer`, which track it. Code-scanning alerts #86–#91 (osv-scanner).
- **Evidence:** `npm audit` reports `next 16.0.0 - 16.3.7`, high. The advisories:
  - SSRF in image optimization (CVE-2026-94483, high);
  - cache poisoning of SSG/ISR pages, including cross-user substitution (CVE-2026-94484, CVE-2026-94543);
  - Draft Mode content leaking through `use cache` (CVE-2026-94544);
  - information disclosure in metadata image routes (CVE-2026-94485);
  - information disclosure in the dev server's MCP endpoint (CVE-2026-94486).

  `16.3.8` is outside the affected range.
- **Impact:** some of these probably don't reach production. Vercel serves images itself, there are no `remotePatterns`, and the cache-poisoning ones are about self-hosting. Others are framework-wide, and the alerts stay open until the bump. The fix is a patch release.
- **Fix:** `next`, `eslint-config-next` and `@next/bundle-analyzer` to `16.3.8`. Regenerate the lockfile the CI way (npm 10.8.2, `--legacy-peer-deps=false`, see CLAUDE.md).
- **Verify:**
  - `npm audit --omit=dev` shows no `next` entry;
  - the full gate set passes;
  - the bundle budget still holds (only 0.3 KiB of headroom on `/login`);
  - alerts #86–#91 close after the merge.
- **Confidence:** confirmed.

### [P2] Semgrep has scanned with zero rules on every run, but shows green
- **Where:** `.github/workflows/semgrep.yml` (`returntocorp/semgrep-action`, agent image `semgrep-agent:v1`, Semgrep 1.36 from 2022).
- **Evidence:**
  - Code-scanning analyses for Semgrep show `rules_count 0, results_count 0` on every run.
  - The log shows the deprecated action running `semgrep scan` with no config, then `semgrep ci` failing with "run `semgrep login` before using `semgrep ci` or set `--config`". The job still passes.
  - The upload step also warns that `codeql-action/upload-sarif@v3` is deprecated in December 2026.
- **Impact:** a security check that always passes and checks nothing. The project's guardrail ("Semgrep SAST before declaring done") is met in name only. CodeQL is the only real SAST.
- **Fix:** run the current `semgrep/semgrep` container with an explicit ruleset and no account: `semgrep scan --config p/default --sarif --output semgrep.sarif --metrics=off`. Then upload with `codeql-action/upload-sarif@v4`. Alternatively, remove the workflow and name CodeQL as the SAST gate. Don't keep a check that checks nothing.
- **Verify:** the next analysis shows `rules_count` > 0.
- **Confidence:** confirmed.

### [P2] One-off scripts can delete or rewrite production data, one command away
- **Where:**
  - **`scripts/clean-threads.js`**, wired to `npm run script:clean`. With the service role, it lists every user's active threads, groups them by title across all accounts, and hard-deletes all but one "Daily Note…" thread per title. It throws away other people's notes, permanently, with no user filter or dry run.
  - **`scripts/run_migrations.ps1`** runs every migration file from `008_…` onwards against the linked production database. Those files don't match what production ran (slice 1).
  - **Stale:**
    - `scripts/check_snooze.js` (needs `dotenv`, which isn't a dependency) and `npm run script:snooze`;
    - `scripts/read_data.py` (hard-coded paths into another tool's transcript folder and Downloads);
    - `scripts/refactor.js` and `scripts/refactor.ps1` (a finished colour-token rewrite, one pointing at an old folder).
- **Impact:** running either of the first two by mistake destroys or corrupts real data. The rest is noise that ESLint still lints.
- **Fix:** delete all six, and the two `script:*` entries in `package.json`. Git history keeps them.
- **Confidence:** confirmed (read).

### [P2] CI doesn't run the accessibility tests or check Edge Functions
- **Where:** `.github/workflows/ci.yml`.
- **Evidence:**
  - `npx playwright test` never runs in CI, so the Axe and contrast gates only run when someone remembers.
  - CLAUDE.md lists `npx -y deno check supabase/functions/*/index.ts` as a gate, but tsc excludes `supabase/` and CI doesn't run it. Edge Functions are also deployed by hand, after merge.
- **Impact:**
  - An accessibility regression on login or onboarding merges unnoticed.
  - A type error in `push_reminders` or `cron_recurrence` is found only at deploy, or when reminders stop.
- **Fix:**
  - Add an `e2e` job that builds, starts the server and runs the tests that need no secrets (`sanity`, the login Axe and contrast tests). The authed ones already skip without the seed's env. Upload the report when it fails.
  - Add a `deno check` step (`denoland/setup-deno`, pinned) for the four functions.
- **Verify:** both run on the fix PR, and a deliberately broken function fails the job.
- **Confidence:** confirmed.

### [P2] CI tests on Node 20, which reached end of life in April 2026
- **Where:** `ci.yml` (`node-version: '20'`); `package.json` has no `engines`.
- **Impact:** CI checks a runtime nothing ships on. Vercel's Node version is set in its project settings, and locally it's 24. Behaviour differences, and npm's lockfile handling, show up only after merge.
- **Fix:**
  - Set CI to the Node version Vercel uses (check Project → Settings → Node.js Version; 22 or 24).
  - Add `"engines": { "node": ">=22" }` so Vercel and contributors agree.
  - The npm that ships with that Node changes too, so re-check the lockfile note in CLAUDE.md and `npm ci` once.
- **Confidence:** confirmed for CI; Vercel's version is to be checked.

### [P3] Smaller items
- **`supabase/.temp/` is tracked although `.gitignore` lists it.** It was committed before the ignore rule, which is why `cli-latest` is always "modified". Fix: `git rm -r --cached supabase/.temp supabase/.branches` (also add `supabase/.branches/` to the ignore list). The files hold the project ref and pooler host, no secrets.
- **`npm run test:coverage` can't run.** `@vitest/coverage-v8` isn't installed, so the coverage thresholds in `vitest.config.ts` are dead config. Either add the dependency (and a non-blocking CI step) or remove the script and thresholds.
- **`tests/authed-do.spec.ts` is unreliable:**
  - It recognises the Do page's chunks by source paths that only `next dev` includes. Against `next start` it fails, and Playwright reuses whatever server is on :3000.
  - It and the accessibility spec each mint a session for the same account in parallel. The second magic link invalidates the first ("Email link is invalid or has expired"), and the spec turns that into a skip.

  Fix: seed once in a `globalSetup` and share `storageState`, and check the route by its rendered content, not chunk bodies.
- **No Dependabot version updates.** There's no `.github/dependabot.yml`, so a patched Next.js (like the P1) arrives only when someone looks. Add weekly npm updates with minor and patch grouped, and GitHub Actions updates (the CodeQL v3 deprecation would have arrived that way).
- **`tests/` is outside tsc and ESLint** (tsconfig `exclude`, `eslint src scripts`). It passes today, by hand. Fix: include `tests` and `playwright.config.ts` in lint, and give them a `tsconfig` that type-checks in CI.

---

## Coverage

Read in full:
- all three workflows;
- `package.json` scripts and dev dependencies;
- `.lintstagedrc.js`, `.husky/pre-commit`, `eslint.config.mjs`, `tsconfig.json`, `playwright.config.ts`, `vitest.config.ts`, the Prettier files, `.gitignore`, `.claude/launch.json`;
- every file under `supabase/.temp` and `supabase/.branches`;
- the six one-off scripts.

Read for risk only:
- `seed-test-user.mjs` (writes);
- `lighthouse-authed.mjs` (process killing);
- `check-budgets.mjs`, `interaction-perf.mjs`, `trace-longtasks.mjs`, `generate-*.mjs` (no data writes).

Not covered: `components.json`, `postcss.config.mjs`, `perf-*.json` (data).

# INFRA-09 working notes (internal; delete before push)

## Ticket location
INFRA-09 has NO standalone ticket block in EXECUTION_SPEC.md. It is defined inside BUG-08's AC4 (line 224): "A retention/auto-purge window is defined and enforced (a scheduled job ... permanently deletes rows past the retention window; the existing supabase/functions/cron_cleanup Edge Function is the likely home and must be audited/extended, not duplicated)." BUG-08 status record (line 207) claims AC4 met via cron_cleanup "existing mechanism, verified as-is."

## Audit findings — cron_cleanup/index.ts is ALREADY COMPLETE for INFRA-09
- Purges all 5 entity tables (items, threads, explores, people, locations) where status='deleted' AND deleted_at IS NOT NULL AND deleted_at <= now-30d, via Promise.all + error-checked results. 30-day retention window.
- SEC2-02 note: function rejects invocations without Authorization header (401, loud failure). Comment references EXECUTION_SPEC.md SEC2-02 trigger contract.
- Error path returns 500 with message.
- No tests exist under supabase/functions/cron_cleanup/ (only index.ts).
- No pg_cron/net.http_post in src/ or supabase/migrations; invocation scheduled via Supabase Dashboard scheduled-functions (config lives outside repo — verified by SEC2-02 status record at EXECUTION_SPEC line ~2045: launch action = confirm scheduled functions configured with Authorization header; smoke-check = invoke manually with auth header, confirm 200; Sentry monitoring follow-up candidate).

## SEC2-02 status record details (line ~2045, under SEC2-02 block)
"Edge Function invocation auth — DECIDED + code change": neither repo file nor config.toml records how cron_cleanup/cron_recurrence are triggered; the invocation contract lives in the Supabase Dashboard scheduled-function config. Launch action: confirm both scheduled functions send Authorization header with JWT (anon key sufficient; function holds service-role key internally). Defense-in-depth: both functions return explicit 401 {"error":"No Authorization header — scheduled invocation must send a JWT"} when invoked without a header (already implemented in cron_cleanup/index.ts). Smoke check: daily 'did the cron run' check via Sentry Function Traces (follow-up candidate); one-time launch verification = invoke both functions manually from Dashboard with auth header, confirm 200 + expected side effects, inspect scheduled-function logs within 24h.

## Scope decision
INFRA-09 = audit/extend cron_cleanup + document. No new jobs. Candidate additions within scope:
1. Batch-safe deletes: use supabase-admin `.delete()` with filter (exists). RLS: service_role bypasses RLS (correct for cleanup).
2. Optional: idempotency/limit on delete (e.g., .limit(5000)) to avoid long-running transaction? Not required by spec. Keep minimal.
3. Doc status record in EXECUTION_SPEC.md INFRA-09 (maybe add a small INFRA-09 block or extend BUG-08 AC4 note).
4. TOOL-17 (backup retention) is separate and still open.

## Decision
Mark INFRA-09 CLOSED via dated status record: cron_cleanup audited — purges all 5 tables at 30 days with error checking + loud 401 on missing auth header; trigger schedule verified as Dashboard scheduled-function (per SEC2-02 record); one-time launch verification steps recorded; no code change needed. Optionally add a smoke script? A deploy step: supabase functions deploy (user must deploy from their env; sandbox has no supabase CLI — build uses VERCEL=1 which skips gen types; deployment is a manual/CI step outside sandbox).

## Remaining steps
1. Verify the SEC2-02 trigger-contract decision text (line ~2045) to quote accurately.
2. Write status record for INFRA-09 in EXECUTION_SPEC.md (insert at BUG-08 block near AC4 or after line 224; better: append after BUG-08 status line at 207 or as own note).
3. No code edits → no build risk, but still run VERCEL=1 npm run build + npm test per rules.
4. Commit docs-only (chore/docs:), push. Report: note the function must be deployed to prod via `supabase functions deploy cron_cleanup` if not already deployed, and trigger scheduled in Dashboard.

## Workflow reminders
- VERCEL=1 npm run build; npm test 181; git commit --no-verify; format chore:/docs: for docs; update status line with commit hash.
- Next open tickets after INFRA-09: INFRA-23 (Edge Functions deprecated imports + cron race), PERF-13, PERF-21.

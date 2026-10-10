-- Scheduled Edge Function calls read their URL and keys from Supabase Vault
-- (Supabase's documented pattern: docs/guides/functions/schedule-functions),
-- instead of having them pasted into each job's command.
--
-- Why (2026-10-02):
--   * cron_recurrence sent the literal placeholder "PASTE_YOUR_ANON_KEY_HERE"
--     as its Authorization header, so the Edge Function gateway rejected every
--     hourly run with 401 "Invalid JWT" and completed recurring tasks were
--     never re-created. cron.job_run_details still said "succeeded" because
--     pg_net only queues the request; check net._http_response for the result.
--   * cleanup_trash_daily called the old cleanup_trash function, which deletes
--     from the dropped `explores` table (20260915000000_drop_people_explore)
--     and sent a stale x-cron-secret. cron_cleanup already purges trash for
--     the tables that exist, so the job is removed.
--
-- The secrets are NOT in this file. Create them once per project:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<anon key, role=anon>',      'anon_key');
--   select vault.create_secret('<same as CRON_SECRET>',      'cron_secret');
-- `cron_secret` must equal the CRON_SECRET Edge Function secret: the
-- functions answer 401 CRON_AUTH_FAILED otherwise. The anon key is public; it
-- only has to be a valid JWT for the gateway (the functions use the service
-- role internally and are gated by x-cron-secret).

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup_trash_daily') then
    perform cron.unschedule('cleanup_trash_daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'cron_recurrence') then
    perform cron.unschedule('cron_recurrence');
  end if;
  if exists (select 1 from cron.job where jobname = 'cron_cleanup') then
    perform cron.unschedule('cron_cleanup');
  end if;
end
$$;

-- Hourly at :05: re-create the next instance of completed recurring tasks.
select cron.schedule(
  'cron_recurrence',
  '5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/cron_recurrence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
  $$
);

-- Daily at 01:00 UTC: hard-delete rows soft-deleted more than 30 days ago.
select cron.schedule(
  'cron_cleanup',
  '0 1 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/cron_cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
  $$
);

-- Phase 1 of the reminders work (docs/research/Task reminder notifications.md):
-- reminders that reach a closed app, sent from the server with Web Push.
--
-- Two kinds, both opt-in and both at a time the user chose:
--   * task: the user tapped "Remind me" on a task and picked a time
--     (items.remind_at). Never derived from a deadline.
--   * ritual: the morning planning / evening shutdown nudge at the user's
--     nudge_time / shutdown_time, in their timezone, only if that ritual
--     hasn't been done today.
-- notifications_enabled = false (Settings → Reminders) silences both.
--
-- pg_cron calls the push_reminders Edge Function every minute. The function
-- calls claim_push_reminders(), which marks what it returns as sent in the
-- same statement (FOR UPDATE SKIP LOCKED), so an overlapping run can't send
-- a reminder twice. A reminder more than 15 minutes late is dropped rather
-- than delivered stale.

-- ── Columns ────────────────────────────────────────────────────────────────

alter table public.items
  add column remind_at timestamptz,
  add column reminder_sent_at timestamptz;

comment on column public.items.remind_at is
  'When to send this task''s reminder. Set only by the user ("Remind me"); null = no reminder.';
comment on column public.items.reminder_sent_at is
  'When the reminder for the current remind_at was sent. Cleared whenever remind_at changes.';

create index items_due_reminders_idx
  on public.items (remind_at)
  where remind_at is not null and reminder_sent_at is null;

alter table public.user_settings
  add column last_morning_push_on date,
  add column last_evening_push_on date;

comment on column public.user_settings.last_morning_push_on is
  'Local date the morning planning push was last sent (one per day).';
comment on column public.user_settings.last_evening_push_on is
  'Local date the evening shutdown push was last sent (one per day).';

alter table public.push_subscriptions
  -- The app's own origin as the browser saw it, so a notification can carry
  -- an absolute link (Safari's declarative push needs one) without the
  -- server hardcoding a domain.
  add column app_origin text,
  add column last_seen_at timestamptz not null default now();

create index if not exists idx_push_subscriptions_endpoint
  on public.push_subscriptions (endpoint);

-- ── A new reminder time re-arms the reminder ──────────────────────────────

create or replace function public.rearm_item_reminder()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.remind_at is distinct from old.remind_at then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

create trigger items_rearm_reminder
  before update of remind_at on public.items
  for each row
  execute function public.rearm_item_reminder();

-- ── Registering a device ──────────────────────────────────────────────────

-- A browser has one endpoint, whoever is signed in. If someone else used
-- this browser before, their row for it must go, or their reminders would
-- keep arriving here. RLS can't see other users' rows, hence definer rights;
-- the function only ever touches rows for the given endpoint and writes the
-- caller's own.
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_origin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 2048 then
    raise exception 'invalid push endpoint' using errcode = '22023';
  end if;
  -- Only a bare origin; anything else and notifications use a relative link.
  if p_origin !~ '^https?://[A-Za-z0-9.:-]+$' then
    p_origin := null;
  end if;

  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id <> uid;

  insert into public.push_subscriptions
    (user_id, endpoint, p256dh, auth_key, app_origin, last_seen_at)
  values (uid, p_endpoint, p_p256dh, p_auth, p_origin, now())
  on conflict (user_id, endpoint) do update
    set p256dh = excluded.p256dh,
        auth_key = excluded.auth_key,
        app_origin = excluded.app_origin,
        last_seen_at = now();
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- ── Claiming what's due ───────────────────────────────────────────────────

create or replace function public.claim_push_reminders()
returns table (kind text, user_id uuid, item_id uuid, title text, first_step text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Task reminders, unless the user turned reminders off.
  return query
  with due as (
    select i.id
    from public.items i
    where not exists (
        select 1 from public.user_settings s
        where s.user_id = i.user_id and s.notifications_enabled = false
      )
      and i.remind_at is not null
      and i.reminder_sent_at is null
      and i.remind_at <= now()
      and i.remind_at > now() - interval '15 minutes'
      and i.deleted_at is null
      and i.status not in ('done', 'deleted')
    order by i.remind_at
    limit 500
    for update skip locked
  )
  update public.items i
  set reminder_sent_at = now()
  from due
  where i.id = due.id
  returning 'task'::text, i.user_id, i.id, i.title, i.first_step;

  -- Ritual reminders. An unknown timezone name falls back to UTC rather
  -- than failing the whole run.
  return query
  with user_local as (
    select
      s.user_id,
      (now() at time zone tz.name) as local_now,
      coalesce(s.nudge_time, time '10:00') as nudge_time
    from public.user_settings s
    cross join lateral (
      select coalesce(
        (select n.name from pg_catalog.pg_timezone_names n where n.name = s.timezone),
        'UTC'
      ) as name
    ) tz
    where coalesce(s.notifications_enabled, true)
      and coalesce(s.onboarding_complete, false)
      and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
  ),
  morning as (
    select l.user_id, l.local_now::date as local_day
    from user_local l
    join public.user_settings s on s.user_id = l.user_id
    where l.local_now::time >= l.nudge_time
      and l.local_now::time < l.nudge_time + interval '15 minutes'
      and s.last_morning_push_on is distinct from l.local_now::date
      and s.last_ritual_date is distinct from l.local_now::date
    for update of s skip locked
  )
  update public.user_settings s
  set last_morning_push_on = morning.local_day
  from morning
  where s.user_id = morning.user_id
  returning 'ritual_morning'::text, s.user_id, null::uuid, null::text, null::text;

  return query
  with user_local as (
    select
      s.user_id,
      (now() at time zone tz.name) as local_now,
      coalesce(s.shutdown_time, time '18:00') as shutdown_time
    from public.user_settings s
    cross join lateral (
      select coalesce(
        (select n.name from pg_catalog.pg_timezone_names n where n.name = s.timezone),
        'UTC'
      ) as name
    ) tz
    where coalesce(s.notifications_enabled, true)
      and coalesce(s.onboarding_complete, false)
      and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
  ),
  evening as (
    select l.user_id, l.local_now::date as local_day
    from user_local l
    join public.user_settings s on s.user_id = l.user_id
    where l.local_now::time >= l.shutdown_time
      and l.local_now::time < l.shutdown_time + interval '15 minutes'
      and s.last_evening_push_on is distinct from l.local_now::date
      and s.last_evening_ritual_date is distinct from l.local_now::date
    for update of s skip locked
  )
  update public.user_settings s
  set last_evening_push_on = evening.local_day
  from evening
  where s.user_id = evening.user_id
  returning 'ritual_evening'::text, s.user_id, null::uuid, null::text, null::text;
end;
$$;

-- Only the Edge Function (service role) may claim; it bypasses RLS and marks
-- rows sent for every user.
revoke all on function public.claim_push_reminders() from public, anon, authenticated;
grant execute on function public.claim_push_reminders() to service_role;

-- ── Every minute ──────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from cron.job where jobname = 'push_reminders') then
    perform cron.unschedule('push_reminders');
  end if;
end
$$;

select cron.schedule(
  'push_reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/push_reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  ) as request_id;
  $$
);

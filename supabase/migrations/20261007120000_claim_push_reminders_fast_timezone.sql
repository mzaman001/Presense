-- Two fixes to claim_push_reminders() from the 2026-10-07 audit
-- (docs/audit/findings/1-security-backend.md).
--
-- 1. Speed. Each user's timezone was checked against pg_timezone_names, a
--    function scan of ~1,200 zones that took ~1 s per lookup, done for every
--    settings row, twice a minute: the function averaged 185 ms (max 4.8 s)
--    with 11 users and grew with every user. safe_timezone() tries the zone
--    once instead and falls back to UTC, as before, when it isn't known.
--
-- 2. Ritual times near midnight never fired. The window was
--    `local time >= nudge AND local time < nudge + 15 min` on `time` values,
--    and 23:50 + 15 min wraps to 00:05, so nothing between 23:46 and 23:59
--    could match. The window is now the time since the nudge, modulo a day,
--    and "already sent" / "ritual done" are checked against the day the
--    window started (a 23:50 reminder claimed at 00:03 belongs to the day
--    before).

create or replace function public.safe_timezone(p_zone text)
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_zone is null or p_zone = '' then
    return 'UTC';
  end if;
  perform now() at time zone p_zone;
  return p_zone;
exception
  when invalid_parameter_value then
    return 'UTC';
end;
$$;

revoke all on function public.safe_timezone(text) from public, anon, authenticated;

-- CREATE OR REPLACE keeps the existing grants (service_role only).
create or replace function public.claim_push_reminders()
returns table (kind text, user_id uuid, item_id uuid, title text, first_step text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Task reminders, unless the user turned reminders off. (Unchanged.)
  return query
  with due as (
    select i.id
    from public.items i
    where not exists (
        select 1 from public.user_settings s
        where s.user_id = i.user_id and s.notifications_enabled = false
      )
      -- Nowhere to send it yet: leave it for a device that registers in time.
      and exists (select 1 from public.push_subscriptions p where p.user_id = i.user_id)
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

  -- Morning ritual: within 15 minutes after nudge_time, local time.
  return query
  with in_window as (
    select s.user_id, w.local_now, w.since
    from public.user_settings s
    cross join lateral (
      select (now() at time zone public.safe_timezone(s.timezone)) as local_now
    ) l
    cross join lateral (
      select
        l.local_now,
        -- Seconds since today's nudge time, wrapping past midnight.
        mod(
          extract(epoch from (l.local_now::time - coalesce(s.nudge_time, time '10:00')))::numeric + 86400,
          86400
        ) as since
    ) w
    where coalesce(s.notifications_enabled, true)
      and coalesce(s.onboarding_complete, false)
      and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
      and w.since < 900
  ),
  morning as (
    select
      i.user_id,
      (i.local_now - make_interval(secs => i.since::double precision))::date as local_day
    from in_window i
    join public.user_settings s on s.user_id = i.user_id
    where s.last_morning_push_on is distinct from
          (i.local_now - make_interval(secs => i.since::double precision))::date
      and s.last_ritual_date is distinct from
          (i.local_now - make_interval(secs => i.since::double precision))::date
    for update of s skip locked
  )
  update public.user_settings s
  set last_morning_push_on = morning.local_day
  from morning
  where s.user_id = morning.user_id
  returning 'ritual_morning'::text, s.user_id, null::uuid, null::text, null::text;

  -- Evening ritual: within 15 minutes after shutdown_time, local time.
  return query
  with in_window as (
    select s.user_id, w.local_now, w.since
    from public.user_settings s
    cross join lateral (
      select (now() at time zone public.safe_timezone(s.timezone)) as local_now
    ) l
    cross join lateral (
      select
        l.local_now,
        mod(
          extract(epoch from (l.local_now::time - coalesce(s.shutdown_time, time '18:00')))::numeric + 86400,
          86400
        ) as since
    ) w
    where coalesce(s.notifications_enabled, true)
      and coalesce(s.onboarding_complete, false)
      and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
      and w.since < 900
  ),
  evening as (
    select
      i.user_id,
      (i.local_now - make_interval(secs => i.since::double precision))::date as local_day
    from in_window i
    join public.user_settings s on s.user_id = i.user_id
    where s.last_evening_push_on is distinct from
          (i.local_now - make_interval(secs => i.since::double precision))::date
      and s.last_evening_ritual_date is distinct from
          (i.local_now - make_interval(secs => i.since::double precision))::date
    for update of s skip locked
  )
  update public.user_settings s
  set last_evening_push_on = evening.local_day
  from evening
  where s.user_id = evening.user_id
  returning 'ritual_evening'::text, s.user_id, null::uuid, null::text, null::text;
end;
$$;

-- A task reminder waits for a device instead of being used up.
--
-- claim_push_reminders() marked a due task reminder as sent even when the
-- user had no registered device, so it went nowhere. Testing on Android
-- (2026-10-04) lost four that way: set while the phone couldn't receive
-- push yet. Now a task reminder is only claimed once the user has at least
-- one device (the ritual reminders already required this), so a reminder
-- set before turning Reminders on still arrives if a device registers
-- within its 15-minute window. Past that window it lapses, as before.
--
-- Only the task branch changes: the added "exists push_subscriptions" line.
-- CREATE OR REPLACE keeps the existing grants (service_role only).

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

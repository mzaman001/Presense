-- Stuck-task help (step 5): count how often a task is put off, so the app
-- can ask "What's in the way?" once it has been deferred repeatedly over a
-- real stretch of time, rather than treating every snooze as avoidance.
--
-- Counted in the database, not the client: tasks are postponed from many
-- places (Home snooze, the morning "Tomorrow", evening carry-over and "Pick a
-- day", "Move to tomorrow", editing the date), and a trigger sees them all.

alter table public.items
  add column defer_count integer not null default 0,
  add column first_deferred_at timestamptz,
  -- "Not now" / "Keep as is": the help stays quiet on this task until then.
  add column stuck_dismissed_until timestamptz,
  add column stuck_dismissals integer not null default 0;

comment on column public.items.defer_count is
  'Times this task was put off (snoozed later, or a due/overdue date moved later). Reset when the user acts on the stuck-task help.';
comment on column public.items.first_deferred_at is
  'When the current run of deferrals began.';
comment on column public.items.stuck_dismissed_until is
  'The stuck-task help is not offered for this task before this time.';
comment on column public.items.stuck_dismissals is
  'Consecutive "Not now" answers; after two the help backs off for a week.';

create or replace function public.track_item_deferral()
returns trigger
language plpgsql
-- Invoker rights: runs as the user making the update, under their RLS.
security invoker
set search_path = ''
as $$
begin
  -- The client resets or sets these itself (e.g. after a fix is applied);
  -- never count on top of that.
  if new.defer_count is distinct from old.defer_count then
    return new;
  end if;

  if new.status in ('active', 'overdue', 'inbox') and (
    -- Snoozed, or snoozed to a later time.
    (
      new.snoozed_until is not null
      and new.snoozed_until > now()
      and (old.snoozed_until is null or new.snoozed_until > old.snoozed_until)
    )
    -- A date that was due within a day (or already past) moved later.
    -- Moving next month's task to later is planning, not putting it off.
    or (
      new.deadline is not null
      and old.deadline is not null
      and new.deadline > old.deadline
      and old.deadline < now() + interval '1 day'
    )
  ) then
    new.defer_count := old.defer_count + 1;
    new.first_deferred_at := coalesce(old.first_deferred_at, now());
  end if;

  return new;
end;
$$;

create trigger items_track_deferral
  before update of snoozed_until, deadline on public.items
  for each row
  execute function public.track_item_deferral();

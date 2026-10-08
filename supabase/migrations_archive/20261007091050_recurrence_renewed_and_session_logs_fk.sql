-- Two fixes from the 2026-10-07 audit (docs/audit/findings/1-security-backend.md).

-- 1. A task with a focus session couldn't be permanently deleted.
--    session_logs.task_id referenced items with NO ACTION, so "Delete forever"
--    in Trash failed (23503) for any task the user had ever focused on, and
--    cron_cleanup's single purge statement would fail for every expired task
--    once one such task reached 30 days in the trash. The focus minutes stay
--    (they count toward Home's totals); only the link to the deleted task goes.
alter table public.session_logs
  drop constraint session_logs_task_id_fkey,
  add constraint session_logs_task_id_fkey
    foreign key (task_id) references public.items (id) on delete set null;

-- 2. Recurring tasks came back after being deleted.
--    cron_recurrence seeded a new copy from every completed instance in the
--    last 90 days, every hour, with nothing recording that an instance had
--    already been renewed. Now each completion is renewed once and marked.
alter table public.items
  add column if not exists recurrence_renewed_at timestamptz;

comment on column public.items.recurrence_renewed_at is
  'When cron_recurrence created (or found) the next copy from this completed instance. Set once; cleared if the task is reopened.';

-- Completions older than two hourly runs were renewed already, or the user
-- has since deleted the copy or cleared its rule: either way they must not
-- seed again. Newer ones are left for the next run.
update public.items
set recurrence_renewed_at = now()
where status = 'done'
  and recurrence is not null
  and recurrence_renewed_at is null
  and completed_at < now() - interval '2 hours';

-- Reopening a completed task makes it a live task again; completing it later
-- should renew it like any other completion.
create or replace function public.clear_recurrence_renewed()
returns trigger
language plpgsql
-- Invoker rights: runs as the user making the update, under their RLS.
security invoker
set search_path = ''
as $$
begin
  if old.status = 'done' and new.status is distinct from 'done' then
    new.recurrence_renewed_at := null;
  end if;
  return new;
end;
$$;

create trigger items_clear_recurrence_renewed
  before update of status on public.items
  for each row
  execute function public.clear_recurrence_renewed();

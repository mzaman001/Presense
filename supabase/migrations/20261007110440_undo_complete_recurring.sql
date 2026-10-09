-- Undoing "complete" on a recurring task failed once the next copy existed
-- (docs/audit/findings/2-data-layer.md).
--
-- cron_recurrence creates the next active copy within the hour of a
-- completion, and items_unique_active_recurring_idx allows one active row
-- per (user, title, rule). Reopening the completed instance then violated
-- the index (23505), so Undo showed an error and the task stayed done.
--
-- Reopening a completion now also removes the copy that completion created:
-- the active row of the same series created by the run that marked it
-- renewed (cron inserts the copy, then sets recurrence_renewed_at, within
-- one run). A copy the user made or kept outside that window is left alone.
create or replace function public.clear_recurrence_renewed()
returns trigger
language plpgsql
-- Invoker rights: runs as the user making the update, under their RLS.
security invoker
set search_path = ''
as $$
begin
  if old.status = 'done' and new.status is distinct from 'done' then
    if old.recurrence_renewed_at is not null and new.recurrence is not null then
      delete from public.items c
      where c.user_id = new.user_id
        and c.title = new.title
        and c.recurrence = new.recurrence
        and c.status = 'active'
        and c.id <> new.id
        -- The copy's created_at is the database clock; renewed_at is the
        -- Edge Function's, a moment later. A minute either way absorbs skew.
        and c.created_at between old.recurrence_renewed_at - interval '10 minutes'
                             and old.recurrence_renewed_at + interval '1 minute';
    end if;
    new.recurrence_renewed_at := null;
  end if;
  return new;
end;
$$;

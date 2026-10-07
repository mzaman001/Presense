-- Adding and removing Think entries without losing other changes
-- (docs/audit/findings/4-home-rituals-settings.md).
--
-- threads.entries (jsonb[]) was written whole from the client's copy: the
-- thread page, the evening ritual's daily note and Home's weekly note all
-- read the array, added to it and wrote it back. An entry added meanwhile
-- (another device, a missed realtime update) was overwritten, and the
-- thread page deleted by position, so after the list changed it removed a
-- different entry than the one tapped.
--
-- Both run as the caller (security invoker): RLS still decides which
-- threads they can touch. Each returns the stored array so the client can
-- show what's really there.

create or replace function public.append_thread_entry(
  p_thread_id uuid,
  p_entry jsonb
)
returns jsonb[]
language sql
security invoker
set search_path = ''
as $$
  update public.threads
  set entries = array_append(coalesce(entries, '{}'::jsonb[]), p_entry),
      last_updated = now()
  where id = p_thread_id
  returning entries;
$$;

-- Removes the entry with this created_at (entries carry it to the
-- millisecond), whatever position it has reached by now.
create or replace function public.remove_thread_entry(
  p_thread_id uuid,
  p_created_at text
)
returns jsonb[]
language sql
security invoker
set search_path = ''
as $$
  update public.threads
  set entries = coalesce(
    (
      select array_agg(e order by ord)
      from unnest(entries) with ordinality as u(e, ord)
      where e ->> 'created_at' is distinct from p_created_at
    ),
    '{}'::jsonb[]
  )
  where id = p_thread_id
  returning entries;
$$;

revoke all on function public.append_thread_entry(uuid, jsonb) from public, anon;
revoke all on function public.remove_thread_entry(uuid, text) from public, anon;
grant execute on function public.append_thread_entry(uuid, jsonb) to authenticated;
grant execute on function public.remove_thread_entry(uuid, text) to authenticated;

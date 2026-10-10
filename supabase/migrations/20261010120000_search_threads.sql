-- Global search inside Think: a thread matches on its title or on the text of
-- any entry. Entries are a jsonb[] (threads.entries), which PostgREST filters
-- can't search, so search only ever matched titles: "where did I write about
-- X" found nothing unless X was in the thread's name.
--
-- Returns the newest matching entry as the snippet (null when only the title
-- matched). Title matches sort first, then the most recently updated thread.
--
-- SECURITY INVOKER, so RLS applies as for any query; the user_id filter is
-- for the planner, like the app's own queries. The search text is escaped
-- here, so % and _ match themselves. At one person's scale (tens of threads)
-- the unnest per row is cheap; an index would need a generated text column.
create or replace function public.search_threads(p_query text, p_limit int default 5)
returns table (id uuid, title text, snippet text)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    where length(btrim(coalesce(p_query, ''))) between 1 and 200
  )
  select
    t.id,
    t.title,
    (
      select e ->> 'text'
      from unnest(t.entries) as e
      where (e ->> 'text') ilike q.pat
      order by e ->> 'created_at' desc
      limit 1
    ) as snippet
  from public.threads t, q
  where t.user_id = (select auth.uid())
    and t.status in ('active', 'archived')
    and (
      t.title ilike q.pat
      or exists (select 1 from unnest(t.entries) as e where (e ->> 'text') ilike q.pat)
    )
  order by (t.title ilike q.pat) desc, t.last_updated desc
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke execute on function public.search_threads(text, int) from public, anon;
grant execute on function public.search_threads(text, int) to authenticated;

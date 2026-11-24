-- First-party usage events: where people get stuck between signing up and
-- coming back. Existing tables already say who captured, completed, focused
-- or planned (items, session_logs, ritual_logs); this adds the steps they
-- can't show: which onboarding step someone stopped at, whether they came
-- back on a later day, whether they pressed Start, and whether they turned
-- reminders on. Nothing leaves Supabase; the privacy policy says so.
--
-- The names are a closed list so a typo can't start a new "event", and
-- props stay small (a step number, where a prompt was answered). No task
-- text or other content goes in here.
create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint product_events_name_check check (name = any (array[
    'app_open',
    'onboarding_step',
    'onboarding_finished',
    'first_plan_finished',
    'focus_started',
    'reminders_offered',
    'reminders_turned_on'
  ])),
  constraint product_events_props_size check (pg_column_size(props) <= 512)
);

create index if not exists idx_product_events_user_created
  on public.product_events (user_id, created_at desc);
create index if not exists idx_product_events_name_created
  on public.product_events (name, created_at desc);

alter table public.product_events enable row level security;

-- The same four per-operation policies as every user-owned table: people
-- can read and delete their own events; nobody can see anyone else's.
create policy users_own_product_events_select on public.product_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy users_own_product_events_insert on public.product_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy users_own_product_events_update on public.product_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy users_own_product_events_delete on public.product_events
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.product_events from anon;
grant select, insert, update, delete on table public.product_events to authenticated;
grant all on table public.product_events to service_role;

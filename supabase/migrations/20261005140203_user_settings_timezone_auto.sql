-- Automatic timezone: the saved timezone follows the device unless the user
-- turns this off in Settings and picks one (like a phone's "Set
-- automatically"). Server-sent reminders and the server-rendered Do list
-- read user_settings.timezone, so it has to stay right when people travel.
-- Additive; the table's per-operation RLS policies already cover it.

alter table public.user_settings
  add column if not exists timezone_auto boolean not null default true;

comment on column public.user_settings.timezone_auto is
  'When true, the app saves the device timezone into timezone whenever they differ. False: the user chose timezone by hand.';

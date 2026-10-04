-- Settings → Reminders → "Send a test" (supabase/functions/push_test): one
-- test push every 20 seconds per user. Written only by that function (service
-- role); users can't set it through the API in any way that matters, since
-- it only gates their own test.
alter table public.user_settings
  add column last_test_push_at timestamptz;

comment on column public.user_settings.last_test_push_at is
  'When the user last sent themselves a test push (cooldown for push_test).';

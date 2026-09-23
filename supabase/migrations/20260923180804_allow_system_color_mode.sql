-- Settings offers Light / Dark / System, but the constraint only allowed
-- 'dark' and 'light'. Choosing System failed to save with
-- "violates check constraint user_settings_color_mode_check" once
-- color_mode started being autosaved. The app already resolves 'system'
-- against the device's prefers-color-scheme (src/lib/theme.ts).
alter table public.user_settings
  drop constraint user_settings_color_mode_check;

alter table public.user_settings
  add constraint user_settings_color_mode_check
  check (color_mode in ('dark', 'light', 'system'));

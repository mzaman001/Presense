-- Reminder columns from the original deadline-countdown design. Nothing ever
-- sent those notifications: no job set notification_sent_* to true or read
-- it, and none of the notif_* / digest / quiet-hours preferences had a switch
-- or a reader. Left in place they invite someone to wire up a 72/24/6/1-hour
-- deadline nag, which is exactly what Presense decided not to build (see
-- reports/Task reminder notifications.md). The planning-reminder switch is
-- notifications_enabled, which stays.

ALTER TABLE public.items
  DROP COLUMN IF EXISTS notification_sent_72h,
  DROP COLUMN IF EXISTS notification_sent_24h,
  DROP COLUMN IF EXISTS notification_sent_6h,
  DROP COLUMN IF EXISTS notification_sent_1h,
  DROP COLUMN IF EXISTS notification_sent_overdue;

ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS notif_72h,
  DROP COLUMN IF EXISTS notif_24h,
  DROP COLUMN IF EXISTS notif_6h,
  DROP COLUMN IF EXISTS notif_1h,
  DROP COLUMN IF EXISTS notif_overdue,
  DROP COLUMN IF EXISTS notif_briefing,
  DROP COLUMN IF EXISTS notif_stale_threads,
  DROP COLUMN IF EXISTS notif_digest,
  DROP COLUMN IF EXISTS digest_enabled,
  DROP COLUMN IF EXISTS quiet_start,
  DROP COLUMN IF EXISTS quiet_end;

NOTIFY pgrst, 'reload schema';

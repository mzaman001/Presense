-- Presense database baseline, 2026-10-09.
--
-- The whole schema as production has it, in one migration. The public schema
-- below is `supabase db dump --linked --schema public` of production,
-- unedited; the extensions before it and the auth trigger, Realtime tables
-- and cron jobs after it are what that dump doesn't cover, copied from
-- production's catalog.
--
-- Why one file: production was changed outside migrations at some point
-- (e.g. items.linked_people_ids came from no migration), so neither the 44
-- original migrations nor a later rewrite of the first nine could rebuild
-- it: a fresh replay failed partway. Those files are kept, unrun, in
-- supabase/migrations_archive/. Production's migration history was repaired
-- to list only this version. A fresh `supabase db reset` from this file was
-- diffed against production with no differences in the public schema.
--
-- Not here, by design: the three Vault secrets the cron jobs read
-- (project_url, anon_key, cron_secret). They hold secret values; see
-- docs/project/ARCHITECTURE.md, "Deploying your own".

create extension if not exists pg_trgm with schema public;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- public schema (production dump)
-- ---------------------------------------------------------------------------




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."append_thread_entry"("p_thread_id" "uuid", "p_entry" "jsonb") RETURNS "jsonb"[]
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  update public.threads
  set entries = array_append(coalesce(entries, '{}'::jsonb[]), p_entry),
      last_updated = now()
  where id = p_thread_id
  returning entries;
$$;


ALTER FUNCTION "public"."append_thread_entry"("p_thread_id" "uuid", "p_entry" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_push_reminders"() RETURNS TABLE("kind" "text", "user_id" "uuid", "item_id" "uuid", "title" "text", "first_step" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
#variable_conflict use_column
begin
  return query
  with due as (
    select i.id
    from public.items i
    where not exists (
        select 1 from public.user_settings s
        where s.user_id = i.user_id and s.notifications_enabled = false
      )
      and exists (select 1 from public.push_subscriptions p where p.user_id = i.user_id)
      and i.remind_at is not null
      and i.reminder_sent_at is null
      and i.remind_at <= now()
      and i.remind_at > now() - interval '15 minutes'
      and i.deleted_at is null
      and i.status not in ('done', 'deleted')
    order by i.remind_at
    limit 500
    for update skip locked
  )
  update public.items i
  set reminder_sent_at = now()
  from due
  where i.id = due.id
  returning 'task'::text, i.user_id, i.id, i.title, i.first_step;

  return query
  with in_window as (
    select s.user_id, w.local_now, w.since
    from public.user_settings s
    cross join lateral (
      select (now() at time zone public.safe_timezone(s.timezone)) as local_now
    ) l
    cross join lateral (
      select
        l.local_now,
        mod(
          extract(epoch from (l.local_now::time - coalesce(s.nudge_time, time '10:00')))::numeric + 86400,
          86400
        ) as since
    ) w
    where coalesce(s.notifications_enabled, true)
      and coalesce(s.onboarding_complete, false)
      and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
      and w.since < 900
  ),
  morning as (
    select
      i.user_id,
      (i.local_now - make_interval(secs => i.since::double precision))::date as local_day
    from in_window i
    join public.user_settings s on s.user_id = i.user_id
    where s.last_morning_push_on is distinct from
          (i.local_now - make_interval(secs => i.since::double precision))::date
      and s.last_ritual_date is distinct from
          (i.local_now - make_interval(secs => i.since::double precision))::date
    for update of s skip locked
  )
  update public.user_settings s
  set last_morning_push_on = morning.local_day
  from morning
  where s.user_id = morning.user_id
  returning 'ritual_morning'::text, s.user_id, null::uuid, null::text, null::text;

  return query
  with in_window as (
    select s.user_id, w.local_now, w.since
    from public.user_settings s
    cross join lateral (
      select (now() at time zone public.safe_timezone(s.timezone)) as local_now
    ) l
    cross join lateral (
      select
        l.local_now,
        mod(
          extract(epoch from (l.local_now::time - coalesce(s.shutdown_time, time '18:00')))::numeric + 86400,
          86400
        ) as since
    ) w
    where coalesce(s.notifications_enabled, true)
      and coalesce(s.onboarding_complete, false)
      and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
      and w.since < 900
  ),
  evening as (
    select
      i.user_id,
      (i.local_now - make_interval(secs => i.since::double precision))::date as local_day
    from in_window i
    join public.user_settings s on s.user_id = i.user_id
    where s.last_evening_push_on is distinct from
          (i.local_now - make_interval(secs => i.since::double precision))::date
      and s.last_evening_ritual_date is distinct from
          (i.local_now - make_interval(secs => i.since::double precision))::date
    for update of s skip locked
  )
  update public.user_settings s
  set last_evening_push_on = evening.local_day
  from evening
  where s.user_id = evening.user_id
  returning 'ritual_evening'::text, s.user_id, null::uuid, null::text, null::text;
end;
$$;


ALTER FUNCTION "public"."claim_push_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_recurrence_renewed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.status = 'done' and new.status is distinct from 'done' then
    if old.recurrence_renewed_at is not null and new.recurrence is not null then
      delete from public.items c
      where c.user_id = new.user_id
        and c.title = new.title
        and c.recurrence = new.recurrence
        and c.status = 'active'
        and c.id <> new.id
        and c.created_at between old.recurrence_renewed_at - interval '10 minutes'
                             and old.recurrence_renewed_at + interval '1 minute';
    end if;
    new.recurrence_renewed_at := null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."clear_recurrence_renewed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_time_spent"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.task_id IS NOT NULL AND NEW.type = 'work' THEN
    UPDATE items 
    SET time_spent_minutes = COALESCE(time_spent_minutes, 0) + NEW.duration_minutes
    WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_time_spent"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pgrst_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;


ALTER FUNCTION "public"."pgrst_watch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rearm_item_reminder"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.remind_at is distinct from old.remind_at then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."rearm_item_reminder"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_origin" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 2048 then
    raise exception 'invalid push endpoint' using errcode = '22023';
  end if;
  -- Only a bare origin; anything else and notifications use a relative link.
  if p_origin !~ '^https?://[A-Za-z0-9.:-]+$' then
    p_origin := null;
  end if;

  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id <> uid;

  insert into public.push_subscriptions
    (user_id, endpoint, p256dh, auth_key, app_origin, last_seen_at)
  values (uid, p_endpoint, p_p256dh, p_auth, p_origin, now())
  on conflict (user_id, endpoint) do update
    set p256dh = excluded.p256dh,
        auth_key = excluded.auth_key,
        app_origin = excluded.app_origin,
        last_seen_at = now();
end;
$_$;


ALTER FUNCTION "public"."register_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_origin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_thread_entry"("p_thread_id" "uuid", "p_created_at" "text") RETURNS "jsonb"[]
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."remove_thread_entry"("p_thread_id" "uuid", "p_created_at" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rename_category"("p_categories_key" "text", "p_colors_key" "text", "p_old_category" "text", "p_new_category" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(trim(p_old_category)) < 1 OR length(p_old_category) > 50 THEN
    RAISE EXCEPTION 'Invalid old category name';
  END IF;

  IF length(trim(p_new_category)) < 1 OR length(p_new_category) > 50 THEN
    RAISE EXCEPTION 'Invalid new category name';
  END IF;

  IF p_categories_key = 'do_categories' THEN
    UPDATE public.user_settings
    SET
      do_categories = array_replace(do_categories, p_old_category, p_new_category),
      do_category_colors = CASE
        WHEN do_category_colors ? p_old_category THEN
          (do_category_colors - p_old_category) || jsonb_build_object(p_new_category, do_category_colors->p_old_category)
        ELSE
          do_category_colors
      END
    WHERE user_id = v_user_id;

    UPDATE public.items
    SET category = p_new_category
    WHERE user_id = v_user_id
      AND category = p_old_category;

  ELSE
    RAISE EXCEPTION 'Invalid categories key: %', p_categories_key;
  END IF;
END;
$$;


ALTER FUNCTION "public"."rename_category"("p_categories_key" "text", "p_colors_key" "text", "p_old_category" "text", "p_new_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."safe_timezone"("p_zone" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
begin
  if p_zone is null or p_zone = '' then
    return 'UTC';
  end if;
  perform now() at time zone p_zone;
  return p_zone;
exception
  when invalid_parameter_value then
    return 'UTC';
end;
$$;


ALTER FUNCTION "public"."safe_timezone"("p_zone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_item_deferral"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."track_item_deferral"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "first_step" "text",
    "ifthen_trigger" "text",
    "deadline" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "category" "text" DEFAULT 'other'::"text",
    "notification_sent_72h" boolean DEFAULT false,
    "notification_sent_24h" boolean DEFAULT false,
    "notification_sent_6h" boolean DEFAULT false,
    "notification_sent_1h" boolean DEFAULT false,
    "notification_sent_overdue" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "priority" integer DEFAULT 4,
    "subtasks" "jsonb"[] DEFAULT '{}'::"jsonb"[],
    "start_date" timestamp with time zone,
    "recurrence" "text",
    "notes" "text",
    "snoozed_until" timestamp with time zone,
    "time_spent_minutes" integer DEFAULT 0,
    "time_estimate" integer DEFAULT 0,
    "deleted_at" timestamp with time zone,
    "defer_count" integer DEFAULT 0 NOT NULL,
    "first_deferred_at" timestamp with time zone,
    "stuck_dismissed_until" timestamp with time zone,
    "stuck_dismissals" integer DEFAULT 0 NOT NULL,
    "remind_at" timestamp with time zone,
    "reminder_sent_at" timestamp with time zone,
    "recurrence_renewed_at" timestamp with time zone,
    CONSTRAINT "items_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'done'::"text", 'overdue'::"text", 'archived'::"text", 'inbox'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."items"."defer_count" IS 'Times this task was put off (snoozed later, or a due/overdue date moved later). Reset when the user acts on the stuck-task help.';



COMMENT ON COLUMN "public"."items"."first_deferred_at" IS 'When the current run of deferrals began.';



COMMENT ON COLUMN "public"."items"."stuck_dismissed_until" IS 'The stuck-task help is not offered for this task before this time.';



COMMENT ON COLUMN "public"."items"."stuck_dismissals" IS 'Consecutive "Not now" answers; after two the help backs off for a week.';



COMMENT ON COLUMN "public"."items"."remind_at" IS 'When to send this task''s reminder. Set only by the user ("Remind me"); null = no reminder.';



COMMENT ON COLUMN "public"."items"."reminder_sent_at" IS 'When the reminder for the current remind_at was sent. Cleared whenever remind_at changes.';



COMMENT ON COLUMN "public"."items"."recurrence_renewed_at" IS 'When cron_recurrence created (or found) the next copy from this completed instance. Set once; cleared if the task is reopened.';



CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "location_text" "text" NOT NULL,
    "photo_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "locations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "app_origin" "text",
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ritual_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ritual_type" "text" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ritual_logs_ritual_type_check" CHECK (("ritual_type" = ANY (ARRAY['morning'::"text", 'evening'::"text"])))
);


ALTER TABLE "public"."ritual_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "duration_minutes" integer NOT NULL,
    "type" "text" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "session_logs_type_check" CHECK (("type" = ANY (ARRAY['work'::"text", 'short_break'::"text", 'long_break'::"text"])))
);


ALTER TABLE "public"."session_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "color_accent" "text" DEFAULT '#2DD4BF'::"text",
    "entries" "jsonb"[] DEFAULT '{}'::"jsonb"[],
    "stale_prompt" "text",
    "stale_prompt_at" timestamp with time zone,
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text",
    "is_pinned" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "threads_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "nudge_time" time without time zone DEFAULT '10:00:00'::time without time zone,
    "quiet_start" time without time zone DEFAULT '22:00:00'::time without time zone,
    "quiet_end" time without time zone DEFAULT '08:00:00'::time without time zone,
    "timezone" "text" DEFAULT 'Asia/Kolkata'::"text",
    "notifications_enabled" boolean DEFAULT true,
    "notif_72h" boolean DEFAULT true,
    "notif_24h" boolean DEFAULT true,
    "notif_6h" boolean DEFAULT true,
    "notif_1h" boolean DEFAULT true,
    "notif_overdue" boolean DEFAULT true,
    "notif_briefing" boolean DEFAULT true,
    "notif_digest" boolean DEFAULT true,
    "notif_stale_threads" boolean DEFAULT true,
    "digest_enabled" boolean DEFAULT true,
    "ollama_enabled" boolean DEFAULT false,
    "ollama_url" "text" DEFAULT 'http://localhost:11434'::"text",
    "reduce_motion" boolean DEFAULT false,
    "ambient_bg" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "theme" "text" DEFAULT 'wahala'::"text",
    "color_mode" "text" DEFAULT 'dark'::"text",
    "pomodoros_completed" integer DEFAULT 0,
    "pomodoro_duration" integer DEFAULT 10,
    "avatar_color" "text" DEFAULT '#E5B41E'::"text",
    "daily_briefing" boolean DEFAULT true,
    "pomodoro_sound" boolean DEFAULT true,
    "short_break_duration" integer DEFAULT 5,
    "long_break_duration" integer DEFAULT 15,
    "auto_start_breaks" boolean DEFAULT false,
    "default_view" "text" DEFAULT 'list'::"text",
    "auto_archive_days" integer DEFAULT 7,
    "do_categories" "text"[] DEFAULT ARRAY['work'::"text", 'study'::"text", 'personal'::"text", 'errand'::"text", 'health'::"text"],
    "auto_snooze" boolean DEFAULT false,
    "smart_routing_enabled" boolean DEFAULT true,
    "nlp_date_parsing" boolean DEFAULT true,
    "routing_confidence" "text" DEFAULT 'Medium'::"text",
    "location_detection" boolean DEFAULT false,
    "onboarding_complete" boolean DEFAULT false,
    "primary_struggles" "text"[] DEFAULT '{}'::"text"[],
    "do_category_colors" "jsonb" DEFAULT '{}'::"jsonb",
    "pomodoro_long_break_interval" integer DEFAULT 4,
    "last_ritual_date" "date",
    "shutdown_time" time without time zone DEFAULT '18:00:00'::time without time zone,
    "daily_capacity_minutes" integer DEFAULT 240,
    "last_evening_ritual_date" "date",
    "last_morning_push_on" "date",
    "last_evening_push_on" "date",
    "last_test_push_at" timestamp with time zone,
    "timezone_auto" boolean DEFAULT true NOT NULL,
    CONSTRAINT "user_settings_color_mode_check" CHECK (("color_mode" = ANY (ARRAY['dark'::"text", 'light'::"text", 'system'::"text"]))),
    CONSTRAINT "user_settings_theme_check" CHECK (("theme" = ANY (ARRAY['warm'::"text", 'navy'::"text", 'forest'::"text", 'sunset'::"text", 'midnight'::"text", 'meadow'::"text", 'wahala'::"text", 'orange'::"text", 'blue'::"text"])))
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_settings"."last_morning_push_on" IS 'Local date the morning planning push was last sent (one per day).';



COMMENT ON COLUMN "public"."user_settings"."last_evening_push_on" IS 'Local date the evening shutdown push was last sent (one per day).';



COMMENT ON COLUMN "public"."user_settings"."last_test_push_at" IS 'When the user last sent themselves a test push (cooldown for push_test).';



COMMENT ON COLUMN "public"."user_settings"."timezone_auto" IS 'When true, the app saves the device timezone into timezone whenever they differ. False: the user chose timezone by hand.';



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."ritual_logs"
    ADD CONSTRAINT "ritual_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "idx_items_active" ON "public"."items" USING "btree" ("user_id", "deadline") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_items_deadline" ON "public"."items" USING "btree" ("deadline");



CREATE INDEX "idx_items_first_step" ON "public"."items" USING "gin" ("first_step" "public"."gin_trgm_ops");



CREATE INDEX "idx_items_title" ON "public"."items" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_items_user_status" ON "public"."items" USING "btree" ("user_id", "status");



CREATE INDEX "idx_locations_item" ON "public"."locations" USING "gin" ("item_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_locations_loc" ON "public"."locations" USING "gin" ("location_text" "public"."gin_trgm_ops");



CREATE INDEX "idx_locations_updated" ON "public"."locations" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_push_subscriptions_endpoint" ON "public"."push_subscriptions" USING "btree" ("endpoint");



CREATE INDEX "idx_push_subscriptions_user" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_ritual_logs_user_completed" ON "public"."ritual_logs" USING "btree" ("user_id", "completed_at" DESC);



CREATE INDEX "idx_session_logs_task_id" ON "public"."session_logs" USING "btree" ("task_id");



CREATE INDEX "idx_session_logs_user_completed" ON "public"."session_logs" USING "btree" ("user_id", "completed_at" DESC);



CREATE INDEX "idx_threads_active" ON "public"."threads" USING "btree" ("user_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_threads_title" ON "public"."threads" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_threads_updated" ON "public"."threads" USING "btree" ("user_id", "last_updated" DESC);



CREATE UNIQUE INDEX "idx_threads_user_title_unique" ON "public"."threads" USING "btree" ("user_id", "title") WHERE ("status" <> 'deleted'::"text");



CREATE INDEX "items_due_reminders_idx" ON "public"."items" USING "btree" ("remind_at") WHERE (("remind_at" IS NOT NULL) AND ("reminder_sent_at" IS NULL));



CREATE UNIQUE INDEX "items_unique_active_recurring_idx" ON "public"."items" USING "btree" ("user_id", "title", "recurrence") WHERE ("status" = 'active'::"text");



CREATE OR REPLACE TRIGGER "items_clear_recurrence_renewed" BEFORE UPDATE OF "status" ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."clear_recurrence_renewed"();



CREATE OR REPLACE TRIGGER "items_rearm_reminder" BEFORE UPDATE OF "remind_at" ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."rearm_item_reminder"();



CREATE OR REPLACE TRIGGER "items_track_deferral" BEFORE UPDATE OF "snoozed_until", "deadline" ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."track_item_deferral"();



CREATE OR REPLACE TRIGGER "on_session_log_inserted_time" AFTER INSERT ON "public"."session_logs" FOR EACH ROW EXECUTE FUNCTION "public"."increment_time_spent"();



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ritual_logs"
    ADD CONSTRAINT "ritual_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_logs"
    ADD CONSTRAINT "session_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ritual_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_own_categories_delete" ON "public"."categories" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_categories_insert" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_categories_select" ON "public"."categories" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_categories_update" ON "public"."categories" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_items_delete" ON "public"."items" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_items_insert" ON "public"."items" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_items_select" ON "public"."items" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_items_update" ON "public"."items" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_locations_delete" ON "public"."locations" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_locations_insert" ON "public"."locations" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_locations_select" ON "public"."locations" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_locations_update" ON "public"."locations" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_push_subscriptions_delete" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_push_subscriptions_insert" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_push_subscriptions_select" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_push_subscriptions_update" ON "public"."push_subscriptions" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_ritual_logs_delete" ON "public"."ritual_logs" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_ritual_logs_insert" ON "public"."ritual_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_ritual_logs_select" ON "public"."ritual_logs" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_ritual_logs_update" ON "public"."ritual_logs" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_session_logs_delete" ON "public"."session_logs" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_session_logs_insert" ON "public"."session_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_session_logs_select" ON "public"."session_logs" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_session_logs_update" ON "public"."session_logs" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_threads_delete" ON "public"."threads" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_threads_insert" ON "public"."threads" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_threads_select" ON "public"."threads" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_threads_update" ON "public"."threads" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_user_settings_delete" ON "public"."user_settings" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_user_settings_insert" ON "public"."user_settings" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_user_settings_select" ON "public"."user_settings" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "users_own_user_settings_update" ON "public"."user_settings" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."append_thread_entry"("p_thread_id" "uuid", "p_entry" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."append_thread_entry"("p_thread_id" "uuid", "p_entry" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_thread_entry"("p_thread_id" "uuid", "p_entry" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_push_reminders"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_push_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_recurrence_renewed"() TO "anon";
GRANT ALL ON FUNCTION "public"."clear_recurrence_renewed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_recurrence_renewed"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_time_spent"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_time_spent"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pgrst_watch"() TO "anon";
GRANT ALL ON FUNCTION "public"."pgrst_watch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgrst_watch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rearm_item_reminder"() TO "anon";
GRANT ALL ON FUNCTION "public"."rearm_item_reminder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rearm_item_reminder"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_origin" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_origin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_origin" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_thread_entry"("p_thread_id" "uuid", "p_created_at" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_thread_entry"("p_thread_id" "uuid", "p_created_at" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_thread_entry"("p_thread_id" "uuid", "p_created_at" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rename_category"("p_categories_key" "text", "p_colors_key" "text", "p_old_category" "text", "p_new_category" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rename_category"("p_categories_key" "text", "p_colors_key" "text", "p_old_category" "text", "p_new_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rename_category"("p_categories_key" "text", "p_colors_key" "text", "p_old_category" "text", "p_new_category" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."safe_timezone"("p_zone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."safe_timezone"("p_zone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."track_item_deferral"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_item_deferral"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_item_deferral"() TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."ritual_logs" TO "anon";
GRANT ALL ON TABLE "public"."ritual_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ritual_logs" TO "service_role";



GRANT ALL ON TABLE "public"."session_logs" TO "anon";
GRANT ALL ON TABLE "public"."session_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."session_logs" TO "service_role";



GRANT ALL ON TABLE "public"."threads" TO "anon";
GRANT ALL ON TABLE "public"."threads" TO "authenticated";
GRANT ALL ON TABLE "public"."threads" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";









-- ---------------------------------------------------------------------------
-- Function permissions the dump can't express
-- ---------------------------------------------------------------------------
-- A new function gets Supabase's default grants (PUBLIC, anon,
-- authenticated); the dump above only lists grants, not these revokes, so
-- without them a fresh database lets anyone call these. Mirrors production.

-- Server-only: the cron Edge Function, the signup trigger, the focus-time
-- trigger and a helper used inside claim_push_reminders.
revoke execute on function
  public.claim_push_reminders(),
  public.handle_new_user(),
  public.increment_time_spent(),
  public.safe_timezone(text)
from public, anon, authenticated;

-- Signed-in users only.
revoke execute on function
  public.append_thread_entry(uuid, jsonb),
  public.register_push_subscription(text, text, text, text),
  public.remove_thread_entry(uuid, text),
  public.rename_category(text, text, text, text)
from public, anon;

-- ---------------------------------------------------------------------------
-- Outside the public schema
-- ---------------------------------------------------------------------------

-- A settings row for every new account.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Live updates (RealtimeProvider).
alter publication supabase_realtime add table public.items, public.locations, public.threads;

-- Scheduled Edge Function calls. URL and keys come from Vault, never inline;
-- `cron_secret` must equal the CRON_SECRET Edge Function secret.
select cron.schedule('cron_cleanup', '0 1 * * *', $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/cron_cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
  $cmd$);

select cron.schedule('cron_recurrence', '5 * * * *', $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/cron_recurrence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
  $cmd$);

select cron.schedule('push_reminders', '* * * * *', $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/push_reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  ) as request_id;
  $cmd$);

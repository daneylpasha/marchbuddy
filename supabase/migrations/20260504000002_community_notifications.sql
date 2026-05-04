-- ============================================================================
-- Community notifications support
--   1. Allow type 'D' (social/community) in notification_log
--   2. Add community_events to notification_prefs default
--   3. Schedule hourly finalize-challenge cron job
--   4. increment_win_points helper function
-- ============================================================================

-- 1. Extend notification_log.type to allow 'D' (social events) --------------

alter table public.notification_log
  drop constraint if exists notification_log_type_check;

alter table public.notification_log
  add constraint notification_log_type_check
  check (type in ('A', 'B', 'C', 'D'));

-- 2. Add community_events to notification_prefs default ----------------------
-- Existing rows keep their current prefs; new rows get community_events=true.
-- The Edge Function defaults to true for rows that don't have the key yet.

alter table public.profiles
  alter column notification_prefs
  set default jsonb_build_object(
    'session_reminders',  true,
    'reengagement',       true,
    'community_events',   true,
    'quiet_hours_start',  22,
    'quiet_hours_end',    7
  );

-- 3. increment_win_points helper (avoids read-modify-write race) -------------

create or replace function public.increment_win_points(p_user_id uuid)
returns void language sql security definer as $$
  update public.profiles
  set win_points = win_points + 1
  where id = p_user_id;
$$;

-- 4. Hourly finalize-challenge cron job --------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('hourly-finalize-challenge') where exists (
  select 1 from cron.job where jobname = 'hourly-finalize-challenge'
);

select cron.schedule(
  'hourly-finalize-challenge',
  '5 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL')
               || '/functions/v1/finalize-challenge',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY'
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);

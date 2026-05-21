-- ============================================================================
-- MarchBuddy V2 — Proactive Coach Messages
--
-- Adds the `coach_message_schedule` queue table that powers the 4 proactive
-- coach trigger moments:
--   1. session_morning    — 2h before scheduled session (or 8am local)
--   2. post_session       — 4h after a session completes
--   3. missed_session     — next day at 10am local after a missed session
--   4. weekly_recap       — Sunday 7pm local
--
-- Also adds:
--   - `coach_proactive` key into `notification_prefs` (granular opt-out)
--   - `comeback_completed_at` on profiles (48h pause after comeback flow)
-- ============================================================================

-- ─── 1. Enum types ────────────────────────────────────────────────────────

do $$ begin
  create type public.coach_trigger_type as enum (
    'session_morning',
    'post_session',
    'missed_session',
    'weekly_recap'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.coach_message_status as enum (
    'pending',
    'sent',
    'failed',
    'skipped_quiet_hours_deferred',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

-- ─── 2. Schedule table ────────────────────────────────────────────────────

create table if not exists public.coach_message_schedule (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  trigger_type         public.coach_trigger_type not null,
  -- For triggers 1/2/3 this points at a session row id; for weekly_recap
  -- we synthesise a stable per-week reference id (see schedule-coach-messages)
  -- so the unique constraint still enforces idempotency.
  trigger_reference_id text not null,
  scheduled_for        timestamptz not null,
  sent_at              timestamptz,
  message_content      text,
  generation_method    text check (generation_method in ('claude', 'fallback')),
  status               public.coach_message_status not null default 'pending',
  failure_reason       text,
  created_at           timestamptz not null default now(),

  -- Idempotency: never schedule the same trigger twice for the same source
  -- event. Re-runs of the scheduler are no-ops thanks to this.
  unique (user_id, trigger_type, trigger_reference_id)
);

alter table public.coach_message_schedule enable row level security;

-- Users can READ their own coach messages (client merges sent rows into chat)
create policy "Users can read own coach message schedule"
  on public.coach_message_schedule for select
  using (auth.uid() = user_id);

-- Only service role writes. No client-side insert/update/delete.
-- Leaving INSERT/UPDATE/DELETE without a policy denies everyone except
-- service_role, which bypasses RLS by design.

-- ─── 3. Indexes ───────────────────────────────────────────────────────────

-- Hot path: sender picks `pending` rows whose scheduled_for has arrived.
create index if not exists idx_coach_msg_due
  on public.coach_message_schedule (status, scheduled_for)
  where status in ('pending', 'skipped_quiet_hours_deferred');

-- Hot path: client foreground sync — pull this user's sent messages.
create index if not exists idx_coach_msg_user_sent
  on public.coach_message_schedule (user_id, sent_at desc)
  where status = 'sent';

-- ─── 4. Profiles additions ───────────────────────────────────────────────

-- Comeback pause signal — set by the comeback flow when it completes.
-- send-coach-messages reads this and suppresses all proactive messages for
-- 48 hours after completion.
alter table public.profiles
  add column if not exists comeback_completed_at timestamptz;

-- Backfill `coach_proactive: true` into existing notification_prefs JSONB.
-- New users get this via the default in the existing phase1_notification_fixes
-- migration; this update just patches rows that were created before today.
update public.profiles
   set notification_prefs = coalesce(notification_prefs, '{}'::jsonb)
                          || jsonb_build_object('coach_proactive', true)
 where notification_prefs is null
    or not (notification_prefs ? 'coach_proactive');

-- ─── 5. Helper RPC: cancel preempted morning triggers ───────────────────
-- If the user completed today's session BEFORE the morning trigger fired,
-- mark the pending row as 'cancelled' so the sender doesn't deliver a stale
-- "today's the day" message. Bulk operation called from the scheduler.

create or replace function public.cancel_preempted_morning_rows()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  -- Cast safety: weekly_recap rows store 'week-YYYY-MM-DD' which can't be
  -- cast to uuid. We pre-filter to session_morning rows in a subquery that
  -- short-circuits the cast for everything else.
  with target as (
    select id, trigger_reference_id::uuid as session_id, user_id
      from public.coach_message_schedule
     where status = 'pending'
       and trigger_type = 'session_morning'
       -- Defensive: only attempt the cast when it's actually a uuid shape
       and trigger_reference_id ~ '^[0-9a-fA-F-]{36}$'
  ),
  cancelled as (
    update public.coach_message_schedule cms
       set status = 'cancelled',
           failure_reason = 'session_already_completed'
      from target t
      join public.sessions s on s.id = t.session_id and s.user_id = t.user_id
     where cms.id = t.id
    returning cms.id
  )
  select count(*) into affected from cancelled;
  return coalesce(affected, 0);
exception when others then
  return 0;
end $$;

-- ─── 6. Cron jobs ────────────────────────────────────────────────────────
-- Same pattern as schedule_reengagement_cron — requires the vault secrets
-- 'SUPABASE_URL' and 'SERVICE_ROLE_KEY' to be set in the Supabase dashboard.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any stale copies before (re-)creating.
select cron.unschedule('coach-msg-scheduler') where exists (
  select 1 from cron.job where jobname = 'coach-msg-scheduler'
);
select cron.unschedule('coach-msg-sender') where exists (
  select 1 from cron.job where jobname = 'coach-msg-sender'
);

-- Scheduler: every 15 minutes
select cron.schedule(
  'coach-msg-scheduler',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL')
               || '/functions/v1/schedule-coach-messages',
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

-- Sender: every 5 minutes
select cron.schedule(
  'coach-msg-sender',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL')
               || '/functions/v1/send-coach-messages',
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

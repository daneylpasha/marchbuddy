-- ============================================================================
-- Phase 1 notification fixes
--   1. Add per-user timezone so quiet hours can be evaluated in user local time
--   2. Add notification_prefs JSONB for granular user preferences
--   3. Add campaign_id + campaign_cycle_started_at to notification_log so we
--      can cap re-engagement campaigns (max 3 pushes per 14-day dormancy).
-- ============================================================================

-- 1. profiles: timezone + granular preferences ------------------------------
alter table public.profiles
  add column if not exists timezone text default 'UTC',
  add column if not exists notification_prefs jsonb not null default jsonb_build_object(
    'session_reminders', true,
    'reengagement', true,
    'quiet_hours_start', 22,
    'quiet_hours_end', 7
  );

-- 2. notification_log: campaign tracking ------------------------------------
alter table public.notification_log
  add column if not exists campaign_id text,
  add column if not exists source text not null default 'push'; -- 'push' | 'local'

-- Index for campaign-cap lookups
create index if not exists idx_notification_log_user_campaign
  on public.notification_log (user_id, campaign_id, sent_at desc);

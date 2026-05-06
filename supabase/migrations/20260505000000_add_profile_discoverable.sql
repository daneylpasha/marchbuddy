-- ============================================================================
-- Adds:
--   1. discoverable: user-controlled privacy toggle (Settings > Privacy).
--      When false, the entire profile detail screen shows a "Private Profile"
--      placeholder instead of stats. Bench March list is unaffected.
--   2. Rich activity columns mirrored from user_run_progress so visitors can
--      read them through the public `profiles` RLS policy. (user_run_progress
--      itself is owner-only readable.)
-- ============================================================================

alter table public.profiles
  add column if not exists discoverable           boolean not null default true,
  add column if not exists longest_run_minutes    integer not null default 0,
  add column if not exists best_streak_days       integer not null default 0,
  add column if not exists total_duration_minutes integer not null default 0,
  add column if not exists last_session_date      date;

comment on column public.profiles.discoverable is
  'User-controlled visibility of profile details. False = "Private Profile" view.';

-- ============================================================================
-- user_run_progress: persists the user's training level, session counts,
-- streaks, and distance so a sign-out → sign-in cycle (or new device login)
-- restores the correct level instead of defaulting to Level 1.
--
-- The app code (authStore.setSession, authService.pushRunProgress) has always
-- referenced this table, but the CREATE TABLE statement was never committed to
-- migrations. Without it, pushRunProgress() upserts fail silently and progress
-- lives only in AsyncStorage — wiped on any new device login.
--
-- Uses IF NOT EXISTS so projects that already have the table (created via
-- Supabase Studio or the full supabase-schema.sql dump) are unaffected.
-- ============================================================================

create table if not exists public.user_run_progress (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid unique not null references auth.users(id) on delete cascade,
  current_level              int default 1,
  sessions_at_current_level  int default 0,
  total_sessions_completed   int default 0,
  total_distance_km          float default 0,
  total_duration_minutes     int default 0,
  longest_run_minutes        int default 0,
  current_streak_days        int default 0,
  best_streak_days           int default 0,
  last_session_date          date,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

alter table public.user_run_progress enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_run_progress'
      and policyname = 'Users can read own run progress'
  ) then
    create policy "Users can read own run progress"
      on public.user_run_progress for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_run_progress'
      and policyname = 'Users can upsert own run progress'
  ) then
    create policy "Users can upsert own run progress"
      on public.user_run_progress for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

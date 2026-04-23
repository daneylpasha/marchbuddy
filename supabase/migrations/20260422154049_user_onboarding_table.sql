-- ============================================================================
-- user_onboarding: persists the CoachSetup answers (name, motivation,
-- triggers, fears, anchor person, etc.) so a sign-out → sign-in cycle can
-- restore the user's onboarding state from the server instead of forcing
-- them through CoachSetup again.
--
-- The app code (authStore.setSession resolver, authService.syncLocal...,
-- delete-account function) has always referenced this table, but the
-- CREATE TABLE statement was never committed to git. Without it,
-- syncLocalDataToSupabase silently fails (caught + warned), the resolver
-- can never enter the SERVER WINS branch, and every sign-in looks like a
-- brand-new user.
--
-- Uses IF NOT EXISTS so projects that already have the table created via
-- the Supabase Studio dashboard are unaffected.
-- ============================================================================

create table if not exists public.user_onboarding (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  user_name                text,
  activity_level           text,
  preferred_time           text,
  trigger_statement        text,
  past_failure_reason      text,
  primary_fear             text,
  practical_obstacles      text[],
  anchor_person            text,
  success_vision           text,
  start_preference         text,
  onboarding_completed_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;

-- Idempotent policy creation
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_onboarding'
      and policyname = 'Users can read own onboarding'
  ) then
    create policy "Users can read own onboarding"
      on public.user_onboarding for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_onboarding'
      and policyname = 'Users can upsert own onboarding'
  ) then
    create policy "Users can upsert own onboarding"
      on public.user_onboarding for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

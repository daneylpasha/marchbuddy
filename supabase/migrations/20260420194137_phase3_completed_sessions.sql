-- ============================================================================
-- Phase 3: track real session completions so re-engagement can use a true
-- activity signal instead of `scheduled_sessions.created_at` (which is
-- scheduling activity, not completion activity — see Phase-1 audit bug #2).
-- ============================================================================

create table if not exists public.completed_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_key   text not null,
  session_title text,
  completed_at  timestamptz not null default now()
);

alter table public.completed_sessions enable row level security;

create policy "Users can read own completed sessions"
  on public.completed_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own completed sessions"
  on public.completed_sessions for insert
  with check (auth.uid() = user_id);

create index if not exists idx_completed_sessions_user_date
  on public.completed_sessions (user_id, completed_at desc);

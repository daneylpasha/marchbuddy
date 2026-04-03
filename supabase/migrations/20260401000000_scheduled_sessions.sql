-- Scheduled sessions table
create table if not exists public.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null,
  session_title text not null,
  scheduled_at timestamptz not null,
  notified boolean not null default false,
  local_notification_id text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.scheduled_sessions enable row level security;

create policy "Users can read own scheduled sessions"
  on public.scheduled_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own scheduled sessions"
  on public.scheduled_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scheduled sessions"
  on public.scheduled_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own scheduled sessions"
  on public.scheduled_sessions for delete
  using (auth.uid() = user_id);

-- Index for querying upcoming sessions
create index idx_scheduled_sessions_user_date
  on public.scheduled_sessions (user_id, scheduled_at);

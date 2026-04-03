-- Notification log table
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('A', 'B', 'C')),
  message text not null,
  sent_at timestamptz not null default now()
);

-- RLS
alter table public.notification_log enable row level security;

create policy "Users can read own notification log"
  on public.notification_log for select
  using (auth.uid() = user_id);

create policy "Service role can insert notification log"
  on public.notification_log for insert
  with check (true);

-- Index for querying recent notifications
create index idx_notification_log_user_sent
  on public.notification_log (user_id, sent_at desc);

-- Add expo_push_token to profiles if not exists
alter table public.profiles
  add column if not exists expo_push_token text,
  add column if not exists notification_permission text default 'undetermined';

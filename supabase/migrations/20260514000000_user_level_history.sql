-- ============================================================================
-- user_level_history: append-only audit log of every level change for every
-- user. Captures both natural progressions (level up after sessions) and
-- manual corrections (admin restoring a user's level after a complaint).
--
-- Why a trigger and not app-side inserts:
--   • App-side inserts can be skipped or forgotten when a new code path
--     mutates current_level. A trigger on user_run_progress catches ALL
--     updates — including admin overrides via Supabase Studio — so the
--     audit log can never silently drift from reality.
--   • The trigger fires whether the update comes from the mobile app, an
--     Edge Function, the dashboard, or a future Edge Function we haven't
--     written yet.
-- ============================================================================

create table if not exists public.user_level_history (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  from_level          int,                          -- null for initial row (first time entering level system)
  to_level            int not null,
  sessions_at_change  int,                          -- snapshot of sessions_at_current_level at the moment of change
  changed_at          timestamptz not null default now()
);

create index if not exists idx_user_level_history_user_id
  on public.user_level_history(user_id);

create index if not exists idx_user_level_history_user_changed_at
  on public.user_level_history(user_id, changed_at desc);

-- ── Row-Level Security ──────────────────────────────────────────────────────
-- Users see their own history. Writes are gated to the trigger (security
-- definer) and the service_role; regular users cannot mutate this audit log.
alter table public.user_level_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'user_level_history'
      and policyname = 'Users can read own level history'
  ) then
    create policy "Users can read own level history"
      on public.user_level_history for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- No INSERT / UPDATE / DELETE policy for authenticated users — writes go
-- through the trigger below (running as security definer) and the service
-- role bypasses RLS entirely for admin operations.

-- ── Trigger function ────────────────────────────────────────────────────────
create or replace function public.log_level_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    -- Initial row creation in user_run_progress. Captures the user's
    -- starting level placement.
    insert into public.user_level_history
      (user_id, from_level, to_level, sessions_at_change, changed_at)
    values
      (NEW.user_id, NULL, NEW.current_level, NEW.sessions_at_current_level, now());

  elsif TG_OP = 'UPDATE' and NEW.current_level is distinct from OLD.current_level then
    -- Level actually changed. Snapshot the from/to and current session count.
    insert into public.user_level_history
      (user_id, from_level, to_level, sessions_at_change, changed_at)
    values
      (NEW.user_id, OLD.current_level, NEW.current_level, NEW.sessions_at_current_level, now());
  end if;

  return NEW;
end;
$$;

-- ── Trigger ─────────────────────────────────────────────────────────────────
drop trigger if exists trigger_log_level_change on public.user_run_progress;

create trigger trigger_log_level_change
  after insert or update on public.user_run_progress
  for each row
  execute function public.log_level_change();

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Seed history with the current state of every existing user so reports
-- aren't blank for users that already have progress before this migration.
-- Idempotent: skips users that already have at least one history row.
insert into public.user_level_history (user_id, from_level, to_level, sessions_at_change, changed_at)
select
  p.user_id,
  null,
  p.current_level,
  p.sessions_at_current_level,
  coalesce(p.updated_at, p.created_at, now())
from public.user_run_progress p
where not exists (
  select 1 from public.user_level_history h where h.user_id = p.user_id
);

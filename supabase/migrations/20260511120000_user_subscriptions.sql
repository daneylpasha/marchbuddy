-- ============================================================================
-- user_subscriptions: server-side source of truth for a user's IAP entitlement
-- and free-funnel state. Mirrors the local subscriptionStore so that:
--
--   • Reinstall / new device login restores Pro status
--   • Free-funnel boundaries (startingLevel, freeUntilLevel) persist
--   • A signed-out → signed-in cycle never inherits the previous user's tier
--
-- Architecture parallels user_run_progress: client-side Zustand store remains
-- the read-fast cache, but every mutation is pushed to this table via
-- authService.pushSubscription(). On login, authStore.setSession() pulls this
-- row and hydrates the local store.
--
-- ── Future: when RevenueCat is wired ──────────────────────────────────────
-- The RevenueCat webhook (running with the service role key in a Supabase
-- Edge Function) will become the authoritative writer of `tier`, `expires_at`,
-- `started_at`, `platform`, and `revenuecat_user_id`. At that point, the
-- "Users can update own subscription" RLS policy below should be tightened
-- so clients can only update the free-funnel fields (starting_level,
-- free_until_level), and entitlement fields become server-only. Until then,
-- the client writes both — acceptable for dev / pre-launch since there are no
-- real purchases yet.
-- ============================================================================

create table if not exists public.user_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique not null references auth.users(id) on delete cascade,

  -- Entitlement (RevenueCat-authoritative in the future)
  tier                text not null default 'free' check (tier in ('free', 'pro')),
  started_at          timestamptz,
  expires_at          timestamptz,
  platform            text check (platform in ('ios', 'android', 'web', 'promo', null)),
  revenuecat_user_id  text,

  -- Free funnel state — defines the user's "free runway" through the levels
  starting_level      int not null default 0,    -- 0 = uncaptured
  free_until_level    int not null default 0,    -- 0 = uncaptured; otherwise starting_level + N

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;

-- RLS policies (guarded with IF NOT EXISTS via pg_policies lookup so re-runs
-- on environments that already have the table don't error).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_subscriptions'
      and policyname = 'Users can read own subscription'
  ) then
    create policy "Users can read own subscription"
      on public.user_subscriptions for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_subscriptions'
      and policyname = 'Users can insert own subscription'
  ) then
    create policy "Users can insert own subscription"
      on public.user_subscriptions for insert
      with check (auth.uid() = user_id);
  end if;

  -- TODO(revenuecat): when the RC webhook lands, restrict this policy so
  -- clients can only update starting_level / free_until_level, and let the
  -- service-role webhook be the sole writer of tier / expires_at / started_at
  -- / platform / revenuecat_user_id.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_subscriptions'
      and policyname = 'Users can update own subscription'
  ) then
    create policy "Users can update own subscription"
      on public.user_subscriptions for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Auto-create a 'free' row when a new auth user signs up — mirrors the
-- handle_new_user trigger pattern already in supabase-schema.sql for profiles.
create or replace function public.handle_new_user_subscription()
returns trigger as $$
begin
  insert into public.user_subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- Index for the (likely future) admin / RC-webhook lookup by revenuecat_user_id
create index if not exists user_subscriptions_revenuecat_user_id_idx
  on public.user_subscriptions (revenuecat_user_id)
  where revenuecat_user_id is not null;

-- Backfill: ensure every existing auth.users row has a corresponding
-- subscription row. Without this, accounts that existed before this
-- migration ran would never get a row (the trigger only fires on insert),
-- and pullSubscription on their next sign-in would no-op and leave stale
-- local subscription state intact.
insert into public.user_subscriptions (user_id)
select id from auth.users
on conflict (user_id) do nothing;

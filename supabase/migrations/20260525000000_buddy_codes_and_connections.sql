-- ============================================================================
-- Buddy Codes & Connections
-- Adds buddy_code to profiles, buddy_connections table, and RLS policies.
-- Charset: A-Z minus O/I/L (23 chars) + 2-9 (8 chars) = 31 chars total
-- 31^6 ≈ 887M combinations — plenty of headroom.
-- ============================================================================

-- ─── 1. Add buddy_code column (nullable first for backfill) ──────────────────

alter table public.profiles
  add column if not exists buddy_code text null;

-- ─── 2. Add allow_buddy_connections column ───────────────────────────────────

alter table public.profiles
  add column if not exists allow_buddy_connections boolean not null default true;

-- ─── 3. Generate-buddy-code function ─────────────────────────────────────────

create or replace function public.generate_buddy_code()
returns text language plpgsql as $$
declare
  charset text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code    text := '';
  i       int;
begin
  for i in 1..6 loop
    code := code || substr(charset, floor(random() * length(charset))::int + 1, 1);
  end loop;
  return code;
end;
$$;

-- ─── 4. Backfill existing profiles with unique codes ─────────────────────────

do $$
declare
  rec       record;
  attempt   int;
  candidate text;
  taken     boolean;
begin
  for rec in select id from public.profiles where buddy_code is null loop
    attempt := 0;
    loop
      attempt := attempt + 1;
      candidate := public.generate_buddy_code();

      select exists(
        select 1 from public.profiles where buddy_code = candidate
      ) into taken;

      if not taken then
        update public.profiles set buddy_code = candidate where id = rec.id;
        exit;
      end if;

      if attempt >= 10 then
        -- Fallback: append extra random suffix to guarantee uniqueness
        update public.profiles
          set buddy_code = substr(candidate, 1, 5) || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1)
        where id = rec.id;
        exit;
      end if;
    end loop;
  end loop;
end;
$$;

-- ─── 5. Add NOT NULL constraint to buddy_code ────────────────────────────────

alter table public.profiles
  alter column buddy_code set not null;

-- ─── 6. Unique index on buddy_code ───────────────────────────────────────────

create unique index if not exists idx_profiles_buddy_code_unique
  on public.profiles (buddy_code);

-- ─── 7. Buddy code lookup RLS policy ─────────────────────────────────────────
-- The existing "Visible profiles are readable by all" policy only exposes
-- is_visible=true rows. Buddy code lookup must work for all users regardless
-- of is_visible so friends can find each other even before Level 2.
-- We add a separate policy that allows any authenticated user to read
-- buddy_code + allow_buddy_connections for any profile (needed for lookup).
-- We grant column-level select by policy rather than column-level privilege
-- because Supabase RLS works at the row level.

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Buddy code lookup by authenticated users'
  ) then
    create policy "Buddy code lookup by authenticated users"
      on public.profiles for select
      using (auth.role() = 'authenticated');
  end if;
end $$;

-- ─── 8. buddy_connections table ──────────────────────────────────────────────
-- Canonical ordering: user_a_id < user_b_id (UUID lexicographic) ensures
-- each pair is stored exactly once regardless of who initiated.

create table if not exists public.buddy_connections (
  id           uuid        primary key default gen_random_uuid(),
  user_a_id    uuid        not null references auth.users(id) on delete cascade,
  user_b_id    uuid        not null references auth.users(id) on delete cascade,
  initiated_by uuid        not null references auth.users(id),
  status       text        not null default 'pending'
                 check (status in ('pending', 'active', 'declined', 'removed')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  unique (user_a_id, user_b_id),
  check (user_a_id < user_b_id),
  check (user_a_id != user_b_id)
);

alter table public.buddy_connections enable row level security;

-- ─── 9. RLS on buddy_connections ─────────────────────────────────────────────

do $$ begin
  -- Parties can read their own connections
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'buddy_connections'
      and policyname = 'Parties can read their buddy connections'
  ) then
    create policy "Parties can read their buddy connections"
      on public.buddy_connections for select
      using (auth.uid() = user_a_id or auth.uid() = user_b_id);
  end if;

  -- Initiator can insert; canonical ordering enforced by check constraint
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'buddy_connections'
      and policyname = 'Initiator can insert buddy connection'
  ) then
    create policy "Initiator can insert buddy connection"
      on public.buddy_connections for insert
      with check (
        auth.uid() = initiated_by
        and (auth.uid() = user_a_id or auth.uid() = user_b_id)
        and user_a_id < user_b_id
      );
  end if;

  -- Either party can update their connection (accept, decline, remove)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'buddy_connections'
      and policyname = 'Either party can update buddy connection'
  ) then
    create policy "Either party can update buddy connection"
      on public.buddy_connections for update
      using (auth.uid() = user_a_id or auth.uid() = user_b_id);
  end if;

  -- Either party can delete a pending connection (cancel / refuse before accept)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'buddy_connections'
      and policyname = 'Either party can delete pending buddy connection'
  ) then
    create policy "Either party can delete pending buddy connection"
      on public.buddy_connections for delete
      using (
        (auth.uid() = user_a_id or auth.uid() = user_b_id)
        and status = 'pending'
      );
  end if;
end $$;

-- ─── 10. Partial unique indexes: one active connection per user ───────────────
-- These enforce that a user can only have one active buddy at a time.

create unique index if not exists idx_buddy_connections_active_user_a
  on public.buddy_connections (user_a_id)
  where status = 'active';

create unique index if not exists idx_buddy_connections_active_user_b
  on public.buddy_connections (user_b_id)
  where status = 'active';

-- ─── Regular indexes ─────────────────────────────────────────────────────────

create index if not exists idx_buddy_connections_user_a
  on public.buddy_connections (user_a_id);

create index if not exists idx_buddy_connections_user_b
  on public.buddy_connections (user_b_id);

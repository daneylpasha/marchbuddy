-- ============================================================================
-- Community Social Schema
-- Covers: profiles, follows (Bench March), buddy_requests, teams,
--         team_members, challenges, challenge_progress, favorite_teams
--
-- Access rules enforced here + at app level:
--   Level 1  → profile invisible, follow-only, no teams/challenges
--   Level 2+ → visible, can buddy/follow/join teams
--   Level 5+ → can create and captain a team
--   Level 6+ → competitive mode challenges (enforced at app level)
-- ============================================================================

-- ─── Helper: updated_at trigger ──────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── 1. profiles ─────────────────────────────────────────────────────────────
-- The profiles table already exists (fitness profile with id PK).
-- Add community columns needed for the social graph.
-- is_visible flips to true when level reaches 2.

alter table public.profiles
  add column if not exists level             smallint not null default 1,
  add column if not exists current_streak    integer  not null default 0,
  add column if not exists total_sessions    integer  not null default 0,
  add column if not exists total_distance_km numeric  not null default 0,
  add column if not exists win_points        integer  not null default 0,
  add column if not exists is_visible        boolean  not null default false;

alter table public.profiles enable row level security;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Visible profiles are readable by all') then
    create policy "Visible profiles are readable by all"
      on public.profiles for select
      using (is_visible = true or auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users can insert own profile') then
    create policy "Users can insert own profile"
      on public.profiles for insert
      with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users can update own profile') then
    create policy "Users can update own profile"
      on public.profiles for update
      using (auth.uid() = id);
  end if;
end $$;

create index if not exists idx_profiles_level_visible on public.profiles (level, is_visible);

-- ─── 2. follows (Bench March) ────────────────────────────────────────────────
-- One-way. Any authenticated user can follow any Level 2+ (is_visible) user.

create table if not exists public.follows (
  follower_id  uuid        not null references auth.users(id) on delete cascade,
  following_id uuid        not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id != following_id)
);

alter table public.follows enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='Authenticated users can read follows') then
    create policy "Authenticated users can read follows"
      on public.follows for select
      using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='Users can follow others') then
    create policy "Users can follow others"
      on public.follows for insert
      with check (auth.uid() = follower_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='follows' and policyname='Users can unfollow') then
    create policy "Users can unfollow"
      on public.follows for delete
      using (auth.uid() = follower_id);
  end if;
end $$;

create index if not exists idx_follows_following on public.follows (following_id);
create index if not exists idx_follows_follower  on public.follows (follower_id);

-- ─── 3. buddy_requests ───────────────────────────────────────────────────────
-- Mutual buddy relationships. Both must be Level 2+, similar levels
-- (enforced at app level). Unique per pair regardless of direction.

create table if not exists public.buddy_requests (
  id           uuid        primary key default gen_random_uuid(),
  requester_id uuid        not null references auth.users(id) on delete cascade,
  addressee_id uuid        not null references auth.users(id) on delete cascade,
  status       text        not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id != addressee_id)
);

alter table public.buddy_requests enable row level security;

drop trigger if exists buddy_requests_updated_at on public.buddy_requests;
create trigger buddy_requests_updated_at
  before update on public.buddy_requests
  for each row execute function public.set_updated_at();

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='buddy_requests' and policyname='Parties can read their buddy requests') then
    create policy "Parties can read their buddy requests"
      on public.buddy_requests for select
      using (auth.uid() = requester_id or auth.uid() = addressee_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='buddy_requests' and policyname='Users can send buddy requests') then
    create policy "Users can send buddy requests"
      on public.buddy_requests for insert
      with check (auth.uid() = requester_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='buddy_requests' and policyname='Addressee can respond to buddy requests') then
    create policy "Addressee can respond to buddy requests"
      on public.buddy_requests for update
      using (auth.uid() = addressee_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='buddy_requests' and policyname='Requester can cancel pending request') then
    create policy "Requester can cancel pending request"
      on public.buddy_requests for delete
      using (auth.uid() = requester_id);
  end if;
end $$;

create index if not exists idx_buddy_requests_addressee on public.buddy_requests (addressee_id, status);
create index if not exists idx_buddy_requests_requester on public.buddy_requests (requester_id, status);

-- ─── 4. teams ────────────────────────────────────────────────────────────────
-- Only Level 5+ can create. 2-3 members. Captain = highest-level member
-- (auto-maintained by app). Name: min 3 chars, system-unique case-insensitive.

create table if not exists public.teams (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  captain_id  uuid        not null references auth.users(id) on delete cascade,
  win_points  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint teams_name_min_length check (char_length(trim(name)) >= 3)
);

-- Case-insensitive unique team names
create unique index if not exists teams_name_lower_unique on public.teams (lower(name));

alter table public.teams enable row level security;

drop trigger if exists teams_updated_at on public.teams;
create trigger teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='teams' and policyname='Teams are publicly readable') then
    create policy "Teams are publicly readable"
      on public.teams for select
      using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='teams' and policyname='Captain can create team') then
    create policy "Captain can create team"
      on public.teams for insert
      with check (auth.uid() = captain_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='teams' and policyname='Captain can update team') then
    create policy "Captain can update team"
      on public.teams for update
      using (auth.uid() = captain_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='teams' and policyname='Captain can delete team') then
    create policy "Captain can delete team"
      on public.teams for delete
      using (auth.uid() = captain_id);
  end if;
end $$;

create index if not exists idx_teams_captain on public.teams (captain_id);

-- ─── 5. team_members ─────────────────────────────────────────────────────────
-- Win points earned here are portable — they stay on the member's profile
-- record even after leaving the team (tracked via profiles.win_points).

create table if not exists public.team_members (
  team_id           uuid        not null references public.teams(id) on delete cascade,
  user_id           uuid        not null references auth.users(id) on delete cascade,
  win_points_earned integer     not null default 0,
  joined_at         timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.team_members enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_members' and policyname='Team members are publicly readable') then
    create policy "Team members are publicly readable"
      on public.team_members for select
      using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_members' and policyname='Captain can add members') then
    create policy "Captain can add members"
      on public.team_members for insert
      with check (
        exists (
          select 1 from public.teams
          where id = team_id and captain_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_members' and policyname='Captain can remove members') then
    create policy "Captain can remove members"
      on public.team_members for delete
      using (
        exists (
          select 1 from public.teams
          where id = team_id and captain_id = auth.uid()
        )
      );
  end if;
end $$;

create index if not exists idx_team_members_user on public.team_members (user_id);

-- ─── 6. challenges ───────────────────────────────────────────────────────────
-- Lifecycle: invited → active → completed | declined | expired
-- Only outdoor sessions count (enforced when updating challenge_progress).
-- Equal team sizes enforced at app level.

create table if not exists public.challenges (
  id                      uuid        primary key default gen_random_uuid(),
  team_a_id               uuid        not null references public.teams(id) on delete cascade,
  team_b_id               uuid        not null references public.teams(id) on delete cascade,
  status                  text        not null default 'invited'
                            check (status in ('invited','active','completed','declined','expired')),
  mode                    text        not null default 'cooperative'
                            check (mode in ('cooperative','competitive')),
  invited_at              timestamptz not null default now(),
  accepted_at             timestamptz,
  starts_at               timestamptz,
  ends_at                 timestamptz,
  winner_team_id          uuid        references public.teams(id),
  -- Final parameter scores (populated on completion)
  team_a_completion_rate  numeric,
  team_b_completion_rate  numeric,
  team_a_streak_total     integer,
  team_b_streak_total     integer,
  team_a_volume_minutes   numeric,
  team_b_volume_minutes   numeric,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (team_a_id != team_b_id)
);

alter table public.challenges enable row level security;

drop trigger if exists challenges_updated_at on public.challenges;
create trigger challenges_updated_at
  before update on public.challenges
  for each row execute function public.set_updated_at();

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='challenges' and policyname='Team members can read their challenges') then
    create policy "Team members can read their challenges"
      on public.challenges for select
      using (
        auth.role() = 'authenticated' and (
          exists (select 1 from public.team_members where team_id = team_a_id and user_id = auth.uid())
          or
          exists (select 1 from public.team_members where team_id = team_b_id and user_id = auth.uid())
          or
          -- Captains can also see challenges for teams they captain
          exists (select 1 from public.teams where (id = team_a_id or id = team_b_id) and captain_id = auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='challenges' and policyname='Captain can send challenge') then
    create policy "Captain can send challenge"
      on public.challenges for insert
      with check (
        exists (select 1 from public.teams where id = team_a_id and captain_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='challenges' and policyname='Involved captains can update challenge') then
    create policy "Involved captains can update challenge"
      on public.challenges for update
      using (
        exists (
          select 1 from public.teams
          where (id = team_a_id or id = team_b_id) and captain_id = auth.uid()
        )
      );
  end if;
end $$;

create index if not exists idx_challenges_team_a on public.challenges (team_a_id, status);
create index if not exists idx_challenges_team_b on public.challenges (team_b_id, status);

-- ─── 7. challenge_progress ───────────────────────────────────────────────────
-- Per-user stats during an active challenge. Updated after each outdoor
-- session. Supabase Realtime subscriptions read this for live scores.

create table if not exists public.challenge_progress (
  challenge_id       uuid        not null references public.challenges(id) on delete cascade,
  user_id            uuid        not null references auth.users(id) on delete cascade,
  team_id            uuid        not null references public.teams(id) on delete cascade,
  sessions_completed integer     not null default 0,
  total_minutes      numeric     not null default 0,
  current_streak     integer     not null default 0,
  last_session_at    timestamptz,
  updated_at         timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.challenge_progress enable row level security;

drop trigger if exists challenge_progress_updated_at on public.challenge_progress;
create trigger challenge_progress_updated_at
  before update on public.challenge_progress
  for each row execute function public.set_updated_at();

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='challenge_progress' and policyname='Both teams can read challenge progress') then
    create policy "Both teams can read challenge progress"
      on public.challenge_progress for select
      using (
        exists (
          select 1 from public.challenges c
          where c.id = challenge_id and (
            exists (select 1 from public.team_members where team_id = c.team_a_id and user_id = auth.uid())
            or
            exists (select 1 from public.team_members where team_id = c.team_b_id and user_id = auth.uid())
            or
            exists (select 1 from public.teams where (id = c.team_a_id or id = c.team_b_id) and captain_id = auth.uid())
          )
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='challenge_progress' and policyname='Users can upsert own challenge progress') then
    create policy "Users can upsert own challenge progress"
      on public.challenge_progress for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_challenge_progress_challenge_team
  on public.challenge_progress (challenge_id, team_id);

-- ─── 8. favorite_teams ───────────────────────────────────────────────────────
-- Quick-access list of opponent teams a captain has favorited for re-challenge.

create table if not exists public.favorite_teams (
  captain_id       uuid        not null references auth.users(id) on delete cascade,
  favorite_team_id uuid        not null references public.teams(id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (captain_id, favorite_team_id)
);

alter table public.favorite_teams enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='favorite_teams' and policyname='Captains manage own favorites') then
    create policy "Captains manage own favorites"
      on public.favorite_teams for all
      using (auth.uid() = captain_id)
      with check (auth.uid() = captain_id);
  end if;
end $$;

-- ─── Enable Realtime on challenge_progress ───────────────────────────────────
-- Required for live score updates during active challenges.

alter publication supabase_realtime add table public.challenge_progress;

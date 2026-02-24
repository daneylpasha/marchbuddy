-- ============================================================================
-- FitTransform AI — Supabase Database Schema
-- Run this in the Supabase SQL Editor to create all tables.
-- ============================================================================

-- ─── Profiles (extends auth.users) ──────────────────────────────────────────

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text,
  age             integer,
  gender          text,
  height_cm       numeric,
  current_weight_kg numeric,
  target_weight_kg  numeric,
  fitness_history text,
  past_sports     text[] default '{}',
  peak_fitness_level text,
  current_activity_level text,
  injuries        text[] default '{}',
  dietary_preferences jsonb default '{}',
  goals           jsonb default '{}',
  eating_context  jsonb default '{}',
  workout_schedule jsonb default '{}',
  onboarding_completed boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Users can delete own profile"
  on public.profiles for delete
  using (id = auth.uid());

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, created_at, updated_at)
  values (new.id, now(), now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Workout Plans ──────────────────────────────────────────────────────────

create table if not exists public.workout_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  date          date not null,
  exercises     jsonb default '[]',
  status        text not null default 'pending',
  is_rest_day   boolean default false,
  rest_day_type text,
  ai_notes      text,
  summary       jsonb,
  created_at    timestamptz default now(),
  unique(user_id, date)
);

alter table public.workout_plans enable row level security;

create policy "Users can view own workouts"
  on public.workout_plans for select
  using (user_id = auth.uid());

create policy "Users can insert own workouts"
  on public.workout_plans for insert
  with check (user_id = auth.uid());

create policy "Users can update own workouts"
  on public.workout_plans for update
  using (user_id = auth.uid());

create policy "Users can delete own workouts"
  on public.workout_plans for delete
  using (user_id = auth.uid());

-- ─── Meal Plans ─────────────────────────────────────────────────────────────

create table if not exists public.meal_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  date            date not null,
  meals           jsonb default '[]',
  total_calories  numeric default 0,
  total_protein   numeric default 0,
  total_carbs     numeric default 0,
  total_fat       numeric default 0,
  created_at      timestamptz default now(),
  unique(user_id, date)
);

alter table public.meal_plans enable row level security;

create policy "Users can view own meal plans"
  on public.meal_plans for select
  using (user_id = auth.uid());

create policy "Users can insert own meal plans"
  on public.meal_plans for insert
  with check (user_id = auth.uid());

create policy "Users can update own meal plans"
  on public.meal_plans for update
  using (user_id = auth.uid());

create policy "Users can delete own meal plans"
  on public.meal_plans for delete
  using (user_id = auth.uid());

-- ─── Food Snaps ─────────────────────────────────────────────────────────────

create table if not exists public.food_snaps (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  meal_id         text,
  image_url       text,
  ai_estimate     jsonb default '{}',
  user_amended    boolean default false,
  amended_values  jsonb,
  created_at      timestamptz default now()
);

alter table public.food_snaps enable row level security;

create policy "Users can view own food snaps"
  on public.food_snaps for select
  using (user_id = auth.uid());

create policy "Users can insert own food snaps"
  on public.food_snaps for insert
  with check (user_id = auth.uid());

create policy "Users can update own food snaps"
  on public.food_snaps for update
  using (user_id = auth.uid());

create policy "Users can delete own food snaps"
  on public.food_snaps for delete
  using (user_id = auth.uid());

-- ─── Water Logs ─────────────────────────────────────────────────────────────

create table if not exists public.water_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  date          date not null,
  goal_ml       integer default 2500,
  consumed_ml   integer default 0,
  entries       jsonb default '[]',
  unique(user_id, date)
);

alter table public.water_logs enable row level security;

create policy "Users can view own water logs"
  on public.water_logs for select
  using (user_id = auth.uid());

create policy "Users can insert own water logs"
  on public.water_logs for insert
  with check (user_id = auth.uid());

create policy "Users can update own water logs"
  on public.water_logs for update
  using (user_id = auth.uid());

create policy "Users can delete own water logs"
  on public.water_logs for delete
  using (user_id = auth.uid());

-- ─── Weight Entries ─────────────────────────────────────────────────────────

create table if not exists public.weight_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  weight_kg   numeric not null,
  date        date not null,
  created_at  timestamptz default now()
);

alter table public.weight_entries enable row level security;

create policy "Users can view own weight entries"
  on public.weight_entries for select
  using (user_id = auth.uid());

create policy "Users can insert own weight entries"
  on public.weight_entries for insert
  with check (user_id = auth.uid());

create policy "Users can update own weight entries"
  on public.weight_entries for update
  using (user_id = auth.uid());

create policy "Users can delete own weight entries"
  on public.weight_entries for delete
  using (user_id = auth.uid());

-- ─── Body Measurements ──────────────────────────────────────────────────────

create table if not exists public.body_measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  waist_cm    numeric,
  chest_cm    numeric,
  arms_cm     numeric,
  notes       text,
  created_at  timestamptz default now()
);

alter table public.body_measurements enable row level security;

create policy "Users can view own measurements"
  on public.body_measurements for select
  using (user_id = auth.uid());

create policy "Users can insert own measurements"
  on public.body_measurements for insert
  with check (user_id = auth.uid());

create policy "Users can update own measurements"
  on public.body_measurements for update
  using (user_id = auth.uid());

create policy "Users can delete own measurements"
  on public.body_measurements for delete
  using (user_id = auth.uid());

-- ─── Chat Messages ──────────────────────────────────────────────────────────

create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          text not null,
  content       text not null,
  image_url     text,
  actions_taken text[] default '{}',
  created_at    timestamptz default now()
);

alter table public.chat_messages enable row level security;

create policy "Users can view own messages"
  on public.chat_messages for select
  using (user_id = auth.uid());

create policy "Users can insert own messages"
  on public.chat_messages for insert
  with check (user_id = auth.uid());

create policy "Users can update own messages"
  on public.chat_messages for update
  using (user_id = auth.uid());

create policy "Users can delete own messages"
  on public.chat_messages for delete
  using (user_id = auth.uid());

-- ─── Weekly Summaries ───────────────────────────────────────────────────────

create table if not exists public.weekly_summaries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null,
  summary_text    text,
  insights        text[] default '{}',
  created_at      timestamptz default now()
);

alter table public.weekly_summaries enable row level security;

create policy "Users can view own summaries"
  on public.weekly_summaries for select
  using (user_id = auth.uid());

create policy "Users can insert own summaries"
  on public.weekly_summaries for insert
  with check (user_id = auth.uid());

create policy "Users can update own summaries"
  on public.weekly_summaries for update
  using (user_id = auth.uid());

create policy "Users can delete own summaries"
  on public.weekly_summaries for delete
  using (user_id = auth.uid());

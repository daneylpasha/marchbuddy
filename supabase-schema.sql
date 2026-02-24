-- FitTransformAI — Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query → Paste & Run

-- ═══════════════════════════════════════════════════════════════════
-- 1. Profiles (linked to auth.users)
-- ═══════════════════════════════════════════════════════════════════
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  age integer,
  gender text,
  height_cm numeric,
  current_weight_kg numeric,
  target_weight_kg numeric,
  fitness_history text,
  past_sports text[],
  peak_fitness_level text,
  current_activity_level text,
  injuries text[],
  dietary_preferences jsonb,
  goals jsonb,
  eating_context jsonb,
  workout_schedule jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
-- 2. Workout Plans
-- ═══════════════════════════════════════════════════════════════════
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  exercises jsonb not null default '[]',
  status text not null default 'pending',
  is_rest_day boolean not null default false,
  rest_day_type text,
  ai_notes text,
  summary jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.workout_plans enable row level security;
create policy "Users can manage own workouts" on public.workout_plans for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 3. Meal Plans
-- ═══════════════════════════════════════════════════════════════════
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  meals jsonb not null default '[]',
  total_calories numeric not null default 0,
  total_protein numeric not null default 0,
  total_carbs numeric not null default 0,
  total_fat numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.meal_plans enable row level security;
create policy "Users can manage own meal plans" on public.meal_plans for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 4. Food Snaps
-- ═══════════════════════════════════════════════════════════════════
create table public.food_snaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_id text,
  image_url text,
  ai_estimate jsonb not null default '{}',
  user_amended boolean not null default false,
  amended_values jsonb,
  created_at timestamptz not null default now()
);

alter table public.food_snaps enable row level security;
create policy "Users can manage own food snaps" on public.food_snaps for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 5. Water Logs
-- ═══════════════════════════════════════════════════════════════════
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  goal_ml numeric not null default 2500,
  consumed_ml numeric not null default 0,
  entries jsonb not null default '[]',
  unique (user_id, date)
);

alter table public.water_logs enable row level security;
create policy "Users can manage own water logs" on public.water_logs for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 6. Chat Messages
-- ═══════════════════════════════════════════════════════════════════
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  content text not null,
  image_url text,
  actions_taken text[],
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;
create policy "Users can manage own chat messages" on public.chat_messages for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 7. Weight Entries
-- ═══════════════════════════════════════════════════════════════════
create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric not null,
  date date not null,
  created_at timestamptz not null default now()
);

alter table public.weight_entries enable row level security;
create policy "Users can manage own weight entries" on public.weight_entries for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 8. Body Measurements
-- ═══════════════════════════════════════════════════════════════════
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  waist_cm numeric,
  chest_cm numeric,
  arms_cm numeric,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.body_measurements enable row level security;
create policy "Users can manage own body measurements" on public.body_measurements for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 9. Weekly Summaries
-- ═══════════════════════════════════════════════════════════════════
create table public.weekly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null,
  summary_text text,
  insights text[],
  created_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

alter table public.weekly_summaries enable row level security;
create policy "Users can manage own weekly summaries" on public.weekly_summaries for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 10. Schema Additions — Critical Features (warm-up, cool-down, energy)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS warm_up jsonb DEFAULT '[]';
ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS cool_down jsonb DEFAULT '[]';
ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS energy_level smallint;

-- ═══════════════════════════════════════════════════════════════════
-- 11. Schema Additions — RPE & Workout Timer
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS session_rpe smallint;
ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS workout_started_at timestamptz;

-- ═══════════════════════════════════════════════════════════════════
-- 12. Personal Records
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  weight_kg numeric,
  reps integer NOT NULL,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, exercise_name)
);

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own PRs" ON public.personal_records FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- Running Sessions
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan info
  plan_id text NOT NULL,
  plan_level int NOT NULL,
  plan_variant text NOT NULL,
  plan_title text NOT NULL,
  planned_duration_minutes int NOT NULL,
  planned_segments jsonb NOT NULL DEFAULT '[]',

  -- Actual performance
  actual_duration_minutes int NOT NULL,
  actual_distance_km float DEFAULT 0,
  completed_segments int NOT NULL,
  ended_early boolean DEFAULT false,
  pace_per_km float,

  -- GPS data
  route_data jsonb DEFAULT '[]',

  -- Feedback
  feedback_rating text,        -- 'too_easy' | 'just_right' | 'challenging' | 'too_hard'
  feedback_notes text,

  -- Coach AI response
  coach_feedback text,

  -- Timestamps
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON public.sessions(created_at DESC);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- User Run Progress
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_run_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_level int DEFAULT 1,
  sessions_at_current_level int DEFAULT 0,
  total_sessions_completed int DEFAULT 0,
  total_distance_km float DEFAULT 0,
  total_duration_minutes int DEFAULT 0,
  longest_run_minutes int DEFAULT 0,
  current_streak_days int DEFAULT 0,
  best_streak_days int DEFAULT 0,
  last_session_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_run_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own run progress"
  ON public.user_run_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own run progress"
  ON public.user_run_progress FOR ALL
  USING (auth.uid() = user_id);

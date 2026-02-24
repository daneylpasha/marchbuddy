-- Add session_rpe and workout_started_at columns to workout_plans
ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS session_rpe smallint;
ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS workout_started_at timestamptz;

-- Ensure personal_records table exists with correct schema
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

-- Drop policy if exists to avoid errors, then recreate
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage own PRs" ON public.personal_records;
  CREATE POLICY "Users can manage own PRs" ON public.personal_records FOR ALL USING (auth.uid() = user_id);
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

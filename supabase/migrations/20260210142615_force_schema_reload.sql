-- Verify columns exist and force PostgREST schema cache reload
DO $$
BEGIN
  -- Double-check columns were added
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workout_plans' AND column_name = 'session_rpe'
  ) THEN
    ALTER TABLE public.workout_plans ADD COLUMN session_rpe smallint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workout_plans' AND column_name = 'workout_started_at'
  ) THEN
    ALTER TABLE public.workout_plans ADD COLUMN workout_started_at timestamptz;
  END IF;
END $$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

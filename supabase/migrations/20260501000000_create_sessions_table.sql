-- Create the sessions table if it doesn't already exist (may have been created manually).
-- Includes environment + treadmill_stats from the start so no follow-up ALTER is needed.
CREATE TABLE IF NOT EXISTS public.sessions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                  text        NOT NULL,
  plan_level               smallint    NOT NULL,
  plan_variant             text        NOT NULL,
  plan_title               text        NOT NULL,
  planned_duration_minutes numeric     NOT NULL,
  planned_segments         jsonb       NOT NULL DEFAULT '[]',
  actual_duration_minutes  numeric     NOT NULL,
  actual_distance_km       numeric     NOT NULL DEFAULT 0,
  completed_segments       smallint    NOT NULL DEFAULT 0,
  ended_early              boolean     NOT NULL DEFAULT false,
  pace_per_km              numeric,
  route_data               jsonb       NOT NULL DEFAULT '[]',
  environment              text        NOT NULL DEFAULT 'outdoor' CHECK (environment IN ('indoor', 'outdoor')),
  treadmill_stats          jsonb,
  feedback_rating          text,
  feedback_notes           text,
  coach_feedback           text,
  started_at               timestamptz NOT NULL,
  completed_at             timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- For tables that were created manually before this migration, add missing columns.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS environment    text    NOT NULL DEFAULT 'outdoor' CHECK (environment IN ('indoor', 'outdoor')),
  ADD COLUMN IF NOT EXISTS treadmill_stats jsonb,
  ADD COLUMN IF NOT EXISTS coach_feedback  text;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies (use DO block so re-running the migration doesn't error)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'Users can read own sessions'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can read own sessions"
      ON public.sessions FOR SELECT
      USING (auth.uid() = user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'Users can insert own sessions'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert own sessions"
      ON public.sessions FOR INSERT
      WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'Users can update own sessions'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own sessions"
      ON public.sessions FOR UPDATE
      USING (auth.uid() = user_id)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_user_completed
  ON public.sessions (user_id, completed_at DESC);

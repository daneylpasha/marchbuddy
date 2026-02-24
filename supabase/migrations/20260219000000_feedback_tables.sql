-- ─── Feedback Tables ─────────────────────────────────────────────────────────
-- Three tables for collecting user feedback at different touchpoints.
-- user_id is the app's guestId (not necessarily Supabase auth uid).
-- RLS allows anonymous inserts so guest users can submit without auth.

-- 1. Post-session emoji feedback (most important, feeds AI coach insights)
CREATE TABLE IF NOT EXISTS session_feedback (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         text,
  session_id      text,
  difficulty_rating text CHECK (difficulty_rating IN ('too_easy', 'just_right', 'challenging', 'too_hard')),
  comment         text,
  current_level   smallint,
  session_type    text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON session_feedback FOR INSERT WITH CHECK (true);

-- 2. App store rating prompt responses
CREATE TABLE IF NOT EXISTS app_rating_prompts (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            text,
  response           text CHECK (response IN ('loved_it', 'could_be_better', 'dismissed')),
  sessions_at_prompt smallint,
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE app_rating_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON app_rating_prompts FOR INSERT WITH CHECK (true);

-- 3. Full feedback form submissions from Settings
CREATE TABLE IF NOT EXISTS user_feedback (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         text,
  category        text CHECK (category IN ('bug', 'feature_request', 'general', 'workout', 'coach')),
  message         text NOT NULL,
  app_version     text,
  device_platform text,
  current_level   smallint,
  sessions_count  smallint,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON user_feedback FOR INSERT WITH CHECK (true);

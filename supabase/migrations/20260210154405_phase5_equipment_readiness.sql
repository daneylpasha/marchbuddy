-- Phase 5: Equipment Profile & Readiness Check-in
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipment_available text[] DEFAULT '{}';
ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS readiness jsonb;

NOTIFY pgrst, 'reload schema';

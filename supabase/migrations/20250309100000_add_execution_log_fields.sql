-- Add missing fields to workout_execution_logs for proper rendering
-- of EMOM, circuit, RM build, and RIR exercise types in history view.

ALTER TABLE workout_execution_logs
  ADD COLUMN IF NOT EXISTS emom_interval_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS exercise_type TEXT,
  ADD COLUMN IF NOT EXISTS circuit_exercises JSONB,
  ADD COLUMN IF NOT EXISTS target_rm INTEGER,
  ADD COLUMN IF NOT EXISTS rir_min INTEGER,
  ADD COLUMN IF NOT EXISTS rir_max INTEGER;

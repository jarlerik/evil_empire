-- Add rest_time_seconds column to exercise_phases table
-- This column stores the rest time between sets in seconds

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'rest_time_seconds'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN rest_time_seconds INTEGER;
    END IF;
END $$;

-- Add comment to explain the column
COMMENT ON COLUMN exercise_phases.rest_time_seconds IS 'Rest time between sets in seconds (e.g., 120 for 2 minutes)';


-- Remove wave_reps column from exercise_phases table if it exists
-- This column is no longer needed since we create individual phases for wave exercises
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'wave_reps'
    ) THEN
        ALTER TABLE exercise_phases DROP COLUMN wave_reps;
    END IF;
END $$; 
-- Add compound_reps column to exercise_phases table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'compound_reps'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN compound_reps INTEGER[];
    END IF;
END $$;

-- Add comment to explain the column
COMMENT ON COLUMN exercise_phases.compound_reps IS 'Array of rep counts for compound exercises (e.g., [2, 2] for "2 + 2" format)'; 
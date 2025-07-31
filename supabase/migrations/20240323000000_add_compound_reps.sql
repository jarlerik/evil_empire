-- Add compound_reps column to exercise_phases table
ALTER TABLE exercise_phases 
ADD COLUMN compound_reps INTEGER[];

-- Add comment to explain the column
COMMENT ON COLUMN exercise_phases.compound_reps IS 'Array of rep counts for compound exercises (e.g., [2, 2] for "2 + 2" format)'; 
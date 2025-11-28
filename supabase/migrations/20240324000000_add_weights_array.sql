-- Add weights array column to exercise_phases table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'weights'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN weights DECIMAL(10,2)[];
    END IF;
END $$;

-- Add comment to explain the column
COMMENT ON COLUMN exercise_phases.weights IS 'Array of weights for each set (e.g., [50, 60, 70] for 3 sets with different weights)'; 
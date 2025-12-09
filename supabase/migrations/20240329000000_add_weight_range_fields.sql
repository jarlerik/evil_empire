-- Add weight_min and weight_max columns to exercise_phases table for weight ranges
-- Supports formats like "3 x 5@80-85%" or "3 x 5@85-89kg"

-- Add weight_min column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'weight_min'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN weight_min DECIMAL(10,2);
    END IF;
END $$;

-- Add weight_max column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'weight_max'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN weight_max DECIMAL(10,2);
    END IF;
END $$;

-- Add comments to explain the columns
COMMENT ON COLUMN exercise_phases.weight_min IS 'Minimum weight for weight ranges (e.g., 80 for "80-85%" or 85 for "85-89kg")';
COMMENT ON COLUMN exercise_phases.weight_max IS 'Maximum weight for weight ranges (e.g., 85 for "80-85%" or 89 for "85-89kg")';


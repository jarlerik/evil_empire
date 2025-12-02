-- Add new fields to exercise_phases table for enhanced exercise formats
-- Supports circuits/supersets, RM builds, RIR notation, and free-form notes

-- Add exercise_type column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'exercise_type'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN exercise_type TEXT;
    END IF;
END $$;

-- Add notes column for free-form text
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Add target_rm column for "Build to XRM" format
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'target_rm'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN target_rm INTEGER;
    END IF;
END $$;

-- Add rir_min column for minimum Reps in Reserve
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'rir_min'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN rir_min INTEGER;
    END IF;
END $$;

-- Add rir_max column for maximum Reps in Reserve (for ranges like "2-3RIR")
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'rir_max'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN rir_max INTEGER;
    END IF;
END $$;

-- Add circuit_exercises column for storing circuit/superset exercise arrays
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercise_phases' 
        AND column_name = 'circuit_exercises'
    ) THEN
        ALTER TABLE exercise_phases ADD COLUMN circuit_exercises JSONB;
    END IF;
END $$;

-- Add comments to explain the columns
COMMENT ON COLUMN exercise_phases.exercise_type IS 'Type of exercise: standard, circuit, superset, or rm_build';
COMMENT ON COLUMN exercise_phases.notes IS 'Free-form text for special instructions or notes';
COMMENT ON COLUMN exercise_phases.target_rm IS 'Target repetition maximum for "Build to XRM" format';
COMMENT ON COLUMN exercise_phases.rir_min IS 'Minimum Reps in Reserve (RIR)';
COMMENT ON COLUMN exercise_phases.rir_max IS 'Maximum Reps in Reserve (RIR) for ranges like "2-3RIR"';
COMMENT ON COLUMN exercise_phases.circuit_exercises IS 'Array of exercise descriptions for circuits/supersets, stored as JSONB array of {reps: string, name: string}';


-- Combined Migration File
-- This file contains all migrations in chronological order
-- Generated automatically - do not edit manually
-- 
-- Run this file in the Supabase SQL Editor or via CLI
-- 
-- Migration files combined:
--   - 20240320000000_create_base_tables.sql
--   - 20240320000001_create_user_settings.sql
--   - 20240321000000_create_exercise_phases.sql
--   - 20240322000000_enable_rls_workouts.sql
--   - 20240323000000_add_compound_reps.sql
--   - 20240324000000_add_weights_array.sql
--   - 20240326000000_remove_wave_reps.sql

-- ============================================
-- START OF MIGRATIONS
-- ============================================

-- ============================================
-- Migration: 20240320000000_create_base_tables.sql
-- ============================================

-- Create base tables: workouts and exercises
-- This migration must run before other migrations that reference these tables

-- Create workouts table
CREATE TABLE IF NOT EXISTS workouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workout_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_workout_date ON workouts(workout_date);
CREATE INDEX IF NOT EXISTS idx_exercises_workout_id ON exercises(workout_id);

-- Create the update_updated_at_column function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create updated_at triggers for workouts and exercises
DROP TRIGGER IF EXISTS set_updated_at_workouts ON workouts;
CREATE TRIGGER set_updated_at_workouts
    BEFORE UPDATE ON workouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_exercises ON exercises;
CREATE TRIGGER set_updated_at_exercises
    BEFORE UPDATE ON exercises
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();



-- ============================================
-- Migration: 20240320000001_create_user_settings.sql
-- ============================================

-- Create user_settings table
-- This table stores user preferences like weight unit and user weight

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lbs')),
    user_weight TEXT NOT NULL DEFAULT '85',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
CREATE POLICY "Users can view their own settings"
    ON user_settings
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
CREATE POLICY "Users can insert their own settings"
    ON user_settings
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
CREATE POLICY "Users can update their own settings"
    ON user_settings
    FOR UPDATE
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own settings" ON user_settings;
CREATE POLICY "Users can delete their own settings"
    ON user_settings
    FOR DELETE
    USING (user_id = auth.uid());

-- Create updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_user_settings ON user_settings;
CREATE TRIGGER set_updated_at_user_settings
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();



-- ============================================
-- Migration: 20240321000000_create_exercise_phases.sql
-- ============================================

-- Create exercise_phases table
CREATE TABLE IF NOT EXISTS exercise_phases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    sets INTEGER NOT NULL,
    repetitions INTEGER NOT NULL,
    weight DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE exercise_phases ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own exercise phases" ON exercise_phases;
CREATE POLICY "Users can view their own exercise phases"
    ON exercise_phases
    FOR SELECT
    USING (
        exercise_id IN (
            SELECT id FROM exercises
            WHERE workout_id IN (
                SELECT id FROM workouts
                WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert their own exercise phases" ON exercise_phases;
CREATE POLICY "Users can insert their own exercise phases"
    ON exercise_phases
    FOR INSERT
    WITH CHECK (
        exercise_id IN (
            SELECT id FROM exercises
            WHERE workout_id IN (
                SELECT id FROM workouts
                WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can update their own exercise phases" ON exercise_phases;
CREATE POLICY "Users can update their own exercise phases"
    ON exercise_phases
    FOR UPDATE
    USING (
        exercise_id IN (
            SELECT id FROM exercises
            WHERE workout_id IN (
                SELECT id FROM workouts
                WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete their own exercise phases" ON exercise_phases;
CREATE POLICY "Users can delete their own exercise phases"
    ON exercise_phases
    FOR DELETE
    USING (
        exercise_id IN (
            SELECT id FROM exercises
            WHERE workout_id IN (
                SELECT id FROM workouts
                WHERE user_id = auth.uid()
            )
        )
    );

-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON exercise_phases;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON exercise_phases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 

-- ============================================
-- Migration: 20240322000000_enable_rls_workouts.sql
-- ============================================

-- Enable RLS on workouts table
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workouts table
-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own workouts" ON workouts;
CREATE POLICY "Users can view their own workouts"
    ON workouts
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own workouts" ON workouts;
CREATE POLICY "Users can insert their own workouts"
    ON workouts
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own workouts" ON workouts;
CREATE POLICY "Users can update their own workouts"
    ON workouts
    FOR UPDATE
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own workouts" ON workouts;
CREATE POLICY "Users can delete their own workouts"
    ON workouts
    FOR DELETE
    USING (user_id = auth.uid());

-- Also ensure exercises table has RLS enabled (if it doesn't already)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for exercises table
DROP POLICY IF EXISTS "Users can view their own exercises" ON exercises;
CREATE POLICY "Users can view their own exercises"
    ON exercises
    FOR SELECT
    USING (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert their own exercises" ON exercises;
CREATE POLICY "Users can insert their own exercises"
    ON exercises
    FOR INSERT
    WITH CHECK (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own exercises" ON exercises;
CREATE POLICY "Users can update their own exercises"
    ON exercises
    FOR UPDATE
    USING (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their own exercises" ON exercises;
CREATE POLICY "Users can delete their own exercises"
    ON exercises
    FOR DELETE
    USING (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    ); 

-- ============================================
-- Migration: 20240323000000_add_compound_reps.sql
-- ============================================

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

-- ============================================
-- Migration: 20240324000000_add_weights_array.sql
-- ============================================

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

-- ============================================
-- Migration: 20240326000000_remove_wave_reps.sql
-- ============================================

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


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
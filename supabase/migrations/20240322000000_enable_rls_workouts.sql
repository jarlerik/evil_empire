-- Enable RLS on workouts table
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workouts table
CREATE POLICY "Users can view their own workouts"
    ON workouts
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own workouts"
    ON workouts
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own workouts"
    ON workouts
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own workouts"
    ON workouts
    FOR DELETE
    USING (user_id = auth.uid());

-- Also ensure exercises table has RLS enabled (if it doesn't already)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for exercises table
CREATE POLICY "Users can view their own exercises"
    ON exercises
    FOR SELECT
    USING (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own exercises"
    ON exercises
    FOR INSERT
    WITH CHECK (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own exercises"
    ON exercises
    FOR UPDATE
    USING (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own exercises"
    ON exercises
    FOR DELETE
    USING (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    ); 
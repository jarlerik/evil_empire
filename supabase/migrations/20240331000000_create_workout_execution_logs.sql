-- Create workout_execution_logs table for tracking actual workout execution
CREATE TABLE IF NOT EXISTS workout_execution_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    exercise_phase_id UUID REFERENCES exercise_phases(id) ON DELETE SET NULL,

    -- Actual execution data
    sets INTEGER NOT NULL,
    repetitions INTEGER NOT NULL,
    weight DECIMAL(10,2) NOT NULL,
    weights DECIMAL(10,2)[],
    compound_reps INTEGER[],
    rest_time_seconds INTEGER,

    -- Metadata
    execution_status TEXT DEFAULT 'completed' CHECK (execution_status IN ('completed', 'partial', 'skipped')),
    notes TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workout_execution_logs_workout_id ON workout_execution_logs(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_execution_logs_exercise_id ON workout_execution_logs(exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_execution_logs_executed_at ON workout_execution_logs(executed_at);

-- Enable RLS
ALTER TABLE workout_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Users can view their own execution logs" ON workout_execution_logs;
CREATE POLICY "Users can view their own execution logs"
    ON workout_execution_logs
    FOR SELECT
    USING (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert their own execution logs" ON workout_execution_logs;
CREATE POLICY "Users can insert their own execution logs"
    ON workout_execution_logs
    FOR INSERT
    WITH CHECK (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own execution logs" ON workout_execution_logs;
CREATE POLICY "Users can update their own execution logs"
    ON workout_execution_logs
    FOR UPDATE
    USING (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their own execution logs" ON workout_execution_logs;
CREATE POLICY "Users can delete their own execution logs"
    ON workout_execution_logs
    FOR DELETE
    USING (
        workout_id IN (
            SELECT id FROM workouts
            WHERE user_id = auth.uid()
        )
    );

-- Create updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_workout_execution_logs ON workout_execution_logs;
CREATE TRIGGER set_updated_at_workout_execution_logs
    BEFORE UPDATE ON workout_execution_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

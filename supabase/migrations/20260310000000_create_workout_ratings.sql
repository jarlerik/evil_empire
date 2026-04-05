CREATE TABLE IF NOT EXISTS workout_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- One rating per workout
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_ratings_workout_id ON workout_ratings(workout_id);

-- Enable RLS
ALTER TABLE workout_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies (via workout ownership, same pattern as workout_execution_logs)
CREATE POLICY "Users can view their own workout ratings"
    ON workout_ratings FOR SELECT
    USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own workout ratings"
    ON workout_ratings FOR INSERT
    WITH CHECK (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own workout ratings"
    ON workout_ratings FOR UPDATE
    USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own workout ratings"
    ON workout_ratings FOR DELETE
    USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

-- updated_at trigger
CREATE TRIGGER set_updated_at_workout_ratings
    BEFORE UPDATE ON workout_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

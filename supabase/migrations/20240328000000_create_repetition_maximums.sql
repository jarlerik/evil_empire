-- Create repetition_maximums table
-- This table stores user repetition maximums (1RM, 5RM, 10RM, etc.) with history tracking
-- RMs are stored by exercise name, not tied to specific exercise instances

CREATE TABLE IF NOT EXISTS repetition_maximums (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    reps INTEGER NOT NULL CHECK (reps > 0),
    weight DECIMAL(10,2) NOT NULL CHECK (weight > 0),
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_repetition_maximums_user_id ON repetition_maximums(user_id);
CREATE INDEX IF NOT EXISTS idx_repetition_maximums_exercise_name ON repetition_maximums(exercise_name);
CREATE INDEX IF NOT EXISTS idx_repetition_maximums_user_exercise_reps_date ON repetition_maximums(user_id, exercise_name, reps, date DESC);

-- Enable RLS
ALTER TABLE repetition_maximums ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own repetition maximums" ON repetition_maximums;
CREATE POLICY "Users can view their own repetition maximums"
    ON repetition_maximums
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own repetition maximums" ON repetition_maximums;
CREATE POLICY "Users can insert their own repetition maximums"
    ON repetition_maximums
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own repetition maximums" ON repetition_maximums;
CREATE POLICY "Users can update their own repetition maximums"
    ON repetition_maximums
    FOR UPDATE
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own repetition maximums" ON repetition_maximums;
CREATE POLICY "Users can delete their own repetition maximums"
    ON repetition_maximums
    FOR DELETE
    USING (user_id = auth.uid());

-- Create updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_repetition_maximums ON repetition_maximums;
CREATE TRIGGER set_updated_at_repetition_maximums
    BEFORE UPDATE ON repetition_maximums
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


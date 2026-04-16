-- Create programs feature tables
-- Implements multi-week, day-of-week-scheduled training programs.
-- Four tables: programs, program_sessions, program_exercises, program_repetition_maximums.
-- `user_id` denormalized on all three child tables and maintained by BEFORE INSERT triggers
-- so RLS policies stay flat (no nested subquery traversal).

-- ============================================================================
-- programs
-- ============================================================================

CREATE TABLE IF NOT EXISTS programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_weeks INTEGER NOT NULL CHECK (duration_weeks > 0 AND duration_weeks <= 52),
    start_iso_year INTEGER,
    start_iso_week INTEGER CHECK (start_iso_week IS NULL OR (start_iso_week BETWEEN 1 AND 53)),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_programs_user_id ON programs(user_id);
CREATE INDEX IF NOT EXISTS idx_programs_user_status ON programs(user_id, status);

-- ============================================================================
-- program_sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS program_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_offset INTEGER NOT NULL CHECK (week_offset >= 0),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (program_id, week_offset, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_program_sessions_program_id ON program_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_program_sessions_user_id ON program_sessions(user_id);

-- ============================================================================
-- program_exercises
-- ============================================================================

CREATE TABLE IF NOT EXISTS program_exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_session_id UUID NOT NULL REFERENCES program_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    raw_input TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_program_exercises_session_id ON program_exercises(program_session_id);
CREATE INDEX IF NOT EXISTS idx_program_exercises_user_id ON program_exercises(user_id);

-- ============================================================================
-- program_repetition_maximums
-- ============================================================================

CREATE TABLE IF NOT EXISTS program_repetition_maximums (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    weight DECIMAL(10,2) NOT NULL CHECK (weight > 0),
    tested_at DATE,
    source TEXT NOT NULL CHECK (source IN ('lookup', 'partial_match', 'manual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_program_rms_unique_name
    ON program_repetition_maximums (program_id, LOWER(exercise_name));
CREATE INDEX IF NOT EXISTS idx_program_rms_program_id ON program_repetition_maximums(program_id);
CREATE INDEX IF NOT EXISTS idx_program_rms_user_id ON program_repetition_maximums(user_id);

-- ============================================================================
-- workouts.program_session_id link
-- ============================================================================

ALTER TABLE workouts
    ADD COLUMN IF NOT EXISTS program_session_id UUID
    REFERENCES program_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workouts_program_session_id
    ON workouts(program_session_id);

-- One materialized workout per program session
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_unique_program_session
    ON workouts(program_session_id)
    WHERE program_session_id IS NOT NULL;

-- ============================================================================
-- user_id-propagation triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION set_program_session_user_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT user_id INTO NEW.user_id FROM programs WHERE id = NEW.program_id;
    IF NEW.user_id IS NULL THEN
        RAISE EXCEPTION 'program_sessions.user_id could not be resolved from program_id=%', NEW.program_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_program_sessions_set_user_id ON program_sessions;
CREATE TRIGGER trg_program_sessions_set_user_id
    BEFORE INSERT ON program_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_program_session_user_id();

CREATE OR REPLACE FUNCTION set_program_exercise_user_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT user_id INTO NEW.user_id FROM program_sessions WHERE id = NEW.program_session_id;
    IF NEW.user_id IS NULL THEN
        RAISE EXCEPTION 'program_exercises.user_id could not be resolved from program_session_id=%', NEW.program_session_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_program_exercises_set_user_id ON program_exercises;
CREATE TRIGGER trg_program_exercises_set_user_id
    BEFORE INSERT ON program_exercises
    FOR EACH ROW
    EXECUTE FUNCTION set_program_exercise_user_id();

CREATE OR REPLACE FUNCTION set_program_rm_user_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT user_id INTO NEW.user_id FROM programs WHERE id = NEW.program_id;
    IF NEW.user_id IS NULL THEN
        RAISE EXCEPTION 'program_repetition_maximums.user_id could not be resolved from program_id=%', NEW.program_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_program_rms_set_user_id ON program_repetition_maximums;
CREATE TRIGGER trg_program_rms_set_user_id
    BEFORE INSERT ON program_repetition_maximums
    FOR EACH ROW
    EXECUTE FUNCTION set_program_rm_user_id();

-- ============================================================================
-- updated_at triggers (reuse update_updated_at_column() from base migration)
-- ============================================================================

DROP TRIGGER IF EXISTS set_updated_at_programs ON programs;
CREATE TRIGGER set_updated_at_programs
    BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_program_sessions ON program_sessions;
CREATE TRIGGER set_updated_at_program_sessions
    BEFORE UPDATE ON program_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_program_exercises ON program_exercises;
CREATE TRIGGER set_updated_at_program_exercises
    BEFORE UPDATE ON program_exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_program_rms ON program_repetition_maximums;
CREATE TRIGGER set_updated_at_program_rms
    BEFORE UPDATE ON program_repetition_maximums
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS — flat (user_id = auth.uid()) everywhere; INSERT validates parent ownership
-- ============================================================================

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own programs" ON programs;
CREATE POLICY "Users can view their own programs" ON programs
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own programs" ON programs;
CREATE POLICY "Users can insert their own programs" ON programs
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own programs" ON programs;
CREATE POLICY "Users can update their own programs" ON programs
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own programs" ON programs;
CREATE POLICY "Users can delete their own programs" ON programs
    FOR DELETE USING (user_id = auth.uid());

ALTER TABLE program_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own program sessions" ON program_sessions;
CREATE POLICY "Users can view their own program sessions" ON program_sessions
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own program sessions" ON program_sessions;
CREATE POLICY "Users can insert their own program sessions" ON program_sessions
    FOR INSERT WITH CHECK (
        program_id IN (SELECT id FROM programs WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update their own program sessions" ON program_sessions;
CREATE POLICY "Users can update their own program sessions" ON program_sessions
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own program sessions" ON program_sessions;
CREATE POLICY "Users can delete their own program sessions" ON program_sessions
    FOR DELETE USING (user_id = auth.uid());

ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own program exercises" ON program_exercises;
CREATE POLICY "Users can view their own program exercises" ON program_exercises
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own program exercises" ON program_exercises;
CREATE POLICY "Users can insert their own program exercises" ON program_exercises
    FOR INSERT WITH CHECK (
        program_session_id IN (SELECT id FROM program_sessions WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update their own program exercises" ON program_exercises;
CREATE POLICY "Users can update their own program exercises" ON program_exercises
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own program exercises" ON program_exercises;
CREATE POLICY "Users can delete their own program exercises" ON program_exercises
    FOR DELETE USING (user_id = auth.uid());

ALTER TABLE program_repetition_maximums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own program RMs" ON program_repetition_maximums;
CREATE POLICY "Users can view their own program RMs" ON program_repetition_maximums
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own program RMs" ON program_repetition_maximums;
CREATE POLICY "Users can insert their own program RMs" ON program_repetition_maximums
    FOR INSERT WITH CHECK (
        program_id IN (SELECT id FROM programs WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update their own program RMs" ON program_repetition_maximums;
CREATE POLICY "Users can update their own program RMs" ON program_repetition_maximums
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own program RMs" ON program_repetition_maximums;
CREATE POLICY "Users can delete their own program RMs" ON program_repetition_maximums
    FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- materialize_program_session RPC
-- Thin transactional-insert wrapper. Client supplies fully-resolved
-- exercises[i].phase (output of buildPhaseData) — RPC does not parse or do math.
-- Idempotent: second call for the same session returns the existing workout_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION materialize_program_session(
    p_session_id UUID,
    p_target_date DATE,
    p_name TEXT,
    p_exercises JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_user_id UUID;
    v_workout_id UUID;
    v_exercise_id UUID;
    v_existing_workout_id UUID;
    v_ex JSONB;
    v_phase JSONB;
BEGIN
    -- Fast-path idempotency: session already materialized.
    SELECT id INTO v_existing_workout_id
        FROM workouts WHERE program_session_id = p_session_id LIMIT 1;
    IF v_existing_workout_id IS NOT NULL THEN
        RETURN v_existing_workout_id;
    END IF;

    -- Resolve owner from program_sessions (RLS gates this SELECT).
    SELECT user_id INTO v_user_id
        FROM program_sessions WHERE id = p_session_id;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'program_session % not found or not accessible', p_session_id;
    END IF;

    INSERT INTO workouts (user_id, name, workout_date, program_session_id)
        VALUES (v_user_id, p_name, p_target_date, p_session_id)
        RETURNING id INTO v_workout_id;

    FOR v_ex IN SELECT * FROM jsonb_array_elements(p_exercises)
    LOOP
        INSERT INTO exercises (workout_id, name)
            VALUES (v_workout_id, v_ex->>'name')
            RETURNING id INTO v_exercise_id;

        v_phase := v_ex->'phase';

        INSERT INTO exercise_phases (
            exercise_id, sets, repetitions, weight,
            compound_reps, weights, exercise_type,
            rir_min, rir_max, notes, target_rm,
            circuit_exercises, weight_min, weight_max,
            rest_time_seconds, emom_interval_seconds
        ) VALUES (
            v_exercise_id,
            (v_phase->>'sets')::INT,
            (v_phase->>'repetitions')::INT,
            (v_phase->>'weight')::NUMERIC,
            CASE WHEN jsonb_typeof(v_phase->'compound_reps') = 'array'
                THEN ARRAY(SELECT x::INT FROM jsonb_array_elements_text(v_phase->'compound_reps') AS x)
                ELSE NULL END,
            CASE WHEN jsonb_typeof(v_phase->'weights') = 'array'
                THEN ARRAY(SELECT x::NUMERIC FROM jsonb_array_elements_text(v_phase->'weights') AS x)
                ELSE NULL END,
            COALESCE(v_phase->>'exercise_type', 'standard'),
            NULLIF(v_phase->>'rir_min', '')::INT,
            NULLIF(v_phase->>'rir_max', '')::INT,
            v_phase->>'notes',
            NULLIF(v_phase->>'target_rm', '')::INT,
            v_phase->'circuit_exercises',
            NULLIF(v_phase->>'weight_min', '')::NUMERIC,
            NULLIF(v_phase->>'weight_max', '')::NUMERIC,
            NULLIF(v_phase->>'rest_time_seconds', '')::INT,
            NULLIF(v_phase->>'emom_interval_seconds', '')::INT
        );
    END LOOP;

    RETURN v_workout_id;
EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing_workout_id
        FROM workouts WHERE program_session_id = p_session_id LIMIT 1;
    RETURN v_existing_workout_id;
END;
$$;

GRANT EXECUTE ON FUNCTION materialize_program_session(UUID, DATE, TEXT, JSONB) TO authenticated;

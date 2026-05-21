-- Add default_rest_seconds column to user_settings.
-- When set, this value is baked into exercise_phases.rest_time_seconds at
-- create/edit time when the user does not specify an explicit rest in the
-- exercise input.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'default_rest_seconds'
    ) THEN
        ALTER TABLE user_settings ADD COLUMN default_rest_seconds INTEGER;
    END IF;
END $$;

COMMENT ON COLUMN user_settings.default_rest_seconds IS 'When set, baked into exercise_phases.rest_time_seconds at create/edit if input has no explicit rest.';

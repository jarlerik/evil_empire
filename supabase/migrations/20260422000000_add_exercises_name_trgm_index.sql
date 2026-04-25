-- Trigram index on exercises.name for case-insensitive substring search.
--
-- The exercise-progression screen filters workouts server-side by
-- `ilike '%target%'` against the exercise name so the client only decomposes
-- a pre-filtered set (matching direct names and compounds that contain the
-- target as a segment). Without an index this is a sequential scan over the
-- user's full exercise history.
--
-- pg_trgm is bundled with every Supabase Postgres; this just enables it for
-- our database if it isn't already.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_exercises_name_trgm
    ON exercises USING gin (name gin_trgm_ops);

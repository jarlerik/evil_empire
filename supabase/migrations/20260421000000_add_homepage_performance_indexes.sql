-- Home page performance indexes.
--
-- exercise_phases(exercise_id): the table has had no index on this foreign key
-- since creation in 20240321000000_create_exercise_phases.sql. Every phase
-- lookup via fetchPhasesByExerciseId[s] was a sequential scan.
--
-- workouts(user_id, workout_date): enables index range scans for the
-- week-scoped workout fetch planned in the follow-up PR. The existing
-- idx_workouts_user_id stays in place for queries that filter by user alone.
--
-- workout_execution_logs(workout_id, executed_at DESC): supports history and
-- start-workout screens that order logs by recency within a workout.

CREATE INDEX IF NOT EXISTS idx_exercise_phases_exercise_id
    ON exercise_phases(exercise_id);

CREATE INDEX IF NOT EXISTS idx_workouts_user_date
    ON workouts(user_id, workout_date);

CREATE INDEX IF NOT EXISTS idx_workout_execution_logs_workout_executed
    ON workout_execution_logs(workout_id, executed_at DESC);

-- Program slip: push unmaterialized sessions forward by N cadence slots.
-- A "slot" is one cadence position across the program (e.g., for a
-- Mon/Thu program, slot 0 = first Mon, slot 1 = first Thu, slot 2 = second
-- Mon, ...). Slip never touches materialized workouts; only virtual
-- session render dates shift. See
-- docs/evil_empire/peakTrack/plans/program-slip-plan.md.

ALTER TABLE programs
    ADD COLUMN IF NOT EXISTS slip_slots INTEGER NOT NULL DEFAULT 0
        CHECK (slip_slots >= 0);

COMMENT ON COLUMN programs.slip_slots IS
    'Number of cadence slots the program has been pushed forward. '
    'Virtual session dates are computed as cadence_slot(session) + slip_slots, '
    'then mapped back to a calendar date. Materialized workouts are unaffected.';

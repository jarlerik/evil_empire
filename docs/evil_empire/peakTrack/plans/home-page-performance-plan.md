# PeakTrack Home Page Performance — Findings, Options & Plan

> **Target location after approval:** `docs/evil_empire/peakTrack/plans/home-page-performance-plan.md`

## Context

The PeakTrack home page (`apps/mobile/PeakTrack/app/index.tsx`) takes "quite a long time to load". This document is a diagnostic of why, plus a catalog of every mitigation option with strengths, weaknesses, and risks, so we can decide how aggressive to be.

The home page is the primary post-login surface. It renders a weekly calendar, the workouts and virtual program sessions for the selected date, and lets the user add exercises. Every `useFocusEffect` (every time the user returns to the tab) re-runs the full data load.

> **Note — pre-production:** PeakTrack is not yet live with real users. There is no production traffic to protect, no user data at risk, and no backward-compatibility burden. Schema migrations, RLS rewrites, and API-surface changes that would otherwise be risky on a live system can be executed freely here. Risk ratings in the options below should be read with this in mind — items tagged "Medium" or "Medium–High" risk largely reflect *reversibility on a live DB*, which does not apply. The practical constraints are engineering correctness and test coverage, not user impact.

---

## Current State — Query Waterfall

### `loadData` in `app/index.tsx:86-121`

```
[Context init, parallel]
  ├─ user_settings  (UserSettingsContext)
  └─ programs       (ProgramsContext, cached)

[useFocusEffect on home page]
  1. fetchWorkoutsByUserId(user.id)
        → SELECT * FROM workouts WHERE user_id = $1
        → Returns ALL workouts ever (no date filter)

  2. FOR EACH workout:                        ← SEQUENTIAL N+1
        fetchExercisesByWorkoutId(workout.id)
        → SELECT * FROM exercises WHERE workout_id = $1

        FOR EACH exercise:                    ← SEQUENTIAL N+1
           fetchPhasesByExerciseId(exercise.id)
           → SELECT * FROM exercise_phases WHERE exercise_id = $1

  3. fetchCompletedWorkoutIds(workoutIds[])   ← batched (OK)

  4. fetchSessionsForRange(weekStart, weekEnd)
        → 5 sequential Supabase queries inside programService.ts
```

### Order-of-magnitude math
For a typical user with **20 workouts, 100 exercises total**:
- 1 workouts query
- 20 exercises queries (sequential)
- 100 phases queries (sequential)
- 1 completion query
- 5 program session queries (sequential)
- **Total: ~127 round trips, estimated 900–1500 ms**

### Verified root causes

| # | Issue | Evidence |
|---|-------|----------|
| 1 | Exercise N+1 | `app/index.tsx:97-104` awaits `fetchExercisesByWorkoutId` in `for...of` |
| 2 | Phase N+1 | `app/index.tsx:75-84, 101` awaits `fetchPhasesByExerciseId` in `for...of` |
| 3 | Over-fetching all workouts | `fetchWorkoutsByUserId` in `workoutService.ts:8-24` has no date filter; home only renders the visible week |
| 4 | Missing index on `exercise_phases(exercise_id)` | Verified in `supabase/migrations/20240321000000_create_exercise_phases.sql` — table declared, RLS enabled, zero indexes |
| 5 | Missing composite `workouts(user_id, workout_date)` | Only single-column `idx_workouts_user_id` exists; date range queries can't use it efficiently |
| 6 | Nested RLS subqueries | `exercises`, `exercise_phases`, `workout_execution_logs`, `workout_ratings` policies chain through `workouts.user_id = auth.uid()` |
| 7 | `auth.uid()` not wrapped in `(SELECT ...)` | Legacy policies call `auth.uid()` directly; can re-evaluate per row |
| 8 | Serialized programs query chain | `programService.ts:541-699` runs 5 queries sequentially; queries 3–5 are independent of each other |
| 9 | No request caching for workouts/exercises/phases | Every focus event re-runs full chain. `ProgramsContext` has a date-range cache; no equivalent for workouts |

### Reusable helpers that already exist but are not used on the home page

| Function | Location | Status |
|----------|----------|--------|
| `fetchExercisesByWorkoutIds(ids[])` | `packages/peaktrack-services/src/exerciseService.ts:77-93` | Exists, unused on home page |
| `fetchPhasesByExerciseIds(ids[])` | `packages/peaktrack-services/src/exercisePhaseService.ts:42-62` | Exists, unused on home page |
| `fetchCompletedWorkoutIds(ids[])` | `packages/peaktrack-services/src/workoutExecutionLogService.ts:66-86` | Already batched |
| ProgramsContext date-range cache pattern | `contexts/ProgramsContext.tsx:36, 67-93` | Blueprint for a `WorkoutsContext` cache |
| `user_id` denormalization + trigger + flat RLS | `supabase/migrations/20260416000000_create_programs.sql:106-155` | In-repo template for Phase E |

---

## Mitigation Options

Each option has **impact**, **effort**, **risk**, **strengths**, **weaknesses**, **verification**.

---

### Phase A — Client-side batching in `app/index.tsx`

**What:** Replace the N+1 loops with `fetchExercisesByWorkoutIds` and `fetchPhasesByExerciseIds`. Parallelize with `fetchSessionsForRange`.

**Files:**
- `apps/mobile/PeakTrack/app/index.tsx` — rewrite `loadData` (86-121), delete `fetchExercisePhasesForList` (75-84).

**Shape after change:**
```ts
const { data: workouts } = await fetchWorkoutsByUserId(user.id);
const workoutIds = workouts.map(w => w.id);
const [exRes, completedRes, sessionsRes] = await Promise.all([
  fetchExercisesByWorkoutIds(workoutIds),
  fetchCompletedWorkoutIds(workoutIds),
  fetchSessionsForRange(selectedWeekStart, rangeEnd),
]);
const exerciseIds = (exRes.data ?? []).map(e => e.id);
const { data: phases } = await fetchPhasesByExerciseIds(exerciseIds);
// group into exercisesMap / exercisePhasesMap client-side
```

**Impact:** From ~127 round trips to ~4. Expected home-page time drops from 900–1500 ms to 150–300 ms even without DB changes.

**Strengths:**
- Biggest single win.
- Pure client-side; no schema change.
- Batch helpers are already in use elsewhere (history screen), so they're battle-tested.

**Weaknesses:**
- Grouping happens in-memory; trivial for realistic dataset sizes.

**Risks:**
- Low. Mainly: if `workoutIds[]` or `exerciseIds[]` is empty, the `.in()` call must short-circuit. `fetchPhasesByExerciseIds` already handles that (`exercisePhaseService.ts:47-49`); `fetchExercisesByWorkoutIds` does not — needs a guard.

**Verification:**
- Manual QA: open home, navigate weeks, delete a workout, add exercise.
- Confirm `exercises[workout.id]` and `exercisePhases[exercise.id]` maps match today's shape (no UI regressions).
- Network inspector: request count per focus event.

---

### Phase B — Scope narrowing to the visible week

**What:** Only fetch workouts within the selected week, not every workout ever.

**Files:**
- `packages/peaktrack-services/src/workoutService.ts` — add `fetchWorkoutsByUserIdAndDateRange(userId, startDate, endDate)`. Leave `fetchWorkoutsByUserId` intact.
- `apps/mobile/PeakTrack/app/index.tsx` — call the new helper with `[selectedWeekStart, addDays(selectedWeekStart, 6)]`.
- `apps/mobile/PeakTrack/app/import-workout.tsx:234` — migrate to narrower helper (uses `targetDateStr` only).

**Impact:** For a user with a year of workouts (~200 rows), home page fetches ~5–10 instead of 200. Pairs with Phase C's composite index to become an index range scan.

**Strengths:**
- Reduces row volume, JSON payload, and serialization cost.
- Additive helper; no breaking change to existing callers.

**Weaknesses:**
- `dayStatuses` (the indicator dots on `WeekDaySelector`, `index.tsx:298-316`) today reflects every workout across all time. After narrowing, dots only exist for the visible week — which is what the selector actually shows anyway. Need to verify visually that this is what we want.

**Risks:**
- Low-Medium. If other callers of `fetchWorkoutsByUserId` change behavior, regressions. Mitigated by *adding* a new helper rather than changing the existing one.
- `import-workout.tsx` uses a `Workout #N` numbering scheme; confirm it still numbers correctly when scoped to one date.

**Verification:**
- QA: navigate forward/back several weeks, confirm workouts appear correctly.
- QA: day-status dots render correctly in the visible week.
- Run existing workout/import tests.

---

### Phase C — Database indexes (additive migration)

**What:** Add three indexes.

**New migration:** `supabase/migrations/<timestamp>_add_homepage_performance_indexes.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_exercise_phases_exercise_id
    ON exercise_phases(exercise_id);

CREATE INDEX IF NOT EXISTS idx_workouts_user_date
    ON workouts(user_id, workout_date);

CREATE INDEX IF NOT EXISTS idx_workout_execution_logs_workout_executed
    ON workout_execution_logs(workout_id, executed_at DESC);
```

**Impact:**
- `idx_exercise_phases_exercise_id`: single biggest DB win. Today every phase lookup is a seq scan on `exercise_phases`. Turns `fetchPhasesByExerciseIds` into an index-scan.
- `idx_workouts_user_date`: enables the week-range filter in Phase B to use an index.
- `idx_workout_execution_logs_workout_executed`: helps history/start-workout screens.

**Strengths:**
- Idempotent (`IF NOT EXISTS`).
- Additive: zero breaking changes, reads unaffected during creation.
- Follows Supabase best-practice: "Index foreign key columns" (query performance rule 4.2) and "composite indexes for multi-column queries" (1.3).

**Weaknesses:**
- Writes to `exercise_phases` get a fractional slowdown (one more index to maintain). Irrelevant at PeakTrack's scale.
- Index bloat if table grows; routine `VACUUM ANALYZE` handles it.

**Risks:**
- Very low. On a tiny table `CREATE INDEX` is instant. If tables grow later, use `CREATE INDEX CONCURRENTLY` to avoid holding `SHARE` locks.

**Verification:**
- `EXPLAIN ANALYZE SELECT * FROM exercise_phases WHERE exercise_id = ANY(ARRAY[…]);` should show `Index Scan using idx_exercise_phases_exercise_id`.
- Same for week-range queries on `workouts`.

---

### Phase D — Parallelize programs query chain

**What:** In `fetchProgramSessionsForDateRange` (`programService.ts:541-699`), queries 3 (program_exercises), 4 (materialized workouts), and 5 (program_repetition_maximums) all depend only on `sessionIds`/`activeProgramIds` from queries 1–2. Run them via `Promise.all`.

**Files:**
- `packages/peaktrack-services/src/programService.ts:541-699`

**Impact:** Saves 2 round trips (~60–120 ms depending on latency). Small, but free.

**Strengths:**
- Semantics unchanged.
- No schema or API surface change.

**Weaknesses:**
- Small absolute gain.

**Risks:**
- Very low. Pure concurrency.

**Verification:**
- QA the programs path on the home page (virtual sessions render, materialization flows work).
- Existing parser/program tests.

---

### Phase E — RLS flattening via `user_id` denormalization (optional)

**What:** Add `user_id` columns to `exercises`, `exercise_phases`, `workout_execution_logs`, `workout_ratings`; backfill; install BEFORE INSERT triggers; rewrite RLS policies from nested-subquery to flat `user_id = (SELECT auth.uid())`; add `user_id` indexes.

**New migration:** `supabase/migrations/<timestamp>_denormalize_user_id_and_flatten_rls.sql`

**Impact:** Per Supabase docs, flat RLS is 5–10× faster than nested-subquery RLS on large datasets. At current scale the gain is modest (20–100 ms); it compounds as tables grow.

**Strengths:**
- The template already exists in-repo (`20260416000000_create_programs.sql:106-155` for `program_sessions`).
- Simplifies policy expressions — easier to reason about security.
- Combines cleanly with Phase G (`(SELECT auth.uid())` wrapping) since the rewrite touches every policy anyway.

**Weaknesses:**
- Effectively irreversible on a live database.
- Schema surface expands (more columns, more triggers).

**Risks:**
- **Medium–High.** A trigger bug writing NULL `user_id` silently locks rows out of RLS. A policy typo can expose another user's data. Mitigations:
  - Full RLS test matrix (two distinct user tokens × every table × every CRUD op) before production.
  - Dry-run on staging.
  - `WITH CHECK` clauses as a defense in depth.
- Backfill on a large table can be slow; do it in batches if `exercise_phases` is over ~1M rows.

**Verification:**
- Automated RLS tests per table, per op, with two user contexts.
- `EXPLAIN ANALYZE` before/after — expect nested-loop-with-SubPlan to collapse to a single hash join.
- Staging smoke test.

**Recommendation:** **Gate on measurement.** Do Phase A+B+C+D first. If home page is <300 ms after, skip Phase E. If `EXPLAIN ANALYZE` still shows `SubPlan 1` per row on `exercise_phases`, proceed.

---

### Phase F — React Query / SWR (optional, different track)

**What:** Introduce `@tanstack/react-query`. Wrap `_layout.tsx` with `QueryClientProvider`. Convert `loadData` to `useQuery(['home', userId, weekStart], ...)`. Tie mutations to `queryClient.invalidateQueries`.

**Impact:**
- **UX:** on back-navigation, data is already on screen (stale), revalidates silently. Feels instant.
- **Query time:** same as post-Phase-A per fetch, but cached repeat visits drop to zero queries within the cache TTL.

**Strengths:**
- Well-known, standard pattern.
- Stale-while-revalidate UX is the biggest subjective speed improvement users feel.
- Built-in request deduplication.

**Weaknesses:**
- New dependency (~20 kB gz).
- Patterns ripple through the app; `useFocusEffect` interactions need care.
- Cache invalidation is a new category of bug.

**Risks:**
- **Medium.** New dependency, new idioms. Overkill for a single screen.

**Cheaper alternative:** extend the `ProgramsContext` cache pattern to a `WorkoutsContext` keyed by `weekStart`. Same UX win, no new dep. Recommended if you want SWR-ish behavior without React Query.

**Recommendation:** **Defer.** Revisit once more screens need to share query data (analytics, reporting).

---

### Phase G — Wrap `auth.uid()` in `(SELECT auth.uid())` on legacy RLS (optional, cheap)

**What:** Add a migration that drops-and-recreates every RLS policy on legacy tables (`workouts`, `exercises`, `exercise_phases`, `user_settings`, `repetition_maximums`, `workout_execution_logs`, `workout_ratings`), with `auth.uid()` wrapped in `(SELECT auth.uid())`.

**New migration:** `supabase/migrations/<timestamp>_wrap_auth_uid_in_select.sql`

**Impact:** Per Supabase best-practice 3.3: "wrap functions in SELECT" — the planner caches the result once per statement instead of re-evaluating per row. Quoted numbers: "100x+ faster on large tables" for the RLS predicate itself.

**Strengths:**
- Mechanical rewrite; no schema change, no data migration.
- Compatible with or without Phase E.
- Combines with Phase C indexes — RLS predicates use the indexed `user_id` column.

**Weaknesses:**
- Pure DDL churn; every policy is re-declared. Touches many lines.

**Risks:**
- Low. The only failure mode is a typo in a policy expression — mitigated by running the RLS test matrix before merge.

**Verification:**
- Re-run the existing app smoke (sign in, load home, add exercise, run workout) as two different users to confirm isolation.
- `EXPLAIN ANALYZE` any RLS-heavy query; the `Filter:` line should no longer show a function call.

---

### Phase H — Baseline measurement (optional but recommended)

**What:** Add timing instrumentation in `loadData` (wrap each step with `performance.now()` + `console.log`). Capture `EXPLAIN ANALYZE` for the key queries in Supabase SQL Editor. Commit the baseline numbers alongside Phase A so the improvement is measurable.

**Impact:** No runtime impact; informs whether Phase E is needed.

**Strengths:**
- Turns "feels slow" into numbers.
- Gates Phase E with data, not guesses.

**Weaknesses:**
- None meaningful.

**Risks:**
- None.

**Recommendation:** **Include.** It's cheap and disproportionately valuable.

---

## Summary Table

| Phase | Impact | Effort | Risk | Recommendation |
|-------|--------|--------|------|----------------|
| A — Client-side batching | **Huge** (10× round trips) | 1 h | Low | **Do first** |
| B — Week-scope narrowing | High | 1–2 h | Low–Med | **Do** |
| C — DB indexes | High | 30 min | Very low | **Do with A** |
| D — Parallel programs chain | Medium | 30 min | Very low | **Do** |
| E — RLS flattening | High long-term | 1 day | Medium | **Gate on measurement** |
| F — React Query | Medium (UX) | 1 day | Medium | **Defer** |
| G — `(SELECT auth.uid())` wrap | Medium | 1 h | Low | **Include** (cheap) |
| H — Baseline measurement | Enables evidence | 30 min | None | **Include** |

---

## Recommended Rollout

### PR 1 — "Fix home page N+1 + indexes" (bundle A + C + D + H)

**Baseline measurement (H)**
- [ ] Add `performance.now()` timing wrappers around each step of `loadData` in `app/index.tsx:86-121`
- [ ] Capture request counts via network inspector on a test account with ≥10 workouts
- [ ] Run `EXPLAIN ANALYZE` in Supabase SQL Editor for: `SELECT * FROM exercise_phases WHERE exercise_id = ANY(ARRAY[...])`, `SELECT * FROM workouts WHERE user_id = $1`, and the programs 5-query chain
- [ ] Record baseline numbers (total ms, round-trip count, per-query EXPLAIN output) in PR description

**Database indexes (C)**
- [ ] Create migration file `supabase/migrations/<timestamp>_add_homepage_performance_indexes.sql`
- [ ] Add `CREATE INDEX IF NOT EXISTS idx_exercise_phases_exercise_id ON exercise_phases(exercise_id)`
- [ ] Add `CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, workout_date)`
- [ ] Add `CREATE INDEX IF NOT EXISTS idx_workout_execution_logs_workout_executed ON workout_execution_logs(workout_id, executed_at DESC)`
- [ ] Verify via `EXPLAIN ANALYZE` that queries now use index scans

**Client-side batching (A)**
- [ ] Add empty-array guard to `fetchExercisesByWorkoutIds` in `packages/peaktrack-services/src/exerciseService.ts` (matches pattern at `exercisePhaseService.ts:47-49`)
- [ ] Delete `fetchExercisePhasesForList` helper in `app/index.tsx:75-84`
- [ ] Rewrite `loadData` (`app/index.tsx:86-121`) to use `fetchExercisesByWorkoutIds` + `fetchPhasesByExerciseIds`
- [ ] Wrap the workouts-fetch side and `fetchSessionsForRange` in `Promise.all` so they run in parallel
- [ ] Group flat exercise/phase arrays into `exercisesMap` and `exercisePhasesMap` client-side
- [ ] Update imports in `app/index.tsx` to remove `fetchExercisesByWorkoutId` and `fetchPhasesByExerciseId`

**Parallelize programs query chain (D)**
- [ ] In `programService.ts:541-699` (`fetchProgramSessionsForDateRange`), wrap queries 3 (program_exercises), 4 (materialized workouts), and 5 (program_repetition_maximums) in `Promise.all`
- [ ] Preserve error handling — any non-null error from the three results should short-circuit the return

**Verification**
- [ ] Manual QA: sign in, home loads, navigate weeks ↔, add exercise, delete workout, move missed workout, materialize program session, start workout timer
- [ ] Confirm `exercises[workout.id]` and `exercisePhases[exercise.id]` shapes unchanged (no UI regressions)
- [ ] Network inspector: confirm round-trip count dropped from ~127 to ~4
- [ ] Re-run timing logs; confirm post-change numbers in PR description
- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`

**Expected result:** 900–1500 ms → ~150 ms.

---

### PR 2 — "Narrow home page queries to visible week" (B)

- [ ] Add `fetchWorkoutsByUserIdAndDateRange(userId, startDate, endDate)` to `packages/peaktrack-services/src/workoutService.ts` (leave `fetchWorkoutsByUserId` untouched)
- [ ] Export the new helper from the package entry point
- [ ] Update `app/index.tsx::loadData` to call the new helper with `[selectedWeekStart, addDays(selectedWeekStart, 6)]`
- [ ] Update `app/import-workout.tsx:234` to call the new helper with `targetDateStr` bounds
- [ ] Verify `dayStatuses` (`index.tsx:298-316`) still renders week-status dots correctly with the narrower dataset
- [ ] Verify `Workout #N` auto-numbering in `import-workout.tsx` still works when scoped to a single date
- [ ] Manual QA: navigate ±several weeks, confirm workouts appear, confirm day-status dots match
- [ ] Confirm `EXPLAIN ANALYZE` shows index range scan on `idx_workouts_user_date`
- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`

**Expected result:** smaller payloads, better index use.

---

### PR 3 (optional) — "Wrap auth.uid() in SELECT for RLS planner caching" (G)

- [ ] Create migration `supabase/migrations/<timestamp>_wrap_auth_uid_in_select.sql`
- [ ] For each legacy table (`workouts`, `exercises`, `exercise_phases`, `user_settings`, `repetition_maximums`, `workout_execution_logs`, `workout_ratings`): `DROP POLICY` then `CREATE POLICY` with `auth.uid()` wrapped in `(SELECT auth.uid())`
- [ ] Preserve policy names and USING/WITH CHECK semantics exactly
- [ ] Full RLS smoke test with two distinct user accounts: sign in as user A, create data, sign in as user B, confirm user A's data is invisible and un-editable across every CRUD path
- [ ] `EXPLAIN ANALYZE` an RLS-heavy query — `Filter:` line should no longer show a function call
- [ ] Run `pnpm test`

---

### PR 4 (only if measurements demand it) — "Flatten RLS via user_id denormalization" (E)

- [ ] Measurement gate: confirm `EXPLAIN ANALYZE` still shows `SubPlan 1` per-row overhead on `exercise_phases` after PR 1–3 land
- [ ] Create migration `supabase/migrations/<timestamp>_denormalize_user_id_and_flatten_rls.sql`
- [ ] `ALTER TABLE` to add `user_id UUID REFERENCES auth.users(id)` on `exercises`, `exercise_phases`, `workout_execution_logs`, `workout_ratings` (nullable at first)
- [ ] Backfill `user_id` via joins back through `workouts`
- [ ] `ALTER COLUMN user_id SET NOT NULL` on all four tables
- [ ] Add BEFORE INSERT triggers mirroring `set_program_session_user_id` pattern (`20260416000000_create_programs.sql:106-155`)
- [ ] Add `CREATE INDEX ... ON <table>(user_id)` for all four tables
- [ ] `DROP` nested-subquery RLS policies; recreate as flat `USING (user_id = (SELECT auth.uid()))` with matching `WITH CHECK`
- [ ] Staging dry-run: apply migration on a staging DB, smoke-test every screen
- [ ] Automated RLS test matrix: two user tokens × every affected table × every CRUD op
- [ ] `EXPLAIN ANALYZE` confirms nested-loop `SubPlan` collapsed to single hash join
- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`

---

### Deferred — React Query or `WorkoutsContext` cache (F)
- [ ] Revisit when a second screen needs the same workouts/exercises/phases data (analytics, reporting, etc.)
- [ ] If going with the cheaper middle ground, extend the `ProgramsContext` cache pattern (`contexts/ProgramsContext.tsx:36, 67-93`) into a `WorkoutsContext` keyed by `weekStart`

---

## Measurement Results — PR 1 (commit `6147dd4`)

Baseline timing logs from `loadData` after the batching + indexes + parallelized programs chain landed. Captured on a device/simulator against the dev Supabase instance (~220–260 ms RTT per query).

### Raw logs

```
[loadData] wave 1 (workouts + sessions): 2074.4ms
[loadData] wave 1 (workouts + sessions): 934.7ms
[loadData] wave 2 (exercises + completed): 212.4ms
[loadData] wave 2 (exercises + completed): 225.8ms
[loadData] wave 3 (phases): 205.5ms (38 rows)
[loadData] TOTAL: 2506.3ms
[loadData] wave 3 (phases): 258.9ms (38 rows)
[loadData] TOTAL: 1406.6ms
```

### What landed as designed

- **Wave 2** (exercises ∥ completed, two parallel batched queries) = **212–226 ms**, ≈1 RTT. Replaces what used to be N sequential `fetchExercisesByWorkoutId` calls.
- **Wave 3** (phases, single batched query) = **205–259 ms**, ≈1 RTT. Replaces M sequential `fetchPhasesByExerciseId` calls.
- Observed RTT to this Supabase instance ≈ **220–260 ms** per round-trip.

### What is still slow

- **Wave 1 = 935–2074 ms** is now the bottleneck. `fetchSessionsForRange` → `fetchProgramSessionsForDateRange` still performs three sequential round-trips internally:
  1. programs (~220 ms)
  2. `program_sessions` (~220 ms, blocked on programs)
  3. parallelized `program_exercises` ∥ materialized-workouts ∥ RMs (~220 ms, blocked on sessions)
  → Wave 1 floor ≈ 660 ms even with perfect network.
- **`useFocusEffect` fires twice on mount.** The interleaved log pairs (two wave-1s back-to-back, then two wave-2s, then two wave-3s) show `loadData` running twice concurrently, doubling the cold-load cost.
- Cold load total: **~2.5 s** (2074 ms wave 1 dominates, plus interleaved second fire).
- Warm load total: **~1.4 s** (second fire still hits network because the in-flight-dedup guard doesn't exist yet).

### Improvement over pre-PR-1 state

- Pre-PR-1 estimate: 900–1500 ms per load with ~127 round-trips.
- Post-PR-1 warm load: **~1.4 s** with ~6 round-trips (1 workouts + 3 sessions-chain + 1 wave-2 + 1 wave-3).
- Round-trip count improved by **~20×**. Wall-clock barely moved because the sessions chain is the new critical path and `useFocusEffect` is double-firing.

### Bottleneck diagnosis

| Stage | RTTs | Time | Improvable? |
|-------|------|------|-------------|
| Wave 1 workouts branch | 1 | ~220 ms | Only via PR 2 scoping (payload) |
| Wave 1 sessions branch | 3 sequential | ~660 ms | **Yes** — see options below |
| Wave 2 | 1 parallel | ~220 ms | No — already one RTT |
| Wave 3 | 1 | ~220 ms | Could merge into wave 2 via nested select |
| Double-fire (`useFocusEffect`) | ×2 | ×2 | **Yes** — in-flight dedup |

### Next optimization options (ranked by impact)

| Option | Expected impact | Effort | Risk |
|--------|-----------------|--------|------|
| **I. Reuse cached programs from `ProgramsContext`** inside `fetchProgramSessionsForDateRange` (skip the first of the 3 sessions-chain RTTs) | −220 ms on wave 1 | Small | Low |
| **J. Dedupe concurrent `loadData` calls** with an `isLoadingRef` guard so a second focus fire is a no-op while one is in flight | Halves cold-load pain | Small | Low |
| **K. Single Postgres RPC `get_home_page_data(user_id, week_start, week_end)`** — collapse workouts + exercises + phases + sessions chain + completed-ids into one RTT | Collapses to ~250 ms total | Medium | Medium (SECURITY INVOKER + RLS on the joined reads) |
| **L. Nested-select on workouts** (`.select('*, exercises(*, exercise_phases(*))')`) to merge waves 2+3 into wave 2 | −220 ms (saves wave 3) | Small | Low (needs RLS verification on nested select) |
| **B. Narrow workouts to visible week** (from original plan) | Smaller payload, same RTT count | Small | Low |

### Recommendation based on these numbers

1. Land **I + J** as a quick follow-up PR (expected ~1.4 s → ~500–700 ms, most of the remaining low-hanging fruit).
2. If still unsatisfactory after I + J, do **K** (single RPC) for the 1-RTT ceiling.
3. **B** (week-scoping) is still worth doing for payload size but won't materially move timing at this scale — treat as hygiene, not perf.
4. **E** (RLS flattening) remains gated on measurement; at ~220 ms per query the RLS overhead is not the dominant cost here. Defer unless a specific query shows per-row `SubPlan` in `EXPLAIN ANALYZE`.

### Measurement cadence

- Re-run the `[loadData]` logs after each follow-up PR and append to this section.
- Compare cold-load (first focus) vs warm-load (subsequent focus) numbers separately — the cache and dedup changes will widen that gap.

---

## Measurement Results — PR 2 attempt (commits `4b6048d` → `4bfced4`)

PR 2 bundled two optimizations: **I** (reuse cached programs from `ProgramsContext` to skip one RTT inside `fetchProgramSessionsForDateRange`) and **J** (dedupe concurrent `loadData` fires via an in-flight `useRef` promise).

### What landed

- **J — focus dedup:** ✅ kept. Eliminates the double-load on mount that was doubling cold-load time.
- **I — preloaded programs:** ❌ reverted. Caused a regression where virtual program sessions (not-yet-materialized sessions on a user-configured day) failed to render on hard refresh but reappeared after navigating away and back.

### Root cause of the I regression

A React effect ordering race between `AuthContext` and `ProgramsContext`:

1. Before sign-in, `ProgramsContext` is in its no-user branch: `programs=[]`, `loading=false`.
2. User signs in → `AuthContext` sets `user=<new>`. Re-render happens.
3. `useEffect([user])` in `ProgramsContext` queues `reloadPrograms()`, but effects run *after* commit.
4. Home page re-renders in the same cycle. `fetchSessionsForRange` re-memoizes on `user` change. `loadData` re-memoizes. `useFocusEffect` fires.
5. `loadData` calls `fetchSessionsForRange`, which captures context state at this moment: `user=<new>`, `loading=false` (stale from step 1), `programs=[]`.
6. Service receives `preloadedPrograms=[]`, filters for active → `[]`, returns empty, caches empty under the date-range key.
7. `reloadPrograms` eventually runs, clears cache. `fetchSessionsForRange` re-memoizes. `loadData` re-memoizes. `useFocusEffect` fires again.
8. The J dedup guard sees the first `loadData` still in flight, returns its promise — which resolves with the (now-stale) empty result. Virtual sessions never appear.

Navigating away and back sidestepped the race because by then `loading=false, programs=[full list]` was coherent; reverting I fixed the cold path.

### Lesson

When an optimization reads context state inside an async callback, verify it is safe across **every** React effect ordering window — not just the steady state. In particular, a brief `loading=false, programs=[]` window during auth transitions was invisible to local testing but broke real cold loads. A boolean "is loading" signal is insufficient here because it gets reset by an unrelated branch (no-user case) before the new-user branch re-raises it.

If we want the preloaded-programs win back (Option K-lite), gate on a "has completed initial load for the current `user.id`" marker, not on `loading`.

### Expected post-PR-2 timing

- Dedup (J) eliminates the double-fire on mount → cold load ~2.5 s → ~1.4 s (one pass instead of two interleaved).
- Wave 1 sessions path stays at 3 sequential RTTs since I was reverted.
- Net: same per-pass timing as PR 1; roughly half the cold-load wall-clock because we no longer pay for two overlapping fetches.

### Revised recommendation

- B (narrow workouts to visible week) is next, as originally planned, for payload hygiene.
- K (single Postgres RPC for the home-page data shape) is now the only lever that moves the wave-1 timing floor — all cheaper levers have been tried. Recommend prototyping K if warm-load <500 ms is a hard requirement.

---

## Measurement Results — PR 3 (commit `dfb8ced`)

Added `fetchWorkoutsByUserIdAndDateRange`, wired into home page `loadData` and `import-workout.tsx`. Workouts are now scoped to the 7-day visible window and use the `idx_workouts_user_date` composite index from PR 1.

### Observed timing

Tested on a slower network than earlier runs (~550 ms RTT vs ~220 ms):

```
[loadData] wave 1 (workouts + sessions): 2395.5ms
[loadData] wave 2 (exercises + completed): 522.4ms
[loadData] wave 3 (phases): 649.1ms (1 rows)
[loadData] TOTAL: 3568.0ms
```

### Interpretation

- The narrower workouts query runs fast — Wave 1's 2.4 s is dominated by the programs→sessions chain (3 RTT).
- Wave 2 and Wave 3 each take roughly 1 RTT (~520–650 ms), confirming the batched design works; they just compound when RTT is high.
- Payload scope win from B is real but invisible at this user's scale — only 1 row of phases returned.
- At this network quality the critical path is purely round-trip count: **5 serial RTTs ≈ 3.5 s**. No amount of per-query tuning helps until we reduce trip count.

---

## Measurement Results — PR 4 (commit `ffdf51e`)

Collapsed waves 2 and 3 into wave 1 via a Supabase embedded select. New helper `fetchWorkoutsWithNestedForDateRange` fetches workouts → exercises → exercise_phases → workout_execution_logs (for completion flag) as a single nested query. Waves 2 and 3 are deleted; completion fetch is replaced by checking the nested `workout_execution_logs` array.

### Observed timing

```
[loadData] workouts+nested / sessions: 1631.2ms
[loadData] TOTAL: 1631.7ms
```

### Interpretation

- **Total dropped from 3568 ms → 1632 ms (−54 %)** at the same ~550 ms RTT.
- The single wave is now the whole story. Workouts-with-nested (1 RTT) finishes in the shadow of the sessions chain (3 RTT internally).
- Net critical path is 3 RTTs × 550 ms ≈ 1.65 s — matches observed to within noise.
- At the earlier ~220 ms RTT environment, the same structure would land around **650 ms total**.

### Where the remaining time lives

| Component | RTTs | Time @ 550 ms RTT |
|-----------|------|-------------------|
| Workouts-with-nested (parallel) | 1 | ~550 ms (hidden) |
| Programs query in sessions chain | 1 | ~550 ms |
| Sessions query in sessions chain | 1 | ~550 ms |
| Parallel exercises/materialized/RMs in sessions chain | 1 | ~550 ms |
| **Total critical path** | **3** | **~1650 ms** |

---

## Final state (April 2026)

Decision: **stop here.** 1.6 s is acceptable for now; further improvements require deeper changes to the sessions query chain.

### Remaining levers if needed later

- **Nest programs → sessions** via embedded select → saves 1 RTT → ~1.1 s (small change, no DB migration)
- **Nest the entire sessions tree** into one query → saves 2 RTTs → ~550 ms (medium change, still no DB migration)
- **Option K (single Postgres RPC)** → floor of 1 RTT → ~550 ms, with the cleanest service boundary (medium change + migration + tests)

### Branch stack (not yet pushed)

- `perf/home-page-batching-and-indexes` — PR 1: `6147dd4` (N+1 → batched, indexes, parallelized programs chain)
- `perf/home-page-cache-and-dedup` — PR 2: `4b6048d` + `c45c552` + `e4e5784` + `4bfced4` + `558a64d` (dedup focus fires; preloaded-programs attempted and rolled back — see lesson)
- `perf/home-page-narrow-to-week` — PR 3: `dfb8ced` (week-scoped workouts fetch)
- `perf/home-page-nested-select` — PR 4: `ffdf51e` (nested select collapses waves 2–3)

### Net outcome

- Round-trip count: ~127 → 3-4
- Wall-clock (fast network, ~220 ms RTT): ~900–1500 ms → ~650 ms (estimate)
- Wall-clock (slow network, ~550 ms RTT): ~3500 ms observed → ~1650 ms observed (−54 %)
- Payload: full workout history → visible week only
- Behavior changes: virtual program sessions regression (introduced in PR 2, fixed in `4bfced4`)
- New lesson captured in `evil_empire_vault/Evil Empire/lessons/` on React context state races in async callbacks

---

## Critical Files

| File | Why it matters |
|------|----------------|
| `apps/mobile/PeakTrack/app/index.tsx` | Home page `loadData` — main target |
| `packages/peaktrack-services/src/exerciseService.ts` | `fetchExercisesByWorkoutIds` (reuse) |
| `packages/peaktrack-services/src/exercisePhaseService.ts` | `fetchPhasesByExerciseIds` (reuse) |
| `packages/peaktrack-services/src/workoutService.ts` | Add `fetchWorkoutsByUserIdAndDateRange` |
| `packages/peaktrack-services/src/programService.ts` | Parallelize `fetchProgramSessionsForDateRange` |
| `apps/mobile/PeakTrack/app/import-workout.tsx` | Secondary caller to migrate |
| `supabase/migrations/` | New migrations for Phase C / G / (E) |
| `apps/mobile/PeakTrack/contexts/ProgramsContext.tsx` | Cache pattern template |
| `supabase/migrations/20260416000000_create_programs.sql:106-155` | Denormalization + trigger template for Phase E |
| `supabase/migrations/20240321000000_create_exercise_phases.sql` | Where the missing index should be added |

---

## Verification Plan (for the full rollout)

1. **Before:** Capture baseline timings from `loadData` logs (Phase H). Note network round-trip counts.
2. **After PR 1:** Expect round-trip count ~127 → ~4. Timing ~900–1500 ms → ~150 ms.
3. **After PR 2:** Payload size on workouts fetch drops to 1 week of rows. Verify `EXPLAIN ANALYZE` shows index range scan on `idx_workouts_user_date`.
4. **After PR 3 (if done):** `EXPLAIN ANALYZE` no longer shows function calls in `Filter:`.
5. **After PR 4 (if done):** `EXPLAIN ANALYZE` on RLS-heavy queries shows single hash join, not `SubPlan 1`.
6. **Regression gates:** run full test suite (`pnpm test`), type check (`pnpm typecheck`), and manual QA of:
   - Sign-in → home load
   - Week navigation (forward, back)
   - Add exercise, delete workout, move missed workout
   - Materialize program session, start workout timer
   - Second user isolation (RLS)

---

## Open Questions for User

1. **Scope**: Quick wins only (A+C+D), or include B (week-scoping), or also G (`auth.uid()` wrap), or go all the way to E (RLS flattening)?
2. **Measurement (H)**: Include baseline instrumentation or skip?
3. **F (React Query)**: Defer, or evaluate a `WorkoutsContext` cache as a middle ground?

Once decided, I'll move this file to `docs/evil_empire/peakTrack/plans/home-page-performance-plan.md` and begin implementation in the order above.

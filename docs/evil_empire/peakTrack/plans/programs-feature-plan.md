# Programs Feature — Implementation Plan

> Scope: Add reusable, multi-week, day-of-week-scheduled training programs to PeakTrack. A program (e.g. "Russian back squat program") defines a matrix of prescriptions by `(week_offset, day_of_week)`, is "assigned" to a specific ISO start week, and emits scheduled workouts on those days in the user's existing daily workout view.

---

## Post-review revisions (2026-04-16)

This plan was reviewed and revised to address concrete correctness and scalability concerns. Changes (each noted inline in the affected section with **⟵ Revised:**):

1. **Flat RLS**: `program_sessions` and `program_exercises` get denormalized `user_id` columns (maintained by triggers). Policies become `user_id = auth.uid()` — no nested subquery traversal.
2. **Concrete query shape** for `fetchProgramSessionsForDateRange` (4 bounded queries, no N+1).
3. **Pure scheduling module** `lib/programScheduling.ts` with table-driven unit tests for date ↔ `(week_offset, day_of_week)` math. DST/year-boundary bugs caught without a DB.
4. **Navigation decision**: 4 tabs (Home, History, RMs, Programs). Settings moves to a gear icon in the Home header — RMs stays a primary tab because RM-resolution is a frequent flow.
5. **Matrix editor decision**: one-week-at-a-time view with `< >` nav as primary; compact all-weeks overview as secondary. Grid-of-9×7 doesn't fit mobile.
6. **`dayStatuses` change is specified** on the home screen: virtual program sessions contribute to `'planned'` dots on `WeekDaySelector`.
7. **Simpler partial unique index** on `workouts.program_session_id` (drop the redundant `user_id` tuple).

## Post-review revisions, pass 2 (2026-04-16)

A second pass inverted two earlier decisions. Each is tagged **⟵ Revised (pass 2):** inline. Summary:

1. **Drop `parsed_cache JSONB`.** The pass-1 design stored a `ParsedSetData` snapshot on `program_exercises` to "protect against parser drift" between assignment and materialization. Reasoning this through: the parser has 296 tests and is mature; when a parser bug is fixed we generally *want* the fix to propagate to future materializations; and we don't snapshot any other part of the app against future changes (UI, services, RPCs all evolve in place). The theoretical drift risk didn't justify a second source of truth (raw_input vs parsed_cache) that can diverge on any write bug. If a real drift incident happens later, we can always add the cache then. For now: `raw_input` is the single source of truth, and `parseSetInput` runs at render and materialize time — it's pure and fast.
2. **Materialization RPC shrinks to a transactional-insert wrapper.** The pass-1 RPC owned %→kg resolution: read `parsed_cache` + `repetition_maximums` server-side, ran the math, inserted three tables. That duplicated `buildPhaseData` + `calculateWeightsFromParsedData` in PL/pgSQL, guaranteeing long-term drift between the two implementations (and pass-1 already had real bugs: `compound_reps` cast as scalar not array, `weight` column divergence for ranges, `rir_max` fallback missing). The trust-boundary argument for server-side resolution was overstated — users can edit their own `parsed_cache` and `repetition_maximums` directly via PostgREST, so the RPC was trusting client-written data either way. The only thing Postgres uniquely provides here is **transactional atomicity**, so that's all the RPC does now.

   New flow (Start tap):
   - Client walks `program_exercises`, calls `parseSetInput(raw_input)` for each.
   - For any `needsRmLookup`, uses the existing `useRmLookup.lookupRm` → exact match → partial-match `RmSelectModal` → `RmFormModal` if no match at all. Same UX as `app/import-workout.tsx`.
   - Client runs `calculateWeightsFromParsedData` + `buildPhaseData` for each exercise — identical code path to the import-workout flow, so `buildPhaseData` stays the single source of truth for the JSONB-ish → phase-row translation.
   - Ships `{ session_id, target_date, name, exercises: [{ name, order_index, phase: PhaseInsertData }] }` to the RPC, which only does: idempotency check → insert workout → loop exercises + phases → return workout_id. No parser, no RM lookup, no rounding, no JSONB unpacking.

   Net effect: `buildPhaseData` stays the one place that translates parser output to phase rows; the RPC shrinks from ~120 lines of PL/pgSQL to ~30; pass-1's correctness bugs disappear by construction; parser-drift protection moves from "pinned snapshot" to "parser is mature, and drift on ship would be fixed for everyone simultaneously — same policy as every other module."

   What the client can't fake but we don't care about: the user can pass any weight numbers to the RPC. They could also just edit `exercise_phases` directly for any of their own workouts. The only 1RM-correctness concerns we *do* care about — "use the right RM for the right exercise" (name matching) and "RM must exist at materialize time" — are solved by the RM-precollect step client-side; no server verification needed.

## Post-review revisions, pass 3 (2026-04-16)

A third pass reshapes the RM (repetition-maximum) model. Pass 2 had RMs resolved **per session** at Start time, pulling live from the user's global `repetition_maximums` table and prompting via modals on missing. Pass 3 replaces that with **per-program RM snapshots pinned at assignment time**. Each change tagged **⟵ Revised (pass 3):** inline. Summary:

1. **New table `program_repetition_maximums`** — snapshots the weight used for each exercise-name within a program, pinned at assignment time. Programs are *block periodization*: standard practice is to test a 1RM at the start of a block, train off that fixed value for the whole block, then retest at the end. Pulling live from the user's global RMs mid-block would silently shift the prescription if the user updated a global RM between program sessions, which is the opposite of what block periodization exists to do. The snapshot is the *intent* of the program; the user's live global RMs are their current-best state. Those are two different things and deserve two different tables.

2. **RM resolution moves from Start → Assignment.** The assignment flow walks every `program_exercise`, collects unique exercise names with `needsRmLookup` or percentage fields, and runs the existing `useRmLookup` → `RmSelectModal` → `RmFormModal` chain once per name. Resolved values are written to both `repetition_maximums` (user's global table — keeps global data fresh on manual entry) and `program_repetition_maximums` (the program's pinned snapshot). Assignment blocks until every referenced RM is resolved; cancel aborts assignment. Benefits: (a) the user knows up-front what they're committing to and sees every RM in one flow, (b) the Start flow becomes non-interactive, (c) partial-resolution cancel semantics disappear (the hazard I flagged in the pass-2 review).

3. **Start flow becomes non-interactive.** Materialization reads `program_repetition_maximums` for the program, runs `calculateWeightsFromParsedData` + `buildPhaseData`, ships to the RPC. No modals. Every program session starts with a single tap.

4. **Virtual cards show resolved weights.** Since the snapshot is known at assignment, the card renders `6 × 2 @ 144kg` with the raw `6 x 2@80%` in subtle secondary text — more actionable than the raw spec. Same treatment `start-workout.tsx` uses in its live view.

5. **Editing a program_exercise post-assignment** can introduce a new exercise name. If so, the cell editor prompts for RM resolution at save time (same modal chain), writing a snapshot row. `upsertProgramExercise` rejects saves where the program is `status='active'` and the new name has no snapshot — the UI must resolve first. Keeps the invariant "every active program has snapshots for every name it references."

6. **Re-assignment preserves the snapshot.** Shifting start week doesn't reset RMs — block intent is unchanged. The user can edit snapshots separately via a "Program 1RMs" list on `program-detail`.

7. **End-of-program retest** is a Phase 6 polish: a CTA on `program-detail` after the final week opens a mini-form prepopulated with the program's snapshot weights, lets the user enter new values, writes to the user's **global** `repetition_maximums` (not to `program_repetition_maximums` — the snapshot is frozen forever as the block's entry value). Not required for v1; user can always log a `Build to XRM` workout the normal way.

## Post-review revisions, pass 4 (2026-04-16)

A fourth pass fixes a latent invariant hazard in the pass-3 RM-precollect design. Tagged **⟵ Revised (pass 4):** inline. Summary:

1. **Introduce a single shared predicate `exerciseNeedsRmSnapshot(parsed: ParsedSetData): boolean`.** Pass 3 required that "every exercise name needing a 1RM has a `program_repetition_maximums` row before `status='active'`." That invariant is *only* true if assignment's definition of "needs a 1RM" matches Start's definition exactly — but pass 3 encoded the rule in prose at three separate sites (assignment step 2, virtual-card render, Start materialization). Prose drifts. If a future parser change (e.g. a new `@E1RM` syntax, a new percentage-carrying field on waves/compounds) is handled in one site but not another, assignment stops pre-collecting and Start hits the "missing snapshot = hard error" dead-end.

   Fix: one pure predicate in `apps/mobile/PeakTrack/lib/resolveProgramWeights.ts`, called by every site that asks "does this exercise need a snapshot?" — assignment step 2, `ProgramCellEditor` save flow (new-name detection), `ProgramExerciseItem` virtual-card render, and Start. Parser evolutions then have exactly one place to update, and the assignment ↔ Start invariant holds by construction rather than by three-site coordination.

   Predicate shape: the one-liner `parsed.isValid && parsed.needsRmLookup === true`. Every parser branch that emits a percentage (`percentageParser`, `compoundParser`, `waveParser`, `standardParser`'s RM-build path) already sets `needsRmLookup: true` unconditionally, so the flag is the single signal worth consulting — no union to re-derive. Table-driven Jest tests over every percentage-carrying syntax (simple %, % range, compound %, wave %, `Build to XRM`, circuit-of-%) plus negative cases act as the tripwire: if a future parser change emits a percentage without setting the flag, those tests fail. The drift can't ship silently.

---

## 0. Context & grounding (what the code actually looks like today)

Observations that shaped the design:

- **The `index.tsx` "home" screen filters by `workout_date === 'yyyy-MM-dd'`** (`apps/mobile/PeakTrack/app/index.tsx:111`) and renders every matching `workouts` row as a card with its `exercises` + `exercise_phases`. Program-day workouts must land in this same shape to get free integration with delete, move-to-today, start, and completion handling.
- **Completion is tracked via `workout_execution_logs`**, not on `workouts`. `fetchCompletedWorkoutIds` returns the set of `workout_id`s that have at least one log row (`packages/peaktrack-services/src/workoutExecutionLogService.ts:66`). The green-check indicator in the home screen comes from `completedWorkoutIds.has(workout.id)` (`app/index.tsx:300`). So "completed" requires a real `workouts` row to have logs attached — this strongly nudges the design toward materializing program sessions as workouts (see §1.3).
- **Phase persistence already has a reusable translator**: `buildPhaseData` in `apps/mobile/PeakTrack/lib/buildPhaseData.ts` converts `ParsedSetData` → `PhaseInsertData` and is used by both the live edit flow and the paste-import flow. **⟵ Revised (pass 2):** Programs now use this same translator at materialize time (see §1.5). Keeping a single implementation avoids the drift/bug class that pass 1's server-side re-implementation would have introduced.
- **The paste-import flow** (`app/import-workout.tsx`) already handles the hardest UX: parse a block of text → per-block review with unresolved-1RM chips → commit as exercises + phases. The matrix editor should reuse the same parser + `BlockCard`-style review component so users can paste entire weeks at once.
- **Migration style**: `YYYYMMDDHHMMSS_description.sql`. Latest is `20260406000000_…`. RLS is enforced indirectly via `workouts` (`migrations/20240322000000_enable_rls_workouts.sql`) — exercises/phases/logs policies all use `workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid())`. Programs should follow the same pattern but scope directly on `user_id`.
- **Services layer**: `@evil-empire/peaktrack-services` wraps Supabase. Every screen imports from it; no direct `supabase.from(…)` calls in screens. New programs CRUD must be a new service file that matches the existing shape (`ServiceResult<T>`, `getSupabaseClient()`).
- **Navigation**: `NavigationBar` (`components/NavigationBar.tsx:18`) is a hard-coded 4-tab array — Home, History, RMs, Settings. A 5th "Programs" tab is a single-line addition.
- **ISO weeks**: `getISOWeek(selectedWeekStart)` is already used on the home screen (`app/index.tsx:47`). `date-fns` exposes `getISOWeek`, `getISOWeekYear`, `setISOWeek`, `startOfISOWeek`. Week number alone is ambiguous across years — the plan stores `start_iso_year` + `start_iso_week` (see §5).

---

## 1. Data model

### 1.1 New tables

Three new tables: `programs`, `program_sessions`, `program_exercises`. Plus an optional `workouts.program_session_id` FK to link materialized sessions back to the source.

> **Decision: one row per `(week_offset, day_of_week, exercise_order)`** — fully normalized. Rationale: matches `exercises` → `exercise_phases` shape, makes "copy last week", "duplicate Monday column", and partial updates cheap, and avoids a JSONB blob that the existing services/React Native layer has no tooling for. The matrix is small (9 weeks × 7 days × ~2 exercises = ~126 rows worst case), so normalization is free.

#### Table: `programs`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `user_id` | `UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | owner |
| `name` | `TEXT NOT NULL` | e.g. "Russian back squat" |
| `description` | `TEXT` | optional |
| `duration_weeks` | `INTEGER NOT NULL CHECK (duration_weeks > 0 AND duration_weeks <= 52)` | |
| `start_iso_year` | `INTEGER` | null = not assigned yet (draft) |
| `start_iso_week` | `INTEGER CHECK (start_iso_week BETWEEN 1 AND 53)` | |
| `status` | `TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived'))` | |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | same `update_updated_at_column()` trigger as existing tables |

Indexes: `idx_programs_user_id ON programs(user_id)`, `idx_programs_user_status ON programs(user_id, status)`.

#### Table: `program_sessions`

One row per **scheduled day within the program template** — i.e. "week 3, Monday". Not tied to a calendar date; that's resolved at read time from `programs.start_iso_year/week`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `program_id` | `UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE` | |
| `user_id` | `UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | **⟵ Revised:** denormalized for flat RLS. Maintained by a `BEFORE INSERT` trigger that copies `user_id` from the parent `programs` row — callers don't supply it. |
| `week_offset` | `INTEGER NOT NULL CHECK (week_offset >= 0)` | 0-indexed from start |
| `day_of_week` | `INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7)` | ISO 1=Mon…7=Sun |
| `name` | `TEXT` | optional per-session override ("Heavy squats") |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | |

Constraints: `UNIQUE (program_id, week_offset, day_of_week)`.
Indexes: `idx_program_sessions_program_id ON program_sessions(program_id)`, `idx_program_sessions_user_id ON program_sessions(user_id)`.

> **⟵ Revised (why denormalize `user_id`):** RLS policies that traverse `program_id → programs.user_id` nest three levels deep once `program_exercises` is added. Postgres handles it, but every RLS check pays the cost, and the policies themselves become fragile (missing `AUTHENTICATED` role, subquery semantics differ under updates, etc.). Storing `user_id` inline makes policies `user_id = auth.uid()` — same shape as `workouts`, `repetition_maximums`, `user_settings`. Triggers keep it truthful.

#### Table: `program_exercises`

Mirrors the existing `exercises` + `exercise_phases` combo, but flattened: for a program template we don't need multi-phase-per-exercise (users express intent as "6 x 2@80%" which is one phase). `raw_input` is the single source of truth; it's re-parsed on demand at render and materialize time.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `program_session_id` | `UUID NOT NULL REFERENCES program_sessions(id) ON DELETE CASCADE` | |
| `user_id` | `UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | **⟵ Revised:** denormalized for flat RLS. Set by trigger from parent session. |
| `order_index` | `INTEGER NOT NULL DEFAULT 0` | stable sort within a session |
| `name` | `TEXT NOT NULL` | "Back squat" |
| `raw_input` | `TEXT NOT NULL` | user's original string, e.g. `6 x 2@80%`. **⟵ Revised (pass 2):** single source of truth for the prescription. `upsertProgramExercise` validates `parseSetInput(raw_input).isValid` before insert so every row in the DB is guaranteed parseable. |
| `notes` | `TEXT` | optional free text |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | |

Indexes: `idx_program_exercises_session_id ON program_exercises(program_session_id)`, `idx_program_exercises_user_id ON program_exercises(user_id)`.

> **⟵ Revised (pass 2) — no `parsed_cache` column:** pass 1 stored a `ParsedSetData` JSONB snapshot to freeze the syntactic interpretation at write time, protecting against parser drift between assignment and materialization. Dropped because (a) the parser is mature (296 tests) — drift is theoretical; when we ship a parser fix, we typically *want* it to apply to existing programs, same as every other module; (b) a second source of truth (raw_input + parsed_cache) can silently diverge on any write bug, and there's no operational mechanism to detect it; (c) the cache only had a consumer under pass 1's server-side-resolution RPC — with parsing moved client-side (§1.5), nothing reads from it. Write-time validation catches the one real risk (unparseable text in the DB); runtime re-parsing handles everything else. If we ever observe a real drift incident we can add the cache back.

#### Table: `program_repetition_maximums` **⟵ Revised (pass 3)**

Pinned per-exercise-name 1RM snapshots for a program. Populated at assignment time and extended when the user adds a new exercise name to an already-active program. Materialization reads from here — **never** from the user's live `repetition_maximums` — so the program's prescriptions stay stable through the block regardless of what the user does to their global RMs in the meantime.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `program_id` | `UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE` | deleting a program drops its snapshots |
| `user_id` | `UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | denormalized for flat RLS; trigger-filled from parent `programs.user_id` |
| `exercise_name` | `TEXT NOT NULL` | trimmed, case-preserved as the user typed it in the program matrix |
| `weight` | `NUMERIC NOT NULL CHECK (weight > 0)` | resolved value in the user's weight unit at time of assignment |
| `tested_at` | `DATE` | optional — date the 1RM was tested, defaulted to the latest `repetition_maximums.performed_on` at resolution time if sourced from lookup |
| `source` | `TEXT NOT NULL CHECK (source IN ('lookup','partial_match','manual'))` | provenance: exact-match on user's RMs / user-picked partial match / manual entry via `RmFormModal` |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | |

Constraints: `UNIQUE (program_id, LOWER(exercise_name))` via a functional unique index — name matching in `program_exercises` is case-insensitive in practice (see `lookupExactRm`'s `ILIKE`), so the uniqueness must be too. Otherwise "Back Squat" and "back squat" could have separate snapshots in the same program.

Indexes: `idx_program_rms_program_id ON program_repetition_maximums(program_id)`, `idx_program_rms_user_id ON program_repetition_maximums(user_id)`.

> **Why snapshot per-program, not per-session or globally:**
> - **Per-session** would duplicate the same snapshot across every `(week_offset, day_of_week)` that references an exercise — dozens of copies for a 9-week program with 2 lifts per day. Per-program is a handful of rows.
> - **Globally pinned** (a "program_context_id" column on `repetition_maximums`) corrupts the live log: that table is append-mostly and reflects the user's current-best across time, with multiple rows per exercise for different rep ranges and dates. Programs need a frozen, single-value-per-name snapshot keyed to the block. Separate table is the right shape.
> - **Per-program** also matches the mental model: a user running two programs simultaneously (squat block + bench block) tested on different weeks can have different entry 1RMs in each. The program is the right ownership boundary.

> **Why case-insensitive unique:** `program_exercises.name` is user-entered text that flows into `exercises.name` at materialization time. `useRmLookup.lookupExactRm` already normalizes via `ILIKE` on trimmed names, so the program's snapshot must use the same equivalence class or materialization can miss a snapshot that was actually resolved at assignment time ("Back Squat" at assign, "back squat" in a later cell edit).

#### `workouts` table: add `program_session_id`

```sql
ALTER TABLE workouts ADD COLUMN program_session_id UUID
    REFERENCES program_sessions(id) ON DELETE SET NULL;
CREATE INDEX idx_workouts_program_session_id ON workouts(program_session_id);
```

`ON DELETE SET NULL`: deleting a program preserves the user's completed workouts (just detaches them). This is important — users should never lose history.

Also add `UNIQUE (program_session_id)` where `program_session_id IS NOT NULL` via a partial unique index:

```sql
CREATE UNIQUE INDEX idx_workouts_unique_program_session
    ON workouts(program_session_id)
    WHERE program_session_id IS NOT NULL;
```

This guarantees **one materialized workout per program-session** — prevents accidental duplication on race conditions.

> **⟵ Revised:** dropped the redundant `user_id` tuple. `program_sessions.id` is unique across the database and already user-scoped via its parent `programs.user_id`; including `user_id` in the index is tautological and wider than needed.

### 1.2 RLS

**⟵ Revised:** all three tables scope by `user_id` **directly** — nested subqueries removed. `program_sessions.user_id` and `program_exercises.user_id` are maintained by triggers (see §1.5) so policies stay as simple as `workouts`'s.

```sql
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own programs" ON programs
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own programs" ON programs
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own programs" ON programs
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own programs" ON programs
    FOR DELETE USING (user_id = auth.uid());

ALTER TABLE program_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own program sessions" ON program_sessions
    FOR SELECT USING (user_id = auth.uid());
-- insert WITH CHECK: the trigger fills user_id from the parent program; we
-- still check that the declared parent program belongs to the user. Without
-- this check a malicious client could INSERT with a program_id they don't own
-- and the trigger would happily stamp the correct user_id on it anyway.
CREATE POLICY "Users can insert their own program sessions" ON program_sessions
    FOR INSERT WITH CHECK (
        program_id IN (SELECT id FROM programs WHERE user_id = auth.uid())
    );
CREATE POLICY "Users can update their own program sessions" ON program_sessions
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own program sessions" ON program_sessions
    FOR DELETE USING (user_id = auth.uid());

-- program_exercises: identical pattern, parent check on program_session_id
ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own program exercises" ON program_exercises
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own program exercises" ON program_exercises
    FOR INSERT WITH CHECK (
        program_session_id IN (SELECT id FROM program_sessions WHERE user_id = auth.uid())
    );
CREATE POLICY "Users can update their own program exercises" ON program_exercises
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own program exercises" ON program_exercises
    FOR DELETE USING (user_id = auth.uid());

-- program_repetition_maximums (⟵ Revised pass 3): same flat-RLS shape, parent check on program_id
ALTER TABLE program_repetition_maximums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own program RMs" ON program_repetition_maximums
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own program RMs" ON program_repetition_maximums
    FOR INSERT WITH CHECK (
        program_id IN (SELECT id FROM programs WHERE user_id = auth.uid())
    );
CREATE POLICY "Users can update their own program RMs" ON program_repetition_maximums
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own program RMs" ON program_repetition_maximums
    FOR DELETE USING (user_id = auth.uid());
```

> **Why keep the `WITH CHECK` subquery on INSERT even with a trigger?** The trigger sets `user_id` based on the declared parent. Without a `WITH CHECK` that validates the parent is the caller's, a user could submit a parent_id belonging to someone else and the trigger would overwrite `user_id` to the real owner — leaking a write. The parent-ownership check on INSERT closes that gap. SELECT/UPDATE/DELETE can stay flat because by then the row already has a trustworthy `user_id`.

### 1.3 How program-scheduled workouts link to `workouts`

**Decision: lazy materialization ("just-in-time").**

Two options were considered:

| | (a) Eager materialize at assignment | (b) Virtual, never materialize | **(c) Lazy materialize (chosen)** |
|---|---|---|---|
| "Start program on week 16" creates | 9×2=18 `workouts` rows upfront | nothing | nothing |
| `index.tsx` query | unchanged | must merge virtual items with real rows — intrusive | unchanged |
| First time user views a program day | already there | rendered from program template | materialized on-the-fly, then looks identical to (a) |
| Completion tracking | works (logs attach to workout) | needs parallel completion table keyed on `(program_session_id, user_id)` | works (logs attach to workout) |
| Deleting/editing the program mid-run | hard (rows already exist) | trivial | future sessions still template-driven until viewed |
| DB churn if program never run | 18 empty workouts | none | only the ones the user actually opened |

**Chosen: (c) Lazy materialize.** When the home screen loads for a date `d`:
1. Fetch `workouts` where `workout_date = d` as today (unchanged).
2. **Additionally** fetch active `programs` where `d` falls within `[start, start + duration_weeks)`, compute `(week_offset, day_of_week)` for `d`, and check if any `program_sessions` match.
3. For each matching `program_session` that **doesn't yet have a materialized workout** (`workouts.program_session_id = session.id`), the UI shows a "planned program session" card with a **Start** button. Pressing Start runs the **client-side materialization flow** (parse + resolve RMs + build phase rows) and then calls the thin `materialize_program_session` **Postgres RPC** (see §1.5) which inserts the `workouts` row, the `exercises` rows, and `exercise_phases` rows atomically, then returns the new `workout_id`.
4. If a materialized workout already exists, it renders exactly like any other workout — including the green check once `workout_execution_logs` exist.

The "virtual card before materialization" keeps the UI consistent (user sees "Monday week 3: Back squat 6×2@80%" even before tapping), and the unique partial index prevents duplicate creation if the user double-taps.

> **⟵ Revised (pass 2): client parses + resolves; RPC only provides atomicity.** The pass-1 design had the RPC own %→kg resolution (read `parsed_cache` + `repetition_maximums` itself, run `ROUND(rm * pct / 100)` server-side). Dropped because:
>
> - It duplicated `buildPhaseData` + `calculateWeightsFromParsedData` in PL/pgSQL — two implementations of the same translation, guaranteed to drift. Pass 1 already contained real bugs (`compound_reps` cast as scalar instead of `INTEGER[]`, `weight` column mismatch for ranges/per-set percentages, missing `rir_max` fallback).
> - The claimed "eliminates client-tampering surface" benefit didn't hold up: users can edit their own `parsed_cache` and `repetition_maximums` via PostgREST directly, so the RPC was already trusting client-written data.
> - The only thing Postgres uniquely provides here is **transactional atomicity** (no orphan `workouts` rows on a mid-flight network error). That's all the RPC needs to do.
>
> New flow: client calls `parseSetInput` for each `raw_input`, runs existing `useRmLookup` (with partial-match `RmSelectModal` / `RmFormModal` for missing RMs — same UX as import-workout), builds `PhaseInsertData` via existing `buildPhaseData`, ships `{ session_id, target_date, name, exercises: [{ name, order_index, phase }] }` to the RPC. The RPC does: idempotency check → insert workout → loop exercises + phases → return workout_id. `buildPhaseData` stays the single source of truth for parser-output → phase-row translation.
>
> 1RM correctness concerns are addressed entirely client-side: "right RM for the right exercise" is solved by exact-then-partial name matching (existing `useRmLookup` behavior); "RM must exist" is solved by the precollect step. Neither requires server-side verification.
>
> The partial unique index + in-function `unique_violation` catch still protect against concurrent taps racing.

### 1.4 Completion state — re-using what exists

No new table needed. The green check in the screenshot comes from:

```ts
const completedWorkoutIds = await fetchCompletedWorkoutIds(workoutIds); // existing
```

Once a program-session workout is materialized and the user runs it via `start-workout.tsx`, `insertExecutionLog` writes log rows → workout shows up in `completedWorkoutIds` → green indicator appears. Zero change needed in the indicator pipeline.

For program-session cards that are **virtual (not yet materialized)**, render a neutral/greyed state. After Start → materialize → log insert, it becomes green on next focus-refresh.

### 1.5 Migration file

Single file (follows recent pattern of one-concern-per-migration):

```
supabase/migrations/20260416000000_create_programs.sql
```

Contents (outline):
- `CREATE TABLE programs …`
- `CREATE TABLE program_sessions …` (includes `user_id`)
- `CREATE TABLE program_exercises …` (includes `user_id`; **⟵ Revised (pass 2):** no `parsed_cache` column — `raw_input` is sole source of truth).
- **⟵ Revised (pass 3):** `CREATE TABLE program_repetition_maximums …` (includes `user_id`; functional unique index on `(program_id, LOWER(exercise_name))`).
- `ALTER TABLE workouts ADD COLUMN program_session_id …`
- **⟵ Revised: `user_id`-propagation triggers** for `program_sessions`, `program_exercises`, **and `program_repetition_maximums` (pass 3)** — all read `user_id` from their respective parent (see below).
- All four `ENABLE ROW LEVEL SECURITY` + policies (flat, per §1.2).
- `set_updated_at_…` triggers on all four new tables (reuse `update_updated_at_column()` function from base migration).
- Indexes.
- **⟵ Revised (pass 2): thin `materialize_program_session` RPC function** — transactional-insert wrapper only (see below). No parser, no RM lookup, no JSONB unpacking.

#### `user_id`-propagation triggers

```sql
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

CREATE TRIGGER trg_program_sessions_set_user_id
  BEFORE INSERT ON program_sessions
  FOR EACH ROW EXECUTE FUNCTION set_program_session_user_id();

-- analogous function for program_exercises, reading from program_sessions.user_id
-- ⟵ Revised (pass 3): analogous function for program_repetition_maximums,
--                      reading from programs.user_id via NEW.program_id
```

> **Why triggers, not app-layer assignment:** forces the invariant at the DB. If a future feature inserts rows through a different code path (import flow, RPC, another service), `user_id` is still correct. Trigger runs BEFORE INSERT so RLS's `WITH CHECK` still sees the stamped value.

#### `materialize_program_session` RPC

**⟵ Revised (pass 2):** thin transactional-insert wrapper. The client parses, resolves RMs, and builds `PhaseInsertData` via the existing `buildPhaseData` — the RPC just inserts the rows atomically. Signature takes a JSONB payload so the shape stays flexible without adding positional params.

Expected payload shape (produced client-side from parsed + RM-resolved data):

```ts
// What the client sends. Every `phase` object is the output of buildPhaseData —
// same shape used by insertPhase in the normal edit flow. Minus `exercise_id`
// which the RPC fills in after inserting each exercise row.
{
  session_id: string;              // UUID
  target_date: string;             // yyyy-MM-dd
  name: string;                    // COALESCE(program_session.name, programs.name) — computed client-side
  exercises: Array<{
    name: string;
    order_index: number;
    phase: Omit<PhaseInsertData, 'exercise_id'>;
  }>;
}
```

```sql
CREATE OR REPLACE FUNCTION materialize_program_session(
  p_session_id UUID,
  p_target_date DATE,
  p_name TEXT,
  p_exercises JSONB  -- [{ name, order_index, phase: {sets, repetitions, weight, ...} }, ...]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER  -- caller's RLS applies to every write; no privilege escalation
AS $$
DECLARE
  v_user_id UUID;
  v_workout_id UUID;
  v_exercise_id UUID;
  v_existing_workout_id UUID;
  v_ex JSONB;
  v_phase JSONB;
BEGIN
  -- Idempotency fast path: if already materialized (double-tap, focus refresh
  -- race), return the existing id without inserting anything.
  SELECT id INTO v_existing_workout_id
    FROM workouts WHERE program_session_id = p_session_id LIMIT 1;
  IF v_existing_workout_id IS NOT NULL THEN
    RETURN v_existing_workout_id;
  END IF;

  -- Resolve owner from program_sessions. RLS gates this SELECT: if the caller
  -- doesn't own the session, they see NULL and we abort. The user_id we stamp
  -- on the workout comes from the parent, never from the client, so the RPC
  -- can't be used to create a workout for another user.
  SELECT user_id INTO v_user_id
    FROM program_sessions WHERE id = p_session_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'program_session % not found or not accessible', p_session_id;
  END IF;

  INSERT INTO workouts (user_id, name, workout_date, program_session_id)
    VALUES (v_user_id, p_name, p_target_date, p_session_id)
    RETURNING id INTO v_workout_id;

  -- Loop the client-supplied exercises. Each `phase` is already a fully
  -- resolved PhaseInsertData-shaped object: client ran parseSetInput →
  -- calculateWeightsFromParsedData → buildPhaseData, so the JSONB fields map
  -- 1:1 to exercise_phases columns. No parser, no math here.
  FOR v_ex IN SELECT * FROM jsonb_array_elements(p_exercises)
  LOOP
    INSERT INTO exercises (workout_id, name, order_index)
      VALUES (v_workout_id, v_ex->>'name', (v_ex->>'order_index')::INT)
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
      -- compound_reps: INTEGER[] — unpack JSONB array, else NULL
      CASE WHEN jsonb_typeof(v_phase->'compound_reps') = 'array'
        THEN ARRAY(SELECT x::INT FROM jsonb_array_elements_text(v_phase->'compound_reps') AS x)
        ELSE NULL END,
      -- weights: NUMERIC[] — unpack JSONB array, else NULL
      CASE WHEN jsonb_typeof(v_phase->'weights') = 'array'
        THEN ARRAY(SELECT x::NUMERIC FROM jsonb_array_elements_text(v_phase->'weights') AS x)
        ELSE NULL END,
      COALESCE(v_phase->>'exercise_type', 'standard'),
      (v_phase->>'rir_min')::INT,
      (v_phase->>'rir_max')::INT,
      v_phase->>'notes',
      (v_phase->>'target_rm')::INT,
      -- circuit_exercises: JSONB column, pass through
      v_phase->'circuit_exercises',
      (v_phase->>'weight_min')::NUMERIC,
      (v_phase->>'weight_max')::NUMERIC,
      (v_phase->>'rest_time_seconds')::INT,
      (v_phase->>'emom_interval_seconds')::INT
    );
  END LOOP;

  RETURN v_workout_id;
EXCEPTION WHEN unique_violation THEN
  -- Race: concurrent tap won. Return the winner's workout_id.
  SELECT id INTO v_existing_workout_id
    FROM workouts WHERE program_session_id = p_session_id LIMIT 1;
  RETURN v_existing_workout_id;
END;
$$;

GRANT EXECUTE ON FUNCTION materialize_program_session(UUID, DATE, TEXT, JSONB) TO authenticated;
```

> **Why `SECURITY INVOKER`:** the one `SELECT` in the body (`program_sessions` to resolve `user_id`) runs under the caller's RLS, so ownership is enforced transparently — no need to re-check `auth.uid()`. All INSERTs use the RLS-verified `v_user_id`, so the RPC can't be abused to create a workout for someone else.
>
> **Why the RPC at all if it doesn't do math anymore:** transactional atomicity. Without it, the client would issue three sequential inserts (workout → exercises → phases); any network blip or mid-flight error leaves orphan rows. The partial unique index + this transaction together guarantee exactly one materialized workout per program-session regardless of taps, retries, or failures.
>
> **Why the JSONB→columns unpacking is acceptable here (but wasn't in pass 1):** the unpacking is now **shape-preserving** — it takes `PhaseInsertData`-shaped JSONB and writes it to the matching columns with no interpretation (no percentage resolution, no fallback logic, no name matching). If we ever add a new `exercise_phases` column, both `buildPhaseData.ts` and this RPC need a one-line addition — mechanical, not semantic. Contrast with pass 1 which translated `ParsedSetData` (parser output) to `exercise_phases` (storage schema), a non-trivial mapping that already existed in TypeScript and would have drifted from its SQL copy. The `weight := first resolved value` / `rir_max := rir_min` / range-handling rules all live in `buildPhaseData.ts` and stay there.
>
> **Schema sync note:** when `exercise_phases` gains a column, update both `buildPhaseData.ts` (to pass it through `PhaseInsertData`) and this RPC's INSERT (to read it from `v_phase`). Both changes are mechanical.

---

## 2. Shared package changes

### 2.1 `@evil-empire/types` — `packages/types/src/program.ts` (new)

```ts
export interface Program {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  duration_weeks: number;
  start_iso_year: number | null;
  start_iso_week: number | null;
  status: 'draft' | 'active' | 'archived';
  created_at?: string;
  updated_at?: string;
}

export interface ProgramSession {
  id: string;
  program_id: string;
  /** ⟵ Revised: denormalized for flat RLS. DB-managed: the BEFORE INSERT
   *  trigger copies user_id from the parent programs row. Clients must
   *  NOT include this field in insert payloads — the service layer strips
   *  it before calling supabase.from(...).insert(). Reads include it. */
  user_id: string;
  week_offset: number;     // 0-indexed
  day_of_week: number;     // 1..7 (ISO)
  name: string | null;
  created_at?: string;
}

export interface ProgramExercise {
  id: string;
  program_session_id: string;
  /** ⟵ Revised: denormalized for flat RLS. DB-managed by BEFORE INSERT
   *  trigger (reads from parent program_sessions.user_id). Not part of
   *  insert payloads — same rule as ProgramSession.user_id. */
  user_id: string;
  order_index: number;
  name: string;
  /** ⟵ Revised (pass 2): single source of truth. Parsed on demand via
   *  parseSetInput at render and materialize time. upsertProgramExercise
   *  rejects writes where !parseSetInput(raw_input).isValid, so callers
   *  can assume every row they read back parses successfully. */
  raw_input: string;
  notes: string | null;
  created_at?: string;
}

/** ⟵ Revised (pass 3): per-program, per-exercise-name 1RM snapshot pinned at
 *  assignment time. Materialization reads from here, never from the user's
 *  live repetition_maximums table. */
export interface ProgramRepetitionMaximum {
  id: string;
  program_id: string;
  /** DB-managed by BEFORE INSERT trigger (reads from parent programs.user_id).
   *  Not part of insert payloads. */
  user_id: string;
  exercise_name: string;
  weight: number;
  tested_at: string | null;           // yyyy-MM-dd, nullable
  source: 'lookup' | 'partial_match' | 'manual';
  created_at?: string;
  updated_at?: string;
}

/** Computed, never persisted. What the home screen renders. */
export interface ProgramSessionForDate {
  program: Program;
  session: ProgramSession;
  exercises: ProgramExercise[];
  /** ⟵ Revised (pass 3): RM snapshots for the program, so the virtual card
   *  can render resolved weights (e.g. "6 × 2 @ 144kg") without any lookup. */
  rms: ProgramRepetitionMaximum[];
  date: string;             // yyyy-MM-dd
  materializedWorkoutId: string | null;
}
```

Export from `packages/types/src/index.ts`:
```ts
export type {
  Program,
  ProgramSession,
  ProgramExercise,
  ProgramRepetitionMaximum,
  ProgramSessionForDate,
} from './program';
```

### 2.2 `@evil-empire/parsers` — **no changes**

The parser already handles `6 x 2@80%`, `6 x 3@80%`, ranges, compound reps, RIR, rest times, etc. (`packages/parsers/src/types.ts:1`). **⟵ Revised (pass 2):** programs call `parseSetInput` in two places:

- **At cell-save time** (matrix editor) for validation only. If `!isValid`, block the save — that keeps `raw_input` in the DB guaranteed-parseable.
- **At render and materialize time** to produce `ParsedSetData` on demand. Parser is pure and fast; no need to cache.

Pass 1 stored a `parsed_cache` snapshot to protect against parser drift between assignment and materialization. Dropped — see §1.1 rationale.

### 2.3 `@evil-empire/peaktrack-services` — new `programService.ts`

New file at `packages/peaktrack-services/src/programService.ts` exporting:

```ts
// CRUD
fetchProgramsByUserId(userId): ServiceResult<Program[]>
fetchProgramById(programId): ServiceResult<Program>
createProgram(input: { user_id; name; description?; duration_weeks }): ServiceResult<Program>
updateProgram(programId, patch: Partial<Program>): ServiceResult<Program>
deleteProgram(programId): ServiceResult<null>
assignProgramStart(programId, isoYear, isoWeek): ServiceResult<Program>

// Sessions + exercises (batch-friendly)
fetchProgramSessionsByProgramId(programId): ServiceResult<ProgramSession[]>
fetchProgramExercisesBySessionIds(sessionIds[]): ServiceResult<ProgramExercise[]>
upsertProgramSession(input): ServiceResult<ProgramSession>
deleteProgramSession(sessionId): ServiceResult<null>
// ⟵ Revised (pass 2): no parsed_cache. The service validates
// parseSetInput(raw_input).isValid before insert and returns a validation
// error if the input doesn't parse — that's the only write-time guarantee
// the column needs. Callers don't pre-parse.
// ⟵ Revised (pass 4 follow-up): name is .trim()-normalized before insert,
// so the write-side equivalence class matches the read-side LOWER+trim used
// by resolveWeightsFromSnapshot and the program_repetition_maximums unique
// index. Trailing whitespace variants of the same exercise name collapse to
// one row rather than sneaking past the uniqueness constraint.
upsertProgramExercise(input: {
  id?; program_session_id; order_index; name; raw_input; notes?;
}): ServiceResult<ProgramExercise>
deleteProgramExercise(exerciseId): ServiceResult<null>

// ⟵ Revised (pass 3): Program RM snapshot CRUD. These are the pinned 1RMs
// for a program, written at assignment time and extended when new exercise
// names are added post-assignment. Fetched on every home-screen load (part
// of the bounded fetch in fetchProgramSessionsForDateRange below).
fetchProgramRmsByProgramId(programId): ServiceResult<ProgramRepetitionMaximum[]>
fetchProgramRmsByProgramIds(programIds: string[]): ServiceResult<ProgramRepetitionMaximum[]>
// ⟵ Revised (pass 4 follow-up): exercise_name is .trim()-normalized before
// insert. The DB's functional unique index is LOWER(exercise_name); trimming
// on write keeps trailing/leading whitespace variants from bypassing the
// uniqueness and ensures resolveWeightsFromSnapshot (LOWER+trim on read)
// matches exactly the snapshots written here.
upsertProgramRm(input: {
  program_id: string;
  exercise_name: string;
  weight: number;
  tested_at?: string | null;
  source: 'lookup' | 'partial_match' | 'manual';
}): ServiceResult<ProgramRepetitionMaximum>
deleteProgramRm(programRmId): ServiceResult<null>

// Scheduling helpers — the pure date math lives in
// apps/mobile/PeakTrack/lib/programScheduling.ts (see §2.4). The service
// here just does the bounded DB fetches and joins.
fetchProgramSessionsForDateRange(userId, startDate, endDate): ServiceResult<ProgramSessionForDate[]>

// ⟵ Revised (pass 2): thin wrapper around supabase.rpc(...). Caller is
// responsible for having already: (a) run parseSetInput on each raw_input;
// (b) resolved RMs via useRmLookup (prompting for missing ones); (c) run
// calculateWeightsFromParsedData + buildPhaseData to produce PhaseInsertData.
// The RPC does not parse, lookup, or do math — only transactional inserts.
materializeProgramSession(input: {
  session_id: string;
  target_date: string;                // yyyy-MM-dd
  name: string;                       // session.name || program.name, resolved client-side
  exercises: Array<{
    name: string;
    order_index: number;
    phase: Omit<PhaseInsertData, 'exercise_id'>;
  }>;
}): ServiceResult<{ workout_id: string }>
```

> **⟵ Revised: concrete query shape for `fetchProgramSessionsForDateRange`.** This runs on every home-screen focus, so it must be bounded (no N+1). **⟵ Revised (pass 3): 5 queries** (RMs added so the virtual card can render resolved weights without a second round-trip):
>
> ```ts
> // 1. Active programs whose [start, start + duration) covers any date in [startDate, endDate].
> //    Client converts startDate/endDate to (iso_year, iso_week) bounds before querying.
> const { data: programs } = await supabase
>   .from('programs')
>   .select('*')
>   .eq('user_id', userId)
>   .eq('status', 'active');
> // Filter in JS: program window intersects the visible week window.
>
> // 2. For matching programs, compute the (week_offset, day_of_week) pairs that fall
> //    inside [startDate, endDate] using programScheduling.resolveSessionsInRange().
> //    Then fetch sessions matching any of those tuples.
> const { data: sessions } = await supabase
>   .from('program_sessions')
>   .select('*')
>   .in('program_id', programIds)
>   .in('week_offset', weekOffsets)      // typically ≤ 2 distinct values
>   .in('day_of_week', daysOfWeek);      // ≤ 7
> // Post-filter in JS to the exact (week_offset, day_of_week) tuples.
>
> // 3. Exercises for those sessions.
> const { data: exercises } = await supabase
>   .from('program_exercises')
>   .select('*')
>   .in('program_session_id', sessionIds)
>   .order('order_index');
>
> // 4. Materialized workout ids for those sessions.
> const { data: materializedLinks } = await supabase
>   .from('workouts')
>   .select('id, program_session_id')
>   .in('program_session_id', sessionIds);
>
> // 5. ⟵ Revised (pass 3): RM snapshots for every active program in view.
> //    Cheap — one row per unique exercise name per program (typically <10).
> const { data: rms } = await supabase
>   .from('program_repetition_maximums')
>   .select('*')
>   .in('program_id', programIds);
> ```
>
> Worst case: 5 queries total for the whole visible week, regardless of how many programs/sessions are active. Merging happens in JS into `ProgramSessionForDate[]`.

> **⟵ Revised (pass 3): client-side materialization is now non-interactive.** RMs are pre-resolved at assignment time (see §3.3), so the Start flow doesn't prompt for anything. Full flow:
>
> 1. Walk every `program_exercise` for the session. For each, call `parseSetInput(raw_input)` → `ParsedSetData`.
> 2. For each parsed result where **⟵ Revised (pass 4): `exerciseNeedsRmSnapshot(parsed)` is true**, look up the weight in `program_repetition_maximums` for the program, matching by `LOWER(exercise_name)`. A missing snapshot at this point is a **programming error** (assignment is supposed to prevent this via the same predicate) — fail loudly rather than falling back to the user's global RMs or opening a modal.
> 3. For each parsed+resolved exercise, call `calculateWeightsFromParsedData` + `buildPhaseData` → `PhaseInsertData`. Same code path as `app/import-workout.tsx`.
> 4. Call `materializeProgramSession({ session_id, target_date, name, exercises })` with the resolved payload.
>
> Why this shape:
> - (a) `buildPhaseData` stays the single source of truth for parser-output → phase-row translation.
> - (b) Start is a **single tap** — no modals, no cancel path, no partial-state hazard.
> - (c) The program's prescriptions are frozen through the block, matching how block periodization actually works. If the user tests a new 1RM mid-program, their global `repetition_maximums` updates but the program keeps its pinned snapshot.
> - (d) The pass-2 partial-cancel concern ("user resolves 2 of 3 RMs then cancels — what happens to the 2 RMs already written?") is gone by construction: all resolution happens up-front at assignment, once.
>
> **`calculateWeightsFromParsedData` note:** this is a method on the `useRmLookup` hook (`apps/mobile/PeakTrack/hooks/useRmLookup.ts:158`), not a free function. For program materialization, refactor a pure version `resolveWeightsFromSnapshot(parsed, programRms)` that reads from a passed-in `ProgramRepetitionMaximum[]` instead of the hook's live `lookupRm`. The hook-based flavor stays for the ad-hoc import-workout flow. The extraction is small and keeps the pure parts pure.
>
> **⟵ Revised (pass 4): `exerciseNeedsRmSnapshot(parsed)` lives in the same module.** One pure predicate, imported by assignment step 2, `ProgramCellEditor` save, `ProgramExerciseItem` render, and Start. Signature:
>
> ```ts
> // apps/mobile/PeakTrack/lib/resolveProgramWeights.ts
> import type { ParsedSetData } from '@evil-empire/parsers';
>
> /** True iff this exercise requires a program_repetition_maximums snapshot
>  *  to be fully resolved. Used identically at assignment time (decide which
>  *  names to pre-collect), at cell-save time (detect new names needing
>  *  resolution), at render time (decide whether to call resolveWeightsFromSnapshot),
>  *  and at Start time (same). One predicate, one source of truth. */
> export function exerciseNeedsRmSnapshot(parsed: ParsedSetData): boolean {
>   return parsed.isValid && parsed.needsRmLookup === true;
> }
> ```
>
> **Why this is the whole predicate:** every parser branch that emits a percentage or a `Build to XRM`-style spec also sets `needsRmLookup: true` unconditionally. Verified across `percentageParser.ts` (both simple and range), `compoundParser.ts` (lines 54, 132, 196, 243), `standardParser.ts` (lines 204, 307), and `waveParser.ts` (line 85) in the current codebase. There is no percentage-carrying `ParsedSetData` that leaves `needsRmLookup` unset. So the predicate is a one-liner forwarding that flag — not a union re-derivation.
>
> **Why the test suite still matters (see §7.2):** the predicate's correctness depends on an *invariant the parser maintains*, not on the predicate itself. The test file is the tripwire for that invariant — it asserts `exerciseNeedsRmSnapshot(parseSetInput(input))` for a table of every percentage-carrying syntax (simple %, % range, compound %, wave with %, `Build to XRM`, circuit-of-%-based) plus negative cases (`4 x 3 @50kg`, invalid input). If a future parser change emits a percentage without setting `needsRmLookup`, those tests fail, and we either fix the parser (right call) or widen the predicate (escape hatch). Either way the drift can't ship silently.

Export from `packages/peaktrack-services/src/index.ts`:
```ts
export * from './programService';
```

### 2.4 **⟵ Revised: new** `apps/mobile/PeakTrack/lib/programScheduling.ts`

Pure module — zero Supabase, zero React. All date ↔ `(week_offset, day_of_week)` math lives here.

```ts
import { getISOWeek, getISOWeekYear, setISOWeek, setISOWeekYear, setISODay, startOfISOWeek, differenceInCalendarDays, addDays } from 'date-fns';

/** The calendar date on which a given (week_offset, day_of_week) of a program falls. */
export function resolveSessionDate(
  startIsoYear: number,
  startIsoWeek: number,
  weekOffset: number,
  dayOfWeek: number,           // 1..7 ISO
): Date {
  // Anchor at Monday of start week, add 7*weekOffset days, then shift to target day.
  const anchor = startOfISOWeek(setISOWeek(setISOWeekYear(new Date(), startIsoYear), startIsoWeek));
  return addDays(anchor, weekOffset * 7 + (dayOfWeek - 1));
}

/** Given a program window, which (week_offset, day_of_week) — if any — does `date` fall on? */
export function resolveSessionForDate(
  program: Pick<Program, 'start_iso_year' | 'start_iso_week' | 'duration_weeks'>,
  date: Date,
): { week_offset: number; day_of_week: number } | null {
  if (program.start_iso_year == null || program.start_iso_week == null) return null;
  const anchor = startOfISOWeek(setISOWeek(setISOWeekYear(new Date(), program.start_iso_year), program.start_iso_week));
  const days = differenceInCalendarDays(date, anchor);
  if (days < 0) return null;
  const weekOffset = Math.floor(days / 7);
  if (weekOffset >= program.duration_weeks) return null;
  const dayOfWeek = (days % 7) + 1;
  return { week_offset: weekOffset, day_of_week: dayOfWeek };
}

/** All program sessions that fall inside [startDate, endDate] (inclusive). */
export function resolveSessionsInRange(
  program: Pick<Program, 'start_iso_year' | 'start_iso_week' | 'duration_weeks'>,
  startDate: Date,
  endDate: Date,
): Array<{ date: Date; week_offset: number; day_of_week: number }> {
  const out = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    const r = resolveSessionForDate(program, d);
    if (r) out.push({ date: d, ...r });
  }
  return out;
}
```

> **Why a dedicated pure module:** the hardest bugs in this feature will be off-by-ones around DST, year boundaries, week 53, and misaligned ISO week numbering. Keeping the math in a pure module with table-driven Jest tests (see §7) catches these without needing a database. The service layer calls these helpers — it doesn't reimplement them.

> **⟵ Revised: ISO-week consistency.** The home screen currently uses `startOfWeek(date, { weekStartsOn: 1 })` — which is equivalent to `startOfISOWeek(date)` for all practical purposes but not semantically identical. For consistency with program storage (`start_iso_year`, `start_iso_week`), prefer `startOfISOWeek` and `getISOWeek` / `getISOWeekYear` in new code. Existing `index.tsx` usage can stay as-is; no regressions, just a style preference for new scheduling code.

---

## 3. Mobile app — screens & flows

### 3.1 New screens

| File | Purpose |
|---|---|
| `app/programs.tsx` | List of user's programs (name, duration, start week if assigned, status). Rows open `program-detail`. "+ New program" CTA → `create-program`. |
| `app/create-program.tsx` | Create OR edit a program. Name, duration (weeks), description. "Save" → navigates to matrix editor for this program. |
| `app/program-detail.tsx` | Shows the matrix (read-only summary + tap-through to edit). "Assign start week" CTA. Archive/delete. |
| `app/program-matrix.tsx` | The editor for the `(week × day)` matrix. Table UI; taps on a cell open a per-cell sheet or inline editor. Bulk-entry via "Paste week" that reuses the import-workout parser. |
| `app/program-assign.tsx` | Modal/sheet to pick the ISO start week. Pre-fills current week. Confirms and transitions `status` → `active`. |

(`program-detail.tsx` and `program-matrix.tsx` could be merged if the matrix view is compact enough — recommended: keep the matrix as a tab/section inside `program-detail.tsx` and only split out for the bulk-paste flow.)

### 3.2 Where programs are surfaced

Two touch-points:

1. **Navigation bar**: **⟵ Revised decision: keep 4 tabs. Replace Settings with Programs; move Settings behind a gear icon in the Home screen header.**

   Final tab set in `components/NavigationBar.tsx:18`:
   ```ts
   { label: 'Home', href: '/', icon: 'home-outline', activeIcon: 'home' },
   { label: 'History', href: '/history', icon: 'time-outline', activeIcon: 'time' },
   { label: 'RMs', href: '/repetition-maximums', icon: 'podium-gold', activeIcon: 'podium-gold', iconFamily: 'material-community' },
   { label: 'Programs', href: '/programs', icon: 'barbell-outline', activeIcon: 'barbell' },
   ```
   Home screen (`app/index.tsx`) gets a gear `Ionicons name="settings-outline"` in its existing header row, routing to `/settings`.

   > **Why this over 5 tabs:** iPhone SE at 320pt has ~64pt per tab at 5 tabs — labels overflow or become cryptic. 4 tabs stay readable. **Why Settings, not RMs, is the demoted one:** RM resolution is a frequent in-flow action (import flow, program start), so it belongs on primary navigation. Settings is session-start configuration — visited once then forgotten — and fits behind a gear without hurting discoverability.

2. **Home screen (`app/index.tsx`)**: augment the existing per-date workout fetch with program-session fetches for the selected week. Render virtual (not-yet-materialized) program sessions as cards styled like real workouts, tagged with the program name in the header (e.g. "Russian back squat · Week 3"). The "Start" button on a virtual card triggers materialization and navigates to `start-workout`.

   **⟵ Revised: concrete `dayStatuses` change.** Current `dayStatuses` (in `app/index.tsx` / `WeekDaySelector`) computes `'completed' | 'missed' | 'planned'` solely from `workouts` rows. The new rule:
   - A date with **any** virtual program session → `'planned'` (orange dot), unless it also has a materialized + completed workout, in which case `'completed'` (green dot) wins.
   - `'missed'` (red dot) still only applies to materialized workouts in the past with no execution log — virtual program sessions that are in the past but not materialized stay `'planned'`. Rationale: the user hasn't explicitly skipped; a program in progress naturally has "future prescriptions" that are stale-but-available.
   - Distinguish program vs ad-hoc at the **card** level (program name badge), not the day-dot level. Dot set stays at 3 values.

   Implementation: `dayStatuses` becomes a derivation of `{ workoutsForDate[], virtualProgramSessionsForDate[], completedWorkoutIds }` — pass all three into the existing memo.

### 3.3 Assignment flow **⟵ Revised (pass 3): now owns RM precollect**

Two-step flow on `program-assign.tsx`:

**Step 1 — Pick start week.** Sheet defaults to the current ISO week.
```
Start "Russian back squat" on:
  [ < ]  Week 16, 2026  [ > ]     (April 13 – April 19)
  duration: 9 weeks  → ends Week 24 (June 14)
  [ Next: set 1RMs ]
```

**Step 2 — Resolve 1RMs for every referenced exercise.** Before the program goes `active`, the assignment flow walks every `program_exercise` in the program, parses each `raw_input`, and builds the set of unique exercise names where **⟵ Revised (pass 4): `exerciseNeedsRmSnapshot(parsed)` returns true** (the one pure predicate defined in `lib/resolveProgramWeights.ts`; see §2.3). For each unique name:

1. Run `useRmLookup.lookupRm(userId, exerciseName)`.
2. **Exact match** → display the found weight, pre-filled, user can accept or override → write `program_repetition_maximums` row with `source='lookup'`, `tested_at` = the source RM's date if available.
3. **Partial matches only** → open `RmSelectModal`. User picks one → write `source='partial_match'` using the selected weight, or taps "Enter manually" to fall through to step 4.
4. **No match at all (or user chose manual)** → open `RmFormModal`. User enters weight (+ optional tested date). On save: write BOTH `repetition_maximums` (the user's global table — same as today's import-workout flow; keeps their global data fresh) AND `program_repetition_maximums` (this program's snapshot, `source='manual'`).

UI rendering on step 2:
```
Set your 1RMs for this program

  Back squat
    [ 180 kg ]   from your RMs (tested 2026-03-10)   ✓
    [ edit ]

  Front squat
    No match found.  [ Enter 1RM ]

  [ Back ]                                       [ Start program ]
```

`[ Start program ]` is disabled until every referenced exercise has a resolved `program_repetition_maximums` row. Cancel abandons the assignment entirely; `programs.status` stays `draft` and the program keeps its existing (possibly zero) snapshot rows. No partial-state hazard.

On confirm: update `programs` row with `start_iso_year`, `start_iso_week`, `status='active'`. Route back to `programs`.

**Re-assignment of an already-active program** reuses existing `program_repetition_maximums` rows — the snapshot is block-intent, and shifting start week doesn't change the block intent. Confirm dialog wording: *"Future virtual sessions will shift to the new start week. Your 1RM snapshot for this program stays the same — edit it separately if you've retested."*

**Validation still required:** at least one `program_exercise` must exist across the program before Step 1 can proceed (see §5).

### 3.4 Matrix editor UX

**⟵ Revised layout decision: one-week-at-a-time as primary editor, with a compact all-weeks overview as secondary.** The original 9×7 grid doesn't fit mobile (7 columns × 9 rows × multiple exercises per cell = unreadable on 375pt).

**Primary editor — `ProgramWeekEditor`:**
- Header: `< Week 3 of 9 >` with tap-through arrows (+ swipe gesture).
- Body: vertical list of the 7 days (Mon–Sun). Days with no exercises collapse to a single "+ Add" row. Days with exercises show the stacked list.
- Tap any exercise row → `ProgramCellEditor` modal: `TextInput` for name and raw spec, live `parseSetInput` validation (save button disabled while `!isValid`). **⟵ Revised (pass 2):** save writes only `{ raw_input }` via `upsertProgramExercise` — the service layer re-runs `parseSetInput` server-trip-side to enforce the `isValid` invariant before insert, but no parsed form is persisted.

**Secondary — `ProgramMatrixOverview` (read-only):**
- Compact table with weeks as rows. Columns: only days that have **any** exercise across the program (most programs use 2–3 days/week, so typically 2–3 narrow columns + week number). Each cell shows the first exercise's compact spec + a "+N" chip if more.
- Tap a cell → jumps the primary editor to that week.

**Input helpers (unchanged intent, revised detail):**
1. **Copy previous week**: on `ProgramWeekEditor`, a `⎘ Copy week N-1` button at the top — duplicates every `program_exercise` from the prior `week_offset` (all days).
2. **⟵ Revised: copy a single day** (Mon-of-week-2 → Mon-of-week-3): per-day `⎘` icon next to each day header. Fills a common use case the original plan missed (Russian program only varies one rep count per Monday; copy-week-then-edit-Monday is clumsier than copy-Monday-then-edit-reps).
3. **Bulk paste week**: top-of-editor "Paste" button opens a sheet reusing `parseWorkoutText` + an **extracted `BlockReviewList`** component (lifted from `app/import-workout.tsx`). Paste format same as today. **⟵ Revised (pass 4 follow-up): conflict rule.** When the target week already has exercises, the paste sheet shows a radio toggle: **Append** (default — new blocks appended with `order_index = max(existing) + n`) or **Replace** (destructive — deletes every `program_exercise` under that week's sessions first, then inserts the parsed blocks). Replace prompts a destructive-action confirm dialog before committing. No silent merge-by-name — users who want to edit individual exercises should use the cell editor.

> The "copy previous week" pattern directly addresses the stated case — the Russian program is identical Mondays every week (`6 x 2@80%`). One tap fills 8 of 9 Mondays.

### 3.5 How program-day workouts render on the home screen

The existing `sortedWorkouts.map(...)` loop (`app/index.tsx:297`) needs to produce a **merged** list of:

- real `workouts` rows for the date (as today), and
- virtual `ProgramSessionForDate` items where no matching materialized `workouts` row exists.

Render logic:

```tsx
const cards = [
  ...sortedWorkouts.map(w => ({ kind: 'workout', workout: w })),
  ...programSessionsForDate
     .filter(ps => !ps.materializedWorkoutId)
     .map(ps => ({ kind: 'program-virtual', session: ps })),
];
```

Virtual cards have:
- Title: `{session.name ?? program.name} · Week {weekOffset + 1}` (human 1-indexed). **⟵ Revised (pass 3):** use `session.name` when set (per-session override), falling back to `program.name`. Matches the `COALESCE(program_session.name, programs.name)` rule the RPC uses at materialize time — virtual and materialized cards show the same title.
- Body: list of `program_exercises`. **⟵ Revised (pass 3):** `ProgramExerciseItem` calls `parseSetInput(raw_input)` at render time, then — **⟵ Revised (pass 4):** when `exerciseNeedsRmSnapshot(parsed)` is true — resolves weights against the program's `rms` (from `ProgramSessionForDate.rms`) via the pure `resolveWeightsFromSnapshot` helper. Displays resolved form (`6 × 2 @ 144kg`) with the raw spec in subtle secondary text (`80% of 180kg`). Same treatment `start-workout.tsx` uses in its live view. Memoize per-item via `useMemo` keyed on `raw_input + programRmsRef` if profiling shows it matters; typical session has <10 items so almost certainly negligible.
- Primary action: **Start** button (stopwatch icon, mirroring the existing icon language). **⟵ Revised (pass 3): single tap, no modals on the happy path.** Flow: walk each `program_exercise`, parse → resolve weights from `program_repetition_maximums` (already pre-collected at assignment) → `buildPhaseData` → ship to `materializeProgramSession` → navigate to `/start-workout` with the returned `workout_id`. **⟵ Revised (pass 4 follow-up): missing-snapshot recovery.** If resolution finds no snapshot for a referenced exercise name — which is statically unreachable when assignment used the shared predicate, but could happen via a partial migration, a direct DB edit, or a bug in `upsertProgramRm` — the card shows an inline error banner with a **"Resolve now"** CTA. The CTA opens the same `useRmLookup` → `RmSelectModal` → `RmFormModal` chain used at assignment, resolves the missing name(s) into `program_repetition_maximums`, and on save re-attempts the Start flow. This keeps the happy path a single tap while giving the user an in-app recovery instead of a dead-end screen. Log the incident so we can observe whether the unreachable path is being hit in practice.

---

## 4. State / data flow

### 4.1 New context: `ProgramsContext`

**⟵ Revised: build this minimally in Phase 2 (just `programs[]` + `reloadPrograms()`), extend in Phase 5 with the per-date session cache when the home screen actually needs it.** Avoids over-designing cache invalidation before the consumer exists.

Create `contexts/ProgramsContext.tsx`. Responsibilities (final shape):

- Cache `programs[]` and active-program sessions indexed by date, keyed per-user.
- Exposes `reloadPrograms()`, `assignStartWeek(programId, year, week)`, `materializeSessionForDate(sessionId, date)`.
- Invalidation triggers: create/edit/delete program, assign start week, **status change (draft ↔ active ↔ archived)**, successful materialization, auth state change.

Add provider in `app/_layout.tsx` under `UserSettingsProvider`.

*Alternative considered*: direct service calls per-screen (mirroring the current code style where `index.tsx` and `history.tsx` fetch directly). Given that program sessions must merge into the home screen on every focus refresh, a small context that pre-loads `active` programs once and caches sessions-by-date avoids repeated round-trips. **Recommendation: use a context for read-caching, but keep mutations as direct service calls followed by `reloadPrograms()`** — matches how `UserSettingsContext` works today.

### 4.2 Cache invalidation

- After any program/session/exercise mutation → call `reloadPrograms()`.
- After materialization → invalidate per-date session-list cache (remove the materialized session from the virtual set) + trigger home-screen workout refetch (via the existing `useFocusEffect` on `index.tsx`).
- **⟵ Revised:** any of `status`, `start_iso_year`, `start_iso_week`, or `duration_weeks` changes → clear the entire session-date cache (all three affect which dates have sessions).
- **⟵ Revised (pass 4 follow-up):** any `program_repetition_maximums` mutation (assignment precollect, cell-editor new-name resolution, "Program 1RMs" edit, "Resolve now" recovery) → invalidate the session-date cache for that `program_id` so virtual cards re-render with the new snapshot weights on next focus. Snapshots are part of `ProgramSessionForDate.rms`, so stale cache = stale rendered weights.

---

## 5. Edge cases & decisions

| Case | Resolution |
|---|---|
| **Multiple active programs on the same day** | Supported — both render as separate cards. Home screen iterates `programSessionsForDate` without dedup. Unique index is `(user_id, program_session_id)` only. A squat program + bench program on Monday → two cards. |
| **User edits program after it's started** | Edits to a `program_exercise` affect **future, non-materialized sessions only**. Materialized workouts (`workouts` rows that already exist) are independent copies — no retroactive change. This is implicit in the lazy-materialize design and matches user mental model ("if I already did it, editing the plan doesn't rewrite history"). |
| **User edits a materialized session's workout** | Treated as a normal workout — user can add/remove exercises, edit phases. `workouts.program_session_id` stays, so "which program was this from" is preserved, but workout content is owned by `exercises`/`exercise_phases`. |
| **User deletes a materialized session's workout** | `workouts` row deletes; `program_sessions` row stays. Next time the home screen loads that date, the session is virtual again (as if it had never been materialized) — user can re-Start. This falls out of the partial unique index automatically. |
| **Skipped days / "pause" semantics** | Weeks advance by **calendar**, not by execution. Week 3 Monday happens on a calendar date regardless of whether the user did Week 2 Monday. Missed days follow the existing "missed" red-dot behavior (only once materialized + logged). Rationale: users assign a fixed start week; they want "it's Monday of week 18 now, what's the prescription?" |
| **Timezone & ISO weeks** | Use `date-fns` `getISOWeek(date)` + `getISOWeekYear(date)` on the device's local time. ISO weeks are Mon-start, consistent with `startOfWeek(date, { weekStartsOn: 1 })` already used on the home screen (`app/index.tsx:41`). Store `start_iso_year` + `start_iso_week` (not a `DATE`) so "week 16" survives year boundaries and doesn't drift if the user changes device TZ dramatically. Render dates from `(start_iso_year, start_iso_week, day_of_week, week_offset)` using `setISOWeek` + `setISOWeekYear` + `setISODay`. |
| **Program ends (week > duration)** | `start + duration_weeks` is exclusive upper bound. `fetchProgramSessionsForDateRange` filters `week_offset < duration_weeks`. After the last week, no cards appear. Program stays `status='active'` until user archives it (show a "Program complete — archive?" CTA on program-detail). |
| **Re-assigning start week on an active program** | Allowed **with a confirmation dialog** that spells out the stranding explicitly: *"Workouts you've already started will stay on the dates you did them. Only sessions you haven't started yet will move to the new schedule."* The mechanics: already-materialized workouts keep their FK to `program_session_id`, and `workouts.workout_date` is frozen at materialize time. The home-screen fetch (§2.3) joins on `workouts.program_session_id`, so on the new calendar date for a session that was already materialized under the old schedule, no virtual card appears (the outer join finds the existing materialized workout on the old date and skips the virtual render). This is correct — the user's past work should live on the dates it happened — but is user-visible, hence the dialog wording. Materialization stays idempotent per `program_session_id` regardless of start week. **Product call to revisit post-v1:** if stranding proves too confusing, the stricter alternative is to disallow re-assignment once any session is materialized. |
| **Deleting a program while workouts exist** | `ON DELETE CASCADE` for `program_sessions`/`program_exercises`; `ON DELETE SET NULL` for `workouts.program_session_id`. User's history is never destroyed. |
| **`6 x 2@80%` with no 1RM set** | **⟵ Revised (pass 3):** resolved at **assignment**, not materialization. The assignment flow walks all `program_exercises`, parses each, and for every unique name where **⟵ Revised (pass 4):** `exerciseNeedsRmSnapshot(parsed)` returns true, forces resolution via the `useRmLookup` → `RmSelectModal` → `RmFormModal` chain before `status` can go `active`. Cancel at any point aborts assignment; program stays `draft`. Materialization uses the **same predicate** to decide which items to resolve against the snapshot — so by construction, every item that needs a snapshot at Start had a snapshot pre-collected at assignment. |
| **⟵ Revised (pass 3): user updates their global 1RM mid-program** | Program ignores the change. `program_repetition_maximums` is the source of truth for in-program prescriptions; `repetition_maximums` is the user's live log. This is **intentional** — block periodization trains off a fixed snapshot. If the user retests and wants the new number reflected mid-program, they edit the program's snapshot directly (`program-detail` → "Program 1RMs" list). |
| **⟵ Revised (pass 3): user edits a program_exercise to introduce a new exercise name post-assignment** | `ProgramCellEditor`'s save flow parses the input and — **⟵ Revised (pass 4):** if `exerciseNeedsRmSnapshot(parsed)` is true — checks whether a snapshot exists for that name. On miss: opens the same modal chain as assignment, writes a snapshot row, then saves the exercise. If the user cancels, the exercise save is aborted too — no half-saved state. Uses the same predicate as assignment, so no drift. |
| **⟵ Revised (pass 3): user renames a program_exercise whose snapshot is in use** | Old snapshot becomes orphaned (harmless — still referenced by nothing). New name triggers the snapshot-resolution flow above. GC of orphaned snapshots is a post-v1 polish item; there's no correctness hazard. |
| **Draft vs active programs** | Only `status='active'` programs are read by `fetchProgramSessionsForDateRange`. `draft` programs are invisible on the home screen, editable in the programs tab. |
| **⟵ Revised: "Ready to assign" definition** | Assignment requires **at least one `program_exercise` exists somewhere in the program** (not per-week). Prevents assigning a completely empty program. Partially-filled programs are fine — a program with only Week 1 populated will show blank weeks 2+ on the home screen, which is the user's call to fix or live with. |
| **⟵ Revised: No "pause" semantics in v1** | Known limitation. Users who want to take a week off must either (a) live with the missed days (no materialization = no `'missed'` red dot anyway) or (b) re-assign the start week (which shifts the future prescription). Adding a proper "pause from date" affordance is a post-v1 polish item. |

---

## 6. Step-by-step implementation order

Each phase is shippable standalone and builds on the previous. **Flagged files are the primary create/modify targets per phase.**

### Phase 1 — Data layer (DB + types + scheduling + service)
1. **Create migration** `supabase/migrations/20260416000000_create_programs.sql` with **⟵ Revised (pass 3): all four tables** (programs, program_sessions, program_exercises, **program_repetition_maximums** — with `user_id` columns on all three child tables; no `parsed_cache` column on `program_exercises`; functional unique index `(program_id, LOWER(exercise_name))` on `program_repetition_maximums`), `workouts.program_session_id` column + partial unique index, **user_id-propagation triggers** (three — one per child table), RLS policies (flat on all four), indexes, `updated_at` triggers, and the **thin `materialize_program_session` RPC** (transactional-insert wrapper; takes `(p_session_id, p_target_date, p_name, p_exercises JSONB)` where `p_exercises` is `[{ name, order_index, phase: PhaseInsertData }]`).
2. **Add types** in `packages/types/src/program.ts` (**⟵ Revised (pass 3):** `user_id` on relevant interfaces; no `parsed_cache`; new `ProgramRepetitionMaximum` type; `ProgramSessionForDate.rms`), re-export from `packages/types/src/index.ts`.
3. **⟵ Revised: Add pure scheduling module** `apps/mobile/PeakTrack/lib/programScheduling.ts` with `resolveSessionDate` / `resolveSessionForDate` / `resolveSessionsInRange`. Add Jest tests alongside (see §7).
4. **⟵ Revised (pass 3): Add `packages/peaktrack-services` dep on `@evil-empire/parsers`** (needed for `upsertProgramExercise` write-time `parseSetInput(raw_input).isValid` check).
5. **Add service** `packages/peaktrack-services/src/programService.ts` with CRUD (including **`fetchProgramRmsByProgramId` / `fetchProgramRmsByProgramIds` / `upsertProgramRm` / `deleteProgramRm`**) + `fetchProgramSessionsForDateRange` using the **pass-3 5-query shape** (now includes RMs) + `materializeProgramSession` as a thin `supabase.rpc(...)` wrapper that accepts the client-resolved `exercises: [{ name, order_index, phase }]` payload. Export from `packages/peaktrack-services/src/index.ts`.
6. **⟵ Revised (pass 3): Extract `resolveWeightsFromSnapshot(parsed, programRms)`** as a pure helper (likely in `apps/mobile/PeakTrack/lib/resolveProgramWeights.ts`) — takes `ParsedSetData` + `ProgramRepetitionMaximum[]`, returns the same shape `calculateWeightsFromParsedData` would but reads from the snapshot instead of the live RM table. Keeps the hook-based `calculateWeightsFromParsedData` in `useRmLookup` for ad-hoc import-workout flow; the pure version gets used by virtual cards and Start.
7. **Build packages** (`pnpm build` — tsup).

*Ship point: data layer ready, no UI. Scheduling math is unit-tested.*

### Phase 2 — Programs list + basic CRUD UI
1. **Create** `apps/mobile/PeakTrack/app/programs.tsx` (list screen + "+ New" button).
2. **Create** `apps/mobile/PeakTrack/app/create-program.tsx` (name/duration/description form; saves draft with empty matrix).
3. **Register** both in `apps/mobile/PeakTrack/app/_layout.tsx` Stack.
4. **⟵ Revised: Swap Settings → Programs in `components/NavigationBar.tsx`** and **add a gear icon in `app/index.tsx`'s header** routing to `/settings`.
5. **Add minimal** `apps/mobile/PeakTrack/contexts/ProgramsContext.tsx` — just `programs[]` + `reloadPrograms()`. Per-date session cache is added in Phase 5.
6. **Wrap provider** in `apps/mobile/PeakTrack/app/_layout.tsx`.

*Ship point: can create/list/delete empty programs; Settings still reachable from Home header.*

### Phase 3 — Matrix editor (⟵ Revised: one-week-at-a-time primary)
1. **Create** `apps/mobile/PeakTrack/app/program-detail.tsx` showing the week editor (read + tap-to-edit). Loads sessions + exercises via `fetchProgramSessionsByProgramId` + `fetchProgramExercisesBySessionIds`.
2. **⟵ Revised:** **Create** `apps/mobile/PeakTrack/components/ProgramWeekEditor.tsx` — one-week-at-a-time view with `< Week N of M >` header, vertical day list, per-day add/edit.
3. **⟵ Revised:** **Create** `apps/mobile/PeakTrack/components/ProgramMatrixOverview.tsx` — compact read-only table, tap-to-jump-to-week. Only renders days that contain any exercise.
4. **Create** `apps/mobile/PeakTrack/components/ProgramCellEditor.tsx` — modal for editing a single exercise. Uses `parseSetInput` for live validation (save disabled while `!isValid`); writes only `{ raw_input }` via `upsertProgramExercise`. **⟵ Revised (pass 2):** no `parsed_cache` written — service layer re-validates before insert so every row in the DB parses.
5. **Implement** "copy previous week" action (all days) and **⟵ Revised: "copy single day" from prior week** per-day action.
6. **Extract** `apps/mobile/PeakTrack/components/BlockReviewList.tsx` out of `app/import-workout.tsx` and wire a "Paste week" flow on top of `ProgramWeekEditor` using `parseWorkoutText`.

*Ship point: users can author complete program templates.*

### Phase 4 — Assignment flow **⟵ Revised (pass 3): two-step (week → RMs)**
1. **Create** `apps/mobile/PeakTrack/app/program-assign.tsx`. Step 1: ISO week picker.
2. **⟵ Revised (pass 3): Step 2 — RM precollect.** After the user confirms the start week:
   - Compute the unique exercise names referenced by `program_exercises` where **⟵ Revised (pass 4): `exerciseNeedsRmSnapshot(parseSetInput(raw_input))` is true** (imported from `lib/resolveProgramWeights.ts` — the same predicate Start uses, so pre-collection and resolution stay in lockstep across parser changes).
   - For each unique name, run `useRmLookup.lookupRm` → show pre-filled exact match, or open `RmSelectModal` for partial matches, or open `RmFormModal` for manual entry.
   - On each resolution: write a `program_repetition_maximums` row (`upsertProgramRm`) with the appropriate `source`. On manual entry: **also** write the user's global `repetition_maximums` (via existing `insertRepetitionMaximum` path in `RmFormModal`).
   - `[ Start program ]` disabled until every referenced name has a snapshot row.
3. **Service call** `assignProgramStart(programId, year, week)` → sets status `active` — only after all RMs are pinned.
4. **Validation**: **⟵ Revised:** require at least one `program_exercise` exists in the program (any week, any day) before Step 1 can proceed. Show the rule inline on the assign screen if blocked.
5. **Re-assignment of an already-active program**: skip Step 2 (snapshots persist), show confirmation dialog warning that future virtual sessions will shift and that the RM snapshot is preserved.

*Ship point: program has a concrete start + pinned 1RMs; ready to render resolved-weight virtual cards on home.*

### Phase 5 — Home screen integration (materialization) **⟵ Revised (pass 3): single-tap Start**
1. **Modify** `apps/mobile/PeakTrack/app/index.tsx`:
   - Add a `useFocusEffect` block that calls `fetchProgramSessionsForDateRange(userId, selectedWeekStart, addDays(selectedWeekStart, 6))`.
   - Merge `programSessionsForDate` with `sortedWorkouts` (see §3.5).
   - **⟵ Revised:** update `dayStatuses` memo to also consider virtual program sessions → `'planned'`.
2. **Extend** `ProgramsContext` (from Phase 2) with the per-date session cache (now including `rms`) + `materializeSessionForDate`.
3. **Create** `apps/mobile/PeakTrack/components/ProgramSessionCard.tsx` for virtual (not-yet-materialized) sessions. **⟵ Revised (pass 3):** renders each exercise by calling `parseSetInput(raw_input)` + `resolveWeightsFromSnapshot(parsed, programRms)` at render time. Displays resolved weight with raw spec in secondary text. Start button triggers the **non-interactive** materialization flow.
4. **⟵ Revised (pass 3): non-interactive Start flow:**
   - For each `program_exercise`, call `parseSetInput(raw_input)`.
   - **⟵ Revised (pass 4):** for each result where `exerciseNeedsRmSnapshot(parsed)` is true (same predicate the Phase-4 precollect used), resolve via `resolveWeightsFromSnapshot(parsed, programRms)`. Missing snapshot → hard error (invariant violation; statically unreachable when assignment used the same predicate).
   - Call `buildPhaseData` per exercise (same translator as `app/import-workout.tsx`).
   - Ship the resolved payload to `materializeProgramSession`.
   - Navigate to `/start-workout` with the returned `workout_id`. No modals, no cancel paths.
5. **⟵ Revised (pass 2):** service `materializeProgramSession` is a thin wrapper around `supabase.rpc('materialize_program_session', { p_session_id, p_target_date, p_name, p_exercises })`. RPC only inserts workouts + exercises + phases atomically — no parser, no RM lookup, no rounding. Idempotent via the partial unique index + in-function `unique_violation` catch.

*Ship point: end-to-end program execution works — single-tap Start with pre-resolved weights.*

### Phase 6 — Completion indicator + polish
- No code changes needed for completion tracking — falls out of existing `fetchCompletedWorkoutIds`. Verify by running a program session → completing it → observing the green check.
- Visual polish: program badges on cards, "Week N of M" header, "next program session" CTA on empty-date days.
- Archive UI, delete confirmation.
- Empty states: "No programs yet — create one", "This program has no sessions yet", "Program complete — archive it?".
- **⟵ Revised (pass 3): "Program 1RMs" list on `program-detail.tsx`** — shows each `program_repetition_maximums` row, editable in place. Used to correct a sandbagged initial test mid-program, or to handle edge cases (deloaded lifts, etc.). Edits write only to `program_repetition_maximums`, not to global `repetition_maximums`.
- **⟵ Revised (pass 3): End-of-program retest CTA** (optional) — after the final week, show "Retest your 1RMs" on `program-detail` that opens a mini-form prepopulated with the program's snapshot weights. User enters new values → writes to the user's **global** `repetition_maximums` (not to the program's snapshot — the snapshot stays frozen as the block's historical entry value).

### Phase 7 — Tests
(see §7)

---

## 7. Testing strategy

### 7.1 Parser tests
**None.** `packages/parsers` is reused unchanged. Existing 296 tests cover the syntax.

### 7.2 **⟵ Revised: Pure scheduling tests (highest priority)**
File: `apps/mobile/PeakTrack/lib/__tests__/programScheduling.test.ts`. Table-driven, no DB, no React.
- `resolveSessionDate` — known `(startYear, startWeek, weekOffset, dayOfWeek)` tuples → expected `Date`. Include year-boundary (week 52→1), week 53 years (2020, 2026), DST spring-forward and fall-back dates.
- `resolveSessionForDate` — inverse check; out-of-window dates return `null`; `week_offset === duration_weeks` returns `null` (exclusive upper bound).
- `resolveSessionsInRange` — full week sweep against a 2-day-per-week program returns exactly 2 entries.

> Owning these tests before any UI work is built catches the off-by-ones cheap. This is the single most leverage-heavy test file in the feature.

### 7.3 Service tests
- Add a `programService.test.ts` in `packages/peaktrack-services/src/__tests__/`. **⟵ Revised:** no existing Jest setup for this package — adopt the same config as `packages/parsers` (Jest + ts-jest). Do this as part of Phase 1 rather than deferring.
- Tests: `fetchProgramSessionsForDateRange` returns the correct merged shape for given dates (mock the supabase client); `materializeProgramSession` forwards RPC args correctly; idempotent double-call returns the same `workout_id`.

### 7.4 Component tests (`apps/mobile/PeakTrack/components/__tests__/`)
- `ProgramWeekEditor.test.tsx` — renders expected week; `< >` nav advances week; "copy previous week" duplicates exercises. (⟵ Revised: replaces `ProgramMatrix.test.tsx`.)
- `ProgramMatrixOverview.test.tsx` — hides empty day columns; tapping a cell calls the jump-to-week callback.
- `ProgramCellEditor.test.tsx` — **⟵ Revised (pass 2):** valid input saves `{ raw_input }` only; invalid input disables save; percentage input shows "1RM needed" hint.
- `ProgramSessionCard.test.tsx` — virtual card shows Start; after materialization prop change, card renders as real workout.

### 7.5 Hook/context tests
- `contexts/__tests__/ProgramsContext.test.tsx` — reloadPrograms invalidates cache; materialize removes session from virtual set; `status` change clears session cache.

### 7.6 Manual integration concerns
Walk through the happy-path end-to-end:
1. Create a 9-week program, fill Mondays + Thursdays using "copy week".
2. Assign start on current ISO week.
3. Navigate home → see today's program card if today is Mon/Thu.
4. Start → sees prescribed exercises → complete → returns home → green check.
5. Navigate to next week → see next week's prescription.
6. Delete the program → history intact, future cards gone.

Also test: timezone switch mid-program (set device to another TZ, verify week rendering), editing a program's matrix mid-run (future sessions update), running two active programs on the same day (both cards appear).

---

## 8. Resolved decisions

1. **Navigation layout** — ✅ **⟵ Revised: 4 tabs (Home, History, RMs, Programs).** Settings moves to a gear icon in the Home header. RMs stays a primary tab because RM resolution is a frequent in-flow action.
2. **Program + ad-hoc workouts on the same day** — ✅ Both render independently. No merging, no absorbing. A user with a program squat day + an ad-hoc cardio entry sees two cards.
3. **Multi-exercise per program-session cell** — ✅ Supported via `program_exercises.order_index`. The matrix cell renders a **stacked list** of exercises within the cell (name + compact spec per row). Cell editor allows add/remove/reorder within a single modal.
4. **Percentage → weight resolution timing** — ✅ **⟵ Revised (pass 3): resolve at *assignment* time, not materialization.** Programs are block periodization — the user tests a 1RM at the start of the block, trains off that fixed value, retests at the end. Snapshots live in `program_repetition_maximums` (per-program, pinned). Virtual cards render resolved weights (`6 × 2 @ 144kg` with raw spec in secondary text). Materialization and Start are non-interactive. Mid-block changes to the user's global `repetition_maximums` do not affect program prescriptions; program snapshots are editable separately via a "Program 1RMs" list on `program-detail`. **⟵ Revised (pass 4):** the "which exercises need a snapshot?" question is answered by a single shared predicate `exerciseNeedsRmSnapshot(parsed)` in `lib/resolveProgramWeights.ts`, used identically at assignment pre-collect, cell-save new-name detection, virtual-card render, and Start — keeping the pass-3 invariant ("every name needing a snapshot has one by the time `status='active'`") true by construction rather than by prose-level three-site coordination.
5. **Syntax parsing timing** — ✅ **⟵ Revised (pass 2): parse on demand at render and materialize time; validate at write time.** `raw_input` is the single source of truth. `upsertProgramExercise` rejects `!isValid` writes, so every row in the DB parses. Pass 1 stored a `parsed_cache JSONB` snapshot to guard against parser drift; dropped — parser is mature, drift is theoretical, and a second source of truth can diverge silently.
6. **Materialization atomicity + trust model** — ✅ **⟵ Revised (pass 3): RMs resolved at assignment into `program_repetition_maximums`; materialization reads snapshots (non-interactive); RPC is a thin transactional-insert wrapper.** Stack: at assignment, `useRmLookup` + modals populate `program_repetition_maximums`. At Start, a pure `resolveWeightsFromSnapshot` reads those snapshots (no hook, no modals), feeds `buildPhaseData`, ships to the RPC. RPC only does transactional inserts (no parser, no math). Idempotent via partial unique index + in-function `unique_violation` catch. Pass-2 concerns about partial-resolution cancel semantics are eliminated by construction — all resolution happens up-front, once.
7. **Archived programs** — ✅ Archiving hides future virtual cards. Already-materialized workouts remain in history (the `workouts` row is independent after materialization).
8. **RLS shape** — ✅ **⟵ Revised: flat policies** via denormalized `user_id` on `program_sessions`, `program_exercises`, **and (pass 3) `program_repetition_maximums`**, maintained by BEFORE INSERT triggers. INSERT policies still validate parent ownership.
9. **Matrix editor layout** — ✅ **⟵ Revised: one-week-at-a-time view** (primary) + compact all-weeks overview (secondary). 9×7 grid doesn't fit mobile.
10. **Push notifications** — ⏸ Deferred post-v1. `expo-notifications` is already wired (`app/_layout.tsx:6`) for future use.
11. **Pause/resume semantics** — ⏸ **⟵ Revised: deferred post-v1.** No first-class "pause" in v1; users reassign the start week to shift forward.
12. **Cell input syntax** — ✅ Full parser syntax (RIR, rest times, compound reps, waves, circuits). Reuse `parseSetInput` as-is; no special program-only dialect.
13. **Export/share programs between users** — ❌ Out of scope. Schema supports it trivially (copy `program` + `sessions` + `exercises` rows with a new `user_id`) if/when revisited.

---

## Summary of concrete deliverables

- **1 migration**: `supabase/migrations/20260416000000_create_programs.sql` — **⟵ Revised (pass 3):** includes 4 tables (programs, program_sessions, program_exercises, **program_repetition_maximums**; all with denormalized `user_id`; no `parsed_cache`), `workouts.program_session_id` FK, 3 user_id-propagation triggers, flat RLS on all four, and the **thin** `materialize_program_session` RPC (transactional-insert wrapper only).
- **1 types file**: `packages/types/src/program.ts` (+ index export) — **⟵ Revised (pass 3):** adds `ProgramRepetitionMaximum`; `ProgramSessionForDate.rms`.
- **2 pure helpers**: `apps/mobile/PeakTrack/lib/programScheduling.ts` (date math, table-driven tests) + **⟵ Revised (pass 3):** `apps/mobile/PeakTrack/lib/resolveProgramWeights.ts` exporting two pure functions: `resolveWeightsFromSnapshot(parsed, programRms)` (mirrors the behavior of `useRmLookup.calculateWeightsFromParsedData` but reads from a passed-in snapshot) and **⟵ Revised (pass 4):** `exerciseNeedsRmSnapshot(parsed)` (single-source-of-truth predicate used at assignment, cell-save, virtual-card render, and Start — guarantees the pass-3 pre-collect invariant by construction).
- **1 service file**: `packages/peaktrack-services/src/programService.ts` (+ index export). **⟵ Revised (pass 3):** adds program-RM CRUD (`fetchProgramRmsByProgramId`, `upsertProgramRm`, `deleteProgramRm`); `fetchProgramSessionsForDateRange` is now 5 queries (RMs included); `materializeProgramSession` stays a thin `supabase.rpc(...)` wrapper. Adds `@evil-empire/parsers` as a dep for write-time `parseSetInput` validation.
- **1 context**: `apps/mobile/PeakTrack/contexts/ProgramsContext.tsx` (minimal in Phase 2, extended in Phase 5 with per-date session cache **and `rms`**).
- **4 screens**: `programs.tsx`, `create-program.tsx`, `program-detail.tsx`, `program-assign.tsx`. **⟵ Revised (pass 3):** `program-assign.tsx` is a two-step flow (week → RMs); `program-detail.tsx` gains a "Program 1RMs" editable list.
- **4 new components** (⟵ Revised): `ProgramWeekEditor`, `ProgramMatrixOverview`, `ProgramCellEditor`, `ProgramSessionCard`. Plus extracted `BlockReviewList` (lifted from `app/import-workout.tsx`).
- **Modifications**: `app/_layout.tsx` (Stack + provider), `components/NavigationBar.tsx` (swap Settings for Programs), `app/index.tsx` (merge virtual cards; gear-icon → `/settings`; `dayStatuses` consumes virtual sessions).
- **Zero parser changes.** Zero changes to `exercise_phases` schema, `buildPhaseData.ts`, or `workout_execution_logs` schema. `buildPhaseData` keeps its existing role as the single source of truth for parser-output → phase-row translation; program materialization reuses it. **⟵ Revised (pass 3):** `useRmLookup` also unchanged — assignment uses it as-is; Start uses the new pure `resolveWeightsFromSnapshot` instead.

---

## 9. Task list

### Phase 1 — Data layer
- [ ] Write migration `supabase/migrations/20260416000000_create_programs.sql`: `programs`, `program_sessions` (with `user_id`), `program_exercises` (with `user_id`; no `parsed_cache` column), **⟵ Revised (pass 3):** `program_repetition_maximums` (with `user_id`; functional unique index `(program_id, LOWER(exercise_name))`) tables
- [ ] Add `ALTER TABLE workouts ADD COLUMN program_session_id UUID REFERENCES program_sessions(id) ON DELETE SET NULL` in the same migration
- [ ] **⟵ Revised:** Add partial unique index `idx_workouts_unique_program_session` on `(program_session_id)` where not null (dropped redundant `user_id` tuple)
- [ ] **⟵ Revised (pass 3):** Add `BEFORE INSERT` triggers to propagate `user_id` from parent onto `program_sessions`, `program_exercises`, **and `program_repetition_maximums`** (three triggers)
- [ ] **⟵ Revised (pass 3):** Add flat RLS policies on all four new tables (`user_id = auth.uid()` for SELECT/UPDATE/DELETE; `WITH CHECK` on INSERT validates parent ownership)
- [ ] Add `updated_at` triggers on the four new tables using the existing `update_updated_at_column()` function
- [ ] Add all supporting indexes (program_id, session_id, user_id on each new table; user_status on programs; program_id + user_id on program_repetition_maximums)
- [ ] **⟵ Revised (pass 2):** Add `CREATE FUNCTION materialize_program_session(p_session_id UUID, p_target_date DATE, p_name TEXT, p_exercises JSONB) RETURNS UUID` — SECURITY INVOKER; resolves `user_id` from `program_sessions` (RLS-gated); inserts workout + exercises + phases atomically using the client-supplied `p_exercises` payload of shape `[{ name, order_index, phase: PhaseInsertData }]`; idempotent via fast-path + `unique_violation` catch; `GRANT EXECUTE … TO authenticated`. **No parser, no RM lookup, no rounding** — all done client-side.
- [ ] Apply migration locally and verify schema + RPC callable
- [ ] Create `packages/types/src/program.ts` with `Program`, `ProgramSession` (incl. `user_id`), `ProgramExercise` (incl. `user_id`; no `parsed_cache` field), **⟵ Revised (pass 3):** `ProgramRepetitionMaximum`, `ProgramSessionForDate` (now includes `rms: ProgramRepetitionMaximum[]`)
- [ ] Re-export from `packages/types/src/index.ts` (add `ProgramRepetitionMaximum`)
- [ ] **⟵ Revised:** Create `apps/mobile/PeakTrack/lib/programScheduling.ts` — pure `resolveSessionDate`, `resolveSessionForDate`, `resolveSessionsInRange`
- [ ] **⟵ Revised:** Add Jest tests `apps/mobile/PeakTrack/lib/__tests__/programScheduling.test.ts` — year boundaries, week 53, DST, out-of-window
- [ ] **⟵ Revised (pass 3):** Create `apps/mobile/PeakTrack/lib/resolveProgramWeights.ts` exporting two pure functions:
  - [ ] `resolveWeightsFromSnapshot(parsed, programRms)` — case-insensitive + trimmed name match; mirrors behavior of `useRmLookup.calculateWeightsFromParsedData` but reads from passed-in snapshot
  - [ ] **⟵ Revised (pass 4):** `exerciseNeedsRmSnapshot(parsed)` — the single predicate used at assignment, cell-save, virtual-card render, and Start. One-liner: `parsed.isValid && parsed.needsRmLookup === true`. The parser sets `needsRmLookup` unconditionally on every percentage / `Build to XRM` branch (see `packages/parsers/src/{percentageParser,compoundParser,waveParser,standardParser}.ts`); the predicate trusts that invariant, and §7.2's table of percentage-carrying syntaxes is the tripwire that fails loudly if the invariant ever breaks.
- [ ] **⟵ Revised (pass 3):** Add Jest tests `apps/mobile/PeakTrack/lib/__tests__/resolveProgramWeights.test.ts` — percentages, ranges, compound reps, missing-snapshot throws
- [ ] **⟵ Revised (pass 4):** In the same test file, add table-driven cases for `exerciseNeedsRmSnapshot` covering **every** parser shape: `4 x 6 @80%` (top-level %), `3-2-1 @80%/85%/90%` (wave), `3 x 2 + 2 @80%/85%` (compound %), `Build to 8RM` (`needsRmLookup`), circuit-of-%-based, plus negative cases (`4 x 3 @50kg` returns false, invalid input returns false). Each new parser field added over the lifetime of the feature must also add a case here — the test file is the enforcement mechanism.
- [ ] **⟵ Revised (pass 3):** Add `@evil-empire/parsers` as a dep in `packages/peaktrack-services/package.json`
- [ ] **⟵ Revised:** Set up Jest for `packages/peaktrack-services` (adopt same ts-jest config as `packages/parsers`)
- [ ] Create `packages/peaktrack-services/src/programService.ts` with all CRUD functions (see §2.3), **⟵ Revised (pass 3):** including `fetchProgramRmsByProgramId`, `fetchProgramRmsByProgramIds`, `upsertProgramRm`, `deleteProgramRm`
- [ ] **⟵ Revised (pass 3):** `upsertProgramExercise` validates `parseSetInput(raw_input).isValid` before insert; returns a validation error on bad input. **⟵ Revised (pass 4 follow-up):** also `.trim()` the `name` before insert so the write-side equivalence class matches the read-side LOWER+trim.
- [ ] **⟵ Revised (pass 4 follow-up):** `upsertProgramRm` `.trim()`s `exercise_name` before insert; DB's `UNIQUE (program_id, LOWER(exercise_name))` plus trim-on-write is what makes "Back Squat " and "back squat" resolve to the same snapshot.
- [ ] Implement `fetchProgramSessionsForDateRange(userId, startDate, endDate)` — **⟵ Revised (pass 3): bounded 5-query shape per §2.3 (RMs added)**, uses `programScheduling` helpers
- [ ] **⟵ Revised (pass 2):** Implement `materializeProgramSession({ session_id, target_date, name, exercises })` as a thin `supabase.rpc('materialize_program_session', { p_session_id, p_target_date, p_name, p_exercises })` wrapper — caller supplies the resolved `exercises: [{ name, order_index, phase: PhaseInsertData }]` payload
- [ ] Export from `packages/peaktrack-services/src/index.ts`
- [ ] `pnpm build` — verify types and services package rebuild
- [ ] `pnpm typecheck` — no errors

### Phase 2 — Programs list + basic CRUD UI
- [ ] **⟵ Revised:** Create `apps/mobile/PeakTrack/contexts/ProgramsContext.tsx` — **minimal**: `programs[]` + `reloadPrograms()`. Per-date cache added in Phase 5.
- [ ] Wrap provider in `apps/mobile/PeakTrack/app/_layout.tsx` under `UserSettingsProvider`
- [ ] Create `apps/mobile/PeakTrack/app/programs.tsx` — list with name, duration, start week, status; "+ New" CTA
- [ ] Create `apps/mobile/PeakTrack/app/create-program.tsx` — name/duration/description form; saves draft
- [ ] Register both screens in the root Stack in `app/_layout.tsx`
- [ ] **⟵ Revised:** Swap Settings tab for Programs tab in `components/NavigationBar.tsx` (barbell icon)
- [ ] **⟵ Revised:** Add gear icon to `app/index.tsx` header routing to `/settings`
- [ ] Visual QA on iPhone SE-sized widths to confirm 4-tab readability and Home header gear tappability

### Phase 3 — Matrix editor
- [ ] Create `apps/mobile/PeakTrack/app/program-detail.tsx` — loads sessions + exercises, hosts week editor + overview, archive/delete actions
- [ ] **⟵ Revised:** Create `apps/mobile/PeakTrack/components/ProgramWeekEditor.tsx` — one-week-at-a-time view, `< Week N of M >` nav, per-day add/edit
- [ ] **⟵ Revised:** Create `apps/mobile/PeakTrack/components/ProgramMatrixOverview.tsx` — compact all-weeks table, only renders days that have exercises, tap-to-jump-to-week
- [ ] Create `apps/mobile/PeakTrack/components/ProgramCellEditor.tsx` — modal for editing a cell; multi-exercise stacked list with add/remove/reorder
- [ ] **⟵ Revised (pass 2):** On cell save, write only `{ raw_input }` via `upsertProgramExercise`. The service validates `parseSetInput(raw_input).isValid` before insert (returns a validation error on bad input) — that's the only write-time guarantee the column needs. No `parsed_cache` persisted.
- [ ] Live validation via `parseSetInput`; inline error messages
- [ ] **⟵ Revised (pass 3):** When editing on an active program and the saved exercise introduces a new name (not in `program_repetition_maximums`) AND **⟵ Revised (pass 4): `exerciseNeedsRmSnapshot(parsed)` is true** (imported from `lib/resolveProgramWeights.ts`; same predicate used at assignment and Start): open the resolution modal chain before completing the save. Abort save on cancel.
- [ ] Implement "Copy previous week" action (duplicates all `program_exercises` from prior `week_offset`)
- [ ] **⟵ Revised:** Implement "Copy single day from prior week" per-day action
- [ ] Extract `apps/mobile/PeakTrack/components/BlockReviewList.tsx` from `app/import-workout.tsx` for reuse
- [ ] Wire "Paste week" bulk-entry flow using `parseWorkoutText` + extracted `BlockReviewList`
- [ ] **⟵ Revised (pass 4 follow-up):** Paste sheet shows an Append/Replace toggle when the target week has existing exercises; Replace triggers a destructive-action confirm dialog before wiping and re-inserting

### Phase 4 — Assignment flow **⟵ Revised (pass 3): two-step**
- [ ] Create `apps/mobile/PeakTrack/app/program-assign.tsx` with two steps
- [ ] Step 1 — ISO week picker; show computed end week preview ("Week 24, June 14") before confirm
- [ ] **⟵ Revised:** Block step 1 if zero `program_exercises` exist across the program
- [ ] **⟵ Revised (pass 3):** Step 2 — RM precollect list: for each `program_exercise`, parse `raw_input`; collect the unique exercise names where **⟵ Revised (pass 4): `exerciseNeedsRmSnapshot(parsed)` returns true** (imported from `lib/resolveProgramWeights.ts` — do **not** re-encode the predicate inline). Show existing snapshots / lookup results / modal chain per name.
- [ ] **⟵ Revised (pass 3):** Per-name resolution writes a `program_repetition_maximums` row via `upsertProgramRm` with correct `source`
- [ ] **⟵ Revised (pass 3):** Manual entry via `RmFormModal` also writes to user's global `repetition_maximums` (same as today's import-workout flow)
- [ ] **⟵ Revised (pass 3):** `[ Start program ]` disabled until every referenced name has a snapshot
- [ ] Wire `assignProgramStart(programId, isoYear, isoWeek)` service call; transitions status to `active` only after all RMs pinned
- [ ] **⟵ Revised (pass 3):** On re-assignment of an already-active program: skip Step 2 (snapshots persist), show confirm dialog ("future sessions will shift; 1RM snapshot preserved — edit separately if you've retested")

### Phase 5 — Home screen integration + materialization **⟵ Revised (pass 3): single-tap**
- [ ] Modify `apps/mobile/PeakTrack/app/index.tsx` to fetch `programSessionsForDate` via `fetchProgramSessionsForDateRange` (5-query shape, includes `rms`)
- [ ] **⟵ Revised (pass 3):** Extend `ProgramsContext` with per-date session cache (including `rms`) + `materializeSessionForDate`
- [ ] Merge virtual program sessions into the existing card list (see §3.5)
- [ ] **⟵ Revised:** Update `dayStatuses` memo on home screen — virtual sessions contribute to `'planned'`; completed-materialized beats planned; missed applies only to materialized past workouts
- [ ] Create `apps/mobile/PeakTrack/components/ProgramSessionCard.tsx` — header shows `session.name ?? program.name` + "Week N of M"; stacked exercise list; Start button
- [ ] **⟵ Revised (pass 3):** Implement `ProgramExerciseItem` wrapper that calls `parseSetInput(raw_input)` at render time. **⟵ Revised (pass 4):** gate the weight-resolution call on `exerciseNeedsRmSnapshot(parsed)` (imported — no inline re-encoding); when true, call `resolveWeightsFromSnapshot(parsed, programRms)`. Memoize per-item via `useMemo` keyed on `raw_input + rmsRef`; display resolved weight with raw spec in secondary text.
- [ ] **⟵ Revised (pass 3):** Wire Start button → non-interactive materialization:
  - For each `program_exercise`: `parseSetInput(raw_input)`.
  - **⟵ Revised (pass 4):** For each parsed result where `exerciseNeedsRmSnapshot(parsed)` is true (same predicate the Phase-4 precollect used): `resolveWeightsFromSnapshot(parsed, programRms)`. Missing snapshot = surface an inline error banner on the card with a **"Resolve now"** CTA that opens the `useRmLookup` → `RmSelectModal` → `RmFormModal` chain, writes the missing snapshot via `upsertProgramRm`, and re-attempts Start. Don't fall back to global RMs (that would violate block-periodization intent). Log the incident — this path is statically unreachable for any program whose assignment completed successfully, so hitting it in practice means a migration gap or a write bug we want visibility on.
  - For each resolved exercise: `buildPhaseData` → `PhaseInsertData`.
  - Call `materializeProgramSession({ session_id, target_date, name, exercises })` with the resolved payload.
  - Navigate to `/start-workout` with returned `workout_id`.
- [ ] Trigger home-screen workout refetch after successful materialization (`useFocusEffect` already handles this on return)
- [ ] Verify unique partial index + RPC's `unique_violation` catch together prevent double-materialization on rapid taps (manual test)

### Phase 6 — Completion indicator + polish
- [ ] Verify green check appears after completing a materialized program workout (no code change expected)
- [ ] Add "Week N of M" badge on program cards
- [ ] Add empty states: "No programs yet", "This program has no sessions yet", "Program complete — archive it?"
- [ ] Add archive confirmation dialog
- [ ] Add delete confirmation dialog (warn: "history will be preserved")
- [ ] Post-last-week: show "Program complete — archive?" CTA on `program-detail`
- [ ] **⟵ Revised (pass 3):** "Program 1RMs" editable list on `program-detail.tsx` — lists `program_repetition_maximums` rows; tap to edit; writes only to the program snapshot (not global RMs)
- [ ] **⟵ Revised (pass 3):** End-of-program retest CTA (optional v1 polish) on `program-detail.tsx` after the final week — opens a mini-form prepopulated with program snapshot weights; entered values write to user's **global** `repetition_maximums` only

### Phase 7 — Tests
- [ ] **⟵ Revised (already in Phase 1):** `apps/mobile/PeakTrack/lib/__tests__/programScheduling.test.ts` — table-driven tests for date math. Highest priority.
- [ ] **⟵ Revised (pass 3, already in Phase 1):** `apps/mobile/PeakTrack/lib/__tests__/resolveProgramWeights.test.ts` — table-driven: percentage resolves to `round(rm * pct / 100)`, ranges, compound reps, case-insensitive name match, missing-snapshot throws with a clear error. **⟵ Revised (pass 4):** same file covers `exerciseNeedsRmSnapshot` across every percentage-carrying parser shape (top-level %, wave, compound, circuit, `needsRmLookup`) plus negative cases. Any new parser field that surfaces a 1RM dependency must add a case here — catching-the-drift is the point.
- [ ] Add `packages/peaktrack-services/src/__tests__/programService.test.ts` (Jest setup added in Phase 1)
  - [ ] `fetchProgramSessionsForDateRange` merged-shape correctness (mock supabase client) — **⟵ Revised (pass 3):** including `rms` join
  - [ ] `upsertProgramExercise` returns validation error on `!parseSetInput(raw_input).isValid`
  - [ ] `materializeProgramSession` forwards RPC args correctly; idempotent double-call returns same id
  - [ ] **⟵ Revised (pass 3):** `upsertProgramRm` / `fetchProgramRmsByProgramId` round-trip
- [ ] **⟵ Revised:** Add `apps/mobile/PeakTrack/components/__tests__/ProgramWeekEditor.test.tsx`
  - [ ] Renders expected week; `< >` nav advances week
  - [ ] "Copy previous week" duplicates exercises
  - [ ] "Copy single day" duplicates one day only
- [ ] **⟵ Revised:** Add `apps/mobile/PeakTrack/components/__tests__/ProgramMatrixOverview.test.tsx`
  - [ ] Empty day columns are hidden
  - [ ] Tap on cell calls jump-to-week callback
- [ ] Add `apps/mobile/PeakTrack/components/__tests__/ProgramCellEditor.test.tsx`
  - [ ] **⟵ Revised (pass 2):** Valid input saves `{ raw_input }` only (no parsed_cache)
  - [ ] Invalid input shows error and save is disabled
  - [ ] Multi-exercise add/remove works
- [ ] Add `apps/mobile/PeakTrack/components/__tests__/ProgramSessionCard.test.tsx`
  - [ ] Virtual state shows Start; materialized state shows normal workout
  - [ ] **⟵ Revised (pass 3):** `ProgramExerciseItem` calls `parseSetInput(raw_input)` + `resolveWeightsFromSnapshot` at render; renders resolved weight with raw spec in secondary text
  - [ ] **⟵ Revised (pass 3):** Start flow is non-interactive on the happy path — clicking Start with all RMs present calls `materializeProgramSession` once and navigates.
  - [ ] **⟵ Revised (pass 4):** Missing snapshot does **not** call the RPC; instead renders the "Resolve now" banner and, after the user completes the modal chain, re-attempts Start with the freshly-written snapshot.
- [ ] **⟵ Revised (pass 3):** Add `apps/mobile/PeakTrack/app/__tests__/program-assign.test.tsx` (or component-level tests for its step 2 precollect view)
  - [ ] Step 2 blocks `[ Start program ]` until every referenced name has a snapshot
  - [ ] Exact-match resolution writes `source='lookup'` row
  - [ ] Manual entry writes to both `repetition_maximums` and `program_repetition_maximums`
  - [ ] Cancel aborts — `programs.status` stays `draft`
- [ ] Add `apps/mobile/PeakTrack/contexts/__tests__/ProgramsContext.test.tsx`
  - [ ] `reloadPrograms` invalidates cache
  - [ ] Materialize removes session from virtual set
  - [ ] **⟵ Revised:** `status` / `start_iso_year` / `duration_weeks` change clears session cache
- [ ] Manual E2E walkthrough (see §7.6)
  - [ ] Create 9-week program → assign to current week → execute a day → green check appears
  - [ ] Run two active programs on same day → both cards appear
  - [ ] Edit program mid-run → future sessions update, materialized don't
  - [ ] Delete program → history stays intact
  - [ ] Timezone switch → week rendering still correct
  - [ ] **⟵ Revised (pass 2):** Parity check — create the same prescription via (a) a program materialization and (b) `import-workout`; assert the resulting `exercise_phases` rows match column-for-column (proves `buildPhaseData` is truly the single source of truth)

### Review section (fill in after implementation)
- [ ] Summary of what shipped
- [ ] Deviations from this plan and why
- [ ] Follow-up issues / deferred polish

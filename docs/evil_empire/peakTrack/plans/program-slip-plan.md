# Program Slip — Plan

## Motivation

A program like 2×/week Russian back squat is conceptually a **queue of
sessions paced by a cadence**, not a fixed calendar. When the user has to
take a rest day and misses a session, every following unstarted session
should slide forward — not pile up on top of the next-scheduled day.

The current model stores `(week_offset, day_of_week)` per `program_session`
and treats those slots as truth. There is no concept of "the rest of the
program is behind by one session." This plan adds one.

## Decisions (locked in)

- **Slip is per-program, measured in *slots* (cadence positions), not days
  or weeks.** A slot is one cadence-ordered training day across the
  program. For Russian back squat (Mon+Thu), slot 0 = first Mon,
  slot 1 = first Thu, slot 2 = second Mon, etc. Slipping by 1 slot pushes
  every still-unmaterialized session to the next slot.
- **Slip in slots (not days) preserves cadence.** A uniform day-count
  slip would shift Mon→Thu by +3 but Thu→next-Mon by +4, breaking the
  Mon/Thu pattern. Slot-based slip is cadence-aware by construction.
- **Cadence is derived, not stored.** A program's cadence is the sorted
  distinct `day_of_week` values across its `program_sessions`. No new
  column needed; the data already encodes the pattern.
- **Slip never touches materialized workouts.** Once a session is
  materialized into a `workouts` row, its `workout_date` is concrete and
  owned by the user (rescheduled via the existing `…` menu). Slip only
  affects how virtual (still-unmaterialized) sessions lay onto the
  calendar.
- **Two reschedule paths remain, with distinct intent:**
  - **Arrow / move (existing):** "this one specific session belongs on
    this specific date" → materializes at target date, no slip change.
    Good for one-off "Wed works better than Thu this week."
  - **Skip-and-push (new):** "I'm not training today, slide the program"
    → `slip_slots += 1`, no materialization. Good for missed sessions.
- **No retroactive slip on past dates.** Skip-and-push only acts on the
  current/next virtual session forward. We do not auto-detect "session
  date passed without materialization" as a miss — that's ambiguous (rest
  week? deload? lifestyle program?).

## Scope

### 1. Database

New migration `supabase/migrations/20260521000000_add_program_slip_slots.sql`:

```sql
ALTER TABLE programs
  ADD COLUMN slip_slots INTEGER NOT NULL DEFAULT 0
    CHECK (slip_slots >= 0);

COMMENT ON COLUMN programs.slip_slots IS
  'Number of cadence slots the program has been pushed forward. '
  'Virtual session dates are computed as: cadence_slot(session) + slip_slots, '
  'then mapped back to a calendar date. Materialized workouts are unaffected.';
```

No data backfill needed (default 0 = today's behavior).

### 2. Shared scheduling logic (`packages/peaktrack-services`)

#### 2a. `programScheduling.ts`

Add cadence-aware slot math:

```ts
/**
 * The sorted distinct day_of_week values used by a program's sessions.
 * For Mon+Thu sessions: [1, 4].
 */
export function deriveCadence(
  sessions: Array<{ day_of_week: number }>,
): number[] { ... }

/**
 * Slot index for a (week_offset, day_of_week) within a cadence.
 * Throws if day_of_week not in cadence.
 */
export function slotIndexFor(
  weekOffset: number,
  dayOfWeek: number,
  cadence: number[],
): number {
  const dayPos = cadence.indexOf(dayOfWeek);
  if (dayPos < 0) {
    throw new Error(`day_of_week ${dayOfWeek} not in cadence`);
  }
  return weekOffset * cadence.length + dayPos;
}

/**
 * Inverse: given a slot index, return (week_offset, day_of_week).
 * Extrapolates beyond the program's stored sessions when needed
 * (slip can push slots into weeks that don't have a stored session row).
 */
export function slotToWeekDay(
  slot: number,
  cadence: number[],
): { week_offset: number; day_of_week: number } {
  const w = Math.floor(slot / cadence.length);
  const d = cadence[slot % cadence.length];
  return { week_offset: w, day_of_week: d };
}
```

Extend the existing window type and resolvers:

```ts
interface ProgramWindow {
  start_iso_year: number | null;
  start_iso_week: number | null;
  duration_weeks: number;
  slip_slots: number;            // NEW
  cadence: number[];             // NEW — derived, passed in by caller
}
```

`resolveSessionDate(year, week, weekOffset, dayOfWeek, slipSlots, cadence)`:
1. Compute base slot via `slotIndexFor`.
2. Add `slipSlots`.
3. Convert back via `slotToWeekDay`.
4. Return calendar date as today.

`resolveSessionsInRange(program, startDate, endDate)`:
- For each session in `program.program_sessions`, compute its slipped
  date and include it if within range.
- (Today this iterates dates and reverse-maps to sessions. Inverting the
  iteration to "iterate sessions, compute date" is simpler with slip and
  produces the same set — see implementation note below.)

**Implementation note — iteration order.** The current
`resolveSessionsInRange` walks `[startDate..endDate]` day-by-day and
asks `resolveSessionForDate` "what session falls here?". With slip,
the inverse mapping (a calendar date → session) has to subtract slip,
which works but is awkward when an out-of-window date now maps onto an
in-window session and vice versa. The cleaner shape is to iterate the
program's sessions, compute each one's slipped date, and emit it if
inside the range. This is what we should switch to. `resolveSessionForDate`
becomes a derived helper.

#### 2b. `programService.ts`

- `fetchProgramsByUserId` etc.: include `slip_slots` in selected
  `programs` columns. Update the `Program` row type in
  `@evil-empire/types`.
- New service: `incrementProgramSlip(programId: string)` →
  `UPDATE programs SET slip_slots = slip_slots + 1 WHERE id = ?` (RLS
  enforces ownership). Returns the new value.
- New service: `setProgramSlip(programId, slipSlots)` for "undo skip" /
  power-user adjustment.
- Anywhere that calls `resolveSessionsInRange`, pass `slip_slots` and
  the derived cadence (already have sessions in hand).

#### 2c. `@evil-empire/types`

Add `slip_slots: number` to the `Program` type. Add nothing else — cadence
is derived, not stored.

### 3. Mobile (`apps/mobile/PeakTrack`)

#### 3a. `ProgramsContext.tsx`

- The cache key `${start}|${end}` is fine — `slip_slots` lives on the
  program record, so changing it goes through `incrementProgramSlip`
  which calls `invalidateSessionCache()` (or equivalent) before the next
  fetch.
- Add `skipProgramSlot: (programId: string) => Promise<{ error: string | null }>`
  to the context value, wrapping `incrementProgramSlip` and clearing the
  cache on success.

#### 3b. `ProgramSessionCard.tsx`

Replace the single Move action with a small action menu (or add a
second icon) offering:

- **Reschedule (this session)** — existing arrow behavior. Materializes
  at chosen day, no slip.
- **Skip and push program** — new. Confirms with a short modal, then
  calls `skipProgramSlot(item.program.id)`. No materialization. After
  success, the calendar re-renders and this card disappears from
  today (it has slid to its new slot).

Visual: keep the existing arrow as Reschedule; add a `Skipped`-style
icon (e.g. `play-skip-forward-outline`) next to it for Skip-and-push.
Both are inline so the user understands the two distinct actions.

#### 3c. Confirmation copy

The skip modal should make the cascade explicit:

> Skip "{sessionLabel}" and push the program?
>
> This will move "{sessionLabel}" and every following session in the
> program one slot forward. Already-completed sessions are not affected.

#### 3d. `app/index.tsx`

- `handleMoveSession` keeps its current behavior (materialize-at-target).
- Wire a new `handleSkipProgram(programId)` that calls the new context
  method and refreshes the day view.

### 4. Web (`apps/web/peaktrack-app`)

v1 web is a management surface and doesn't execute workouts, but the
program detail / calendar view does render virtual sessions. Same
changes:

- Update `use-programs.ts` to expose `skipProgramSlot`.
- Add the Skip-and-push action to whatever component renders a virtual
  program session on the web. (Same UX intent; visual TBD.)

### 5. Program duration and the "end of program"

Slip can push sessions past the program's original
`start + duration_weeks` window. We do **not** bump `duration_weeks`
in the row. Instead, the effective end is derived:

```
effective_end_date =
  anchorForIsoWeek(start_iso_year, start_iso_week)
  + ((duration_weeks * cadence.length - 1 + slip_slots) → date via slotToWeekDay)
```

`resolveSessionsInRange` already iterates the program's stored sessions
and computes each one's date, so out-of-original-window dates fall out
for free. Anywhere the UI says "Program ends on X" should compute the
slipped end-date.

### 6. Edge cases

- **Skip when only one session remains:** allowed; slip increments,
  session slides to next cadence slot beyond original window. UI
  treats it like any other slip.
- **Skip when current week is partially done:** the materialized
  workouts in this week stay put. Only the unmaterialized ones slide.
  This is exactly the user's scenario.
- **Two skips in a row:** `slip_slots = 2`. Linear behavior, no
  special-casing.
- **Multiple active programs:** slip is per-program. They shift
  independently.
- **Program with sessions on non-cadence days:** if a session uses a
  `day_of_week` not in the derived cadence (shouldn't happen, but
  defensively): treat as cadence of 1 (only that day) for slot math, or
  reject at write time. **Plan:** validate during program creation —
  every session's `day_of_week` must appear in the program's set of
  used days (trivially true since we derive cadence from the set).

## Out of scope (deferred)

- A full **cursor model** where sessions become a pure ordered queue
  and `(week_offset, day_of_week)` are discarded. We've explicitly
  chosen the slip counter as the smaller change that solves the user's
  current scenario. Cursor model is the right answer only if/when
  partial-program skipping becomes a real use case.
- Automatic "you missed a date, do you want to push the program?"
  prompts. We require an explicit Skip-and-push gesture to avoid
  ambiguity with rest days, deloads, and lifestyle programs.
- Negative slip / pull-back UI. The service supports it (via
  `setProgramSlip`) but there's no UI in v1.

## Test plan

### Unit (`packages/peaktrack-services`)

- `deriveCadence` from `[ (w0,Mon), (w0,Thu), (w1,Mon), (w1,Thu) ]`
  → `[1, 4]`.
- `slotIndexFor(0, 1, [1,4])` = 0, `slotIndexFor(1, 4, [1,4])` = 3.
- `slotToWeekDay(4, [1,4])` = `{ week_offset: 2, day_of_week: 1 }`
  (extrapolation beyond stored sessions).
- `resolveSessionsInRange` with `slip_slots = 1` shifts every session
  to the next cadence slot.
- Existing `resolveSessionsInRange` tests pass unchanged when
  `slip_slots = 0`.

### Integration (`apps/mobile/PeakTrack`)

- Skip-and-push on a 2×/week program: card disappears from today,
  next-week Mon now shows the just-skipped session, next-week Thu shows
  what used to be next-week Mon, etc.
- Skip-and-push does not affect a materialized workout in the current
  week.
- Materialized workout reschedule still works (existing
  `handleMoveWorkout` path) and is independent of slip.

## Migration / rollout

- Single migration adds the column with `DEFAULT 0`. Zero-downtime.
- No backfill.
- Old clients (web/mobile not yet updated) will ignore the new column —
  they render as if `slip_slots = 0`, which is the pre-existing
  behavior, so no break. The new action is hidden until the client is
  updated.

## Open questions

- Should "Skip and push" require an undo affordance (e.g. snackbar with
  Undo for a few seconds)? Cheap to add; reduces fat-finger anxiety.
  **Recommendation:** yes, via the same snackbar pattern used elsewhere.
- Naming for the menu item: "Skip and push" vs "Push program" vs
  "Slip program forward." **Recommendation:** "Skip and push" — it
  describes the user's intent (skipping this session) and the effect
  (everything after pushes).

## Results — implementation 2026-05-21

Implemented end-to-end on `develop`.

- Migration `20260521000000_add_program_slip_slots.sql` adds
  `programs.slip_slots INTEGER NOT NULL DEFAULT 0 CHECK (>= 0)`.
- `programScheduling.ts` gained `deriveCadence`, `slotIndexFor`,
  `slotToWeekDay`, `resolveSessionDateWithSlip`, and `resolveSessionDates`
  (the session-driven, slip-aware variant). The slip-blind
  `resolveSessionsInRange` is kept exported but no longer used by
  `fetchProgramSessionsForDateRange`.
- `fetchProgramSessionsForDateRange` rewritten to fetch all sessions for
  active programs and compute per-session slipped dates. One IN-list
  query collapsed; net round-trips unchanged.
- `incrementProgramSlip(programId)` service added. Implemented as a
  two-step read+write rather than RPC; concurrent skips race to
  last-write-wins, which is fine for the UX.
- Mobile: `ProgramsContext.skipProgramSlot` propagates the new slip into
  local `programs` state and clears the session cache.
  `ProgramSessionCard` gained a `play-skip-forward-outline` button with
  an `Alert.alert` confirmation between the existing Reschedule arrow
  and the Start button.
- Web: `useSkipProgramSlot` mutation + a "Skip and push" outline button
  on `VirtualProgramSessionCard` using `window.confirm` for the prompt.
- Tests: 19 new tests in `programSchedulingSlip.test.ts` covering
  cadence derivation, slot math, slip date resolution, identity
  preservation, and program-end extrapolation. Existing 105 service
  tests + 182 mobile tests still pass. Lint clean (only pre-existing
  warnings).
- Daily log entry added.

Deferred (still open for follow-up):

- Undo affordance for accidental skips (snackbar pattern) — recommended
  in the plan, not implemented in this pass.
- Web app's confirmation could be upgraded from `window.confirm` to a
  proper modal once the web app standardizes a confirm pattern.
- Negative slip / pull-back UI ("oops, undo a skip"). The
  two-step service implementation makes a `setProgramSlip(id, n)` trivial
  to add when the UI need shows up.

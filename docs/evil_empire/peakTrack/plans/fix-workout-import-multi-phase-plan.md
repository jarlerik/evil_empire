# Fix multi-phase parsing in workout import

## Context

Pasting a workout into the import flow collapses multi-phase exercises. When
an exercise has more than one set-spec line (different sets/reps/weights for
working-up sets, e.g. an Olympic-lifting complex), only the FIRST spec line
becomes a phase; every subsequent line — including legitimate further specs —
gets dumped into the notes field.

User-reported case (one logical exercise, three phases):

```
Power snatch + hang snatch
1 x 3 + 1 @55-60%
2 x 2 + 1 @65%
5 x 1 + 1 @70-75%
60% of Power Snatch 1RM (65kg)
```

Expected: ONE exercise with THREE phases, plus the trailing line as notes.
Actual: ONE exercise with ONE phase (the `55-60%` line); the other two specs
plus the RM line are concatenated into `notes`.

### Root cause

`packages/parsers/src/workoutTextPreprocessor.ts:116`
```ts
const setSpecIdx = lines.findIndex(l => SET_SPEC_REGEX.test(l));
```
finds only the FIRST spec line. Lines after it (line 128) are joined into
`notesText` regardless of whether they themselves match the spec regex.

### Why this approach

Three working-up sets belong to one exercise, not three. The data model
already supports many `exercise_phases` per exercise (mobile UI maps
`exercise_id → ExercisePhase[]`). The fix should preserve "one block = one
exercise" but allow each block to carry multiple parsed phases. Splitting
into N blocks would force the user through N name fields, N skip toggles,
and N RM resolutions for the same lift — wrong UX.

## Approach: multi-phase per block

Reshape the parser output so one `ParsedWorkoutBlock` carries an array of
`ParsedSetData`. Update the two import screens (mobile + web) to render one
summary row per phase and to insert one DB row per phase under a single
exercise.

## Files to modify

### 1. `packages/parsers/src/workoutTextPreprocessor.ts`

- Change `PreprocessedBlock.setSpecLine: string` → `setSpecLines: string[]`.
- In `processBlock` multi-line branch:
  - Collect ALL indices where `SET_SPEC_REGEX.test(line)` matches.
  - Lines BEFORE the first spec → `suggestedName`.
  - Each matching spec line → `setSpecLines[i]`, each rewritten via
    `rewriteSetSpec`.
  - Non-spec lines AFTER the first spec → `notesText` (joined with `\n`).
    This includes lines between specs (rare in practice; documented as
    block-level notes).
  - If no spec lines → `parseError: 'no_set_spec'`, `setSpecLines: []`.
- Single-line branch: produce `setSpecLines: [rewritten]` for the success
  paths, `[]` for the no-spec path. Behavior unchanged.

### 2. `packages/parsers/src/index.ts`

- Change `ParsedWorkoutBlock.parsed: ParsedSetData` → `phases: ParsedSetData[]`.
- Update `parseWorkoutText`:
  - Map each `setSpecLines[i]` through `parseSetInput` → `phases`.
  - For `parseError === 'no_set_spec'`, emit a single-element `phases`
    containing `invalidResult(...)` (preserves "one block = one card" so
    the UI can still render it as unparseable).
  - `missing` aggregates: `'unparseable'` if any phase is invalid;
    `'rmSource'` if any phase has `needsRmLookup`.

### 3. Parser tests

`packages/parsers/__tests__/workoutTextPreprocessor.test.ts`:
- Rename assertions from `setSpecLine` → `setSpecLines`.
- Add cases:
  - User's Power Snatch input → 3 spec lines, 1 trailing notes line.
  - Two specs only, no notes → 2 spec lines, no `notesText`.
  - Spec / note / spec → 2 spec lines, 1 note line.
  - Single-spec block (existing) → still single-element array.

`packages/parsers/__tests__/parseWorkoutText.test.ts`:
- Rename `block.parsed` → `block.phases[0]` throughout existing tests.
- Add a multi-phase test for the Power Snatch input.

### 4. `apps/mobile/PeakTrack/app/import-workout.tsx`

- Update `isBlockReady`: use `phases.every(p => p.isValid)` and
  `phases.some(p => p.needsRmLookup)`.
- Update `handleParse`: RM eager-lookup uses the block's name once; result
  is shared across all phases.
- Update `handleSave`:
  - After `createExercise`, loop over `state.block.phases`. For each phase:
    1. Call `calculateWeightsFromParsedData(...)` passing
       `state.rmWeight` / `state.rmSourceName` as overrides — the hook
       already short-circuits when `rmWeightOverride` is set, so no extra
       DB queries are made for phases 2+.
    2. Build `finalParsed` per phase. Attach the user-edited block-level
       `state.notes` to phase[0] only; auto-generated `buildRmSourceNote`
       attaches per phase that has `needsRmLookup`.
    3. Apply the wave special-case per phase.
    4. `await insertPhase(buildPhaseData(...))`. Sequential awaits preserve
       insertion order; phases are ordered by `created_at` (no
       `phase_order` column exists in `exercise_phases`).
- Update `BlockCard` to render one `summarizeSpec` per phase (a small list,
  not a single line). `summarizeSpec` is unchanged — call it per phase.

### 5. `apps/web/peaktrack-app/app/routes/_app.workouts.import.tsx`

Mirror the mobile changes:
- Update `isReady`.
- Update `handleParse` block-resolution.
- Update `handleSave` to loop over `phases`, calling `resolveWeights({ ...,
  parsed: phase, rmOverride })` for each. Same per-phase notes/RM-source-
  note wiring as mobile.
- Update the BlockCard equivalent to render one summary row per phase via
  `summarize`.
- `apps/web/peaktrack-app/app/lib/rm-lookup.ts` already takes a single
  `parsed: ParsedSetData` and accepts `rmOverride`; no changes needed
  inside the file — only the call sites loop.

## Reused utilities

- `parseSetInput` (`packages/parsers/src/index.ts`) — unchanged; called per
  spec line.
- `buildPhaseData` (`packages/peaktrack-services/src/buildPhaseData.ts`) —
  unchanged; called per phase.
- `insertPhase` (`@evil-empire/peaktrack-services`) — unchanged; called per
  phase.
- `calculateWeightsFromParsedData` (`useRmLookup.ts`) — unchanged;
  short-circuit on `rmWeightOverride` lets us reuse one RM across phases.
- `resolveWeights` (`apps/web/peaktrack-app/app/lib/rm-lookup.ts`) —
  unchanged; same `rmOverride` short-circuit on the web side.
- `buildRmSourceNote` (mobile `import-workout.tsx`) — unchanged; called per
  phase.

## Verification

1. **Unit tests**: `pnpm test --filter=@evil-empire/parsers` — preprocessor
   and `parseWorkoutText` suites should both pass, including the new
   multi-spec cases.
2. **Type check**: `pnpm typecheck` — surfaces every leftover `block.parsed`
   reference if any are missed.
3. **Mobile end-to-end** (`pnpm dev:mobile`):
   - Open Import workout, paste the Power Snatch sample, parse.
   - Review screen: ONE card titled "Power snatch + hang snatch" showing
     three spec rows. Notes field prefilled with `60% of Power Snatch 1RM
     (65kg)`.
   - Resolve a Power Snatch 1RM (or pre-create one in RMs).
   - Save. Open the workout: one exercise with three phases, weights
     resolved per phase percentage; phase 1 carries the user notes.
4. **Web end-to-end** (`pnpm dev:web`): same flow, same expectations.
5. **Regression check**: re-import the existing 4-block reference paste
   from `parseWorkoutText.test.ts` to confirm single-spec blocks still
   produce one phase each with notes attached correctly.

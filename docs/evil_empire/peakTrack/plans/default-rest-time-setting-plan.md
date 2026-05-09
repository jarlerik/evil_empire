# Default Rest Time Setting — Plan

## Decisions (locked in)
- **Strategy: Option A — bake at creation.** When the parser yields no rest time, look up the user's `default_rest_seconds` and write it into `exercise_phases.rest_time_seconds` at insert/update time. The DB always reflects the value the user will actually rest for.
- **Settings input UX: placeholder hint.** The settings field shows a hint placeholder (e.g. `e.g. 120`) rather than pre-filling a value. Empty input → null (no default).
- **Add-exercise UX: ghost text.** While composing an exercise, if no rest time is detected in the input and a default exists, show "rest: 120s (default)" near the input as a hint about what will be saved.

## Scope

### 1. Database
New migration `supabase/migrations/<ts>_add_default_rest_seconds.sql`:
```sql
ALTER TABLE user_settings
  ADD COLUMN default_rest_seconds INTEGER;
COMMENT ON COLUMN user_settings.default_rest_seconds IS
  'When set, baked into exercise_phases.rest_time_seconds at create/edit if input has no explicit rest.';
```
Nullable, no DEFAULT — null means "no default, leave rest_time_seconds NULL."

### 2. Shared services (`packages/peaktrack-services`)
- Extend the `UserSettings` row type with `default_rest_seconds: number | null`.
- Update `buildPhaseData()` to accept an optional `defaultRestSeconds?: number | null` arg and apply the fallback chain:
  ```ts
  if (parsedData.restTimeSeconds !== undefined) {
    data.rest_time_seconds = parsedData.restTimeSeconds;
  } else if (defaultRestSeconds != null) {
    data.rest_time_seconds = defaultRestSeconds;
  } else if (isUpdate) {
    data.rest_time_seconds = null;
  }
  ```
  (Insert with no default → omit field, DB stays NULL — same as today.)

### 3. Contexts
- Mobile `apps/mobile/PeakTrack/contexts/UserSettingsContext.tsx`: add `default_rest_seconds: number | null` to the `UserSettings` interface; the existing spread-based update flow propagates it.
- Web `apps/web/peaktrack-app/app/contexts/UserSettingsContext.tsx`: mirror the change.

### 4. Settings UI
- Mobile settings screen: add numeric input "Default rest between sets (seconds)" with placeholder hint. Empty input → store null.
- Web `apps/web/peaktrack-app/app/routes/_app.settings.tsx`: same field with same UX.

### 5. Exercise create/edit wiring
- `useExercisePhases` (or wherever `buildPhaseData` is called) needs `userSettings.default_rest_seconds` passed in. Plumb through hook signatures as needed.
- Mirror in any web callers if they create/edit phases (verify during impl).

### 6. Add-exercise / edit-exercise UX
- When composing input, detect "no rest in this line" and if a default exists, show ghost text like `rest: 120s (default)` next to the input. Pure display layer.
- On edit, if `phase.rest_time_seconds` is set (always will be when default is active), show as normal — no ghost text needed since the value is now real.

### 7. Workout execution
- No code change. `phase.rest_time_seconds || 0` continues to work because the value is baked in at write time.

### 8. Tests
- `packages/peaktrack-services` — unit-test `buildPhaseData` fallback chain: explicit > default > (insert: omitted | update: null).
- Mobile component/hook tests covering exercise creation: with default set, with default null, with explicit override.

## Out of scope
- Per-program / per-exercise-type defaults.
- Backfilling existing phases (only new and edited rows pick up the default).
- Parser changes.

## Verification
- Migration applied locally; settings screen on both mobile and web persists the new field.
- With default = 120, create exercise without `120s` → DB row has `rest_time_seconds = 120`; workout timer rests 120s.
- With default = 120, create exercise with `90s` → DB row has 90; workout rests 90s.
- With default = null, create exercise without rest → DB row has NULL; workout rests 0s (current behaviour).
- Add-exercise input shows ghost "rest: 120s (default)" hint when no rest in line and default = 120.

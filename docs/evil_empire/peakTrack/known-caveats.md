---
title: PeakTrack — Known Caveats
type: note
permalink: evil-empire/peaktrack/known-caveats
---

# PeakTrack — Known Caveats

Living document of architectural assumptions and known gotchas in the PeakTrack codebase. Add a new section when an assumption is *load-bearing* (changing it would require a migration or coordinated code change). Include enough context for a future contributor to decide whether the assumption still holds.

---

## Weight unit is global, not per-row

**Status:** Active assumption — relied on by every screen that reads/writes weight.

### The model

- All weight columns in the DB are unit-less `DECIMAL(10,2)`:
  - `exercise_phases.weight`, `exercise_phases.weights[]`
  - `workout_execution_logs.weight`, `workout_execution_logs.weights[]`
  - `repetition_maximums.weight` (and related)
- The user's preferred unit lives in `user_settings.weight_unit` (`'kg' | 'lbs'`), set once during onboarding via `UnitSelectionModal` (see [OnboardingContext](apps/mobile/PeakTrack/contexts/OnboardingContext.tsx) and [UserSettingsContext](apps/mobile/PeakTrack/contexts/UserSettingsContext.tsx)).
- The number stored in the DB **is** the number the user typed. No conversion happens on read or write.

### Implication for display code

- Read raw number → format with `useUserSettings().settings.weight_unit`.
- No conversion math anywhere. A `100` row displays as `100 kg` for a kg user, `100 lbs` for a lbs user — even if it's the same row.

### The caveat

The DB does not tag rows with the unit they were entered in. If a user flips `weight_unit` mid-history:

- Old rows are silently re-interpreted in the new unit.
- A `100 kg` squat logged in January suddenly reads as `100 lbs` after a March flip.
- Volume aggregations, charts, RM lookups all become a mix of two units with no way to tell them apart.

### Why we accept it

- Real users almost never change unit after onboarding.
- Adding a per-row `unit` column would touch every weight-writing path and every aggregation — a meaningful migration for a vanishingly rare edge case.
- The onboarding UX nudges users toward picking the right unit before they have any history, so the window where this matters is narrow.

### When to revisit

- A user actually hits this and we get a support ticket.
- Before exposing weight-unit toggle outside onboarding (e.g. a settings screen). If we add that, do one of:
  1. **Lock**: disable the toggle once any weight row exists for the user.
  2. **Stamp**: add `unit` column to all weight tables and stamp on insert; aggregations become unit-aware.
  3. **Convert**: on flip, run a one-shot conversion across the user's rows. Risky — irreversible if the original input was already approximate.

Option 1 is cheapest. Option 2 is correct. Option 3 is a trap.

---

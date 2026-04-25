---
title: Daily Log 16.04.2026
type: note
permalink: evil-empire/daily-log/daily-log-16.04.2026
tags:
- daily-log
- parser
- compound
- bugfix
---

## Fix "Invalid wave format" error when editing compound sets with percentage range

When a compound exercise like `6 x 3+2+2 @70-75%` was saved, the RM lookup resolved it to absolute kg values and persisted `weight_min`/`weight_max`. On edit, `reverseParsePhase` reconstructed the input as `6 x 3 + 2 + 2 @67-71kg 120s`, but no compound parser handled a single weight range — only percentage range, single weight, or multi-weight + trailing range. The input fell through to the catch-all wave-format error. Added `parseCompoundWeightRange` for `sets x reps1 + reps2 @min-max kg/lbs` and wired it into the dispatcher before `parseCompoundWeight`. Added 4 tests — 431 total passing.

## Plan: Import workouts/exercises from pasted text

Drafted and approved a plan for letting users paste raw workout text (like the Hyrox/CrossFit-style feed) and import it as exercises with minimal extra input. Saved to `docs/evil_empire/peakTrack/plans/import-pasted-workout-plan.md`. Decisions: home-screen quick-action entry, single workout for the home-screen-selected date, `@light weight` rewrites to `@60%`, review screen handles all missing-info prompts.

## Parser foundation for paste-import (phases 1–3)

Implemented the parser-layer half of the import-pasted-workout plan. (1) `parseSetInput` now strips a trailing ` of 1RM` so `@95% of 1RM` parses identically to `@95%`. (2) New `workoutTextPreprocessor` splits multi-line pasted text into per-exercise `PreprocessedBlock`s, applying `@light weight` → `@60%` and inline-separator handling. (3) New `parseWorkoutText` high-level API combines preprocessor + `parseSetInput` and returns a `missing[]` checklist (`'rmSource'` / `'unparseable'`) the UI can drive. Test count grew from 436 → 468.

## Paste-workout import UI (phase 4)

Shipped the mobile half of the import-pasted-workout feature. New `app/import-workout.tsx` is a two-step screen (paste → review) that takes the home-screen-selected date as a nav param. The review step shows one card per detected exercise with editable name + notes, a parsed-spec summary, and inline chips for "1RM needed" (opens reused `RmSelectModal`/`RmFormModal`) or "Couldn't parse" (skip-only). Eagerly resolves any percentage exercise that has an exact 1RM match so the user only sees chips for blocks that genuinely need input. Save creates a fresh "Imported - <date>" workout, then loops through non-skipped blocks creating exercises + phases via the existing services. Extracted the previously-private `buildPhaseData` helper from `useExercisePhases.ts` to a shared `lib/buildPhaseData.ts` so both the live edit flow and the import flow build identical `PhaseInsertData` rows. Home screen gets a small "Paste workout from another app" link below the Add Exercise input. Route registered in `_layout.tsx`. Typecheck/lint/tests all green.

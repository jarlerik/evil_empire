---
title: Daily Log 21.04.2026
type: note
permalink: evil-empire/daily-log/daily-log-21.04.2026
tags:
- daily-log
- programs
- ux
---

## Move missed workouts and program sessions to any day in the visible week

Extended the forward-arrow "move" affordance so a missed workout or missed virtual program session can be rescheduled to any day in the currently displayed week, not just today. Tapping the arrow puts the week strip into move-mode (orange border + banner "Tap a day to move …"); tapping a day runs `updateWorkoutDate` for materialized workouts or `materialize_program_session` with a target date for virtual sessions. Extracted the materialize-prep logic into `lib/prepareMaterializeInputs.ts` so `ProgramSessionCard` and `index.tsx` share it. Past virtual program sessions now show the red `missed` dot instead of the previous orange `planned`. Pending-move state auto-cancels on week navigation, deletion, or materialization elsewhere.

## Program progression view (v1)

New per-program, per-exercise progression screen at `app/program-progression.tsx`. Each program session renders as a tile stack (one column per set, one tile per rep) with a volume-trend SVG line overlaying the columns and a horizontal scroll across the program. Color rule: bright orange when performed meets or exceeds prescription, dark brown when below, dim orange when prescribed-but-missed, faded tiles for the `+N` segment of same-exercise compound sets. Waves render as variable-height columns with per-column weight labels; uniform-weight sessions show a single label above. Entry point is a `trending-up-outline` icon on each session row in `program-detail.tsx` that pushes to the progression route with `{ programId, exerciseName }`. New service helper `fetchProgramProgressionData` in `programService.ts` returns program, per-session rows (prescribed + matching performed phase) and program RMs in one parallel round-trip. v1 scope: linear/wave/same-exercise-compound; deferred: multi-exercise compounds, PR shade, sparklines. Added 9 unit tests covering the layout cases.

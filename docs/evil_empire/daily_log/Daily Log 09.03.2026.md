---
title: Daily Log 09.03.2026
type: note
permalink: daily-log/daily-log-09.03.2026
tags:
- daily-log
- parser
- wave-pattern
---

# Daily Log 09.03.2026

## Multi-weight wave pattern support
Added support for multiple weights/percentages in wave patterns. Users can now write `3-2-1-3-2-1@70, 75%` or `3-2-1-3-2-1@70 75%` to specify different weights per wave cycle. Also added `@` as an alternative separator to space. Updated parser, types, RM resolution in app hooks, and tests.

## EMOM timer support
Added EMOM (Every Minute On the Minute) interval support. New parser prefix (`EMOM 5min:`, `E90s:`) attaches `emomIntervalSeconds` to any exercise phase. Timer counts down during work state with strict auto-advance — rounds progress automatically when the interval expires. Button is disabled during EMOM (no manual intervention). Circuit exercises now display individual movements in the workout timer display instead of "0 @0kg". New migration adds `emom_interval_seconds` column to `exercise_phases`.

## Fix EMOM/Circuit Data in Execution Logs
Added missing fields (`emom_interval_seconds`, `exercise_type`, `circuit_exercises`, `target_rm`, `rir_min`, `rir_max`) to `workout_execution_logs` table and wired them through the save paths and history display. EMOM circuits now render correctly in history instead of showing "3 x 0 @0kg".

## iOS build output directory
Updated `build:ios` script to output `.ipa` to `./build/PeakTrack.ipa` via `--output` flag. Created `build/` directory and added it to `.gitignore`.
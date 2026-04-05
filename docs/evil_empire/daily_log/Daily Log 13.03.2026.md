---
title: Daily Log 13.03.2026
type: note
permalink: evil-empire/daily-log/daily-log-13.03.2026
tags:
- daily-log
- execution-modal
- ui
---

# Daily Log 13.03.2026

## Per-set weight inputs in execution modal
Changed EditExecutionModal to always show per-set weight input fields when editing exercise execution, instead of only for weight-range phases. RM build and circuit types still use a single text input since per-set weights don't apply to them.

## Hide action icons for completed workouts
Hide stopwatch and delete icons on the home screen for completed workouts. Exercises show a green checkmark instead of the pencil edit icon, matching the existing WorkoutCard pattern.

## Voice cues for rest timer
Replaced the 5-second beep countdown with voice audio cues: "Ten seconds" plays at 10s remaining, "Let's go" + beep at 0s. Fixed sounds skipping on alternating sets by awaiting `seekTo(0)` before calling `play()`. Removed unused `beepLongSound`.
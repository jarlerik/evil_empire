---
title: Daily Log 08.03.2026
type: note
permalink: daily-log/daily-log-08.03.2026
tags:
- daily-log
- rest-timer
- audio
---

## Longer final rest timer beep

Added a longer beep sound (600ms) that plays when the rest timer reaches zero, replacing the short 200ms beep. The countdown beeps at 5-4-3-2-1 remain short. Generated `beep-long.wav` by concatenating the existing `beep.wav` 3x. Updated both `start-workout.tsx` and `useWorkoutTimer.ts`.
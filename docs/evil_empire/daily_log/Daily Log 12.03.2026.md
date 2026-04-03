---
title: Daily Log 12.03.2026
type: note
permalink: evil-empire/daily-log/daily-log-12.03.2026
tags:
- daily-log
- onboarding
- coach-marks
---

# Daily Log 12.03.2026

## Guided first-workout onboarding with coach marks
Implemented a 4-step coach mark onboarding tour for new users. Walks them through the calendar, adding an exercise, defining sets/reps, and input options. Uses a full-screen modal overlay with highlight borders, tooltips, Next/Skip controls, and step indicators. Persists completion via `onboarding_completed` flag in Supabase `user_settings`. Auto-advances steps when the user navigates between screens. Only shows coach marks matching the current screen pathname.

## Hide calendar dot and delete icon for empty workouts
Workouts with no exercises no longer show a status dot on the calendar or the delete × button. Prevents visual clutter from auto-created empty workout records.

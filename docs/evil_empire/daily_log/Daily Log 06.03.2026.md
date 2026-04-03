---
title: Daily Log 06.03.2026
type: note
permalink: daily-log/daily-log-06.03.2026
tags:
- daily-log
- weekly-calendar
- workout-card
- missed-workout
- status-dots
- color-scheme
---

## Missed/Completed Status Dots in Weekly Calendar

Added colored status dots to the WeekDaySelector calendar component — orange for completed workouts, red for missed (past + incomplete).

- `WeekDaySelector.tsx`: Added `dayStatuses` prop and colored dot indicators below day numbers
- `index.tsx`: Derived per-day statuses from workouts and completedWorkoutIds, passed to WeekDaySelector

## Missed Workout Badge + Move to Today

Added missed workout indicators to WorkoutCard and a "Move to today" action for rescheduling past incomplete workouts.

- `workoutService.ts`: Added `updateWorkoutDate()` function
- `WorkoutCard.tsx`: Added `isMissed` prop showing red "Missed workout" badge and "Move to today" pressable link
- `index.tsx`: Derives missed status per workout, wires up `onMoveToToday` handler that updates the date and navigates to today

## Planned Workout Dots + Color Scheme Update

Added "planned" status for future/today incomplete workouts in the calendar. Updated color scheme across the app:
- Planned workouts: orange dot (`#C65D24`)
- Completed workouts: green dot (`#4CAF50`) + green checkmark on WorkoutCard
- Missed workouts: red dot (`#E53935`)

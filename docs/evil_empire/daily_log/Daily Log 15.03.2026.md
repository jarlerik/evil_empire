---
title: Daily Log 15.03.2026
type: note
permalink: evil-empire/daily-log/daily-log-15.03.2026
tags:
- daily-log
- workout-execution
- rest-timer
---

## Show next set info during rest phase

During the rest phase of workout execution, the timer now shows the upcoming set's weight and reps instead of the just-completed set's info. Added "Next set:" helper text so users can prepare while resting.

- `start-workout.tsx`: compute `displaySetInPhase` (current + 1 during rest) and pass to timer display
- `WorkoutTimerDisplay.tsx`: show "Next set:" label during rest state

## Copy workout to today from history

Added a "copy to today" feature in the history view. Users can tap a copy icon on any completed workout to duplicate it (with all exercises and original exercise phases) onto today's date. Includes loading spinner on the copy button and a full-screen loading indicator on the home screen while data loads after navigation.

- `workoutService.ts`: new `copyWorkout` function that creates workout, copies exercises and phases
- `WorkoutCard.tsx`: `onCopy` / `isCopying` props with ActivityIndicator
- `history.tsx`: wired up copy handler with loading state
- `index.tsx`: added `isFetchingWorkouts` loading state with LoadScreen

## Fix copy workout missing notes & timer layout

Copy workout from history now includes exercise phase notes (e.g. "70-85% of Muscle snatch 1RM"). Also fixed timer layout by removing `flex: 1` from top section and adding `adjustsFontSizeToFit` to the RESTING text.

- `workoutService.ts`: added `notes: phase.notes ?? null` to copied phase data
- `WorkoutTimerDisplay.tsx`: removed `flex: 1` from `timerTopSection`, added `adjustsFontSizeToFit` to RESTING text

## Show navigation bar during loading screen

The PKTR loading animation on the home screen was hiding the bottom navigation bar because it returned early before rendering `NavigationBar`. Split the loading check so auth/settings loading still shows full-screen loader, but workout fetching shows the loader with the nav bar visible.

- `index.tsx`: separate `isFetchingWorkouts` early return that includes `<NavigationBar />`

## Fix timer overlapping exercise list during rest

The workout timer card was overlapping the exercise list during rest phase. Changed the exercise list from `flex: 0.1` to `maxHeight: 200` and gave the timer `flex: 1` so it fills remaining space without cutting off the countdown.

- `start-workout.tsx`: replaced `flex: 0.1` with `maxHeight: 200` on exercises container
- `WorkoutTimerDisplay.tsx`: changed timer container from `flex: 0.9` to `flex: 1`, added `marginTop: 8`

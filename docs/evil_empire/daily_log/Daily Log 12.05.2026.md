# Daily Log 12.05.2026

## feat(mobile): allow rescheduling any incomplete workout
The move-to-another-day arrow on workout and program-session cards was previously gated to past, missed entries only. Dropped that gate so any incomplete workout or virtual session shows the arrow, letting users push a future day forward when their schedule slips.

## refactor(mobile): collapse workout actions into a three-dot modal
Replaced the inline start/delete/reschedule icon row on workout cards with a single ellipsis trigger that opens a bottom-sheet `WorkoutActionsModal`. Cleans up the card header and gives room for future actions without crowding the row.

# Daily Log 21.05.2026

## fix(mobile): preserve reschedule state across week navigation
Rescheduling a missed workout to a different week was broken — the pending move was cleared both by the week prev/next handlers and by an existence check that fired whenever the moved workout wasn't in the currently loaded week's data. Carry the workout/session name on `PendingMove` so the banner survives the week change, and only clear the state on explicit cancel or delete.

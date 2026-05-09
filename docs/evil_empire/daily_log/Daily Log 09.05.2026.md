# Daily Log 09.05.2026

## feat(parsers,mobile): estimate weight for RIR-only exercises from 1RM
RIR formats without explicit weight (`4 x 3 2RIR`, `4 x 6@1RIR`, compound `4 x 2 + 2@1RIR`) now flag `needsRmLookup` so the existing RM-lookup pipeline kicks in. Added Epley-based `calculateWeightFromRir` (`weight = 1RM / (1 + (reps + avgRIR)/30)`, rounded to 0.5kg) in `useRmLookup`, and extended `applyRmWeight` to use it when no weight percentage is present. Saved phases get a note like `≈ 3 reps @ 2RIR of Squat 1RM (100kg)` and the timer now shows a real estimated weight instead of `@0kg`. UX matches the percentage flow: partial-match modal when no exact 1RM exists, add-new form when nothing matches.

## fix(mobile): only show completed dot when all day's workouts are done
The week selector previously marked a day green as soon as one workout was completed, even if other workouts or virtual program sessions on the same day were still planned or missed. Refactored the status aggregation in `app/index.tsx` to a two-pass approach that tracks `hasCompleted` / `hasIncompletePast` / `hasIncompleteFuture` per date before deriving the dot, so green appears only when every item that day is done.

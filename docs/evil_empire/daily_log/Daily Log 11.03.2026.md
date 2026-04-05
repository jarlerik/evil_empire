---
title: Daily Log 11.03.2026
type: note
permalink: daily-log/daily-log-11.03.2026
tags:
- daily-log
- ui
- loading-screen
- animation
---

# Daily Log 11.03.2026

## Animated PKTR LoadScreen
Created `LoadScreen` component using react-native-reanimated that replicates the web vaikia-dev animation — bouncing, rotating "PKTR" letters in orange with staggered timing. Replaced `ActivityIndicator` spinners on index, history, and repetition-maximums screens.

## Rename header to PEAKTRACK
Replaced "Workouts" header on home screen with centered "PEAKTRACK" title.

## Inline RM modal for percentage-based exercises
Instead of showing an error alert when no 1RM exists for a percentage-based exercise input, the app now shows an inline modal to add the RM without leaving the exercise creation screen. For compound exercises (e.g. "Power Snatch + Snatch balance"), partial RM matches are shown as selectable options via a new `RmSelectModal`, with an "Add new 1RM" fallback. After saving or selecting, the exercise phase is created automatically.

## RM source note on percentage-based phases
Percentage-based exercise phases now show a note indicating the RM source and percentage used, e.g. "65% of Snatch 1RM (75kg)". Works for single, range, and multi-set percentages.

## Fix expo-notifications type error
Added `shouldShowBanner` and `shouldShowList` to the notification handler — required by the updated expo-notifications SDK types.

## Inline exercise adding on home screen
Removed the separate workout creation step (`create-workout.tsx` deleted). Users now type an exercise name directly on the home screen and tap "Add exercise". A workout is auto-created for the selected date when the first exercise is added. Replaced WorkoutCard with flat ExerciseItem list. Added delete confirmation, stopwatch, and move-to-today actions. Extracted reusable ExerciseItem component.

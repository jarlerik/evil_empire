---
title: Daily Log 10.03.2026
type: note
permalink: daily-log/daily-log-10.03.2026
tags:
- daily-log
- parser
- rest-time
- bug-fix
---

## Decimal rest time support in parser

Fixed `restTimeParser.ts` to accept decimal rest times like `2.5min` and `2,5min`. The regex only matched integers (`\d+`), causing `2.5min` to error and `2,5min` to incorrectly trigger circuit detection (comma was interpreted as circuit exercise separator). Updated regex to `\d+(?:[.,]\d+)?` and switched from `parseInt` to `parseFloat` with comma normalization. Added 6 tests covering dot/comma decimals with various exercise formats.

## Migrate expo-av to expo-audio

`expo-av` is deprecated and removed in SDK 54. Replaced `Audio.Sound` (imperative load/unload) with `useAudioPlayer` hook from `expo-audio` in `start-workout.tsx` and `useWorkoutTimer.ts`. The hook auto-cleans up on unmount, simplifying the code. Updated test mocks accordingly. Removed `expo-av` dependency, added `expo-audio`.

## Workout rating feature

Added post-workout rating (1-5) with a modal that appears after completing a workout. Created `workout_ratings` table (with RLS), `workoutRatingService.ts` for upsert/fetch, and `WorkoutRatingModal.tsx` (bottom-sheet with tappable circles, skip/save). Ratings display in history via `WorkoutCard`. Users can skip rating.

## Refactor useWorkoutTimer hook

Consolidated all timer/audio/animation logic from `start-workout.tsx` into `useWorkoutTimer` hook. The hook was previously unused dead code that didn't support EMOM. Extended it with `startEmomTimer`, `isEmom` prop, and `onEmomTimerZero` callback. Removed ~100 lines of inline timer code from start-workout.

## Fix expo-audio NativeSharedObjectNotFoundException

`useAudioPlayer` from `expo-audio` threw `NativeSharedObjectNotFoundException` when calling `play()` — native player object wasn't ready or was garbage collected. Fixed by wrapping play calls in try-catch, removing `seekTo(0)` calls, and converting audio files from .wav to .m4a (AAC).

## Move audio players to AudioContext

Created `AudioContext` that initializes `useAudioPlayer` at app startup (in `_layout.tsx`) instead of when navigating to the workout screen. The `useWorkoutTimer` hook now consumes players via `useAudio()` context. This fixes the `NativeSharedObjectNotFoundException` — the native audio objects are fully initialized by the time they're needed. Restored `seekTo(0)` before `play()` calls (needed to replay sounds) which now works reliably with the early-loaded players.

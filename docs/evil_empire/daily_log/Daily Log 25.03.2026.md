---
title: Daily Log 25.03.2026
type: note
permalink: evil-empire/daily-log/daily-log-25.03.2026
tags:
- daily-log
- workouts
- ux
---

## Multiple workouts per day

Added support for creating multiple workouts on the same date. Users can tap "+ Add another workout" to start a second session (e.g., morning lifting + evening cardio). Each workout is its own section with independent timer, delete, and move-to-today actions. The single-workout flow is unchanged — users who never use the button see no difference.

Commit: `a6e685a`

## Onboarding coach mark fixes

Fixed onboarding tour breaking after the first step. The coach mark tooltip was rendered off-screen when the target element (add-exercise area) was inside a ScrollView and pushed below the viewport. Added off-screen detection and position clamping to `getTooltipPosition`. Also added a new onboarding step about percentages/RM usage, and corrected the final step copy (removed "supersets" reference, added "circuits" which is actually supported).


## Fix user settings fetch for new users

Fixed 406 (Not Acceptable) error when a new/test user signs in and has no `user_settings` row yet. Changed `.single()` to `.maybeSingle()` in `fetchUserSettings` so missing rows return `null` instead of erroring, allowing the default settings creation to kick in.

## Weight unit support (kg/lbs)

Added full kg/lbs unit support throughout the app. New users see a blocking modal to choose their preferred unit before anything else. The parser now accepts both `kg` and `lbs` in all formats (standard, compound, wave, multiple weights, weight ranges, RIR with weight). The formatter and reverse parser take a `unit` parameter so exercises display in the user's chosen unit. All screens, placeholders, help text, onboarding coach marks, and the RM form label are now dynamic based on the setting. Also fixed 3 pre-existing test suites (NavigationBar missing SafeAreaProvider, useWorkoutTimer audio mock missing seekTo Promise, EditExecutionModal tests not matching per-set weight UI).

## Fix hardcoded kg in timer and RM notes

Fixed weight unit not being respected in 3 places: the workout timer display (showing `@180kg` instead of `@180lbs`), RM percentage notes (e.g., "90% of Deadlift 1RM (200kg)"), and the RM selection modal. All now use the user's weight_unit preference. Also set up a PostToolUse hook to automate daily log entries after git commits.

Commit: `dcb8e30`

## Clean up test noise and fix turbo test runner

Suppressed noisy `console.error` output in AuthContext, UserSettingsContext, and EditExecutionModal test suites by adding `console.error` spies in `beforeEach`/`afterEach`. Fixed NavigationBar act() warning by wrapping renders with `waitFor` for async Icon loading. Changed mobile test script from `jest --watchAll` to `jest` so `pnpm test` (via turbo) runs all workspace tests and exits cleanly — watch mode moved to `test:watch`.

Commit: `0b37b62`

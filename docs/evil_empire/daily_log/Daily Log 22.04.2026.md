---
title: Daily Log 22.04.2026
type: note
permalink: evil-empire/daily-log/daily-log-22.04.2026
tags:
- daily-log
- programs
- ux
---

## Program progression trend line: give the chart enough vertical range

Bumped `TREND_HEIGHT` from 56 to 140 (and padding from 8 to 12) in `app/program-progression.tsx`. With only 40px of usable chart height, low volumes like 137 were visually indistinguishable from middling volumes like 520 — the computed y-delta was ~12px, smaller than the perceptual footprint of the stroke + circle markers. 116px of usable height now spreads the same data points ~36px apart.

## Progression view: respect per-set weights when computing volume

Fixed `lib/progressionLayout.ts` to treat `weights[]` as one-set-per-entry when no `compound_reps` accompany it. A session stored as `{sets:6, repetitions:2, weight:100, weights:[100,100,102,102,105,105]}` was previously reducing to `6 × 2 × 100 = 1200` because both `normalizeFromParsed` and `normalizePerformed` fell through to the uniform branch and filled `weightPerSet` with the single `weight` scalar. They now emit a wave spec (`setCount = weights.length`, `isWave: true`) so volume sums `2×100 + 2×100 + 2×102 + 2×102 + 2×105 + 2×105 = 1228`.

## Progression view: summarise varying weights as a min-max range

Reworked the session header label logic in `buildSessionLayout`: when any refSpec has more than one distinct weight, show a `min-max` range (e.g. `100-105kg`) instead of leaving the label undefined. Also suppress per-column weight labels when reps are uniform across columns — in a 12px-wide column the full `100kg` / `105kg` strings overlap into neighbours and truncate to `1...`, so the range header is both cleaner and more informative. Per-column labels remain for true waves where rep counts vary between columns, which is where pairing each stack height with its weight actually adds value. Updated existing wave test to assert the new `60-80kg` header; new per-set-weights test asserts `100-105kg` and no column labels.

## Allow deleting empty workouts with adapted confirmation

The × delete button on a workout card was gated on `workoutHasExercises`, so a freshly-created empty workout had no way to be removed short of adding a dummy exercise first. Dropped the gate (still gated on `!workoutCompleted`) and made `handleDeleteWorkout` pick the confirmation message based on whether the workout has exercises — "…and all its exercises?" for non-empty workouts, the shorter "…delete this workout?" for empty ones.

## Polish program screens navigation and primary action

Programs tab now stays active across all `/program-*` and `/create-program` routes via a new `matchPrefixes` field on the `NavigationBar` nav items (previously only matched `/programs` exactly). Added the `NavigationBar` to `program-edit.tsx` so the tab bar is consistent across program screens. Promoted "View progression" on `program-detail.tsx` to a filled primary button (orange fill, white text) to make it visually dominant over the outlined "Edit plan" secondary action.

## Center max reps title with smaller size and spacing

Overrode `commonStyles.title` on `repetition-maximums.tsx` with a local style that centers the "Max reps" heading, drops it from 32px to 26px, and adds 20px `marginBottom` so the Add RM button no longer collides with the title. Scoped to this screen only — the shared `commonStyles.title` remains left-aligned at 32px for the other screens that rely on it.

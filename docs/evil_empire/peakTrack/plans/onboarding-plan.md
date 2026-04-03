# Guided First-Workout Onboarding

## Context
New users land on an empty home screen after sign-up with no guidance. This onboarding walks them through creating their first real workout with coach marks/tooltips that highlight UI elements and explain what they do. It's skippable and only shown once.

The home screen has inline exercise adding — users type an exercise name and tap "Add exercise" directly on the home screen. A workout is auto-created for the selected date when the first exercise is added. After adding, the user navigates to `/edit-exercise` to define sets/reps. There is no separate workout creation or exercise list screen in the main flow.

## Approach

### 1. Track onboarding completion in Supabase

**Migration**: `supabase/migrations/20260312000000_add_onboarding_completed.sql`
```sql
ALTER TABLE user_settings ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;
```

**Update `services/types.ts`**: Add `onboarding_completed: boolean` to `UserSettingsRow`.

**Update `services/userSettingsService.ts`**: Add `markOnboardingCompleted(userId)` function that sets the flag to `true`.

**Update `contexts/UserSettingsContext.tsx`**:
- Add `onboarding_completed` to `UserSettings` interface and state
- Expose `completeOnboarding()` that calls `markOnboardingCompleted` and updates local state
- Default to `false` when creating new user settings

### 2. Create OnboardingContext

**New file**: `contexts/OnboardingContext.tsx`

Manages the step state and reads `onboarding_completed` from UserSettingsContext.

- `currentStep: number | null` (null = inactive)
- `isOnboarding: boolean`
- `nextStep()` — advances or completes if at last step
- `skipOnboarding()` — marks complete immediately
- `registerLayout(stepId, layout)` — stores measured positions of target elements
- Uses `usePathname()` from expo-router to detect screen changes

**Step definitions** (constant array inside the context):

| # | Screen | Target ID | Title | Message |
|---|--------|-----------|-------|---------|
| 0 | `/` | `week-day-selector` | Your Calendar | Select any day to plan workouts. Dots show planned, completed, and missed sessions. |
| 1 | `/` | `add-exercise-area` | Add an Exercise | Type an exercise name like "Bench Press" and tap Add. A workout is created automatically! |
| 2 | `/edit-exercise` | `set-input` | Define Sets & Reps | Enter sets using formats like "4 x 3 @100kg". Tap input options to see all formats. |
| 3 | `/edit-exercise` | `input-options` | You're All Set! | PeakTrack supports many formats: percentages, waves, supersets, and more. |

Step auto-advances when the user navigates to the screen matching the next step.

### 3. Create CoachMark component

**New file**: `components/CoachMark.tsx`

A full-screen Modal overlay with:
- Semi-transparent dark background (`rgba(0,0,0,0.7)`)
- Tooltip bubble positioned near the target element (above or below)
- Title, message, "Next" button (primary), "Skip tour" link, step indicator (e.g. "2 of 5")
- Styled to match dark theme: `#262626` bubble, `#C65D24` button, white text, 12px border radius
- Uses React Native `Modal` with `transparent: true` (same pattern as `RmFormModal`)
- Step indicator shows "N of 4"

### 4. Create useCoachMark hook

**New file**: `hooks/useCoachMark.ts`

- Takes a `stepId` string
- Returns `{ ref, onLayout, isHighlighted }`
- Measures the target element's position using `onLayout` + `ref.measure()`
- Reports layout to OnboardingContext via `registerLayout()`
- Re-measures on screen focus (`useFocusEffect`)

### 5. Wire into existing screens

**`app/_layout.tsx`**: Wrap with `<OnboardingProvider>` inside `<UserSettingsProvider>`

**`app/index.tsx`** (steps 0-1):
- `useCoachMark('week-day-selector')` on the WeekDaySelector wrapper
- `useCoachMark('add-exercise-area')` on the bottom section (exercise name input + "Add exercise" button)
- Render `<CoachMark>` when current step targets this screen

**`app/edit-exercise.tsx`** (steps 2-3):
- `useCoachMark('set-input')` on the set input
- `useCoachMark('input-options')` on the input options button

### 6. Skip flow
- Every CoachMark shows a "Skip tour" text link
- Tapping it calls `skipOnboarding()` → sets `onboarding_completed = true` in Supabase
- Overlay disappears instantly, no confirmation dialog

## Implementation order
1. Supabase migration
2. Service layer + types update
3. UserSettingsContext update (expose `onboarding_completed` + `completeOnboarding`)
4. CoachMark component
5. useCoachMark hook
6. OnboardingContext
7. Wire into `_layout.tsx`
8. Wire into `index.tsx`, `edit-exercise.tsx`

## Key files to modify
- `supabase/migrations/` (new migration)
- `apps/mobile/PeakTrack/services/types.ts`
- `apps/mobile/PeakTrack/services/userSettingsService.ts`
- `apps/mobile/PeakTrack/contexts/UserSettingsContext.tsx`
- `apps/mobile/PeakTrack/app/_layout.tsx`
- `apps/mobile/PeakTrack/app/index.tsx`
- `apps/mobile/PeakTrack/app/edit-exercise.tsx`

## New files
- `supabase/migrations/20260312000000_add_onboarding_completed.sql`
- `apps/mobile/PeakTrack/contexts/OnboardingContext.tsx`
- `apps/mobile/PeakTrack/components/CoachMark.tsx`
- `apps/mobile/PeakTrack/hooks/useCoachMark.ts`

## Verification
1. Create a fresh Supabase user → should see coach marks starting on home screen
2. Tap through all 4 steps while actually creating a workout → flow completes naturally
3. Close and reopen app → no onboarding shown (flag is `true` in DB)
4. Test skip button on step 1 → onboarding dismissed, flag saved
5. Run `pnpm typecheck` and `pnpm test` to verify no regressions

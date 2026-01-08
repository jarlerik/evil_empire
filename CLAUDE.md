# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Native/Expo workout tracking app called "kakkahata_88" (display name likely "Evil Empire"). Users can create workouts, add exercises with various set/rep/weight formats, track repetition maximums (RMs), and execute workouts with timers.

## Commands

```bash
# Development
npm start            # Start Expo dev server
npx expo start       # Alternative start command
npm run ios          # Start on iOS simulator
npm run android      # Start on Android emulator

# Testing
npm test             # Run Jest in watch mode
npm test -- --watchAll=false  # Run tests once (CI mode)
npm test -- path/to/file.test.ts  # Run specific test file

# Linting
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix linting issues
```

## Architecture

### Routing (Expo Router - File-based)
- `app/_layout.tsx` - Root layout wrapping with providers (Auth, UserSettings, SafeArea, GestureHandler)
- `app/(auth)/` - Auth group (sign-in, sign-up screens)
- `app/index.tsx` - Main settings/home screen (redirects to auth if not logged in)
- `app/create-workout.tsx` - Create and view workouts by date
- `app/add-exercises.tsx` - Add exercises to a workout
- `app/edit-exercise.tsx` - Edit exercise details
- `app/start-workout.tsx` - Execute workout with timer
- `app/repetition-maximums.tsx` - Manage user's RM values

### State Management
- **AuthContext** (`contexts/AuthContext.tsx`): Supabase authentication (signUp, signIn, signOut, session management)
- **UserSettingsContext** (`contexts/UserSettingsContext.tsx`): User preferences (weight_unit: kg/lbs, user_weight)

### Backend
- **Supabase** (`lib/supabase.ts`): Database and auth client
- Tables: `workouts`, `exercises`, `user_settings`, `exercise_phases`, `repetition_maximums`
- Environment variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Core Library
- **parseSetInput** (`lib/parseSetInput.ts`): Parses exercise input strings into structured data
  - Supports: `4 x 3 @50kg`, `4 x 6 @80%`, `3 x 2 + 2 @50kg` (compound), `3-2-1-1-1 65kg` (wave), `Build to 8RM`, `2x 10, 2-3RIR`, circuits, rest times (`120s`, `2m`)
  - Returns `ParsedSetData` with sets, reps, weight, and specialized fields (wavePhases, compoundReps, circuitExercises, etc.)

## Code Style

From `.cursor/rules/rules.mdc`:
- TypeScript for all code; prefer interfaces over types
- Functional components with hooks; avoid classes
- Named exports for components
- Use `function` keyword for pure functions
- Lowercase with dashes for directories (e.g., `components/auth-wizard`)
- Avoid enums; use maps instead
- Jest + React Native Testing Library for tests

## Testing

Tests are in `__tests__` directories adjacent to source files:
- `lib/__tests__/parseSetInput.test.ts` - Parser unit tests
- `components/__tests__/` - Component tests

## Key Dependencies
- `expo-router` for navigation
- `@supabase/supabase-js` for backend
- `date-fns` for date handling
- `react-native-reanimated` + `react-native-gesture-handler` for animations
- `@react-native-picker/picker` for dropdown selectors

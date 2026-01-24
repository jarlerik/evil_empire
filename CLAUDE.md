# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Turborepo monorepo containing a React Native/Expo workout tracking app called "Evil Empire". Users can create workouts, add exercises with various set/rep/weight formats, track repetition maximums (RMs), and execute workouts with timers.

## Monorepo Structure

```
evil_empire/
├── apps/
│   ├── mobile/              # React Native/Expo mobile app (@evil-empire/mobile)
│   ├── web/                 # Future web app (placeholder)
│   └── docs/                # Future documentation (placeholder)
├── packages/
│   ├── parsers/             # Shared parser logic (@evil-empire/parsers)
│   ├── types/               # Shared TypeScript types (@evil-empire/types)
│   ├── eslint-config/       # Shared ESLint config (@evil-empire/eslint-config)
│   └── typescript-config/   # Shared TS configs (@evil-empire/typescript-config)
├── supabase/                # Database migrations
├── turbo.json               # Turborepo configuration
└── pnpm-workspace.yaml      # pnpm workspace config
```

## Commands

All commands should be run from the repository root directory.

```bash
# Development
pnpm dev:mobile           # Start Expo dev server for mobile app
pnpm start:mobile         # Alternative start command
pnpm build                # Build all packages

# From apps/mobile directory
cd apps/mobile
pnpm start                # Start Expo dev server
pnpm ios                  # Start on iOS simulator
pnpm android              # Start on Android emulator

# Testing
pnpm test                 # Run all tests across monorepo
pnpm test --filter=@evil-empire/parsers  # Run tests for specific package

# Linting
pnpm lint                 # Lint all packages
pnpm lint:fix             # Auto-fix linting issues

# Type checking
pnpm typecheck            # Run TypeScript checks across monorepo
```

## Architecture

### Mobile App (apps/mobile)

#### Routing (Expo Router - File-based)
- `app/_layout.tsx` - Root layout wrapping with providers (Auth, UserSettings, SafeArea, GestureHandler)
- `app/(auth)/` - Auth group (sign-in, sign-up screens)
- `app/index.tsx` - Main settings/home screen (redirects to auth if not logged in)
- `app/create-workout.tsx` - Create and view workouts by date
- `app/add-exercises.tsx` - Add exercises to a workout
- `app/edit-exercise.tsx` - Edit exercise details
- `app/start-workout.tsx` - Execute workout with timer
- `app/repetition-maximums.tsx` - Manage user's RM values

#### State Management
- **AuthContext** (`contexts/AuthContext.tsx`): Supabase authentication (signUp, signIn, signOut, session management)
- **UserSettingsContext** (`contexts/UserSettingsContext.tsx`): User preferences (weight_unit: kg/lbs, user_weight)

#### Backend
- **Supabase** (`lib/supabase.ts`): Database and auth client
- Tables: `workouts`, `exercises`, `user_settings`, `exercise_phases`, `repetition_maximums`
- Environment variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Shared Packages

#### @evil-empire/parsers (packages/parsers)
Pure TypeScript exercise input parser. Parses strings into structured data.
- Supports: `4 x 3 @50kg`, `4 x 6 @80%`, `3 x 2 + 2 @50kg` (compound), `3-2-1-1-1 65kg` (wave), `Build to 8RM`, `2x 10, 2-3RIR`, circuits, rest times (`120s`, `2m`)
- Returns `ParsedSetData` with sets, reps, weight, and specialized fields

Usage in mobile app:
```typescript
import { parseSetInput, ParsedSetData } from '@evil-empire/parsers';
// or via local wrapper: import { parseSetInput } from '../lib/parseSetInput';
```

#### @evil-empire/types (packages/types)
Shared TypeScript type definitions for `Workout`, `Exercise`, and re-exports parser types.

#### @evil-empire/eslint-config (packages/eslint-config)
Shared ESLint configurations:
- `@evil-empire/eslint-config` - Default (React Native)
- `@evil-empire/eslint-config/base` - Base TypeScript rules
- `@evil-empire/eslint-config/react-native` - React Native specific rules

#### @evil-empire/typescript-config (packages/typescript-config)
Shared TypeScript configurations:
- `@evil-empire/typescript-config/base.json` - Base strict config
- `@evil-empire/typescript-config/react-native.json` - For Expo apps
- `@evil-empire/typescript-config/node.json` - For Node.js packages

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
- `packages/parsers/__tests__/` - Parser unit tests (296 tests)
- `apps/mobile/components/__tests__/` - Component tests
- `apps/mobile/contexts/__tests__/` - Context tests
- `apps/mobile/hooks/__tests__/` - Hook tests

## Key Dependencies

- **Monorepo**: Turborepo, pnpm workspaces
- **Mobile**: React Native 0.81.5, Expo ~54, React 19
- **Navigation**: expo-router
- **Backend**: @supabase/supabase-js
- **Date handling**: date-fns
- **Animations**: react-native-reanimated, react-native-gesture-handler
- **Package build**: tsup (for shared packages)

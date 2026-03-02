# Evil Empire - Monorepo to rule them all 

A React Native/Expo workout tracking app built as a Turborepo monorepo. Users can create workouts, add exercises with various set/rep/weight formats, track repetition maximums (RMs), and execute workouts with timers.

## Monorepo Structure

```
evil_empire/
├── apps/
│   ├── mobile/         # React Native/Expo mobile app
│   ├── web/            # Future web app (placeholder)
│   └── docs/           # Future documentation site (placeholder)
├── packages/
│   ├── parsers/        # Shared exercise input parser (@evil-empire/parsers)
│   ├── types/          # Shared TypeScript types (@evil-empire/types)
│   ├── eslint-config/  # Shared ESLint configuration
│   └── typescript-config/  # Shared TypeScript configurations
├── supabase/           # Database migrations
├── turbo.json          # Turborepo configuration
└── pnpm-workspace.yaml # pnpm workspace configuration
```

## Getting Started

### Prerequisites

- Node.js >= 22.x (see `.nvmrc`)
- pnpm >= 9.x

### Installation

```bash
# Install dependencies
pnpm install

# Build shared packages
pnpm build
```

### Development

All commands should be run from the repository root directory.

```bash
# Start mobile app
pnpm dev:mobile

# Or navigate to the mobile app directory
cd apps/mobile
pnpm dev

# Start on iOS simulator
pnpm start:mobile
# Then press 'i' in the terminal

# Start on Android emulator
pnpm start:mobile
# Then press 'a' in the terminal
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm test --filter=@evil-empire/parsers
```

### Linting

```bash
# Lint all packages
pnpm lint

# Auto-fix linting issues
pnpm lint:fix
```

### Building

```bash
# Build all packages
pnpm build

# Build a specific package
pnpm build --filter=@evil-empire/parsers
```

## Packages

### @evil-empire/parsers

Shared exercise input parser that supports various formats:
- Standard: `4 x 3 @50kg`
- Percentage: `4 x 6 @80%`
- Compound: `3 x 2 + 2 @50kg`
- Wave: `3-2-1-1-1 65kg`
- RM Build: `Build to 8RM`
- RIR: `2x 10, 2-3RIR`
- Circuits and rest times

### @evil-empire/types

Shared TypeScript type definitions for workouts, exercises, and parser data structures.

### @evil-empire/eslint-config

Shared ESLint configuration for React Native and base TypeScript projects.

### @evil-empire/typescript-config

Shared TypeScript configurations:
- `base.json` - Base configuration
- `react-native.json` - React Native/Expo projects
- `node.json` - Node.js packages

## Apps

### Mobile App (@evil-empire/mobile)

The main React Native/Expo workout tracking app located in `apps/mobile/`.

Features:
- Create and manage workouts
- Add exercises with flexible input formats
- Track repetition maximums (RMs)
- Execute workouts with built-in timer
- Supabase backend for data persistence

## Environment Variables

Create a `.env` file in the root with:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Mobile**: React Native 0.81.5, Expo ~54, React 19
- **Backend**: Supabase
- **Testing**: Jest, React Native Testing Library
- **Build**: tsup (for packages)

## Learn More

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)

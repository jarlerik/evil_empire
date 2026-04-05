# Evil Empire - Monorepo to rule them all 

## Monorepo Structure

```
evil_empire/
├── apps/
│   ├── mobile/            # React Native/Expo mobile app
│   ├── warrior_trading/   # Automated day-trading bot
│   ├── evil_ui/           # Cross-platform component library & showcase
│   ├── agent/             # Autonomous coding agent
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

### Git Worktree Workflow

  1. Create worktree with feature branch

```bash
    git worktree add .claude/worktrees/my-feature -b feature/my-feature develop
```

  2. Work in the worktree

```bash
    cd .claude/worktrees/my-feature
```

  #### make changes, run tests, etc.

```bash
    git add <files>
    git commit -m "Add feature"
```

  3. Push and create PR

```bash
    git push origin feature/my-feature -u
    gh pr create --base develop --head feature/my-feature --title "My feature"
```

  4. Merge (pick one)

  #### Via GitHub

```bash
    gh pr merge 33 --squash --delete-branch
```

  #### Or locally

```bash
    git checkout develop
    git merge feature/my-feature
    git push origin develop
    git push origin --delete feature/my-feature
```

  5. Once PR accepted and merged clean up worktree

```bash
    cd /path/to/main/repo
    git worktree remove .claude/worktrees/my-feature
```

  #### Useful commands

```bash
    git worktree list                  # list all worktrees
    git worktree prune                 # clean up stale entries
    git branch -d feature/my-feature   # delete local branch after merge
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

### Warrior Trading Bot (@evil-empire/warrior-trading)

An automated day-trading bot located in `apps/warrior_trading/`. Connects to the Alpaca Markets API and executes intraday strategies on US equities.

- **Runtime**: Bun
- **Broker**: Alpaca Markets (paper and live trading)
- **Strategies**: Gap & Go, Bull Flag, Flat Top, MA Pullback, Micro Pullback
- **Risk management**: Per-trade risk limits, max daily loss, consecutive loss circuit breaker
- **Features**: Real-time market scanning, session-aware trading (pre-market/open/close), configurable watchlists
- **Dashboard**: Vite-based visual replay dashboard (`bun run dev:dashboard`)

```bash
# From apps/warrior_trading
bun run dev        # Start live paper/real trading bot
bun run build      # Build for production
```

#### Backtesting

Run a single-symbol backtest over a date range with historical data.

```bash
bun run src/backtest.ts <SYMBOL> <START> <END> [options]

# Options:
#   --equity <number>      Starting equity (default: 25000)
#   --slippage <number>    Slippage ticks (default: 1)
#   --commission <number>  Commission per share (default: 0.005)
#   --dashboard            Open dashboard for visual replay

# Examples:
bun run src/backtest.ts AAPL 2026-01-02 2026-03-31
bun run src/backtest.ts TSLA 2025-06-01 2025-12-31 --equity 50000 --dashboard
```

#### Simulation

Simulate the full scanner + algo pipeline across one or more trading days.

```bash
bun run src/simulation.ts [DATE...] [options]

# Options:
#   --from <date>      Start date for consecutive trading days (use with --days)
#   --days <number>    Number of days to simulate (default: 1)
#   --equity <number>  Starting equity (default: 25000)
#   --dashboard        Open dashboard for visual replay

# Examples:
bun run src/simulation.ts                              # 1 random day
bun run src/simulation.ts 2025-11-15                   # specific date
bun run src/simulation.ts --days 5                     # 5 random days
bun run src/simulation.ts --from 2026-03-01 --days 30  # 30 consecutive trading days
bun run src/simulation.ts --days 10 --equity 50000
```

#### Replay

Feed historical OHLCV data through the strategy pipeline and log all signals (no execution).

```bash
bun run src/replay.ts <SYMBOL> <START_DATE> <END_DATE>

# Example:
bun run src/replay.ts AAPL 2026-03-01 2026-03-31
```

#### Multi-Sim (Optimization)

Run 18+ hardcoded strategy configurations against the same cached data to compare parameter combinations (risk %, trailing stops, time stops, R:R ratios, cooldowns). Outputs a comparison table sorted by profitability.

```bash
bun run src/multi-sim.ts
```

### Evil UI (@evil-empire/ui)

A cross-platform component library located in `apps/evil_ui/`. Exports themed React Native components that work on iOS, Android, and web via `react-native-web`.

- **Styling**: NativeWind v4+ (Tailwind CSS for React Native)
- **Components**: Card, StatCard, Badge, StatusIndicator, ActivityFeed, DataTable, TerminalBlock, SidebarNav, Header, Button, Input, and primitives (Box, Text, Pressable, Icon)
- **Build**: tsup (CJS + ESM output)

```bash
# From apps/evil_ui

# Run the web showcase in browser (Vite dev server on http://localhost:6006)
bun run showcase

# Run the Expo demo on iOS simulator
bun run demo:ios

# Build the component library
bun run build

# Watch mode for development
bun run dev
```

### Agent (@evil-empire/agent)

A CI-style autonomous coding agent located in `apps/agent/`. Polls GitHub issues labeled for automation, spins up a Claude-powered agent to implement the fix or feature, and opens a PR.

- **Runtime**: Bun
- **AI**: Anthropic Claude SDK
- **Tools**: File read/write, bash execution, GitHub API
- **Workflow**: Poll issue → clone repo → create branch → run agent → commit → open PR
- **Features**: Retry with exponential backoff, cost tracking, Telegram notifications, rejected-PR feedback loop (auto-creates retry issues from review comments)

```bash
# From apps/agent
bun run dev          # Start in watch mode
bun run start        # Single run
bun run start --status  # Show weekly stats
```

## Environment Variables

Create a `.env` file in the root with:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Mobile**: React Native 0.81.5, Expo ~54, React 19
- **UI**: NativeWind v4+ (Tailwind CSS for React Native), react-native-web
- **Backend**: Supabase
- **Trading**: Bun, Alpaca Markets API, Vite (dashboard)
- **AI Agent**: Bun, Anthropic Claude SDK
- **Testing**: Jest, React Native Testing Library, Bun test
- **Build**: tsup (packages), Vite (web apps), Bun (trading bot)

## Learn More

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)

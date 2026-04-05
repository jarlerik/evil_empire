# Daily Log 05.04.2026

## Evil UI Component Library — Initial Implementation

Built `@evil-empire/ui`, a shared cross-platform (React Native + Web) component library at `apps/evil_ui/` following the "Tactical Ops" dark design system extracted from the dashboard screenshot.

### What was built

- **Theme system**: Color tokens, typography scale, spacing/radius constants, Tailwind preset for consumers
- **4 primitives**: Box, Text (8 variants), Pressable, Icon
- **13 composite components**: Card, StatCard, StatRow, Badge, StatusIndicator, Button, Input, ActivityFeed, DataTable, TerminalBlock, SidebarNav, Header, SystemStatus
- **Vite showcase** (`pnpm showcase`): Browser preview of all components at localhost:6006
- **Expo demo app** (`apps/evil_ui/expo-demo/`): iPhone/simulator preview via `pnpm demo:ios`
- All components use pure React Native StyleSheet — no NativeWind dependency required
- Package builds cleanly with tsup (CJS + ESM + DTS)

## Warrior Trading Dashboard Facelift

Rebuilt the warrior_trading dashboard from a monolithic vanilla HTML/JS file into a React app using @evil-empire/ui Tactical dark theme components (Badge, StatRow, Card, Button, StatusIndicator). Vite serves the dashboard in dev with HMR and builds static assets for production served by the Bun WebSocket server.

## Warrior Trading: 7 Rounds of Strategy Backtesting

Added 3 new strategies (VWAP Reclaim, VWAP Bounce, ORB) and ran 7 rounds of backtesting (~150 configs) across Jan-Apr 2026 and Oct-Mar 2025-2026. New strategies all failed; ma-pullback remains the only profitable strategy. Best config: risk 0.75%, time stop 15, cooldown 20. Cross-validation revealed Oct-Mar results are sensitive to scanner data changes.

## Merge develop into warrior trading branch

Resolved 26 merge conflicts across 6 files to merge develop's prefetchAllDailyBars optimization with our new strategies and backtesting results.

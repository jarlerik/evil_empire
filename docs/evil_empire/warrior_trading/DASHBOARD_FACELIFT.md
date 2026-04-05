# Warrior Trading Dashboard Facelift

## Context

The warrior_trading dashboard is currently a monolithic `index.html` file (~600 lines) with embedded CSS/JS, vanilla DOM manipulation, and a navy-blue dark theme. The evil_ui package (`@evil-empire/ui`) provides a polished React Native component library with a "Tactical" dark theme (burnt orange accent, near-black backgrounds) that already runs in the browser via `react-native-web` (proven in its Vite-based showcase app).

The goal is to rebuild the dashboard as a React web app using evil_ui components, bringing visual consistency across the evil_empire ecosystem while keeping all existing functionality (WebSocket real-time updates, TradingView charts, backtest controls).

## Approach: React + Vite Dashboard using evil_ui

Convert the vanilla HTML dashboard into a React app served by Vite (dev) and built as static HTML (prod), still served by the existing Bun WebSocket server.

### New directory structure

```
apps/warrior_trading/src/dashboard/
├── index.html              # Keep — minimal HTML shell (Vite entry)
├── server.ts               # Modify — serve Vite build output in prod
├── event-bus.ts            # Keep unchanged
├── types.ts                # Keep unchanged
├── ui/                     # NEW — React dashboard app
│   ├── main.tsx            # Vite entry, renders <App />
│   ├── App.tsx             # Root: WebSocket provider + grid layout
│   ├── hooks/
│   │   └── use-websocket.ts    # WebSocket connection + event dispatch
│   ├── context/
│   │   └── DashboardContext.tsx # Centralized state (risk, position, scanner, trades, session)
│   ├── panels/
│   │   ├── SessionBanner.tsx    # Header bar: mode badge, phase, clock, progress
│   │   ├── ChartPanel.tsx       # TradingView Lightweight Charts wrapper
│   │   ├── RiskPanel.tsx        # Risk stats sidebar section
│   │   ├── PositionPanel.tsx    # Active position sidebar section
│   │   ├── ScannerPanel.tsx     # Scanner results sidebar section
│   │   ├── EquityPanel.tsx      # Equity curve chart
│   │   ├── TradeLog.tsx         # Trade history table
│   │   └── BacktestControls.tsx # Playback controls bar
│   └── components/
│       └── Toast.tsx            # Signal toast notifications (not in evil_ui)
```

### Component mapping (vanilla -> evil_ui)

| Current HTML element | evil_ui component | Notes |
|---|---|---|
| `.mode-badge` | `Badge` (primary/success variant) | LIVE = success, BACKTEST = primary |
| `.phase-dot` + text | `StatusIndicator` | Maps phase to status: open->online, closed->offline, etc. |
| `.halted-badge` | `Badge` (destructive variant) | With pulse animation |
| `.sidebar-section` | `Card` (bordered variant) | Each sidebar panel in a Card |
| `.risk-row` | `StatRow` | label/value pairs with success/danger variants for P&L |
| `.pos-row` | `StatRow` | Position detail rows |
| `.scanner-card` | `Card` + `Badge` for gap% | Small cards within scanner panel |
| `#trade-log table` | `DataTable` | 11-column trade log with custom renderers |
| `#bt-controls button` | `Button` (ghost/primary variants) | Play/pause/step/speed |
| Toast notifications | Custom `Toast` component | Styled with evil_ui tokens |
| Grid layout | CSS Grid with evil_ui `colors` tokens | Keep CSS Grid, apply Tactical palette |

### Theme integration

Replace the current navy-blue CSS variables with evil_ui Tactical tokens:

```
--bg: #1a1a2e       -> colors.background (#0D0D0D)
--card: #16213e     -> colors['background-card'] (#1A1A1A)
--border: #1e2d4a   -> colors.border (#2A2A2A)
--text: #e0e0e0     -> colors.text (#FFFFFF)
--text-dim: #8899aa -> colors['text-secondary'] (#9BA1A6)
--green: #00e676    -> colors.success (#22C55E)
--red: #ff1744      -> colors.destructive (#EF4444)
--amber: #ffab00    -> colors.warning (#F59E0B)
--blue: #2196f3     -> colors.primary (#c65d24, burnt orange)
```

Chart colors also updated to match (candlestick up/down = success/destructive, indicators use primary/warning/text-secondary).

### Implementation steps

1. **Set up Vite + React in `apps/warrior_trading`**
   - Add `react`, `react-dom`, `react-native-web`, `vite`, `@vitejs/plugin-react` as dev deps
   - Create `vite.config.ts` (same pattern as evil_ui showcase -- alias react-native -> react-native-web)
   - Update `index.html` to be a Vite entry point (minimal shell with `<div id="root">` + `<script type="module" src="./ui/main.tsx">`)
   - Add `@evil-empire/ui` as workspace dependency

2. **Build DashboardContext + WebSocket hook**
   - `use-websocket.ts`: Connect to `ws://localhost:3939/ws`, auto-reconnect, parse events, dispatch to context
   - `DashboardContext.tsx`: Holds all dashboard state (session, risk, position, scanner, trades, equity, bars, indicators) with reducer

3. **Build panel components (in order of complexity)**
   - `SessionBanner.tsx` -- Badge + StatusIndicator + clock + progress bar
   - `RiskPanel.tsx` -- Card with StatRow components for P&L, equity, win rate, losses, halted badge
   - `PositionPanel.tsx` -- Card with StatRow components, empty state, flash animation
   - `ScannerPanel.tsx` -- Card with mini-cards for each candidate, Badge for gap%
   - `TradeLog.tsx` -- DataTable with 11 columns, custom P&L renderers (color-coded), footer totals
   - `BacktestControls.tsx` -- Button group for play/pause/step/speed, CSV export
   - `ChartPanel.tsx` -- Wraps TradingView Lightweight Charts in a React component (useRef + useEffect for chart lifecycle)
   - `EquityPanel.tsx` -- Same TradingView wrapper for equity area chart
   - `Toast.tsx` -- Custom toast component using evil_ui tokens

4. **Assemble in App.tsx**
   - CSS Grid layout matching current structure (2 columns, 5 rows)
   - Wrap with DashboardContext provider
   - Wire up WebSocket hook

5. **Update server.ts**
   - In dev: proxy to Vite dev server or serve Vite's dev output
   - In prod: serve built `dist/` static files
   - WebSocket endpoint stays at `/ws`

6. **Add scripts to package.json**
   - `dev:dashboard` -- runs Vite dev server
   - `build:dashboard` -- builds React dashboard to dist/

### What stays the same
- WebSocket protocol and event types (`types.ts`, `event-bus.ts`) -- unchanged
- TradingView Lightweight Charts -- same library, wrapped in React refs
- Backend trading engine -- completely untouched
- All dashboard functionality -- just a visual/architectural rewrite

### What's new from evil_ui
- Tactical dark theme (burnt orange primary instead of blue)
- Consistent component APIs across evil_empire apps
- React component architecture (replaces vanilla DOM)
- Typography system (display/heading/body/caption/mono variants)

## Files to modify
- `apps/warrior_trading/package.json` -- add React/Vite/evil_ui deps
- `apps/warrior_trading/src/dashboard/index.html` -- slim down to Vite entry
- `apps/warrior_trading/src/dashboard/server.ts` -- serve built React app

## Files to create
- `apps/warrior_trading/vite.config.ts`
- `apps/warrior_trading/src/dashboard/ui/main.tsx`
- `apps/warrior_trading/src/dashboard/ui/App.tsx`
- `apps/warrior_trading/src/dashboard/ui/hooks/use-websocket.ts`
- `apps/warrior_trading/src/dashboard/ui/context/DashboardContext.tsx`
- `apps/warrior_trading/src/dashboard/ui/panels/SessionBanner.tsx`
- `apps/warrior_trading/src/dashboard/ui/panels/ChartPanel.tsx`
- `apps/warrior_trading/src/dashboard/ui/panels/RiskPanel.tsx`
- `apps/warrior_trading/src/dashboard/ui/panels/PositionPanel.tsx`
- `apps/warrior_trading/src/dashboard/ui/panels/ScannerPanel.tsx`
- `apps/warrior_trading/src/dashboard/ui/panels/EquityPanel.tsx`
- `apps/warrior_trading/src/dashboard/ui/panels/TradeLog.tsx`
- `apps/warrior_trading/src/dashboard/ui/panels/BacktestControls.tsx`
- `apps/warrior_trading/src/dashboard/ui/components/Toast.tsx`

## Verification
1. Run `pnpm dev` from warrior_trading -- Vite serves dashboard at localhost with HMR
2. Start the trading backend -- WebSocket connects, charts render, data flows
3. Visual check: Tactical dark theme with burnt orange accents, matching evil_ui showcase aesthetic
4. Backtest mode: play/pause/step/speed controls work, progress bar updates
5. Live mode: real-time candle/volume/indicator updates, position open flash, toast signals
6. Trade log populates, footer totals calculate correctly
7. Scanner cards render with gap badges and catalyst indicators

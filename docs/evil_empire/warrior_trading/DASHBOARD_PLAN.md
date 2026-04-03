# Real-Time Trading Dashboard — Implementation Plan

## Overview

A browser-based dashboard served from the bot process itself. A lightweight WebSocket server inside the bot broadcasts structured events to a single-page HTML/JS frontend. The same dashboard works for both **live trading** (real-time Alpaca stream) and **backtest replay** (historical bars played back with speed controls).

The frontend uses [Lightweight Charts](https://github.com/nickvdyck/lightweight-charts) by TradingView for candlestick rendering — zero dependencies, 40KB gzipped, purpose-built for financial data.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Bot Process (Bun)                                  │
│                                                     │
│  Trader / SimTrader                                 │
│       │                                             │
│       ▼                                             │
│  EventBus  ──────────►  DashboardServer             │
│  (typed emitter)        ├─ HTTP  :3939/             │
│                         │  serves index.html        │
│                         └─ WS    :3939/ws           │
│                            broadcasts JSON events   │
└─────────────────────────────────────────────────────┘
         │
         ▼  WebSocket (JSON frames)
┌─────────────────────────────────────────────────────┐
│  Browser (single HTML file)                         │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Candlestick  │  │ Equity Curve │                 │
│  │ + EMA / VWAP │  │              │                 │
│  │ + Markers    │  │              │                 │
│  └──────────────┘  └──────────────┘                 │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Position     │  │ Risk Status  │                 │
│  │ Card         │  │ Panel        │                 │
│  └──────────────┘  └──────────────┘                 │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Trade Log    │  │ Scanner      │                 │
│  │ Table        │  │ Results      │                 │
│  └──────────────┘  └──────────────┘                 │
│  ┌────────────────────────────────┐                 │
│  │ Backtest Playback Controls     │                 │
│  │ [|◀] [▶] [▶▶] [▶▶▶]  Speed   │                 │
│  └────────────────────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

---

## New Files

```
src/
  dashboard/
    event-bus.ts            ← typed event emitter (core glue)
    server.ts               ← Bun HTTP + WebSocket server
    index.html              ← single-file frontend (HTML + CSS + JS)
    types.ts                ← shared event type definitions
```

---

## File-by-File Specification

### 1. `src/dashboard/types.ts` — Event Protocol

Every WebSocket frame is a JSON object with a `type` discriminator. The dashboard receives these and routes them to the appropriate UI panel.

```ts
// ── Bar & Indicator Data ──────────────────────────

interface BarEvent {
  type: "bar";
  symbol: string;
  timestamp: string;          // ISO 8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndicatorEvent {
  type: "indicators";
  symbol: string;
  timestamp: string;
  ema9: number;
  ema20: number;
  ema50: number;
  ema200: number;
  vwap: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  atr: number;
  relativeVolume: number;
}

// ── Strategy & Signals ────────────────────────────

interface SignalEvent {
  type: "signal";
  symbol: string;
  strategy: string;
  confidence: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  reason: string;
  accepted: boolean;          // did risk manager approve?
  rejectionReason?: string;
}

// ── Position & Trade Lifecycle ────────────────────

interface PositionOpenEvent {
  type: "position:open";
  symbol: string;
  strategy: string;
  entryPrice: number;
  shares: number;
  stopPrice: number;
  targetPrice: number;
  timestamp: string;
}

interface PositionUpdateEvent {
  type: "position:update";
  symbol: string;
  currentPrice: number;
  unrealizedPnL: number;
  barsHeld: number;
  highSinceEntry: number;
  trailingStop: number;       // computed trailing stop level
}

interface PositionCloseEvent {
  type: "position:close";
  symbol: string;
  exitPrice: number;
  pnl: number;
  commission: number;         // 0 for live (Alpaca handles), computed for backtest
  barsHeld: number;
  exitReason: string;
  timestamp: string;
}

// ── Risk State ────────────────────────────────────

interface RiskEvent {
  type: "risk";
  dailyPnL: number;
  consecutiveLosses: number;
  tradesCompleted: number;
  tradesWon: number;
  winRate: number;
  isHalted: boolean;
  equity: number;
}

// ── Equity Curve ──────────────────────────────────

interface EquityEvent {
  type: "equity";
  timestamp: string;
  equity: number;
}

// ── Session & Scanner ─────────────────────────────

interface SessionEvent {
  type: "session";
  phase: SessionPhase;
  mode: "live" | "backtest";
  backtestProgress?: number;  // 0–100% (backtest only)
}

interface ScannerEvent {
  type: "scanner";
  candidates: Array<{
    symbol: string;
    gapPct: number;
    price: number;
    relativeVolume: number;
    hasCatalyst: boolean;
    headline: string | null;
    score: number;
  }>;
}

// ── Backtest Control (browser → server) ───────────

interface PlaybackCommand {
  type: "playback";
  action: "play" | "pause" | "step" | "speed";
  speed?: number;             // 1x, 5x, 25x, 100x, max
}

// ── Connection Handshake ──────────────────────────

interface InitEvent {
  type: "init";
  mode: "live" | "backtest";
  symbol: string;
  config: {
    strategies: string[];
    riskPerTradePct: number;
    rrRatio: number;
    trailingStopPct: number;
    timeStopBars: number;
    startingEquity: number;
  };
  // For backtest: date range + total bars for progress tracking
  backtest?: {
    startDate: string;
    endDate: string;
    totalBars: number;
  };
}

type DashboardEvent =
  | BarEvent | IndicatorEvent | SignalEvent
  | PositionOpenEvent | PositionUpdateEvent | PositionCloseEvent
  | RiskEvent | EquityEvent | SessionEvent | ScannerEvent | InitEvent;
```

### 2. `src/dashboard/event-bus.ts` — Typed Event Emitter

A simple typed pub/sub that the Trader (and SimTrader) emit events to. The DashboardServer subscribes and forwards to all connected WebSocket clients.

```ts
import { EventEmitter } from "events";
import type { DashboardEvent, PlaybackCommand } from "./types.js";

class DashboardEventBus extends EventEmitter {
  broadcast(event: DashboardEvent): void {
    this.emit("dashboard:event", event);
  }

  onEvent(handler: (event: DashboardEvent) => void): void {
    this.on("dashboard:event", handler);
  }

  // Backtest playback control (browser → bot)
  sendCommand(cmd: PlaybackCommand): void {
    this.emit("playback:command", cmd);
  }

  onCommand(handler: (cmd: PlaybackCommand) => void): void {
    this.on("playback:command", handler);
  }
}

// Singleton — shared between Trader, Server, and SimTrader
export const dashboardBus = new DashboardEventBus();
```

**Why a singleton?** The Trader, SimTrader, and DashboardServer all live in the same Bun process. A shared bus avoids passing references everywhere. The bus is imported directly where needed.

### 3. `src/dashboard/server.ts` — HTTP + WebSocket Server

Uses Bun's built-in server (no Express needed).

**Responsibilities:**
- Serve `index.html` at `GET /`
- Upgrade `GET /ws` to WebSocket
- On connect: send `InitEvent` with current state (mode, config, symbol)
- On `dashboard:event`: JSON-serialize and broadcast to all connected clients
- On WS message from browser: parse `PlaybackCommand`, forward to event bus
- Graceful shutdown on bot stop

```ts
const PORT = parseInt(Bun.env.DASHBOARD_PORT ?? "3939");

export function startDashboard(initPayload: InitEvent): void {
  const clients = new Set<ServerWebSocket>();

  Bun.serve({
    port: PORT,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        server.upgrade(req);
        return;
      }

      if (url.pathname === "/") {
        return new Response(Bun.file("src/dashboard/index.html"), {
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response("Not found", { status: 404 });
    },

    websocket: {
      open(ws) {
        clients.add(ws);
        ws.send(JSON.stringify(initPayload));
      },
      message(ws, msg) {
        // Parse playback commands from browser
        const cmd = JSON.parse(msg as string);
        if (cmd.type === "playback") {
          dashboardBus.sendCommand(cmd);
        }
      },
      close(ws) {
        clients.delete(ws);
      },
    },
  });

  // Forward all events to connected clients
  dashboardBus.onEvent((event) => {
    const json = JSON.stringify(event);
    for (const ws of clients) {
      ws.send(json);
    }
  });

  console.log(`Dashboard: http://localhost:${PORT}`);
}
```

### 4. `src/dashboard/index.html` — Single-File Frontend

A self-contained HTML file with inline CSS and JS. No build step, no npm, no React. Loads Lightweight Charts from CDN.

**Layout (CSS Grid):**

```
┌──────────────────────────────────┬───────────────────┐
│                                  │  Session & Mode   │
│   Candlestick Chart              │  Risk Status      │
│   (with EMA/VWAP overlays       │  Position Card    │
│    and entry/exit markers)       │                   │
│                                  │                   │
├──────────────────────────────────┤                   │
│   Equity Curve                   │  Scanner Results  │
│                                  │                   │
├──────────────────────────────────┴───────────────────┤
│   Trade Log (scrollable table)                       │
├──────────────────────────────────────────────────────┤
│   Backtest Controls (hidden in live mode)            │
│   [⏮] [▶/⏸] [⏭ Step] Speed: [1x] [5x] [25x] [Max] │
└──────────────────────────────────────────────────────┘
```

**Panel specifications:**

#### A. Candlestick Chart
- TradingView Lightweight Charts candlestick series
- Line series overlays: EMA9 (blue), EMA20 (orange), VWAP (purple, dashed)
- Markers: green △ for entries, red ▽ for exits
- Horizontal price lines: stop (red dashed), target (green dashed) while position is open
- Volume histogram below chart (built into Lightweight Charts)
- Auto-scrolls to latest bar; user can scroll back and it pauses auto-scroll

#### B. Equity Curve
- Lightweight Charts area series (green fill when above starting equity, red when below)
- Updates on each trade close (live) or each bar (backtest)
- Starting equity shown as horizontal baseline

#### C. Position Card
- Shows when a position is open; otherwise shows "No position"
- Fields: symbol, strategy, entry price, current price, unrealized P&L (color-coded), shares, bars held, trailing stop level
- Live-updates on each `position:update` event
- Flashes green/red on open/close

#### D. Risk Status Panel
- Daily P&L (large, color-coded)
- Win rate (with trades won / total)
- Consecutive losses (turns amber ≥2, red at max)
- Halted indicator (red badge if true)
- Current equity

#### E. Trade Log Table
- Columns: #, Time, Symbol, Strategy, Entry, Exit, Shares, P&L, R-Multiple, Bars, Exit Reason
- Rows added on `position:close`
- P&L cells color-coded green/red
- Scrollable, newest on top
- Running totals in footer row

#### F. Scanner Results
- Simple card list of watchlist candidates
- Shows: symbol, gap%, price, RVOL, catalyst badge, score
- Populated on `scanner` event
- Fades out after market open

#### G. Session Banner
- Top bar showing: mode (LIVE / BACKTEST), current session phase, clock (ET)
- Live mode: colored dot (green = open, yellow = pre-market, red = closed)
- Backtest mode: progress bar + "Bar 4,521 / 12,847 (35.2%)"

#### H. Backtest Playback Controls (hidden in live mode)
- Transport: pause, play, step forward (advance 1 bar)
- Speed selector: 1x, 5x, 25x, 100x, Max (no delay)
- Sends `PlaybackCommand` messages over WebSocket to the bot
- Progress slider to scrub to a specific point (stretch goal)

**Styling:**
- Dark theme (matches trading terminal aesthetic)
- Background: `#1a1a2e`
- Cards: `#16213e` with subtle border
- Text: `#e0e0e0`
- Green: `#00e676`, Red: `#ff1744`, Amber: `#ffab00`
- Monospace numbers (tabular-nums for alignment)
- Responsive down to 1200px width

---

## Integration Points — Changes to Existing Code

The goal is to emit events from the Trader without changing its core logic. We instrument by adding `dashboardBus.broadcast()` calls at natural points.

### `src/engine/trader.ts` — Instrument Live Trader

| Location in Trader | Event emitted | When |
|---|---|---|
| `onPreMarket()` after scanner | `scanner` | Watchlist built |
| `evaluateStrategies()` when signal found | `signal` | Every signal (accepted or rejected) |
| `executeSignal()` after fill | `position:open` | Order filled |
| `monitorPosition()` each bar | `position:update` | Every bar while position open |
| `closeOpenPosition()` | `position:close` | Trade completed |
| `onTradeCompleted()` | `risk` + `equity` | After P&L recorded |
| Session phase change | `session` | Phase transition |
| Watchlist `onBar` callback | `bar` + `indicators` | Every bar received |

**Estimated diff:** ~40 lines of `dashboardBus.broadcast(...)` calls added to trader.ts.

### `src/engine/watchlist.ts` — Emit Bar + Indicator Events

Inside the existing `handleBar()` method, after `processBar()` and before notifying strategy callbacks:

```ts
dashboardBus.broadcast({
  type: "bar",
  symbol,
  timestamp: bar.timestamp.toISOString(),
  open: bar.open, high: bar.high, low: bar.low, close: bar.close,
  volume: bar.volume,
});

dashboardBus.broadcast({
  type: "indicators",
  symbol,
  timestamp: bar.timestamp.toISOString(),
  ema9: state.emaValues.ema9,
  ema20: state.emaValues.ema20,
  // ... etc
});
```

### `src/index.ts` — Start Dashboard Server

Before `trader.start()`:

```ts
import { startDashboard } from "./dashboard/server.js";

startDashboard({
  type: "init",
  mode: "live",
  symbol: "—",  // determined after scanner
  config: { ... },
});
```

### Backtest Integration (SimTrader / backtest.ts)

The SimTrader emits the exact same events as the live Trader — the dashboard doesn't know the difference. The only additions:

1. **Playback control:** SimTrader's bar loop listens to `dashboardBus.onCommand()` for pause/play/speed changes. Between bars, it `await`s a delay based on the current speed setting.

2. **Progress tracking:** Each bar emits a `session` event with `backtestProgress` set to `currentBarIndex / totalBars * 100`.

3. **Speed model:**
   - 1x = 1 second per bar (simulates real-time 1-min bars)
   - 5x = 200ms per bar
   - 25x = 40ms per bar
   - 100x = 10ms per bar
   - Max = 0ms (as fast as possible, still emits events for UI)

```ts
// Inside SimTrader bar loop:
for (let i = 0; i < bars.length; i++) {
  if (this.paused) await this.waitForResume();

  procesBar(bars[i]);
  emitAllEvents();

  if (this.speed !== "max") {
    await Bun.sleep(this.delayMs);
  }
}
```

---

## Implementation Order

### Phase 1 — Event Bus + Server Skeleton
1. `dashboard/types.ts` — define all event interfaces
2. `dashboard/event-bus.ts` — singleton typed emitter
3. `dashboard/server.ts` — Bun HTTP + WS server
4. Smoke test: start server, connect from browser, verify WS handshake

### Phase 2 — Instrument Live Trader
5. Add `dashboardBus.broadcast()` calls to `trader.ts` and `watchlist.ts`
6. Wire up `startDashboard()` in `index.ts`
7. Test: run bot in paper mode, open browser, verify events stream in DevTools

### Phase 3 — Frontend Core
8. Build `index.html` — layout, dark theme CSS, WebSocket connection
9. Candlestick chart with Lightweight Charts (bar events → chart updates)
10. EMA + VWAP overlay lines (indicator events → line series)
11. Entry/exit markers on chart (position events → markers)
12. Volume histogram

### Phase 4 — Dashboard Panels
13. Position card (open/update/close events)
14. Risk status panel (risk events)
15. Trade log table (position:close events, running totals)
16. Equity curve (equity events → area chart)
17. Session banner + clock
18. Scanner results panel

### Phase 5 — Backtest Playback
19. Add playback command handling to SimTrader bar loop
20. Playback controls UI (pause/play/step/speed)
21. Progress bar for backtest mode
22. Verify full backtest replay renders correctly in dashboard

### Phase 6 — Polish
23. Auto-reconnect WebSocket on disconnect
24. Responsive layout refinements
25. Keyboard shortcuts (space = pause/play, → = step, +/- = speed)
26. Export trade log as CSV from browser

---

## Config

One new env variable:

```
DASHBOARD_PORT=3939        # default 3939
DASHBOARD_ENABLED=true     # default true; set false to disable
```

No new npm dependencies. Lightweight Charts loaded from CDN in the HTML file:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/lightweight-charts/4.1.3/lightweight-charts.standalone.production.js"></script>
```

---

## Changes Summary

| File | Type of change | Size |
|---|---|---|
| `src/dashboard/types.ts` | **New** | ~120 lines |
| `src/dashboard/event-bus.ts` | **New** | ~30 lines |
| `src/dashboard/server.ts` | **New** | ~60 lines |
| `src/dashboard/index.html` | **New** | ~800–1000 lines |
| `src/engine/trader.ts` | Instrument | +40 lines |
| `src/engine/watchlist.ts` | Instrument | +15 lines |
| `src/index.ts` | Wire up server | +10 lines |
| `src/backtest.ts` (or SimTrader) | Playback control | +30 lines |
| `src/config.ts` | Add dashboard config | +5 lines |
| `package.json` | Add `"dashboard"` script note | +1 line |

**Total new code:** ~1,200 lines, of which ~800 is the HTML/CSS/JS frontend.
**Total changes to existing code:** ~100 lines of non-breaking additions.

---

## Event Flow Examples

### Live Trading — Signal Rejected

```
[bar]              → chart adds candle
[indicators]       → chart updates EMA/VWAP lines
[signal]           → signal toast appears (amber: "gap-and-go 72 conf — rejected: 2 consecutive losses")
```

### Live Trading — Full Trade Lifecycle

```
[bar]              → chart adds candle
[signal]           → signal toast (green: "bull-flag 81 conf — ACCEPTED")
[position:open]    → position card appears, chart adds entry marker + stop/target lines
[bar] × N          → candles accumulate
[position:update]  → position card updates unrealized P&L, trailing stop adjusts
[position:close]   → position card clears, chart adds exit marker, trade log row added
[risk]             → risk panel updates daily P&L, win rate
[equity]           → equity curve extends
```

### Backtest — Playback

```
User clicks [▶]
[session]          → banner shows "BACKTEST — Bar 0 / 12,847 (0%)"
[bar] [indicators] → chart builds rapidly at 25x speed
...
User clicks [⏸]   → loop pauses
User clicks [⏭]   → single bar advances
User changes to 100x, clicks [▶]
...
[session]          → "BACKTEST — Complete — 47 trades"
                   → all panels show final state
```

---

## Task List

### Phase 1 — Event Bus + Server Skeleton

- [ ] **1.1** Create `src/dashboard/types.ts` — define all event interfaces (`BarEvent`, `IndicatorEvent`, `SignalEvent`, `PositionOpenEvent`, `PositionUpdateEvent`, `PositionCloseEvent`, `RiskEvent`, `EquityEvent`, `SessionEvent`, `ScannerEvent`, `InitEvent`, `PlaybackCommand`, `DashboardEvent` union type). Export all types.
- [ ] **1.2** Create `src/dashboard/event-bus.ts` — `DashboardEventBus` class extending `EventEmitter` with typed `broadcast()`, `onEvent()`, `sendCommand()`, `onCommand()` methods. Export singleton `dashboardBus`.
- [ ] **1.3** Create `src/dashboard/server.ts` — `startDashboard(initPayload)` function using `Bun.serve()`. Serve `index.html` at `/`, upgrade `/ws` to WebSocket. On connect send `InitEvent`. Forward `dashboard:event` bus events to all WS clients. Parse incoming `PlaybackCommand` messages and forward to bus. Port from `DASHBOARD_PORT` env (default `3939`).
- [ ] **1.4** Add `DASHBOARD_PORT` and `DASHBOARD_ENABLED` to `src/config.ts` (defaults: `3939`, `true`).
- [ ] **1.5** Smoke test: start server standalone, open `http://localhost:3939` in browser, verify WS handshake in DevTools Network tab. Send a test event from server, confirm it arrives in browser console.

### Phase 2 — Instrument Live Trader

- [ ] **2.1** In `src/engine/watchlist.ts` — import `dashboardBus`. Inside `handleBar()`, after `processBar()` and before notifying `onBarCallbacks`, emit `bar` event and `indicators` event with full snapshot data.
- [ ] **2.2** In `src/engine/trader.ts` — import `dashboardBus`. Add emit calls at these locations:
  - `onPreMarket()` after `runScanner()` returns → emit `scanner` event with watchlist entries
  - `evaluateStrategies()` when a signal is found (accepted or rejected) → emit `signal` event
  - `executeSignal()` after order filled → emit `position:open` event
  - `monitorPosition()` on each bar → emit `position:update` event with current price, unrealized P&L, bars held, trailing stop
  - `closeOpenPosition()` → emit `position:close` event with exit price, P&L, exit reason
  - After `riskManager.onTradeCompleted()` → emit `risk` event and `equity` event
- [ ] **2.3** In `src/engine/trader.ts` — hook `SessionTimer` phase changes to emit `session` event with current phase and `mode: "live"`.
- [ ] **2.4** In `src/index.ts` — import `startDashboard`. Before `trader.start()`, call `startDashboard()` with `InitEvent` containing mode, config values, and placeholder symbol. Guard with `DASHBOARD_ENABLED` config check.
- [ ] **2.5** Add `"dashboard"` script to `package.json`: `"dev:dashboard": "bun run src/index.ts"` (or note in existing `dev` script that dashboard starts automatically).
- [ ] **2.6** Test: run bot in paper mode during market hours, open browser to `http://localhost:3939/ws`, verify bar, indicator, session, and scanner events stream as JSON in DevTools.

### Phase 3 — Frontend Core

- [ ] **3.1** Create `src/dashboard/index.html` — base HTML structure with dark theme CSS grid layout (header banner, main chart area, sidebar, bottom panels, playback bar). Include Lightweight Charts CDN script tag. Establish WebSocket connection to `ws://localhost:3939/ws`. Parse incoming JSON, route by `event.type` to handler functions.
- [ ] **3.2** Candlestick chart — initialize `createChart()` with dark theme options. Create candlestick series. On `bar` event, call `series.update()` with OHLC data. Handle time conversion (ISO → UTC timestamp for Lightweight Charts). Enable auto-scroll to latest bar.
- [ ] **3.3** Volume histogram — add histogram series below candlestick chart. Color bars green (close > open) or red (close < open). Update on each `bar` event.
- [ ] **3.4** EMA overlays — create 3 line series (EMA9 blue `#2196f3`, EMA20 orange `#ff9800`, VWAP purple `#ab47bc` dashed). On `indicators` event, update each line series with new data point.
- [ ] **3.5** Entry/exit markers — on `position:open` event, add green upward triangle marker on candlestick series at entry bar. On `position:close` event, add red downward triangle marker at exit bar. While position is open, draw horizontal price lines for stop (red dashed) and target (green dashed) using `createPriceLine()`. Remove price lines on `position:close`.
- [ ] **3.6** Test: run bot with dashboard, verify chart renders candles, EMAs track correctly, volume histogram updates, and markers appear on trade events.

### Phase 4 — Dashboard Panels

- [ ] **4.1** Session banner (top bar) — show mode badge ("LIVE" green / "BACKTEST" blue), current session phase with colored dot (green=open, yellow=pre-market, red=closed/halted), ET clock updated every second. On `init` event set mode. On `session` event update phase and progress. In backtest mode, show progress bar and "Bar X / Y (Z%)".
- [ ] **4.2** Position card (sidebar) — default state "No position" dimmed. On `position:open`: show symbol, strategy name, entry price, shares, stop, target. On `position:update`: update current price, unrealized P&L (green/red), bars held, trailing stop level. Flash card border green on open. On `position:close`: flash red/green based on P&L, then fade back to "No position" after 2s.
- [ ] **4.3** Risk status panel (sidebar) — show daily P&L (large font, color-coded), equity, win rate as "X / Y (Z%)", consecutive losses (amber at ≥2, red at max from config), halted badge (red pulsing if true). Update on each `risk` event.
- [ ] **4.4** Trade log table (bottom panel) — columns: `#`, `Time`, `Symbol`, `Strategy`, `Entry`, `Exit`, `Shares`, `P&L`, `R-Multiple`, `Bars Held`, `Exit Reason`. Add row on each `position:close` event. P&L cell green/red. Newest row on top. Scrollable container with max-height. Footer row with running totals (total P&L, avg R, total trades, win rate).
- [ ] **4.5** Equity curve (below candlestick chart) — create second Lightweight Charts instance with area series. Green fill above starting equity baseline, red below. Add data point on each `equity` event. Show starting equity as horizontal price line.
- [ ] **4.6** Scanner results panel (sidebar, below risk) — render card for each candidate on `scanner` event. Show: symbol (bold), gap% badge, price, RVOL multiplier, catalyst indicator (green dot or dash), score. Cards stack vertically. Fade opacity after market open session event.
- [ ] **4.7** Signal toast notifications — on `signal` event, show brief toast overlay on chart. Green border if accepted, amber if rejected. Show: strategy name, confidence, entry price, rejection reason if applicable. Auto-dismiss after 3s. Stack if multiple arrive quickly.
- [ ] **4.8** Test: verify all panels update correctly during a live paper trading session or by sending mock events via a test script.

### Phase 5 — Backtest Playback

- [ ] **5.1** In backtest entry point (`src/backtest.ts` or SimTrader), import `dashboardBus` and `startDashboard`. Before bar loop: call `startDashboard()` with `mode: "backtest"`, symbol, config, and `backtest: { startDate, endDate, totalBars }`.
- [ ] **5.2** Add playback state to SimTrader bar loop — `paused: boolean`, `speed: number` (delay ms), `stepRequested: boolean`. Listen to `dashboardBus.onCommand()`: on `play` set `paused = false`, on `pause` set `paused = true`, on `step` set `stepRequested = true` and resolve pause, on `speed` update delay mapping (`1x=1000ms, 5x=200ms, 25x=40ms, 100x=10ms, max=0ms`).
- [ ] **5.3** Wrap bar loop body: at top of each iteration, check `if (paused && !stepRequested) await waitForResume()`. After processing bar, `if (stepRequested) { paused = true; stepRequested = false; }`. Apply `await Bun.sleep(delayMs)` if speed !== max.
- [ ] **5.4** Emit `session` event with `backtestProgress` on every Nth bar (every bar at slow speeds, every 10th at max speed to avoid flooding).
- [ ] **5.5** Emit same `bar`, `indicators`, `signal`, `position:*`, `risk`, `equity` events from SimTrader loop — identical to live Trader instrumentation from Phase 2.
- [ ] **5.6** In `index.html` — add playback controls bar (hidden when `mode === "live"`). Buttons: pause `⏸`, play `▶`, step `⏭`. Speed buttons: `1x`, `5x`, `25x`, `100x`, `Max` (highlight active). On click, send `PlaybackCommand` JSON over WebSocket. Update progress bar width from `session.backtestProgress`.
- [ ] **5.7** Start backtest in paused state so user can see the dashboard load before playback begins. Show "Ready — press Play to start" in session banner.
- [ ] **5.8** Test: run `bun run src/backtest.ts AAPL 2026-01-02 2026-03-31`, open dashboard, verify playback controls work (pause, play, step, speed changes). Verify chart builds up bar by bar. Verify all panels populate correctly. Verify backtest completes and final stats display.

### Phase 6 — Polish & QoL

- [ ] **6.1** Auto-reconnect WebSocket in browser — on `ws.onclose`, attempt reconnect with exponential backoff (1s, 2s, 4s, max 10s). Show "Disconnected — reconnecting..." banner. On reconnect, clear chart and request fresh `init` event.
- [ ] **6.2** Keyboard shortcuts — `Space` = toggle pause/play, `→` (right arrow) = step forward, `+`/`=` = increase speed, `-` = decrease speed. Only active when backtest mode. Show shortcut hints in playback bar tooltip.
- [ ] **6.3** Responsive layout — test at 1200px, 1440px, 1920px widths. Sidebar collapses below chart on narrow screens. Chart maintains minimum height of 400px.
- [ ] **6.4** Export trade log — add "Export CSV" button in trade log footer. On click, generate CSV from trade log data in memory and trigger browser download.
- [ ] **6.5** Run existing test suite (`bun test`) to verify no regressions from instrumentation changes in `trader.ts`, `watchlist.ts`, `index.ts`, `config.ts`.
- [ ] **6.6** Final integration test: run full backtest with dashboard open, verify no console errors in browser, all panels render, playback controls responsive, equity curve complete at end.

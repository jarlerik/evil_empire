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

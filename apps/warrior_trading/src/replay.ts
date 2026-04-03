/**
 * Backtest / Replay harness for warrior_trading.
 *
 * Usage:
 *   bun run apps/warrior_trading/src/replay.ts \
 *     --symbol AAPL --startDate 2025-01-01 --endDate 2025-03-31 \
 *     --file bars.json
 *
 * Starts a dashboard server, then replays historical bars with full
 * playback controls (pause / play / step / speed).
 */

import { parseArgs } from "util";
import { startDashboard } from "./dashboard/server.js";
import { dashboardBus } from "./dashboard/event-bus.js";
import type { BarEvent } from "./dashboard/types.js";

// ── CLI args ────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    symbol: { type: "string", default: "UNKNOWN" },
    startDate: { type: "string", default: "" },
    endDate: { type: "string", default: "" },
    file: { type: "string", default: "" },
  },
  strict: false,
});

const symbol = args.symbol as string;
const startDate = args.startDate as string;
const endDate = args.endDate as string;
const barsFile = args.file as string;

if (!barsFile) {
  console.error("Usage: bun run replay.ts --symbol SYM --startDate YYYY-MM-DD --endDate YYYY-MM-DD --file bars.json");
  process.exit(1);
}

// ── Load bars ───────────────────────────────────────────────────────────────

interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const raw = await Bun.file(barsFile).text();
const bars: Bar[] = JSON.parse(raw);

if (bars.length === 0) {
  console.error("No bars loaded from", barsFile);
  process.exit(1);
}

console.log(`Loaded ${bars.length} bars for ${symbol}`);

// ── Start dashboard ─────────────────────────────────────────────────────────

startDashboard({
  type: "init",
  mode: "backtest",
  symbol,
  config: {
    strategies: ["all"],
    riskPerTradePct: 1.5,
    rrRatio: 2,
    trailingStopPct: 1.5,
    timeStopBars: 5,
    startingEquity: 25000,
  },
  backtest: {
    startDate,
    endDate,
    totalBars: bars.length,
  },
});

// ── Playback state ──────────────────────────────────────────────────────────

let paused = true; // Start paused so user can open dashboard first
let speed = 5; // Default 5x
let stepRequested = false;
let resolveResume: (() => void) | null = null;

const speedToDelay: Record<number, number> = {
  1: 1000,
  5: 200,
  25: 40,
  100: 10,
  0: 0, // max speed
};

function waitForResume(): Promise<void> {
  return new Promise((resolve) => {
    resolveResume = resolve;
  });
}

dashboardBus.onCommand((cmd) => {
  switch (cmd.action) {
    case "play":
      paused = false;
      resolveResume?.();
      resolveResume = null;
      break;
    case "pause":
      paused = true;
      break;
    case "step":
      stepRequested = true;
      if (paused) {
        resolveResume?.();
        resolveResume = null;
      }
      break;
    case "speed":
      speed = cmd.speed ?? 5;
      break;
  }
});

// ── Backtest state ──────────────────────────────────────────────────────────

let equity = 25000;
let dailyPnL = 0;
let tradesCompleted = 0;
let tradesWon = 0;
let consecutiveLosses = 0;

// Progress emission interval: emit roughly 100 session updates over the run
const progressInterval = Math.max(1, Math.floor(bars.length / 100));

// ── Emit initial session event (pre-market / paused) ────────────────────────

dashboardBus.broadcast({
  type: "session",
  phase: "pre-market",
  mode: "backtest",
  backtestProgress: 0,
});

console.log("Replay paused. Open the dashboard and press Play to begin.");

// ── Bar loop ────────────────────────────────────────────────────────────────

for (let i = 0; i < bars.length; i++) {
  // ── Playback control: wait while paused ──
  if (paused && !stepRequested) {
    await waitForResume();
  }

  const bar = bars[i];

  // ── Emit bar event ──
  const barEvent: BarEvent = {
    type: "bar",
    symbol,
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  };
  dashboardBus.broadcast(barEvent);

  // ── Emit equity snapshot ──
  dashboardBus.broadcast({
    type: "equity",
    timestamp: bar.timestamp,
    equity,
  });

  // ── Emit risk state ──
  dashboardBus.broadcast({
    type: "risk",
    dailyPnL,
    consecutiveLosses,
    tradesCompleted,
    tradesWon,
    winRate: tradesCompleted > 0 ? tradesWon / tradesCompleted : 0,
    isHalted: false,
    equity,
  });

  // ── Emit session progress ──
  if (i % progressInterval === 0 || i === bars.length - 1) {
    dashboardBus.broadcast({
      type: "session",
      phase: "open",
      mode: "backtest",
      backtestProgress: Math.round((i / bars.length) * 100),
    });
  }

  // ── Step mode: pause after processing one bar ──
  if (stepRequested) {
    paused = true;
    stepRequested = false;
  }

  // ── Speed delay ──
  const delayMs = speedToDelay[speed] ?? 200;
  if (delayMs > 0) {
    await Bun.sleep(delayMs);
  }
}

// ── Final session event ─────────────────────────────────────────────────────

dashboardBus.broadcast({
  type: "session",
  phase: "closed",
  mode: "backtest",
  backtestProgress: 100,
});

console.log(`\nReplay complete. ${bars.length} bars processed.`);
console.log(`Final equity: $${equity.toFixed(2)}`);
console.log("Dashboard still running. Press Ctrl+C to exit.");

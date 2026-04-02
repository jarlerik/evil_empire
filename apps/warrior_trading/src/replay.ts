/**
 * Bar Replay Harness (Phase 8.0)
 *
 * Feeds historical OHLCV data through the strategy pipeline offline
 * and logs all signals to stdout + a JSON file.
 *
 * Usage: bun run src/replay.ts AAPL 2026-03-01 2026-03-31
 */

import { loadConfig } from "./config.js";
import { createAlpacaClient } from "./alpaca/client.js";
import { getBars } from "./alpaca/market-data.js";
import {
  createMultiEMA,
  updateMultiEMA,
} from "./indicators/ema.js";
import { createVWAP, updateVWAP, resetVWAP } from "./indicators/vwap.js";
import { createMACD, updateMACD } from "./indicators/macd.js";
import { createATR, updateATR } from "./indicators/atr.js";
import { gapAndGo } from "./strategies/gap-and-go.js";
import { microPullback } from "./strategies/micro-pullback.js";
import { bullFlag } from "./strategies/bull-flag.js";
import { flatTop } from "./strategies/flat-top.js";
import { maPullback } from "./strategies/ma-pullback.js";
import type { Strategy, StrategySignal, IndicatorSnapshot } from "./strategies/types.js";
import type { Bar } from "./utils/bar.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("replay");

const ALL_STRATEGIES: Strategy[] = [
  gapAndGo,
  microPullback,
  bullFlag,
  flatTop,
  maPullback,
];

interface ReplaySignal {
  timestamp: string;
  symbol: string;
  strategy: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  confidence: number;
  reason: string;
}

async function replay(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<ReplaySignal[]> {
  const config = loadConfig();
  const client = createAlpacaClient(config);

  log.info("Fetching historical bars", { symbol, startDate, endDate });

  const barsMap = await getBars(client, [symbol], "1Min", {
    start: new Date(startDate).toISOString(),
    end: new Date(endDate).toISOString(),
    limit: 10000,
  });

  const bars = barsMap.get(symbol);
  if (!bars || bars.length === 0) {
    log.warn("No bars found", { symbol });
    return [];
  }

  log.info("Bars loaded", { count: bars.length });

  // Initialize indicators
  const ema = createMultiEMA();
  const vwap = createVWAP();
  const macd = createMACD();
  const atr = createATR();

  const signals: ReplaySignal[] = [];
  const recentBars: Bar[] = [];
  let currentDay = "";
  let premarketHigh = 0;

  for (const bar of bars) {
    const day = bar.timestamp.toISOString().slice(0, 10);

    // Reset VWAP on new day
    if (day !== currentDay) {
      resetVWAP(vwap);
      premarketHigh = bar.high;
      currentDay = day;
    }

    // Update indicators
    const emaValues = updateMultiEMA(ema, bar.close);
    const vwapValue = updateVWAP(vwap, bar);
    const macdValues = updateMACD(macd, bar.close);
    const atrValue = updateATR(atr, bar);

    recentBars.push(bar);
    if (recentBars.length > 50) recentBars.shift();

    premarketHigh = Math.max(premarketHigh, bar.high);

    // Need at least 10 bars before evaluating
    if (recentBars.length < 10) continue;

    const snapshot: IndicatorSnapshot = {
      bars: [...recentBars],
      ema: { ...emaValues },
      vwap: vwapValue,
      macd: { ...macdValues },
      atr: atrValue,
      relativeVolume: 5, // assume high RVOL for replay
      premarketHigh,
    };

    // Run all strategies
    for (const strategy of ALL_STRATEGIES) {
      const signal = strategy.evaluate(symbol, snapshot);
      if (signal) {
        const entry: ReplaySignal = {
          timestamp: bar.timestamp.toISOString(),
          symbol: signal.symbol,
          strategy: signal.strategy,
          entryPrice: signal.entryPrice,
          stopPrice: signal.stopPrice,
          targetPrice: signal.targetPrice,
          confidence: signal.confidence,
          reason: signal.reason,
        };
        signals.push(entry);

        log.info(`SIGNAL: ${signal.strategy}`, {
          time: bar.timestamp.toISOString(),
          entry: signal.entryPrice.toFixed(2),
          stop: signal.stopPrice.toFixed(2),
          target: signal.targetPrice.toFixed(2),
          confidence: signal.confidence,
          reason: signal.reason,
        });
      }
    }
  }

  return signals;
}

// CLI entry point
const [symbol, startDate, endDate] = Bun.argv.slice(2);

if (!symbol || !startDate || !endDate) {
  console.log("Usage: bun run src/replay.ts <SYMBOL> <START_DATE> <END_DATE>");
  console.log("Example: bun run src/replay.ts AAPL 2026-03-01 2026-03-31");
  process.exit(1);
}

replay(symbol, startDate, endDate)
  .then(async (signals) => {
    log.info("Replay complete", { totalSignals: signals.length });

    if (signals.length > 0) {
      const outFile = `replay-${symbol}-${startDate}-${endDate}.json`;
      await Bun.write(outFile, JSON.stringify(signals, null, 2));
      log.info(`Signals written to ${outFile}`);
    }
  })
  .catch((err) => {
    log.error("Replay failed", { error: String(err) });
    process.exit(1);
  });

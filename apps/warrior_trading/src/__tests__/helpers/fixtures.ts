import type { Bar } from "../../utils/bar.js";
import type { IndicatorSnapshot, StrategySignal } from "../../strategies/types.js";
import type { MultiEMAValues } from "../../indicators/ema.js";
import type { MACDValues } from "../../indicators/macd.js";
import type { Config } from "../../config.js";

export function makeBar(overrides: Partial<Bar> = {}): Bar {
  return {
    timestamp: new Date("2026-01-15T10:00:00Z"),
    open: 10,
    high: 11,
    low: 9.5,
    close: 10.5,
    volume: 100_000,
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<IndicatorSnapshot> = {}
): IndicatorSnapshot {
  return {
    bars: [makeBar()],
    ema: { ema9: 10, ema20: 9.8, ema50: 9.5, ema200: 9.0 },
    vwap: 10.2,
    macd: { macd: 0.1, signal: 0.05, histogram: 0.05 },
    atr: 0.5,
    relativeVolume: 3,
    premarketHigh: 10.8,
    premarketLow: 9.2,
    ...overrides,
  };
}

export function makeSignal(
  overrides: Partial<StrategySignal> = {}
): StrategySignal {
  return {
    strategy: "gap-and-go",
    symbol: "TEST",
    side: "buy",
    entryPrice: 10,
    stopPrice: 9,
    targetPrice: 12,
    confidence: 70,
    reason: "test signal",
    ...overrides,
  };
}

export function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    alpaca: { keyId: "test", secretKey: "test", paper: true },
    scanner: {
      minGapPct: 5,
      prefGapPct: 20,
      minPrice: 1,
      maxPrice: 20,
      maxFloat: 20_000_000,
      minRelVolume: 5,
    },
    risk: {
      rrRatio: 2,
      riskPerTradePct: 1.5,
      maxDailyLossPct: 10,
      maxConsecLosses: 3,
    },
    trading: {
      timeStopBars: 5,
      trailingStopPct: 1.5,
      strategies: [
        "gap-and-go",
        "bull-flag",
        "flat-top",
        "ma-pullback",
        "micro-pullback",
      ],
    },
    ...overrides,
  } as Config;
}

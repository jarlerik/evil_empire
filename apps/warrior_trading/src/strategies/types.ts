import type { StrategyName } from "../config.js";
import type { Bar } from "../utils/bar.js";
import type { MultiEMAValues } from "../indicators/ema.js";
import type { MACDValues } from "../indicators/macd.js";

export interface StrategySignal {
  strategy: StrategyName;
  symbol: string;
  side: "buy";
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  confidence: number; // 0–100
  reason: string;
}

// Indicator snapshot passed to every strategy evaluate() call
export interface IndicatorSnapshot {
  bars: Bar[]; // recent bars, newest last
  ema: MultiEMAValues;
  vwap: number;
  macd: MACDValues;
  atr: number;
  relativeVolume: number;
  premarketHigh: number;
  premarketLow: number;
}

export interface Strategy {
  name: StrategyName;
  evaluate(symbol: string, snapshot: IndicatorSnapshot): StrategySignal | null;
}

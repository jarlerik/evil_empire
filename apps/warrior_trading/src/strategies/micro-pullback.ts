import type { Strategy, IndicatorSnapshot, StrategySignal } from "./types.js";
import { isBullish, isBearish, barBodySize, barRange } from "../utils/bar.js";

// Micro Pullback: after a strong momentum surge, price pulls back
// with a tiny red candle (small body, low volume), then makes a new high.
// Entry: above the high of the pullback candle
// Stop: below the low of the pullback candle
// Target: 2:1+ R:R

export const microPullback: Strategy = {
  name: "micro-pullback",

  evaluate(symbol: string, snap: IndicatorSnapshot): StrategySignal | null {
    const bars = snap.bars;
    if (bars.length < 4) return null;

    const curr = bars[bars.length - 1];
    const pullback = bars[bars.length - 2];
    const surge = bars[bars.length - 3];

    // Must be above VWAP and 9 EMA
    if (curr.close < snap.vwap) return null;
    if (curr.close < snap.ema.ema9) return null;

    // Surge bar: strong bullish with large body
    if (!isBullish(surge)) return null;
    const surgeRange = barRange(surge);
    if (surgeRange === 0) return null;
    if (barBodySize(surge) / surgeRange < 0.6) return null;

    // Pullback bar: small red candle (tiny body relative to surge)
    if (!isBearish(pullback)) return null;
    if (barBodySize(pullback) > barBodySize(surge) * 0.3) return null;

    // Pullback should have lower volume than surge
    if (pullback.volume > surge.volume * 0.7) return null;

    // Current bar: must be making a new high above pullback high
    if (curr.high <= pullback.high) return null;
    if (!isBullish(curr)) return null;

    const entryPrice = pullback.high;
    const stopPrice = pullback.low;
    const stopDistance = entryPrice - stopPrice;
    if (stopDistance <= 0) return null;

    const targetPrice = entryPrice + stopDistance * 2;

    let confidence = 55;
    if (snap.relativeVolume >= 5) confidence += 10;
    if (snap.macd.histogram > 0) confidence += 10;
    if (curr.volume > pullback.volume * 1.5) confidence += 10;
    if (snap.ema.ema9 > snap.ema.ema20) confidence += 5;
    confidence = Math.min(confidence, 100);

    return {
      strategy: "micro-pullback",
      symbol,
      side: "buy",
      entryPrice,
      stopPrice,
      targetPrice,
      confidence,
      reason: `Micro pullback after surge, entry above $${entryPrice.toFixed(2)}`,
    };
  },
};

import type { Strategy, IndicatorSnapshot, StrategySignal } from "./types.js";
import { isBullish } from "../utils/bar.js";
import { isBullishMarubozu } from "../indicators/candlestick/single.js";

// Gap and Go: stock gaps up in pre-market, consolidates briefly,
// then breaks above the pre-market high on volume.
// Entry: breakout above pre-market high or bull flag high
// Stop: below the consolidation low or VWAP
// Target: 2:1+ R:R based on stop distance

export const gapAndGo: Strategy = {
  name: "gap-and-go",

  evaluate(symbol: string, snap: IndicatorSnapshot): StrategySignal | null {
    const bars = snap.bars;
    if (bars.length < 3) return null;

    const curr = bars[bars.length - 1];
    const prev = bars[bars.length - 2];

    // Must be above VWAP
    if (curr.close < snap.vwap) return null;

    // Must have strong relative volume
    if (snap.relativeVolume < 2) return null;

    // Price must be breaking above pre-market high
    if (curr.high <= snap.premarketHigh) return null;

    // Current bar should be bullish with decent volume
    if (!isBullish(curr)) return null;
    if (curr.volume < prev.volume * 1.2) return null;

    // Entry at pre-market high breakout
    const entryPrice = snap.premarketHigh;
    let minLow = bars[bars.length - 1].low;
    for (let i = bars.length - 2; i >= bars.length - 3 && i >= 0; i--) {
      if (bars[i].low < minLow) minLow = bars[i].low;
    }
    const stopPrice = Math.min(snap.vwap, minLow);
    const stopDistance = entryPrice - stopPrice;
    if (stopDistance <= 0) return null;

    const targetPrice = entryPrice + stopDistance * 2;

    // Confidence scoring
    let confidence = 50;
    if (isBullishMarubozu(curr)) confidence += 15;
    if (snap.relativeVolume >= 5) confidence += 10;
    if (snap.ema.ema9 > snap.ema.ema20) confidence += 10;
    if (snap.macd.histogram > 0) confidence += 10;
    confidence = Math.min(confidence, 100);

    return {
      strategy: "gap-and-go",
      symbol,
      side: "buy",
      entryPrice,
      stopPrice,
      targetPrice,
      confidence,
      reason: `Breakout above premarket high $${snap.premarketHigh.toFixed(2)}, RVOL ${snap.relativeVolume.toFixed(1)}x`,
    };
  },
};

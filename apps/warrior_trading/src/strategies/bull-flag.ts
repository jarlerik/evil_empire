import type { Strategy, IndicatorSnapshot, StrategySignal } from "./types.js";
import { isBullish, isBearish, barRange } from "../utils/bar.js";

// Bull Flag: strong upward move (flagpole), followed by a tight
// consolidation with lower highs (the flag), then breakout on volume.
// Entry: above the flag high
// Stop: below the flag low
// Target: flagpole height projected from breakout

const MIN_FLAG_BARS = 3;
const MAX_FLAG_BARS = 7;

export const bullFlag: Strategy = {
  name: "bull-flag",

  evaluate(symbol: string, snap: IndicatorSnapshot): StrategySignal | null {
    const bars = snap.bars;
    if (bars.length < MIN_FLAG_BARS + 2) return null;

    // Must be above VWAP
    const curr = bars[bars.length - 1];
    if (curr.close < snap.vwap) return null;

    // Find the flagpole: look for a strong bullish bar before the consolidation
    // Try different flag lengths
    for (let flagLen = MIN_FLAG_BARS; flagLen <= Math.min(MAX_FLAG_BARS, bars.length - 2); flagLen++) {
      const flagStart = bars.length - 1 - flagLen;
      const pole = bars[flagStart - 1];
      if (!pole) continue;

      // Flagpole must be strongly bullish
      if (!isBullish(pole)) continue;
      const poleRange = barRange(pole);
      if (poleRange === 0) continue;

      // Flag bars: should show consolidation (lower highs or tight range)
      const flagEnd = bars.length - 1;
      const flagBars = bars.slice(flagStart, flagEnd);
      let hasLowerHighs = true;
      let flagHigh = flagBars[0].high;
      let flagLow = flagBars[0].low;

      for (let i = 1; i < flagBars.length; i++) {
        if (flagBars[i].high > flagBars[i - 1].high) {
          hasLowerHighs = false;
        }
        flagHigh = Math.max(flagHigh, flagBars[i].high);
        flagLow = Math.min(flagLow, flagBars[i].low);
      }

      // Flag should be tight relative to flagpole.
      // 75% threshold accommodates 1-min bar noise on small-cap stocks
      // (the original 50% was too strict and produced zero trades).
      const flagRange = flagHigh - flagLow;
      if (flagRange > poleRange * 0.75) continue;

      // Some flag bars should be slightly bearish or doji (consolidation)
      // 30% threshold is more forgiving for 1-min data
      let bearishCount = 0;
      for (let i = 0; i < flagBars.length; i++) {
        if (isBearish(flagBars[i])) bearishCount++;
      }
      if (bearishCount < flagBars.length * 0.3) continue;

      // Current bar must break above the flag high
      if (curr.high <= flagHigh) continue;
      if (!isBullish(curr)) continue;

      const entryPrice = flagHigh;
      const stopPrice = flagLow;
      const stopDistance = entryPrice - stopPrice;
      if (stopDistance <= 0) continue;

      // Target: flagpole height projected from breakout
      const targetPrice = entryPrice + poleRange;

      // Only accept if R:R >= 2
      if ((targetPrice - entryPrice) / stopDistance < 2) continue;

      let confidence = 55;
      if (hasLowerHighs) confidence += 10;
      if (snap.relativeVolume >= 3) confidence += 10;
      if (curr.volume > flagBars[flagBars.length - 1].volume * 1.5) confidence += 10;
      if (snap.macd.histogram > 0) confidence += 5;
      confidence = Math.min(confidence, 100);

      return {
        strategy: "bull-flag",
        symbol,
        side: "buy",
        entryPrice,
        stopPrice,
        targetPrice,
        confidence,
        reason: `Bull flag breakout above $${flagHigh.toFixed(2)}, ${flagLen}-bar flag`,
      };
    }

    return null;
  },
};

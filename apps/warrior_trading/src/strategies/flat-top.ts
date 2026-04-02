import type { Strategy, IndicatorSnapshot, StrategySignal } from "./types.js";
import { isBullish } from "../utils/bar.js";

// Flat Top Breakout: price repeatedly tests a resistance level
// (multiple touches of the same high), then breaks through on the
// third+ attempt with volume.
// Entry: above resistance
// Stop: below the consolidation low or ATR-based
// Target: 2:1+ R:R

const MIN_TOUCHES = 2;
const TOUCH_TOLERANCE_PCT = 0.003; // 0.3% tolerance for "same level"

export const flatTop: Strategy = {
  name: "flat-top",

  evaluate(symbol: string, snap: IndicatorSnapshot): StrategySignal | null {
    const bars = snap.bars;
    if (bars.length < 5) return null;

    const curr = bars[bars.length - 1];

    // Must be above VWAP
    if (curr.close < snap.vwap) return null;

    // Find resistance level from recent highs (exclude current bar)
    const lookback = bars.slice(-8, -1);
    if (lookback.length < 4) return null;

    // Find the highest high as potential resistance
    const resistance = Math.max(...lookback.map((b) => b.high));
    const tolerance = resistance * TOUCH_TOLERANCE_PCT;

    // Count touches of resistance
    let touches = 0;
    for (const bar of lookback) {
      if (Math.abs(bar.high - resistance) <= tolerance) {
        touches++;
      }
    }

    if (touches < MIN_TOUCHES) return null;

    // Current bar must break above resistance
    if (curr.high <= resistance) return null;
    if (!isBullish(curr)) return null;

    // Need volume confirmation
    const avgVolume =
      lookback.reduce((sum, b) => sum + b.volume, 0) / lookback.length;
    if (curr.volume < avgVolume * 1.2) return null;

    const entryPrice = resistance;
    const consolidationLow = Math.min(...lookback.map((b) => b.low));
    const stopPrice = Math.max(
      consolidationLow,
      entryPrice - snap.atr * 1.5
    );
    const stopDistance = entryPrice - stopPrice;
    if (stopDistance <= 0) return null;

    const targetPrice = entryPrice + stopDistance * 2;

    let confidence = 50;
    if (touches >= 3) confidence += 15;
    if (snap.relativeVolume >= 3) confidence += 10;
    if (curr.volume > avgVolume * 2) confidence += 10;
    if (snap.ema.ema9 > snap.ema.ema20) confidence += 5;
    confidence = Math.min(confidence, 100);

    return {
      strategy: "flat-top",
      symbol,
      side: "buy",
      entryPrice,
      stopPrice,
      targetPrice,
      confidence,
      reason: `Flat top breakout above $${resistance.toFixed(2)}, ${touches} touches`,
    };
  },
};

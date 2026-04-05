import type { Strategy, IndicatorSnapshot, StrategySignal } from "./types.js";
import { isBullish } from "../utils/bar.js";

// VWAP Reclaim: stock gaps up, falls below VWAP, then reclaims it.
// The reclaim triggers short-covering + FOMO buying, often pushing
// price back to the high of day (HOD).
//
// Entry: current bar closes above VWAP after prev bar closed below
// Stop: below the swing low (lowest low of the sub-VWAP bars)
// Target: premarket high or HOD

const MIN_BARS_BELOW_VWAP = 2; // must spend at least 2 bars below VWAP

export const vwapReclaim: Strategy = {
  name: "vwap-reclaim",

  evaluate(symbol: string, snap: IndicatorSnapshot): StrategySignal | null {
    const bars = snap.bars;
    if (bars.length < 10) return null;

    const curr = bars[bars.length - 1];
    const prev = bars[bars.length - 2];

    // Current bar must close above VWAP (the reclaim)
    if (curr.close <= snap.vwap) return null;

    // Previous bar must have closed below VWAP
    if (prev.close >= snap.vwap) return null;

    // Current bar must be bullish
    if (!isBullish(curr)) return null;

    // Count how many recent bars were below VWAP
    let barsBelowVwap = 0;
    let swingLow = prev.low;
    for (let i = bars.length - 2; i >= 0 && i >= bars.length - 15; i--) {
      if (bars[i].close < snap.vwap) {
        barsBelowVwap++;
        if (bars[i].low < swingLow) swingLow = bars[i].low;
      } else {
        break; // stop counting once we find a bar above VWAP
      }
    }

    if (barsBelowVwap < MIN_BARS_BELOW_VWAP) return null;

    // Must have been above VWAP before the dip (gap-up context)
    // Look for bars above VWAP before the sub-VWAP period
    let wasAboveVwapBefore = false;
    for (let i = bars.length - 2 - barsBelowVwap; i >= 0 && i >= bars.length - 25; i--) {
      if (bars[i].close > snap.vwap) {
        wasAboveVwapBefore = true;
        break;
      }
    }
    if (!wasAboveVwapBefore) return null;

    const entryPrice = curr.close;
    const stopPrice = swingLow - snap.atr * 0.3;
    const stopDistance = entryPrice - stopPrice;
    if (stopDistance <= 0 || stopDistance > entryPrice * 0.05) return null; // max 5% stop

    // Target: premarket high or 2:1 R:R, whichever is higher
    let sessionHigh = curr.high;
    for (let i = bars.length - 2; i >= 0; i--) {
      if (bars[i].high > sessionHigh) sessionHigh = bars[i].high;
    }
    const targetPrice = Math.max(
      entryPrice + stopDistance * 2,
      Math.min(snap.premarketHigh, sessionHigh) // don't overshoot HOD
    );

    let confidence = 55;
    if (barsBelowVwap >= 5) confidence += 10; // longer consolidation = stronger reclaim
    if (snap.relativeVolume >= 2) confidence += 10;
    if (snap.macd.histogram > 0) confidence += 5;
    if (curr.volume > prev.volume * 1.5) confidence += 10; // volume surge on reclaim
    confidence = Math.min(confidence, 100);

    return {
      strategy: "vwap-reclaim",
      symbol,
      side: "buy",
      entryPrice,
      stopPrice,
      targetPrice,
      confidence,
      reason: `VWAP reclaim after ${barsBelowVwap} bars below, swing low $${swingLow.toFixed(2)}`,
    };
  },
};

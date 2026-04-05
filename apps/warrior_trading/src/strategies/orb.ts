import type { Strategy, IndicatorSnapshot, StrategySignal } from "./types.js";
import { isBullish } from "../utils/bar.js";

// Opening Range Breakout (ORB): define the high/low of the first N bars
// after market open, then enter on breakout above the range high.
// Academic research shows 1-5 bar ranges work best on volatile stocks.
//
// Entry: break above the opening range high
// Stop: below the opening range low (or midpoint for tighter stop)
// Target: range height projected from breakout

const ORB_BARS = 5; // first 5 minutes define the opening range

export const orb: Strategy = {
  name: "orb",

  evaluate(symbol: string, snap: IndicatorSnapshot): StrategySignal | null {
    const bars = snap.bars;
    if (bars.length < ORB_BARS + 2) return null;

    // Identify the opening range from the first ORB_BARS bars
    let rangeHigh = -Infinity;
    let rangeLow = Infinity;
    for (let i = 0; i < ORB_BARS && i < bars.length; i++) {
      if (bars[i].high > rangeHigh) rangeHigh = bars[i].high;
      if (bars[i].low < rangeLow) rangeLow = bars[i].low;
    }

    const rangeHeight = rangeHigh - rangeLow;
    if (rangeHeight <= 0) return null;

    // Only evaluate after the opening range is established
    if (bars.length <= ORB_BARS) return null;

    const curr = bars[bars.length - 1];
    const prev = bars[bars.length - 2];

    // Must not have already broken out (first breakout only)
    // Check that prev bar was still within or below the range
    if (prev.close > rangeHigh) return null;

    // Current bar must break above range high
    if (curr.high <= rangeHigh) return null;

    // Current bar should be bullish
    if (!isBullish(curr)) return null;

    // Must be above VWAP for bullish bias
    if (curr.close < snap.vwap) return null;

    const entryPrice = rangeHigh + 0.01; // just above the range
    const stopPrice = rangeLow - snap.atr * 0.2; // below range low
    const stopDistance = entryPrice - stopPrice;
    if (stopDistance <= 0) return null;

    // Target: range height projected from breakout (measured move)
    const targetPrice = entryPrice + rangeHeight;

    let confidence = 60;
    if (snap.relativeVolume >= 2) confidence += 10;
    if (snap.macd.histogram > 0) confidence += 5;
    if (snap.ema.ema9 > snap.ema.ema20) confidence += 5; // short-term uptrend
    if (curr.volume > prev.volume * 1.3) confidence += 10; // volume on breakout
    confidence = Math.min(confidence, 100);

    return {
      strategy: "orb",
      symbol,
      side: "buy",
      entryPrice,
      stopPrice,
      targetPrice,
      confidence,
      reason: `ORB breakout above $${rangeHigh.toFixed(2)} (range: $${rangeLow.toFixed(2)}-$${rangeHigh.toFixed(2)})`,
    };
  },
};

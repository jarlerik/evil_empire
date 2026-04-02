import type { Strategy, IndicatorSnapshot, StrategySignal } from "./types.js";
import { isBullish } from "../utils/bar.js";
import { isHammer } from "../indicators/candlestick/single.js";
import { isBullishEngulfing } from "../indicators/candlestick/double.js";

// Moving Average Pullback: in an established uptrend, price pulls
// back to the 9 or 20 EMA and bounces with a bullish signal.
// Entry: above the high of the bounce candle
// Stop: below the EMA or the pullback low
// Target: 2:1+ R:R or previous swing high

const EMA_PROXIMITY_PCT = 0.005; // within 0.5% of EMA counts as "touching"

export const maPullback: Strategy = {
  name: "ma-pullback",

  evaluate(symbol: string, snap: IndicatorSnapshot): StrategySignal | null {
    const bars = snap.bars;
    if (bars.length < 5) return null;

    const curr = bars[bars.length - 1];
    const prev = bars[bars.length - 2];

    // Uptrend: 9 EMA > 20 EMA > 50 EMA, price above all
    if (snap.ema.ema9 <= snap.ema.ema20) return null;
    if (snap.ema.ema20 <= snap.ema.ema50) return null;
    if (curr.close < snap.ema.ema9) return null;

    // Price must be above VWAP
    if (curr.close < snap.vwap) return null;

    // Recent pullback: prev bar should have touched or dipped near 9 or 20 EMA
    const ema9Proximity = Math.abs(prev.low - snap.ema.ema9) / snap.ema.ema9;
    const ema20Proximity = Math.abs(prev.low - snap.ema.ema20) / snap.ema.ema20;

    const touchedEMA9 = ema9Proximity < EMA_PROXIMITY_PCT || prev.low <= snap.ema.ema9;
    const touchedEMA20 = ema20Proximity < EMA_PROXIMITY_PCT || prev.low <= snap.ema.ema20;

    if (!touchedEMA9 && !touchedEMA20) return null;

    // Current bar should be bullish (the bounce)
    if (!isBullish(curr)) return null;

    // Bonus: bullish candlestick pattern on bounce
    const hasBullishPattern =
      isHammer(prev) || isBullishEngulfing(prev, curr);

    const bounceEMA = touchedEMA9 ? snap.ema.ema9 : snap.ema.ema20;
    const entryPrice = prev.high;
    const stopPrice = Math.min(prev.low, bounceEMA - snap.atr * 0.5);
    const stopDistance = entryPrice - stopPrice;
    if (stopDistance <= 0) return null;

    // Target: use recent swing high or 2:1
    let recentHigh = bars[bars.length - 1].high;
    for (let i = bars.length - 2; i >= bars.length - 8 && i >= 0; i--) {
      if (bars[i].high > recentHigh) recentHigh = bars[i].high;
    }
    const targetPrice = Math.max(
      entryPrice + stopDistance * 2,
      recentHigh
    );

    let confidence = 50;
    if (hasBullishPattern) confidence += 15;
    if (touchedEMA9 && !touchedEMA20) confidence += 5; // shallower pullback = stronger trend
    if (snap.relativeVolume >= 2) confidence += 10;
    if (snap.macd.histogram > 0) confidence += 10;
    confidence = Math.min(confidence, 100);

    return {
      strategy: "ma-pullback",
      symbol,
      side: "buy",
      entryPrice,
      stopPrice,
      targetPrice,
      confidence,
      reason: `Bounce off ${touchedEMA9 ? "9" : "20"} EMA at $${bounceEMA.toFixed(2)}${hasBullishPattern ? " with bullish pattern" : ""}`,
    };
  },
};

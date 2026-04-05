import type { Strategy, IndicatorSnapshot, StrategySignal } from "./types.js";
import { isBullish } from "../utils/bar.js";
import { isHammer } from "../indicators/candlestick/single.js";

// VWAP Bounce: stock trending above VWAP pulls back to test VWAP
// as support and bounces. Classic institutional support level.
//
// Entry: bullish bar bouncing off VWAP after pullback
// Stop: below VWAP by ATR fraction
// Target: HOD or 2:1 R:R

const VWAP_TOUCH_PCT = 0.003; // within 0.3% of VWAP counts as touching

export const vwapBounce: Strategy = {
  name: "vwap-bounce",

  evaluate(symbol: string, snap: IndicatorSnapshot): StrategySignal | null {
    const bars = snap.bars;
    if (bars.length < 8) return null;

    const curr = bars[bars.length - 1];
    const prev = bars[bars.length - 2];

    // Current bar must close above VWAP
    if (curr.close <= snap.vwap) return null;

    // Current bar must be bullish (the bounce)
    if (!isBullish(curr)) return null;

    // Previous bar must have touched or dipped near VWAP
    const prevLowToVwap = Math.abs(prev.low - snap.vwap) / snap.vwap;
    const touchedVwap = prevLowToVwap < VWAP_TOUCH_PCT || prev.low <= snap.vwap;
    if (!touchedVwap) return null;

    // Must NOT have closed below VWAP (that would be a breakdown, not a bounce)
    if (prev.close < snap.vwap * 0.995) return null;

    // Overall bullish context: EMA9 > EMA20 or price above both
    if (snap.ema.ema9 < snap.ema.ema20) return null;

    // Must have been above VWAP for most of the session (uptrend context)
    let barsAboveVwap = 0;
    const lookback = Math.min(20, bars.length);
    for (let i = bars.length - 1; i >= bars.length - lookback; i--) {
      if (bars[i].close > snap.vwap) barsAboveVwap++;
    }
    if (barsAboveVwap < lookback * 0.5) return null; // at least half above VWAP

    const entryPrice = curr.close;
    const stopPrice = snap.vwap - snap.atr * 0.5;
    const stopDistance = entryPrice - stopPrice;
    if (stopDistance <= 0) return null;

    // Target: session high or 2:1 R:R
    let sessionHigh = curr.high;
    for (let i = bars.length - 2; i >= 0; i--) {
      if (bars[i].high > sessionHigh) sessionHigh = bars[i].high;
    }
    const targetPrice = Math.max(
      entryPrice + stopDistance * 2,
      sessionHigh
    );

    let confidence = 55;
    if (isHammer(prev)) confidence += 15; // hammer at VWAP = strong signal
    if (snap.relativeVolume >= 2) confidence += 10;
    if (snap.macd.histogram > 0) confidence += 5;
    if (barsAboveVwap >= lookback * 0.7) confidence += 5; // strong uptrend
    confidence = Math.min(confidence, 100);

    return {
      strategy: "vwap-bounce",
      symbol,
      side: "buy",
      entryPrice,
      stopPrice,
      targetPrice,
      confidence,
      reason: `VWAP bounce at $${snap.vwap.toFixed(2)}${isHammer(prev) ? " with hammer" : ""}`,
    };
  },
};

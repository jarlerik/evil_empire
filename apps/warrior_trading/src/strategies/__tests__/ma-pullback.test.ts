import { describe, test, expect } from "bun:test";
import { maPullback } from "../ma-pullback.js";
import type { Bar } from "../../utils/bar.js";
import type { IndicatorSnapshot } from "../types.js";

function makeBar(overrides: Partial<Bar> = {}): Bar {
  return {
    timestamp: new Date("2026-01-15T10:00:00Z"),
    open: 10,
    high: 11,
    low: 9.5,
    close: 10.5,
    volume: 100000,
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<IndicatorSnapshot> = {},
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

describe("maPullback", () => {
  test("textbook setup: pullback to EMA9, bounce generates signal", () => {
    // Need 5+ bars, uptrend, prev touched ema9, curr bullish above ema9
    const bars: Bar[] = [
      makeBar({ open: 10.0, high: 10.5, low: 9.8, close: 10.3 }),
      makeBar({ open: 10.3, high: 10.8, low: 10.1, close: 10.6 }),
      makeBar({ open: 10.6, high: 11.0, low: 10.4, close: 10.9 }),
      // prev bar: pullback touching ema9 (low=10.5, ema9=10.5 so prev.low <= ema9)
      makeBar({ open: 10.8, high: 10.9, low: 10.5, close: 10.6 }),
      // curr bar: bullish bounce above ema9
      makeBar({ open: 10.6, high: 11.2, low: 10.55, close: 11.0 }),
    ];

    const snap = makeSnapshot({
      bars,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      // ema9(10.5) > ema20(10.2) > ema50(9.8) and curr.close(11.0) > ema9(10.5)
      vwap: 10.0, // curr.close(11.0) > vwap(10.0)
      atr: 0.3,
      relativeVolume: 2,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = maPullback.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    expect(signal!.strategy).toBe("ma-pullback");
    expect(signal!.symbol).toBe("TEST");
    expect(signal!.side).toBe("buy");
  });

  test("entry is at prev bar high", () => {
    const bars: Bar[] = [
      makeBar({ open: 10.0, high: 10.5, low: 9.8, close: 10.3 }),
      makeBar({ open: 10.3, high: 10.8, low: 10.1, close: 10.6 }),
      makeBar({ open: 10.6, high: 11.0, low: 10.4, close: 10.9 }),
      makeBar({ open: 10.8, high: 10.9, low: 10.5, close: 10.6 }),
      makeBar({ open: 10.6, high: 11.2, low: 10.55, close: 11.0 }),
    ];

    const snap = makeSnapshot({
      bars,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      vwap: 10.0,
      atr: 0.3,
      relativeVolume: 2,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = maPullback.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // entry = prev.high = 10.9
    expect(signal!.entryPrice).toBe(10.9);
  });

  test("stop is min of prev low and bounceEMA minus half ATR", () => {
    const bars: Bar[] = [
      makeBar({ open: 10.0, high: 10.5, low: 9.8, close: 10.3 }),
      makeBar({ open: 10.3, high: 10.8, low: 10.1, close: 10.6 }),
      makeBar({ open: 10.6, high: 11.0, low: 10.4, close: 10.9 }),
      makeBar({ open: 10.8, high: 10.9, low: 10.5, close: 10.6 }),
      makeBar({ open: 10.6, high: 11.2, low: 10.55, close: 11.0 }),
    ];

    const snap = makeSnapshot({
      bars,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      vwap: 10.0,
      atr: 0.3,
      relativeVolume: 2,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = maPullback.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // touchedEMA9 = true (prev.low 10.5 <= ema9 10.5)
    // bounceEMA = ema9 = 10.5
    // stop = min(prev.low=10.5, ema9-atr*0.5 = 10.5-0.15 = 10.35) = 10.35
    expect(signal!.stopPrice).toBe(10.35);
  });

  test("target is max of 2:1 R:R and recent swing high", () => {
    const bars: Bar[] = [
      makeBar({ open: 10.0, high: 10.5, low: 9.8, close: 10.3 }),
      makeBar({ open: 10.3, high: 10.8, low: 10.1, close: 10.6 }),
      makeBar({ open: 10.6, high: 12.0, low: 10.4, close: 10.9 }), // swing high at 12.0
      makeBar({ open: 10.8, high: 10.9, low: 10.5, close: 10.6 }),
      makeBar({ open: 10.6, high: 11.2, low: 10.55, close: 11.0 }),
    ];

    const snap = makeSnapshot({
      bars,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      vwap: 10.0,
      atr: 0.3,
      relativeVolume: 2,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = maPullback.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // entry=10.9, stop=10.35, stopDist=0.55
    // 2:1 target = 10.9 + 0.55*2 = 12.0
    // recentHigh scans last 8 bars from end: max(11.2, 10.9, 12.0, 10.8, 10.5) = 12.0
    // target = max(12.0, 12.0) = 12.0
    expect(signal!.targetPrice).toBeCloseTo(12.0, 5);
  });

  test("returns null when not in uptrend (ema9 < ema20)", () => {
    const bars: Bar[] = [
      makeBar(),
      makeBar(),
      makeBar(),
      makeBar({ open: 10.0, high: 10.5, low: 9.8, close: 10.0 }),
      makeBar({ open: 10.1, high: 10.6, low: 10.0, close: 10.5 }),
    ];

    const snap = makeSnapshot({
      bars,
      ema: { ema9: 10.0, ema20: 10.2, ema50: 9.8, ema200: 9.0 }, // ema9 < ema20
      vwap: 9.0,
    });

    expect(maPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when ema20 < ema50", () => {
    const bars: Bar[] = [
      makeBar(),
      makeBar(),
      makeBar(),
      makeBar({ open: 10.0, high: 10.5, low: 9.8, close: 10.0 }),
      makeBar({ open: 10.1, high: 10.6, low: 10.0, close: 10.5 }),
    ];

    const snap = makeSnapshot({
      bars,
      ema: { ema9: 10.5, ema20: 9.5, ema50: 9.8, ema200: 9.0 }, // ema20 < ema50
      vwap: 9.0,
    });

    expect(maPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when prev bar did not touch EMA", () => {
    const bars: Bar[] = [
      makeBar({ open: 10.0, high: 10.5, low: 9.8, close: 10.3 }),
      makeBar({ open: 10.3, high: 10.8, low: 10.1, close: 10.6 }),
      makeBar({ open: 10.6, high: 11.0, low: 10.4, close: 10.9 }),
      // prev bar: low is far above ema9, doesn't touch it
      // ema9=10.5, ema9 proximity threshold = 0.005 * 10.5 = 0.0525
      // prev.low=10.8, |10.8 - 10.5| / 10.5 = 0.0286 ... that's within 0.5%
      // Let's make it clearly not touching:
      makeBar({ open: 11.0, high: 11.2, low: 10.9, close: 11.0 }),
      // ema9prox = |10.9 - 10.5| / 10.5 = 0.038 > 0.005 ... wait, 0.005 is 0.5%
      // 0.038 = 3.8% which is > 0.5%, and 10.9 > 10.5 so not <= ema9
      // For ema20: |10.9 - 10.2| / 10.2 = 0.069 > 0.5%, and 10.9 > 10.2
      makeBar({ open: 11.0, high: 11.3, low: 10.95, close: 11.2 }),
    ];

    const snap = makeSnapshot({
      bars,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      vwap: 10.0,
      atr: 0.3,
    });

    expect(maPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when current bar close is below ema9", () => {
    const bars: Bar[] = [
      makeBar(),
      makeBar(),
      makeBar(),
      makeBar({ open: 10.8, high: 10.9, low: 10.5, close: 10.6 }),
      makeBar({ open: 10.3, high: 10.4, low: 10.2, close: 10.35 }), // close < ema9
    ];

    const snap = makeSnapshot({
      bars,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      vwap: 9.0,
    });

    expect(maPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when below VWAP", () => {
    const bars: Bar[] = [
      makeBar(),
      makeBar(),
      makeBar(),
      makeBar({ open: 10.8, high: 10.9, low: 10.5, close: 10.6 }),
      makeBar({ open: 10.6, high: 11.2, low: 10.55, close: 11.0 }),
    ];

    const snap = makeSnapshot({
      bars,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      vwap: 12.0, // curr.close 11.0 < 12.0
    });

    expect(maPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null with fewer than 5 bars", () => {
    const bars = [makeBar(), makeBar(), makeBar(), makeBar()];
    const snap = makeSnapshot({ bars, vwap: 9.0 });
    expect(maPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("confidence: shallow pullback to EMA9 adds 5, RVOL>=2 adds 10, macd adds 10", () => {
    const bars: Bar[] = [
      makeBar({ open: 10.0, high: 10.5, low: 9.8, close: 10.3 }),
      makeBar({ open: 10.3, high: 10.8, low: 10.1, close: 10.6 }),
      makeBar({ open: 10.6, high: 11.0, low: 10.4, close: 10.9 }),
      // prev: touches EMA9 (low=10.5, ema9=10.5)
      makeBar({ open: 10.8, high: 10.9, low: 10.5, close: 10.6 }),
      makeBar({ open: 10.6, high: 11.2, low: 10.55, close: 11.0 }),
    ];

    const snap = makeSnapshot({
      bars,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      vwap: 10.0,
      atr: 0.3,
      relativeVolume: 2, // >= 2: +10
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 }, // +10
    });

    const signal = maPullback.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // base 50
    // hasBullishPattern: isHammer(prev)? prev body ratio: |10.6-10.8|/|10.9-10.5| = 0.2/0.4=0.5 > 0.3, not hammer
    // isBullishEngulfing(prev, curr)? prev must be bearish (10.6 < 10.8 yes), curr bullish (11.0 > 10.6 yes)
    // curr.open(10.6) <= prev.close(10.6) yes, curr.close(11.0) >= prev.open(10.8) yes
    // bodySize(curr)=0.4, bodySize(prev)=0.2, 0.4 > 0.2 yes => bullish engulfing! +15
    // touchedEMA9 only (not EMA20): +5
    // RVOL >= 2: +10
    // histogram > 0: +10
    // total = 50 + 15 + 5 + 10 + 10 = 90
    expect(signal!.confidence).toBe(90);
  });
});

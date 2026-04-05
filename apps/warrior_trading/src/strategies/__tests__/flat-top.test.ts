import { describe, test, expect } from "bun:test";
import { flatTop } from "../flat-top.js";
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

// Build bars with multiple touches of resistance at 11.0, then breakout.
// lookback = bars.slice(-8, -1), so we need enough bars.
// At least 5 bars total, with lookback.length >= 4.
function buildFlatTopBars(): Bar[] {
  // resistance = 11.0 (tolerance = 11.0 * 0.003 = 0.033)
  const bar1 = makeBar({
    open: 10.2,
    high: 11.0,
    low: 10.0,
    close: 10.5,
    volume: 80000,
  });
  const bar2 = makeBar({
    open: 10.5,
    high: 10.7,
    low: 10.2,
    close: 10.4,
    volume: 70000,
  });
  const bar3 = makeBar({
    open: 10.4,
    high: 11.0,
    low: 10.1,
    close: 10.6,
    volume: 85000,
  });
  const bar4 = makeBar({
    open: 10.6,
    high: 10.8,
    low: 10.3,
    close: 10.5,
    volume: 75000,
  });
  const bar5 = makeBar({
    open: 10.5,
    high: 10.99,
    low: 10.2,
    close: 10.7,
    volume: 90000,
  });
  // Breakout bar: bullish, high above 11.0, good volume
  // avgVolume of lookback = (80000+70000+85000+75000+90000)/5 = 80000
  // need volume >= 80000 * 1.2 = 96000
  const breakout = makeBar({
    open: 10.7,
    high: 11.3,
    low: 10.6,
    close: 11.2,
    volume: 120000,
  });

  return [bar1, bar2, bar3, bar4, bar5, breakout];
}

describe("flatTop", () => {
  test("textbook setup generates signal with correct fields", () => {
    const bars = buildFlatTopBars();
    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      atr: 0.5,
      relativeVolume: 3,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
    });

    const signal = flatTop.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    expect(signal!.strategy).toBe("flat-top");
    expect(signal!.symbol).toBe("TEST");
    expect(signal!.side).toBe("buy");
    // resistance = max high of lookback = 11.0
    expect(signal!.entryPrice).toBe(11.0);
  });

  test("stop uses consolidation low or ATR-based, whichever is larger", () => {
    const bars = buildFlatTopBars();
    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      atr: 0.5,
      relativeVolume: 3,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
    });

    const signal = flatTop.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // consolidationLow = min low of lookback = 10.0
    // atr-based = 11.0 - 0.5 * 1.5 = 10.25
    // stopPrice = max(10.0, 10.25) = 10.25
    expect(signal!.stopPrice).toBe(10.25);
  });

  test("target is 2:1 R:R from entry", () => {
    const bars = buildFlatTopBars();
    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      atr: 0.5,
      relativeVolume: 3,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
    });

    const signal = flatTop.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // entry=11.0, stop=10.25, stopDist=0.75, target=11.0+0.75*2=12.5
    expect(signal!.targetPrice).toBe(12.5);
    const rr =
      (signal!.targetPrice - signal!.entryPrice) /
      (signal!.entryPrice - signal!.stopPrice);
    expect(rr).toBeGreaterThanOrEqual(2);
  });

  test("returns null when close is below VWAP", () => {
    const bars = buildFlatTopBars();
    const snap = makeSnapshot({
      bars,
      vwap: 12.0, // curr.close 11.2 < 12.0
      atr: 0.5,
    });

    expect(flatTop.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null with fewer than 5 bars", () => {
    const bars = [makeBar(), makeBar(), makeBar(), makeBar()];
    const snap = makeSnapshot({ bars, vwap: 9.0 });
    expect(flatTop.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when only 1 touch of resistance", () => {
    // Only one bar touches the high level
    const bars: Bar[] = [
      makeBar({ open: 10.2, high: 11.0, low: 10.0, close: 10.5, volume: 80000 }),
      makeBar({ open: 10.5, high: 10.5, low: 10.2, close: 10.4, volume: 70000 }),
      makeBar({ open: 10.4, high: 10.6, low: 10.1, close: 10.5, volume: 85000 }),
      makeBar({ open: 10.5, high: 10.4, low: 10.2, close: 10.3, volume: 75000 }),
      makeBar({ open: 10.3, high: 10.5, low: 10.0, close: 10.4, volume: 90000 }),
      // Breakout
      makeBar({ open: 10.7, high: 11.3, low: 10.6, close: 11.2, volume: 120000 }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      atr: 0.5,
    });

    expect(flatTop.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when breakout bar has insufficient volume", () => {
    const bars = buildFlatTopBars();
    // Override breakout volume to be low
    bars[5] = makeBar({
      open: 10.7,
      high: 11.3,
      low: 10.6,
      close: 11.2,
      volume: 50000, // avg of lookback ~80000, need >= 96000
    });

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      atr: 0.5,
      relativeVolume: 3,
    });

    expect(flatTop.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when breakout bar does not exceed resistance", () => {
    const bars = buildFlatTopBars();
    bars[5] = makeBar({
      open: 10.7,
      high: 10.9, // does not exceed 11.0
      low: 10.6,
      close: 10.8,
      volume: 120000,
    });

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      atr: 0.5,
      relativeVolume: 3,
    });

    expect(flatTop.evaluate("TEST", snap)).toBeNull();
  });

  test("confidence base is 50 with bonuses for 3+ touches and volume", () => {
    // Build bars with 3 touches of resistance
    const bars: Bar[] = [
      makeBar({ open: 10.2, high: 11.0, low: 10.0, close: 10.5, volume: 80000 }),
      makeBar({ open: 10.5, high: 11.0, low: 10.2, close: 10.4, volume: 70000 }),
      makeBar({ open: 10.4, high: 11.0, low: 10.1, close: 10.6, volume: 85000 }),
      makeBar({ open: 10.6, high: 10.8, low: 10.3, close: 10.5, volume: 75000 }),
      makeBar({ open: 10.5, high: 10.7, low: 10.2, close: 10.6, volume: 90000 }),
      // Breakout with strong volume
      makeBar({
        open: 10.7,
        high: 11.3,
        low: 10.6,
        close: 11.2,
        // avgVolume = (80000+70000+85000+75000+90000)/5 = 80000
        // volume > avgVolume * 2 = 160000: +10
        volume: 200000,
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      atr: 0.5,
      relativeVolume: 3, // >= 3: +10
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 }, // ema9 > ema20: +5
    });

    const signal = flatTop.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // base 50 + 3 touches (+15) + RVOL>=3 (+10) + volume>avg*2 (+10) + ema9>ema20 (+5) = 90
    expect(signal!.confidence).toBe(90);
  });
});

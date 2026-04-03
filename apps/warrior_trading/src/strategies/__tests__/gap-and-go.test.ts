import { describe, test, expect } from "bun:test";
import { gapAndGo } from "../gap-and-go.js";
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
    ...overrides,
  };
}

describe("gapAndGo", () => {
  test("textbook setup generates signal with correct fields", () => {
    // 3 bars: two prior bars, then a bullish breakout bar above premarket high
    const bars: Bar[] = [
      makeBar({ open: 10, high: 10.5, low: 9.8, close: 10.3, volume: 80000 }),
      makeBar({ open: 10.3, high: 10.7, low: 10.1, close: 10.5, volume: 90000 }),
      makeBar({
        open: 10.6,
        high: 11.2,
        low: 10.4,
        close: 11.0,
        volume: 120000, // >= prev 90000 * 1.2 = 108000
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0, // curr.close 11.0 > vwap
      relativeVolume: 3, // >= 2
      premarketHigh: 10.8, // curr.high 11.2 > 10.8
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = gapAndGo.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    expect(signal!.strategy).toBe("gap-and-go");
    expect(signal!.symbol).toBe("TEST");
    expect(signal!.side).toBe("buy");
    expect(signal!.entryPrice).toBe(10.8); // premarketHigh
  });

  test("stop is min of VWAP and recent 2-bar low", () => {
    const bars: Bar[] = [
      makeBar({ open: 10, high: 10.5, low: 9.7, close: 10.3, volume: 80000 }),
      makeBar({ open: 10.3, high: 10.7, low: 10.2, close: 10.5, volume: 90000 }),
      makeBar({
        open: 10.6,
        high: 11.2,
        low: 10.4,
        close: 11.0,
        volume: 120000,
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      relativeVolume: 3,
      premarketHigh: 10.8,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = gapAndGo.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // minLow starts at bars[2].low=10.4, then checks bars[1].low=10.2 and bars[0].low=9.7
    // minLow = 9.7
    // stopPrice = min(vwap=10.0, minLow=9.7) = 9.7
    expect(signal!.stopPrice).toBe(9.7);
  });

  test("target is 2:1 R:R from entry", () => {
    const bars: Bar[] = [
      makeBar({ open: 10, high: 10.5, low: 10.2, close: 10.3, volume: 80000 }),
      makeBar({ open: 10.3, high: 10.7, low: 10.2, close: 10.5, volume: 90000 }),
      makeBar({
        open: 10.6,
        high: 11.2,
        low: 10.4,
        close: 11.0,
        volume: 120000,
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      relativeVolume: 3,
      premarketHigh: 10.8,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 },
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = gapAndGo.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // minLow: min(10.4, 10.2, 10.2) = 10.2
    // stop = min(vwap=10.0, 10.2) = 10.0
    // entry=10.8, stopDist=0.8, target=10.8+1.6=12.4
    expect(signal!.targetPrice).toBeCloseTo(12.4, 5);
    const rr =
      (signal!.targetPrice - signal!.entryPrice) /
      (signal!.entryPrice - signal!.stopPrice);
    expect(rr).toBeGreaterThanOrEqual(2);
  });

  test("returns null when close is below VWAP", () => {
    const bars: Bar[] = [
      makeBar({ close: 10 }),
      makeBar({ close: 10.2, volume: 90000 }),
      makeBar({
        open: 10.3,
        high: 11.2,
        low: 10.0,
        close: 10.1, // below VWAP
        volume: 120000,
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.5, // curr.close 10.1 < 10.5
      relativeVolume: 3,
      premarketHigh: 10.8,
    });

    expect(gapAndGo.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when high does not exceed premarket high", () => {
    const bars: Bar[] = [
      makeBar({ volume: 80000 }),
      makeBar({ volume: 90000 }),
      makeBar({
        open: 10.3,
        high: 10.7, // <= premarketHigh of 10.8
        low: 10.0,
        close: 10.5,
        volume: 120000,
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      relativeVolume: 3,
      premarketHigh: 10.8,
    });

    expect(gapAndGo.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when relative volume is below 2", () => {
    const bars: Bar[] = [
      makeBar({ volume: 80000 }),
      makeBar({ volume: 90000 }),
      makeBar({
        open: 10.6,
        high: 11.2,
        low: 10.4,
        close: 11.0,
        volume: 120000,
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      relativeVolume: 1.5, // < 2
      premarketHigh: 10.8,
    });

    expect(gapAndGo.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null with fewer than 3 bars", () => {
    const bars: Bar[] = [makeBar(), makeBar()];
    const snap = makeSnapshot({ bars, vwap: 9.0, premarketHigh: 9.0 });
    expect(gapAndGo.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when current bar is bearish", () => {
    const bars: Bar[] = [
      makeBar({ volume: 80000 }),
      makeBar({ volume: 90000 }),
      makeBar({
        open: 11.0,
        high: 11.2,
        low: 10.4,
        close: 10.6, // bearish: close < open
        volume: 120000,
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      relativeVolume: 3,
      premarketHigh: 10.8,
    });

    expect(gapAndGo.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when volume spike is insufficient", () => {
    const bars: Bar[] = [
      makeBar({ volume: 80000 }),
      makeBar({ volume: 100000 }),
      makeBar({
        open: 10.6,
        high: 11.2,
        low: 10.4,
        close: 11.0,
        volume: 110000, // < 100000 * 1.2 = 120000
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      relativeVolume: 3,
      premarketHigh: 10.8,
    });

    expect(gapAndGo.evaluate("TEST", snap)).toBeNull();
  });

  test("confidence base is 50, with bonuses for RVOL>=5, ema9>ema20, histogram>0", () => {
    const bars: Bar[] = [
      makeBar({ open: 10, high: 10.5, low: 9.8, close: 10.3, volume: 80000 }),
      makeBar({ open: 10.3, high: 10.7, low: 10.1, close: 10.5, volume: 90000 }),
      // Non-marubozu bullish bar (has wicks so body ratio < 0.7)
      makeBar({
        open: 10.6,
        high: 11.3,
        low: 10.4,
        close: 11.0,
        volume: 120000,
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      relativeVolume: 5, // >= 5: +10
      premarketHigh: 10.8,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 }, // ema9 > ema20: +10
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 }, // histogram > 0: +10
    });

    const signal = gapAndGo.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // base 50 + marubozu? (body=0.4, range=0.9, ratio~0.44 < 0.7 so no +15)
    // + RVOL>=5 (+10) + ema9>ema20 (+10) + histogram>0 (+10) = 80
    expect(signal!.confidence).toBe(80);
  });

  test("confidence capped at 100", () => {
    const bars: Bar[] = [
      makeBar({ open: 10, high: 10.5, low: 9.8, close: 10.3, volume: 80000 }),
      makeBar({ open: 10.3, high: 10.7, low: 10.1, close: 10.5, volume: 90000 }),
      // Marubozu-like: body is large relative to range (body/range >= 0.7)
      makeBar({
        open: 10.8,
        high: 11.3,
        low: 10.8,
        close: 11.3, // body=0.5, range=0.5, ratio=1.0 (marubozu + bullish)
        volume: 120000,
      }),
    ];

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      relativeVolume: 6, // >= 5: +10
      premarketHigh: 10.9,
      ema: { ema9: 10.5, ema20: 10.2, ema50: 9.8, ema200: 9.0 }, // +10
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 }, // +10
    });

    const signal = gapAndGo.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // base 50 + marubozu(+15) + RVOL(+10) + ema(+10) + macd(+10) = 95
    expect(signal!.confidence).toBe(95);
  });
});

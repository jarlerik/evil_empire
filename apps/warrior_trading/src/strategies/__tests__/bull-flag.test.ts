import { describe, test, expect } from "bun:test";
import { bullFlag } from "../bull-flag.js";
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

// Helper to build a textbook bull flag setup:
// [pole, flag1, flag2, flag3, breakout]
// pole = strong bullish bar
// flag = 3 slightly bearish bars with lower highs & tight range (< 50% of pole range)
// breakout = bullish bar above flag high
function buildBullFlagBars(): Bar[] {
  // Pole: open=10, close=12, range=2.5 (high=12.5, low=10)
  const pole = makeBar({
    open: 10,
    high: 12.5,
    low: 10,
    close: 12,
    volume: 150000,
  });

  // Flag bars: tight range, lower highs, mostly bearish
  // poleRange = 2.5, so flag range must be < 2.5 * 0.5 = 1.25
  // Flag bars have lower highs: 12.3 > 12.1 > 11.9
  const flag1 = makeBar({
    open: 12.0,
    high: 12.3,
    low: 11.6,
    close: 11.8, // bearish
    volume: 60000,
  });
  const flag2 = makeBar({
    open: 11.8,
    high: 12.1,
    low: 11.5,
    close: 11.6, // bearish
    volume: 55000,
  });
  const flag3 = makeBar({
    open: 11.6,
    high: 11.9,
    low: 11.4,
    close: 11.5, // bearish
    volume: 50000,
  });
  // flagHigh = 12.3, flagLow = 11.4, flagRange = 0.9 < 1.25

  // Breakout: bullish, high above flagHigh of 12.3
  const breakout = makeBar({
    open: 11.6,
    high: 12.8,
    low: 11.5,
    close: 12.6, // bullish
    volume: 120000,
  });

  return [pole, flag1, flag2, flag3, breakout];
}

describe("bullFlag", () => {
  test("textbook setup generates signal with correct strategy and entry", () => {
    const bars = buildBullFlagBars();
    const snap = makeSnapshot({
      bars,
      vwap: 11.0, // curr.close 12.6 > 11.0
      relativeVolume: 3,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = bullFlag.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    expect(signal!.strategy).toBe("bull-flag");
    expect(signal!.symbol).toBe("TEST");
    expect(signal!.side).toBe("buy");
    // entry = flagHigh = 12.3
    expect(signal!.entryPrice).toBe(12.3);
  });

  test("stop is at flag low", () => {
    const bars = buildBullFlagBars();
    const snap = makeSnapshot({
      bars,
      vwap: 11.0,
      relativeVolume: 3,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = bullFlag.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // flagLow = 11.4
    expect(signal!.stopPrice).toBe(11.4);
  });

  test("target equals flagpole range projected from entry", () => {
    const bars = buildBullFlagBars();
    const snap = makeSnapshot({
      bars,
      vwap: 11.0,
      relativeVolume: 3,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = bullFlag.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // poleRange = 12.5 - 10 = 2.5, target = 12.3 + 2.5 = 14.8
    expect(signal!.targetPrice).toBe(14.8);
  });

  test("R:R is >= 2", () => {
    const bars = buildBullFlagBars();
    const snap = makeSnapshot({
      bars,
      vwap: 11.0,
      relativeVolume: 3,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = bullFlag.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    const rr =
      (signal!.targetPrice - signal!.entryPrice) /
      (signal!.entryPrice - signal!.stopPrice);
    expect(rr).toBeGreaterThanOrEqual(2);
  });

  test("returns null with fewer than 5 bars", () => {
    const bars = [makeBar(), makeBar(), makeBar(), makeBar()];
    const snap = makeSnapshot({ bars, vwap: 9.0 });
    expect(bullFlag.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when close is below VWAP", () => {
    const bars = buildBullFlagBars();
    // Override the breakout bar's close to be below VWAP
    bars[4] = makeBar({
      open: 11.6,
      high: 12.8,
      low: 11.5,
      close: 12.6,
      volume: 120000,
    });
    const snap = makeSnapshot({
      bars,
      vwap: 13.0, // curr.close 12.6 < 13.0
    });

    expect(bullFlag.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when flag range exceeds 50% of pole range", () => {
    const pole = makeBar({
      open: 10,
      high: 11,
      low: 10,
      close: 10.8, // bullish, poleRange = 1.0
      volume: 150000,
    });
    // Flag range must be < 1.0 * 0.5 = 0.5, but we make it wider
    const flag1 = makeBar({
      open: 11.0,
      high: 11.5,
      low: 10.5,
      close: 10.7, // bearish
      volume: 60000,
    });
    const flag2 = makeBar({
      open: 10.7,
      high: 11.3,
      low: 10.3,
      close: 10.5, // bearish
      volume: 55000,
    });
    const flag3 = makeBar({
      open: 10.5,
      high: 11.1,
      low: 10.2,
      close: 10.3, // bearish
      volume: 50000,
    });
    // flagHigh=11.5, flagLow=10.2, flagRange=1.3 > 0.5
    const breakout = makeBar({
      open: 10.4,
      high: 12.0,
      low: 10.3,
      close: 11.8,
      volume: 120000,
    });

    const snap = makeSnapshot({
      bars: [pole, flag1, flag2, flag3, breakout],
      vwap: 10.0,
    });

    expect(bullFlag.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when not enough flag bars are bearish", () => {
    const pole = makeBar({
      open: 10,
      high: 12.5,
      low: 10,
      close: 12,
      volume: 150000,
    });
    // All flag bars bullish (bearishCount < 40%)
    const flag1 = makeBar({
      open: 11.8,
      high: 12.3,
      low: 11.6,
      close: 12.0, // bullish
      volume: 60000,
    });
    const flag2 = makeBar({
      open: 11.7,
      high: 12.1,
      low: 11.5,
      close: 11.9, // bullish
      volume: 55000,
    });
    const flag3 = makeBar({
      open: 11.6,
      high: 11.9,
      low: 11.4,
      close: 11.8, // bullish
      volume: 50000,
    });
    const breakout = makeBar({
      open: 11.6,
      high: 12.8,
      low: 11.5,
      close: 12.6,
      volume: 120000,
    });

    const snap = makeSnapshot({
      bars: [pole, flag1, flag2, flag3, breakout],
      vwap: 11.0,
    });

    expect(bullFlag.evaluate("TEST", snap)).toBeNull();
  });

  test("confidence base is 55 with bonuses", () => {
    const bars = buildBullFlagBars();
    const snap = makeSnapshot({
      bars,
      vwap: 11.0,
      relativeVolume: 4, // >= 3: +10
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 }, // +5
    });

    const signal = bullFlag.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // base 55
    // hasLowerHighs: flags have 12.3 > 12.1 > 11.9, so yes: +10
    // relativeVolume >= 3: +10
    // breakout volume 120000 > last flag bar volume 50000 * 1.5 = 75000: +10
    // histogram > 0: +5
    // total = 55 + 10 + 10 + 10 + 5 = 90
    expect(signal!.confidence).toBe(90);
  });
});

import { describe, test, expect } from "bun:test";
import { microPullback } from "../micro-pullback.js";
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

// Build a textbook micro pullback: [filler, surge, pullback, continuation]
function buildMicroPullbackBars(): Bar[] {
  const filler = makeBar({
    open: 10.0,
    high: 10.3,
    low: 9.9,
    close: 10.2,
    volume: 80000,
  });

  // Surge bar: strong bullish, body > 60% of range
  // open=10.2, close=11.0, high=11.1, low=10.1 => body=0.8, range=1.0, ratio=0.8 > 0.6
  const surge = makeBar({
    open: 10.2,
    high: 11.1,
    low: 10.1,
    close: 11.0,
    volume: 200000,
  });

  // Pullback bar: small bearish, body < 30% of surge body
  // surgeBody = 0.8, so pullback body must be < 0.8*0.3 = 0.24
  // pullback volume < surge volume * 0.7 = 140000
  const pullback = makeBar({
    open: 11.0,
    high: 11.1,
    low: 10.8,
    close: 10.85, // bearish, body = 0.15 < 0.24
    volume: 60000, // < 140000
  });

  // Continuation bar: bullish, high > pullback.high (11.1)
  const continuation = makeBar({
    open: 10.9,
    high: 11.4,
    low: 10.85,
    close: 11.3, // bullish
    volume: 150000,
  });

  return [filler, surge, pullback, continuation];
}

describe("microPullback", () => {
  test("textbook setup generates signal with correct fields", () => {
    const bars = buildMicroPullbackBars();
    const snap = makeSnapshot({
      bars,
      vwap: 10.0, // curr.close 11.3 > 10.0
      ema: { ema9: 10.8, ema20: 10.4, ema50: 10.0, ema200: 9.5 },
      // curr.close 11.3 > ema9 10.8
      relativeVolume: 5,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = microPullback.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    expect(signal!.strategy).toBe("micro-pullback");
    expect(signal!.symbol).toBe("TEST");
    expect(signal!.side).toBe("buy");
  });

  test("entry is at pullback high, stop at pullback low", () => {
    const bars = buildMicroPullbackBars();
    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      ema: { ema9: 10.8, ema20: 10.4, ema50: 10.0, ema200: 9.5 },
      relativeVolume: 5,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = microPullback.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // pullback high=11.1, low=10.8
    expect(signal!.entryPrice).toBe(11.1);
    expect(signal!.stopPrice).toBe(10.8);
  });

  test("target is 2:1 R:R", () => {
    const bars = buildMicroPullbackBars();
    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      ema: { ema9: 10.8, ema20: 10.4, ema50: 10.0, ema200: 9.5 },
      relativeVolume: 5,
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 },
    });

    const signal = microPullback.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // entry=11.1, stop=10.8, stopDist=0.3, target=11.1+0.3*2=11.7
    expect(signal!.targetPrice).toBeCloseTo(11.7, 5);
    const rr =
      (signal!.targetPrice - signal!.entryPrice) /
      (signal!.entryPrice - signal!.stopPrice);
    expect(rr).toBeGreaterThanOrEqual(2);
  });

  test("returns null with fewer than 4 bars", () => {
    const bars = [makeBar(), makeBar(), makeBar()];
    const snap = makeSnapshot({ bars, vwap: 9.0 });
    expect(microPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when close is below VWAP", () => {
    const bars = buildMicroPullbackBars();
    const snap = makeSnapshot({
      bars,
      vwap: 12.0, // curr.close 11.3 < 12.0
      ema: { ema9: 10.8, ema20: 10.4, ema50: 10.0, ema200: 9.5 },
    });

    expect(microPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when close is below ema9", () => {
    const bars = buildMicroPullbackBars();
    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      ema: { ema9: 12.0, ema20: 10.4, ema50: 10.0, ema200: 9.5 }, // ema9=12.0 > curr.close=11.3
    });

    expect(microPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when pullback bar is not bearish", () => {
    const bars = buildMicroPullbackBars();
    // Override pullback to be bullish
    bars[2] = makeBar({
      open: 10.85,
      high: 11.1,
      low: 10.8,
      close: 10.9, // bullish: close > open
      volume: 60000,
    });

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      ema: { ema9: 10.8, ema20: 10.4, ema50: 10.0, ema200: 9.5 },
    });

    expect(microPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when pullback body is too large", () => {
    const bars = buildMicroPullbackBars();
    // surge body = 0.8, limit = 0.24
    // Override pullback with large body
    bars[2] = makeBar({
      open: 11.0,
      high: 11.1,
      low: 10.5,
      close: 10.6, // bearish, body=0.4 > 0.24
      volume: 60000,
    });

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      ema: { ema9: 10.8, ema20: 10.4, ema50: 10.0, ema200: 9.5 },
    });

    expect(microPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when pullback volume is too high", () => {
    const bars = buildMicroPullbackBars();
    // surge volume = 200000, limit = 140000
    bars[2] = makeBar({
      open: 11.0,
      high: 11.1,
      low: 10.8,
      close: 10.85, // bearish, body ok
      volume: 150000, // > 140000
    });

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      ema: { ema9: 10.8, ema20: 10.4, ema50: 10.0, ema200: 9.5 },
    });

    expect(microPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when surge bar is not strongly bullish (body ratio < 60%)", () => {
    const bars = buildMicroPullbackBars();
    // Override surge to have a small body relative to range
    bars[1] = makeBar({
      open: 10.4,
      high: 11.1,
      low: 10.1,
      close: 10.6, // bullish, body=0.2, range=1.0, ratio=0.2 < 0.6
      volume: 200000,
    });

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      ema: { ema9: 10.8, ema20: 10.4, ema50: 10.0, ema200: 9.5 },
    });

    expect(microPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("returns null when current bar does not break above pullback high", () => {
    const bars = buildMicroPullbackBars();
    // Override continuation to not break above pullback high of 11.1
    bars[3] = makeBar({
      open: 10.9,
      high: 11.0, // <= pullback.high 11.1
      low: 10.85,
      close: 10.95,
      volume: 150000,
    });

    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      ema: { ema9: 10.8, ema20: 10.4, ema50: 10.0, ema200: 9.5 },
    });

    expect(microPullback.evaluate("TEST", snap)).toBeNull();
  });

  test("confidence base is 55 with bonuses", () => {
    const bars = buildMicroPullbackBars();
    const snap = makeSnapshot({
      bars,
      vwap: 10.0,
      ema: { ema9: 10.8, ema20: 10.4, ema50: 10.0, ema200: 9.5 }, // ema9 > ema20: +5
      relativeVolume: 5, // >= 5: +10
      macd: { macd: 0.2, signal: 0.1, histogram: 0.1 }, // +10
    });

    const signal = microPullback.evaluate("TEST", snap);
    expect(signal).not.toBeNull();
    // base 55
    // RVOL >= 5: +10
    // histogram > 0: +10
    // curr.volume(150000) > pullback.volume(60000) * 1.5 = 90000: +10
    // ema9 > ema20: +5
    // total = 55 + 10 + 10 + 10 + 5 = 90
    expect(signal!.confidence).toBe(90);
  });
});

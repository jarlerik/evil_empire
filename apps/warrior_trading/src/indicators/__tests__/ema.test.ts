import { describe, test, expect, beforeEach } from "bun:test";
import { createEMA, updateEMA, createMultiEMA, updateMultiEMA } from "../ema.js";
import type { EMAState, MultiEMA } from "../ema.js";

describe("EMA", () => {
  test("first value after priming equals SMA of the seed bars", () => {
    const period = 9;
    const state = createEMA(period);
    const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18];
    const expectedSMA = prices.reduce((s, p) => s + p, 0) / period; // 14

    let result = 0;
    for (const p of prices) {
      result = updateEMA(state, p);
    }

    expect(state.primed).toBe(true);
    expect(result).toBeCloseTo(expectedSMA, 10);
  });

  test("known sequence with period=9 matches hand calculation", () => {
    const period = 9;
    const multiplier = 2 / (period + 1); // 0.2
    const state = createEMA(period);

    // Seed prices for SMA
    const seed = [22, 22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43];
    for (const p of seed) {
      updateEMA(state, p);
    }
    const sma = seed.reduce((s, p) => s + p, 0) / period;
    expect(state.value).toBeCloseTo(sma, 10);

    // Feed one more price and verify EMA formula
    const nextPrice = 22.24;
    const emaValue = updateEMA(state, nextPrice);
    const expected = (nextPrice - sma) * multiplier + sma;
    expect(emaValue).toBeCloseTo(expected, 10);

    // Feed another and chain
    const nextPrice2 = 22.29;
    const emaValue2 = updateEMA(state, nextPrice2);
    const expected2 = (nextPrice2 - expected) * multiplier + expected;
    expect(emaValue2).toBeCloseTo(expected2, 10);
  });

  test("multi-EMA computes all four periods via createMultiEMA/updateMultiEMA", () => {
    const multi = createMultiEMA();

    // Feed 200 prices so all EMAs are primed
    const prices: number[] = [];
    for (let i = 0; i < 250; i++) {
      prices.push(100 + Math.sin(i * 0.1) * 10);
    }

    let values = { ema9: 0, ema20: 0, ema50: 0, ema200: 0 };
    for (const p of prices) {
      values = updateMultiEMA(multi, p);
    }

    expect(multi.ema9.primed).toBe(true);
    expect(multi.ema20.primed).toBe(true);
    expect(multi.ema50.primed).toBe(true);
    expect(multi.ema200.primed).toBe(true);

    expect(Number.isFinite(values.ema9)).toBe(true);
    expect(Number.isFinite(values.ema20)).toBe(true);
    expect(Number.isFinite(values.ema50)).toBe(true);
    expect(Number.isFinite(values.ema200)).toBe(true);

    // Shorter EMA reacts faster — after a sine wave the 9-period should differ from 200
    expect(values.ema9).not.toBeCloseTo(values.ema200, 0);
  });

  test("priming with fewer than period bars keeps primed=false, no NaN", () => {
    const state = createEMA(9);

    updateEMA(state, 10);
    expect(state.primed).toBe(false);
    expect(Number.isNaN(state.value)).toBe(false);

    updateEMA(state, 11);
    updateEMA(state, 12);
    expect(state.primed).toBe(false);
    expect(state.count).toBe(3);
    expect(Number.isNaN(state.value)).toBe(false);
    // value stays 0 until primed
    expect(state.value).toBe(0);
  });
});

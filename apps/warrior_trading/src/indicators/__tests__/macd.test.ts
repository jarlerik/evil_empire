import { describe, test, expect } from "bun:test";
import { createMACD, updateMACD } from "../macd.js";

describe("MACD", () => {
  test("after 26+ bars all values are finite numbers", () => {
    const state = createMACD();

    // Feed 50 bars with an upward trend
    for (let i = 0; i < 50; i++) {
      updateMACD(state, 100 + i * 0.5);
    }

    const result = updateMACD(state, 130);

    expect(Number.isFinite(result.macd)).toBe(true);
    expect(Number.isFinite(result.signal)).toBe(true);
    expect(Number.isFinite(result.histogram)).toBe(true);
    expect(state.primed).toBe(true);
  });

  test("histogram sign matches momentum direction", () => {
    const state = createMACD();

    // Feed 35 flat bars to prime everything (26 slow + 9 signal)
    for (let i = 0; i < 35; i++) {
      updateMACD(state, 100);
    }

    // Now inject a strong upward move so fast EMA > slow EMA
    for (let i = 0; i < 15; i++) {
      updateMACD(state, 100 + (i + 1) * 2);
    }

    const result = updateMACD(state, 135);

    // fast EMA reacts more to the rise, so MACD line should be positive
    expect(result.macd).toBeGreaterThan(0);
    // histogram should also be positive (momentum accelerating)
    expect(result.histogram).toBeGreaterThan(0);
  });

  test("constant price series converges MACD line to zero", () => {
    const state = createMACD();
    const constantPrice = 50;

    // Feed many bars at the same price
    let result = { macd: 0, signal: 0, histogram: 0 };
    for (let i = 0; i < 100; i++) {
      result = updateMACD(state, constantPrice);
    }

    // Both EMAs converge to the same value, so MACD = 0
    expect(result.macd).toBeCloseTo(0, 6);
    expect(result.signal).toBeCloseTo(0, 6);
    expect(result.histogram).toBeCloseTo(0, 6);
  });
});

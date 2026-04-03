import { describe, test, expect } from "bun:test";
import { createVWAP, resetVWAP, updateVWAP } from "../vwap.js";
import type { Bar } from "../../utils/bar.js";

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

describe("VWAP", () => {
  test("single bar VWAP equals typical price", () => {
    const state = createVWAP();
    const bar = makeBar({ high: 12, low: 10, close: 11, volume: 5000 });
    const vwap = updateVWAP(state, bar);

    const expectedTP = (12 + 10 + 11) / 3;
    expect(vwap).toBeCloseTo(expectedTP, 10);
  });

  test("multiple bars use cumulative VWAP formula", () => {
    const state = createVWAP();

    const bar1 = makeBar({ high: 12, low: 10, close: 11, volume: 1000 });
    const bar2 = makeBar({ high: 13, low: 11, close: 12, volume: 2000 });
    const bar3 = makeBar({ high: 11, low: 9, close: 10, volume: 1500 });

    updateVWAP(state, bar1);
    updateVWAP(state, bar2);
    const vwap = updateVWAP(state, bar3);

    const tp1 = (12 + 10 + 11) / 3;
    const tp2 = (13 + 11 + 12) / 3;
    const tp3 = (11 + 9 + 10) / 3;
    const expected =
      (tp1 * 1000 + tp2 * 2000 + tp3 * 1500) / (1000 + 2000 + 1500);

    expect(vwap).toBeCloseTo(expected, 10);
  });

  test("reset clears state, next update starts fresh", () => {
    const state = createVWAP();

    const bar1 = makeBar({ high: 20, low: 18, close: 19, volume: 5000 });
    updateVWAP(state, bar1);

    resetVWAP(state);
    expect(state.cumulativeTPV).toBe(0);
    expect(state.cumulativeVolume).toBe(0);
    expect(state.value).toBe(0);

    // After reset, a new bar starts fresh (VWAP = its TP)
    const bar2 = makeBar({ high: 30, low: 28, close: 29, volume: 3000 });
    const vwap = updateVWAP(state, bar2);
    const expectedTP = (30 + 28 + 29) / 3;
    expect(vwap).toBeCloseTo(expectedTP, 10);
  });

  test("zero volume bar does not cause division by zero", () => {
    const state = createVWAP();

    // First bar with zero volume
    const bar = makeBar({ high: 10, low: 9, close: 9.5, volume: 0 });
    const vwap = updateVWAP(state, bar);

    // cumulative volume is 0, so value stays 0 (no division by zero)
    expect(Number.isFinite(vwap)).toBe(true);
    expect(vwap).toBe(0);

    // Now add a bar with volume — VWAP should compute normally
    const bar2 = makeBar({ high: 12, low: 10, close: 11, volume: 1000 });
    const vwap2 = updateVWAP(state, bar2);
    const tp2 = (12 + 10 + 11) / 3;
    expect(vwap2).toBeCloseTo(tp2, 10);
  });
});

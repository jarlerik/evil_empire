import { describe, test, expect } from "bun:test";
import { createATR, updateATR } from "../atr.js";
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

describe("ATR", () => {
  test("after 14 bars ATR is finite and positive", () => {
    const state = createATR(14);

    for (let i = 0; i < 14; i++) {
      const bar = makeBar({
        open: 100 + i,
        high: 101 + i,
        low: 99 + i,
        close: 100.5 + i,
      });
      updateATR(state, bar);
    }

    expect(state.primed).toBe(true);
    expect(Number.isFinite(state.value)).toBe(true);
    expect(state.value).toBeGreaterThan(0);
  });

  test("gap-up bar true range accounts for gap via |H-prevC|", () => {
    const state = createATR(14);

    // Prime with 13 normal bars
    for (let i = 0; i < 13; i++) {
      updateATR(
        state,
        makeBar({
          open: 100,
          high: 101,
          low: 99,
          close: 100,
        })
      );
    }

    // 14th bar: gap up — open and high well above prev close (100)
    const gapBar = makeBar({
      open: 105,
      high: 107,
      low: 104,
      close: 106,
    });
    const atr = updateATR(state, gapBar);

    // True range for gap bar: max(107-104=3, |107-100|=7, |104-100|=4) = 7
    // First 13 bars had TR = 2 each (H-L=101-99=2, no prev close for first, then max(2,1,1)=2)
    // After priming, ATR reflects the gap
    expect(state.primed).toBe(true);
    expect(atr).toBeGreaterThan(2); // must be above the normal 2.0 range
  });

  test("flat market (identical OHLC) yields ATR near zero", () => {
    const state = createATR(14);

    for (let i = 0; i < 20; i++) {
      updateATR(
        state,
        makeBar({
          open: 50,
          high: 50,
          low: 50,
          close: 50,
        })
      );
    }

    expect(state.primed).toBe(true);
    expect(state.value).toBeCloseTo(0, 10);
  });
});

import { describe, test, expect } from "bun:test";
import { isHammer, isDoji, isInvertedHammer, isShootingStar, isBullishMarubozu } from "../candlestick/single.js";
import { isBullishEngulfing, isBearishEngulfing, isTweezerBottom, isTweezerTop } from "../candlestick/double.js";
import { isMorningStar, isEveningStar, isThreeWhiteSoldiers, isThreeBlackCrows } from "../candlestick/triple.js";
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

describe("candlestick patterns", () => {
  describe("single patterns", () => {
    test("hammer: long lower wick, small body at top", () => {
      // body at top (open=10.8, close=10.9), long lower wick to 9
      // range = 11-9 = 2, body = 0.1, lower wick = 10.8-9 = 1.8, upper wick = 11-10.9 = 0.1
      // bodyRatio = 0.1/2 = 0.05 < 0.3, lowerWick/range = 1.8/2 = 0.9 >= 0.6, upperWick/range = 0.1/2 = 0.05 < 0.15
      const bar = makeBar({ open: 10.8, high: 11, low: 9, close: 10.9 });
      expect(isHammer(bar)).toBe(true);
    });

    test("doji: open approximately equals close", () => {
      // range = 11-9 = 2, body = |10.05-10| = 0.05, bodyRatio = 0.05/2 = 0.025 < 0.1
      const bar = makeBar({ open: 10, high: 11, low: 9, close: 10.05 });
      expect(isDoji(bar)).toBe(true);
    });

    test("non-hammer bar does not trigger hammer", () => {
      // Large body bar — not a hammer
      const bar = makeBar({ open: 9.5, high: 11, low: 9, close: 10.8 });
      // bodyRatio = 1.3/2 = 0.65, not < 0.3
      expect(isHammer(bar)).toBe(false);
    });

    test("non-doji bar does not trigger doji", () => {
      // Body = 1.0, range = 2.0, bodyRatio = 0.5, not < 0.1
      const bar = makeBar({ open: 10, high: 11, low: 9, close: 11 });
      expect(isDoji(bar)).toBe(false);
    });
  });

  describe("double patterns", () => {
    test("bullish engulfing: bearish then larger bullish bar", () => {
      const prev = makeBar({ open: 11, high: 11.2, low: 10.5, close: 10.6 }); // bearish
      const curr = makeBar({ open: 10.5, high: 11.5, low: 10.4, close: 11.3 }); // bullish, engulfs

      // prev is bearish (close < open): 10.6 < 11
      // curr is bullish (close > open): 11.3 > 10.5
      // curr.open(10.5) <= prev.close(10.6), curr.close(11.3) >= prev.open(11)
      // bodySize(curr)=0.8 > bodySize(prev)=0.4
      expect(isBullishEngulfing(prev, curr)).toBe(true);
    });

    test("tweezer bottom with zero-range doji bar uses Math.max(range*0.05, 0.01) tolerance", () => {
      // prev: zero-range doji (all OHLC same) — bearish requires close < open
      // A zero-range bar cannot be bearish (close === open), so we use a tiny range
      const prev = makeBar({
        open: 10.005,
        high: 10.005,
        low: 10,
        close: 10,
      }); // bearish (tiny), range=0.005, tolerance=max(0.005*0.05, 0.01)=0.01
      const curr = makeBar({
        open: 10,
        high: 10.5,
        low: 10.005,
        close: 10.4,
      }); // bullish, low within tolerance of prev.low

      // |prev.low(10) - curr.low(10.005)| = 0.005 <= tolerance(0.01)
      expect(isTweezerBottom(prev, curr)).toBe(true);
    });

    test("non-engulfing bars return false", () => {
      // Both bullish — not a bearish-then-bullish pattern
      const prev = makeBar({ open: 10, high: 11, low: 9.5, close: 10.8 });
      const curr = makeBar({ open: 10.5, high: 11.5, low: 10.4, close: 11.3 });
      expect(isBullishEngulfing(prev, curr)).toBe(false);
    });
  });

  describe("triple patterns", () => {
    test("morning star: bearish, small body/doji, bullish", () => {
      // first: strong bearish bar
      const first = makeBar({ open: 20, high: 20.5, low: 17, close: 17.5 });
      // bodySize = 2.5

      // second: small body (doji-like), bodySize < first * 0.3 = 0.75
      const second = makeBar({ open: 17, high: 17.5, low: 16.8, close: 17.1 });
      // bodySize = 0.1

      // third: bullish, bodySize > first * 0.5 = 1.25, close > midpoint(first) = (20+17.5)/2 = 18.75
      const third = makeBar({ open: 17.2, high: 20, low: 17, close: 19.5 });
      // bodySize = 2.3, close(19.5) > 18.75

      expect(isMorningStar(first, second, third)).toBe(true);
    });

    test("non-pattern bars return false for all triple detectors", () => {
      // Three bars that don't match any triple pattern: mixed directions, no progression
      const a = makeBar({ open: 10, high: 11, low: 9, close: 10.5 }); // bullish (not bearish, so no morning star)
      const b = makeBar({ open: 11, high: 12, low: 10.5, close: 11.8 }); // bullish, large body (not small/doji)
      const c = makeBar({ open: 11, high: 11.5, low: 10.5, close: 10.8 }); // bearish (breaks white soldiers)

      expect(isMorningStar(a, b, c)).toBe(false);
      expect(isEveningStar(a, b, c)).toBe(false);
      expect(isThreeWhiteSoldiers(a, b, c)).toBe(false);
      expect(isThreeBlackCrows(a, b, c)).toBe(false);
    });
  });
});

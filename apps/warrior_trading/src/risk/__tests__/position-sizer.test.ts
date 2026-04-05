import { describe, test, expect } from "bun:test";
import { calculatePositionSize } from "../position-sizer.js";
import { makeConfig } from "../../__tests__/helpers/fixtures.js";

describe("calculatePositionSize", () => {
  const config = makeConfig();

  test("basic sizing: equity=25000, risk=1.5%, stop=$0.50 -> 750 shares", () => {
    // riskAmount = 25000 * 0.015 = 375
    // shares = floor(375 / 0.50) = 750
    const result = calculatePositionSize(25_000, 10, 9.5, config);

    expect(result.shares).toBe(750);
    expect(result.riskAmount).toBe(375);
    expect(result.positionValue).toBe(750 * 10);
  });

  test("position value capped to equity when shares * price exceeds equity", () => {
    // equity=10000, risk=5%, stop=$0.01
    // riskAmount = 10000 * 0.05 = 500
    // shares = floor(500 / 0.01) = 50000
    // positionValue = 50000 * 10 = 500000 >> 10000 -> capped
    // capped shares = floor(10000 / 10) = 1000
    const highRiskConfig = makeConfig({
      risk: { rrRatio: 2, riskPerTradePct: 5, maxDailyLossPct: 10, maxConsecLosses: 3 },
    });

    const result = calculatePositionSize(10_000, 10, 9.99, highRiskConfig);

    expect(result.positionValue).toBeLessThanOrEqual(10_000);
    expect(result.shares).toBe(Math.floor(10_000 / 10));
  });

  test("zero stop distance returns 0 shares", () => {
    const result = calculatePositionSize(25_000, 10, 10, config);

    expect(result.shares).toBe(0);
    expect(result.riskAmount).toBe(0);
    expect(result.positionValue).toBe(0);
  });

  test("very large equity: equity=1M, risk=1.5%, stop=$0.10 -> 150000 shares", () => {
    // riskAmount = 1_000_000 * 0.015 = 15_000
    // shares = floor(15_000 / 0.10) = 150_000
    // positionValue = 150_000 * 10 = 1_500_000 > 1_000_000 -> capped
    // capped shares = floor(1_000_000 / 10) = 100_000
    const result = calculatePositionSize(1_000_000, 10, 9.9, config);

    // Position value would exceed equity, so it gets capped
    expect(result.positionValue).toBeLessThanOrEqual(1_000_000);
    expect(result.shares).toBe(100_000);
  });

  test("fractional shares are rounded down", () => {
    // riskAmount = 25000 * 0.015 = 375
    // shares = floor(375 / 0.70) = floor(535.71) = 535
    const result = calculatePositionSize(25_000, 10, 9.3, config);

    expect(result.shares).toBe(535);
    expect(Number.isInteger(result.shares)).toBe(true);
    expect(result.positionValue).toBe(535 * 10);
  });
});

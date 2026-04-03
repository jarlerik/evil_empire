import { describe, test, expect } from "bun:test";
import { computeStats } from "../backtest/stats.js";
import type { TradeRecord, EquityPoint } from "../backtest/types.js";

function makeTrade(overrides: Partial<TradeRecord> = {}): TradeRecord {
  return {
    id: 1,
    symbol: "TEST",
    strategy: "gap-and-go",
    confidence: 80,
    entryTime: new Date("2026-03-15T10:00:00Z"),
    exitTime: new Date("2026-03-15T10:05:00Z"),
    entryPrice: 10.0,
    exitPrice: 11.0,
    shares: 100,
    side: "buy",
    pnl: 100,
    commission: 1.0,
    rMultiple: 1.0,
    barsHeld: 5,
    exitReason: "target",
    ...overrides,
  };
}

describe("computeStats", () => {
  test("returns empty stats for no trades", () => {
    const stats = computeStats([], []);
    expect(stats.totalTrades).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.profitFactor).toBe(0);
  });

  test("calculates win rate correctly", () => {
    const trades = [
      makeTrade({ id: 1, pnl: 100 }),
      makeTrade({ id: 2, pnl: 100 }),
      makeTrade({ id: 3, pnl: -50 }),
    ];
    const stats = computeStats(trades, []);

    expect(stats.totalTrades).toBe(3);
    expect(stats.winners).toBe(2);
    expect(stats.losers).toBe(1);
    expect(stats.winRate).toBeCloseTo(2 / 3, 4);
  });

  test("calculates profit factor correctly", () => {
    const trades = [
      makeTrade({ id: 1, pnl: 100 }),
      makeTrade({ id: 2, pnl: 100 }),
      makeTrade({ id: 3, pnl: 100 }),
      makeTrade({ id: 4, pnl: -50 }),
      makeTrade({ id: 5, pnl: -50 }),
    ];
    // Gross profit = 300, Gross loss = 100
    // PF = 300 / 100 = 3.0
    const stats = computeStats(trades, []);
    expect(stats.profitFactor).toBeCloseTo(3.0, 2);
  });

  test("calculates max drawdown from equity curve", () => {
    const equity: EquityPoint[] = [
      { timestamp: new Date("2026-03-15T10:00:00Z"), equity: 25000 },
      { timestamp: new Date("2026-03-15T10:01:00Z"), equity: 25500 }, // peak
      { timestamp: new Date("2026-03-15T10:02:00Z"), equity: 25200 },
      { timestamp: new Date("2026-03-15T10:03:00Z"), equity: 24700 }, // trough: 25500-24700 = 800
      { timestamp: new Date("2026-03-15T10:04:00Z"), equity: 25800 }, // new peak
      { timestamp: new Date("2026-03-15T10:05:00Z"), equity: 25600 },
    ];

    const trades = [makeTrade({ id: 1, pnl: 100 })];
    const stats = computeStats(trades, equity);

    expect(stats.maxDrawdown).toBeCloseTo(800, 0);
    // 800 / 25500 * 100 ≈ 3.14%
    expect(stats.maxDrawdownPct).toBeCloseTo(3.14, 1);
  });

  test("calculates average bars held", () => {
    const trades = [
      makeTrade({ id: 1, barsHeld: 3, pnl: 50 }),
      makeTrade({ id: 2, barsHeld: 7, pnl: 50 }),
      makeTrade({ id: 3, barsHeld: 5, pnl: -20 }),
    ];
    const stats = computeStats(trades, []);
    expect(stats.avgBarsHeld).toBeCloseTo(5.0, 1);
  });

  test("calculates strategy breakdown", () => {
    const trades = [
      makeTrade({ id: 1, strategy: "gap-and-go", pnl: 100 }),
      makeTrade({ id: 2, strategy: "gap-and-go", pnl: -50 }),
      makeTrade({ id: 3, strategy: "bull-flag", pnl: 80 }),
    ];
    const stats = computeStats(trades, []);

    expect(stats.strategyBreakdown["gap-and-go"]).toBeDefined();
    expect(stats.strategyBreakdown["gap-and-go"].trades).toBe(2);
    expect(stats.strategyBreakdown["gap-and-go"].winRate).toBeCloseTo(0.5, 2);
    expect(stats.strategyBreakdown["gap-and-go"].totalPnL).toBeCloseTo(50, 2);

    expect(stats.strategyBreakdown["bull-flag"]).toBeDefined();
    expect(stats.strategyBreakdown["bull-flag"].trades).toBe(1);
    expect(stats.strategyBreakdown["bull-flag"].winRate).toBeCloseTo(1.0, 2);
  });

  test("handles all-winners (infinite profit factor)", () => {
    const trades = [
      makeTrade({ id: 1, pnl: 100 }),
      makeTrade({ id: 2, pnl: 200 }),
    ];
    const stats = computeStats(trades, []);
    expect(stats.profitFactor).toBe(Infinity);
  });

  test("calculates trades per day", () => {
    const trades = [
      makeTrade({ id: 1, entryTime: new Date("2026-03-15T10:00:00Z"), pnl: 100 }),
      makeTrade({ id: 2, entryTime: new Date("2026-03-15T11:00:00Z"), pnl: -50 }),
      makeTrade({ id: 3, entryTime: new Date("2026-03-16T10:00:00Z"), pnl: 80 }),
    ];
    // 3 trades over 2 days = 1.5 trades/day
    const stats = computeStats(trades, []);
    expect(stats.tradesPerDay).toBeCloseTo(1.5, 2);
  });

  test("calculates avg win and avg loss", () => {
    const trades = [
      makeTrade({ id: 1, pnl: 200 }),
      makeTrade({ id: 2, pnl: 100 }),
      makeTrade({ id: 3, pnl: -60 }),
      makeTrade({ id: 4, pnl: -40 }),
    ];
    const stats = computeStats(trades, []);
    expect(stats.avgWin).toBeCloseTo(150, 2);
    expect(stats.avgLoss).toBeCloseTo(-50, 2);
  });

  test("calculates total commissions", () => {
    const trades = [
      makeTrade({ id: 1, commission: 1.5, pnl: 100 }),
      makeTrade({ id: 2, commission: 2.0, pnl: -50 }),
      makeTrade({ id: 3, commission: 1.0, pnl: 80 }),
    ];
    const stats = computeStats(trades, []);
    expect(stats.totalCommissions).toBeCloseTo(4.5, 2);
  });
});

import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { IndicatorSnapshot } from "../../strategies/types.js";
import type { Bar } from "../../utils/bar.js";

// --- Mock dependencies before importing Trader ---

const mockPlaceBracketOrder = mock(() =>
  Promise.resolve({ id: "order-123" })
);
const mockWaitForFill = mock(() =>
  Promise.resolve({ status: "filled", filledAvgPrice: "10.50" })
);
const mockClosePosition = mock(() => Promise.resolve());
const mockCloseAllPositions = mock(() => Promise.resolve([]));

mock.module("../../alpaca/orders.js", () => ({
  placeBracketOrder: mockPlaceBracketOrder,
  waitForFill: mockWaitForFill,
  closePosition: mockClosePosition,
  closeAllPositions: mockCloseAllPositions,
}));

const mockRunScanner = mock(() => Promise.resolve([]));
mock.module("../../scanner/index.js", () => ({
  runScanner: mockRunScanner,
}));

let mockCurrentSession = "open";
let mockTradingAllowed = true;
let mockShouldFlatten = false;

mock.module("../session-timer.js", () => ({
  getCurrentSession: () => mockCurrentSession,
  isTradingAllowed: () => mockTradingAllowed,
  shouldFlattenPositions: () => mockShouldFlatten,
  isScanningTime: () => mockCurrentSession === "pre-market",
  SessionTimer: class {
    start() {}
    stop() {}
    on() {}
    get phase() {
      return mockCurrentSession;
    }
  },
}));

// Mock getBars for Watchlist seeding
mock.module("../../alpaca/market-data.js", () => ({
  getBars: mock(() => Promise.resolve(new Map())),
  getSnapshots: mock(() => Promise.resolve(new Map())),
}));

// Mock risk state persistence
mock.module("../../risk/state-persistence.js", () => ({
  loadRiskState: mock((equity: number) =>
    Promise.resolve({
      startingEquity: equity,
      dailyPnL: 0,
      tradesCompleted: 0,
      tradesWon: 0,
      consecutiveLosses: 0,
      date: "2026-01-15",
    })
  ),
  saveRiskState: mock(() => Promise.resolve()),
}));

import { Trader } from "../trader.js";

function makeBar(overrides: Partial<Bar> = {}): Bar {
  return {
    timestamp: new Date("2026-01-15T10:00:00Z"),
    open: 10,
    high: 11,
    low: 9.5,
    close: 10.5,
    volume: 100_000,
    vwap: 10.3,
    tradeCount: 50,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<IndicatorSnapshot> = {}): IndicatorSnapshot {
  return {
    bars: [makeBar()],
    ema: { ema9: 10.2, ema20: 10.0, ema50: 9.8, ema200: 9.5 },
    vwap: 10.3,
    macd: { macd: 0.1, signal: 0.05, histogram: 0.05 },
    atr: 0.5,
    relativeVolume: 8,
    premarketHigh: 11,
    ...overrides,
  };
}

function createMockConfig() {
  return {
    alpaca: { keyId: "test", secretKey: "test", paper: true },
    scanner: {
      minGapPct: 5,
      prefGapPct: 20,
      minPrice: 1,
      maxPrice: 20,
      maxFloat: 20_000_000,
      minRelVolume: 5,
    },
    risk: {
      rrRatio: 2,
      riskPerTradePct: 1.5,
      maxDailyLossPct: 10,
      maxConsecLosses: 3,
    },
    trading: {
      timeStopBars: 5,
      trailingStopPct: 1.5,
      strategies: ["gap-and-go"] as any,
    },
  } as any;
}

function createMockClient() {
  return {
    getAccount: mock(() => Promise.resolve({ equity: "100000" })),
  } as any;
}

describe("Trader", () => {
  let trader: Trader;
  let config: any;
  let client: any;

  beforeEach(async () => {
    mockCurrentSession = "open";
    mockTradingAllowed = true;
    mockShouldFlatten = false;
    mockPlaceBracketOrder.mockClear();
    mockWaitForFill.mockClear();
    mockClosePosition.mockClear();
    mockCloseAllPositions.mockClear();

    config = createMockConfig();
    client = createMockClient();
    trader = new Trader(client, config);

    // Initialize risk manager so isHalted returns false
    await (trader as any).riskManager.initialize(100_000);
    (trader as any).cachedEquity = 100_000;
  });

  test("executionInProgress prevents duplicate orders", () => {
    // Set executionInProgress to true
    (trader as any).executionInProgress = true;
    // Also need isTradingAllowed and no open position
    (trader as any).openPosition = null;

    const snapshot = makeSnapshot();

    // evaluateStrategies should bail out early due to executionInProgress
    (trader as any).evaluateStrategies("TEST", snapshot);

    // No order should have been placed
    expect(mockPlaceBracketOrder).not.toHaveBeenCalled();
  });

  test("monitorPosition only fires for matching symbol", () => {
    // Set an open position for AAPL
    (trader as any).openPosition = {
      symbol: "AAPL",
      entryPrice: 10,
      shares: 100,
      strategy: "gap-and-go",
      stopPrice: 9,
      targetPrice: 12,
      barsHeld: 0,
      highSinceEntry: 10,
    };

    const snapshot = makeSnapshot({ bars: [makeBar({ close: 5 })] });

    // Evaluate with a different symbol (TEST) should not trigger monitorPosition for AAPL
    // barsHeld should remain 0 because the symbol doesn't match
    (trader as any).evaluateStrategies("TEST", snapshot);
    expect((trader as any).openPosition.barsHeld).toBe(0);

    // Now call with matching symbol — barsHeld should increment
    (trader as any).evaluateStrategies("AAPL", snapshot);
    expect((trader as any).openPosition.barsHeld).toBe(1);
  });

  test("trailing stop triggers close when price drops > trailingStopPct from high", async () => {
    // Set up open position with a high watermark
    (trader as any).openPosition = {
      symbol: "TEST",
      entryPrice: 10,
      shares: 100,
      strategy: "gap-and-go",
      stopPrice: 9,
      targetPrice: 14,
      barsHeld: 0,
      highSinceEntry: 20, // high watermark at 20
    };

    // trailingStopPct is 1.5%, so trailing stop = 20 * (1 - 0.015) = 19.70
    // A close below 19.70 triggers the stop
    const snapshot = makeSnapshot({
      bars: [makeBar({ close: 19.0, high: 19.5 })],
      vwap: 15, // keep VWAP below close to avoid VWAP exit
    });

    (trader as any).monitorPosition(snapshot);

    // Position should have been closed
    // closeOpenPosition is async, wait for it
    await new Promise((r) => setTimeout(r, 50));
    expect(mockClosePosition).toHaveBeenCalled();
    expect((trader as any).openPosition).toBeNull();
  });

  test("time stop triggers close when barsHeld >= timeStopBars and price <= entryPrice", async () => {
    (trader as any).openPosition = {
      symbol: "TEST",
      entryPrice: 10,
      shares: 100,
      strategy: "gap-and-go",
      stopPrice: 9,
      targetPrice: 14,
      barsHeld: 4, // will be incremented to 5 (= timeStopBars)
      highSinceEntry: 10.5,
    };

    // Close at or below entry price with barsHeld about to reach threshold
    const snapshot = makeSnapshot({
      bars: [makeBar({ close: 9.8, high: 10.2 })],
      vwap: 8, // below close to avoid VWAP exit first
    });

    (trader as any).monitorPosition(snapshot);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockClosePosition).toHaveBeenCalled();
    expect((trader as any).openPosition).toBeNull();
  });

  test("VWAP breakdown triggers close when price below VWAP after 2+ bars", async () => {
    (trader as any).openPosition = {
      symbol: "TEST",
      entryPrice: 10,
      shares: 100,
      strategy: "gap-and-go",
      stopPrice: 9,
      targetPrice: 14,
      barsHeld: 1, // will be incremented to 2
      highSinceEntry: 10.5,
    };

    // Close below VWAP, with bars held becoming 2
    const snapshot = makeSnapshot({
      bars: [makeBar({ close: 9.5, high: 10 })],
      vwap: 10.0, // close (9.5) < vwap (10.0)
    });

    (trader as any).monitorPosition(snapshot);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockClosePosition).toHaveBeenCalled();
    expect((trader as any).openPosition).toBeNull();
  });

  test("flattenPositions closes all positions", async () => {
    (trader as any).openPosition = {
      symbol: "TEST",
      entryPrice: 10,
      shares: 100,
      strategy: "gap-and-go",
      stopPrice: 9,
      targetPrice: 14,
      barsHeld: 0,
      highSinceEntry: 10,
    };

    await (trader as any).flattenPositions();

    expect(mockCloseAllPositions).toHaveBeenCalled();
    expect((trader as any).openPosition).toBeNull();
  });

  test("openPosition nulled only after onTradeCompleted in closeOpenPosition", async () => {
    (trader as any).openPosition = {
      symbol: "TEST",
      entryPrice: 10,
      shares: 100,
      strategy: "gap-and-go",
      stopPrice: 9,
      targetPrice: 14,
      barsHeld: 3,
      highSinceEntry: 11,
    };

    // Call closeOpenPosition directly
    await (trader as any).closeOpenPosition(11.0);

    // After closeOpenPosition completes, position should be null
    expect((trader as any).openPosition).toBeNull();

    // closePosition (alpaca) should have been called
    expect(mockClosePosition).toHaveBeenCalledWith(client, "TEST");

    // cachedEquity should have been updated with PnL
    // PnL = (11 - 10) * 100 = 100
    expect((trader as any).cachedEquity).toBe(100_100);
  });
});

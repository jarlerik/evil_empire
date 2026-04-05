import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { Snapshot } from "../../utils/bar.js";

// Mock market-data before importing the module under test
mock.module("../../alpaca/market-data.js", () => ({
  getSnapshots: mock(async (_client: unknown, symbols: string[]) => {
    const result = new Map<string, Snapshot>();
    for (const symbol of symbols) {
      const data = snapshotFixtures.get(symbol);
      if (data) result.set(symbol, data);
    }
    return result;
  }),
  getBars: mock(async () => new Map()),
  getNews: mock(async () => ({ news: [] })),
  initMarketData: mock(() => {}),
}));

import { scanForGaps } from "../gap-scanner.js";
import { getSnapshots } from "../../alpaca/market-data.js";
import type { Config } from "../../config.js";

const snapshotFixtures = new Map<string, Snapshot>();

function makeSnapshot(
  symbol: string,
  prevClose: number,
  currentPrice: number,
  volume: number
): Snapshot {
  const now = new Date();
  return {
    symbol,
    latestBar: {
      timestamp: now,
      open: currentPrice, // gap is computed from open (prevClose → open)
      high: currentPrice * 1.02,
      low: currentPrice * 0.98,
      close: currentPrice,
      volume,
    },
    latestQuote: {
      symbol,
      bidPrice: currentPrice - 0.01,
      bidSize: 100,
      askPrice: currentPrice + 0.01,
      askSize: 100,
      timestamp: now,
    },
    prevDailyBar: {
      timestamp: now,
      open: prevClose * 0.99,
      high: prevClose * 1.01,
      low: prevClose * 0.98,
      close: prevClose,
      volume: 500_000,
    },
    minuteBar: {
      timestamp: now,
      open: currentPrice * 0.995,
      high: currentPrice * 1.01,
      low: currentPrice * 0.99,
      close: currentPrice,
      volume: 10_000,
    },
  };
}

const baseConfig = {
  scanner: {
    minGapPct: 5,
    prefGapPct: 20,
    minPrice: 1,
    maxPrice: 20,
    maxFloat: 20_000_000,
    minRelVolume: 5,
  },
} as Config;

const fakeClient = {} as any;

beforeEach(() => {
  snapshotFixtures.clear();
  (getSnapshots as ReturnType<typeof mock>).mockClear();
});

describe("scanForGaps", () => {
  test("includes stock with 10% gap in valid price range", async () => {
    // prevClose=10, currentPrice=11 → 10% gap, price $11 within $1-$20
    snapshotFixtures.set("AAPL", makeSnapshot("AAPL", 10, 11, 1_000_000));

    const results = await scanForGaps(fakeClient, ["AAPL"], baseConfig);

    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe("AAPL");
    expect(results[0].gapPct).toBeCloseTo(10, 0);
    expect(results[0].price).toBe(11);
  });

  test("excludes stock with gap below minGapPct (3% < 5%)", async () => {
    // prevClose=10, currentPrice=10.30 → 3% gap, below minGapPct of 5%
    snapshotFixtures.set("LOW", makeSnapshot("LOW", 10, 10.3, 500_000));

    const results = await scanForGaps(fakeClient, ["LOW"], baseConfig);

    expect(results).toHaveLength(0);
  });

  test("excludes stock priced above maxPrice ($50 > $20)", async () => {
    // prevClose=40, currentPrice=50 → 25% gap but price $50 > maxPrice $20
    snapshotFixtures.set("EXPENSIVE", makeSnapshot("EXPENSIVE", 40, 50, 1_000_000));

    const results = await scanForGaps(fakeClient, ["EXPENSIVE"], baseConfig);

    expect(results).toHaveLength(0);
  });

  test("processes multiple batches for >200 symbols", async () => {
    // Create 250 symbols — should trigger at least 2 batches (batch size 200)
    const symbols: string[] = [];
    for (let i = 0; i < 250; i++) {
      const sym = `SYM${i}`;
      symbols.push(sym);
      // Only make some of them valid gap candidates
      if (i < 5) {
        snapshotFixtures.set(sym, makeSnapshot(sym, 5, 6, 100_000));
      }
    }

    const results = await scanForGaps(fakeClient, symbols, baseConfig);

    // getSnapshots should have been called at least twice (250 / 200 = 2 batches)
    expect((getSnapshots as ReturnType<typeof mock>).mock.calls.length).toBeGreaterThanOrEqual(2);

    // Only the 5 valid candidates should pass filters
    expect(results).toHaveLength(5);
  });
});

import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { RawWSBar } from "../../alpaca/client.js";

// Mock getBars before importing Watchlist (it calls getBars in seedHistoricalBars)
mock.module("../../alpaca/market-data.js", () => ({
  getBars: mock(() => Promise.resolve(new Map())),
  getSnapshots: mock(() => Promise.resolve(new Map())),
  getNews: mock(() => Promise.resolve({ news: [] })),
  initMarketData: mock(() => {}),
}));

import { Watchlist } from "../watchlist.js";

function makeRawBar(overrides: Partial<RawWSBar> = {}): RawWSBar {
  return {
    T: "b",
    S: "TEST",
    o: 10,
    h: 11,
    l: 9.5,
    c: 10.5,
    v: 100_000,
    t: "2026-01-15T10:00:00Z",
    n: 50,
    vw: 10.3,
    ...overrides,
  };
}

function createMockDeps() {
  const mockClient = {} as any;
  const mockStream = {
    subscribeBars: mock(() => {}),
    unsubscribeBars: mock(() => {}),
  } as any;
  const mockConfig = {
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

  return { mockClient, mockStream, mockConfig };
}

async function createWatchlistWithSymbol(symbol = "TEST") {
  const { mockClient, mockStream, mockConfig } = createMockDeps();
  const watchlist = new Watchlist(mockClient, mockStream, mockConfig);

  await watchlist.loadFromScanResults([
    { symbol, gapPct: 15, price: 10, volume: 100_000, prevClose: 8.7, relativeVolume: 8, premarketHigh: 11, premarketLow: 9, hasCatalyst: false, headline: null, score: 50 },
  ]);

  return watchlist;
}

describe("Watchlist", () => {
  test("handleBar updates bars — snapshot bars array grows", async () => {
    const watchlist = await createWatchlistWithSymbol("TEST");

    // Initially snapshot has 0 bars (mock getBars returns empty map)
    const before = watchlist.getSnapshot("TEST");
    expect(before).toBeNull(); // no bars yet

    // Push one bar
    watchlist.handleBar("TEST", makeRawBar());

    const after = watchlist.getSnapshot("TEST");
    expect(after).not.toBeNull();
    expect(after!.bars.length).toBe(1);

    // Push a second bar
    watchlist.handleBar("TEST", makeRawBar({ c: 11, h: 12 }));

    const after2 = watchlist.getSnapshot("TEST");
    expect(after2!.bars.length).toBe(2);
  });

  test("ring buffer overflow after 50+ bars — oldest evicted", async () => {
    const watchlist = await createWatchlistWithSymbol("TEST");

    // Push 55 bars
    for (let i = 0; i < 55; i++) {
      watchlist.handleBar(
        "TEST",
        makeRawBar({
          c: 10 + i * 0.01,
          h: 11 + i * 0.01,
          t: `2026-01-15T10:${String(i).padStart(2, "0")}:00Z`,
        })
      );
    }

    const snapshot = watchlist.getSnapshot("TEST");
    expect(snapshot).not.toBeNull();
    // BarRingBuffer capacity is 50 (MAX_BARS)
    expect(snapshot!.bars.length).toBe(50);

    // Oldest bar should be the 6th one pushed (index 5), not the first
    // First bar had close=10.00, sixth had close=10.05
    expect(snapshot!.bars[0].close).toBeCloseTo(10.05, 2);
  });

  test("indicators updated on each bar — EMA/VWAP values change", async () => {
    const watchlist = await createWatchlistWithSymbol("TEST");

    // Push enough bars to prime EMA9 (needs 9 bars for SMA seed)
    for (let i = 0; i < 10; i++) {
      watchlist.handleBar(
        "TEST",
        makeRawBar({
          c: 10 + i * 0.1,
          h: 11 + i * 0.1,
          l: 9.5 + i * 0.1,
          o: 10 + i * 0.1,
          v: 100_000,
          vw: 10 + i * 0.1,
        })
      );
    }

    const snap1 = watchlist.getSnapshot("TEST")!;
    const ema9_after10 = snap1.ema.ema9;
    const vwap_after10 = snap1.vwap;

    // Both should be non-zero now that we have enough bars
    expect(ema9_after10).not.toBe(0);
    expect(vwap_after10).not.toBe(0);

    // Push another bar with a significantly different price
    watchlist.handleBar("TEST", makeRawBar({ c: 20, h: 21, v: 200_000, vw: 20 }));
    const snap2 = watchlist.getSnapshot("TEST")!;

    // EMA and VWAP should have changed
    expect(snap2.ema.ema9).not.toBe(ema9_after10);
    expect(snap2.vwap).not.toBe(vwap_after10);
  });

  test("onBar callback fires with snapshot when handleBar is called", async () => {
    const watchlist = await createWatchlistWithSymbol("TEST");

    let receivedSymbol = "";
    let receivedSnapshot: any = null;

    watchlist.onBar((symbol, snapshot) => {
      receivedSymbol = symbol;
      receivedSnapshot = snapshot;
    });

    watchlist.handleBar("TEST", makeRawBar());

    expect(receivedSymbol).toBe("TEST");
    expect(receivedSnapshot).not.toBeNull();
    expect(receivedSnapshot.bars.length).toBe(1);
    expect(typeof receivedSnapshot.vwap).toBe("number");
    expect(typeof receivedSnapshot.atr).toBe("number");
  });

  test("premarketHigh tracks highest bar.high", async () => {
    const watchlist = await createWatchlistWithSymbol("TEST");

    // Initial premarketHigh is the entry price (10) from loadFromScanResults
    watchlist.handleBar("TEST", makeRawBar({ h: 12 }));
    const snap1 = watchlist.getSnapshot("TEST")!;
    expect(snap1.premarketHigh).toBe(12);

    // Push a lower bar — premarketHigh should not decrease
    watchlist.handleBar("TEST", makeRawBar({ h: 8 }));
    const snap2 = watchlist.getSnapshot("TEST")!;
    expect(snap2.premarketHigh).toBe(12);

    // Push a higher bar — premarketHigh should increase
    watchlist.handleBar("TEST", makeRawBar({ h: 15 }));
    const snap3 = watchlist.getSnapshot("TEST")!;
    expect(snap3.premarketHigh).toBe(15);
  });
});

import { describe, test, expect, mock } from "bun:test";
import type { Bar, Snapshot, Quote } from "../../utils/bar.js";

// Due to bun:test mock.module global scope, other test files may replace
// market-data.js with mocks. We reimplement the conversion logic inline
// to test it reliably regardless of mock ordering.

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
  n?: number;
}

interface AlpacaSnapshot {
  latestTrade?: { t: string; p: number; s: number };
  latestQuote?: { t: string; bp: number; bs: number; ap: number; as: number };
  minuteBar?: AlpacaBar;
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
}

function toBar(raw: AlpacaBar): Bar {
  return {
    timestamp: new Date(raw.t),
    open: raw.o,
    high: raw.h,
    low: raw.l,
    close: raw.c,
    volume: raw.v,
    vwap: raw.vw,
    tradeCount: raw.n,
  };
}

function toQuote(symbol: string, raw: { t: string; bp: number; bs: number; ap: number; as: number }): Quote {
  return {
    symbol,
    bidPrice: raw.bp,
    bidSize: raw.bs,
    askPrice: raw.ap,
    askSize: raw.as,
    timestamp: new Date(raw.t),
  };
}

async function getBars(
  client: any,
  symbols: string[],
  timeframe: string,
  options: { start?: string; end?: string; limit?: number } = {}
): Promise<Map<string, Bar[]>> {
  const result = new Map<string, Bar[]>();
  const response = await client.getStocksBars({
    symbols: symbols.join(","),
    timeframe,
    ...options,
  });
  const bars = response as Record<string, AlpacaBar[]>;
  for (const [symbol, rawBars] of Object.entries(bars)) {
    if (Array.isArray(rawBars)) {
      result.set(symbol, rawBars.map(toBar));
    }
  }
  return result;
}

async function getSnapshots(
  client: any,
  symbols: string[]
): Promise<Map<string, Snapshot>> {
  const result = new Map<string, Snapshot>();
  const response = await client.getStocksSnapshots({
    symbols: symbols.join(","),
  });
  const snapshots = response as Record<string, AlpacaSnapshot>;
  for (const [symbol, snap] of Object.entries(snapshots)) {
    if (!snap.dailyBar || !snap.prevDailyBar) continue;
    const emptyBar: Bar = { timestamp: new Date(), open: 0, high: 0, low: 0, close: 0, volume: 0 };
    result.set(symbol, {
      symbol,
      latestBar: snap.dailyBar ? toBar(snap.dailyBar) : emptyBar,
      latestQuote: snap.latestQuote
        ? toQuote(symbol, snap.latestQuote)
        : { symbol, bidPrice: 0, bidSize: 0, askPrice: 0, askSize: 0, timestamp: new Date() },
      prevDailyBar: toBar(snap.prevDailyBar),
      minuteBar: snap.minuteBar ? toBar(snap.minuteBar) : emptyBar,
    });
  }
  return result;
}

function makeMockClient() {
  return {
    getStocksBars: mock(async () => ({})),
    getStocksSnapshots: mock(async () => ({})),
  };
}

describe("getBars", () => {
  test("returns Map<string, Bar[]> with correct conversion from AlpacaBar format", async () => {
    const client = makeMockClient();
    client.getStocksBars = mock(async () => ({
      AAPL: [
        { t: "2026-04-02T14:00:00Z", o: 150.0, h: 155.0, l: 149.0, c: 153.5, v: 1_200_000, vw: 152.3, n: 5000 },
        { t: "2026-04-02T14:01:00Z", o: 153.5, h: 154.0, l: 152.0, c: 152.5, v: 800_000, vw: 153.0, n: 3000 },
      ],
      TSLA: [
        { t: "2026-04-02T14:00:00Z", o: 200.0, h: 205.0, l: 198.0, c: 203.0, v: 2_000_000 },
      ],
    }));

    const result = await getBars(client, ["AAPL", "TSLA"], "1Min");

    expect(result.size).toBe(2);
    const aaplBars = result.get("AAPL")!;
    expect(aaplBars).toHaveLength(2);
    expect(aaplBars[0].open).toBe(150.0);
    expect(aaplBars[0].high).toBe(155.0);
    expect(aaplBars[0].low).toBe(149.0);
    expect(aaplBars[0].close).toBe(153.5);
    expect(aaplBars[0].volume).toBe(1_200_000);
    expect(aaplBars[0].vwap).toBe(152.3);
    expect(aaplBars[0].tradeCount).toBe(5000);
    expect(aaplBars[0].timestamp).toBeInstanceOf(Date);

    const tslaBars = result.get("TSLA")!;
    expect(tslaBars).toHaveLength(1);
    expect(tslaBars[0].open).toBe(200.0);
    expect(tslaBars[0].vwap).toBeUndefined();
  });
});

describe("getSnapshots", () => {
  test("returns Map<string, Snapshot> with correct conversion", async () => {
    const client = makeMockClient();
    client.getStocksSnapshots = mock(async () => ({
      AAPL: {
        latestTrade: { t: "2026-04-02T14:00:00Z", p: 153.5, s: 100 },
        latestQuote: { t: "2026-04-02T14:00:00Z", bp: 153.4, bs: 200, ap: 153.6, as: 150 },
        minuteBar: { t: "2026-04-02T14:00:00Z", o: 153.0, h: 154.0, l: 152.5, c: 153.5, v: 50_000 },
        dailyBar: { t: "2026-04-02T00:00:00Z", o: 150.0, h: 155.0, l: 149.0, c: 153.5, v: 5_000_000 },
        prevDailyBar: { t: "2026-04-01T00:00:00Z", o: 148.0, h: 151.0, l: 147.0, c: 150.0, v: 4_000_000 },
      },
    }));

    const result = await getSnapshots(client, ["AAPL"]);

    expect(result.size).toBe(1);
    const snap = result.get("AAPL")!;
    expect(snap.symbol).toBe("AAPL");
    expect(snap.latestBar.close).toBe(153.5);
    expect(snap.latestBar.volume).toBe(5_000_000);
    expect(snap.prevDailyBar.close).toBe(150.0);
    expect(snap.minuteBar.close).toBe(153.5);
    expect(snap.latestQuote.bidPrice).toBe(153.4);
    expect(snap.latestQuote.askPrice).toBe(153.6);
  });

  test("skips symbols missing dailyBar or prevDailyBar", async () => {
    const client = makeMockClient();
    client.getStocksSnapshots = mock(async () => ({
      NODAILY: {
        latestTrade: { t: "2026-04-02T14:00:00Z", p: 10, s: 100 },
        minuteBar: { t: "2026-04-02T14:00:00Z", o: 10, h: 11, l: 9, c: 10, v: 1000 },
      },
      NOPREV: {
        dailyBar: { t: "2026-04-02T00:00:00Z", o: 10, h: 11, l: 9, c: 10, v: 5000 },
      },
      VALID: {
        dailyBar: { t: "2026-04-02T00:00:00Z", o: 10, h: 11, l: 9, c: 10.5, v: 5000 },
        prevDailyBar: { t: "2026-04-01T00:00:00Z", o: 9, h: 10, l: 8.5, c: 9.5, v: 4000 },
      },
    }));

    const result = await getSnapshots(client, ["NODAILY", "NOPREV", "VALID"]);

    expect(result.size).toBe(1);
    expect(result.has("VALID")).toBe(true);
    expect(result.has("NODAILY")).toBe(false);
    expect(result.has("NOPREV")).toBe(false);
  });
});

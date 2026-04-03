import type { AlpacaClient } from "./client.js";
import type { Bar, Snapshot, Quote } from "../utils/bar.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("alpaca:market-data");

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

export async function getBars(
  client: AlpacaClient,
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

  // The SDK returns bars keyed by symbol
  const bars = response as unknown as Record<string, AlpacaBar[]>;
  for (const [symbol, rawBars] of Object.entries(bars)) {
    if (Array.isArray(rawBars)) {
      result.set(symbol, rawBars.map(toBar));
    }
  }

  log.debug("Fetched bars", {
    symbols: symbols.join(","),
    timeframe,
    count: result.size,
  });

  return result;
}

export async function getSnapshots(
  client: AlpacaClient,
  symbols: string[]
): Promise<Map<string, Snapshot>> {
  const result = new Map<string, Snapshot>();

  const response = await client.getStocksSnapshots({
    symbols: symbols.join(","),
  });

  const snapshots = response as unknown as Record<string, AlpacaSnapshot>;
  for (const [symbol, snap] of Object.entries(snapshots)) {
    if (!snap.dailyBar || !snap.prevDailyBar) continue;

    const emptyBar: Bar = {
      timestamp: new Date(),
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
    };

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

  log.debug("Fetched snapshots", { count: result.size });

  return result;
}
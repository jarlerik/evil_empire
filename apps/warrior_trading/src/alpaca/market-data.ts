import type { AlpacaClient } from "./client.js";
import type { Config } from "../config.js";
import type { Bar, Snapshot, Quote } from "../utils/bar.js";
import { createLogger } from "../utils/logger.js";
import { getCached, setCached } from "./cache.js";

const log = createLogger("alpaca:market-data");

const DATA_BASE_URL = "https://data.alpaca.markets";

// The Alpaca SDK 0.0.32-preview has a bug: its request() function ignores
// the per-endpoint baseURL, routing market-data calls to the trading API
// (paper-api.alpaca.markets) instead of data.alpaca.markets.
// We bypass the SDK and call the data API directly.

let _config: Config | null = null;

export function initMarketData(config: Config): void {
  _config = config;
}

function dataHeaders(): Record<string, string> {
  if (!_config) throw new Error("initMarketData() not called");
  return {
    "APCA-API-KEY-ID": _config.alpaca.keyId,
    "APCA-API-SECRET-KEY": _config.alpaca.secretKey,
  };
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

async function dataGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, DATA_BASE_URL);
  // Default to IEX feed (free tier); SIP requires a paid subscription
  if (!params?.feed) url.searchParams.set("feed", "iex");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const cacheUrl = url.toString();
  const cached = await getCached<T>(cacheUrl);
  if (cached !== null) return cached;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, { headers: dataHeaders() });

    if (response.status === 429) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`Data API ${path}: 429 rate limited after ${MAX_RETRIES} retries`);
      }
      const retryAfter = response.headers.get("retry-after");
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : BASE_DELAY_MS * Math.pow(2, attempt);
      log.warn("Rate limited, retrying", { path, attempt: attempt + 1, delayMs: delay });
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Data API ${path}: ${response.status} ${await response.text()}`);
    }
    const data = await response.json() as T;
    await setCached(cacheUrl, data);
    return data;
  }

  throw new Error(`Data API ${path}: exhausted retries`);
}

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
  _client: AlpacaClient,
  symbols: string[],
  timeframe: string,
  options: { start?: string; end?: string; limit?: number } = {}
): Promise<Map<string, Bar[]>> {
  const result = new Map<string, Bar[]>();

  const params: Record<string, string> = {
    symbols: symbols.join(","),
    timeframe,
  };
  if (options.start) params.start = options.start;
  if (options.end) params.end = options.end;
  if (options.limit) params.limit = String(options.limit);

  const response = await dataGet<{ bars: Record<string, AlpacaBar[]> }>(
    "/v2/stocks/bars",
    params
  );

  const bars = response.bars ?? response;
  for (const [symbol, rawBars] of Object.entries(bars as Record<string, AlpacaBar[]>)) {
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
  _client: AlpacaClient,
  symbols: string[]
): Promise<Map<string, Snapshot>> {
  const result = new Map<string, Snapshot>();

  const snapshots = await dataGet<Record<string, AlpacaSnapshot>>(
    "/v2/stocks/snapshots",
    { symbols: symbols.join(",") }
  );

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

export interface NewsArticle {
  headline: string;
  symbols: string[];
}

export async function getNews(params: {
  symbols: string;
  start: string;
  end: string;
  limit: number;
  sort: string;
}): Promise<{ news: NewsArticle[] }> {
  return dataGet<{ news: NewsArticle[] }>("/v1beta1/news", {
    symbols: params.symbols,
    start: params.start,
    end: params.end,
    limit: String(params.limit),
    sort: params.sort,
  });
}
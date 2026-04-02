import type { AlpacaClient } from "../alpaca/client.js";
import type { Config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import { scanForGaps, getTradeableSymbols } from "./gap-scanner.js";
import { filterByFloat } from "./float-filter.js";
import { filterByNews, type NewsCandidate } from "./news-filter.js";

const log = createLogger("scanner");

const MAX_WATCHLIST_SIZE = 3;

export interface WatchlistEntry {
  symbol: string;
  gapPct: number;
  price: number;
  volume: number;
  prevClose: number;
  relativeVolume: number;
  hasCatalyst: boolean;
  headline: string | null;
  score: number;
}

function scoreCandidate(c: NewsCandidate, config: Config): number {
  let score = 0;

  // Gap size — bigger gap = higher score
  score += c.gapPct >= config.scanner.prefGapPct ? 30 : 10;

  // Catalyst bonus
  if (c.hasCatalyst) score += 25;

  // Volume (raw volume as a basic proxy until relative volume is calculated)
  if (c.volume > 1_000_000) score += 15;
  else if (c.volume > 500_000) score += 10;
  else if (c.volume > 100_000) score += 5;

  // Price sweet spot ($2–$10 per Warrior Trading preference)
  if (c.price >= 2 && c.price <= 10) score += 10;

  return score;
}

export async function runScanner(
  client: AlpacaClient,
  config: Config
): Promise<WatchlistEntry[]> {
  log.info("Starting pre-market scan...");

  // 1. Get all tradeable symbols
  const symbols = await getTradeableSymbols(client);
  log.info("Tradeable symbols loaded", { count: symbols.length });

  // 2. Gap scan — find stocks gapping up with volume
  const gapCandidates = await scanForGaps(client, symbols, config);

  // 3. Float filter — remove high-float stocks
  const floatFiltered = await filterByFloat(gapCandidates, config);

  // 4. News filter — check for catalysts
  const newsCandidates = await filterByNews(client, floatFiltered);

  // 5. Score and rank
  const scored: WatchlistEntry[] = newsCandidates.map((c) => ({
    symbol: c.symbol,
    gapPct: c.gapPct,
    price: c.price,
    volume: c.volume,
    prevClose: c.prevClose,
    relativeVolume: c.relativeVolume,
    hasCatalyst: c.hasCatalyst,
    headline: c.headline,
    score: scoreCandidate(c, config),
  }));

  scored.sort((a, b) => b.score - a.score);
  const watchlist = scored.slice(0, MAX_WATCHLIST_SIZE);

  log.info("Watchlist built", {
    candidates: scored.length,
    selected: watchlist.length,
    symbols: watchlist.map((w) => w.symbol),
  });

  for (const entry of watchlist) {
    log.info(`  ${entry.symbol}`, {
      gap: `${entry.gapPct.toFixed(1)}%`,
      price: `$${entry.price.toFixed(2)}`,
      catalyst: entry.hasCatalyst,
      score: entry.score,
      headline: entry.headline ?? "none",
    });
  }

  return watchlist;
}

export type { GapCandidate } from "./gap-scanner.js";
export type { NewsCandidate } from "./news-filter.js";

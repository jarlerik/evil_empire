import type { AlpacaClient } from "../alpaca/client.js";
import type { Config } from "../config.js";
import { getSnapshots } from "../alpaca/market-data.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("scanner:gap");

export interface GapCandidate {
  symbol: string;
  gapPct: number;
  price: number;
  volume: number;
  prevClose: number;
  relativeVolume: number;
  premarketHigh: number;
  premarketLow: number;
}

// Alpaca limits snapshot requests to ~200 symbols at a time
const SNAPSHOT_BATCH_SIZE = 200;
// Number of snapshot batches to fetch in parallel
const PARALLEL_BATCH_GROUP = 5;

export async function scanForGaps(
  client: AlpacaClient,
  symbols: string[],
  config: Config
): Promise<GapCandidate[]> {
  const candidates: GapCandidate[] = [];

  // Build all batches
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += SNAPSHOT_BATCH_SIZE) {
    batches.push(symbols.slice(i, i + SNAPSHOT_BATCH_SIZE));
  }

  // Process batches in parallel groups of PARALLEL_BATCH_GROUP
  for (let g = 0; g < batches.length; g += PARALLEL_BATCH_GROUP) {
    const group = batches.slice(g, g + PARALLEL_BATCH_GROUP);
    const snapshotResults = await Promise.all(
      group.map((batch) => getSnapshots(client, batch))
    );

    for (const snapshots of snapshotResults) {
      for (const [symbol, snap] of snapshots) {
        const prevClose = snap.prevDailyBar.close;
        if (prevClose === 0) continue;

        // Use today's open for gap calculation (consistent with historical scanner)
        // currentPrice is used for price filters and candidate reporting
        const openPrice = snap.latestBar.open;
        const currentPrice = snap.latestBar.close || snap.minuteBar.close;
        if (openPrice === 0 || currentPrice === 0) continue;

        const gapPct = ((openPrice - prevClose) / prevClose) * 100;

        // Filter: minimum gap %, price range (use current price for filters)
        if (gapPct < config.scanner.minGapPct) continue;
        if (currentPrice < config.scanner.minPrice) continue;
        if (currentPrice > config.scanner.maxPrice) continue;

        // Volume — use daily bar volume as current session volume
        const volume = snap.latestBar.volume;

        candidates.push({
          symbol,
          gapPct,
          price: currentPrice,
          volume,
          prevClose,
          relativeVolume: 0, // enriched by computeRelativeVolumeBatch in runScanner
          premarketHigh: snap.latestBar.high,
          premarketLow: snap.latestBar.low,
        });
      }
    }
  }

  // Sort by gap % descending, prefer larger gaps
  candidates.sort((a, b) => b.gapPct - a.gapPct);

  log.info("Gap scan complete", {
    scanned: symbols.length,
    candidates: candidates.length,
  });

  return candidates;
}

let _cachedSymbols: string[] | null = null;

export async function getTradeableSymbols(
  client: AlpacaClient
): Promise<string[]> {
  if (_cachedSymbols) return _cachedSymbols;

  const assets = await client.getAssets({
    status: "active",
    asset_class: "us_equity",
  });

  _cachedSymbols = assets
    .filter(
      (a) =>
        a.tradable &&
        a.exchange !== "OTC" &&
        !a.symbol.includes(".")
    )
    .map((a) => a.symbol);

  return _cachedSymbols;
}

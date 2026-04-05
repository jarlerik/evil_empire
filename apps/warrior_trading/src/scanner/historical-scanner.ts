/**
 * Historical Scanner
 *
 * Reconstructs the full scanner pipeline from historical data for a given date.
 * Instead of live snapshots, uses daily bars, historical volume, and date-filtered news.
 */

import type { AlpacaClient } from "../alpaca/client.js";
import type { Config } from "../config.js";
import { getBars, getNews } from "../alpaca/market-data.js";
import { filterByFloat } from "./float-filter.js";
import type { GapCandidate } from "./gap-scanner.js";
import type { NewsCandidate } from "./news-filter.js";
import type { WatchlistEntry } from "./index.js";
import { getTradeableSymbols } from "./gap-scanner.js";
import { createLogger } from "../utils/logger.js";
import type { Bar } from "../utils/bar.js";

const log = createLogger("scanner:historical");

const MAX_WATCHLIST_SIZE = 3;
const RVOL_LOOKBACK_DAYS = 30;

// Catalyst keywords — same as live news-filter
const CATALYST_KEYWORDS = [
  "fda", "approval", "earnings", "beat", "revenue", "contract",
  "partnership", "acquisition", "merger", "ipo", "offering", "buyback",
  "upgrade", "initiated", "patent", "trial", "phase", "breakthrough",
  "guidance", "raised", "increased", "record",
];

function isCatalystHeadline(headline: string): boolean {
  const lower = headline.toLowerCase();
  return CATALYST_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Discover candidates for a historical date by reconstructing the scanner pipeline.
 *
 * Steps:
 * 1. Fetch daily bars for (targetDate - 1) and targetDate for all tradeable symbols
 * 2. Compute gap % from previous close to target date open
 * 3. Filter by price range, minimum gap %
 * 4. Filter by float (shares outstanding — current data as approximation)
 * 5. Compute relative volume from 30-day history
 * 6. Filter by news catalysts from 24h window
 * 7. Score and rank → top 3
 */
export async function runHistoricalScanner(
  client: AlpacaClient,
  config: Config,
  targetDate: string, // YYYY-MM-DD
  prefetchedDailyBars?: Map<string, Bar[]>,
): Promise<WatchlistEntry[]> {
  log.info("Starting historical scan", { date: targetDate });

  // 1. Build gap candidates from daily bars.
  //    When prefetchedDailyBars is provided, we skip per-date API calls entirely
  //    and filter the pre-fetched data in memory.
  const gapCandidates: GapCandidate[] = [];

  if (prefetchedDailyBars) {
    // Fast path: scan pre-fetched bars in memory
    for (const [symbol, bars] of prefetchedDailyBars) {
      if (bars.length < 2) continue;

      const targetBar = bars.find(
        (b) => b.timestamp.toISOString().slice(0, 10) === targetDate
      );
      if (!targetBar) continue;

      const targetIdx = bars.indexOf(targetBar);
      if (targetIdx < 1) continue;
      const prevBar = bars[targetIdx - 1];

      const prevClose = prevBar.close;
      if (prevClose === 0) continue;

      const openPrice = targetBar.open;
      if (openPrice === 0) continue;

      const gapPct = ((openPrice - prevClose) / prevClose) * 100;

      if (gapPct < config.scanner.minGapPct) continue;
      if (openPrice < config.scanner.minPrice) continue;
      if (openPrice > config.scanner.maxPrice) continue;

      gapCandidates.push({
        symbol,
        gapPct,
        price: openPrice,
        volume: targetBar.volume,
        prevClose,
        relativeVolume: 0,
        premarketHigh: targetBar.open,
        premarketLow: Math.min(targetBar.open, targetBar.low),
      });
    }

    log.info("Gap scan from prefetched data", { candidates: gapCandidates.length });
  } else {
    // Original path: fetch per-date with sliding window
    const allSymbols = await getTradeableSymbols(client);
    log.info("Tradeable symbols loaded", { count: allSymbols.length });

    const windowStart = shiftDate(targetDate, -5);
    const windowEnd = targetDate + "T23:59:59Z";

    const SYMBOL_BATCH = 200;

    for (let i = 0; i < allSymbols.length; i += SYMBOL_BATCH) {
      const batch = allSymbols.slice(i, i + SYMBOL_BATCH);

      const barsMap = await getBars(client, batch, "1Day", {
        start: new Date(windowStart).toISOString(),
        end: new Date(windowEnd).toISOString(),
        limit: 10,
      });

      for (const [symbol, bars] of barsMap) {
        if (bars.length < 2) continue;

        const targetBar = bars.find(
          (b) => b.timestamp.toISOString().slice(0, 10) === targetDate
        );
        if (!targetBar) continue;

        const targetIdx = bars.indexOf(targetBar);
        if (targetIdx < 1) continue;
        const prevBar = bars[targetIdx - 1];

        const prevClose = prevBar.close;
        if (prevClose === 0) continue;

        const openPrice = targetBar.open;
        if (openPrice === 0) continue;

        const gapPct = ((openPrice - prevClose) / prevClose) * 100;

        if (gapPct < config.scanner.minGapPct) continue;
        if (openPrice < config.scanner.minPrice) continue;
        if (openPrice > config.scanner.maxPrice) continue;

        // Use the open price as premarketHigh approximation.
        // The daily bar's high is the day's absolute high — using it makes
        // gap-and-go's "break above premarket high" condition impossible to meet.
        // The open price is where premarket trading settled, making it the best
        // proxy we have from daily bars on IEX (no actual premarket data).
        gapCandidates.push({
          symbol,
          gapPct,
          price: openPrice,
          volume: targetBar.volume,
          prevClose,
          relativeVolume: 0,
          premarketHigh: targetBar.open,
          premarketLow: Math.min(targetBar.open, targetBar.low),
        });
      }

      if ((i + SYMBOL_BATCH) % 1000 === 0 || i + SYMBOL_BATCH >= allSymbols.length) {
        log.info("Gap scan progress", {
          processed: Math.min(i + SYMBOL_BATCH, allSymbols.length),
          total: allSymbols.length,
          candidates: gapCandidates.length,
        });
      }
    }
  }

  gapCandidates.sort((a, b) => b.gapPct - a.gapPct);
  log.info("Historical gap scan complete", { candidates: gapCandidates.length });

  for (const c of gapCandidates) {
    log.info("Gap candidate", {
      symbol: c.symbol,
      gap: `${c.gapPct.toFixed(1)}%`,
      price: `$${c.price.toFixed(2)}`,
      prevClose: `$${c.prevClose.toFixed(2)}`,
      volume: c.volume,
    });
  }

  if (gapCandidates.length === 0) {
    log.warn("No gap candidates found for date", { date: targetDate });
    return [];
  }

  // 3. Float filter
  const floatFiltered = await filterByFloat(gapCandidates, config);
  log.info("Float filter complete", {
    input: gapCandidates.length,
    output: floatFiltered.length,
  });

  if (floatFiltered.length === 0) return [];

  // 4. Historical relative volume
  //    Compare target date volume to 30-day average volume ending the day before
  let rvolBarsMap: Map<string, Bar[]>;

  if (prefetchedDailyBars) {
    // Fast path: extract RVOL lookback window from pre-fetched bars
    rvolBarsMap = new Map();
    const rvolEndDate = shiftDate(targetDate, -1);
    for (const candidate of floatFiltered) {
      const allBars = prefetchedDailyBars.get(candidate.symbol);
      if (!allBars) continue;
      // Filter to bars before targetDate, take last RVOL_LOOKBACK_DAYS
      const beforeTarget = allBars.filter(
        (b) => b.timestamp.toISOString().slice(0, 10) <= rvolEndDate
      );
      rvolBarsMap.set(
        candidate.symbol,
        beforeTarget.slice(-RVOL_LOOKBACK_DAYS)
      );
    }
  } else {
    // Original path: fetch RVOL bars per-date
    const rvolStart = shiftDate(targetDate, -(RVOL_LOOKBACK_DAYS + 5));
    const rvolEnd = shiftDate(targetDate, -1) + "T23:59:59Z";
    const rvolSymbols = floatFiltered.map((c) => c.symbol);
    rvolBarsMap = await getBars(client, rvolSymbols, "1Day", {
      start: new Date(rvolStart).toISOString(),
      end: new Date(rvolEnd).toISOString(),
      limit: RVOL_LOOKBACK_DAYS,
    });
  }

  const rvolFiltered: GapCandidate[] = [];
  for (const candidate of floatFiltered) {
    const histBars = rvolBarsMap.get(candidate.symbol);
    if (!histBars || histBars.length === 0) {
      // No history — skip for relative volume
      continue;
    }

    const avgVolume =
      histBars.reduce((sum, b) => sum + b.volume, 0) / histBars.length;
    if (avgVolume === 0) continue;

    const rvol = candidate.volume / avgVolume;
    candidate.relativeVolume = rvol;

    if (rvol >= config.scanner.minRelVolume) {
      rvolFiltered.push(candidate);
    } else {
      log.info("Relative volume rejected", {
        symbol: candidate.symbol,
        gap: `${candidate.gapPct.toFixed(1)}%`,
        price: `$${candidate.price.toFixed(2)}`,
        volume: candidate.volume,
        avgVolume: Math.round(avgVolume),
        rvol: `${rvol.toFixed(2)}x`,
        required: `${config.scanner.minRelVolume}x`,
      });
    }
  }

  log.info("Historical relative volume filter complete", {
    input: floatFiltered.length,
    output: rvolFiltered.length,
    minRelVolume: config.scanner.minRelVolume,
  });

  if (rvolFiltered.length === 0) return [];

  // 5. Historical news filter — 24h window before market open on target date
  const newsEnd = new Date(targetDate + "T14:30:00Z"); // 9:30 AM ET = 14:30 UTC
  const newsStart = new Date(newsEnd.getTime() - 24 * 60 * 60 * 1000);

  const newsMap = new Map<string, { headline: string; isCatalyst: boolean }>();
  const NEWS_BATCH = 20;

  for (let i = 0; i < rvolFiltered.length; i += NEWS_BATCH) {
    const batch = rvolFiltered.slice(i, i + NEWS_BATCH);
    const symbols = batch.map((c) => c.symbol);

    try {
      const response = await getNews({
        symbols: symbols.join(","),
        start: newsStart.toISOString(),
        end: newsEnd.toISOString(),
        limit: 50,
        sort: "desc",
      });

      const articles = response.news ?? [];
      for (const article of articles) {
        for (const sym of article.symbols) {
          if (!newsMap.has(sym)) {
            newsMap.set(sym, {
              headline: article.headline,
              isCatalyst: isCatalystHeadline(article.headline),
            });
          }
        }
      }
    } catch (err) {
      log.warn("Historical news fetch failed", {
        symbols: symbols.join(","),
        error: String(err),
      });
    }
  }

  const newsCandidates: NewsCandidate[] = rvolFiltered.map((c) => {
    const news = newsMap.get(c.symbol);
    return {
      ...c,
      hasCatalyst: news?.isCatalyst ?? false,
      headline: news?.headline ?? null,
    };
  });

  log.info("Historical news filter complete", {
    total: newsCandidates.length,
    withCatalyst: newsCandidates.filter((r) => r.hasCatalyst).length,
  });

  // 6. Score and rank
  const scored: WatchlistEntry[] = newsCandidates.map((c) => ({
    symbol: c.symbol,
    gapPct: c.gapPct,
    price: c.price,
    volume: c.volume,
    prevClose: c.prevClose,
    relativeVolume: c.relativeVolume,
    premarketHigh: c.premarketHigh,
    premarketLow: c.premarketLow,
    hasCatalyst: c.hasCatalyst,
    headline: c.headline,
    score: scoreCandidate(c, config),
  }));

  scored.sort((a, b) => b.score - a.score);
  const watchlist = scored.slice(0, MAX_WATCHLIST_SIZE);

  log.info("Historical watchlist built", {
    date: targetDate,
    candidates: scored.length,
    selected: watchlist.length,
    symbols: watchlist.map((w) => w.symbol),
  });

  for (const entry of watchlist) {
    log.info(`  ${entry.symbol}`, {
      gap: `${entry.gapPct.toFixed(1)}%`,
      price: `$${entry.price.toFixed(2)}`,
      rvol: `${entry.relativeVolume.toFixed(1)}x`,
      catalyst: entry.hasCatalyst,
      score: entry.score,
      headline: entry.headline ?? "none",
    });
  }

  return watchlist;
}

function scoreCandidate(c: NewsCandidate, config: Config): number {
  let score = 0;

  // Gap size
  score += c.gapPct >= config.scanner.prefGapPct ? 30 : 10;

  // Catalyst bonus
  if (c.hasCatalyst) score += 25;

  // Volume
  if (c.volume > 1_000_000) score += 15;
  else if (c.volume > 500_000) score += 10;
  else if (c.volume > 100_000) score += 5;

  // Price sweet spot ($2–$10)
  if (c.price >= 2 && c.price <= 10) score += 10;

  return score;
}

/** Shift a YYYY-MM-DD date by N days */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Pre-fetch all daily bars for the full date range in one pass.
 *
 * Instead of 125 per-day requests (each with a sliding 5-day window),
 * this fetches the entire contiguous range in ~40 symbol-batch requests.
 * The caller should include enough buffer for RVOL lookback (35 days before
 * the earliest target date).
 */
export async function prefetchAllDailyBars(
  client: AlpacaClient,
  config: Config,
  startDate: string, // YYYY-MM-DD, should include RVOL buffer
  endDate: string,   // YYYY-MM-DD
): Promise<Map<string, Bar[]>> {
  const allSymbols = await getTradeableSymbols(client);
  log.info("Prefetching daily bars", {
    symbols: allSymbols.length,
    range: `${startDate} → ${endDate}`,
  });

  const result = new Map<string, Bar[]>();
  const SYMBOL_BATCH = 200;
  // 200 trading days is generous for ~6 months + 35-day buffer
  const LIMIT = 300;

  const start = new Date(startDate + "T00:00:00Z").toISOString();
  const end = new Date(endDate + "T23:59:59Z").toISOString();

  for (let i = 0; i < allSymbols.length; i += SYMBOL_BATCH) {
    const batch = allSymbols.slice(i, i + SYMBOL_BATCH);

    const barsMap = await getBars(client, batch, "1Day", {
      start,
      end,
      limit: LIMIT,
    });

    for (const [symbol, bars] of barsMap) {
      result.set(symbol, bars);
    }

    if ((i + SYMBOL_BATCH) % 1000 === 0 || i + SYMBOL_BATCH >= allSymbols.length) {
      log.info("Prefetch progress", {
        processed: Math.min(i + SYMBOL_BATCH, allSymbols.length),
        total: allSymbols.length,
        symbolsWithBars: result.size,
      });
    }
  }

  log.info("Prefetch complete", { symbolsWithBars: result.size });
  return result;
}

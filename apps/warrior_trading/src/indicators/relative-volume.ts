import type { AlpacaClient } from "../alpaca/client.js";
import { getBars } from "../alpaca/market-data.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("indicator:rvol");

const LOOKBACK_DAYS = 30;

// Full trading session: 4:00 AM ET (pre-market) to 4:00 PM ET (close) = 720 minutes
const FULL_SESSION_MINUTES = 720;
// Pre-market start: 4:00 AM ET in minutes from midnight
const SESSION_START_MINUTES = 4 * 60;
// Market close: 4:00 PM ET in minutes from midnight
const SESSION_END_MINUTES = 16 * 60;

/**
 * Compute what fraction of the trading day has elapsed based on current ET time.
 * Returns a value between 0 and 1. Pre-market (4am) = 0, close (4pm) = 1.
 */
export function computeDayFraction(now: Date = new Date()): number {
  const etStr = now.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const [hourStr, minuteStr] = etStr.split(":");
  const mins = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

  if (mins <= SESSION_START_MINUTES) return 0;
  if (mins >= SESSION_END_MINUTES) return 1;

  return (mins - SESSION_START_MINUTES) / FULL_SESSION_MINUTES;
}

/**
 * Compute relative volume for a single symbol.
 *
 * @param dayFraction - Fraction of trading day elapsed (0–1). When provided,
 *   the historical average is scaled down so pre-market volume isn't compared
 *   against full-day averages. Pass 1 (or omit) for end-of-day comparisons.
 */
export async function computeRelativeVolume(
  client: AlpacaClient,
  symbol: string,
  currentVolume: number,
  dayFraction = 1
): Promise<number> {
  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const barsMap = await getBars(client, [symbol], "1Day", {
    start: start.toISOString(),
    end: end.toISOString(),
    limit: LOOKBACK_DAYS,
  });

  const bars = barsMap.get(symbol);
  if (!bars || bars.length === 0) {
    log.warn("No historical bars for relative volume", { symbol });
    return 0;
  }

  const avgVolume =
    bars.reduce((sum, b) => sum + b.volume, 0) / bars.length;

  if (avgVolume === 0) return 0;

  // Scale the average by what fraction of the day has elapsed
  const clampedFraction = Math.max(dayFraction, 0.01); // avoid division by near-zero
  const scaledAvg = avgVolume * clampedFraction;
  const rvol = currentVolume / scaledAvg;

  log.debug("Relative volume computed", {
    symbol,
    currentVolume,
    avgVolume: Math.round(avgVolume),
    dayFraction: dayFraction.toFixed(2),
    scaledAvg: Math.round(scaledAvg),
    rvol: rvol.toFixed(2),
  });

  return rvol;
}

/**
 * Batch version for multiple symbols.
 *
 * @param dayFraction - Fraction of trading day elapsed (0–1).
 */
export async function computeRelativeVolumeBatch(
  client: AlpacaClient,
  symbolVolumes: Map<string, number>,
  dayFraction = 1
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  const symbols = [...symbolVolumes.keys()];
  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const barsMap = await getBars(client, symbols, "1Day", {
    start: start.toISOString(),
    end: end.toISOString(),
    limit: LOOKBACK_DAYS,
  });

  const clampedFraction = Math.max(dayFraction, 0.01);

  for (const [symbol, currentVolume] of symbolVolumes) {
    const bars = barsMap.get(symbol);
    if (!bars || bars.length === 0) {
      results.set(symbol, 0);
      continue;
    }

    const avgVolume =
      bars.reduce((sum, b) => sum + b.volume, 0) / bars.length;
    const scaledAvg = avgVolume * clampedFraction;
    results.set(symbol, scaledAvg === 0 ? 0 : currentVolume / scaledAvg);
  }

  return results;
}

import type { AlpacaClient } from "../alpaca/client.js";
import { getBars } from "../alpaca/market-data.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("indicator:rvol");

const LOOKBACK_DAYS = 30;

export async function computeRelativeVolume(
  client: AlpacaClient,
  symbol: string,
  currentVolume: number
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

  const rvol = currentVolume / avgVolume;

  log.debug("Relative volume computed", {
    symbol,
    currentVolume,
    avgVolume: Math.round(avgVolume),
    rvol: rvol.toFixed(2),
  });

  return rvol;
}

// Batch version for multiple symbols
export async function computeRelativeVolumeBatch(
  client: AlpacaClient,
  symbolVolumes: Map<string, number>
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

  for (const [symbol, currentVolume] of symbolVolumes) {
    const bars = barsMap.get(symbol);
    if (!bars || bars.length === 0) {
      results.set(symbol, 0);
      continue;
    }

    const avgVolume =
      bars.reduce((sum, b) => sum + b.volume, 0) / bars.length;
    results.set(symbol, avgVolume === 0 ? 0 : currentVolume / avgVolume);
  }

  return results;
}

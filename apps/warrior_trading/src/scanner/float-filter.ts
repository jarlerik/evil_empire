import type { Config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import type { GapCandidate } from "./gap-scanner.js";

const log = createLogger("scanner:float");

interface AssetDetails {
  symbol: string;
  shares_outstanding?: number;
}

// The SDK Asset type doesn't include shares_outstanding,
// so we hit the REST API directly for the full asset detail.
async function fetchAssetDetails(
  symbol: string,
  config: Config
): Promise<AssetDetails | null> {
  const baseUrl = config.alpaca.paper
    ? "https://paper-api.alpaca.markets"
    : "https://api.alpaca.markets";

  try {
    const response = await fetch(`${baseUrl}/v2/assets/${symbol}`, {
      headers: {
        "APCA-API-KEY-ID": config.alpaca.keyId,
        "APCA-API-SECRET-KEY": config.alpaca.secretKey,
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    return {
      symbol: data.symbol as string,
      shares_outstanding: data.shares_outstanding as number | undefined,
    };
  } catch {
    log.warn("Failed to fetch asset details", { symbol });
    return null;
  }
}

export async function filterByFloat(
  candidates: GapCandidate[],
  config: Config
): Promise<GapCandidate[]> {
  const results: GapCandidate[] = [];

  // Fetch asset details in parallel batches
  const BATCH_SIZE = 10;
  const batches: GapCandidate[][] = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    batches.push(candidates.slice(i, i + BATCH_SIZE));
  }

  const allDetails = await Promise.all(
    batches.map((batch) =>
      Promise.all(batch.map((c) => fetchAssetDetails(c.symbol, config)))
    )
  );

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const details = allDetails[b];

    for (let j = 0; j < batch.length; j++) {
      const detail = details[j];
      const candidate = batch[j];

      if (!detail || detail.shares_outstanding === undefined) {
        // No float data available — include but flag it
        log.debug("No float data, including anyway", {
          symbol: candidate.symbol,
        });
        results.push(candidate);
        continue;
      }

      // Use shares_outstanding as proxy for float
      if (detail.shares_outstanding <= config.scanner.maxFloat) {
        results.push(candidate);
      } else {
        log.debug("Filtered out by float", {
          symbol: candidate.symbol,
          sharesOutstanding: detail.shares_outstanding,
          maxFloat: config.scanner.maxFloat,
        });
      }
    }
  }

  log.info("Float filter complete", {
    input: candidates.length,
    output: results.length,
  });

  return results;
}

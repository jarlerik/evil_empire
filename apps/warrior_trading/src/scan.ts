/**
 * Scanner CLI — Run the pre-market scanner without starting the trading engine.
 *
 * Usage:
 *   bun run src/scan.ts                  # Live scan (uses current snapshots)
 *   bun run src/scan.ts 2026-04-08       # Historical scan for a specific date
 */

import { loadConfig } from "./config.js";
import { createAlpacaClient } from "./alpaca/client.js";
import { initMarketData } from "./alpaca/market-data.js";
import { runScanner } from "./scanner/index.js";
import { runHistoricalScanner } from "./scanner/historical-scanner.js";
import type { WatchlistEntry } from "./scanner/index.js";

function printWatchlist(watchlist: WatchlistEntry[], mode: string): void {
  if (watchlist.length === 0) {
    console.log("\nNo candidates passed all filters.");
    return;
  }

  console.log(`\n=== Scanner Results (${mode}) ===\n`);
  console.log(
    "Symbol".padEnd(8) +
    "Gap %".padStart(8) +
    "Price".padStart(10) +
    "RVOL".padStart(8) +
    "Score".padStart(7) +
    "Catalyst".padStart(10) +
    "  Headline"
  );
  console.log("-".repeat(90));

  for (const entry of watchlist) {
    console.log(
      entry.symbol.padEnd(8) +
      `${entry.gapPct.toFixed(1)}%`.padStart(8) +
      `$${entry.price.toFixed(2)}`.padStart(10) +
      `${entry.relativeVolume.toFixed(1)}x`.padStart(8) +
      String(entry.score).padStart(7) +
      (entry.hasCatalyst ? "YES" : "no").padStart(10) +
      "  " + (entry.headline ?? "—")
    );
  }

  console.log("");
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const targetDate = args[0]; // optional YYYY-MM-DD

  const config = loadConfig();
  const client = createAlpacaClient(config);
  initMarketData(config);

  try {
    let watchlist: WatchlistEntry[];

    if (targetDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        console.error("Invalid date format: must be YYYY-MM-DD");
        process.exit(1);
      }
      console.log(`Running historical scan for ${targetDate}...`);
      watchlist = await runHistoricalScanner(client, config, targetDate);
      printWatchlist(watchlist, `historical: ${targetDate}`);
    } else {
      console.log("Running live pre-market scan...");
      watchlist = await runScanner(client, config);
      printWatchlist(watchlist, "live");
    }
  } catch (err) {
    console.error("Scanner failed:", String(err));
    process.exit(1);
  }
}

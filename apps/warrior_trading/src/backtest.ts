/**
 * Backtest CLI Entry Point
 *
 * Usage:
 *   bun run src/backtest.ts <SYMBOL> <START> <END> [--equity 25000] [--slippage 1] [--commission 0.005] [--dashboard]
 *
 * Example:
 *   bun run src/backtest.ts AAPL 2026-01-02 2026-03-31
 *   bun run src/backtest.ts TSLA 2025-06-01 2025-12-31 --equity 50000 --dashboard
 */

import { loadConfig } from "./config.js";
import { createAlpacaClient } from "./alpaca/client.js";
import { getBars, initMarketData } from "./alpaca/market-data.js";
import { BacktestEngine } from "./backtest/backtest-engine.js";
import { startDashboard } from "./dashboard/server.js";
import { DEFAULT_BACKTEST_CONFIG, type BacktestConfig } from "./backtest/types.js";
import type { Bar } from "./utils/bar.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("backtest");

interface ParsedArgs {
  btConfig: BacktestConfig;
  dashboard: boolean;
}

function parseArgs(): ParsedArgs {
  const args = Bun.argv.slice(2);

  if (args.length < 3) {
    console.log("Usage: bun run src/backtest.ts <SYMBOL> <START> <END> [options]");
    console.log("");
    console.log("Options:");
    console.log("  --equity <number>      Starting equity (default: 25000)");
    console.log("  --slippage <number>    Slippage ticks (default: 1)");
    console.log("  --commission <number>  Commission per share (default: 0.005)");
    console.log("  --dashboard            Open dashboard for visual replay");
    console.log("");
    console.log("Example:");
    console.log("  bun run src/backtest.ts AAPL 2026-01-02 2026-03-31");
    console.log("  bun run src/backtest.ts TSLA 2025-06-01 2025-12-31 --equity 50000 --dashboard");
    process.exit(1);
  }

  const symbol = args[0];
  const startDate = args[1];
  const endDate = args[2];

  // Validate inputs
  if (!/^[A-Z]{1,5}$/.test(symbol)) {
    console.error(`Invalid symbol "${symbol}": must be 1-5 uppercase letters`);
    process.exit(1);
  }
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
    console.error(`Invalid date format: must be YYYY-MM-DD`);
    process.exit(1);
  }

  // Parse optional flags
  let equity = DEFAULT_BACKTEST_CONFIG.startingEquity;
  let slippage = DEFAULT_BACKTEST_CONFIG.slippageTicks;
  let commission = DEFAULT_BACKTEST_CONFIG.commissionPerShare;
  let dashboard = false;

  for (let i = 3; i < args.length; i++) {
    if (args[i] === "--equity" && args[i + 1]) {
      equity = parseFloat(args[++i]);
    } else if (args[i] === "--slippage" && args[i + 1]) {
      slippage = parseFloat(args[++i]);
    } else if (args[i] === "--commission" && args[i + 1]) {
      commission = parseFloat(args[++i]);
    } else if (args[i] === "--dashboard") {
      dashboard = true;
    }
  }

  return {
    btConfig: {
      symbol,
      startDate,
      endDate,
      startingEquity: equity,
      commissionPerShare: commission,
      slippageTicks: slippage,
      marketOpenHour: DEFAULT_BACKTEST_CONFIG.marketOpenHour,
      marketOpenMinute: DEFAULT_BACKTEST_CONFIG.marketOpenMinute,
      marketCloseHour: DEFAULT_BACKTEST_CONFIG.marketCloseHour,
      marketCloseMinute: DEFAULT_BACKTEST_CONFIG.marketCloseMinute,
    },
    dashboard,
  };
}

async function fetchBars(
  btConfig: BacktestConfig
): Promise<Bar[]> {
  const config = loadConfig();
  const client = createAlpacaClient(config);
  initMarketData(config);

  console.log(`Fetching bars for ${btConfig.symbol}...`);

  const allBars: Bar[] = [];
  let start = new Date(btConfig.startDate).toISOString();
  const end = new Date(btConfig.endDate + "T23:59:59").toISOString();

  // Paginate in 10k-bar chunks
  while (true) {
    const barsMap = await getBars(client, [btConfig.symbol], "1Min", {
      start,
      end,
      limit: 10000,
    });

    const bars = barsMap.get(btConfig.symbol);
    if (!bars || bars.length === 0) break;

    allBars.push(...bars);

    // If we got less than the limit, we're done
    if (bars.length < 10000) break;

    // Next page starts after the last bar
    const lastTimestamp = bars[bars.length - 1].timestamp;
    start = new Date(lastTimestamp.getTime() + 1).toISOString();
  }

  return allBars;
}

if (import.meta.main) {
  const { btConfig, dashboard } = parseArgs();
  const config = loadConfig();

  fetchBars(btConfig)
    .then(async (bars) => {
      console.log(`${bars.length.toLocaleString()} bars loaded`);

      if (bars.length === 0) {
        console.error("No bars found for the given date range");
        process.exit(1);
      }

      // Start dashboard if requested
      if (dashboard) {
        startDashboard({
          type: "init",
          mode: "backtest",
          symbol: btConfig.symbol,
          config: {
            strategies: [...config.trading.strategies],
            riskPerTradePct: config.risk.riskPerTradePct,
            rrRatio: config.risk.rrRatio,
            trailingStopPct: config.trading.trailingStopPct,
            timeStopBars: config.trading.timeStopBars,
            startingEquity: btConfig.startingEquity,
          },
          backtest: {
            startDate: btConfig.startDate,
            endDate: btConfig.endDate,
            totalBars: bars.length,
          },
        });
        console.log("Waiting for play command from dashboard...\n");
      } else {
        console.log("Running backtest...\n");
      }

      const engine = new BacktestEngine(config, btConfig);
      const result = await engine.run(bars, dashboard);

      BacktestEngine.printSummary(result);

      const { jsonFile, csvFile } = await BacktestEngine.writeResults(result);
      console.log("Results written to:");
      console.log(`  ${jsonFile}`);
      console.log(`  ${csvFile}`);

      // If dashboard is running, keep process alive
      if (!dashboard) {
        process.exit(0);
      }
    })
    .catch((err) => {
      log.error("Backtest failed", { error: String(err) });
      process.exit(1);
    });
}

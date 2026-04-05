/**
 * Simulation CLI Entry Point
 *
 * Picks a random (or specified) historical trading day, runs the full scanner
 * pipeline to discover candidates, then backtests each candidate through the algo.
 *
 * Usage:
 *   bun run src/simulation.ts [DATE] [--equity 25000] [--days N] [--from DATE] [--dashboard]
 *
 * Examples:
 *   bun run src/simulation.ts                          # random day from past year
 *   bun run src/simulation.ts 2025-11-15               # specific date
 *   bun run src/simulation.ts --days 5                 # run 5 random days
 *   bun run src/simulation.ts --from 2026-03-01 --days 30  # 30 consecutive trading days
 *   bun run src/simulation.ts 2025-11-15 --dashboard   # with visual replay
 */

import { loadConfig } from "./config.js";
import { createAlpacaClient } from "./alpaca/client.js";
import { getBars, initMarketData } from "./alpaca/market-data.js";
import { preloadCache, getCacheStats, resetCacheStats } from "./alpaca/cache.js";
import { runHistoricalScanner } from "./scanner/historical-scanner.js";
import { BacktestEngine } from "./backtest/backtest-engine.js";
import { startDashboard } from "./dashboard/server.js";
import { DEFAULT_BACKTEST_CONFIG, type BacktestConfig, type BacktestResult } from "./backtest/types.js";
import { computeStats, formatStats } from "./backtest/stats.js";
import type { Bar } from "./utils/bar.js";
import type { WatchlistEntry } from "./scanner/index.js";
import { createLogger } from "./utils/logger.js";
import { mkdir } from "fs/promises";

const log = createLogger("simulation");

interface SimArgs {
  dates: string[];       // specific dates, or empty for random
  from: string | null;   // start date for consecutive days
  numDays: number;       // how many days to simulate
  equity: number;
  dashboard: boolean;
}

function parseArgs(): SimArgs {
  const args = Bun.argv.slice(2);

  let dates: string[] = [];
  let from: string | null = null;
  let numDays = 1;
  let equity = DEFAULT_BACKTEST_CONFIG.startingEquity;
  let dashboard = false;

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--equity" && args[i + 1]) {
      equity = parseFloat(args[++i]);
    } else if (args[i] === "--days" && args[i + 1]) {
      numDays = parseInt(args[++i], 10);
    } else if (args[i] === "--from" && args[i + 1]) {
      from = args[++i];
      if (!datePattern.test(from)) {
        console.error(`Invalid --from date "${from}": must be YYYY-MM-DD`);
        process.exit(1);
      }
    } else if (args[i] === "--dashboard") {
      dashboard = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      printUsage();
      process.exit(0);
    } else if (datePattern.test(args[i])) {
      dates.push(args[i]);
    } else {
      console.error(`Unknown argument: ${args[i]}`);
      printUsage();
      process.exit(1);
    }
  }

  // If specific dates given, numDays = dates.length
  if (dates.length > 0) {
    numDays = dates.length;
  }

  return { dates, from, numDays, equity, dashboard };
}

function printUsage(): void {
  console.log("Usage: bun run src/simulation.ts [DATE...] [options]");
  console.log("");
  console.log("Arguments:");
  console.log("  DATE               One or more dates (YYYY-MM-DD) to simulate");
  console.log("                     If omitted, picks random trading day(s)");
  console.log("");
  console.log("Options:");
  console.log("  --from <date>      Start date for consecutive trading days (use with --days)");
  console.log("  --days <number>    Number of days to simulate (default: 1)");
  console.log("  --equity <number>  Starting equity (default: 25000)");
  console.log("  --dashboard        Open dashboard for visual replay");
  console.log("  --help, -h         Show this help");
  console.log("");
  console.log("Examples:");
  console.log("  bun run src/simulation.ts                              # 1 random day");
  console.log("  bun run src/simulation.ts 2025-11-15                   # specific date");
  console.log("  bun run src/simulation.ts --days 5                     # 5 random days");
  console.log("  bun run src/simulation.ts --from 2026-03-01 --days 30  # 30 consecutive trading days");
  console.log("  bun run src/simulation.ts --days 10 --equity 50000");
}

/**
 * Generate N consecutive weekdays starting from a given date.
 * Skips weekends; holidays may still be included but will produce 0 candidates.
 */
function getConsecutiveTradingDays(from: string, count: number): string[] {
  const days: string[] = [];
  const current = new Date(from + "T12:00:00Z"); // noon to avoid DST edge cases

  while (days.length < count) {
    const dow = current.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.push(current.toISOString().slice(0, 10));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

/**
 * Pick N random trading days from the past year.
 * Avoids weekends; holidays may still be picked but will produce 0 candidates.
 */
function pickRandomTradingDays(count: number): string[] {
  const days: string[] = [];
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const totalCalendarDays = Math.floor(
    (now.getTime() - oneYearAgo.getTime()) / (24 * 60 * 60 * 1000)
  );

  const picked = new Set<string>();
  let attempts = 0;

  while (picked.size < count && attempts < count * 20) {
    attempts++;
    const offsetDays = Math.floor(Math.random() * totalCalendarDays);
    const candidate = new Date(oneYearAgo.getTime() + offsetDays * 24 * 60 * 60 * 1000);

    // Skip weekends
    const dow = candidate.getUTCDay();
    if (dow === 0 || dow === 6) continue;

    // Skip dates too recent (need market to have closed)
    const dateStr = candidate.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);
    if (dateStr >= todayStr) continue;

    picked.add(dateStr);
  }

  return Array.from(picked).sort();
}

async function fetchDayBars(
  symbol: string,
  date: string,
  config: ReturnType<typeof loadConfig>
): Promise<Bar[]> {
  const client = createAlpacaClient(config);

  const allBars: Bar[] = [];
  let start = new Date(date + "T00:00:00").toISOString();
  const end = new Date(date + "T23:59:59").toISOString();

  while (true) {
    const barsMap = await getBars(client, [symbol], "1Min", {
      start,
      end,
      limit: 10000,
    });

    const bars = barsMap.get(symbol);
    if (!bars || bars.length === 0) break;

    allBars.push(...bars);
    if (bars.length < 10000) break;

    const lastTimestamp = bars[bars.length - 1].timestamp;
    start = new Date(lastTimestamp.getTime() + 1).toISOString();
  }

  return allBars;
}

interface DayResult {
  date: string;
  candidates: WatchlistEntry[];
  symbolResults: {
    symbol: string;
    result: BacktestResult;
  }[];
}

async function simulateDay(
  date: string,
  equity: number,
  config: ReturnType<typeof loadConfig>,
  dashboard: boolean
): Promise<DayResult> {
  const client = createAlpacaClient(config);
  initMarketData(config);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Simulating: ${date}`);
  console.log(`${"=".repeat(60)}`);

  // 1. Run historical scanner
  console.log("\nRunning historical scanner...");
  const candidates = await runHistoricalScanner(client, config, date);

  if (candidates.length === 0) {
    console.log("  No candidates found for this date.");
    return { date, candidates: [], symbolResults: [] };
  }

  console.log(`\nCandidates found: ${candidates.length}`);
  for (const c of candidates) {
    console.log(
      `  ${c.symbol.padEnd(6)} gap ${c.gapPct.toFixed(1)}%  ` +
      `price $${c.price.toFixed(2)}  rvol ${c.relativeVolume.toFixed(1)}x  ` +
      `catalyst: ${c.hasCatalyst ? "YES" : "no"}  score: ${c.score}`
    );
    if (c.headline) {
      console.log(`         "${c.headline}"`);
    }
  }

  // 2. For each candidate, fetch 1-min bars and run backtest
  const symbolResults: DayResult["symbolResults"] = [];

  for (const candidate of candidates) {
    console.log(`\nFetching bars for ${candidate.symbol}...`);
    const bars = await fetchDayBars(candidate.symbol, date, config);

    if (bars.length === 0) {
      console.log(`  No bars found for ${candidate.symbol} on ${date}`);
      continue;
    }

    console.log(`  ${bars.length} bars loaded. Running algo...`);

    const btConfig: BacktestConfig = {
      symbol: candidate.symbol,
      startDate: date,
      endDate: date,
      startingEquity: equity,
      commissionPerShare: DEFAULT_BACKTEST_CONFIG.commissionPerShare,
      slippageTicks: DEFAULT_BACKTEST_CONFIG.slippageTicks,
      marketOpenHour: DEFAULT_BACKTEST_CONFIG.marketOpenHour,
      marketOpenMinute: DEFAULT_BACKTEST_CONFIG.marketOpenMinute,
      marketCloseHour: DEFAULT_BACKTEST_CONFIG.marketCloseHour,
      marketCloseMinute: DEFAULT_BACKTEST_CONFIG.marketCloseMinute,
    };

    // Start dashboard for first candidate only
    if (dashboard && symbolResults.length === 0) {
      startDashboard({
        type: "init",
        mode: "backtest",
        symbol: candidate.symbol,
        config: {
          strategies: [...config.trading.strategies],
          riskPerTradePct: config.risk.riskPerTradePct,
          rrRatio: config.risk.rrRatio,
          trailingStopPct: config.trading.trailingStopPct,
          timeStopBars: config.trading.timeStopBars,
          startingEquity: equity,
        },
        backtest: {
          startDate: date,
          endDate: date,
          totalBars: bars.length,
        },
      });
      console.log("Dashboard started, waiting for play command...\n");
    }

    const engine = new BacktestEngine(config, btConfig);
    const result = await engine.run(bars, dashboard && symbolResults.length === 0);

    symbolResults.push({ symbol: candidate.symbol, result });

    // Print per-symbol summary
    const { stats } = result;
    const pnlColor = stats.netPnL >= 0 ? "\x1b[32m" : "\x1b[31m";
    console.log(
      `  ${candidate.symbol}: ${stats.totalTrades} trades, ` +
      `${pnlColor}$${stats.netPnL.toFixed(2)}\x1b[0m P&L, ` +
      `${(stats.winRate * 100).toFixed(0)}% win rate`
    );
  }

  return { date, candidates, symbolResults };
}

function printAggregateResults(dayResults: DayResult[], equity: number): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("  SIMULATION SUMMARY");
  console.log(`${"=".repeat(60)}`);

  let totalTrades = 0;
  let totalPnL = 0;
  let totalWins = 0;
  let daysWithCandidates = 0;
  let daysWithTrades = 0;
  const allStrategyPnL: Record<string, number> = {};

  for (const day of dayResults) {
    if (day.candidates.length > 0) daysWithCandidates++;

    let dayTrades = 0;
    let dayPnL = 0;

    for (const { result } of day.symbolResults) {
      totalTrades += result.stats.totalTrades;
      totalWins += result.stats.winners;
      dayTrades += result.stats.totalTrades;
      dayPnL += result.stats.netPnL;
      totalPnL += result.stats.netPnL;

      for (const [strat, breakdown] of Object.entries(result.stats.strategyBreakdown)) {
        allStrategyPnL[strat] = (allStrategyPnL[strat] ?? 0) + breakdown.totalPnL;
      }
    }

    if (dayTrades > 0) daysWithTrades++;

    const pnlColor = dayPnL >= 0 ? "\x1b[32m" : "\x1b[31m";
    const candidateSyms = day.candidates.map((c) => c.symbol).join(", ");
    console.log(
      `\n  ${day.date}  candidates: [${candidateSyms || "none"}]  ` +
      `trades: ${dayTrades}  P&L: ${pnlColor}$${dayPnL.toFixed(2)}\x1b[0m`
    );
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Days simulated:      ${dayResults.length}`);
  console.log(`  Days with candidates: ${daysWithCandidates}`);
  console.log(`  Days with trades:    ${daysWithTrades}`);
  console.log(`  Total trades:        ${totalTrades}`);

  if (totalTrades > 0) {
    const winRate = totalWins / totalTrades;
    const pnlColor = totalPnL >= 0 ? "\x1b[32m" : "\x1b[31m";
    console.log(`  Win rate:            ${(winRate * 100).toFixed(1)}%`);
    console.log(`  Total P&L:           ${pnlColor}$${totalPnL.toFixed(2)}\x1b[0m`);
    console.log(`  Return:              ${pnlColor}${((totalPnL / equity) * 100).toFixed(2)}%\x1b[0m`);

    if (Object.keys(allStrategyPnL).length > 0) {
      console.log(`\n  Strategy P&L:`);
      for (const [name, pnl] of Object.entries(allStrategyPnL).sort(
        (a, b) => b[1] - a[1]
      )) {
        const c = pnl >= 0 ? "\x1b[32m" : "\x1b[31m";
        console.log(`    ${name.padEnd(18)} ${c}$${pnl.toFixed(2)}\x1b[0m`);
      }
    }
  } else {
    console.log("  No trades executed across all simulated days.");
  }

  console.log("");
}

async function writeSimulationResults(
  dayResults: DayResult[]
): Promise<string> {
  const dir = "results";
  await mkdir(dir, { recursive: true });

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const filename = `${dir}/simulation-${timestamp}.json`;

  const output = dayResults.map((day) => ({
    date: day.date,
    candidates: day.candidates.map((c) => ({
      symbol: c.symbol,
      gapPct: c.gapPct,
      price: c.price,
      relativeVolume: c.relativeVolume,
      hasCatalyst: c.hasCatalyst,
      headline: c.headline,
      score: c.score,
    })),
    results: day.symbolResults.map(({ symbol, result }) => ({
      symbol,
      trades: result.trades.length,
      netPnL: result.stats.netPnL,
      winRate: result.stats.winRate,
      strategyBreakdown: result.stats.strategyBreakdown,
    })),
  }));

  await Bun.write(filename, JSON.stringify(output, null, 2));
  return filename;
}

if (import.meta.main) {
  const simArgs = parseArgs();
  const config = loadConfig();

  // Resolve dates: explicit dates > --from consecutive > random
  const dates =
    simArgs.dates.length > 0
      ? simArgs.dates
      : simArgs.from
        ? getConsecutiveTradingDays(simArgs.from, simArgs.numDays)
        : pickRandomTradingDays(simArgs.numDays);

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║                 WARRIOR TRADING SIMULATOR               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Dates: ${dates.join(", ")}`);
  console.log(`  Starting equity: $${simArgs.equity.toLocaleString()}`);
  console.log(`  Strategies: ${config.trading.strategies.join(", ")}`);

  (async () => {
    // Preload cache into memory for fast lookups
    const cacheCount = await preloadCache();
    console.log(`  Cache preloaded: ${cacheCount.toLocaleString()} entries`);
    resetCacheStats();

    const dayResults: DayResult[] = [];

    for (const date of dates) {
      try {
        const result = await simulateDay(
          date,
          simArgs.equity,
          config,
          simArgs.dashboard
        );
        dayResults.push(result);
      } catch (err) {
        log.error("Day simulation failed", { date, error: String(err) });
        console.error(`\nError simulating ${date}: ${err}`);
        dayResults.push({ date, candidates: [], symbolResults: [] });
      }
    }

    // Aggregate results
    printAggregateResults(dayResults, simArgs.equity);

    // Print cache stats
    const stats = getCacheStats();
    console.log(`  Cache stats: ${stats.hits} hits, ${stats.misses} misses`);
    if (stats.misses > 0) {
      console.log(`  ⚠ ${stats.misses} API calls made (should be 0 on repeat runs)`);
    } else {
      console.log(`  ✓ Zero API calls — fully cached!`);
    }

    // Write results
    const filename = await writeSimulationResults(dayResults);
    console.log(`Results written to: ${filename}`);

    if (!simArgs.dashboard) {
      process.exit(0);
    }
  })().catch((err) => {
    log.error("Simulation failed", { error: String(err) });
    console.error(`Simulation failed: ${err}`);
    process.exit(1);
  });
}

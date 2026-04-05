/**
 * Multi-Config Simulation Runner
 *
 * Preloads the API cache into memory ONCE, then runs multiple strategy
 * configurations against the same data. Much faster than spawning
 * separate processes that each do their own disk I/O.
 *
 * Usage:
 *   bun run src/multi-sim.ts
 */

import { preloadCache, getCacheStats, resetCacheStats } from "./alpaca/cache.js";
import { createAlpacaClient } from "./alpaca/client.js";
import { getBars, initMarketData } from "./alpaca/market-data.js";
import { runHistoricalScanner, prefetchAllDailyBars } from "./scanner/historical-scanner.js";
import { BacktestEngine } from "./backtest/backtest-engine.js";
import { DEFAULT_BACKTEST_CONFIG, type BacktestConfig, type BacktestResult } from "./backtest/types.js";
import type { Bar } from "./utils/bar.js";
import type { WatchlistEntry } from "./scanner/index.js";
import { createLogger } from "./utils/logger.js";
import type { StrategyName } from "./config.js";

const log = createLogger("multi-sim");

interface SimConfig {
  name: string;
  env: Record<string, string>;
}

// ── Cross-validation: best configs on original Oct 2025 - Mar 2026 range ──
const SIM_CONFIGS: SimConfig[] = [
  // R4 original best
  {
    name: "R4-BEST: risk1% trail6% time15 cool10",
    env: {
      STRATEGIES: "ma-pullback",
      FIRST_HOUR_ONLY: "true",
      RISK_PER_TRADE_PCT: "1.0",
      TRAILING_STOP_PCT: "6",
      TIME_STOP_BARS: "15",
      COOLDOWN_BARS: "10",
    },
  },
  // R6 best: cooldown 20
  {
    name: "R6-BEST: risk1% trail6% time15 cool20",
    env: {
      STRATEGIES: "ma-pullback",
      FIRST_HOUR_ONLY: "true",
      RISK_PER_TRADE_PCT: "1.0",
      TRAILING_STOP_PCT: "6",
      TIME_STOP_BARS: "15",
      COOLDOWN_BARS: "20",
    },
  },
  // Default risk 1.5%
  {
    name: "DEFAULT: risk1.5% first hour",
    env: {
      STRATEGIES: "ma-pullback",
      FIRST_HOUR_ONLY: "true",
    },
  },
  // Cooldown 20 + time stop 15 only (no trail override)
  {
    name: "SIMPLE: time15 + cool20 (default risk 1.5%)",
    env: {
      STRATEGIES: "ma-pullback",
      FIRST_HOUR_ONLY: "true",
      TIME_STOP_BARS: "15",
      COOLDOWN_BARS: "20",
    },
  },
  // R5A best
  {
    name: "R5A-BEST: risk0.75% time15",
    env: {
      STRATEGIES: "ma-pullback",
      FIRST_HOUR_ONLY: "true",
      RISK_PER_TRADE_PCT: "0.75",
      TIME_STOP_BARS: "15",
    },
  },
];

function shiftDateByDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function getConsecutiveTradingDays(from: string, count: number): string[] {
  const days: string[] = [];
  const current = new Date(from + "T12:00:00Z");
  while (days.length < count) {
    const dow = current.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.push(current.toISOString().slice(0, 10));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

function loadConfigWithOverrides(overrides: Record<string, string>) {
  // Set env vars temporarily
  const originals: Record<string, string | undefined> = {};
  for (const [key, val] of Object.entries(overrides)) {
    originals[key] = Bun.env[key];
    Bun.env[key] = val;
  }

  // Import and call loadConfig fresh
  const { loadConfig } = require("./config.js");
  const config = loadConfig();

  // Restore env vars
  for (const [key] of Object.entries(overrides)) {
    if (originals[key] === undefined) {
      delete Bun.env[key];
    } else {
      Bun.env[key] = originals[key];
    }
  }

  return config;
}

interface DayData {
  date: string;
  candidates: WatchlistEntry[];
  barsBySymbol: Map<string, Bar[]>;
}

async function fetchDayBars(
  symbol: string,
  date: string,
  config: ReturnType<typeof loadConfigWithOverrides>
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

interface SimResult {
  name: string;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  returnPct: number;
  daysWithTrades: number;
  strategyPnL: Record<string, number>;
  strategyTrades: Record<string, number>;
}

async function runSimWithConfig(
  simConfig: SimConfig,
  dates: string[],
  preloadedData: Map<string, DayData>,
  equity: number,
): Promise<SimResult> {
  const config = loadConfigWithOverrides(simConfig.env);

  let totalTrades = 0;
  let totalPnL = 0;
  let totalWins = 0;
  let daysWithTrades = 0;
  const strategyPnL: Record<string, number> = {};
  const strategyTrades: Record<string, number> = {};

  for (const date of dates) {
    const dayData = preloadedData.get(date);
    if (!dayData || dayData.candidates.length === 0) continue;

    let dayTrades = 0;

    for (const candidate of dayData.candidates) {
      const bars = dayData.barsBySymbol.get(candidate.symbol);
      if (!bars || bars.length === 0) continue;

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

      const engine = new BacktestEngine(config, btConfig);
      const result = await engine.run(bars, false);

      totalTrades += result.stats.totalTrades;
      totalWins += result.stats.winners;
      totalPnL += result.stats.netPnL;
      dayTrades += result.stats.totalTrades;

      for (const [strat, breakdown] of Object.entries(result.stats.strategyBreakdown)) {
        strategyPnL[strat] = (strategyPnL[strat] ?? 0) + breakdown.totalPnL;
        strategyTrades[strat] = (strategyTrades[strat] ?? 0) + breakdown.trades;
      }
    }

    if (dayTrades > 0) daysWithTrades++;
  }

  return {
    name: simConfig.name,
    totalTrades,
    winRate: totalTrades > 0 ? totalWins / totalTrades : 0,
    totalPnL,
    returnPct: (totalPnL / equity) * 100,
    daysWithTrades,
    strategyPnL,
    strategyTrades,
  };
}

if (import.meta.main) {
  const startTime = Date.now();
  const equity = 25_000;
  const dates = getConsecutiveTradingDays("2025-10-01", 125);

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   CROSS-VALIDATION: Oct 2025 - Mar 2026                ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  console.log(`  Trading days: ${dates.length}`);
  console.log(`  Configs to test: ${SIM_CONFIGS.length}`);
  console.log(`  Equity: $${equity.toLocaleString()}`);

  // Step 1: Preload cache
  console.log("\n[1/3] Preloading API cache into memory...");
  const cacheCount = await preloadCache();
  console.log(`  ${cacheCount.toLocaleString()} cached responses loaded`);
  resetCacheStats();

  // Step 2: Fetch all data once using default config
  console.log("\n[2/3] Fetching all day data (scanner + bars)...");
  const { loadConfig } = await import("./config.js");
  const defaultConfig = loadConfig();
  const client = createAlpacaClient(defaultConfig);
  initMarketData(defaultConfig);

  // Pre-fetch all daily bars for the full date range in ~40 API calls
  // instead of ~5,000 per-day sliding-window calls.
  // Buffer: 35 days before earliest date covers RVOL 30-day lookback + weekends.
  const prefetchStart = shiftDateByDays(dates[0], -35);
  const prefetchEnd = dates[dates.length - 1];
  console.log(`  Pre-fetching daily bars: ${prefetchStart} → ${prefetchEnd}`);
  const allDailyBars = await prefetchAllDailyBars(
    client,
    defaultConfig,
    prefetchStart,
    prefetchEnd,
  );
  console.log(`  ${allDailyBars.size.toLocaleString()} symbols loaded`);

  const preloadedData = new Map<string, DayData>();

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    process.stdout.write(`\r  Day ${i + 1}/${dates.length}: ${date}`);

    try {
      const candidates = await runHistoricalScanner(client, defaultConfig, date, allDailyBars);
      const barsBySymbol = new Map<string, Bar[]>();

      for (const candidate of candidates) {
        const bars = await fetchDayBars(candidate.symbol, date, defaultConfig);
        if (bars.length > 0) {
          barsBySymbol.set(candidate.symbol, bars);
        }
      }

      preloadedData.set(date, { date, candidates, barsBySymbol });
    } catch (err) {
      log.error("Failed to fetch day data", { date, error: String(err) });
      preloadedData.set(date, { date, candidates: [], barsBySymbol: new Map() });
    }
  }

  const daysWithCandidates = [...preloadedData.values()].filter(
    (d) => d.candidates.length > 0
  ).length;
  console.log(`\n  Data loaded: ${daysWithCandidates} days with candidates`);

  // Step 3: Run all configs against preloaded data
  console.log("\n[3/3] Running simulations...\n");

  const results: SimResult[] = [];

  for (const simConfig of SIM_CONFIGS) {
    const configStart = Date.now();
    const result = await runSimWithConfig(simConfig, dates, preloadedData, equity);
    const elapsed = ((Date.now() - configStart) / 1000).toFixed(1);
    results.push(result);

    const pnlColor = result.totalPnL >= 0 ? "\x1b[32m" : "\x1b[31m";
    console.log(
      `  ${result.name.padEnd(55)} ` +
      `${String(result.totalTrades).padStart(3)} trades  ` +
      `${(result.winRate * 100).toFixed(0).padStart(3)}% win  ` +
      `${pnlColor}$${result.totalPnL.toFixed(0).padStart(7)}\x1b[0m  ` +
      `(${elapsed}s)`
    );
  }

  // Print summary table
  console.log(`\n${"═".repeat(100)}`);
  console.log("  RESULTS COMPARISON");
  console.log(`${"═".repeat(100)}`);
  console.log(
    `  ${"Config".padEnd(55)} ${"Trades".padStart(6)} ${"Win%".padStart(5)} ` +
    `${"P&L".padStart(9)} ${"Return".padStart(8)} ${"Days".padStart(5)}`
  );
  console.log(`  ${"─".repeat(93)}`);

  for (const r of results.sort((a, b) => b.totalPnL - a.totalPnL)) {
    const pnlColor = r.totalPnL >= 0 ? "\x1b[32m" : "\x1b[31m";
    console.log(
      `  ${r.name.padEnd(55)} ` +
      `${String(r.totalTrades).padStart(6)} ` +
      `${(r.winRate * 100).toFixed(0).padStart(4)}% ` +
      `${pnlColor}$${r.totalPnL.toFixed(0).padStart(8)}\x1b[0m ` +
      `${pnlColor}${r.returnPct.toFixed(1).padStart(7)}%\x1b[0m ` +
      `${String(r.daysWithTrades).padStart(5)}`
    );

    if (Object.keys(r.strategyPnL).length > 0) {
      for (const [strat, pnl] of Object.entries(r.strategyPnL).sort((a, b) => b[1] - a[1])) {
        const sc = pnl >= 0 ? "\x1b[32m" : "\x1b[31m";
        console.log(
          `    └─ ${strat.padEnd(18)} ${String(r.strategyTrades[strat] ?? 0).padStart(3)} trades  ${sc}$${pnl.toFixed(0).padStart(7)}\x1b[0m`
        );
      }
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const cacheStats = getCacheStats();
  console.log(`\n  Total time: ${totalElapsed}s`);
  console.log(`  Cache stats: ${cacheStats.hits} hits, ${cacheStats.misses} misses`);
  if (cacheStats.misses > 0) {
    console.log(`  ⚠ ${cacheStats.misses} API calls made (should be 0 on repeat runs)`);
  } else {
    console.log(`  ✓ Zero API calls — fully cached!`);
  }
  console.log("");

  process.exit(0);
}

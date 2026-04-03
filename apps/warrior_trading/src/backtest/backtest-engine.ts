import type { Config } from "../config.js";
import type { Bar } from "../utils/bar.js";
import type { BacktestConfig, BacktestResult } from "./types.js";
import { SimTrader } from "./sim-trader.js";
import { computeStats, formatStats, tradesToCSV, tradesToJSON } from "./stats.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("backtest:engine");

export class BacktestEngine {
  constructor(
    private config: Config,
    private btConfig: BacktestConfig
  ) {}

  run(bars: Bar[]): BacktestResult {
    log.info("Backtest starting", {
      symbol: this.btConfig.symbol,
      bars: bars.length,
      startDate: this.btConfig.startDate,
      endDate: this.btConfig.endDate,
      equity: this.btConfig.startingEquity,
    });

    const trader = new SimTrader(this.config, this.btConfig);
    const { trades, equity } = trader.run(bars);

    const stats = computeStats(trades, equity);

    log.info("Backtest complete", {
      trades: stats.totalTrades,
      netPnL: stats.netPnL.toFixed(2),
      winRate: `${(stats.winRate * 100).toFixed(1)}%`,
    });

    return {
      config: this.btConfig,
      trades,
      equity,
      stats,
    };
  }

  static printSummary(result: BacktestResult): void {
    const { config, stats } = result;
    console.log(
      `\n=== Backtest Results: ${config.symbol}  ${config.startDate} -> ${config.endDate} ===`
    );
    console.log(formatStats(stats));
    console.log("");
  }

  static async writeResults(result: BacktestResult): Promise<{
    jsonFile: string;
    csvFile: string;
  }> {
    const { config, trades, equity } = result;
    const prefix = `backtest-${config.symbol}-${config.startDate}-${config.endDate}`;

    const jsonFile = `${prefix}.json`;
    const csvFile = `equity-${config.symbol}-${config.startDate}-${config.endDate}.csv`;

    await Bun.write(jsonFile, tradesToJSON(trades));
    await Bun.write(csvFile, tradesToCSV(equity));

    return { jsonFile, csvFile };
  }
}

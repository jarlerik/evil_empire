import { loadConfig } from "./config.js";
import { createAlpacaClient } from "./alpaca/client.js";
import { initMarketData } from "./alpaca/market-data.js";
import { Trader } from "./engine/trader.js";
import { startDashboard } from "./dashboard/server.js";
import { getCurrentSession } from "./engine/session-timer.js";
import { createLogger, setLogLevel } from "./utils/logger.js";

const log = createLogger("main");

let trader: Trader | null = null;

async function shutdown(signal: string): Promise<void> {
  log.info(`Received ${signal}, shutting down gracefully...`);
  if (trader) {
    await trader.stop();
    trader = null;
  }
  process.exit(0);
}

async function main() {
  log.info("=== Warrior Trading Bot ===");

  // Load config
  const config = loadConfig();

  // Debug mode
  if (Bun.env.LOG_LEVEL === "debug") {
    setLogLevel("debug");
  }

  // Paper trading safety
  if (!config.alpaca.paper) {
    log.warn("⚠️  LIVE TRADING MODE — real money at risk!");
    log.warn("Set ALPACA_PAPER=true to use paper trading");

    // In non-interactive environments (Docker/systemd/CI), require explicit confirmation
    if (!process.stdin.isTTY) {
      if (Bun.env.CONFIRM_LIVE_TRADING !== "yes") {
        log.error(
          "Non-interactive environment detected. Set CONFIRM_LIVE_TRADING=yes to confirm live trading."
        );
        process.exit(1);
      }
      log.warn("Live trading confirmed via CONFIRM_LIVE_TRADING=yes");
    } else {
      // 5-second grace period to abort (interactive terminal)
      log.warn("Starting in 5 seconds... Press Ctrl+C to abort");
      await Bun.sleep(5000);
    }
  } else {
    log.info("Paper trading mode (safe)");
  }

  log.info("Config loaded", {
    paper: config.alpaca.paper,
    strategies: config.trading.strategies.join(", "),
    riskPerTrade: `${config.risk.riskPerTradePct}%`,
    maxDailyLoss: `${config.risk.maxDailyLossPct}%`,
    maxConsecLosses: config.risk.maxConsecLosses,
  });

  // Create Alpaca client
  const client = createAlpacaClient(config);
  initMarketData(config);

  // Verify connectivity
  let equity = 0;
  try {
    const account = await client.getAccount();
    const rawEquity = (account as Record<string, unknown>).equity;
    equity = typeof rawEquity === "string" ? parseFloat(rawEquity) : NaN;
    if (!Number.isFinite(equity) || equity <= 0) {
      throw new Error(`Invalid equity value from Alpaca: ${rawEquity}`);
    }
    const status = (account as Record<string, unknown>).status;
    log.info("Alpaca account connected", {
      status,
      equity: `$${equity.toFixed(2)}`,
    });
  } catch (err) {
    log.error("Failed to connect to Alpaca", { error: String(err) });
    process.exit(1);
  }

  // Register shutdown handlers
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Start dashboard
  if (config.dashboard.enabled) {
    startDashboard({
      type: "init",
      mode: "live",
      phase: getCurrentSession(),
      symbol: "—",
      config: {
        strategies: [...config.trading.strategies],
        riskPerTradePct: config.risk.riskPerTradePct,
        rrRatio: config.risk.rrRatio,
        trailingStopPct: config.trading.trailingStopPct,
        timeStopBars: config.trading.timeStopBars,
        startingEquity: equity,
      },
    });
  }

  // Start trading
  trader = new Trader(client, config);
  await trader.start();
}

main().catch((err) => {
  log.error("Fatal error", { error: String(err) });
  process.exit(1);
});

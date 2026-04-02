import { loadConfig } from "./config.js";
import { createAlpacaClient } from "./alpaca/client.js";
import { Trader } from "./engine/trader.js";
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

    // 5-second grace period to abort
    log.warn("Starting in 5 seconds... Press Ctrl+C to abort");
    await Bun.sleep(5000);
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

  // Verify connectivity
  try {
    const account = await client.getAccount();
    const equity = parseFloat(
      (account as unknown as Record<string, string>).equity
    );
    const status = (account as unknown as Record<string, string>).status;
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

  // Start trading
  trader = new Trader(client, config);
  await trader.start();
}

main().catch((err) => {
  log.error("Fatal error", { error: String(err) });
  process.exit(1);
});

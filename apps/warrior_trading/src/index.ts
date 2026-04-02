import { loadConfig } from "./config.js";
import { createAlpacaClient } from "./alpaca/client.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("main");

async function main() {
  log.info("Warrior Trading Bot starting...");

  const config = loadConfig();
  log.info("Config loaded", {
    paper: config.alpaca.paper,
    strategies: config.trading.strategies,
  });

  const client = createAlpacaClient(config);

  // TODO: Phase 2+ — scanner, indicators, strategies, engine
  log.info("Bot initialized — awaiting Phase 2+ implementation");
}

main().catch((err) => {
  log.error("Fatal error", { error: String(err) });
  process.exit(1);
});

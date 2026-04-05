import { describe, test, expect, afterEach } from "bun:test";

// Save original env to restore after each test
const originalEnv = { ...Bun.env };

afterEach(() => {
  // Remove any keys added during test
  for (const key of Object.keys(Bun.env)) {
    if (!(key in originalEnv)) delete Bun.env[key];
  }
  // Restore original values
  Object.assign(Bun.env, originalEnv);
});

// We need a fresh import for each test because loadConfig reads Bun.env at call time.
// Since the module itself is stateless (no top-level config caching), we can just import once.
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  test("valid env vars produce correctly populated config", () => {
    Bun.env.ALPACA_KEY_ID = "my-key";
    Bun.env.ALPACA_SECRET_KEY = "my-secret";
    Bun.env.ALPACA_PAPER = "true";
    Bun.env.MIN_GAP_PCT = "8";
    Bun.env.MIN_PRICE = "2.5";
    Bun.env.MAX_PRICE = "15";
    Bun.env.MAX_FLOAT = "10000000";
    Bun.env.RR_RATIO = "3";
    Bun.env.STRATEGIES = "gap-and-go,bull-flag";

    const config = loadConfig();

    expect(config.alpaca.keyId).toBe("my-key");
    expect(config.alpaca.secretKey).toBe("my-secret");
    expect(config.alpaca.paper).toBe(true);
    expect(config.scanner.minGapPct).toBe(8);
    expect(config.scanner.minPrice).toBe(2.5);
    expect(config.scanner.maxPrice).toBe(15);
    expect(config.scanner.maxFloat).toBe(10_000_000);
    expect(config.risk.rrRatio).toBe(3);
    expect(config.trading.strategies).toEqual(["gap-and-go", "bull-flag"]);
  });

  test("throws when required ALPACA_KEY_ID is missing", () => {
    // Ensure ALPACA_KEY_ID is not set
    delete Bun.env.ALPACA_KEY_ID;
    Bun.env.ALPACA_SECRET_KEY = "my-secret";

    expect(() => loadConfig()).toThrow("Missing required env variable: ALPACA_KEY_ID");
  });

  test('throws when ALPACA_PAPER has invalid value (typo "ture")', () => {
    Bun.env.ALPACA_KEY_ID = "my-key";
    Bun.env.ALPACA_SECRET_KEY = "my-secret";
    Bun.env.ALPACA_PAPER = "ture";

    expect(() => loadConfig()).toThrow('ALPACA_PAPER must be "true" or "false"');
  });

  test("applies correct defaults for optional vars", () => {
    Bun.env.ALPACA_KEY_ID = "my-key";
    Bun.env.ALPACA_SECRET_KEY = "my-secret";
    // Do not set any optional vars — defaults should apply
    delete Bun.env.MIN_GAP_PCT;
    delete Bun.env.PREF_GAP_PCT;
    delete Bun.env.MIN_PRICE;
    delete Bun.env.MAX_PRICE;
    delete Bun.env.MAX_FLOAT;
    delete Bun.env.MIN_REL_VOLUME;
    delete Bun.env.RR_RATIO;
    delete Bun.env.RISK_PER_TRADE_PCT;
    delete Bun.env.MAX_DAILY_LOSS_PCT;
    delete Bun.env.MAX_CONSEC_LOSSES;
    delete Bun.env.TIME_STOP_BARS;
    delete Bun.env.TRAILING_STOP_PCT;
    delete Bun.env.STRATEGIES;

    const config = loadConfig();

    // Scanner defaults
    expect(config.scanner.minGapPct).toBe(3);
    expect(config.scanner.prefGapPct).toBe(20);
    expect(config.scanner.minPrice).toBe(1.0);
    expect(config.scanner.maxPrice).toBe(30.0);
    expect(config.scanner.maxFloat).toBe(20_000_000);
    expect(config.scanner.minRelVolume).toBe(1.5);

    // Risk defaults
    expect(config.risk.rrRatio).toBe(2);
    expect(config.risk.riskPerTradePct).toBe(1.5);
    expect(config.risk.maxDailyLossPct).toBe(10);
    expect(config.risk.maxConsecLosses).toBe(3);

    // Trading defaults
    expect(config.trading.timeStopBars).toBe(10);
    expect(config.trading.trailingStopPct).toBe(3);
    // "all" default → all strategies
    expect(config.trading.strategies).toEqual([
      "gap-and-go",
      "bull-flag",
      "flat-top",
      "ma-pullback",
      "micro-pullback",
    ]);

    // ALPACA_PAPER defaults to "true"
    expect(config.alpaca.paper).toBe(true);
  });
});

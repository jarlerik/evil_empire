const VALID_STRATEGIES = [
  "gap-and-go",
  "bull-flag",
  "flat-top",
  "ma-pullback",
  "micro-pullback",
  "vwap-reclaim",
  "vwap-bounce",
  "orb",
] as const;

export type StrategyName = (typeof VALID_STRATEGIES)[number];

function env(key: string, fallback?: string): string {
  const value = Bun.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env variable: ${key}`);
  }
  return value;
}

function envFloat(key: string, fallback?: number): number {
  const raw = Bun.env[key];
  if (raw === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env variable: ${key}`);
  }
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env variable ${key} is not a valid number: ${raw}`);
  }
  return parsed;
}

function envInt(key: string, fallback?: number): number {
  const raw = Bun.env[key];
  if (raw === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env variable: ${key}`);
  }
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env variable ${key} is not a valid integer: ${raw}`);
  }
  return parsed;
}

function parseStrategies(raw: string): StrategyName[] {
  if (raw.trim().toLowerCase() === "all") {
    return [...VALID_STRATEGIES];
  }
  const names = raw.split(",").map((s) => s.trim().toLowerCase());
  for (const name of names) {
    if (!VALID_STRATEGIES.includes(name as StrategyName)) {
      throw new Error(
        `Invalid strategy "${name}". Valid: ${VALID_STRATEGIES.join(", ")}`
      );
    }
  }
  return names as StrategyName[];
}

export function loadConfig() {
  const raw = env("ALPACA_PAPER", "true").toLowerCase().trim();
  if (raw !== "true" && raw !== "false") {
    throw new Error(`ALPACA_PAPER must be "true" or "false", got: "${raw}"`);
  }
  const isPaper = raw === "true";

  return {
    alpaca: {
      keyId: env("ALPACA_KEY_ID"),
      secretKey: env("ALPACA_SECRET_KEY"),
      paper: isPaper,
    },

    scanner: {
      minGapPct: envFloat("MIN_GAP_PCT", 3),
      prefGapPct: envFloat("PREF_GAP_PCT", 20),
      minPrice: envFloat("MIN_PRICE", 1.0),
      maxPrice: envFloat("MAX_PRICE", 30.0),
      maxFloat: envInt("MAX_FLOAT", 20_000_000),
      minRelVolume: envFloat("MIN_REL_VOLUME", 1.5),
      intervalMin: envInt("SCAN_INTERVAL_MIN", 15), // 0 = scan once, >0 = re-scan every N minutes
    },

    risk: {
      rrRatio: envFloat("RR_RATIO", 2),
      riskPerTradePct: envFloat("RISK_PER_TRADE_PCT", 1.5),
      maxDailyLossPct: envFloat("MAX_DAILY_LOSS_PCT", 10),
      maxConsecLosses: envInt("MAX_CONSEC_LOSSES", 3),
    },

    trading: {
      timeStopBars: envInt("TIME_STOP_BARS", 10),
      trailingStopPct: envFloat("TRAILING_STOP_PCT", 3),
      trailingStopAtrMult: envFloat("TRAILING_STOP_ATR_MULT", 0), // 0 = use fixed %, >0 = use N*ATR
      cooldownBars: envInt("COOLDOWN_BARS", 15),
      maxHoldBars: envInt("MAX_HOLD_BARS", 0), // 0 = disabled, >0 = force exit after N bars
      firstHourOnly: env("FIRST_HOUR_ONLY", "false").toLowerCase() === "true",
      entryDelayBars: envInt("ENTRY_DELAY_BARS", 0), // skip first N bars after open before entries
      minConfidence: envInt("MIN_CONFIDENCE", 0), // 0 = use session-based defaults (50/75)
      minStopDistance: envFloat("MIN_STOP_DISTANCE", 0), // 0 = disabled, >0 = reject signals with stop < $N from entry
      strategies: parseStrategies(env("STRATEGIES", "all")),
    },

    dashboard: {
      enabled: env("DASHBOARD_ENABLED", "true").toLowerCase() === "true",
      port: envInt("DASHBOARD_PORT", 3939),
    },
  } as const;
}

export type Config = ReturnType<typeof loadConfig>;

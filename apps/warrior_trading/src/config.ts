const VALID_STRATEGIES = [
  "gap-and-go",
  "bull-flag",
  "flat-top",
  "ma-pullback",
  "micro-pullback",
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
      minGapPct: envFloat("MIN_GAP_PCT", 5),
      prefGapPct: envFloat("PREF_GAP_PCT", 20),
      minPrice: envFloat("MIN_PRICE", 1.0),
      maxPrice: envFloat("MAX_PRICE", 20.0),
      maxFloat: envInt("MAX_FLOAT", 20_000_000),
      minRelVolume: envFloat("MIN_REL_VOLUME", 5),
    },

    risk: {
      rrRatio: envFloat("RR_RATIO", 2),
      riskPerTradePct: envFloat("RISK_PER_TRADE_PCT", 1.5),
      maxDailyLossPct: envFloat("MAX_DAILY_LOSS_PCT", 10),
      maxConsecLosses: envInt("MAX_CONSEC_LOSSES", 3),
    },

    trading: {
      timeStopBars: envInt("TIME_STOP_BARS", 5),
      trailingStopPct: envFloat("TRAILING_STOP_PCT", 1.5),
      strategies: parseStrategies(env("STRATEGIES", "all")),
    },

    dashboard: {
      enabled: env("DASHBOARD_ENABLED", "true").toLowerCase() === "true",
      port: envInt("DASHBOARD_PORT", 3939),
    },
  } as const;
}

export type Config = ReturnType<typeof loadConfig>;

import type { StrategyName } from "../config.js";

export interface BacktestConfig {
  symbol: string;
  startDate: string;              // YYYY-MM-DD
  endDate: string;                // YYYY-MM-DD
  startingEquity: number;         // default 25_000
  commissionPerShare: number;     // default 0.005
  slippageTicks: number;          // default 1 (1 cent adverse fill)
  marketOpenHour: number;         // 9  (ET)
  marketOpenMinute: number;       // 30
  marketCloseHour: number;        // 15
  marketCloseMinute: number;      // 45  (flatten time, matches live)
}

export interface TradeRecord {
  id: number;
  symbol: string;
  strategy: StrategyName;
  confidence: number;
  entryTime: Date;
  exitTime: Date;
  entryPrice: number;             // after slippage
  exitPrice: number;              // after slippage
  shares: number;
  side: "buy";
  pnl: number;                    // net of commissions
  commission: number;
  rMultiple: number;              // pnl / initial risk
  barsHeld: number;
  exitReason: ExitReason;
}

export type ExitReason =
  | "target"
  | "stop"
  | "trailing-stop"
  | "time-stop"
  | "vwap-breakdown"
  | "eod-flatten";

export interface BacktestResult {
  config: BacktestConfig;
  trades: TradeRecord[];
  equity: EquityPoint[];
  stats: AggregateStats;
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
}

export interface AggregateStats {
  totalTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalPnL: number;
  totalCommissions: number;
  netPnL: number;
  avgRMultiple: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  avgBarsHeld: number;
  tradesPerDay: number;
  strategyBreakdown: Record<string, StrategyBreakdown>;
}

export interface StrategyBreakdown {
  trades: number;
  winRate: number;
  avgR: number;
  totalPnL: number;
}

export const DEFAULT_BACKTEST_CONFIG: Omit<BacktestConfig, "symbol" | "startDate" | "endDate"> = {
  startingEquity: 25_000,
  commissionPerShare: 0.005,
  slippageTicks: 1,
  marketOpenHour: 9,
  marketOpenMinute: 30,
  marketCloseHour: 15,
  marketCloseMinute: 45,
};

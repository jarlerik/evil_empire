// Session phases from the existing session-timer.ts
export type SessionPhase = "pre-market" | "open" | "midday" | "close" | "after-hours" | "closed";

// ── Bar & Indicator Data ──────────────────────────
export interface BarEvent {
  type: "bar";
  symbol: string;
  timestamp: string;          // ISO 8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorEvent {
  type: "indicators";
  symbol: string;
  timestamp: string;
  ema9: number;
  ema20: number;
  ema50: number;
  ema200: number;
  vwap: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  atr: number;
  relativeVolume: number;
}

// ── Strategy & Signals ────────────────────────────
export interface SignalEvent {
  type: "signal";
  symbol: string;
  strategy: string;
  confidence: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  reason: string;
  accepted: boolean;
  rejectionReason?: string;
}

// ── Position & Trade Lifecycle ────────────────────
export interface PositionOpenEvent {
  type: "position:open";
  symbol: string;
  strategy: string;
  entryPrice: number;
  shares: number;
  stopPrice: number;
  targetPrice: number;
  timestamp: string;
}

export interface PositionUpdateEvent {
  type: "position:update";
  symbol: string;
  currentPrice: number;
  unrealizedPnL: number;
  barsHeld: number;
  highSinceEntry: number;
  trailingStop: number;
}

export interface PositionCloseEvent {
  type: "position:close";
  symbol: string;
  exitPrice: number;
  pnl: number;
  commission: number;
  barsHeld: number;
  exitReason: string;
  timestamp: string;
}

// ── Risk State ────────────────────────────────────
export interface RiskEvent {
  type: "risk";
  dailyPnL: number;
  consecutiveLosses: number;
  tradesCompleted: number;
  tradesWon: number;
  winRate: number;
  isHalted: boolean;
  equity: number;
}

// ── Equity Curve ──────────────────────────────────
export interface EquityEvent {
  type: "equity";
  timestamp: string;
  equity: number;
}

// ── Session & Scanner ─────────────────────────────
export interface SessionEvent {
  type: "session";
  phase: SessionPhase;
  mode: "live" | "backtest";
  backtestProgress?: number;
}

export interface ScannerEvent {
  type: "scanner";
  candidates: Array<{
    symbol: string;
    gapPct: number;
    price: number;
    relativeVolume: number;
    hasCatalyst: boolean;
    headline: string | null;
    score: number;
  }>;
}

// ── Backtest Control (browser → server) ───────────
export interface PlaybackCommand {
  type: "playback";
  action: "play" | "pause" | "step" | "speed";
  speed?: number;
}

// ── Connection Handshake ──────────────────────────
export interface InitEvent {
  type: "init";
  mode: "live" | "backtest";
  symbol: string;
  config: {
    strategies: string[];
    riskPerTradePct: number;
    rrRatio: number;
    trailingStopPct: number;
    timeStopBars: number;
    startingEquity: number;
  };
  backtest?: {
    startDate: string;
    endDate: string;
    totalBars: number;
  };
}

export type DashboardEvent =
  | BarEvent | IndicatorEvent | SignalEvent
  | PositionOpenEvent | PositionUpdateEvent | PositionCloseEvent
  | RiskEvent | EquityEvent | SessionEvent | ScannerEvent | InitEvent;

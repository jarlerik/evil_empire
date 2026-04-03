import type { Config, StrategyName } from "../config.js";
import type { Bar } from "../utils/bar.js";
import type { Strategy, StrategySignal, IndicatorSnapshot } from "../strategies/types.js";
import { createMultiEMA, updateMultiEMA } from "../indicators/ema.js";
import { createVWAP, updateVWAP, resetVWAP } from "../indicators/vwap.js";
import { createMACD, updateMACD } from "../indicators/macd.js";
import { createATR, updateATR } from "../indicators/atr.js";
import { gapAndGo } from "../strategies/gap-and-go.js";
import { microPullback } from "../strategies/micro-pullback.js";
import { bullFlag } from "../strategies/bull-flag.js";
import { flatTop } from "../strategies/flat-top.js";
import { maPullback } from "../strategies/ma-pullback.js";
import { SimBroker, type ExitResult } from "./sim-broker.js";
import { BacktestRiskManager } from "./backtest-risk-manager.js";
import type { BacktestConfig, TradeRecord, EquityPoint, ExitReason } from "./types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("backtest:trader");

const STRATEGY_MAP: Record<StrategyName, Strategy> = {
  "gap-and-go": gapAndGo,
  "micro-pullback": microPullback,
  "bull-flag": bullFlag,
  "flat-top": flatTop,
  "ma-pullback": maPullback,
};

type SessionPhase = "pre-market" | "open" | "midday" | "close" | "after-hours" | "closed";

function getSessionFromBar(bar: Bar, btConfig: BacktestConfig): SessionPhase {
  // Extract ET hour/minute from bar timestamp
  const etStr = bar.timestamp.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const [hourStr, minuteStr] = etStr.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const mins = hour * 60 + minute;

  const openMins = btConfig.marketOpenHour * 60 + btConfig.marketOpenMinute;
  const closeMins = btConfig.marketCloseHour * 60 + btConfig.marketCloseMinute;

  if (mins < 7 * 60) return "closed";
  if (mins < openMins) return "pre-market";
  if (mins < 11 * 60) return "open";
  if (mins < closeMins) return "midday";
  if (mins < 16 * 60) return "close";
  if (mins < 20 * 60) return "after-hours";
  return "closed";
}

interface ActiveSignal {
  signal: StrategySignal;
  confidence: number;
}

export interface SimTraderResult {
  trades: TradeRecord[];
  equity: EquityPoint[];
}

export class SimTrader {
  private broker: SimBroker;
  private riskManager: BacktestRiskManager;
  private strategies: Strategy[];
  private equity: number;

  // Indicator state
  private ema = createMultiEMA();
  private vwap = createVWAP();
  private macd = createMACD();
  private atr = createATR();
  private recentBars: Bar[] = [];
  private premarketHigh = 0;
  private currentDay = "";

  // Position tracking for trader-level exits
  private activeSignal: ActiveSignal | null = null;
  private highSinceEntry = 0;

  // Results
  private trades: TradeRecord[] = [];
  private equityCurve: EquityPoint[] = [];
  private tradeIdCounter = 0;

  constructor(
    private config: Config,
    private btConfig: BacktestConfig
  ) {
    this.equity = btConfig.startingEquity;
    this.broker = new SimBroker(btConfig.slippageTicks, btConfig.commissionPerShare);
    this.riskManager = new BacktestRiskManager(config, btConfig.startingEquity);
    this.strategies = config.trading.strategies.map((name) => STRATEGY_MAP[name]);
  }

  run(bars: Bar[]): SimTraderResult {
    log.info("Starting simulation", { bars: bars.length, equity: this.equity });

    for (const bar of bars) {
      this.processBar(bar);
    }

    log.info("Simulation complete", {
      trades: this.trades.length,
      finalEquity: this.equity.toFixed(2),
    });

    return { trades: this.trades, equity: this.equityCurve };
  }

  private processBar(bar: Bar): void {
    const day = bar.timestamp.toISOString().slice(0, 10);
    const session = getSessionFromBar(bar, this.btConfig);

    // --- New trading day ---
    if (day !== this.currentDay) {
      // Force-close any open position from prior day (safety net)
      if (this.broker.hasPosition) {
        this.forceClosePosition(bar, "eod-flatten");
      }
      this.broker.cancelPending();

      this.currentDay = day;
      resetVWAP(this.vwap);
      this.premarketHigh = bar.high;
      this.riskManager.resetDaily(this.equity, day);
      this.activeSignal = null;
      this.highSinceEntry = 0;

      log.debug("New trading day", { date: day, equity: this.equity.toFixed(2) });
    }

    // --- Update indicators ---
    const emaValues = updateMultiEMA(this.ema, bar.close);
    const vwapValue = updateVWAP(this.vwap, bar);
    const macdValues = updateMACD(this.macd, bar.close);
    const atrValue = updateATR(this.atr, bar);

    this.recentBars.push(bar);
    if (this.recentBars.length > 50) this.recentBars.shift();
    this.premarketHigh = Math.max(this.premarketHigh, bar.high);

    // --- Process position / pending order through broker ---
    if (this.broker.hasPosition || this.broker.hasPendingOrder) {
      const event = this.broker.onBar(bar);

      if (event.type === "filled" && !this.activeSignal) {
        // Shouldn't happen, but guard
      }

      if (event.type === "exited") {
        this.recordTrade(event.position, event.exit);
        this.activeSignal = null;
        this.highSinceEntry = 0;
      }

      // Trader-level exit checks (trailing stop, time stop, VWAP breakdown)
      if (this.broker.hasPosition && event.type !== "exited") {
        const traderExit = this.checkTraderExits(bar, vwapValue);
        if (traderExit) {
          this.forceClosePosition(bar, traderExit);
        }
      }
    }

    // --- EOD flatten ---
    if (session === "close" && this.broker.hasPosition) {
      this.forceClosePosition(bar, "eod-flatten");
    }

    // --- Evaluate strategies for new entry ---
    const tradingAllowed = session === "open" || session === "midday";
    if (
      tradingAllowed &&
      !this.broker.hasPosition &&
      !this.broker.hasPendingOrder &&
      !this.riskManager.isHalted &&
      this.recentBars.length >= 10
    ) {
      const snapshot: IndicatorSnapshot = {
        bars: [...this.recentBars],
        ema: { ...emaValues },
        vwap: vwapValue,
        macd: { ...macdValues },
        atr: atrValue,
        relativeVolume: 5, // assume high RVOL in backtest
        premarketHigh: this.premarketHigh,
      };

      const minConfidence = session === "midday" ? 75 : 50;
      let bestSignal: StrategySignal | null = null;

      for (const strategy of this.strategies) {
        const signal = strategy.evaluate(this.btConfig.symbol, snapshot);
        if (!signal) continue;
        if (signal.confidence < minConfidence) continue;
        if (!bestSignal || signal.confidence > bestSignal.confidence) {
          bestSignal = signal;
        }
      }

      if (bestSignal) {
        const approval = this.riskManager.evaluateSignal(bestSignal, this.equity);
        if (approval.approved) {
          this.broker.submitOrder({
            symbol: bestSignal.symbol,
            limitPrice: bestSignal.entryPrice,
            stopPrice: bestSignal.stopPrice,
            targetPrice: bestSignal.targetPrice,
            shares: approval.positionSize.shares,
            submittedAt: bar.timestamp,
          });
          this.riskManager.onPositionOpened();
          this.activeSignal = {
            signal: bestSignal,
            confidence: bestSignal.confidence,
          };
          this.highSinceEntry = 0;

          // Process the order against the current bar immediately
          const event = this.broker.onBar(bar);
          if (event.type === "exited") {
            this.recordTrade(event.position, event.exit);
            this.activeSignal = null;
            this.highSinceEntry = 0;
          } else if (event.type === "filled") {
            this.highSinceEntry = bar.high;
          }
        }
      }
    }

    // Track high since entry for trailing stop
    if (this.broker.hasPosition) {
      this.highSinceEntry = Math.max(this.highSinceEntry, bar.high);
    }

    // Record equity point
    this.equityCurve.push({ timestamp: bar.timestamp, equity: this.equity });
  }

  private checkTraderExits(bar: Bar, vwapValue: number): ExitReason | null {
    const pos = this.broker.currentPosition;
    if (!pos) return null;

    // Time stop: no progress after N bars
    if (pos.barsHeld >= this.config.trading.timeStopBars) {
      if (bar.close <= pos.entryPrice) {
        return "time-stop";
      }
    }

    // Trailing stop
    const trailingStop = this.highSinceEntry * (1 - this.config.trading.trailingStopPct / 100);
    if (this.highSinceEntry > 0 && bar.close < trailingStop) {
      return "trailing-stop";
    }

    // VWAP breakdown after 2+ bars
    if (bar.close < vwapValue && pos.barsHeld >= 2) {
      return "vwap-breakdown";
    }

    return null;
  }

  private forceClosePosition(bar: Bar, reason: ExitReason): void {
    const posSnapshot = this.broker.getPositionSnapshot();
    if (!posSnapshot) return;

    const exit = this.broker.forceExit(bar.close, bar.timestamp, reason);
    if (!exit) return;

    this.recordTrade(posSnapshot, exit);
    this.activeSignal = null;
    this.highSinceEntry = 0;
  }

  private recordTrade(
    pos: { symbol: string; entryPrice: number; stopPrice: number; targetPrice: number; shares: number; entryTime: Date },
    exit: ExitResult
  ): void {
    const commission = this.broker.getCommission(pos.shares);
    const grossPnl = (exit.exitPrice - pos.entryPrice) * pos.shares;
    const netPnl = grossPnl - commission;

    const initialRisk = (pos.entryPrice - pos.stopPrice) * pos.shares;
    const rMultiple = initialRisk > 0 ? netPnl / initialRisk : 0;

    const trade: TradeRecord = {
      id: ++this.tradeIdCounter,
      symbol: pos.symbol,
      strategy: this.activeSignal?.signal.strategy ?? "gap-and-go",
      confidence: this.activeSignal?.confidence ?? 0,
      entryTime: pos.entryTime,
      exitTime: exit.exitTime,
      entryPrice: pos.entryPrice,
      exitPrice: exit.exitPrice,
      shares: pos.shares,
      side: "buy",
      pnl: netPnl,
      commission,
      rMultiple,
      barsHeld: exit.barsHeld,
      exitReason: exit.exitReason,
    };

    this.trades.push(trade);
    this.equity += netPnl;

    this.riskManager.onTradeCompleted({
      symbol: pos.symbol,
      pnl: netPnl,
      entryPrice: pos.entryPrice,
      exitPrice: exit.exitPrice,
      shares: pos.shares,
    });

    log.debug("Trade recorded", {
      id: trade.id,
      strategy: trade.strategy,
      pnl: netPnl.toFixed(2),
      exitReason: exit.exitReason,
      equity: this.equity.toFixed(2),
    });
  }
}

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
import { vwapReclaim } from "../strategies/vwap-reclaim.js";
import { vwapBounce } from "../strategies/vwap-bounce.js";
import { orb } from "../strategies/orb.js";
import { SimBroker, type ExitResult, type FilledPosition } from "./sim-broker.js";
import { BacktestRiskManager } from "./backtest-risk-manager.js";
import type { BacktestConfig, TradeRecord, EquityPoint, ExitReason } from "./types.js";
import { dashboardBus } from "../dashboard/event-bus.js";
import type { PlaybackCommand } from "../dashboard/types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("backtest:trader");

const STRATEGY_MAP: Record<StrategyName, Strategy> = {
  "gap-and-go": gapAndGo,
  "micro-pullback": microPullback,
  "bull-flag": bullFlag,
  "flat-top": flatTop,
  "ma-pullback": maPullback,
  "vwap-reclaim": vwapReclaim,
  "vwap-bounce": vwapBounce,
  "orb": orb,
};

type SessionPhase = "pre-market" | "open" | "midday" | "close" | "after-hours" | "closed";

// Speed → delay in ms per bar
const SPEED_DELAY: Record<number, number> = {
  1: 1000,
  5: 200,
  25: 40,
  100: 10,
  0: 0, // max speed
};

function getSessionFromBar(bar: Bar, btConfig: BacktestConfig): SessionPhase {
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
  private premarketLow = Infinity;
  private currentDay = "";
  private barsSinceOpen = 0;

  // Relative volume tracking
  private todayVolume = 0;
  private todayBarCount = 0;
  private priorDayVolumes: number[] = [];
  private priorDayBarCounts: number[] = [];

  // Position tracking for trader-level exits
  private activeSignal: ActiveSignal | null = null;
  private highSinceEntry = 0;

  // Results
  private trades: TradeRecord[] = [];
  private equityCurve: EquityPoint[] = [];
  private tradeIdCounter = 0;

  // Playback control
  private dashboardEnabled: boolean;
  private paused = true; // start paused so user sees dashboard load
  private speed = 5; // default 5x
  private delayMs = SPEED_DELAY[5];
  private stepRequested = false;
  private resumeResolve: (() => void) | null = null;

  constructor(
    private config: Config,
    private btConfig: BacktestConfig,
    dashboardEnabled = false
  ) {
    this.equity = btConfig.startingEquity;
    this.broker = new SimBroker(btConfig.slippageTicks, btConfig.commissionPerShare);
    this.riskManager = new BacktestRiskManager(config, btConfig.startingEquity);
    this.strategies = config.trading.strategies.map((name) => STRATEGY_MAP[name]);
    this.dashboardEnabled = dashboardEnabled;

    if (dashboardEnabled) {
      this.listenToPlaybackCommands();
    }
  }

  private listenToPlaybackCommands(): void {
    dashboardBus.onCommand((cmd: PlaybackCommand) => {
      switch (cmd.action) {
        case "play":
          this.paused = false;
          if (this.resumeResolve) {
            this.resumeResolve();
            this.resumeResolve = null;
          }
          break;
        case "pause":
          this.paused = true;
          break;
        case "step":
          this.stepRequested = true;
          if (this.resumeResolve) {
            this.resumeResolve();
            this.resumeResolve = null;
          }
          break;
        case "speed":
          if (cmd.speed !== undefined) {
            this.speed = cmd.speed;
            this.delayMs = SPEED_DELAY[cmd.speed] ?? 0;
          }
          break;
      }
    });
  }

  private waitForResume(): Promise<void> {
    return new Promise((resolve) => {
      this.resumeResolve = resolve;
    });
  }

  async run(bars: Bar[]): Promise<SimTraderResult> {
    log.info("Starting simulation", { bars: bars.length, equity: this.equity });

    const totalBars = bars.length;

    for (let i = 0; i < bars.length; i++) {
      // Playback pause/step gate
      if (this.dashboardEnabled) {
        if (this.paused && !this.stepRequested) {
          await this.waitForResume();
        }

        if (this.stepRequested) {
          this.stepRequested = false;
          this.paused = true;
        }
      }

      this.processBar(bars[i]);

      // Emit session progress
      if (this.dashboardEnabled) {
        const progress = ((i + 1) / totalBars) * 100;
        // Throttle progress events at max speed
        if (this.speed !== 0 || i % 10 === 0 || i === bars.length - 1) {
          dashboardBus.broadcast({
            type: "session",
            phase: getSessionFromBar(bars[i], this.btConfig),
            mode: "backtest",
            backtestProgress: Math.round(progress * 10) / 10,
          });
        }

        // Inter-bar delay for playback speed
        if (this.delayMs > 0) {
          await Bun.sleep(this.delayMs);
        }
      }
    }

    log.info("Simulation complete", {
      trades: this.trades.length,
      finalEquity: this.equity.toFixed(2),
    });

    return { trades: this.trades, equity: this.equityCurve };
  }

  private processBar(bar: Bar): void {
    this.riskManager.tick();
    const day = bar.timestamp.toISOString().slice(0, 10);
    const session = getSessionFromBar(bar, this.btConfig);

    // --- New trading day ---
    if (day !== this.currentDay) {
      // Force-close any open position from prior day (safety net)
      if (this.broker.hasPosition) {
        this.forceClosePosition(bar, "eod-flatten");
      }
      this.broker.cancelPending();

      // Save completed day's volume for rvol calculation
      if (this.currentDay !== "" && this.todayVolume > 0) {
        this.priorDayVolumes.push(this.todayVolume);
        this.priorDayBarCounts.push(this.todayBarCount);
        // Keep last 30 days
        if (this.priorDayVolumes.length > 30) {
          this.priorDayVolumes.shift();
          this.priorDayBarCounts.shift();
        }
      }

      this.currentDay = day;
      resetVWAP(this.vwap);
      this.premarketHigh = bar.open; // Use open (gap settle price) not high
      this.premarketLow = bar.low;
      this.todayVolume = 0;
      this.todayBarCount = 0;
      this.barsSinceOpen = 0;
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
    // Only update premarket high/low during pre-market session.
    // After market open, freeze these values so gap-and-go can detect
    // breakouts above the premarket high.
    if (session === "pre-market") {
      this.premarketHigh = Math.max(this.premarketHigh, bar.high);
      this.premarketLow = Math.min(this.premarketLow, bar.low);
    }
    this.todayVolume += bar.volume;
    this.todayBarCount++;
    if (session === "open" || session === "midday") {
      this.barsSinceOpen++;
    }

    const rvol = this.computeRvol();

    // --- Emit bar + indicator events ---
    if (this.dashboardEnabled) {
      dashboardBus.broadcast({
        type: "bar",
        symbol: this.btConfig.symbol,
        timestamp: bar.timestamp.toISOString(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      });

      dashboardBus.broadcast({
        type: "indicators",
        symbol: this.btConfig.symbol,
        timestamp: bar.timestamp.toISOString(),
        ema9: emaValues.ema9,
        ema20: emaValues.ema20,
        ema50: emaValues.ema50,
        ema200: emaValues.ema200,
        vwap: vwapValue,
        macd: macdValues.macd,
        macdSignal: macdValues.signal,
        macdHistogram: macdValues.histogram,
        atr: atrValue,
        relativeVolume: rvol,
      });
    }

    // --- Process position / pending order through broker ---
    if (this.broker.hasPosition || this.broker.hasPendingOrder) {
      const event = this.broker.onBar(bar);

      if (event.type === "filled" && !this.activeSignal) {
        // Shouldn't happen, but guard
      }

      if (event.type === "filled" && this.activeSignal && this.dashboardEnabled) {
        this.emitPositionUpdate(bar, event.position);
      }

      if (event.type === "exited") {
        this.recordTrade(event.position, event.exit);
        this.activeSignal = null;
        this.highSinceEntry = 0;
      }

      // Trader-level exit checks (trailing stop, time stop, VWAP breakdown)
      if (this.broker.hasPosition && event.type !== "exited") {
        const traderExit = this.checkTraderExits(bar, vwapValue, atrValue);
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
    const tradingAllowed = this.config.trading.firstHourOnly
      ? session === "open"
      : session === "open" || session === "midday";
    const pastEntryDelay = this.config.trading.entryDelayBars <= 0 ||
      this.barsSinceOpen > this.config.trading.entryDelayBars;
    if (
      tradingAllowed &&
      pastEntryDelay &&
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
        relativeVolume: rvol,
        premarketHigh: this.premarketHigh,
        premarketLow: this.premarketLow === Infinity ? bar.low : this.premarketLow,
      };

      const defaultMin = session === "midday" ? 75 : 50;
      const minConfidence = this.config.trading.minConfidence > 0
        ? this.config.trading.minConfidence
        : defaultMin;
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

        // Emit signal event (accepted or rejected)
        if (this.dashboardEnabled) {
          dashboardBus.broadcast({
            type: "signal",
            symbol: bestSignal.symbol,
            strategy: bestSignal.strategy,
            confidence: bestSignal.confidence,
            entryPrice: bestSignal.entryPrice,
            stopPrice: bestSignal.stopPrice,
            targetPrice: bestSignal.targetPrice,
            reason: bestSignal.reason,
            accepted: approval.approved,
            rejectionReason: approval.approved ? undefined : approval.reason,
          });
        }

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

            // Emit position:open
            if (this.dashboardEnabled) {
              dashboardBus.broadcast({
                type: "position:open",
                symbol: event.position.symbol,
                strategy: this.activeSignal.signal.strategy,
                entryPrice: event.position.entryPrice,
                shares: event.position.shares,
                stopPrice: event.position.stopPrice,
                targetPrice: event.position.targetPrice,
                timestamp: bar.timestamp.toISOString(),
              });
            }
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

    // Emit equity event
    if (this.dashboardEnabled) {
      dashboardBus.broadcast({
        type: "equity",
        timestamp: bar.timestamp.toISOString(),
        equity: this.equity,
      });
    }
  }

  private emitPositionUpdate(bar: Bar, pos: FilledPosition): void {
    const unrealizedPnL = (bar.close - pos.entryPrice) * pos.shares;
    const trailingStop = this.highSinceEntry > 0
      ? this.highSinceEntry * (1 - this.config.trading.trailingStopPct / 100)
      : pos.stopPrice;

    dashboardBus.broadcast({
      type: "position:update",
      symbol: pos.symbol,
      currentPrice: bar.close,
      unrealizedPnL,
      barsHeld: pos.barsHeld,
      highSinceEntry: this.highSinceEntry || pos.highSinceEntry,
      trailingStop,
    });
  }

  /**
   * Compute relative volume from tracked daily volumes.
   * Compares today's cumulative volume (scaled to full day) against prior-day averages.
   */
  private computeRvol(): number {
    if (this.priorDayVolumes.length === 0 || this.todayBarCount === 0) return 1;

    const avgDayVolume =
      this.priorDayVolumes.reduce((s, v) => s + v, 0) / this.priorDayVolumes.length;
    if (avgDayVolume === 0) return 1;

    // Scale today's volume to comparable full-day estimate using bar counts
    const avgDayBars =
      this.priorDayBarCounts.reduce((s, c) => s + c, 0) / this.priorDayBarCounts.length;
    const dayFraction = avgDayBars > 0 ? this.todayBarCount / avgDayBars : 1;
    const clampedFraction = Math.max(dayFraction, 0.01);
    const scaledAvg = avgDayVolume * clampedFraction;

    return this.todayVolume / scaledAvg;
  }

  private checkTraderExits(bar: Bar, vwapValue: number, atrValue: number): ExitReason | null {
    const pos = this.broker.currentPosition;
    if (!pos) return null;

    // Max hold bars: force exit regardless of P&L
    const maxHold = this.config.trading.maxHoldBars;
    if (maxHold > 0 && pos.barsHeld >= maxHold) {
      return "time-stop";
    }

    // Time stop: no progress after N bars
    if (pos.barsHeld >= this.config.trading.timeStopBars) {
      if (bar.close <= pos.entryPrice) {
        return "time-stop";
      }
    }

    // Trailing stop: ATR-based or fixed %
    let trailingStop: number;
    if (this.config.trading.trailingStopAtrMult > 0 && atrValue > 0) {
      trailingStop = this.highSinceEntry - this.config.trading.trailingStopAtrMult * atrValue;
    } else {
      trailingStop = this.highSinceEntry * (1 - this.config.trading.trailingStopPct / 100);
    }
    if (this.highSinceEntry > 0 && bar.close < trailingStop) {
      return "trailing-stop";
    }

    // VWAP breakdown after 5+ bars
    if (bar.close < vwapValue && pos.barsHeld >= 5) {
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

    // Emit position:close and risk events
    if (this.dashboardEnabled) {
      dashboardBus.broadcast({
        type: "position:close",
        symbol: pos.symbol,
        exitPrice: exit.exitPrice,
        pnl: netPnl,
        commission,
        barsHeld: exit.barsHeld,
        exitReason: exit.exitReason,
        timestamp: exit.exitTime.toISOString(),
      });

      dashboardBus.broadcast({
        type: "risk",
        dailyPnL: this.riskManager.dailyPnL,
        consecutiveLosses: this.riskManager.consecutiveLosses,
        tradesCompleted: this.trades.length,
        tradesWon: this.trades.filter((t) => t.pnl > 0).length,
        winRate: this.trades.length > 0
          ? this.trades.filter((t) => t.pnl > 0).length / this.trades.length
          : 0,
        isHalted: this.riskManager.isHalted,
        equity: this.equity,
      });
    }

    log.debug("Trade recorded", {
      id: trade.id,
      strategy: trade.strategy,
      pnl: netPnl.toFixed(2),
      exitReason: exit.exitReason,
      equity: this.equity.toFixed(2),
    });
  }
}

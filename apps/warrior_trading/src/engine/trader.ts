import type { Config } from "../config.js";
import type { AlpacaClient } from "../alpaca/client.js";
import { AlpacaStream } from "../alpaca/client.js";
import { placeBracketOrder, waitForFill, closePosition, closeAllPositions } from "../alpaca/orders.js";
import { runScanner } from "../scanner/index.js";
import { RiskManager, type TradeResult } from "../risk/risk-manager.js";
import {
  SessionTimer,
  getCurrentSession,
  isTradingAllowed,
  shouldFlattenPositions,
  isScanningTime,
} from "./session-timer.js";
import { Watchlist } from "./watchlist.js";
import { gapAndGo } from "../strategies/gap-and-go.js";
import { microPullback } from "../strategies/micro-pullback.js";
import { bullFlag } from "../strategies/bull-flag.js";
import { flatTop } from "../strategies/flat-top.js";
import { maPullback } from "../strategies/ma-pullback.js";
import type { Strategy, StrategySignal, IndicatorSnapshot } from "../strategies/types.js";
import type { StrategyName } from "../config.js";
import { dashboardBus } from "../dashboard/event-bus.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("engine:trader");

const STRATEGY_MAP: Record<StrategyName, Strategy> = {
  "gap-and-go": gapAndGo,
  "micro-pullback": microPullback,
  "bull-flag": bullFlag,
  "flat-top": flatTop,
  "ma-pullback": maPullback,
};

interface OpenPosition {
  symbol: string;
  entryPrice: number;
  shares: number;
  strategy: StrategyName;
  stopPrice: number;
  targetPrice: number;
  barsHeld: number;
  highSinceEntry: number;
}

export class Trader {
  private session: SessionTimer;
  private riskManager: RiskManager;
  private watchlist: Watchlist | null = null;
  private stream: AlpacaStream;
  private strategies: Strategy[];
  private openPosition: OpenPosition | null = null;
  private scanComplete = false;
  private running = false;
  private executionInProgress = false;
  private cachedEquity = 0;

  constructor(
    private client: AlpacaClient,
    private config: Config
  ) {
    this.session = new SessionTimer();
    this.riskManager = new RiskManager(config);
    this.stream = new AlpacaStream(config, {
      onBar: (symbol, bar) => this.watchlist?.handleBar(symbol, bar),
      onError: (err) => log.error("Stream error", { error: err.message }),
      onConnected: () => log.info("Stream connected"),
      onDisconnected: () => log.warn("Stream disconnected"),
    });
    this.strategies = config.trading.strategies.map((name) => STRATEGY_MAP[name]);
  }

  async start(): Promise<void> {
    this.running = true;

    // Get account equity
    const account = await this.client.getAccount();
    const equity = parseFloat((account as unknown as Record<string, string>).equity);
    log.info("Account loaded", { equity: equity.toFixed(2) });

    this.cachedEquity = equity;
    await this.riskManager.initialize(equity);

    // Connect WebSocket
    this.stream.connect();

    // Set up session transitions
    this.session.on("pre-market", () => {
      dashboardBus.broadcast({ type: "session", phase: "pre-market", mode: "live" });
      this.onPreMarket();
    });
    this.session.on("open", () => {
      dashboardBus.broadcast({ type: "session", phase: "open", mode: "live" });
      this.onMarketOpen();
    });
    this.session.on("close", () => {
      dashboardBus.broadcast({ type: "session", phase: "close", mode: "live" });
      this.onMarketClose();
    });
    this.session.on("closed", () => {
      dashboardBus.broadcast({ type: "session", phase: "closed", mode: "live" });
      this.onMarketClosed();
    });
    this.session.on("midday", () => {
      dashboardBus.broadcast({ type: "session", phase: "midday", mode: "live" });
    });
    this.session.on("after-hours", () => {
      dashboardBus.broadcast({ type: "session", phase: "after-hours", mode: "live" });
    });
    this.session.start();

    // Handle current session
    const current = getCurrentSession();
    log.info("Trader started", { session: current });
    dashboardBus.broadcast({ type: "session", phase: current, mode: "live" });

    if (current === "pre-market") {
      await this.onPreMarket();
    } else if (current === "open" || current === "midday") {
      // Late start — run scan then immediately begin trading
      if (!this.scanComplete) await this.onPreMarket();
      await this.onMarketOpen();
    }

    // Main loop
    while (this.running) {
      await Bun.sleep(1000);

      if (shouldFlattenPositions() && this.openPosition) {
        await this.flattenPositions();
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.session.stop();
    this.watchlist?.stopStreaming();
    this.stream.disconnect();

    if (this.openPosition) {
      await this.flattenPositions();
    }

    this.logDailySummary();
    log.info("Trader stopped");
  }

  private async onPreMarket(): Promise<void> {
    if (this.scanComplete) return;

    log.info("Pre-market: running scanner...");
    const results = await runScanner(this.client, this.config);

    if (results.length === 0) {
      log.warn("Scanner found no candidates");
      return;
    }

    // Emit scanner results to dashboard
    dashboardBus.broadcast({
      type: "scanner",
      candidates: results.map((r) => ({
        symbol: r.symbol,
        gapPct: r.gapPct,
        price: r.price,
        relativeVolume: r.relativeVolume,
        hasCatalyst: r.hasCatalyst,
        headline: r.headline,
        score: r.score,
      })),
    });

    this.watchlist = new Watchlist(this.client, this.stream, this.config);
    await this.watchlist.loadFromScanResults(results);

    // Set up bar handler for strategy evaluation
    this.watchlist.onBar((symbol, snapshot) => {
      this.evaluateStrategies(symbol, snapshot);
    });

    this.scanComplete = true;
    log.info("Pre-market scan complete, watchlist ready");
  }

  private async onMarketOpen(): Promise<void> {
    if (!this.watchlist) {
      log.warn("No watchlist — scanner may not have run");
      return;
    }

    log.info("Market open: starting stream for watchlist");
    this.watchlist.startStreaming();
  }

  private async onMarketClose(): Promise<void> {
    log.info("Market closing: flattening positions");
    await this.flattenPositions();
  }

  private onMarketClosed(): void {
    this.watchlist?.stopStreaming();
    this.logDailySummary();
    this.scanComplete = false;
    log.info("Market closed");
  }

  private evaluateStrategies(symbol: string, snapshot: IndicatorSnapshot): void {
    if (!isTradingAllowed()) return;
    if (this.riskManager.isHalted) return;
    if (this.openPosition) {
      // Monitor existing position only if snapshot matches the position's symbol
      if (symbol === this.openPosition.symbol) {
        this.monitorPosition(snapshot);
      }
      return;
    }
    if (this.executionInProgress) return;

    const minConfidence = 50;

    // Run all enabled strategies
    let bestSignal: StrategySignal | null = null;

    for (const strategy of this.strategies) {
      const signal = strategy.evaluate(symbol, snapshot);
      if (!signal) continue;
      if (signal.confidence < minConfidence) continue;

      if (!bestSignal || signal.confidence > bestSignal.confidence) {
        bestSignal = signal;
      }
    }

    if (bestSignal) {
      // Emit signal to dashboard (accepted/rejected determined in executeSignal)
      dashboardBus.broadcast({
        type: "signal",
        symbol: bestSignal.symbol,
        strategy: bestSignal.strategy,
        confidence: bestSignal.confidence,
        entryPrice: bestSignal.entryPrice,
        stopPrice: bestSignal.stopPrice,
        targetPrice: bestSignal.targetPrice,
        reason: bestSignal.reason,
        accepted: true, // updated below if rejected by risk manager
      });

      this.executionInProgress = true;
      this.executeSignal(bestSignal).finally(() => {
        this.executionInProgress = false;
      });
    }
  }

  private async executeSignal(signal: StrategySignal): Promise<void> {
    const approval = this.riskManager.evaluateSignal(signal, this.cachedEquity);
    if (!approval.approved) {
      log.info("Signal rejected by risk manager", {
        symbol: signal.symbol,
        reason: approval.reason,
      });
      dashboardBus.broadcast({
        type: "signal",
        symbol: signal.symbol,
        strategy: signal.strategy,
        confidence: signal.confidence,
        entryPrice: signal.entryPrice,
        stopPrice: signal.stopPrice,
        targetPrice: signal.targetPrice,
        reason: signal.reason,
        accepted: false,
        rejectionReason: approval.reason,
      });
      return;
    }

    log.info("Executing signal", {
      symbol: signal.symbol,
      strategy: signal.strategy,
      entry: signal.entryPrice.toFixed(2),
      stop: signal.stopPrice.toFixed(2),
      target: signal.targetPrice.toFixed(2),
      shares: approval.positionSize.shares,
    });

    try {
      const order = await placeBracketOrder(this.client, {
        symbol: signal.symbol,
        qty: approval.positionSize.shares,
        side: "buy",
        type: "limit",
        limitPrice: signal.entryPrice,
        timeInForce: "day",
        takeProfitPrice: signal.targetPrice,
        stopLossPrice: signal.stopPrice,
      });

      const filled = await waitForFill(this.client, order.id);

      if (filled.status === "filled") {
        const avgPrice = parseFloat(filled.filledAvgPrice ?? String(signal.entryPrice));
        this.openPosition = {
          symbol: signal.symbol,
          entryPrice: avgPrice,
          shares: approval.positionSize.shares,
          strategy: signal.strategy,
          stopPrice: signal.stopPrice,
          targetPrice: signal.targetPrice,
          barsHeld: 0,
          highSinceEntry: avgPrice,
        };
        this.riskManager.onPositionOpened();
        dashboardBus.broadcast({
          type: "position:open",
          symbol: signal.symbol,
          strategy: signal.strategy,
          entryPrice: avgPrice,
          shares: approval.positionSize.shares,
          stopPrice: signal.stopPrice,
          targetPrice: signal.targetPrice,
          timestamp: new Date().toISOString(),
        });
        log.info("Position opened", {
          symbol: signal.symbol,
          avgPrice: avgPrice.toFixed(2),
          shares: approval.positionSize.shares,
        });
      } else {
        log.warn("Order not filled", {
          orderId: order.id,
          status: filled.status,
        });
      }
    } catch (err) {
      log.error("Order execution failed", { error: String(err) });
    }
  }

  private monitorPosition(snapshot: IndicatorSnapshot): void {
    if (!this.openPosition) return;

    const pos = this.openPosition;
    const curr = snapshot.bars[snapshot.bars.length - 1];
    if (!curr) return;

    pos.barsHeld++;
    pos.highSinceEntry = Math.max(pos.highSinceEntry, curr.high);

    const trailingStopLevel =
      pos.highSinceEntry * (1 - this.config.trading.trailingStopPct / 100);
    dashboardBus.broadcast({
      type: "position:update",
      symbol: pos.symbol,
      currentPrice: curr.close,
      unrealizedPnL: (curr.close - pos.entryPrice) * pos.shares,
      barsHeld: pos.barsHeld,
      highSinceEntry: pos.highSinceEntry,
      trailingStop: trailingStopLevel,
    });

    // Time stop: no progress after N bars
    if (pos.barsHeld >= this.config.trading.timeStopBars) {
      if (curr.close <= pos.entryPrice) {
        log.info("Time stop triggered", { symbol: pos.symbol, barsHeld: pos.barsHeld });
        this.closeOpenPosition(curr.close, "time-stop");
        return;
      }
    }

    // Trailing stop
    if (curr.close < trailingStopLevel) {
      log.info("Trailing stop triggered", {
        symbol: pos.symbol,
        trailingStop: trailingStopLevel.toFixed(2),
        close: curr.close.toFixed(2),
      });
      this.closeOpenPosition(curr.close, "trailing-stop");
      return;
    }

    // Price below VWAP — bearish signal for momentum plays
    if (curr.close < snapshot.vwap && pos.barsHeld >= 2) {
      log.info("VWAP breakdown exit", { symbol: pos.symbol });
      this.closeOpenPosition(curr.close, "vwap-breakdown");
    }
  }

  private async closeOpenPosition(exitPrice: number, exitReason = "manual"): Promise<void> {
    if (!this.openPosition) return;

    const pos = this.openPosition;
    try {
      await closePosition(this.client, pos.symbol);
    } catch (err) {
      log.error("Failed to close position", { error: String(err) });
    }

    const pnl = (exitPrice - pos.entryPrice) * pos.shares;
    const result: TradeResult = {
      symbol: pos.symbol,
      pnl,
      entryPrice: pos.entryPrice,
      exitPrice,
      shares: pos.shares,
    };

    dashboardBus.broadcast({
      type: "position:close",
      symbol: pos.symbol,
      exitPrice,
      pnl,
      commission: 0,
      barsHeld: pos.barsHeld,
      exitReason,
      timestamp: new Date().toISOString(),
    });

    await this.riskManager.onTradeCompleted(result);

    dashboardBus.broadcast({
      type: "risk",
      dailyPnL: this.riskManager.dailyPnL,
      consecutiveLosses: this.riskManager.consecutiveLosses,
      tradesCompleted: this.riskManager.tradesCompleted,
      tradesWon: Math.round(this.riskManager.winRate * this.riskManager.tradesCompleted),
      winRate: this.riskManager.winRate,
      isHalted: this.riskManager.isHalted,
      equity: this.cachedEquity + pnl,
    });
    dashboardBus.broadcast({
      type: "equity",
      timestamp: new Date().toISOString(),
      equity: this.cachedEquity + pnl,
    });

    this.cachedEquity += pnl;
    this.openPosition = null;
  }

  private async flattenPositions(): Promise<void> {
    if (this.openPosition) {
      const pos = this.openPosition;
      log.info("Flattening position", { symbol: pos.symbol });
      const response = await closeAllPositions(this.client);

      // Retrieve actual fill price from the order response; fall back to last bar close
      let exitPrice: number | null = null;
      if (Array.isArray(response)) {
        const orderForSymbol = response.find(
          (o: Record<string, unknown>) =>
            (o as { symbol?: string }).symbol === pos.symbol
        );
        if (orderForSymbol) {
          const filled = await waitForFill(this.client, (orderForSymbol as { id: string }).id);
          if (filled.filledAvgPrice) {
            exitPrice = parseFloat(filled.filledAvgPrice);
          }
        }
      }

      if (exitPrice === null) {
        const snapshot = this.watchlist?.getSnapshot(pos.symbol);
        exitPrice = snapshot?.bars[snapshot.bars.length - 1]?.close ?? pos.entryPrice;
      }

      const pnl = (exitPrice - pos.entryPrice) * pos.shares;

      dashboardBus.broadcast({
        type: "position:close",
        symbol: pos.symbol,
        exitPrice,
        pnl,
        commission: 0,
        barsHeld: pos.barsHeld,
        exitReason: "flatten",
        timestamp: new Date().toISOString(),
      });

      await this.riskManager.onTradeCompleted({
        symbol: pos.symbol,
        pnl,
        entryPrice: pos.entryPrice,
        exitPrice,
        shares: pos.shares,
      });

      dashboardBus.broadcast({
        type: "risk",
        dailyPnL: this.riskManager.dailyPnL,
        consecutiveLosses: this.riskManager.consecutiveLosses,
        tradesCompleted: this.riskManager.tradesCompleted,
        tradesWon: Math.round(this.riskManager.winRate * this.riskManager.tradesCompleted),
        winRate: this.riskManager.winRate,
        isHalted: this.riskManager.isHalted,
        equity: this.cachedEquity + pnl,
      });
      dashboardBus.broadcast({
        type: "equity",
        timestamp: new Date().toISOString(),
        equity: this.cachedEquity + pnl,
      });

      this.cachedEquity += pnl;
      this.openPosition = null;
    }
  }

  private logDailySummary(): void {
    log.info("=== Daily Summary ===", {
      trades: this.riskManager.tradesCompleted,
      pnl: `$${this.riskManager.dailyPnL.toFixed(2)}`,
      winRate: `${(this.riskManager.winRate * 100).toFixed(0)}%`,
      consecutiveLosses: this.riskManager.consecutiveLosses,
      halted: this.riskManager.isHalted,
    });
  }
}

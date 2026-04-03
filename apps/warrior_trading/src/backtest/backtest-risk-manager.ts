import type { Config } from "../config.js";
import type { StrategySignal } from "../strategies/types.js";
import { calculatePositionSize, type PositionSize } from "../risk/position-sizer.js";
import type { PersistedRiskState } from "../risk/state-persistence.js";
import type { TradeApproval, TradeResult } from "../risk/risk-manager.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("backtest:risk");

/**
 * BacktestRiskManager — mirrors RiskManager logic without disk I/O.
 * State resets are driven by the backtest engine at day boundaries.
 */
export class BacktestRiskManager {
  private state: PersistedRiskState;
  private hasOpenPosition = false;

  constructor(private config: Config, startingEquity: number) {
    this.state = this.freshState(startingEquity);
  }

  resetDaily(equity: number, date: string): void {
    this.state = {
      date,
      dailyPnL: 0,
      consecutiveLosses: 0,
      tradesCompleted: 0,
      tradesWon: 0,
      startingEquity: equity,
    };
    this.hasOpenPosition = false;
    log.debug("Daily state reset", { date, equity: equity.toFixed(2) });
  }

  evaluateSignal(signal: StrategySignal, equity: number): TradeApproval {
    const zero: PositionSize = { shares: 0, riskAmount: 0, positionValue: 0 };

    if (this.hasOpenPosition) {
      return { approved: false, reason: "Already have an open position", positionSize: zero };
    }

    const maxDailyLoss = this.state.startingEquity * (this.config.risk.maxDailyLossPct / 100);
    if (Math.abs(this.state.dailyPnL) >= maxDailyLoss && this.state.dailyPnL < 0) {
      return { approved: false, reason: "Daily loss limit reached", positionSize: zero };
    }

    if (this.state.consecutiveLosses >= this.config.risk.maxConsecLosses) {
      return { approved: false, reason: `${this.state.consecutiveLosses} consecutive losses`, positionSize: zero };
    }

    const reward = signal.targetPrice - signal.entryPrice;
    const risk = signal.entryPrice - signal.stopPrice;
    if (risk <= 0) {
      return { approved: false, reason: "Invalid stop: risk <= 0", positionSize: zero };
    }
    const rrRatio = reward / risk;
    if (rrRatio < this.config.risk.rrRatio) {
      return { approved: false, reason: `R:R ratio ${rrRatio.toFixed(1)} below minimum`, positionSize: zero };
    }

    const positionSize = calculatePositionSize(equity, signal.entryPrice, signal.stopPrice, this.config);
    if (positionSize.shares === 0) {
      return { approved: false, reason: "Position size 0 shares", positionSize };
    }

    const potentialLoss = positionSize.riskAmount;
    if (this.state.dailyPnL - potentialLoss < -maxDailyLoss) {
      return { approved: false, reason: "Trade would breach daily loss limit", positionSize };
    }

    return { approved: true, reason: "Approved", positionSize };
  }

  onPositionOpened(): void {
    this.hasOpenPosition = true;
  }

  onTradeCompleted(result: TradeResult): void {
    this.hasOpenPosition = false;
    this.state.dailyPnL += result.pnl;
    this.state.tradesCompleted++;

    if (result.pnl > 0) {
      this.state.tradesWon++;
      this.state.consecutiveLosses = 0;
    } else {
      this.state.consecutiveLosses++;
    }
  }

  get isHalted(): boolean {
    const maxLoss = this.state.startingEquity * (this.config.risk.maxDailyLossPct / 100);
    return (
      (this.state.dailyPnL < 0 && Math.abs(this.state.dailyPnL) >= maxLoss) ||
      this.state.consecutiveLosses >= this.config.risk.maxConsecLosses
    );
  }

  get dailyPnL(): number {
    return this.state.dailyPnL;
  }

  get consecutiveLosses(): number {
    return this.state.consecutiveLosses;
  }

  private freshState(startingEquity: number): PersistedRiskState {
    return {
      date: "",
      dailyPnL: 0,
      consecutiveLosses: 0,
      tradesCompleted: 0,
      tradesWon: 0,
      startingEquity,
    };
  }
}

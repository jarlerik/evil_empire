import type { Config } from "../config.js";
import type { StrategySignal } from "../strategies/types.js";
import { calculatePositionSize, type PositionSize } from "./position-sizer.js";
import {
  loadRiskState,
  saveRiskState,
  type PersistedRiskState,
} from "./state-persistence.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("risk:manager");

export interface TradeApproval {
  approved: boolean;
  reason: string;
  positionSize: PositionSize;
}

export interface TradeResult {
  symbol: string;
  pnl: number;
  entryPrice: number;
  exitPrice: number;
  shares: number;
}

export class RiskManager {
  private state!: PersistedRiskState;
  private hasOpenPosition = false;
  private initialized = false;

  constructor(private config: Config) {}

  async initialize(equity: number): Promise<void> {
    this.state = await loadRiskState(equity);
    this.initialized = true;

    log.info("Risk manager initialized", {
      equity,
      dailyPnL: this.state.dailyPnL,
      consecutiveLosses: this.state.consecutiveLosses,
      maxDailyLoss: equity * (this.config.risk.maxDailyLossPct / 100),
    });
  }

  evaluateSignal(signal: StrategySignal, equity: number): TradeApproval {
    if (!this.initialized) {
      return { approved: false, reason: "Risk manager not initialized", positionSize: { shares: 0, riskAmount: 0, positionValue: 0 } };
    }

    // Single position rule
    if (this.hasOpenPosition) {
      return {
        approved: false,
        reason: "Already have an open position",
        positionSize: { shares: 0, riskAmount: 0, positionValue: 0 },
      };
    }

    // Daily loss limit
    const maxDailyLoss =
      this.state.startingEquity * (this.config.risk.maxDailyLossPct / 100);
    if (Math.abs(this.state.dailyPnL) >= maxDailyLoss && this.state.dailyPnL < 0) {
      return {
        approved: false,
        reason: `Daily loss limit reached: $${this.state.dailyPnL.toFixed(2)} (max: -$${maxDailyLoss.toFixed(2)})`,
        positionSize: { shares: 0, riskAmount: 0, positionValue: 0 },
      };
    }

    // Consecutive losses
    if (this.state.consecutiveLosses >= this.config.risk.maxConsecLosses) {
      return {
        approved: false,
        reason: `${this.state.consecutiveLosses} consecutive losses (max: ${this.config.risk.maxConsecLosses})`,
        positionSize: { shares: 0, riskAmount: 0, positionValue: 0 },
      };
    }

    // Minimum stop distance
    const stopDistance = signal.entryPrice - signal.stopPrice;
    if (this.config.trading.minStopDistance > 0 && stopDistance < this.config.trading.minStopDistance) {
      return {
        approved: false,
        reason: `Stop distance $${stopDistance.toFixed(3)} below minimum $${this.config.trading.minStopDistance}`,
        positionSize: { shares: 0, riskAmount: 0, positionValue: 0 },
      };
    }

    // Reward:risk ratio check
    const reward = signal.targetPrice - signal.entryPrice;
    const risk = stopDistance;
    if (risk <= 0) {
      return {
        approved: false,
        reason: "Invalid stop: risk <= 0",
        positionSize: { shares: 0, riskAmount: 0, positionValue: 0 },
      };
    }
    const rrRatio = reward / risk;
    if (rrRatio < this.config.risk.rrRatio) {
      return {
        approved: false,
        reason: `R:R ratio ${rrRatio.toFixed(1)} below minimum ${this.config.risk.rrRatio}`,
        positionSize: { shares: 0, riskAmount: 0, positionValue: 0 },
      };
    }

    // Position sizing
    const positionSize = calculatePositionSize(
      equity,
      signal.entryPrice,
      signal.stopPrice,
      this.config
    );

    if (positionSize.shares === 0) {
      return {
        approved: false,
        reason: "Position size calculated as 0 shares",
        positionSize,
      };
    }

    // Verify this trade's max loss won't breach daily limit
    const potentialLoss = positionSize.riskAmount;
    if (this.state.dailyPnL - potentialLoss < -maxDailyLoss) {
      return {
        approved: false,
        reason: `Trade would breach daily loss limit (current: $${this.state.dailyPnL.toFixed(2)}, potential loss: $${potentialLoss.toFixed(2)})`,
        positionSize,
      };
    }

    log.info("Trade approved", {
      symbol: signal.symbol,
      strategy: signal.strategy,
      shares: positionSize.shares,
      riskAmount: positionSize.riskAmount.toFixed(2),
      rrRatio: rrRatio.toFixed(1),
    });

    return { approved: true, reason: "Approved", positionSize };
  }

  onPositionOpened(): void {
    this.hasOpenPosition = true;
  }

  async onTradeCompleted(result: TradeResult): Promise<void> {
    this.hasOpenPosition = false;

    this.state.dailyPnL += result.pnl;
    this.state.tradesCompleted++;

    if (result.pnl > 0) {
      this.state.tradesWon++;
      this.state.consecutiveLosses = 0;
    } else {
      this.state.consecutiveLosses++;
    }

    log.info("Trade completed", {
      symbol: result.symbol,
      pnl: result.pnl.toFixed(2),
      dailyPnL: this.state.dailyPnL.toFixed(2),
      consecutiveLosses: this.state.consecutiveLosses,
      winRate: this.state.tradesCompleted > 0
        ? `${((this.state.tradesWon / this.state.tradesCompleted) * 100).toFixed(0)}%`
        : "N/A",
    });

    await saveRiskState(this.state);
  }

  get dailyPnL(): number {
    return this.state.dailyPnL;
  }

  get consecutiveLosses(): number {
    return this.state.consecutiveLosses;
  }

  get tradesCompleted(): number {
    return this.state.tradesCompleted;
  }

  get winRate(): number {
    return this.state.tradesCompleted > 0
      ? this.state.tradesWon / this.state.tradesCompleted
      : 0;
  }

  get isHalted(): boolean {
    if (!this.initialized) return true;
    const maxLoss =
      this.state.startingEquity * (this.config.risk.maxDailyLossPct / 100);
    return (
      (this.state.dailyPnL < 0 && Math.abs(this.state.dailyPnL) >= maxLoss) ||
      this.state.consecutiveLosses >= this.config.risk.maxConsecLosses
    );
  }
}

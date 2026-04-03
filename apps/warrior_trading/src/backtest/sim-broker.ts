import type { Bar } from "../utils/bar.js";
import type { ExitReason } from "./types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("backtest:broker");

export interface PendingOrder {
  symbol: string;
  limitPrice: number;
  stopPrice: number;
  targetPrice: number;
  shares: number;
  submittedAt: Date;
}

export interface FilledPosition {
  symbol: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  shares: number;
  entryTime: Date;
  barsHeld: number;
  highSinceEntry: number;
}

export interface ExitResult {
  exitPrice: number;
  exitTime: Date;
  exitReason: ExitReason;
  barsHeld: number;
}

export type BrokerEvent =
  | { type: "pending" }
  | { type: "filled"; position: FilledPosition }
  | { type: "exited"; exit: ExitResult; position: FilledPosition }
  | { type: "expired" };

export class SimBroker {
  private pendingOrder: PendingOrder | null = null;
  private position: FilledPosition | null = null;

  constructor(
    private slippageTicks: number,
    private commissionPerShare: number
  ) {}

  submitOrder(order: PendingOrder): void {
    this.pendingOrder = order;
    this.position = null;
  }

  get hasPosition(): boolean {
    return this.position !== null;
  }

  get hasPendingOrder(): boolean {
    return this.pendingOrder !== null;
  }

  get currentPosition(): FilledPosition | null {
    return this.position;
  }

  getCommission(shares: number): number {
    return shares * 2 * this.commissionPerShare;
  }

  /**
   * Process a bar through the broker. Handles:
   * 1. Pending order fill checks
   * 2. Position exit checks (target, stop, ambiguity)
   */
  onBar(bar: Bar): BrokerEvent {
    const slippage = this.slippageTicks * 0.01;

    // --- Check pending order fill ---
    if (this.pendingOrder) {
      const order = this.pendingOrder;
      let fillPrice: number | null = null;

      // Gap through: bar opens above limit (for buy)
      if (bar.open >= order.limitPrice) {
        fillPrice = bar.open + slippage;
      }
      // Limit touched within bar range
      else if (bar.low <= order.limitPrice && order.limitPrice <= bar.high) {
        fillPrice = order.limitPrice + slippage;
      }

      if (fillPrice !== null) {
        this.position = {
          symbol: order.symbol,
          entryPrice: fillPrice,
          stopPrice: order.stopPrice,
          targetPrice: order.targetPrice,
          shares: order.shares,
          entryTime: bar.timestamp,
          barsHeld: 0,
          highSinceEntry: Math.max(fillPrice, bar.high),
        };
        this.pendingOrder = null;

        log.debug("Order filled", {
          symbol: order.symbol,
          fillPrice: fillPrice.toFixed(2),
          shares: order.shares,
        });

        // Check if the same bar also triggers an exit
        const exitEvent = this.checkExit(bar, slippage);
        if (exitEvent) return exitEvent;

        return { type: "filled", position: this.position };
      }

      return { type: "pending" };
    }

    // --- Check position exit ---
    if (this.position) {
      this.position.barsHeld++;
      this.position.highSinceEntry = Math.max(
        this.position.highSinceEntry,
        bar.high
      );

      const exitEvent = this.checkExit(bar, slippage);
      if (exitEvent) return exitEvent;
    }

    return this.position
      ? { type: "filled", position: this.position }
      : { type: "pending" };
  }

  /**
   * Force close at a specific price (for EOD flatten, trailing stop, etc.)
   */
  forceExit(exitPrice: number, exitTime: Date, reason: ExitReason): ExitResult | null {
    if (!this.position) return null;

    const slippage = this.slippageTicks * 0.01;
    const adjustedPrice = exitPrice - slippage;
    const result: ExitResult = {
      exitPrice: adjustedPrice,
      exitTime,
      exitReason: reason,
      barsHeld: this.position.barsHeld,
    };

    const pos = this.position;
    this.position = null;
    return result;
  }

  /**
   * Get the filled position for recording (before clearing it via forceExit)
   */
  getPositionSnapshot(): FilledPosition | null {
    return this.position ? { ...this.position } : null;
  }

  cancelPending(): void {
    this.pendingOrder = null;
  }

  private checkExit(bar: Bar, slippage: number): BrokerEvent | null {
    if (!this.position) return null;

    const pos = this.position;
    const stopHit = bar.low <= pos.stopPrice;
    const targetHit = bar.high >= pos.targetPrice;

    // Both in range — conservative: stop fills first
    if (stopHit && targetHit) {
      // If bar opens at/below stop, gap through stop
      const exitPrice =
        bar.open <= pos.stopPrice
          ? bar.open - slippage
          : pos.stopPrice - slippage;

      const exit: ExitResult = {
        exitPrice,
        exitTime: bar.timestamp,
        exitReason: "stop",
        barsHeld: pos.barsHeld,
      };
      const snapshot = { ...pos };
      this.position = null;
      return { type: "exited", exit, position: snapshot };
    }

    // Stop hit
    if (stopHit) {
      const exitPrice =
        bar.open <= pos.stopPrice
          ? bar.open - slippage
          : pos.stopPrice - slippage;

      const exit: ExitResult = {
        exitPrice,
        exitTime: bar.timestamp,
        exitReason: "stop",
        barsHeld: pos.barsHeld,
      };
      const snapshot = { ...pos };
      this.position = null;
      return { type: "exited", exit, position: snapshot };
    }

    // Target hit
    if (targetHit) {
      const exitPrice =
        bar.open >= pos.targetPrice
          ? bar.open - slippage
          : pos.targetPrice - slippage;

      const exit: ExitResult = {
        exitPrice,
        exitTime: bar.timestamp,
        exitReason: "target",
        barsHeld: pos.barsHeld,
      };
      const snapshot = { ...pos };
      this.position = null;
      return { type: "exited", exit, position: snapshot };
    }

    return null;
  }
}

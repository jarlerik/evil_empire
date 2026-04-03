import type { Config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("risk:sizer");

export interface PositionSize {
  shares: number;
  riskAmount: number;
  positionValue: number;
}

export function calculatePositionSize(
  equity: number,
  entryPrice: number,
  stopPrice: number,
  config: Config
): PositionSize {
  const stopDistance = Math.abs(entryPrice - stopPrice);
  if (stopDistance === 0) {
    log.warn("Stop distance is zero, returning 0 shares");
    return { shares: 0, riskAmount: 0, positionValue: 0 };
  }

  // Risk amount = equity × risk per trade %
  const riskAmount = equity * (config.risk.riskPerTradePct / 100);

  // Shares = risk amount / stop distance
  let shares = Math.floor(riskAmount / stopDistance);

  // Safety cap: position value should not exceed equity
  const positionValue = shares * entryPrice;
  if (positionValue > equity) {
    shares = Math.floor(equity / entryPrice);
  }

  // Minimum 1 share
  shares = Math.max(shares, 0);

  log.debug("Position sized", {
    equity,
    entryPrice,
    stopPrice,
    stopDistance,
    riskPct: config.risk.riskPerTradePct,
    riskAmount: riskAmount.toFixed(2),
    shares,
    positionValue: (shares * entryPrice).toFixed(2),
  });

  return {
    shares,
    riskAmount,
    positionValue: shares * entryPrice,
  };
}

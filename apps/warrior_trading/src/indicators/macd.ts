import { createEMA, updateEMA, type EMAState } from "./ema.js";

export interface MACDState {
  fastEMA: EMAState; // 12-period
  slowEMA: EMAState; // 26-period
  signalEMA: EMAState; // 9-period signal line
  primed: boolean;
}

export interface MACDValues {
  macd: number; // fast EMA - slow EMA
  signal: number; // 9-period EMA of MACD line
  histogram: number; // macd - signal
}

export function createMACD(
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDState {
  return {
    fastEMA: createEMA(fastPeriod),
    slowEMA: createEMA(slowPeriod),
    signalEMA: createEMA(signalPeriod),
    primed: false,
  };
}

export function updateMACD(state: MACDState, price: number): MACDValues {
  const fast = updateEMA(state.fastEMA, price);
  const slow = updateEMA(state.slowEMA, price);

  // MACD line only valid once both EMAs are primed
  if (!state.fastEMA.primed || !state.slowEMA.primed) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  const macdLine = fast - slow;
  const signal = updateEMA(state.signalEMA, macdLine);

  state.primed = state.signalEMA.primed;

  const histogram = state.primed ? macdLine - signal : 0;

  return { macd: macdLine, signal, histogram };
}

export function computeMACDSeries(prices: number[]): MACDValues[] {
  const state = createMACD();
  return prices.map((p) => updateMACD(state, p));
}

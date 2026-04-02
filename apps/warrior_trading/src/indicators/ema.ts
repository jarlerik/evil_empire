import type { Bar } from "../utils/bar.js";

export interface EMAState {
  period: number;
  value: number;
  multiplier: number;
  primed: boolean; // true once we've processed enough bars
  count: number;
  sum: number; // used for SMA seed
}

export function createEMA(period: number): EMAState {
  return {
    period,
    value: 0,
    multiplier: 2 / (period + 1),
    primed: false,
    count: 0,
    sum: 0,
  };
}

export function updateEMA(state: EMAState, price: number): number {
  if (!state.primed) {
    state.sum += price;
    state.count++;
    if (state.count >= state.period) {
      state.value = state.sum / state.period;
      state.primed = true;
    }
    return state.value;
  }

  state.value = (price - state.value) * state.multiplier + state.value;
  return state.value;
}

export function computeEMASeries(bars: Bar[], period: number): number[] {
  const state = createEMA(period);
  return bars.map((bar) => updateEMA(state, bar.close));
}

// Convenience: compute multiple EMAs in one pass
export interface MultiEMA {
  ema9: EMAState;
  ema20: EMAState;
  ema50: EMAState;
  ema200: EMAState;
}

export function createMultiEMA(): MultiEMA {
  return {
    ema9: createEMA(9),
    ema20: createEMA(20),
    ema50: createEMA(50),
    ema200: createEMA(200),
  };
}

export interface MultiEMAValues {
  ema9: number;
  ema20: number;
  ema50: number;
  ema200: number;
}

export function updateMultiEMA(
  state: MultiEMA,
  price: number
): MultiEMAValues {
  return {
    ema9: updateEMA(state.ema9, price),
    ema20: updateEMA(state.ema20, price),
    ema50: updateEMA(state.ema50, price),
    ema200: updateEMA(state.ema200, price),
  };
}

import type { Bar } from "../utils/bar.js";

export interface ATRState {
  period: number;
  value: number;
  count: number;
  sum: number;
  prevClose: number | null;
  primed: boolean;
}

export function createATR(period = 14): ATRState {
  return {
    period,
    value: 0,
    count: 0,
    sum: 0,
    prevClose: null,
    primed: false,
  };
}

function trueRange(bar: Bar, prevClose: number | null): number {
  if (prevClose === null) {
    return bar.high - bar.low;
  }
  return Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - prevClose),
    Math.abs(bar.low - prevClose)
  );
}

export function updateATR(state: ATRState, bar: Bar): number {
  const tr = trueRange(bar, state.prevClose);
  state.prevClose = bar.close;

  if (!state.primed) {
    state.sum += tr;
    state.count++;
    if (state.count >= state.period) {
      state.value = state.sum / state.period;
      state.primed = true;
    }
    return state.value;
  }

  // Wilder's smoothing: ATR = ((prev ATR * (period - 1)) + TR) / period
  state.value =
    (state.value * (state.period - 1) + tr) / state.period;
  return state.value;
}

export function computeATRSeries(bars: Bar[], period = 14): number[] {
  const state = createATR(period);
  return bars.map((bar) => updateATR(state, bar));
}

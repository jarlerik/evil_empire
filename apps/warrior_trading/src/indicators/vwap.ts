import type { Bar } from "../utils/bar.js";

export interface VWAPState {
  cumulativeTPV: number; // cumulative (typical price * volume)
  cumulativeVolume: number;
  value: number;
}

export function createVWAP(): VWAPState {
  return {
    cumulativeTPV: 0,
    cumulativeVolume: 0,
    value: 0,
  };
}

export function resetVWAP(state: VWAPState): void {
  state.cumulativeTPV = 0;
  state.cumulativeVolume = 0;
  state.value = 0;
}

export function updateVWAP(state: VWAPState, bar: Bar): number {
  const typicalPrice = (bar.high + bar.low + bar.close) / 3;
  state.cumulativeTPV += typicalPrice * bar.volume;
  state.cumulativeVolume += bar.volume;

  if (state.cumulativeVolume > 0) {
    state.value = state.cumulativeTPV / state.cumulativeVolume;
  }

  return state.value;
}

export function computeVWAPSeries(bars: Bar[]): number[] {
  const state = createVWAP();
  return bars.map((bar) => updateVWAP(state, bar));
}

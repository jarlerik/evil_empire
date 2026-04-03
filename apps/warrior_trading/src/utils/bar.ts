export interface Bar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  tradeCount?: number;
}

export interface Quote {
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  timestamp: Date;
}

export interface Snapshot {
  symbol: string;
  latestBar: Bar;
  latestQuote: Quote;
  prevDailyBar: Bar;
  minuteBar: Bar;
}

export function barBodySize(bar: Bar): number {
  return Math.abs(bar.close - bar.open);
}

export function barRange(bar: Bar): number {
  return bar.high - bar.low;
}

export function isBullish(bar: Bar): boolean {
  return bar.close > bar.open;
}

export function isBearish(bar: Bar): boolean {
  return bar.close < bar.open;
}

export function isDoji(bar: Bar, threshold = 0.05): boolean {
  const range = barRange(bar);
  if (range === 0) return true;
  return barBodySize(bar) / range < threshold;
}

export function upperWick(bar: Bar): number {
  return bar.high - Math.max(bar.open, bar.close);
}

export function lowerWick(bar: Bar): number {
  return Math.min(bar.open, bar.close) - bar.low;
}

export function midpoint(bar: Bar): number {
  return (bar.high + bar.low) / 2;
}

export function gapPercent(current: Bar, previous: Bar): number {
  if (previous.close === 0) return 0;
  return ((current.open - previous.close) / previous.close) * 100;
}
